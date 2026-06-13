from django.shortcuts import get_object_or_404
from django.db import transaction, models
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_fsm import TransitionNotAllowed
from datetime import datetime
from decimal import Decimal

from core.mixins import OrganizationViewSetMixin
from core.permissions import IsOrganizationMember
from accounts.models import UserRole, UserProfile
from leave.models import LeaveType, LeaveBalance, LeaveRequest, CompanyHoliday
from leave.serializers import (
    LeaveTypeSerializer,
    LeaveBalanceSerializer,
    LeaveRequestSerializer,
    CompanyHolidaySerializer,
    WorkingDaysCalcSerializer
)
from leave.utils import calculate_working_days

class LeaveTypeViewSet(OrganizationViewSetMixin, viewsets.ModelViewSet):
    """
    ViewSet to manage Leave Type configurations per tenant organization.
    """
    queryset = LeaveType.objects.all()
    serializer_class = LeaveTypeSerializer
    permission_classes = [IsAuthenticated, IsOrganizationMember]
    filterset_fields = ['is_active']


class LeaveBalanceViewSet(OrganizationViewSetMixin, viewsets.ReadOnlyModelViewSet):
    """
    ViewSet to list and retrieve user leave balances.
    Tenancy is scoped through LeaveType relationship.
    Regular employees can only view their own balances.
    Managers/Admins can see all balances of their organization.
    """
    queryset = LeaveBalance.objects.all().select_related('user', 'leave_type')
    serializer_class = LeaveBalanceSerializer
    permission_classes = [IsAuthenticated, IsOrganizationMember]
    
    # Scope tenant through the leave_type relationship
    tenant_filter_path = "leave_type__organization"
    
    filterset_fields = ['year', 'leave_type']

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        
        # Guard clause
        if not user or user.is_anonymous:
            return queryset.none()
            
        role = user.profile.role
        
        # Regular employees are restricted to viewing only their own balances
        if role == UserRole.EMPLOYEE:
            return queryset.filter(user=user)
            
        # Managers / Admins can filter by specific user
        user_id = self.request.query_params.get('user_id')
        if user_id:
            return queryset.filter(user_id=user_id)
            
        return queryset


class CompanyHolidayViewSet(OrganizationViewSetMixin, viewsets.ModelViewSet):
    """
    ViewSet to manage Company Holidays per organization.
    Used to calculate weekend/holiday exclusions for leaves.
    """
    queryset = CompanyHoliday.objects.all()
    serializer_class = CompanyHolidaySerializer
    permission_classes = [IsAuthenticated, IsOrganizationMember]
    filterset_fields = ['year', 'is_recurring']


class LeaveRequestViewSet(OrganizationViewSetMixin, viewsets.ModelViewSet):
    """
    ViewSet to manage individual Leave Requests.
    Uses UUID lookup. Scopes list views to role permissions.
    """
    queryset = LeaveRequest.objects.all().select_related('requester', 'leave_type', 'delegate_to')
    serializer_class = LeaveRequestSerializer
    permission_classes = [IsAuthenticated, IsOrganizationMember]
    lookup_field = 'uuid'
    
    filterset_fields = ['state', 'leave_type', 'start_date', 'end_date']

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        
        if not user or user.is_anonymous:
            return queryset.none()
            
        role = user.profile.role
        
        if self.action == 'list':
            # Employee can only see their own requests
            if role == UserRole.EMPLOYEE:
                return queryset.filter(requester=user)
                
            # Team Lead can see their own requests AND those of their department
            elif role == UserRole.TEAM_LEAD:
                # Single TL per company - sees all org requests
                return queryset
            
        # CEO / Admin see all requests in the organization (handled by mixin)
        return queryset

    def create(self, request, *args, **kwargs):
        if request.user.profile.role == UserRole.CEO:
            return Response({"detail": "CEOs cannot apply for leave."}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        user = self.request.user
        serializer.save(
            requester=user,
            organization=user.profile.organization
        )

    @action(detail=True, methods=['post'])
    def submit(self, request, uuid=None):
        """Submits request and reserves requested leave days in pending balance."""
        obj = self.get_object()
        
        if obj.requester != request.user:
            return Response({"detail": "Only the creator can submit this request."}, status=status.HTTP_403_FORBIDDEN)
            
        try:
            with transaction.atomic():
                obj.submit()
                
                # Fetch and lock balance for update to avoid race conditions
                balance = LeaveBalance.objects.select_for_update().get(
                    user=obj.requester,
                    leave_type=obj.leave_type,
                    year=obj.start_date.year
                )
                
                # Reserve days
                balance.pending = Decimal(str(balance.pending)) + Decimal(str(obj.working_days_requested))
                balance.save()
                
                obj.save()
            return Response(self.get_serializer(obj).data)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def approve(self, request, uuid=None):
        """Approves leave request, supporting TL/GM date adjustments and CEO direct superpower approval."""
        obj = self.get_object()
        user = request.user
        role = user.profile.role
        
        from core.utils import is_authorized_approver
        if not is_authorized_approver(user, obj, 'LEAVE'):
            return Response({"detail": "You do not have approval clearance for this request in its current state."}, status=status.HTTP_403_FORBIDDEN)
            
        note = request.data.get('note') or request.data.get('reason')
        if not note:
            return Response({"note": ["An approval note/reason is required."]}, status=status.HTTP_400_BAD_REQUEST)
            
        start_date_str = request.data.get('start_date')
        end_date_str = request.data.get('end_date')
        
        if start_date_str:
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date() if isinstance(start_date_str, str) else start_date_str
        else:
            start_date = obj.start_date
            
        if end_date_str:
            end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date() if isinstance(end_date_str, str) else end_date_str
        else:
            end_date = obj.end_date
            
        from datetime import date
        from core.models import ApprovalDelegation
        today = date.today()
        delegator_ids = list(ApprovalDelegation.objects.filter(
            delegate=user,
            scope__in=['LEAVE', 'ALL'],
            start_date__lte=today,
            end_date__gte=today,
            is_active=True
        ).values_list('delegator_id', flat=True))
        
        is_ceo = (role == UserRole.CEO) or (role == UserRole.ADMIN) or UserProfile.objects.filter(user_id__in=delegator_ids, role=UserRole.CEO).exists()
        is_gm = (role == UserRole.GENERAL_MANAGER) or UserProfile.objects.filter(user_id__in=delegator_ids, role=UserRole.GENERAL_MANAGER).exists()
        
        from leave.utils import calculate_working_days, check_overlap, check_negative_balance
        
        try:
            with transaction.atomic():
                old_working_days = Decimal(str(obj.working_days_requested))
                old_year = obj.start_date.year
                
                # Retrieve requester's balance
                balance = LeaveBalance.objects.select_for_update().get(
                    user=obj.requester,
                    leave_type=obj.leave_type,
                    year=old_year
                )
                
                if is_ceo and obj.state in ['draft', 'pending_tl_approval', 'pending_gm_approval']:
                    old_state = obj.state
                    obj.ceo_direct_approve(note)
                    obj.save()
                    
                    # Update balances
                    if old_state == 'draft':
                        # Reserve nothing, directly use
                        balance.used = Decimal(str(balance.used)) + Decimal(str(obj.working_days_requested))
                    else:
                        # Deduct from pending, add to used
                        balance.pending = Decimal(str(balance.pending)) - old_working_days
                        balance.used = Decimal(str(balance.used)) + Decimal(str(obj.working_days_requested))
                    balance.save()
                    
                elif obj.state == 'pending_tl_approval':
                    new_working_days = calculate_working_days(obj.organization, start_date, end_date)
                    check_overlap(obj.requester, start_date, end_date, obj.id)
                    
                    # Temporarily adjust pending for verification check
                    balance.pending = Decimal(str(balance.pending)) - old_working_days
                    balance.save()
                    try:
                        check_negative_balance(obj.requester, obj.leave_type, new_working_days, start_date.year)
                    except Exception as e:
                        balance.pending = Decimal(str(balance.pending)) + old_working_days
                        balance.save()
                        raise e
                    
                    obj.tl_approve(start_date, end_date, note)
                    obj.save()
                    
                    balance.pending = Decimal(str(balance.pending)) + Decimal(str(obj.working_days_requested))
                    balance.save()
                    
                elif obj.state == 'pending_gm_approval' and (is_gm or is_ceo):
                    new_working_days = calculate_working_days(obj.organization, start_date, end_date)
                    check_overlap(obj.requester, start_date, end_date, obj.id)
                    
                    balance.pending = Decimal(str(balance.pending)) - old_working_days
                    balance.save()
                    try:
                        check_negative_balance(obj.requester, obj.leave_type, new_working_days, start_date.year)
                    except Exception as e:
                        balance.pending = Decimal(str(balance.pending)) + old_working_days
                        balance.save()
                        raise e
                    
                    obj.gm_approve(start_date, end_date, note)
                    obj.save()
                    
                    balance.used = Decimal(str(balance.used)) + Decimal(str(obj.working_days_requested))
                    balance.save()
                else:
                    raise ValidationError("Request is not in a state that can be approved by your role.")
                    
            return Response(self.get_serializer(obj).data)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def reject(self, request, uuid=None):
        """Rejects request and releases reserved pending balance days."""
        obj = self.get_object()
        user = request.user
        
        from core.utils import is_authorized_approver
        if not is_authorized_approver(user, obj, 'LEAVE'):
            return Response({"detail": "You do not have authorization to reject this request in its current state."}, status=status.HTTP_403_FORBIDDEN)
            
        reason = request.data.get('reason') or request.data.get('note')
        if not reason:
            return Response({"reason": ["A reason is required on rejection."]}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            with transaction.atomic():
                obj.reject(reason)
                
                # Release pending reservation
                balance = LeaveBalance.objects.select_for_update().get(
                    user=obj.requester,
                    leave_type=obj.leave_type,
                    year=obj.start_date.year
                )
                balance.pending = Decimal(str(balance.pending)) - Decimal(str(obj.working_days_requested))
                balance.save()
                
                obj.save()
            return Response(self.get_serializer(obj).data)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def amend(self, request, uuid=None):
        """Moves rejected request back to draft."""
        obj = self.get_object()
        if obj.requester != request.user:
            return Response({"detail": "Only the requester can amend this request."}, status=status.HTTP_403_FORBIDDEN)
            
        try:
            with transaction.atomic():
                obj.amend()
                obj.save()
            return Response(self.get_serializer(obj).data)
        except TransitionNotAllowed:
            return Response({"detail": "Cannot amend request from its current state."}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def cancel(self, request, uuid=None):
        """Cancels request. Reverts used/pending balance deductions accordingly."""
        obj = self.get_object()
        if obj.requester != request.user:
            return Response({"detail": "Only the requester can cancel this request."}, status=status.HTTP_403_FORBIDDEN)
            
        old_state = obj.state
        
        try:
            with transaction.atomic():
                obj.cancel()
                
                balance = LeaveBalance.objects.select_for_update().get(
                    user=obj.requester,
                    leave_type=obj.leave_type,
                    year=obj.start_date.year
                )
                
                # Revert balances depending on where in the workflow request was cancelled
                if old_state == 'approved':
                    balance.used = Decimal(str(balance.used)) - Decimal(str(obj.working_days_requested))
                elif old_state in ['pending_tl_approval', 'pending_gm_approval']:
                    balance.pending = Decimal(str(balance.pending)) - Decimal(str(obj.working_days_requested))
                    
                balance.save()
                obj.save()
            return Response(self.get_serializer(obj).data)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], url_path='calculate-days')
    def calculate_days(self, request):
        """Live working days calculation excluding weekends and holidays."""
        serializer = WorkingDaysCalcSerializer(data=request.data)
        if serializer.is_valid(raise_exception=True):
            start = serializer.validated_data['start_date']
            end = serializer.validated_data['end_date']
            org = request.user.profile.organization
            
            days = calculate_working_days(org, start, end)
            return Response({"working_days": days})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], url_path='team-calendar')
    def team_calendar(self, request):
        """Returns a month-view schedule of which employees are out on approved leave."""
        # Get query parameters
        month_str = request.query_params.get('month')
        year_str = request.query_params.get('year')
        
        today = datetime.today()
        month = int(month_str) if month_str else today.month
        year = int(year_str) if year_str else today.year
        
        org = request.user.profile.organization
        
        # Query approved leaves overlapping with target month/year
        leaves = LeaveRequest.objects.filter(
            organization=org,
            state='approved',
            start_date__year__lte=year,
            end_date__year__gte=year
        ).select_related('requester', 'leave_type')
        
        # Filter leaves that overlap with the target month
        # Start date <= end of month AND end date >= start of month
        import calendar
        _, last_day = calendar.monthrange(year, month)
        month_start = datetime(year, month, 1).date()
        month_end = datetime(year, month, last_day).date()
        
        overlapping_leaves = [
            leaf for leaf in leaves 
            if leaf.start_date <= month_end and leaf.end_date >= month_start
        ]
        
        # Serialize calendar payload
        data = []
        for leaf in overlapping_leaves:
            data.append({
                "id": leaf.id,
                "requester": {
                    "id": leaf.requester.id,
                    "username": leaf.requester.username,
                    "full_name": leaf.requester.get_full_name(),
                    "department": leaf.requester.profile.department.name if leaf.requester.profile.department else None
                },
                "leave_type": leaf.leave_type.name,
                "start_date": leaf.start_date,
                "end_date": leaf.end_date,
                "working_days_requested": leaf.working_days_requested,
                "is_half_day": leaf.is_half_day,
                "half_day_period": leaf.half_day_period
            })
            
        return Response(data)

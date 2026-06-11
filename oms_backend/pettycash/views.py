from django.shortcuts import get_object_or_404
from django.db import transaction
from django.http import HttpResponse
from django.core.exceptions import ValidationError
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_fsm import TransitionNotAllowed

from core.mixins import OrganizationViewSetMixin
from core.permissions import IsOrganizationMember
from accounts.models import UserRole
from pettycash.models import PettyCashRequest, PettyCashLineItem, Attachment, Disbursement
from pettycash.serializers import (
    PettyCashRequestSerializer,
    AttachmentSerializer,
    DisbursementSerializer
)

class PettyCashViewSet(OrganizationViewSetMixin, viewsets.ModelViewSet):
    """
    ViewSet to manage Petty Cash Requisitions.
    Uses UUID lookup for standard API endpoints.
    Enforces tenant-isolation and FSM transition safety.
    """
    queryset = PettyCashRequest.objects.all().prefetch_related('line_items', 'attachments', 'disbursements')
    serializer_class = PettyCashRequestSerializer
    permission_classes = [IsAuthenticated, IsOrganizationMember]
    lookup_field = 'uuid'
    
    filterset_fields = ['state', 'priority', 'department']
    search_fields = ['title', 'description', 'requester__username', 'requester__email']

    def perform_create(self, serializer):
        # Auto-set the requester, department, and tenant organization based on user profile
        user = self.request.user
        serializer.save(
            requester=user,
            department=user.profile.department,
            organization=user.profile.organization
        )

    @action(detail=True, methods=['post'])
    def submit(self, request, uuid=None):
        """Transitions request state from draft to pending_tl_approval."""
        obj = self.get_object()
        
        # Check permissions
        if obj.requester != request.user:
            return Response({"detail": "Only the creator can submit this request."}, status=status.HTTP_403_FORBIDDEN)
            
        try:
            with transaction.atomic():
                obj.submit()  # FSM validation
                obj.save()
            return Response(self.get_serializer(obj).data)
        except ValidationError as e:
            return Response({"detail": str(e.message if hasattr(e, 'message') else e)}, status=status.HTTP_400_BAD_REQUEST)
        except TransitionNotAllowed:
            return Response({"detail": "Cannot submit request from current state."}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def approve(self, request, uuid=None):
        """Approves the request. Escales to CEO if above TL limit."""
        obj = self.get_object()
        user = request.user
        role = user.profile.role
        
        # Check approval authorization (direct role or delegation)
        from core.utils import is_authorized_approver
        if not is_authorized_approver(user, obj, 'PETTY_CASH'):
            return Response({"detail": "You do not have approval clearance for this request in its current state."}, status=status.HTTP_403_FORBIDDEN)
            
        approved_amount = request.data.get('approved_amount', obj.amount_requested)
        
        try:
            with transaction.atomic():
                # Perform the transition based on the request's current state
                if obj.state == 'pending_tl_approval':
                    obj.tl_approve(approved_amount)
                elif obj.state == 'pending_ceo_approval':
                    obj.ceo_approve(approved_amount)
                else:
                    raise ValidationError("Request is not in a state that can be approved.")
                
                obj.save()
            return Response(self.get_serializer(obj).data)
        except ValidationError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except TransitionNotAllowed:
            return Response({"detail": "Cannot approve request in its current state."}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def reject(self, request, uuid=None):
        """Rejects the request (requires a reason)."""
        obj = self.get_object()
        user = request.user
        role = user.profile.role
        
        from core.utils import is_authorized_approver
        if not is_authorized_approver(user, obj, 'PETTY_CASH'):
            return Response({"detail": "You do not have authorization to reject this request in its current state."}, status=status.HTTP_403_FORBIDDEN)
            
        reason = request.data.get('reason')
        if not reason:
            return Response({"reason": ["This field is required on rejection."]}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            with transaction.atomic():
                obj.reject(reason)
                obj.save()
            return Response(self.get_serializer(obj).data)
        except ValidationError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except TransitionNotAllowed:
            return Response({"detail": "Cannot reject request in its current state."}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def amend(self, request, uuid=None):
        """Moves a rejected request back to draft to allow editing."""
        obj = self.get_object()
        
        if obj.requester != request.user:
            return Response({"detail": "Only the requester can amend this request."}, status=status.HTTP_403_FORBIDDEN)
            
        try:
            with transaction.atomic():
                obj.amend()
                obj.save()
            return Response(self.get_serializer(obj).data)
        except TransitionNotAllowed:
            return Response({"detail": "Cannot amend request from current state."}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def cancel(self, request, uuid=None):
        """Cancels a request."""
        obj = self.get_object()
        
        if obj.requester != request.user:
            return Response({"detail": "Only the requester can cancel this request."}, status=status.HTTP_403_FORBIDDEN)
            
        try:
            with transaction.atomic():
                obj.cancel()
                obj.save()
            return Response(self.get_serializer(obj).data)
        except TransitionNotAllowed:
            return Response({"detail": "Cannot cancel request from current state."}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def disburse(self, request, uuid=None):
        """
        Performs a payout disbursement.
        Tracks running total and updates department's budget spent metric.
        """
        obj = self.get_object()
        user = request.user
        
        # Accounts clearance check (Admin or CEO)
        if user.profile.role not in [UserRole.ADMIN, UserRole.CEO]:
            return Response({"detail": "Only accounts team (Admins/CEOs) can disburse funds."}, status=status.HTTP_403_FORBIDDEN)
            
        if obj.state not in ['approved', 'partially_disbursed']:
            return Response({"detail": "Funds can only be disbursed for approved or partially disbursed requests."}, status=status.HTTP_400_BAD_REQUEST)
            
        amount = request.data.get('amount')
        payment_method = request.data.get('payment_method', 'CASH')
        reference_number = request.data.get('reference_number', '')
        notes = request.data.get('notes', '')
        
        try:
            amount = float(amount)
        except (TypeError, ValueError):
            return Response({"amount": ["A valid amount is required."]}, status=status.HTTP_400_BAD_REQUEST)
            
        # Validate that we don't disburse more than approved remaining balance
        remaining_balance = obj.amount_approved - obj.amount_disbursed
        if amount <= 0 or amount > remaining_balance:
            return Response({"amount": [f"Amount must be positive and not exceed the remaining balance of ৳{remaining_balance}."]}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            with transaction.atomic():
                # Create Disbursement log
                Disbursement.objects.create(
                    request=obj,
                    disbursed_by=user,
                    amount=amount,
                    payment_method=payment_method,
                    reference_number=reference_number,
                    notes=notes
                )
                
                # Update request balances
                obj.amount_disbursed = float(obj.amount_disbursed) + amount
                
                # Deduct from department monthly budget
                dept = obj.department
                dept.budget_spent_this_month = float(dept.budget_spent_this_month) + amount
                dept.save()
                
                # State transition
                if obj.amount_disbursed >= obj.amount_approved:
                    obj.final_disburse(amount)
                else:
                    obj.partial_disburse(amount)
                    
                obj.save()
                
            return Response(self.get_serializer(obj).data)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='attachments')
    def upload_attachments(self, request, uuid=None):
        """Allows uploading files scoped to this request."""
        obj = self.get_object()
        
        # Only draft requests can have attachments added
        if obj.state != 'draft':
            return Response({"detail": "Attachments can only be added to draft requests."}, status=status.HTTP_400_BAD_REQUEST)
            
        files = request.FILES.getlist('files')
        if not files:
            return Response({"files": ["No files were uploaded."]}, status=status.HTTP_400_BAD_REQUEST)
            
        if len(files) > 5:
            return Response({"detail": "Maximum 5 files can be uploaded at once."}, status=status.HTTP_400_BAD_REQUEST)
            
        attachments = []
        try:
            with transaction.atomic():
                for f in files:
                    serializer = AttachmentSerializer(data={'file': f}, context={'request': request})
                    if serializer.is_valid(raise_exception=True):
                        # Save inside the atomic block
                        attachment = serializer.save(
                            request=obj,
                            uploaded_by=request.user
                        )
                        attachments.append(attachment)
            
            return Response(AttachmentSerializer(attachments, many=True, context={'request': request}).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], url_path='bulk-action')
    def bulk_action(self, request):
        """Express Bulk Approval for Managers (TL/CEO)."""
        request_ids = request.data.get('request_ids', [])
        action_type = request.data.get('action')  # 'approve' | 'reject'
        reason = request.data.get('reason', '')
        
        if action_type not in ['approve', 'reject']:
            return Response({"action": ["Action must be 'approve' or 'reject'."]}, status=status.HTTP_400_BAD_REQUEST)
            
        role = request.user.profile.role
        if role not in [UserRole.TEAM_LEAD, UserRole.CEO, UserRole.ADMIN]:
            return Response({"detail": "You do not have bulk action permissions."}, status=status.HTTP_403_FORBIDDEN)
            
        results = {"success": [], "failed": []}
        
        for req_id in request_ids:
            try:
                with transaction.atomic():
                    pcr = PettyCashRequest.objects.select_for_update().get(
                        id=req_id,
                        organization=request.organization
                    )
                    
                    from core.utils import is_authorized_approver
                    if not is_authorized_approver(request.user, pcr, 'PETTY_CASH'):
                        raise ValidationError("You do not have authorization to act on this request.")
                        
                    if action_type == 'approve':
                        if pcr.state == 'pending_tl_approval':
                            pcr.tl_approve()
                        elif pcr.state == 'pending_ceo_approval':
                            pcr.ceo_approve()
                    elif action_type == 'reject':
                        pcr.reject(reason)
                        
                    pcr.save()
                    results["success"].append(req_id)
            except Exception as e:
                results["failed"].append({"id": req_id, "error": str(e)})
                
        return Response(results)


class AttachmentDownloadView(APIView):
    """
    Downloads an attachment file by ID.
    Reads binary file contents directly from the database and returns a file response.
    Enforces tenancy isolation checks.
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, pk):
        attachment = get_object_or_404(Attachment, pk=pk)
        
        user_profile = request.user.profile
        # Enforce multi-tenancy: Only admin or members of the same organization can download
        if user_profile.role != UserRole.ADMIN:
            # Check organization owner
            obj_org = None
            if attachment.request:
                obj_org = attachment.request.organization
            elif attachment.leave_request:
                obj_org = attachment.leave_request.organization
                
            if obj_org != user_profile.organization:
                return Response({"detail": "Permission denied to access this attachment."}, status=status.HTTP_403_FORBIDDEN)
                
        response = HttpResponse(attachment.file_data, content_type=attachment.content_type)
        response['Content-Disposition'] = f'inline; filename="{attachment.original_filename}"'
        return response

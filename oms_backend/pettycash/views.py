from django.shortcuts import get_object_or_404
from django.db import transaction
from django.http import HttpResponse
from django.core.exceptions import ValidationError
from django.conf import settings
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_fsm import TransitionNotAllowed
import requests as http_requests

from core.mixins import OrganizationViewSetMixin
from core.permissions import IsOrganizationMember
from accounts.models import UserRole
from pettycash.models import PettyCashRequest, PettyCashLineItem, Attachment, Disbursement
from pettycash.serializers import (
    PettyCashRequestSerializer,
    PettyCashListSerializer,
    AttachmentSerializer,
    DisbursementSerializer
)

from django.db.models import Q, Prefetch
from accounts.models import UserProfile

class PettyCashViewSet(OrganizationViewSetMixin, viewsets.ModelViewSet):
    """
    ViewSet to manage Petty Cash Requisitions.
    Uses UUID lookup for standard API endpoints.
    Enforces tenant-isolation and FSM transition safety.
    """
    queryset = PettyCashRequest.objects.all().select_related(
        'requester', 'department'
    ).prefetch_related(
        'line_items',
        Prefetch('attachments', queryset=Attachment.objects.defer('file_data')),
        'disbursements'
    )
    serializer_class = PettyCashRequestSerializer
    permission_classes = [IsAuthenticated, IsOrganizationMember]
    lookup_field = 'uuid'

    def get_serializer_class(self):
        if self.action == 'list':
            return PettyCashListSerializer
        return PettyCashRequestSerializer
    
    filterset_fields = ['state', 'priority', 'department']
    search_fields = ['title', 'description', 'requester__username', 'requester__email']

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        
        if not user or user.is_anonymous:
            return queryset.none()
            
        if self.action == 'list':
            # Clear all prefetches since PettyCashListSerializer doesn't serialize line items/attachments
            queryset = queryset.prefetch_related(None).select_related('requester', 'department')
            
        role = user.profile.role
        
        only_self = self.request.query_params.get('only_self') == 'true'
        if only_self:
            return queryset.filter(requester=user)
            
        if self.action == 'list':
            # Employee can only see their own requests
            if role == UserRole.EMPLOYEE:
                return queryset.filter(requester=user)
                
            # Team Lead can see their own requests AND those of their department
            elif role == UserRole.TEAM_LEAD:
                # Single TL per company - sees all org requests, not just one department
                return queryset
            
        # CEO / Admin / GENERAL_MANAGER / HR see all requests in the organization (handled by mixin)
        exclude_self = self.request.query_params.get('exclude_self') == 'true'
        if exclude_self:
            queryset = queryset.exclude(requester=user)

        return queryset

    def create(self, request, *args, **kwargs):
        if request.user.profile.role == UserRole.CEO:
            return Response({"detail": "CEOs cannot create petty cash requests."}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

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
        """Approves the request, supporting TL modifications and CEO superpower direct approval."""
        obj = self.get_object()
        user = request.user
        role = user.profile.role
        
        # Check approval authorization (direct role or delegation)
        from core.utils import is_authorized_approver
        if not is_authorized_approver(user, obj, 'PETTY_CASH'):
            return Response({"detail": "You do not have approval clearance for this request in its current state."}, status=status.HTTP_403_FORBIDDEN)
            
        note = request.data.get('note') or request.data.get('reason')
        if not note:
            return Response({"note": ["An approval note/reason is required."]}, status=status.HTTP_400_BAD_REQUEST)
            
        # Get optional modifications
        amount = request.data.get('amount')
        if amount is not None:
            try:
                amount = float(amount)
            except (TypeError, ValueError):
                return Response({"amount": ["A valid amount is required."]}, status=status.HTTP_400_BAD_REQUEST)
        else:
            amount = obj.amount_requested if obj.amount_approved == 0 else obj.amount_approved

        needed_by_str = request.data.get('needed_by')
        if needed_by_str:
            from datetime import datetime
            needed_by = datetime.strptime(needed_by_str, "%Y-%m-%d").date() if isinstance(needed_by_str, str) else needed_by_str
        else:
            needed_by = obj.needed_by

        priority = request.data.get('priority', obj.priority)
        
        from datetime import date
        from core.models import ApprovalDelegation
        today = date.today()
        delegator_ids = list(ApprovalDelegation.objects.filter(
            delegate=user,
            scope__in=['PETTY_CASH', 'ALL'],
            start_date__lte=today,
            end_date__gte=today,
            is_active=True
        ).values_list('delegator_id', flat=True))
        
        is_ceo = (role == UserRole.CEO) or (role == UserRole.ADMIN) or UserProfile.objects.filter(user_id__in=delegator_ids, role=UserRole.CEO).exists()
        
        try:
            with transaction.atomic():
                if is_ceo and obj.state in ['draft', 'pending_tl_approval', 'pending_ceo_approval']:
                    obj.ceo_direct_approve(amount, note)
                elif obj.state == 'pending_tl_approval':
                    obj.tl_approve(amount, needed_by, priority, note)
                elif obj.state == 'pending_ceo_approval':
                    obj.ceo_approve(amount, needed_by, note)
                else:
                    raise ValidationError("Request is not in a state that can be approved.")
                
                obj.save()
            return Response(self.get_serializer(obj).data)
        except ValidationError as e:
            return Response({"detail": str(e.message if hasattr(e, 'message') else e)}, status=status.HTTP_400_BAD_REQUEST)
        except TransitionNotAllowed:
            return Response({"detail": "Cannot approve request in its current state."}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def reject(self, request, uuid=None):
        """Rejects the request (requires a reason). Routes to rejected (TL) or rejected_by_ceo (CEO)."""
        obj = self.get_object()
        user = request.user
        role = user.profile.role
        
        from core.utils import is_authorized_approver
        if not is_authorized_approver(user, obj, 'PETTY_CASH'):
            return Response({"detail": "You do not have authorization to reject this request in its current state."}, status=status.HTTP_403_FORBIDDEN)
            
        reason = request.data.get('reason') or request.data.get('note')
        if not reason:
            return Response({"reason": ["This field is required on rejection."]}, status=status.HTTP_400_BAD_REQUEST)
            
        from datetime import date
        from core.models import ApprovalDelegation
        today = date.today()
        delegator_ids = list(ApprovalDelegation.objects.filter(
            delegate=user,
            scope__in=['PETTY_CASH', 'ALL'],
            start_date__lte=today,
            end_date__gte=today,
            is_active=True
        ).values_list('delegator_id', flat=True))
        
        is_ceo = (role == UserRole.CEO) or (role == UserRole.ADMIN) or UserProfile.objects.filter(user_id__in=delegator_ids, role=UserRole.CEO).exists()
        
        try:
            with transaction.atomic():
                if obj.state == 'pending_ceo_approval' and is_ceo:
                    obj.ceo_reject(reason)
                elif obj.state == 'pending_tl_approval':
                    obj.tl_reject(reason)
                else:
                    raise ValidationError("Request is not in a state that can be rejected.")
                obj.save()
            return Response(self.get_serializer(obj).data)
        except ValidationError as e:
            return Response({"detail": str(e.message if hasattr(e, 'message') else e)}, status=status.HTTP_400_BAD_REQUEST)
        except TransitionNotAllowed:
            return Response({"detail": "Cannot reject request in its current state."}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def resubmit(self, request, uuid=None):
        """Allows employee to edit and resubmit request directly to CEO from rejected_by_ceo state."""
        obj = self.get_object()
        if obj.requester != request.user:
            return Response({"detail": "Only the requester can resubmit this request."}, status=status.HTTP_403_FORBIDDEN)
            
        amount = request.data.get('amount')
        needed_by_str = request.data.get('needed_by')
        
        try:
            amount = float(amount)
        except (TypeError, ValueError):
            return Response({"amount": ["A valid amount is required."]}, status=status.HTTP_400_BAD_REQUEST)
            
        from datetime import datetime
        try:
            needed_by = datetime.strptime(needed_by_str, "%Y-%m-%d").date() if isinstance(needed_by_str, str) else needed_by_str
        except Exception:
            return Response({"needed_by": ["A valid needed_by date is required (YYYY-MM-DD)."]}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            with transaction.atomic():
                obj.employee_resubmit(amount, needed_by)
                obj.save()
            return Response(self.get_serializer(obj).data)
        except ValidationError as e:
            return Response({"detail": str(e.message if hasattr(e, 'message') else e)}, status=status.HTTP_400_BAD_REQUEST)
        except TransitionNotAllowed:
            return Response({"detail": "Cannot resubmit request from current state."}, status=status.HTTP_400_BAD_REQUEST)

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
        Performs a payout disbursement by HR.
        Tracks running total and updates department's budget spent metric.
        """
        obj = self.get_object()
        user = request.user
        
        from core.utils import is_authorized_approver
        if not is_authorized_approver(user, obj, 'PETTY_CASH'):
            return Response({"detail": "Only HR and Admins can disburse funds for requests pending HR disbursement."}, status=status.HTTP_403_FORBIDDEN)
            
        if obj.state not in ['pending_hr_disbursement', 'partially_disbursed']:
            return Response({"detail": "Funds can only be disbursed for requests pending HR disbursement."}, status=status.HTTP_400_BAD_REQUEST)
            
        amount = request.data.get('amount')
        payment_method = request.data.get('payment_method', 'CASH')
        reference_number = request.data.get('reference_number', '')
        notes = request.data.get('notes') or request.data.get('note')
        
        if not notes:
            return Response({"notes": ["A disbursement note/reason is required."]}, status=status.HTTP_400_BAD_REQUEST)
            
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
                # FSM state transition
                obj.hr_disburse(amount, notes)
                
                # Create Disbursement log
                Disbursement.objects.create(
                    request=obj,
                    disbursed_by=user,
                    amount=amount,
                    payment_method=payment_method,
                    reference_number=reference_number,
                    notes=notes
                )
                
                # Deduct from department monthly budget
                dept = obj.department
                dept.budget_spent_this_month = float(dept.budget_spent_this_month) + amount
                dept.save()
                
                obj.save()
                
            return Response(self.get_serializer(obj).data)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='attachments')
    def upload_attachments(self, request, uuid=None):
        """Allows uploading files scoped to this request."""
        obj = self.get_object()
        
        # Only draft/rejected_by_ceo requests can have attachments added
        if obj.state not in ['draft', 'rejected_by_ceo']:
            return Response({"detail": "Attachments can only be added to draft or rejected by CEO requests."}, status=status.HTTP_400_BAD_REQUEST)
            
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
                        
                    note = reason or "Bulk approved"
                    if action_type == 'approve':
                        if pcr.state == 'pending_tl_approval':
                            pcr.tl_approve(pcr.amount_requested, pcr.needed_by, pcr.priority, note)
                        elif pcr.state == 'pending_ceo_approval':
                            pcr.ceo_approve(pcr.amount_approved, pcr.needed_by, note)
                    elif action_type == 'reject':
                        note = reason or "Bulk rejected"
                        if pcr.state == 'pending_tl_approval':
                            pcr.tl_reject(note)
                        elif pcr.state == 'pending_ceo_approval':
                            pcr.ceo_reject(note)
                        
                    pcr.save()
                    results["success"].append(req_id)
            except Exception as e:
                results["failed"].append({"id": req_id, "error": str(e)})
                
        return Response(results)

    @action(detail=False, methods=['get'], url_path='price-lookup', permission_classes=[IsAuthenticated])
    def price_lookup(self, request):
        """
        Proxy to SerpAPI Google Search (Bangladesh, BDT).
        Returns structured price results for a given product query.
        GET /api/petty-cash/price-lookup/?q=<product name>
        """
        import re
        query = request.query_params.get('q', '').strip()
        if not query:
            return Response({'detail': 'Query parameter "q" is required.'}, status=status.HTTP_400_BAD_REQUEST)

        api_key = settings.SERPAPI_KEY
        if not api_key:
            return Response({'detail': 'Price lookup is not configured on this server.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        # Clean status prefix (e.g. "Pending CEO - Hardware Router upgrade" -> "Hardware Router upgrade")
        cleaned_query = re.sub(
            r'^(pending\s+(?:ceo|tl|payout|hr|disbursement|approval)|approved|rejected|draft|cancelled|processed)\s*[-:\s]\s*',
            '',
            query,
            flags=re.IGNORECASE
        ).strip()

        # Optimize search query to target price search in Bangladesh if not specified
        search_query = cleaned_query
        lower_query = cleaned_query.lower()
        if 'price' not in lower_query and 'bd' not in lower_query and 'bangladesh' not in lower_query:
            search_query = f"{cleaned_query} price in bd"

        try:
            resp = http_requests.get(
                'https://serpapi.com/search.json',
                params={
                    'engine': 'google',
                    'q': search_query,
                    'gl': 'bd',
                    'hl': 'en',
                    'location': 'Dhaka, Bangladesh',
                    'api_key': api_key,
                    'num': 10,
                },
                timeout=10
            )
            resp.raise_for_status()
            data = resp.json()
        except http_requests.exceptions.Timeout:
            return Response({'detail': 'Price lookup timed out. Try again.'}, status=status.HTTP_504_GATEWAY_TIMEOUT)
        except http_requests.exceptions.RequestException as e:
            return Response({'detail': f'Price lookup failed: {str(e)}'}, status=status.HTTP_502_BAD_GATEWAY)

        organic_results = data.get('organic_results', [])
        results = []
        
        # Regex to match BDT price patterns (e.g. Tk 500, BDT 500, 500 BDT, 500 Tk, BDT 300 - 500, BDT 300 to 500)
        price_pattern = re.compile(
            r'(?:(?:BDT|Tk|TK|৳|Taka|taka)\.?\s*\d+(?:,\d{3})*(?:\.\d{2})?(?:\s*(?:-|to)\s*(?:(?:BDT|Tk|TK|৳|Taka|taka)\.?\s*)?\d+(?:,\d{3})*(?:\.\d{2})?)?|\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:BDT|Tk|TK|৳|Taka|taka)\.?)',
            re.IGNORECASE
        )

        for item in organic_results[:10]:
            title = item.get('title', '')
            link = item.get('link', '')
            snippet = item.get('snippet', '')
            
            # Determine store/source
            source = item.get('source', '')
            if not source:
                displayed_link = item.get('displayed_link', '')
                if displayed_link:
                    source = displayed_link.split(' › ')[0].replace('https://', '').replace('http://', '').split('/')[0]
                else:
                    source = 'Website'
            
            # Extract price
            price = ''
            if snippet:
                match = price_pattern.search(snippet)
                if match:
                    price = match.group(0).strip()
            
            if not price and title:
                match = price_pattern.search(title)
                if match:
                    price = match.group(0).strip()
                    
            thumbnail = item.get('favicon', '')

            results.append({
                'title': title,
                'price': price,
                'store': source,
                'link': link,
                'thumbnail': thumbnail,
            })

        return Response({'results': results, 'query': query})


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

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from django.db import models

from core.models import AuditLog
from core.serializers import AuditLogSerializer
from core.mixins import OrganizationViewSetMixin
from accounts.models import UserRole

class AuditLogViewSet(OrganizationViewSetMixin, viewsets.ReadOnlyModelViewSet):
    """
    ViewSet to expose recent activity audit logs to authorized roles (CEO, GM, Team Lead).
    Scopes logs per tenant organization.
    """
    queryset = AuditLog.objects.all().select_related('actor').order_by('-created_at')
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        
        if not user or user.is_anonymous:
            return queryset.none()
            
        role = user.profile.role
        
        # Employees cannot see recent activities
        if role == UserRole.EMPLOYEE:
            return queryset.none()
            
        # Team Leads can only see logs of requests originating from their department
        if role == UserRole.TEAM_LEAD:
            dept = user.profile.department
            if not dept:
                return queryset.none()
                
            from pettycash.models import PettyCashRequest
            from leave.models import LeaveRequest
            
            # Subqueries/Filtering by related request department
            pc_ids = list(PettyCashRequest.objects.filter(requester__profile__department=dept).values_list('id', flat=True))
            leave_ids = list(LeaveRequest.objects.filter(requester__profile__department=dept).values_list('id', flat=True))
            
            queryset = queryset.filter(
                models.Q(target_type='PettyCashRequest', target_id__in=pc_ids) |
                models.Q(target_type='LeaveRequest', target_id__in=leave_ids)
            )
            
        # CEOs and General Managers can see all logs in the organization (already filtered by OrganizationViewSetMixin)
        return queryset

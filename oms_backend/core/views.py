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
            
        # Team Leads can see all logs in the organization (already filtered by OrganizationViewSetMixin)
        if role == UserRole.TEAM_LEAD:
            # Single TL per company - sees all org audit logs
            pass
            
        # CEOs and General Managers can see all logs in the organization (already filtered by OrganizationViewSetMixin)
        return queryset

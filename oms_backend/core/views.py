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


import os
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

class DailyCronView(APIView):
    """
    Cron view to run daily background tasks.
    Secured by verifying Bearer token in request headers matching Vercel's CRON_SECRET.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        # Authorize Vercel cron trigger
        cron_secret = os.environ.get('CRON_SECRET')
        auth_header = request.headers.get('Authorization')
        
        # If CRON_SECRET environment variable is configured, validate it
        if cron_secret:
            if not auth_header or auth_header != f"Bearer {cron_secret}":
                return Response({"detail": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)
        
        # Run the daily tasks synchronously
        from core.tasks import reset_monthly_budgets, expire_delegations_daily
        
        try:
            reset_res = reset_monthly_budgets()
            expire_res = expire_delegations_daily()
            return Response({
                "status": "success",
                "reset_budgets": reset_res,
                "expire_delegations": expire_res
            })
        except Exception as e:
            return Response({
                "status": "error",
                "detail": str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


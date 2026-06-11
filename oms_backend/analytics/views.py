from datetime import date, timedelta
from django.utils import timezone
from django.db.models.functions import TruncMonth
from django.db.models import Sum, Count
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from core.mixins import OrganizationViewSetMixin
from core.permissions import IsCEOOrAdmin, IsOrganizationMember
from core.models import Department
from pettycash.models import PettyCashRequest
from leave.models import LeaveRequest
from analytics.serializers import LeaveAbsenceSerializer

class AnalyticsViewSet(OrganizationViewSetMixin, viewsets.ViewSet):
    """
    ViewSet to expose aggregated analytics endpoints for CEOs and Admins.
    Enforces tenant scoping via OrganizationViewSetMixin and role checks.
    """
    permission_classes = [IsAuthenticated, IsOrganizationMember, IsCEOOrAdmin]

    @action(detail=False, methods=['get'], url_path='spending-trends')
    def spending_trends(self, request):
        """Monthly petty cash spending for the last 12 months."""
        org = request.organization
        today = date.today()
        # Find start of month 11 months ago to get full 12 months sequence
        start_date = date(today.year - 1, today.month, 1)
        
        data = PettyCashRequest.objects.filter(
            organization=org,
            state__in=['disbursed', 'partially_disbursed'],
            created_at__date__gte=start_date
        ).annotate(
            month=TruncMonth('created_at')
        ).values('month').annotate(
            total_disbursed=Sum('amount_disbursed'),
            request_count=Count('id')
        ).order_by('month')
        
        formatted_data = []
        for item in data:
            formatted_data.append({
                "month": item['month'].strftime("%Y-%m") if item['month'] else "",
                "total_disbursed": float(item['total_disbursed']) if item['total_disbursed'] else 0.0,
                "request_count": item['request_count']
            })
            
        return Response(formatted_data)

    @action(detail=False, methods=['get'], url_path='budget-burn-rate')
    def budget_burn_rate(self, request):
        """Per-department monthly budget utilization."""
        departments = Department.objects.filter(organization=request.organization)
        data = []
        for d in departments:
            spent = float(d.budget_spent_this_month)
            budget = float(d.monthly_budget)
            utilization = round((spent / budget) * 100, 1) if budget > 0 else 0.0
            data.append({
                "department": d.name,
                "budget": budget,
                "spent": spent,
                "utilization_pct": utilization
            })
        return Response(data)

    @action(detail=False, methods=['get'], url_path='upcoming-absences')
    def upcoming_absences(self, request):
        """Employees on leave in the next 30 days."""
        today = date.today()
        thirty_days_later = today + timedelta(days=30)
        
        upcoming = LeaveRequest.objects.filter(
            organization=request.organization,
            state='approved',
            start_date__lte=thirty_days_later,
            end_date__gte=today
        ).select_related('requester__profile', 'leave_type')
        
        return Response(LeaveAbsenceSerializer(upcoming, many=True).data)

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        """Executive summary metrics (spend, pending queues, counts)."""
        org = request.organization
        today = date.today()
        start_of_month = date(today.year, today.month, 1)

        # 1. Total requests created this month
        total_requests = PettyCashRequest.objects.filter(
            organization=org,
            created_at__date__gte=start_of_month
        ).count()

        # 2. Total pending approvals across petty cash and leave request modules
        pending_pettycash = PettyCashRequest.objects.filter(
            organization=org,
            state__in=['pending_tl_approval', 'pending_ceo_approval']
        ).count()
        
        pending_leave = LeaveRequest.objects.filter(
            organization=org,
            state__in=['pending_tl_approval', 'pending_ceo_approval']
        ).count()
        
        pending_approvals = pending_pettycash + pending_leave

        # 3. Monthly petty cash spend (aggregated amount disbursed in the current month)
        from pettycash.models import Disbursement
        monthly_spend_query = Disbursement.objects.filter(
            request__organization=org,
            disbursed_at__date__gte=start_of_month
        ).aggregate(total=Sum('amount'))
        monthly_spend = float(monthly_spend_query['total']) if monthly_spend_query['total'] else 0.0

        # 4. Employees currently on leave today
        employees_on_leave = LeaveRequest.objects.filter(
            organization=org,
            state='approved',
            start_date__lte=today,
            end_date__gte=today
        ).values('requester').distinct().count()

        return Response({
            "total_requests": total_requests,
            "pending_approvals": pending_approvals,
            "monthly_spend": monthly_spend,
            "employees_on_leave": employees_on_leave
        })

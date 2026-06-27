from datetime import date, timedelta, datetime
from django.utils import timezone
from django.db.models.functions import TruncMonth
from django.db.models import Sum, Count
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from core.mixins import OrganizationViewSetMixin
from core.permissions import CanAccessAnalytics, IsOrganizationMember
from core.models import Department
from pettycash.models import PettyCashRequest, Disbursement
from leave.models import LeaveRequest
from analytics.serializers import LeaveAbsenceSerializer

class AnalyticsViewSet(OrganizationViewSetMixin, viewsets.ViewSet):
    """
    ViewSet to expose aggregated analytics endpoints for CEOs, Admins, GMs, Team Leads, and HR.
    Enforces tenant scoping via OrganizationViewSetMixin and role checks.
    """
    permission_classes = [IsAuthenticated, IsOrganizationMember, CanAccessAnalytics]

    @action(detail=False, methods=['get'], url_path='spending-trends')
    def spending_trends(self, request):
        """Monthly petty cash spending for the last 12 months based on disbursement dates."""
        org = request.organization
        today = date.today()
        # Find start of month 11 months ago to get full 12 months sequence
        start_date = date(today.year - 1, today.month, 1)
        start_datetime = timezone.make_aware(datetime.combine(start_date, datetime.min.time()))
        
        # Calculate last 12 months sequence in chronological order
        months_list = []
        year = today.year
        month = today.month
        for i in range(12):
            offset = 11 - i
            cur_month = month - offset
            cur_year = year
            while cur_month <= 0:
                cur_month += 12
                cur_year -= 1
            months_list.append(f"{cur_year:04d}-{cur_month:02d}")

        trends_dict = {m: {"month": m, "total_disbursed": 0.0, "request_count": set()} for m in months_list}

        # Query disbursements in the last 12 months
        disbursements = Disbursement.objects.filter(
            request__organization=org,
            disbursed_at__gte=start_datetime
        ).select_related('request')

        for d in disbursements:
            local_dt = timezone.localtime(d.disbursed_at)
            m_str = local_dt.strftime("%Y-%m")
            if m_str in trends_dict:
                trends_dict[m_str]["total_disbursed"] += float(d.amount)
                trends_dict[m_str]["request_count"].add(d.request_id)

        formatted_data = []
        for m in months_list:
            item = trends_dict[m]
            formatted_data.append({
                "month": item["month"],
                "total_disbursed": round(item["total_disbursed"], 2),
                "request_count": len(item["request_count"])
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
        ).select_related('requester__profile__department', 'leave_type').only(
            'id', 'start_date', 'end_date', 'working_days_requested',
            'leave_type__name',
            'requester__username', 'requester__first_name', 'requester__last_name',
            'requester__profile__id', 'requester__profile__department__id', 'requester__profile__department__name'
        )
        
        return Response(LeaveAbsenceSerializer(upcoming, many=True).data)

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        """Executive summary metrics (spend, pending queues, counts)."""
        org = request.organization
        today = date.today()
        start_of_month = date(today.year, today.month, 1)
        start_datetime = timezone.make_aware(datetime.combine(start_of_month, datetime.min.time()))

        # 1. Total requests created this month
        total_requests = PettyCashRequest.objects.filter(
            organization=org,
            created_at__gte=start_datetime
        ).count()

        # 2. Total pending approvals across petty cash and leave request modules
        pending_pettycash = PettyCashRequest.objects.filter(
            organization=org,
            state__in=['pending_tl_approval', 'pending_ceo_approval', 'pending_hr_disbursement', 'partially_disbursed']
        ).count()
        
        pending_leave = LeaveRequest.objects.filter(
            organization=org,
            state__in=['pending_tl_approval', 'pending_gm_approval']
        ).count()
        
        pending_approvals = pending_pettycash + pending_leave

        # 3. Monthly petty cash spend (aggregated amount disbursed in the current month)
        from pettycash.models import Disbursement
        monthly_spend_query = Disbursement.objects.filter(
            request__organization=org,
            disbursed_at__gte=start_datetime
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


    @action(detail=False, methods=['get'], url_path='reports/weekly')
    def weekly_report(self, request):
        """Current week's operational summary metrics and chart data."""
        org = request.organization
        today = date.today()
        start_of_week = today - timedelta(days=today.weekday())  # Monday
        start_datetime = timezone.make_aware(datetime.combine(start_of_week, datetime.min.time()))

        disbursements = Disbursement.objects.filter(
            request__organization=org,
            disbursed_at__gte=start_datetime
        ).select_related('request__department', 'request__requester')

        vouchers = PettyCashRequest.objects.filter(
            organization=org,
            created_at__gte=start_datetime
        ).select_related('requester', 'department')

        leaves = LeaveRequest.objects.filter(
            organization=org,
            created_at__gte=start_datetime
        ).select_related('requester', 'leave_type')

        total_disbursed = sum(float(d.amount) for d in disbursements)
        total_vouchers = vouchers.count()
        total_leaves = leaves.count()

        pending_pettycash = PettyCashRequest.objects.filter(
            organization=org,
            state__in=['pending_tl_approval', 'pending_ceo_approval', 'pending_hr_disbursement', 'partially_disbursed']
        ).count()
        pending_leave = LeaveRequest.objects.filter(
            organization=org,
            state__in=['pending_tl_approval', 'pending_gm_approval']
        ).count()
        pending_approvals = pending_pettycash + pending_leave

        days_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        daily_amounts = {day: 0.0 for day in days_names}
        for d in disbursements:
            local_dt = timezone.localtime(d.disbursed_at)
            day_str = local_dt.strftime("%a")
            if day_str in daily_amounts:
                daily_amounts[day_str] += float(d.amount)
        
        daily_disbursements = [{"day": day, "amount": round(daily_amounts[day], 2)} for day in days_names]

        departments = Department.objects.filter(organization=org)
        dept_amounts = {dept.id: {"name": dept.name, "total": 0.0} for dept in departments}
        for d in disbursements:
            dept_id = d.request.department_id
            if dept_id in dept_amounts:
                dept_amounts[dept_id]["total"] += float(d.amount)

        total_spent = sum(d["total"] for d in dept_amounts.values())
        department_breakdown = []
        for d_id, d_data in dept_amounts.items():
            pct = round((d_data["total"] / total_spent * 100), 1) if total_spent > 0 else 0.0
            department_breakdown.append({
                "department": d_data["name"],
                "total": round(d_data["total"], 2),
                "pct": pct
            })

        leave_summary = []
        for l in leaves:
            leave_summary.append({
                "employee": f"{l.requester.first_name} {l.requester.last_name}".strip() if l.requester.first_name else l.requester.username,
                "leave_type": l.leave_type.name,
                "status": l.state,
                "days": float(l.working_days_requested),
                "start_date": l.start_date.strftime("%Y-%m-%d"),
                "end_date": l.end_date.strftime("%Y-%m-%d")
            })

        petty_cash_summary = []
        for v in vouchers:
            petty_cash_summary.append({
                "id": v.id,
                "title": v.title,
                "requester": f"{v.requester.first_name} {v.requester.last_name}".strip() if v.requester.first_name else v.requester.username,
                "amount": float(v.amount_requested),
                "state": v.state.replace('_', ' ').title(),
                "created_at": v.created_at.strftime("%Y-%m-%d")
            })

        return Response({
            "totals": {
                "total_disbursed": round(total_disbursed, 2),
                "total_vouchers": total_vouchers,
                "total_leaves": total_leaves,
                "pending_approvals": pending_approvals
            },
            "daily_disbursements": daily_disbursements,
            "department_breakdown": department_breakdown,
            "leave_summary": leave_summary,
            "petty_cash_summary": petty_cash_summary
        })


    @action(detail=False, methods=['get'], url_path='reports/monthly')
    def monthly_report(self, request):
        """Current month's operational performance summary and chart data."""
        org = request.organization
        today = date.today()
        start_of_month = date(today.year, today.month, 1)
        start_datetime = timezone.make_aware(datetime.combine(start_of_month, datetime.min.time()))

        disbursements = Disbursement.objects.filter(
            request__organization=org,
            disbursed_at__gte=start_datetime
        ).select_related('request__department', 'request__requester')

        vouchers = PettyCashRequest.objects.filter(
            organization=org,
            created_at__gte=start_datetime
        ).select_related('requester', 'department')

        leaves = LeaveRequest.objects.filter(
            organization=org,
            created_at__gte=start_datetime
        ).select_related('requester', 'leave_type')

        total_disbursed = sum(float(d.amount) for d in disbursements)
        total_vouchers = vouchers.count()
        total_leaves = leaves.count()

        approved_vouchers = vouchers.filter(state__in=['approved', 'disbursed', 'partially_disbursed']).count()
        approval_rate = round(approved_vouchers / total_vouchers * 100, 1) if total_vouchers > 0 else 0.0

        weekly_amounts = {
            "Week 1": 0.0,
            "Week 2": 0.0,
            "Week 3": 0.0,
            "Week 4": 0.0,
            "Week 5": 0.0
        }
        for d in disbursements:
            local_dt = timezone.localtime(d.disbursed_at)
            day = local_dt.day
            if day <= 7:
                weekly_amounts["Week 1"] += float(d.amount)
            elif day <= 14:
                weekly_amounts["Week 2"] += float(d.amount)
            elif day <= 21:
                weekly_amounts["Week 3"] += float(d.amount)
            elif day <= 28:
                weekly_amounts["Week 4"] += float(d.amount)
            else:
                weekly_amounts["Week 5"] += float(d.amount)

        weekly_trend = [{"week": wk, "amount": round(amt, 2)} for wk, amt in weekly_amounts.items()]

        departments = Department.objects.filter(organization=org)
        department_breakdown = []
        for dept in departments:
            spent = sum(float(d.amount) for d in disbursements if d.request.department_id == dept.id)
            budget = float(dept.monthly_budget)
            pct = round(spent / budget * 100, 1) if budget > 0 else 0.0
            department_breakdown.append({
                "department": dept.name,
                "spent": round(spent, 2),
                "budget": round(budget, 2),
                "pct": pct
            })

        leave_summary = []
        for l in leaves:
            leave_summary.append({
                "employee": f"{l.requester.first_name} {l.requester.last_name}".strip() if l.requester.first_name else l.requester.username,
                "leave_type": l.leave_type.name,
                "status": l.state,
                "days": float(l.working_days_requested),
                "start_date": l.start_date.strftime("%Y-%m-%d"),
                "end_date": l.end_date.strftime("%Y-%m-%d")
            })

        petty_cash_summary = []
        for v in vouchers:
            petty_cash_summary.append({
                "id": v.id,
                "title": v.title,
                "requester": f"{v.requester.first_name} {v.requester.last_name}".strip() if v.requester.first_name else v.requester.username,
                "amount": float(v.amount_requested),
                "state": v.state.replace('_', ' ').title(),
                "created_at": v.created_at.strftime("%Y-%m-%d")
            })

        return Response({
            "totals": {
                "total_disbursed": round(total_disbursed, 2),
                "total_vouchers": total_vouchers,
                "total_leaves": total_leaves,
                "approval_rate": approval_rate
            },
            "weekly_trend": weekly_trend,
            "department_breakdown": department_breakdown,
            "leave_summary": leave_summary,
            "petty_cash_summary": petty_cash_summary
        })


    @action(detail=False, methods=['get'], url_path='reports/quarterly')
    def quarterly_report(self, request):
        """Current quarter's operational overview summary and chart data."""
        org = request.organization
        today = date.today()
        current_quarter = (today.month - 1) // 3 + 1
        start_month = (current_quarter - 1) * 3 + 1
        start_of_quarter = date(today.year, start_month, 1)
        start_datetime = timezone.make_aware(datetime.combine(start_of_quarter, datetime.min.time()))

        disbursements = Disbursement.objects.filter(
            request__organization=org,
            disbursed_at__gte=start_datetime
        ).select_related('request__department', 'request__requester')

        vouchers = PettyCashRequest.objects.filter(
            organization=org,
            created_at__gte=start_datetime
        ).select_related('requester', 'department')

        leaves = LeaveRequest.objects.filter(
            organization=org,
            created_at__gte=start_datetime
        ).select_related('requester', 'leave_type')

        total_disbursed = sum(float(d.amount) for d in disbursements)
        total_vouchers = vouchers.count()
        total_leaves = leaves.count()

        approved_vouchers = vouchers.filter(state__in=['approved', 'disbursed', 'partially_disbursed']).count()
        approval_rate = round(approved_vouchers / total_vouchers * 100, 1) if total_vouchers > 0 else 0.0

        month_names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
        q_months = [month_names[start_month - 1 + idx] for idx in range(3)]
        monthly_amounts = {m: 0.0 for m in q_months}
        for d in disbursements:
            local_dt = timezone.localtime(d.disbursed_at)
            m_name = month_names[local_dt.month - 1]
            if m_name in monthly_amounts:
                monthly_amounts[m_name] += float(d.amount)

        monthly_breakdown = [{"month": m, "amount": round(monthly_amounts[m], 2)} for m in q_months]

        departments = Department.objects.filter(organization=org)
        department_breakdown = []
        for dept in departments:
            spent = sum(float(d.amount) for d in disbursements if d.request.department_id == dept.id)
            budget = float(dept.monthly_budget) * 3
            pct = round(spent / budget * 100, 1) if budget > 0 else 0.0
            department_breakdown.append({
                "department": dept.name,
                "total": round(spent, 2),
                "budget": round(budget, 2),
                "pct": pct
            })

        requester_amounts = {}
        for d in disbursements:
            requester = d.request.requester
            name = f"{requester.first_name} {requester.last_name}".strip() if requester.first_name else requester.username
            dept_name = d.request.department.name if d.request.department else ""
            if requester.id not in requester_amounts:
                requester_amounts[requester.id] = {
                    "name": name,
                    "department": dept_name,
                    "total": 0.0
                }
            requester_amounts[requester.id]["total"] += float(d.amount)

        top_requesters = sorted(requester_amounts.values(), key=lambda x: x["total"], reverse=True)[:5]

        leave_summary = []
        for l in leaves:
            leave_summary.append({
                "employee": f"{l.requester.first_name} {l.requester.last_name}".strip() if l.requester.first_name else l.requester.username,
                "leave_type": l.leave_type.name,
                "status": l.state,
                "days": float(l.working_days_requested),
                "start_date": l.start_date.strftime("%Y-%m-%d"),
                "end_date": l.end_date.strftime("%Y-%m-%d")
            })

        petty_cash_summary = []
        for v in vouchers:
            petty_cash_summary.append({
                "id": v.id,
                "title": v.title,
                "requester": f"{v.requester.first_name} {v.requester.last_name}".strip() if v.requester.first_name else v.requester.username,
                "amount": float(v.amount_requested),
                "state": v.state.replace('_', ' ').title(),
                "created_at": v.created_at.strftime("%Y-%m-%d")
            })

        return Response({
            "totals": {
                "total_disbursed": round(total_disbursed, 2),
                "total_vouchers": total_vouchers,
                "total_leaves": total_leaves,
                "approval_rate": approval_rate
            },
            "monthly_breakdown": monthly_breakdown,
            "department_breakdown": department_breakdown,
            "top_requesters": top_requesters,
            "leave_summary": leave_summary,
            "petty_cash_summary": petty_cash_summary
        })


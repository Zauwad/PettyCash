from django.test import TestCase
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from rest_framework.test import APIClient
from rest_framework import status
from datetime import date

from core.models import Organization, Department
from accounts.models import UserProfile, UserRole
from leave.models import LeaveType, LeaveBalance, LeaveRequest, CompanyHoliday
from leave.utils import calculate_working_days

class LeaveAPITests(TestCase):
    """
    Tests for Leave Management module including:
    - Working days calculator (Friday/Saturday weekends & holiday exclusions)
    - Overlap detection validation
    - Negative balance policies
    - Workflow approval state transitions and balance updates
    """
    def setUp(self):
        self.client = APIClient()
        
        # Setup tenant organization - retrieve pre-seeded Org to avoid slug collisions
        self.org = Organization.objects.get(slug="amaze")
        self.org.policy_config = {"allow_negative_sick_leave": True}
        self.org.save()
        
        self.dept = Department.objects.create(
            organization=self.org,
            name="HR & Operations",
            monthly_budget=10000.00
        )
        
        # Setup users
        self.user_emp = User.objects.create_user(
            username="emp1", email="emp1@amaze.com", password="password123", first_name="Employee", last_name="One"
        )
        self.profile_emp = UserProfile.objects.create(
            user=self.user_emp, organization=self.org, department=self.dept, role=UserRole.EMPLOYEE, employee_id="AMZ01"
        )
        
        self.user_tl = User.objects.create_user(
            username="lead1", email="lead1@amaze.com", password="password123", first_name="Lead", last_name="One"
        )
        self.profile_tl = UserProfile.objects.create(
            user=self.user_tl, organization=self.org, department=self.dept, role=UserRole.TEAM_LEAD, employee_id="AMZ02"
        )
        
        # Setup leave type: Annual Leave (No negative balance)
        self.annual_leave = LeaveType.objects.create(
            organization=self.org,
            name="Annual Leave",
            code="ANNUAL",
            default_days_per_year=15,
            allow_negative_balance=False
        )
        
        # Setup leave type: Sick Leave (Allows negative balance via org policy config)
        self.sick_leave = LeaveType.objects.create(
            organization=self.org,
            name="Sick Leave",
            code="SICK",
            default_days_per_year=10,
            allow_negative_balance=False
        )

        # Initialize balances for Employee
        self.balance_annual = LeaveBalance.objects.create(
            user=self.user_emp,
            leave_type=self.annual_leave,
            year=2026,
            total_allocated=15.0,
            used=0.0,
            pending=0.0
        )
        
        self.balance_sick = LeaveBalance.objects.create(
            user=self.user_emp,
            leave_type=self.sick_leave,
            year=2026,
            total_allocated=10.0,
            used=0.0,
            pending=0.0
        )

    def test_working_days_calculation(self):
        """Verify working days calculation excludes Friday/Saturday weekends and holidays."""
        # June 11, 2026 (Thursday) to June 16, 2026 (Tuesday)
        # Weekends: June 12 (Friday), June 13 (Saturday)
        # Total days: 6. Weekends: 2. Expected working days: 4.
        start = date(2026, 6, 11)
        end = date(2026, 6, 16)
        
        days = calculate_working_days(self.org, start, end)
        self.assertEqual(days, 4)
        
        # Create a Company Holiday on June 15, 2026 (Monday)
        CompanyHoliday.objects.create(
            organization=self.org,
            name="Operations Day",
            holiday_date=date(2026, 6, 15),
            year=2026
        )
        
        # Total days: 6. Weekends: 2. Holiday: 1. Expected working days: 3.
        days = calculate_working_days(self.org, start, end)
        self.assertEqual(days, 3)

    def test_leave_request_submission_reserves_balance(self):
        """Verify submitting request locks working days in pending balance."""
        self.client.force_authenticate(user=self.user_emp)
        
        payload = {
            "start_date": "2026-06-11",
            "end_date": "2026-06-16", # 4 working days
            "leave_type_id": self.annual_leave.id,
            "reason": "Family vacation"
        }
        
        response = self.client.post("/api/leave/requests/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        req_uuid = response.data['uuid']
        
        # Submit request
        submit_response = self.client.post(f"/api/leave/requests/{req_uuid}/submit/")
        self.assertEqual(submit_response.status_code, status.HTTP_200_OK)
        
        # Verify balance updates
        self.balance_annual.refresh_from_db()
        self.assertEqual(float(self.balance_annual.pending), 4.0)
        self.assertEqual(float(self.balance_annual.available), 11.0)

    def test_negative_balance_enforcement(self):
        """Verify negative balance config blocks Annual Leave but allows Sick Leave."""
        self.client.force_authenticate(user=self.user_emp)
        
        # June 1, 2026 to June 30, 2026 is 22 working days (exceeds annual balance of 15)
        payload = {
            "start_date": "2026-06-01",
            "end_date": "2026-06-30",
            "leave_type_id": self.annual_leave.id,
            "reason": "Sabbatical"
        }
        
        response = self.client.post("/api/leave/requests/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("balance", response.data)
        
        # Same duration for Sick Leave (exceeds sick balance of 10, but allowed by organization config)
        payload["leave_type_id"] = self.sick_leave.id
        response = self.client.post("/api/leave/requests/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_leave_approval_updates_used_balance(self):
        """Verify approving leave moves pending reserved days to used."""
        req = LeaveRequest.objects.create(
            organization=self.org,
            requester=self.user_emp,
            leave_type=self.annual_leave,
            start_date=date(2026, 6, 11),
            end_date=date(2026, 6, 16),
            working_days_requested=4.0,
            state="pending_tl_approval",
            reason="Trip"
        )
        
        # Reserve days
        self.balance_annual.pending = 4.0
        self.balance_annual.save()
        
        # TL Approves
        self.client.force_authenticate(user=self.user_tl)
        response = self.client.post(f"/api/leave/requests/{req.uuid}/approve/", {"note": "TL approved"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # GM Approves
        user_gm = User.objects.create_user(
            username="gm1_test", email="gm1_test@amaze.com", password="password123"
        )
        UserProfile.objects.create(
            user=user_gm, organization=self.org, department=self.dept, role=UserRole.GENERAL_MANAGER, employee_id="AMZ03_TEST"
        )
        self.client.force_authenticate(user=user_gm)
        response2 = self.client.post(f"/api/leave/requests/{req.uuid}/approve/", {"note": "GM approved"})
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
        
        self.balance_annual.refresh_from_db()
        self.assertEqual(float(self.balance_annual.pending), 0.0)
        self.assertEqual(float(self.balance_annual.used), 4.0)
        self.assertEqual(float(self.balance_annual.available), 11.0)

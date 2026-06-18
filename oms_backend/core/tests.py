from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from datetime import date, timedelta
from decimal import Decimal

from core.models import Organization, Department, ApprovalDelegation, Notification, AuditLog
from accounts.models import UserProfile, UserRole
from pettycash.models import PettyCashRequest, PettyCashLineItem, Disbursement
from leave.models import LeaveType, LeaveBalance, LeaveRequest

class OMSIntegrationTests(TestCase):
    """
    End-to-End integration tests for OMS Phase 8 deliverables:
    - 8.1: Create petty cash request -> TL approve -> CEO approve -> disburse (verify budget)
    - 8.2: Leave request -> approve -> verify balance deduction -> cancel -> verify balance restore
    - 8.3: Test multi-tenant isolation
    - 8.4: Test delegation flow end-to-end
    - 8.5: Test bulk approval flow
    """
    def setUp(self):
        self.client = APIClient()

        # 1. Setup Organizations
        self.org1, _ = Organization.objects.get_or_create(
            slug="amaze",
            defaults={
                "name": "A Maze Venture",
                "theme_name": "amaze",
                "policy_config": {"allow_negative_sick_leave": True}
            }
        )
        self.org2, _ = Organization.objects.get_or_create(
            slug="mynt",
            defaults={
                "name": "mYnt Connect",
                "theme_name": "mynt",
                "policy_config": {"allow_negative_sick_leave": False}
            }
        )

        # 2. Setup Departments
        self.dept_org1_eng = Department.objects.create(
            organization=self.org1,
            name="Engineering",
            monthly_budget=Decimal("100000.00"),
            tl_approval_limit=Decimal("10000.00")
        )
        self.dept_org2_mkt = Department.objects.create(
            organization=self.org2,
            name="Marketing",
            monthly_budget=Decimal("50000.00"),
            tl_approval_limit=Decimal("5000.00")
        )

        # 3. Setup Users for Org 1
        # Employee
        self.user_emp1 = User.objects.create_user(
            username="amaze_emp1", email="emp1@amaze.com", password="password123"
        )
        self.profile_emp1 = UserProfile.objects.create(
            user=self.user_emp1, organization=self.org1, department=self.dept_org1_eng, role=UserRole.EMPLOYEE, employee_id="AMZ_EMP1"
        )
        
        # Team Lead
        self.user_tl1 = User.objects.create_user(
            username="amaze_tl1", email="tl1@amaze.com", password="password123"
        )
        self.profile_tl1 = UserProfile.objects.create(
            user=self.user_tl1, organization=self.org1, department=self.dept_org1_eng, role=UserRole.TEAM_LEAD, employee_id="AMZ_TL1"
        )

        # CEO
        self.user_ceo1 = User.objects.create_user(
            username="amaze_ceo1", email="ceo1@amaze.com", password="password123"
        )
        self.profile_ceo1 = UserProfile.objects.create(
            user=self.user_ceo1, organization=self.org1, department=self.dept_org1_eng, role=UserRole.CEO, employee_id="AMZ_CEO1"
        )

        # Admin
        self.user_admin1 = User.objects.create_user(
            username="amaze_admin1", email="admin1@amaze.com", password="password123"
        )
        self.profile_admin1 = UserProfile.objects.create(
            user=self.user_admin1, organization=self.org1, department=self.dept_org1_eng, role=UserRole.ADMIN, employee_id="AMZ_ADM1"
        )

        # 4. Setup Users for Org 2
        # Employee
        self.user_org2_emp = User.objects.create_user(
            username="mynt_emp1", email="emp1@mynt.com", password="password123"
        )
        self.profile_org2_emp = UserProfile.objects.create(
            user=self.user_org2_emp, organization=self.org2, department=self.dept_org2_mkt, role=UserRole.EMPLOYEE, employee_id="MYN_EMP1"
        )

        # 5. Setup Leave Type & Balances for Org 1
        self.annual_leave = LeaveType.objects.create(
            organization=self.org1,
            name="Annual Leave",
            code="ANNUAL",
            default_days_per_year=15,
            allow_negative_balance=False
        )
        self.balance_annual = LeaveBalance.objects.create(
            user=self.user_emp1,
            leave_type=self.annual_leave,
            year=2026,
            total_allocated=Decimal("15.0"),
            used=Decimal("0.0"),
            pending=Decimal("0.0"),
            available=Decimal("15.0")
        )

        # 6. Setup HR Department & User for Org 1
        self.dept_org1_hr = Department.objects.create(
            organization=self.org1,
            name="HR & Operations",
            monthly_budget=Decimal("50000.00"),
            tl_approval_limit=Decimal("5000.00")
        )
        self.user_hr1 = User.objects.create_user(
            username="amaze_hr1", email="hr1@amaze.com", password="password123"
        )
        self.profile_hr1 = UserProfile.objects.create(
            user=self.user_hr1, organization=self.org1, department=self.dept_org1_hr, role=UserRole.HR, employee_id="AMZ_HR1"
        )
        
        self.user_gm1 = User.objects.create_user(
            username="amaze_gm1", email="gm1@amaze.com", password="password123"
        )
        self.profile_gm1 = UserProfile.objects.create(
            user=self.user_gm1, organization=self.org1, department=self.dept_org1_eng, role=UserRole.GENERAL_MANAGER, employee_id="AMZ_GM1"
        )

    def test_end_to_end_petty_cash_flow_under_limit(self):
        """8.1: Test petty cash flow where amount requested <= TL limit (TL -> CEO -> HR Disburse)."""
        self.client.force_authenticate(user=self.user_emp1)
        
        # Step 1: Create request
        payload = {
            "title": "A4 Paper Requisition",
            "description": "Office paper bundles",
            "amount_requested": Decimal("4000.00"),
            "priority": "LOW",
            "needed_by": "2026-06-15",
            "department_id": self.dept_org1_eng.id,
            "line_items": [
                {"description": "Paper packs", "quantity": 10, "unit_price": Decimal("400.00"), "category": "Office Supplies"}
            ]
        }
        response = self.client.post("/api/petty-cash/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        uuid = response.data['uuid']
        self.assertEqual(response.data['state'], 'draft')

        # Step 2: Submit request
        submit_res = self.client.post(f"/api/petty-cash/{uuid}/submit/")
        self.assertEqual(submit_res.status_code, status.HTTP_200_OK)
        self.assertEqual(submit_res.data['state'], 'pending_tl_approval')

        # Step 3: TL Approves
        self.client.force_authenticate(user=self.user_tl1)
        approve_res = self.client.post(
            f"/api/petty-cash/{uuid}/approve/", 
            {
                "amount": Decimal("4000.00"), 
                "needed_by": "2026-06-15", 
                "priority": "LOW", 
                "note": "TL approved under limit"
            }, 
            format="json"
        )
        self.assertEqual(approve_res.status_code, status.HTTP_200_OK)
        self.assertEqual(approve_res.data['state'], 'pending_hr_disbursement')

        # Step 4: Disburse partial amount (HR role must do this)
        self.client.force_authenticate(user=self.user_hr1)
        disburse_payload = {
            "amount": Decimal("2500.00"),
            "payment_method": "CASH",
            "reference_number": "TXN-12345",
            "note": "First partial disbursement"
        }
        disburse_res = self.client.post(f"/api/petty-cash/{uuid}/disburse/", disburse_payload, format="json")
        self.assertEqual(disburse_res.status_code, status.HTTP_200_OK)
        self.assertEqual(disburse_res.data['state'], 'partially_disbursed')
        self.assertEqual(Decimal(disburse_res.data['amount_disbursed']), Decimal("2500.00"))

        # Verify department budget spent incremented
        self.dept_org1_eng.refresh_from_db()
        self.assertEqual(self.dept_org1_eng.budget_spent_this_month, Decimal("2500.00"))

        # Step 5: Disburse remaining amount
        disburse_payload2 = {
            "amount": Decimal("1500.00"),
            "payment_method": "BANK_TRANSFER",
            "reference_number": "TXN-12346",
            "note": "Final disbursement"
        }
        disburse_res2 = self.client.post(f"/api/petty-cash/{uuid}/disburse/", disburse_payload2, format="json")
        self.assertEqual(disburse_res2.status_code, status.HTTP_200_OK)
        self.assertEqual(disburse_res2.data['state'], 'disbursed')
        self.assertEqual(Decimal(disburse_res2.data['amount_disbursed']), Decimal("4000.00"))

        # Verify department budget spent updated
        self.dept_org1_eng.refresh_from_db()
        self.assertEqual(self.dept_org1_eng.budget_spent_this_month, Decimal("4000.00"))

    def test_end_to_end_petty_cash_flow_over_limit(self):
        """8.1: Test petty cash flow where amount requested > TL limit (Routes to CEO approval)."""
        self.client.force_authenticate(user=self.user_emp1)
        
        # Step 1: Create request (15000 > 10000 TL limit)
        payload = {
            "title": "Equipment Purchase Requisition",
            "description": "Backup hard drives",
            "amount_requested": Decimal("15000.00"),
            "priority": "HIGH",
            "needed_by": "2026-06-15",
            "department_id": self.dept_org1_eng.id,
            "line_items": [
                {"description": "External SSDs", "quantity": 3, "unit_price": Decimal("5000.00"), "category": "Equipment"}
            ]
        }
        response = self.client.post("/api/petty-cash/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        uuid = response.data['uuid']

        # Step 2: Submit
        submit_res = self.client.post(f"/api/petty-cash/{uuid}/submit/")
        self.assertEqual(submit_res.status_code, status.HTTP_200_OK)
        self.assertEqual(submit_res.data['state'], 'pending_tl_approval')

        # Step 3: TL Approves (Escalates since 15000 > 10000)
        self.client.force_authenticate(user=self.user_tl1)
        approve_res = self.client.post(
            f"/api/petty-cash/{uuid}/approve/", 
            {
                "amount": Decimal("15000.00"), 
                "note": "TL approved", 
                "priority": "HIGH", 
                "needed_by": "2026-06-15"
            }, 
            format="json"
        )
        self.assertEqual(approve_res.status_code, status.HTTP_200_OK)
        self.assertEqual(approve_res.data['state'], 'pending_ceo_approval')
 
        # Step 4: CEO Approves
        self.client.force_authenticate(user=self.user_ceo1)
        ceo_approve_res = self.client.post(
            f"/api/petty-cash/{uuid}/approve/", 
            {
                "amount": Decimal("14000.00"), 
                "note": "CEO approved", 
                "needed_by": "2026-06-15"
            }, 
            format="json"
        )
        self.assertEqual(ceo_approve_res.status_code, status.HTTP_200_OK)
        self.assertEqual(ceo_approve_res.data['state'], 'pending_hr_disbursement')
        self.assertEqual(Decimal(ceo_approve_res.data['amount_approved']), Decimal("14000.00"))
 
        # Step 5: Disburse full amount
        self.client.force_authenticate(user=self.user_hr1)
        disburse_payload = {
            "amount": Decimal("14000.00"),
            "payment_method": "CASH",
            "note": "HR disbursing over limit request"
        }
        disburse_res = self.client.post(f"/api/petty-cash/{uuid}/disburse/", disburse_payload, format="json")
        self.assertEqual(disburse_res.status_code, status.HTTP_200_OK)
        self.assertEqual(disburse_res.data['state'], 'disbursed')
 
        self.dept_org1_eng.refresh_from_db()
        self.assertEqual(self.dept_org1_eng.budget_spent_this_month, Decimal("14000.00"))

    def test_end_to_end_leave_flow(self):
        """8.2: Test leave request creation, balance reserve, approval, used update, cancel, and restore."""
        self.client.force_authenticate(user=self.user_emp1)
        
        # June 11 (Thu) to June 16 (Tue) = 4 working days (excluding Fri & Sat weekends)
        payload = {
            "start_date": "2026-06-11",
            "end_date": "2026-06-16",
            "leave_type_id": self.annual_leave.id,
            "reason": "Family holiday"
        }
        
        # Step 1: Create Leave Request
        response = self.client.post("/api/leave/requests/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        uuid = response.data['uuid']
        self.assertEqual(response.data['state'], 'draft')
        self.assertEqual(float(response.data['working_days_requested']), 4.0)

        # Step 2: Submit
        submit_res = self.client.post(f"/api/leave/requests/{uuid}/submit/")
        self.assertEqual(submit_res.status_code, status.HTTP_200_OK)
        self.assertEqual(submit_res.data['state'], 'pending_tl_approval')

        # Check balance reserved (pending=4.0, available=11.0)
        self.balance_annual.refresh_from_db()
        self.assertEqual(Decimal(self.balance_annual.pending), Decimal("4.0"))
        self.assertEqual(Decimal(self.balance_annual.available), Decimal("11.0"))

        # Step 3: TL Approves
        self.client.force_authenticate(user=self.user_tl1)
        approve_res = self.client.post(f"/api/leave/requests/{uuid}/approve/", {"note": "TL approved"})
        self.assertEqual(approve_res.status_code, status.HTTP_200_OK)
        self.assertEqual(approve_res.data['state'], 'pending_gm_approval')
 
        # Step 3.5: GM Approves
        self.client.force_authenticate(user=self.user_gm1)
        approve_res2 = self.client.post(f"/api/leave/requests/{uuid}/approve/", {"note": "GM approved"})
        self.assertEqual(approve_res2.status_code, status.HTTP_200_OK)
        self.assertEqual(approve_res2.data['state'], 'approved')

        # Check balance updated (pending=0.0, used=4.0, available=11.0)
        self.balance_annual.refresh_from_db()
        self.assertEqual(Decimal(self.balance_annual.pending), Decimal("0.0"))
        self.assertEqual(Decimal(self.balance_annual.used), Decimal("4.0"))
        self.assertEqual(Decimal(self.balance_annual.available), Decimal("11.0"))

        # Step 4: Requester Cancels (restores balance)
        self.client.force_authenticate(user=self.user_emp1)
        cancel_res = self.client.post(f"/api/leave/requests/{uuid}/cancel/")
        self.assertEqual(cancel_res.status_code, status.HTTP_200_OK)
        self.assertEqual(cancel_res.data['state'], 'cancelled')

        # Check balance restored (pending=0.0, used=0.0, available=15.0)
        self.balance_annual.refresh_from_db()
        self.assertEqual(Decimal(self.balance_annual.pending), Decimal("0.0"))
        self.assertEqual(Decimal(self.balance_annual.used), Decimal("0.0"))
        self.assertEqual(Decimal(self.balance_annual.available), Decimal("15.0"))

    def test_multi_tenant_isolation(self):
        """8.3: Verify multi-tenant isolation layers."""
        # 1. Create a petty cash request in Org 1
        self.client.force_authenticate(user=self.user_emp1)
        payload = {
            "title": "Org 1 Equipment",
            "description": "Org 1 items",
            "amount_requested": Decimal("500.00"),
            "priority": "MEDIUM",
            "needed_by": "2026-06-15",
            "department_id": self.dept_org1_eng.id,
            "line_items": [
                {"description": "Item 1", "quantity": 1, "unit_price": Decimal("500.00"), "category": "Equipment"}
            ]
        }
        res = self.client.post("/api/petty-cash/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        uuid = res.data['uuid']

        # 2. Authenticate Org 2 user
        self.client.force_authenticate(user=self.user_org2_emp)

        # Try to retrieve Org 1 request details -> should be 404
        get_res = self.client.get(f"/api/petty-cash/{uuid}/")
        self.assertEqual(get_res.status_code, status.HTTP_404_NOT_FOUND)

        # Try to submit Org 1 request -> should be 404 (or forbidden)
        submit_res = self.client.post(f"/api/petty-cash/{uuid}/submit/")
        self.assertEqual(submit_res.status_code, status.HTTP_404_NOT_FOUND)

        # Check request list -> should not contain Org 1 request
        list_res = self.client.get("/api/petty-cash/")
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        results = [r['uuid'] for r in list_res.data['results']]
        self.assertNotIn(uuid, results)

    def test_delegation_flow_end_to_end(self):
        """8.4: Test Out-of-Office (OOO) Approval Delegation flow."""
        # Create a second employee to be the requester, so the delegate doesn't approve their own request
        user_emp2 = User.objects.create_user(
            username="amaze_emp2", email="emp2@amaze.com", password="password123"
        )
        UserProfile.objects.create(
            user=user_emp2, organization=self.org1, department=self.dept_org1_eng, role=UserRole.EMPLOYEE, employee_id="AMZ_EMP2"
        )

        # Create a request pending CEO approval
        req = PettyCashRequest.objects.create(
            organization=self.org1,
            department=self.dept_org1_eng,
            requester=user_emp2,
            title="CEO level gear",
            amount_requested=Decimal("20000.00"),
            needed_by="2026-06-15",
            state="pending_ceo_approval"
        )

        # Verify Employee cannot approve it
        self.client.force_authenticate(user=self.user_emp1)
        res1 = self.client.post(f"/api/petty-cash/{req.uuid}/approve/", {"amount": Decimal("20000.00")}, format="json")
        self.assertEqual(res1.status_code, status.HTTP_403_FORBIDDEN)

        # CEO creates a delegation to Employee for PETTY_CASH
        self.client.force_authenticate(user=self.user_ceo1)
        delegation_payload = {
            "delegate_id": self.user_emp1.id,
            "scope": "PETTY_CASH",
            "start_date": str(date.today() - timedelta(days=1)),
            "end_date": str(date.today() + timedelta(days=5)),
            "reason": "CEO on annual leave"
        }
        del_res = self.client.post("/api/delegations/", delegation_payload, format="json")
        self.assertEqual(del_res.status_code, status.HTTP_201_CREATED)
        delegation_id = del_res.data['id']

        # Employee tries to approve request (should succeed due to active delegation)
        self.client.force_authenticate(user=self.user_emp1)
        res2 = self.client.post(f"/api/petty-cash/{req.uuid}/approve/", {"amount": Decimal("20000.00"), "note": "CEO delegated approval"}, format="json")
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.data['state'], 'pending_hr_disbursement')

        # Revoke the delegation early
        self.client.force_authenticate(user=self.user_ceo1)
        rev_res = self.client.delete(f"/api/delegations/{delegation_id}/")
        self.assertEqual(rev_res.status_code, status.HTTP_204_NO_CONTENT)

        # Create another request pending CEO approval
        req2 = PettyCashRequest.objects.create(
            organization=self.org1,
            department=self.dept_org1_eng,
            requester=user_emp2,
            title="CEO level gear 2",
            amount_requested=Decimal("20000.00"),
            needed_by="2026-06-15",
            state="pending_ceo_approval"
        )

        # Employee tries to approve (should fail since delegation is revoked)
        self.client.force_authenticate(user=self.user_emp1)
        res3 = self.client.post(f"/api/petty-cash/{req2.uuid}/approve/", {"amount": Decimal("20000.00")}, format="json")
        self.assertEqual(res3.status_code, status.HTTP_403_FORBIDDEN)

    def test_bulk_approval_flow(self):
        """8.5: Test bulk approval of multiple requests."""
        # Create 3 requests in pending_tl_approval state
        req1 = PettyCashRequest.objects.create(
            organization=self.org1, department=self.dept_org1_eng, requester=self.user_emp1,
            title="Bulk Req 1", amount_requested=Decimal("1000.00"), needed_by="2026-06-15", state="pending_tl_approval"
        )
        req2 = PettyCashRequest.objects.create(
            organization=self.org1, department=self.dept_org1_eng, requester=self.user_emp1,
            title="Bulk Req 2", amount_requested=Decimal("2000.00"), needed_by="2026-06-15", state="pending_tl_approval"
        )
        req3 = PettyCashRequest.objects.create(
            organization=self.org1, department=self.dept_org1_eng, requester=self.user_emp1,
            title="Bulk Req 3", amount_requested=Decimal("3000.00"), needed_by="2026-06-15", state="pending_tl_approval"
        )

        # TL executes bulk approval
        self.client.force_authenticate(user=self.user_tl1)
        payload = {
            "request_ids": [req1.id, req2.id, req3.id],
            "action": "approve"
        }
        res = self.client.post("/api/petty-cash/bulk-action/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data['success']), 3)

        # Verify all are approved
        req1.refresh_from_db()
        req2.refresh_from_db()
        req3.refresh_from_db()
        self.assertEqual(req1.state, 'pending_hr_disbursement')
        self.assertEqual(req2.state, 'pending_hr_disbursement')
        self.assertEqual(req3.state, 'pending_hr_disbursement')

    def test_role_modification_permissions_and_restrictions(self):
        """9.2: Test role modification custom endpoint security and rules."""
        # 1. CEO updates an employee's role to TEAM_LEAD (should succeed)
        self.client.force_authenticate(user=self.user_ceo1)
        res1 = self.client.post(
            f"/api/users/{self.user_emp1.id}/change-role/",
            {"role": "TEAM_LEAD"},
            format="json"
        )
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.profile_emp1.refresh_from_db()
        self.assertEqual(self.profile_emp1.role, "TEAM_LEAD")

        # 2. HR member updates an employee's role back to EMPLOYEE (should succeed)
        self.client.force_authenticate(user=self.user_hr1)
        res2 = self.client.post(
            f"/api/users/{self.user_emp1.id}/change-role/",
            {"role": "EMPLOYEE"},
            format="json"
        )
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.profile_emp1.refresh_from_db()
        self.assertEqual(self.profile_emp1.role, "EMPLOYEE")

        # 3. CEO tries to update their own role (should fail)
        self.client.force_authenticate(user=self.user_ceo1)
        res3 = self.client.post(
            f"/api/users/{self.user_ceo1.id}/change-role/",
            {"role": "TEAM_LEAD"},
            format="json"
        )
        self.assertEqual(res3.status_code, status.HTTP_400_BAD_REQUEST)

        # 4. CEO tries to assign Global Admin role (should fail)
        res4 = self.client.post(
            f"/api/users/{self.user_emp1.id}/change-role/",
            {"role": "ADMIN"},
            format="json"
        )
        self.assertEqual(res4.status_code, status.HTTP_403_FORBIDDEN)

        # 5. Regular employee tries to change someone's role (should fail)
        self.client.force_authenticate(user=self.user_emp1)
        res5 = self.client.post(
            f"/api/users/{self.user_hr1.id}/change-role/",
            {"role": "TEAM_LEAD"},
            format="json"
        )
        self.assertEqual(res5.status_code, status.HTTP_403_FORBIDDEN)

        # 6. Cross-tenant check: Org 1 CEO tries to change role of Org 2 employee (should fail with 404)
        self.client.force_authenticate(user=self.user_ceo1)
        res6 = self.client.post(
            f"/api/users/{self.user_org2_emp.id}/change-role/",
            {"role": "TEAM_LEAD"},
            format="json"
        )
        self.assertEqual(res6.status_code, status.HTTP_404_NOT_FOUND)

    def test_user_creation_permissions_and_restrictions(self):
        """11.4: Test user creation authorization, tenancy validation, and role limits."""
        # 1. CEO creates a new employee successfully
        self.client.force_authenticate(user=self.user_ceo1)
        payload1 = {
            "username": "amaze_new_emp",
            "email": "new_emp@amaze.com",
            "first_name": "New",
            "last_name": "Employee",
            "password": "securepassword123",
            "role": "EMPLOYEE",
            "employee_id": "AMZ_NEW_EMP",
            "phone": "01755555555",
            "department": self.dept_org1_eng.id,
            "avatar_url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        }
        res1 = self.client.post("/api/users/", payload1, format="json")
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res1.data['username'], "amaze_new_emp")
        
        # Verify user profile organization is automatically set to CEO's organization
        new_user = User.objects.get(username="amaze_new_emp")
        self.assertEqual(new_user.profile.organization, self.org1)
        self.assertEqual(new_user.profile.department, self.dept_org1_eng)
        self.assertEqual(new_user.profile.role, "EMPLOYEE")
        self.assertEqual(new_user.profile.avatar_url, payload1["avatar_url"])

        # 2. HR member creates a new team lead successfully
        self.client.force_authenticate(user=self.user_hr1)
        payload2 = {
            "username": "amaze_new_tl",
            "email": "new_tl@amaze.com",
            "first_name": "New",
            "last_name": "Lead",
            "password": "securepassword123",
            "role": "TEAM_LEAD",
            "employee_id": "AMZ_NEW_TL",
            "department": self.dept_org1_eng.id
        }
        res2 = self.client.post("/api/users/", payload2, format="json")
        self.assertEqual(res2.status_code, status.HTTP_201_CREATED)
        new_tl = User.objects.get(username="amaze_new_tl")
        self.assertEqual(new_tl.profile.organization, self.org1)
        self.assertEqual(new_tl.profile.role, "TEAM_LEAD")

        # 3. Regular employee is blocked from user creation
        self.client.force_authenticate(user=self.user_emp1)
        res3 = self.client.post("/api/users/", payload2, format="json")
        self.assertEqual(res3.status_code, status.HTTP_403_FORBIDDEN)

        # 4. CEO tries to create a user with ADMIN role (should fail)
        self.client.force_authenticate(user=self.user_ceo1)
        payload4 = {
            "username": "amaze_fake_admin",
            "email": "fake_admin@amaze.com",
            "password": "securepassword123",
            "role": "ADMIN",
            "employee_id": "AMZ_FAKE_ADM",
            "department": self.dept_org1_eng.id
        }
        res4 = self.client.post("/api/users/", payload4, format="json")
        self.assertEqual(res4.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("role", res4.data)

        # 5. Cross-tenant check: CEO tries to assign a department belonging to another organization (should fail)
        payload5 = {
            "username": "amaze_bad_dept",
            "email": "bad_dept@amaze.com",
            "password": "securepassword123",
            "role": "EMPLOYEE",
            "employee_id": "AMZ_BAD_DEPT",
            "department": self.dept_org2_mkt.id # Org 2 department!
        }
        res5 = self.client.post("/api/users/", payload5, format="json")
        self.assertEqual(res5.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("department", res5.data)

    def test_ceo_blocked_from_applying_for_leave_or_requisition(self):
        """
        Verify that a CEO is blocked from creating both petty cash and leave requests.
        """
        self.client.force_authenticate(user=self.user_ceo1)
        
        # 1. Petty Cash request creation should be forbidden (403)
        pcr_payload = {
            "title": "CEO Requisition",
            "description": "Important items",
            "amount_requested": "25000.00",
            "needed_by": "2026-06-30",
            "priority": "HIGH",
            "department_id": self.dept_org1_eng.id,
            "line_items": [
                {
                    "description": "Executive meeting supplies",
                    "quantity": 1,
                    "unit_price": "25000.00",
                    "category": "Office Supplies"
                }
            ]
        }
        res_pcr = self.client.post("/api/petty-cash/", pcr_payload, format="json")
        self.assertEqual(res_pcr.status_code, status.HTTP_403_FORBIDDEN)
        
        # 2. Leave request creation should be forbidden (403)
        leave_payload = {
            "start_date": "2026-06-11",
            "end_date": "2026-06-16",
            "leave_type_id": self.annual_leave.id,
            "reason": "CEO retreat"
        }
        res_leave = self.client.post("/api/leave/requests/", leave_payload, format="json")
        self.assertEqual(res_leave.status_code, status.HTTP_403_FORBIDDEN)


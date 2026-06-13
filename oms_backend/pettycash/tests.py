from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from core.models import Organization, Department
from accounts.models import UserProfile, UserRole
from pettycash.models import PettyCashRequest, PettyCashLineItem

class PettyCashAPITests(TestCase):
    """
    Tests the Petty Cash Requisition module workflows,
    tenant-isolation security layers, and budget enforcement rules.
    """
    def setUp(self):
        self.client = APIClient()
        
        # Setup Organizations
        self.org1 = Organization.objects.create(
            name="Org One", 
            slug="org1", 
            theme_name="amaze",
            policy_config={"allow_negative_sick_leave": True}
        )
        self.org2 = Organization.objects.create(
            name="Org Two", 
            slug="org2", 
            theme_name="mynt",
            policy_config={"allow_negative_sick_leave": False}
        )
        
        # Setup Departments
        self.dept1 = Department.objects.create(
            organization=self.org1,
            name="Engineering",
            monthly_budget=50000.00,
            tl_approval_limit=10000.00
        )
        self.dept2 = Department.objects.create(
            organization=self.org2,
            name="Marketing",
            monthly_budget=20000.00,
            tl_approval_limit=5000.00
        )
        
        # Setup Users for Org 1
        self.user_employee = User.objects.create_user(
            username="employee1", email="emp1@test.com", password="password123", first_name="Emp", last_name="One"
        )
        self.profile_emp = UserProfile.objects.create(
            user=self.user_employee, organization=self.org1, department=self.dept1, role=UserRole.EMPLOYEE, employee_id="EMP01"
        )
        
        self.user_tl = User.objects.create_user(
            username="lead1", email="lead1@test.com", password="password123", first_name="Lead", last_name="One"
        )
        self.profile_tl = UserProfile.objects.create(
            user=self.user_tl, organization=self.org1, department=self.dept1, role=UserRole.TEAM_LEAD, employee_id="TL01"
        )

        self.user_ceo = User.objects.create_user(
            username="ceo1", email="ceo1@test.com", password="password123", first_name="Ceo", last_name="One"
        )
        self.profile_ceo = UserProfile.objects.create(
            user=self.user_ceo, organization=self.org1, department=self.dept1, role=UserRole.CEO, employee_id="CEO01"
        )

        # Setup User for Org 2 (Tenant Scoping Test)
        self.user_external = User.objects.create_user(
            username="ext1", email="ext1@test.com", password="password123", first_name="Ext", last_name="One"
        )
        self.profile_ext = UserProfile.objects.create(
            user=self.user_external, organization=self.org2, department=self.dept2, role=UserRole.EMPLOYEE, employee_id="EXT01"
        )

    def test_create_petty_cash_request(self):
        """Verify that an employee can create a petty cash request with line items."""
        self.client.force_authenticate(user=self.user_employee)
        payload = {
            "title": "Office Supplies Requisition",
            "description": "Printer papers and cartridges",
            "amount_requested": 4500.00,
            "priority": "LOW",
            "needed_by": "2026-06-15",
            "department_id": self.dept1.id,
            "line_items": [
                {"description": "A4 Paper", "quantity": 10, "unit_price": 150.00, "category": "Office Supplies"},
                {"description": "Ink Cartridge", "quantity": 2, "unit_price": 1500.00, "category": "Office Supplies"}
            ]
        }
        response = self.client.post("/api/petty-cash/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(PettyCashRequest.objects.count(), 1)
        self.assertEqual(PettyCashLineItem.objects.count(), 2)
        
        req = PettyCashRequest.objects.first()
        self.assertEqual(req.state, 'draft')
        self.assertEqual(req.organization, self.org1)

    def test_tenant_isolation(self):
        """Verify that a user from Org 2 cannot retrieve or see Org 1 requests."""
        # Create request in Org 1
        req = PettyCashRequest.objects.create(
            organization=self.org1,
            department=self.dept1,
            requester=self.user_employee,
            title="Internal request",
            description="internal",
            amount_requested=100.00,
            needed_by="2026-06-15"
        )
        
        # Authenticate Org 2 user
        self.client.force_authenticate(user=self.user_external)
        
        # Retrieve list
        response = self.client.get("/api/petty-cash/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 0)
        
        # Retrieve direct details via UUID
        response = self.client.get(f"/api/petty-cash/{req.uuid}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_budget_enforcement_on_submit(self):
        """Verify that submitting a request exceeding department budget throws validation error."""
        # Exceeds the department budget of 50000.00
        req = PettyCashRequest.objects.create(
            organization=self.org1,
            department=self.dept1,
            requester=self.user_employee,
            title="Expensive gear",
            description="over budget",
            amount_requested=60000.00,
            needed_by="2026-06-15"
        )
        
        self.client.force_authenticate(user=self.user_employee)
        response = self.client.post(f"/api/petty-cash/{req.uuid}/submit/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        
        req.refresh_from_db()
        self.assertEqual(req.state, 'draft')

    def test_approval_routing_escalation(self):
        """Verify request routes to pending_ceo_approval if above TL limit."""
        # Limit is 10000.00. Request is 15000.00.
        req = PettyCashRequest.objects.create(
            organization=self.org1,
            department=self.dept1,
            requester=self.user_employee,
            title="Laptops repair",
            description="high amount",
            amount_requested=15000.00,
            needed_by="2026-06-15",
            state='pending_tl_approval'
        )
        
        self.client.force_authenticate(user=self.user_tl)
        response = self.client.post(f"/api/petty-cash/{req.uuid}/approve/", {"amount": 15000.00, "note": "TL approved"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        req.refresh_from_db()
        # Should escalate to CEO approval
        self.assertEqual(req.state, 'pending_ceo_approval')

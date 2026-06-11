import os
import django
import sys
from decimal import Decimal

# Initialize Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'oms_project.settings.development')
django.setup()

from django.contrib.auth.models import User
from rest_framework.test import APIClient
from core.models import Organization, Department, ApprovalDelegation
from accounts.models import UserProfile, UserRole
from pettycash.models import PettyCashRequest

client = APIClient()

# Get or create organizations and departments
org1, _ = Organization.objects.get_or_create(slug="amaze", defaults={"name": "A Maze Venture", "theme_name": "amaze"})
dept1, _ = Department.objects.get_or_create(organization=org1, name="Engineering", defaults={"monthly_budget": Decimal("100000.00"), "tl_approval_limit": Decimal("10000.00")})

# Get or create users
emp, _ = User.objects.get_or_create(username="amaze_emp1", defaults={"email": "emp1@amaze.com"})
if not hasattr(emp, 'profile'):
    UserProfile.objects.create(user=emp, organization=org1, department=dept1, role=UserRole.EMPLOYEE, employee_id="AMZ_EMP1")

tl, _ = User.objects.get_or_create(username="amaze_tl1", defaults={"email": "tl1@amaze.com"})
if not hasattr(tl, 'profile'):
    UserProfile.objects.create(user=tl, organization=org1, department=dept1, role=UserRole.TEAM_LEAD, employee_id="AMZ_TL1")

ceo, _ = User.objects.get_or_create(username="amaze_ceo1", defaults={"email": "ceo1@amaze.com"})
if not hasattr(ceo, 'profile'):
    UserProfile.objects.create(user=ceo, organization=org1, department=dept1, role=UserRole.CEO, employee_id="AMZ_CEO1")

print("--- Testing Petty Cash Requisition Creation ---")
client.force_authenticate(user=emp)
payload = {
    "title": "A4 Paper Requisition",
    "description": "Office paper bundles",
    "amount_requested": 4000.00,
    "priority": "LOW",
    "needed_by": "2026-06-15",
    "line_items": [
        {"description": "A4 Paper Pack", "quantity": 10, "unit_price": 400.00, "category": "Office Supplies"}
    ]
}
response = client.post("/api/petty-cash/", payload, format="json")
print("Response status:", response.status_code)
print("Response data:", response.data)

print("\n--- Testing Delegation Creation ---")
client.force_authenticate(user=ceo)
delegation_payload = {
    "delegate_id": emp.id,
    "scope": "PETTY_CASH",
    "start_date": "2026-06-09",
    "end_date": "2026-06-15",
    "reason": "CEO on annual leave"
}
del_res = client.post("/api/delegations/", delegation_payload, format="json")
print("Delegation response status:", del_res.status_code)
print("Delegation response data:", del_res.data)

print("\n--- Testing Bulk Action ---")
# Create request to bulk approve
req = PettyCashRequest.objects.create(
    organization=org1, department=dept1, requester=emp,
    title="Bulk Req 1", amount_requested=Decimal("1000.00"), needed_by="2026-06-15", state="pending_tl_approval"
)
client.force_authenticate(user=tl)
bulk_payload = {
    "request_ids": [req.id],
    "action": "approve"
}
bulk_res = client.post("/api/petty-cash/bulk-action/", bulk_payload, format="json")
print("Bulk action status:", bulk_res.status_code)
print("Bulk action data:", bulk_res.data)

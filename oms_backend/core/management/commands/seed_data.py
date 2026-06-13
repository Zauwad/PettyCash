import random
from datetime import date, timedelta
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.db import transaction

from core.models import Organization, Department
from accounts.models import UserProfile, UserRole
from leave.models import LeaveType, LeaveBalance, LeaveRequest, CompanyHoliday
from pettycash.models import PettyCashRequest, PettyCashLineItem

class Command(BaseCommand):
    help = 'Seeds the database with organizations, departments, users, leave types, balances, and sample request workflows.'

    def handle(self, *args, **kwargs):
        self.stdout.write("Starting database seeding...")

        try:
            with transaction.atomic():
                self.clean_old_seed_data()
                self.seed_all()
            self.stdout.write(self.style.SUCCESS("Database seeded successfully!"))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Seeding failed: {e}"))
            raise e

    def clean_old_seed_data(self):
        """Cleans up previously generated seed data to remain idempotent."""
        self.stdout.write("Cleaning up old seed data...")
        # Delete only seed users (prefix matching)
        seed_usernames = []
        for org_slug in ["amaze", "mynt", "braincount"]:
            seed_usernames.append(f"{org_slug}_ceo")
            seed_usernames.append(f"{org_slug}_admin")
            seed_usernames.append(f"{org_slug}_gm")
            seed_usernames.append(f"{org_slug}_hr")
            for dept_slug in ["eng", "mkt", "hr", "fin"]:
                seed_usernames.append(f"{org_slug}_{dept_slug}_lead")
                seed_usernames.append(f"{org_slug}_{dept_slug}_emp1")
                seed_usernames.append(f"{org_slug}_{dept_slug}_emp2")
                
        User.objects.filter(username__in=seed_usernames).delete()
        # Non-user models will cascade delete, but let's delete other items to be safe
        CompanyHoliday.objects.all().delete()
        # Departments are recreated, let's delete them
        Department.objects.all().delete()

    def seed_all(self):
        orgs = Organization.objects.filter(slug__in=["amaze", "mynt", "braincount"])
        
        dept_configs = [
            {"name": "Engineering", "code": "eng", "budget": 600000.00, "limit": 25000.00},
            {"name": "Marketing", "code": "mkt", "budget": 200000.00, "limit": 10000.00},
            {"name": "HR & Operations", "code": "hr", "budget": 150000.00, "limit": 8000.00},
            {"name": "Finance", "code": "fin", "budget": 300000.00, "limit": 15000.00},
        ]

        leave_configs = [
            {"name": "Annual Leave", "code": "ANNUAL", "days": 15, "neg": False},
            {"name": "Sick Leave", "code": "SICK", "days": 10, "neg": True},
            {"name": "Maternity Leave", "code": "MATERNITY", "days": 120, "neg": False},
            {"name": "Paternity Leave", "code": "PATERNITY", "days": 10, "neg": False},
            {"name": "Unpaid Leave", "code": "UNPAID", "days": 0, "neg": True},
        ]

        for org in orgs:
            self.stdout.write(f"Seeding organization: {org.name}...")
            
            # 1. Seed Company Holidays for 2026
            self.seed_holidays(org)

            # 2. Seed Leave Types
            leave_types = {}
            for lc in leave_configs:
                lt, _ = LeaveType.objects.update_or_create(
                    organization=org,
                    code=lc["code"],
                    defaults={
                        "name": lc["name"],
                        "default_days_per_year": lc["days"],
                        "allow_negative_balance": lc["neg"],
                        "is_active": True
                    }
                )
                leave_types[lc["code"]] = lt

            # 3. Create CEO, Admin, General Manager, and HR
            ceo_user = User.objects.create_user(
                username=f"{org.slug}_ceo",
                email=f"ceo@{org.slug}.com",
                password="password123",
                first_name="Executive",
                last_name="CEO"
            )
            UserProfile.objects.create(
                user=ceo_user,
                organization=org,
                role=UserRole.CEO,
                employee_id=f"{org.slug.upper()}01",
                phone="01711111111"
            )
 
            admin_user = User.objects.create_user(
                username=f"{org.slug}_admin",
                email=f"admin@{org.slug}.com",
                password="password123",
                first_name="System",
                last_name="Admin"
            )
            UserProfile.objects.create(
                user=admin_user,
                organization=org,
                role=UserRole.ADMIN,
                employee_id=f"{org.slug.upper()}02",
                phone="01722222222"
            )
 
            gm_user = User.objects.create_user(
                username=f"{org.slug}_gm",
                email=f"gm@{org.slug}.com",
                password="password123",
                first_name="General",
                last_name="Manager"
            )
            UserProfile.objects.create(
                user=gm_user,
                organization=org,
                role=UserRole.GENERAL_MANAGER,
                employee_id=f"{org.slug.upper()}03",
                phone="01755555555"
            )
            self.initialize_balances(gm_user, leave_types)
 
            hr_user = User.objects.create_user(
                username=f"{org.slug}_hr",
                email=f"hr@{org.slug}.com",
                password="password123",
                first_name="Human",
                last_name="Resources"
            )
            UserProfile.objects.create(
                user=hr_user,
                organization=org,
                role=UserRole.HR,
                employee_id=f"{org.slug.upper()}04",
                phone="01766666666"
            )
            self.initialize_balances(hr_user, leave_types)

            # 4. Seed Departments, TLs, and Employees
            for dc in dept_configs:
                dept = Department.objects.create(
                    organization=org,
                    name=dc["name"],
                    monthly_budget=dc["budget"],
                    tl_approval_limit=dc["limit"]
                )

                # Team Lead
                tl_user = User.objects.create_user(
                    username=f"{org.slug}_{dc['code']}_lead",
                    email=f"{dc['code']}_lead@{org.slug}.com",
                    password="password123",
                    first_name=f"{dc['name']}",
                    last_name="Lead"
                )
                UserProfile.objects.create(
                    user=tl_user,
                    organization=org,
                    department=dept,
                    role=UserRole.TEAM_LEAD,
                    employee_id=f"{org.slug.upper()}_{dc['code'].upper()}01",
                    phone="01733333333"
                )
                self.initialize_balances(tl_user, leave_types)

                # Employees
                for emp_num in [1, 2]:
                    emp_user = User.objects.create_user(
                        username=f"{org.slug}_{dc['code']}_emp{emp_num}",
                        email=f"{dc['code']}_emp{emp_num}@{org.slug}.com",
                        password="password123",
                        first_name=f"{dc['name']} Staff",
                        last_name=f"Number {emp_num}"
                    )
                    UserProfile.objects.create(
                        user=emp_user,
                        organization=org,
                        department=dept,
                        role=UserRole.EMPLOYEE,
                        employee_id=f"{org.slug.upper()}_{dc['code'].upper()}0{emp_num + 1}",
                        phone=f"0174444444{emp_num}"
                    )
                    self.initialize_balances(emp_user, leave_types)

                    # 5. Seed sample Petty Cash and Leave Requests
                    self.seed_sample_requests(org, dept, emp_user, tl_user, ceo_user)

    def seed_holidays(self, org):
        """Seeds common Bangladesh holidays for 2026."""
        holidays_data = [
            {"name": "New Year's Day", "date": date(2026, 1, 1)},
            {"name": "Shaheed Day (Language Day)", "date": date(2026, 2, 21)},
            {"name": "Independence Day", "date": date(2026, 3, 26)},
            {"name": "Bengali New Year (Pohela Boishakh)", "date": date(2026, 4, 14)},
            {"name": "May Day", "date": date(2026, 5, 1)},
            {"name": "Victory Day", "date": date(2026, 12, 16)},
            {"name": "Christmas Day", "date": date(2026, 12, 25)},
        ]
        for hd in holidays_data:
            CompanyHoliday.objects.create(
                organization=org,
                name=hd["name"],
                holiday_date=hd["date"],
                year=2026
            )

    def initialize_balances(self, user, leave_types):
        """Creates annual allocations for the user."""
        for code, lt in leave_types.items():
            LeaveBalance.objects.create(
                user=user,
                leave_type=lt,
                year=2026,
                total_allocated=float(lt.default_days_per_year),
                used=0.0,
                pending=0.0
            )

    def seed_sample_requests(self, org, dept, employee, team_lead, ceo):
        """Generates sample workflows across states."""
        # 1. Petty Cash Request - Draft
        pc_draft = PettyCashRequest.objects.create(
            organization=org,
            department=dept,
            requester=employee,
            title="Office stationary restock",
            description="Restocking whiteboard markers, notebooks, and pens for the team.",
            amount_requested=2500.00,
            state="draft",
            priority="LOW",
            needed_by=date.today() + timedelta(days=5)
        )
        PettyCashLineItem.objects.create(
            request=pc_draft,
            description="Whiteboard markers & pens",
            quantity=10,
            unit_price=150.00,
            category="Office Supplies"
        )
        PettyCashLineItem.objects.create(
            request=pc_draft,
            description="Notebooks",
            quantity=5,
            unit_price=200.00,
            category="Office Supplies"
        )

        # 2. Petty Cash Request - Pending TL Approval (requires TL to act)
        pc_pending_tl = PettyCashRequest.objects.create(
            organization=org,
            department=dept,
            requester=employee,
            title="Team dinner reimbursement",
            description="Project kickoff dinner for team members.",
            amount_requested=8000.00,
            state="pending_tl_approval",
            priority="MEDIUM",
            needed_by=date.today() + timedelta(days=2)
        )
        PettyCashLineItem.objects.create(
            request=pc_pending_tl,
            description="Buffet dinner reimbursement",
            quantity=1,
            unit_price=8000.00,
            category="Travel & Entertainment"
        )

        # 3. Petty Cash Request - Pending HR Disbursement
        pc_approved = PettyCashRequest.objects.create(
            organization=org,
            department=dept,
            requester=employee,
            title="Internet router replacement",
            description="Old router died, buying a dual-band router immediately.",
            amount_requested=6500.00,
            amount_approved=6500.00,
            state="pending_hr_disbursement",
            priority="HIGH",
            needed_by=date.today()
        )
        PettyCashLineItem.objects.create(
            request=pc_approved,
            description="TP-Link Archer router",
            quantity=1,
            unit_price=6500.00,
            category="Equipment"
        )

        # 4. Leave Request - Draft
        lt_annual = LeaveType.objects.get(organization=org, code="ANNUAL")
        LeaveRequest.objects.create(
            organization=org,
            requester=employee,
            leave_type=lt_annual,
            start_date=date(2026, 8, 10),
            end_date=date(2026, 8, 14),
            working_days_requested=3.0, # Excludes Friday/Saturday weekend
            reason="Visiting family during summer break.",
            state="draft"
        )

        # 5. Leave Request - Pending TL Approval
        LeaveRequest.objects.create(
            organization=org,
            requester=employee,
            leave_type=lt_annual,
            start_date=date(2026, 7, 13),
            end_date=date(2026, 7, 16),
            working_days_requested=4.0,
            reason="Medical checkup and recovery.",
            state="pending_tl_approval",
            delegate_to=team_lead
        )

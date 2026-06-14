import random
from datetime import date, timedelta, datetime
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone

from core.models import Organization, Department, AuditLog, Notification
from accounts.models import UserProfile, UserRole
from leave.models import LeaveType, LeaveBalance, LeaveRequest, CompanyHoliday
from pettycash.models import PettyCashRequest, PettyCashLineItem, Disbursement

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
        seed_usernames = []
        for org_slug in ["amaze", "mynt", "braincount"]:
            seed_usernames.append(f"{org_slug}_ceo")
            seed_usernames.append(f"{org_slug}_admin")
            seed_usernames.append(f"{org_slug}_gm")
            seed_usernames.append(f"{org_slug}_hr")
            seed_usernames.append(f"{org_slug}_lead")
            for dept_slug in ["eng", "mkt", "hr", "fin", "des"]:
                seed_usernames.append(f"{org_slug}_{dept_slug}_lead")
                seed_usernames.append(f"{org_slug}_{dept_slug}_emp1")
                seed_usernames.append(f"{org_slug}_{dept_slug}_emp2")
                
        User.objects.filter(username__in=seed_usernames).delete()
        CompanyHoliday.objects.all().delete()
        Department.objects.all().delete()
        AuditLog.objects.all().delete()

    def seed_all(self):
        orgs = Organization.objects.filter(slug__in=["amaze", "mynt", "braincount"])
        
        # High and varied budget spent configuration
        dept_configs = [
            {"name": "Engineering", "code": "eng", "budget": 600000.00, "spent": 450000.00, "limit": 25000.00},
            {"name": "Marketing", "code": "mkt", "budget": 200000.00, "spent": 170000.00, "limit": 10000.00},
            {"name": "HR & Operations", "code": "hr", "budget": 150000.00, "spent": 165000.00, "limit": 8000.00}, # 110% Over-utilized!
            {"name": "Designing", "code": "des", "budget": 300000.00, "spent": 30000.00, "limit": 15000.00},
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
                first_name="CEO",
                last_name=""
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
                first_name="Admin",
                last_name=""
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
                first_name="Manager",
                last_name=""
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
                first_name="HR",
                last_name=""
            )
            UserProfile.objects.create(
                user=hr_user,
                organization=org,
                role=UserRole.HR,
                employee_id=f"{org.slug.upper()}04",
                phone="01766666666"
            )
            self.initialize_balances(hr_user, leave_types)

            # 4. Create the single Team Lead for the company
            tl_user = User.objects.create_user(
                username=f"{org.slug}_lead",
                email=f"lead@{org.slug}.com",
                password="password123",
                first_name="Team Lead",
                last_name=""
            )
            UserProfile.objects.create(
                user=tl_user,
                organization=org,
                role=UserRole.TEAM_LEAD,
                employee_id=f"{org.slug.upper()}_TL01",
                phone="01733333333"
            )
            self.initialize_balances(tl_user, leave_types)

            # 5. Seed Departments and Employees
            for dc in dept_configs:
                dept = Department.objects.create(
                    organization=org,
                    name=dc["name"],
                    monthly_budget=dc["budget"],
                    budget_spent_this_month=dc["spent"],
                    tl_approval_limit=dc["limit"]
                )

                # Employees
                for emp_num in [1, 2]:
                    if dc['code'] == 'des':
                        first_name = "Jane" if emp_num == 1 else "John"
                        last_name = "UI/UX Designer" if emp_num == 1 else "Visual Designer"
                    elif dc['code'] == 'eng':
                        first_name = "Engineer"
                        last_name = f"Number {emp_num}"
                    elif dc['code'] == 'mkt':
                        first_name = "Marketer"
                        last_name = f"Number {emp_num}"
                    elif dc['code'] == 'hr':
                        first_name = "HR Specialist"
                        last_name = f"Number {emp_num}"
                    else:
                        first_name = f"{dc['name']}"
                        last_name = f"Number {emp_num}"

                    emp_user = User.objects.create_user(
                        username=f"{org.slug}_{dc['code']}_emp{emp_num}",
                        email=f"{dc['code']}_emp{emp_num}@{org.slug}.com",
                        password="password123",
                        first_name=first_name,
                        last_name=last_name
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

                    # 6. Seed sample Petty Cash and Leave Requests
                    self.seed_sample_requests(org, dept, emp_user, tl_user, ceo_user)
            
            # 7. Seed Historic Disbursements (spending trends data over 12 months)
            self.seed_historic_disbursements(org, ceo_user)

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

    def seed_historic_disbursements(self, org, ceo):
        """Seeds historic disbursements for spending trends chart."""
        self.stdout.write(f"Seeding historic disbursements for {org.name}...")
        today = date.today()
        dept = org.departments.first()
        if not dept:
            return

        emp_profile = UserProfile.objects.filter(organization=org, role=UserRole.EMPLOYEE).first()
        if not emp_profile:
            return
        emp = emp_profile.user
        
        # Create disbursements for each of the last 11 months
        for i in range(1, 12):
            disburse_date = today - timedelta(days=30 * i)
            
            # Create 1-3 requests in that month
            for j in range(random.randint(1, 3)):
                amount = random.randint(3000, 18000)
                req = PettyCashRequest.objects.create(
                    organization=org,
                    department=dept,
                    requester=emp,
                    title=f"Historic disbursement month {i} item {j}",
                    description="Historic seed request for trend line data.",
                    amount_requested=amount,
                    amount_approved=amount,
                    amount_disbursed=amount,
                    state="disbursed",
                    priority=random.choice(["LOW", "MEDIUM", "HIGH"]),
                    needed_by=disburse_date,
                )
                # Override created_at to the historic month
                PettyCashRequest.objects.filter(id=req.id).update(
                    created_at=timezone.make_aware(datetime.combine(disburse_date - timedelta(days=3), datetime.min.time()))
                )
                
                # Make a disbursement record
                disbursed_at = timezone.make_aware(datetime.combine(disburse_date, datetime.min.time()))
                Disbursement.objects.create(
                    request=req,
                    disbursed_by=ceo,
                    amount=amount,
                    payment_method="CASH",
                    reference_number=f"REF-{req.id}-{random.randint(100, 999)}",
                    notes="Seeded historic payout.",
                )
                # Override auto_now_add field disbursed_at
                Disbursement.objects.filter(request=req).update(disbursed_at=disbursed_at)

    def seed_sample_requests(self, org, dept, employee, team_lead, ceo):
        """Generates sample workflows across states."""
        # Use employee name / dept name to vary titles
        emp_name = employee.first_name + " " + employee.last_name
        dept_code = dept.name.split(" ")[0]
        
        # Get HR user for assigning HR disbursement fields
        hr_profile = UserProfile.objects.filter(organization=org, role=UserRole.HR).first()
        hr_user = hr_profile.user if hr_profile else ceo
        
        # Get GM user
        gm_profile = UserProfile.objects.filter(organization=org, role=UserRole.GENERAL_MANAGER).first()
        gm_user = gm_profile.user if gm_profile else ceo

        # 1. Petty Cash Request - Draft
        PettyCashRequest.objects.create(
            organization=org,
            department=dept,
            requester=employee,
            title=f"Draft - {dept_code} office supplies",
            description="Whiteboard markers, sticky notes, and drawing pens.",
            amount_requested=1200.00,
            state="draft",
            priority="LOW",
            needed_by=date.today() + timedelta(days=10)
        )

        # 2. Petty Cash Request - Pending TL Approval
        pc_tl = PettyCashRequest.objects.create(
            organization=org,
            department=dept,
            requester=employee,
            title=f"Pending TL - Team lunch reimbursement",
            description="Dinner for project release celebration.",
            amount_requested=7500.00,
            state="pending_tl_approval",
            priority="MEDIUM",
            needed_by=date.today() + timedelta(days=3)
        )
        PettyCashLineItem.objects.create(
            request=pc_tl,
            description="Team buffet dinner",
            quantity=1,
            unit_price=7500.00,
            category="Travel & Entertainment"
        )

        # 3. Petty Cash Request - Pending CEO Approval
        pc_ceo = PettyCashRequest.objects.create(
            organization=org,
            department=dept,
            requester=employee,
            title=f"Pending CEO - Hardware Router upgrade",
            description="Upgrading core router for high-speed connectivity.",
            amount_requested=35000.00, # Exceeds TL limit
            amount_approved=35000.00,
            state="pending_ceo_approval",
            priority="HIGH",
            needed_by=date.today() + timedelta(days=1),
            tl_approved_amount=35000.00,
            tl_approval_note="TL approved router replacement. Exceeds limit.",
        )
        PettyCashLineItem.objects.create(
            request=pc_ceo,
            description="CISCO dual-band router",
            quantity=1,
            unit_price=35000.00,
            category="Equipment"
        )

        # 4. Petty Cash Request - Pending HR Disbursement
        pc_hr = PettyCashRequest.objects.create(
            organization=org,
            department=dept,
            requester=employee,
            title=f"Pending Payout - Client meeting drinks",
            description="Beverages for critical stakeholders.",
            amount_requested=3500.00,
            amount_approved=3500.00,
            state="pending_hr_disbursement",
            priority="MEDIUM",
            needed_by=date.today(),
            tl_approved_amount=3500.00,
            tl_approval_note="Approved.",
            ceo_approved_amount=3500.00,
            ceo_approval_note="Approved.",
        )
        PettyCashLineItem.objects.create(
            request=pc_hr,
            description="Juices and sodas for meeting",
            quantity=1,
            unit_price=3500.00,
            category="Office Supplies"
        )

        # 5. Petty Cash Request - Partially Disbursed
        pc_partial = PettyCashRequest.objects.create(
            organization=org,
            department=dept,
            requester=employee,
            title=f"Partial Payout - Software subscription",
            description="Annual tools subscription.",
            amount_requested=15000.00,
            amount_approved=15000.00,
            amount_disbursed=5000.00,
            state="partially_disbursed",
            priority="HIGH",
            needed_by=date.today(),
            tl_approved_amount=15000.00,
            tl_approval_note="Approved.",
            ceo_approved_amount=15000.00,
            ceo_approval_note="Approved.",
        )
        PettyCashLineItem.objects.create(
            request=pc_partial,
            description="Dev Tools Suite License",
            quantity=1,
            unit_price=15000.00,
            category="Equipment"
        )
        # Add disbursement log for partial payment
        Disbursement.objects.create(
            request=pc_partial,
            disbursed_by=hr_user,
            amount=5000.00,
            payment_method="CASH",
            reference_number=f"PART-{pc_partial.id}",
            notes="First installment."
        )

        # 6. Petty Cash Request - Rejected by TL
        PettyCashRequest.objects.create(
            organization=org,
            department=dept,
            requester=employee,
            title=f"Rejected TL - Unplanned event budget",
            description="Snacks for team retreat.",
            amount_requested=9000.00,
            state="rejected",
            priority="MEDIUM",
            needed_by=date.today(),
            rejection_reason="Snacks are not covered under department budget this week."
        )

        # 7. Petty Cash Request - Rejected by CEO
        PettyCashRequest.objects.create(
            organization=org,
            department=dept,
            requester=employee,
            title=f"Rejected CEO - Premium furniture purchase",
            description="Ergonomic leather chair.",
            amount_requested=18000.00,
            state="rejected_by_ceo",
            priority="LOW",
            needed_by=date.today(),
            tl_approved_amount=18000.00,
            tl_approval_note="TL approved.",
            rejection_reason="Ergonomic leather chairs are out of scope."
        )

        # 8. Petty Cash Request - Cancelled
        PettyCashRequest.objects.create(
            organization=org,
            department=dept,
            requester=employee,
            title=f"Cancelled - Travel booking placeholder",
            description="Requisition cancelled by requester.",
            amount_requested=4500.00,
            state="cancelled",
            priority="LOW",
            needed_by=date.today()
        )

        # --- Leave Requests ---
        lt_annual = LeaveType.objects.get(organization=org, code="ANNUAL")
        lt_sick = LeaveType.objects.get(organization=org, code="SICK")
        
        # 1. Leave - Draft
        LeaveRequest.objects.create(
            organization=org,
            requester=employee,
            leave_type=lt_annual,
            start_date=date.today() + timedelta(days=30),
            end_date=date.today() + timedelta(days=35),
            working_days_requested=5.0,
            reason="Planned vacation next month.",
            state="draft"
        )
        
        # 2. Leave - Pending TL approval
        LeaveRequest.objects.create(
            organization=org,
            requester=employee,
            leave_type=lt_sick,
            start_date=date.today() + timedelta(days=5),
            end_date=date.today() + timedelta(days=6),
            working_days_requested=2.0,
            reason="Medical checkup.",
            state="pending_tl_approval"
        )

        # 3. Leave - Pending GM approval
        LeaveRequest.objects.create(
            organization=org,
            requester=employee,
            leave_type=lt_annual,
            start_date=date.today() + timedelta(days=15),
            end_date=date.today() + timedelta(days=19),
            working_days_requested=4.0,
            reason="Family gathering.",
            state="pending_gm_approval",
            tl_approved_start_date=date.today() + timedelta(days=15),
            tl_approved_end_date=date.today() + timedelta(days=19),
            tl_approval_note="Approved by TL.",
        )

        # 4. Leave - Approved (out on leave wrapping today)
        LeaveRequest.objects.create(
            organization=org,
            requester=employee,
            leave_type=lt_annual,
            start_date=date.today() - timedelta(days=1),
            end_date=date.today() + timedelta(days=2),
            working_days_requested=3.0,
            reason="Urgent personal matters.",
            state="approved",
            tl_approved_start_date=date.today() - timedelta(days=1),
            tl_approved_end_date=date.today() + timedelta(days=2),
            tl_approval_note="TL approved.",
            gm_approved_start_date=date.today() - timedelta(days=1),
            gm_approved_end_date=date.today() + timedelta(days=2),
            gm_approval_note="GM approved."
        )

        # 5. Leave - Rejected
        LeaveRequest.objects.create(
            organization=org,
            requester=employee,
            leave_type=lt_annual,
            start_date=date.today() + timedelta(days=12),
            end_date=date.today() + timedelta(days=14),
            working_days_requested=2.0,
            reason="Leisure trip.",
            state="rejected",
            rejection_reason="Peak department project release timeline. Leave denied."
        )

        # --- Audit Logs & Notifications (Timeline Activity population) ---
        AuditLog.objects.create(
            organization=org,
            actor=employee,
            action="CREATED",
            target_type="PettyCashRequest",
            target_id=1,
            new_state="draft",
            reason="Requisition created."
        )
        AuditLog.objects.create(
            organization=org,
            actor=team_lead,
            action="APPROVED",
            target_type="PettyCashRequest",
            target_id=2,
            old_state="pending_tl_approval",
            new_state="pending_ceo_approval",
            reason="Approved and routed to CEO."
        )
        AuditLog.objects.create(
            organization=org,
            actor=ceo,
            action="APPROVED",
            target_type="PettyCashRequest",
            target_id=3,
            old_state="pending_ceo_approval",
            new_state="pending_hr_disbursement",
            reason="Approved router replacement."
        )
        AuditLog.objects.create(
            organization=org,
            actor=hr_user,
            action="DISBURSED",
            target_type="PettyCashRequest",
            target_id=4,
            old_state="pending_hr_disbursement",
            new_state="disbursed",
            reason="Disbursed petty cash."
        )

        Notification.objects.create(
            recipient=employee,
            notification_type="STATUS_CHANGED",
            title="Requisition Approved",
            message=f"Your petty cash request for Router upgrade has been approved by {ceo.first_name}."
        )

        self.generate_seed_notifications()

    def generate_seed_notifications(self):
        """
        Generates realistic notifications in the database for all seeded requests.
        """
        self.stdout.write("Generating seed notifications...")
        
        # 1. Petty Cash Requests
        for req in PettyCashRequest.objects.all():
            organization = req.organization
            action_url = f"/petty-cash/{req.uuid}/"
            requester = req.requester
            requester_name = f"{requester.first_name} {requester.last_name}".strip() if requester.first_name else requester.username
            
            if req.state == 'pending_tl_approval':
                tls = UserProfile.objects.filter(
                    organization=organization,
                    department=req.department,
                    role=UserRole.TEAM_LEAD
                )
                for tl in tls:
                    Notification.objects.get_or_create(
                        recipient=tl.user,
                        notification_type=Notification.NotificationType.APPROVAL_NEEDED,
                        title="Approval Needed: Petty Cash Request",
                        message=f"{requester_name} submitted a Petty Cash request for approval.",
                        action_url=action_url
                    )
            elif req.state == 'pending_ceo_approval':
                ceos = UserProfile.objects.filter(
                    organization=organization,
                    role=UserRole.CEO
                )
                for ceo in ceos:
                    Notification.objects.get_or_create(
                        recipient=ceo.user,
                        notification_type=Notification.NotificationType.APPROVAL_NEEDED,
                        title="CEO Approval Needed",
                        message=f"{requester_name}'s Petty Cash request has been escalated for CEO approval.",
                        action_url=action_url
                    )
            elif req.state in ['pending_hr_disbursement', 'partially_disbursed']:
                hrs = UserProfile.objects.filter(
                    organization=organization,
                    role=UserRole.HR
                )
                for hr in hrs:
                    Notification.objects.get_or_create(
                        recipient=hr.user,
                        notification_type=Notification.NotificationType.APPROVAL_NEEDED,
                        title="Payout Disbursement Pending",
                        message=f"{requester_name}'s petty cash request is approved and pending payout.",
                        action_url=action_url
                    )
            elif req.state in ['approved', 'rejected', 'disbursed', 'rejected_by_ceo']:
                Notification.objects.get_or_create(
                    recipient=requester,
                    notification_type=Notification.NotificationType.STATUS_CHANGED,
                    title=f"Request {req.state.replace('_', ' ').title()}",
                    message=f"Your petty cash request '{req.title}' has been {req.state.replace('_', ' ')}.",
                    action_url=action_url,
                    defaults={'is_read': True}
                )

        # 2. Leave Requests
        for req in LeaveRequest.objects.all():
            organization = req.organization
            action_url = f"/leave/{req.uuid}/"
            requester = req.requester
            requester_name = f"{requester.first_name} {requester.last_name}".strip() if requester.first_name else requester.username
            
            if req.state == 'pending_tl_approval':
                dept = requester.profile.department
                if dept:
                    tls = UserProfile.objects.filter(
                        organization=organization,
                        department=dept,
                        role=UserRole.TEAM_LEAD
                    )
                    for tl in tls:
                        Notification.objects.get_or_create(
                            recipient=tl.user,
                            notification_type=Notification.NotificationType.APPROVAL_NEEDED,
                            title="Approval Needed: Leave Request",
                            message=f"{requester_name} submitted a Leave request for approval.",
                            action_url=action_url
                        )
            elif req.state == 'pending_gm_approval':
                gms = UserProfile.objects.filter(
                    organization=organization,
                    role=UserRole.GENERAL_MANAGER
                )
                for gm in gms:
                    Notification.objects.get_or_create(
                        recipient=gm.user,
                        notification_type=Notification.NotificationType.APPROVAL_NEEDED,
                        title="GM Approval Needed",
                        message=f"{requester_name}'s Leave request requires GM approval.",
                        action_url=action_url
                    )
            elif req.state in ['approved', 'rejected']:
                Notification.objects.get_or_create(
                    recipient=requester,
                    notification_type=Notification.NotificationType.STATUS_CHANGED,
                    title=f"Leave Request {req.state.capitalize()}",
                    message=f"Your leave request has been {req.state}.",
                    action_url=action_url,
                    defaults={'is_read': True}
                )

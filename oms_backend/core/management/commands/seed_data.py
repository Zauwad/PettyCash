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
            all_dept_slugs = ["eng", "mkt", "hr", "fin", "des", "vent", "creative", "growth", "ai", "ops", "prod", "sales", "net", "support", "logistics"]
            for dept_slug in all_dept_slugs:
                seed_usernames.append(f"{org_slug}_{dept_slug}_lead")
                seed_usernames.append(f"{org_slug}_{dept_slug}_emp1")
                seed_usernames.append(f"{org_slug}_{dept_slug}_emp2")
                
        User.objects.filter(username__in=seed_usernames).delete()
        CompanyHoliday.objects.all().delete()
        Department.objects.all().delete()
        AuditLog.objects.all().delete()

    def seed_all(self):
        orgs = Organization.objects.filter(slug__in=["amaze", "mynt", "braincount"])
        
        # Org specific configurations
        org_configs = {
            "amaze": {
                "depts": [
                    {"name": "Venture Development", "code": "vent", "budget": 500000.00, "spent": 300000.00, "limit": 20000.00},
                    {"name": "Creative Studio", "code": "creative", "budget": 250000.00, "spent": 220000.00, "limit": 12000.00},
                    {"name": "People & Culture", "code": "hr", "budget": 100000.00, "spent": 65000.00, "limit": 6000.00},
                    {"name": "Strategy & Growth", "code": "growth", "budget": 150000.00, "spent": 145000.00, "limit": 10000.00},
                ],
                "emp_names": {
                    "vent": [("Developer", "Venture"), ("Analyst", "Venture")],
                    "creative": [("Jane", "Creative"), ("John", "Designer")],
                    "hr": [("Sarah", "People Manager"), ("Mike", "Recruiter")],
                    "growth": [("Dave", "Growth Lead"), ("Emma", "Marketing Exec")],
                }
            },
            "braincount": {
                "depts": [
                    {"name": "AI Research", "code": "ai", "budget": 800000.00, "spent": 750000.00, "limit": 40000.00},
                    {"name": "Infrastructure & Ops", "code": "ops", "budget": 400000.00, "spent": 210000.00, "limit": 20000.00},
                    {"name": "Product Management", "code": "prod", "budget": 200000.00, "spent": 180000.00, "limit": 15000.00},
                    {"name": "Sales & Partnerships", "code": "sales", "budget": 300000.00, "spent": 310000.00, "limit": 18000.00},
                ],
                "emp_names": {
                    "ai": [("Dr. Alan", "Scientist"), ("Nate", "ML Engineer")],
                    "ops": [("Linus", "DevOps Lead"), ("Alice", "Cloud Architect")],
                    "prod": [("Jessica", "Product Owner"), ("Sam", "UX Specialist")],
                    "sales": [("Gordon", "Enterprise Rep"), ("Kelly", "Partnerships Lead")],
                }
            },
            "mynt": {
                "depts": [
                    {"name": "Network Engineering", "code": "net", "budget": 700000.00, "spent": 400000.00, "limit": 30000.00},
                    {"name": "Customer Relations", "code": "support", "budget": 150000.00, "spent": 140000.00, "limit": 7000.00},
                    {"name": "Finance & Admin", "code": "fin", "budget": 120000.00, "spent": 110000.00, "limit": 8000.00},
                    {"name": "Hardware Logistics", "code": "logistics", "budget": 250000.00, "spent": 280000.00, "limit": 12000.00},
                ],
                "emp_names": {
                    "net": [("Kabir", "Telecom Architect"), ("Rashed", "NOC Operator")],
                    "support": [("Fahim", "Support Lead"), ("Nadia", "Success Agent")],
                    "fin": [("Anis", "Controller"), ("Shirin", "Accountant")],
                    "logistics": [("Jamil", "Logistics Mgr"), ("Tarek", "Procurement Exec")],
                }
            }
        }

        leave_configs = [
            {"name": "Annual Leave", "code": "ANNUAL", "days": 14, "neg": False},
            {"name": "Sick Leave", "code": "SICK", "days": 10, "neg": True},
            {"name": "Maternity Leave", "code": "MATERNITY", "days": 120, "neg": False},
            {"name": "Paternity Leave", "code": "PATERNITY", "days": 10, "neg": False},
            {"name": "Unpaid Leave", "code": "UNPAID", "days": 0, "neg": True},
        ]

        for org in orgs:
            self.stdout.write(f"Seeding organization: {org.name}...")
            config = org_configs.get(org.slug)
            if not config:
                continue
            
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
                first_name=f"{org.name} CEO",
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
                first_name=f"{org.name} Admin",
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
                first_name=f"{org.name} GM",
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
                first_name=f"{org.name} HR",
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
                first_name=f"{org.name} Lead",
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
            for dc in config["depts"]:
                dept = Department.objects.create(
                    organization=org,
                    name=dc["name"],
                    monthly_budget=dc["budget"],
                    budget_spent_this_month=dc["spent"],
                    tl_approval_limit=dc["limit"]
                )

                # Employees
                for emp_num in [1, 2]:
                    names = config["emp_names"].get(dc["code"], [("Employee", str(emp_num))])
                    first_name, last_name = names[emp_num - 1]

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
            
            # 6.5 Seed Manager-authored requests (Lead, HR, GM)
            self.seed_manager_requests(org, gm_user, hr_user, tl_user, ceo_user)

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
        
        # Get HR user for assigning HR disbursement fields
        hr_profile = UserProfile.objects.filter(organization=org, role=UserRole.HR).first()
        hr_user = hr_profile.user if hr_profile else ceo
        
        # Get GM user
        gm_profile = UserProfile.objects.filter(organization=org, role=UserRole.GENERAL_MANAGER).first()
        gm_user = gm_profile.user if gm_profile else ceo

        # Determine department code based on name to fetch custom templates
        name_lower = dept.name.lower()
        if "venture" in name_lower:
            dept_code = "vent"
        elif "creative" in name_lower:
            dept_code = "creative"
        elif "people" in name_lower or "culture" in name_lower:
            dept_code = "hr"
        elif "strategy" in name_lower or "growth" in name_lower:
            dept_code = "growth"
        elif "research" in name_lower or "ai" in name_lower:
            dept_code = "ai"
        elif "infrastructure" in name_lower or "ops" in name_lower:
            dept_code = "ops"
        elif "product" in name_lower:
            dept_code = "prod"
        elif "sales" in name_lower:
            dept_code = "sales"
        elif "network" in name_lower:
            dept_code = "net"
        elif "customer" in name_lower or "relations" in name_lower:
            dept_code = "support"
        elif "finance" in name_lower or "admin" in name_lower:
            dept_code = "fin"
        elif "logistics" in name_lower:
            dept_code = "logistics"
        else:
            dept_code = "vent"

        # Department specific real-world petty cash details
        petty_cash_templates = {
            "vent": {
                "draft": ("Draft - AWS hosting credits purchase", "Purchasing testing server credits.", 4500.00, "Office Supplies"),
                "pending_tl": ("Pending TL - Figma Professional team plan renewal", "Renewing team licenses for designers.", 9200.00, "Office Supplies"),
                "pending_ceo": ("Pending CEO - Purchase of domain name portfolio", "Buying brand domains for the new venture launch.", 30000.00, "Equipment"),
                "pending_hr": ("Pending Payout - Integration API service subscription", "Subscription for maps and messaging APIs.", 2500.00, "Office Supplies"),
                "partial": ("Partial Payout - GitHub Enterprise seats upgrade", "Upgrading GitHub team seats for external contractors.", 15000.00, "Equipment"),
                "rejected_tl": ("Rejected TL - Premium stock video package", "Purchase of video elements for pitch deck.", 8500.00, "Office Supplies"),
                "rejected_ceo": ("Rejected CEO - Extra testing mobile devices", "Buying two low-end Android testing phones.", 28000.00, "Equipment"),
                "cancelled": ("Cancelled - Wireframing stencil kit purchase", "Requisition for paper prototyping stencils.", 1200.00, "Office Supplies"),
            },
            "creative": {
                "draft": ("Draft - Adobe Stock assets license", "Buying high-res graphic assets.", 3000.00, "Office Supplies"),
                "pending_tl": ("Pending TL - Camera lens rental for brand shoot", "Renting 85mm f/1.4 lens for portrait shoot.", 12000.00, "Equipment"),
                "pending_ceo": ("Pending CEO - Wacom graphics tablet replacement", "Replacing broken Wacom Intuos tablet.", 22000.00, "Equipment"),
                "pending_hr": ("Pending Payout - Font license for client project", "Web and print license for custom typeface.", 4500.00, "Office Supplies"),
                "partial": ("Partial Payout - Studio lighting equipment lease", "Leasing background softboxes for the recording studio.", 18000.00, "Equipment"),
                "rejected_tl": ("Rejected TL - Hand-painted background board", "Hand-painted boards for physical product photoshoot.", 7000.00, "Office Supplies"),
                "rejected_ceo": ("Rejected CEO - Designer desk lamp purchase", "Buying premium desk lamp for color-grading desk.", 5000.00, "Office Supplies"),
                "cancelled": ("Cancelled - Premium sketchbook supply request", "Buying notebooks for storyboard sketching.", 1500.00, "Office Supplies"),
            },
            "hr": {
                "draft": ("Draft - Employee birthday gift cards", "Procuring gift vouchers for next month birthdays.", 2000.00, "Office Supplies"),
                "pending_tl": ("Pending TL - Job posting board package", "BDJobs posting package for recruitment.", 8000.00, "Office Supplies"),
                "pending_ceo": ("Pending CEO - Team building workshop speaker fee", "Paying external speaker for quarterly team workshop.", 25000.00, "Equipment"),
                "pending_hr": ("Pending Payout - Office medicine box refills", "Restocking first aid kit supplies.", 1800.00, "Office Supplies"),
                "partial": ("Partial Payout - Ergonomic keyboard testing batch", "Buying sample keyboards to test for engineering teams.", 10000.00, "Equipment"),
                "rejected_tl": ("Rejected TL - Premium desk plant setup", "Greenery setup for common lounge area.", 6500.00, "Office Supplies"),
                "rejected_ceo": ("Rejected CEO - Executive coaching session", "Coaching consultation fee.", 20000.00, "Equipment"),
                "cancelled": ("Cancelled - Custom company stickers print", "Printing branded stickers for new hires.", 3000.00, "Office Supplies"),
            },
            "growth": {
                "draft": ("Draft - Search ads campaign setup", "Setting up Google Search Ads for product launch.", 5000.00, "Office Supplies"),
                "pending_tl": ("Pending TL - Competitor analytics tool access", "Subscribing to SEMRush API access for audit.", 7500.00, "Office Supplies"),
                "pending_ceo": ("Pending CEO - Business pitch deck design printing", "Printing glossy portfolios for foreign delegates.", 15000.00, "Equipment"),
                "pending_hr": ("Pending Payout - Retargeting platform credits", "Buying ad credits for LinkedIn campaign.", 3200.00, "Office Supplies"),
                "partial": ("Partial Payout - B2B lead generation tool subscription", "Subscribing to Apollo email sequencing service.", 12000.00, "Equipment"),
                "rejected_tl": ("Rejected TL - LinkedIn premium sales navigator", "Sales navigator seats for team lead.", 8500.00, "Office Supplies"),
                "rejected_ceo": ("Rejected CEO - Client dinner at upscale restaurant", "Dinner hosting for international client reps.", 18000.00, "Office Supplies"),
                "cancelled": ("Cancelled - Custom roll-up banner printing", "Promotional banners for conference booth.", 4000.00, "Office Supplies"),
            },
            "ai": {
                "draft": ("Draft - Kaggle competition entry fee", "Team registration fee.", 3500.00, "Office Supplies"),
                "pending_tl": ("Pending TL - Hugging Face API premium usage", "Inference costs for dataset testing.", 14500.00, "Office Supplies"),
                "pending_ceo": ("Pending CEO - RunPod GPU renting credits", "Buying cloud GPU computing hours.", 48000.00, "Equipment"),
                "pending_hr": ("Pending Payout - OpenAI API token usage billing", "API token usage charge for model fine-tuning.", 8200.00, "Office Supplies"),
                "partial": ("Partial Payout - Overleaf team subscription", "Annual team subscription for LaTeX report writing.", 11000.00, "Equipment"),
                "rejected_tl": ("Rejected TL - Custom mechanical keyboards", "Buying mechanical keyboards for AI engineers.", 16000.00, "Office Supplies"),
                "rejected_ceo": ("Rejected CEO - Dedicated GPU cooling fan setup", "Liquid cooling replacement setup for test rig.", 25000.00, "Equipment"),
                "cancelled": ("Cancelled - Python AI programming books", "Ordering latest reference guides from Amazon.", 4200.00, "Office Supplies"),
            },
            "ops": {
                "draft": ("Draft - SSL certificate renewal", "Buying wildcard SSL certs.", 2500.00, "Office Supplies"),
                "pending_tl": ("Pending TL - Backup storage hard drives", "2TB SSDs for network data store.", 9800.00, "Office Supplies"),
                "pending_ceo": ("Pending CEO - Server rack replacement hardware", "Installing server cabinet rails.", 36000.00, "Equipment"),
                "pending_hr": ("Pending Payout - Domain registration renewal", "Renewing key brand domain names.", 1900.00, "Office Supplies"),
                "partial": ("Partial Payout - Grafana dashboard seats", "Grafana premium monitoring platform subscription.", 12000.00, "Equipment"),
                "rejected_tl": ("Rejected TL - Smart rack temperature sensor", "Smart monitoring sensor.", 6000.00, "Office Supplies"),
                "rejected_ceo": ("Rejected CEO - Server maintenance toolkit", "Pro toolkit containing crimpers and cabling tools.", 14000.00, "Equipment"),
                "cancelled": ("Cancelled - Cabling organizer sleeves bulk", "Ordering cable routing ties.", 1500.00, "Office Supplies"),
            },
            "prod": {
                "draft": ("Draft - User testing compensation voucher", "Paying test group participants.", 3000.00, "Office Supplies"),
                "pending_tl": ("Pending TL - Prototyping tool subscription", "Framer/UXPin team seat subscription.", 6500.00, "Office Supplies"),
                "pending_ceo": ("Pending CEO - Customer feedback tracking platform", "Subscription fee for feature request board.", 20000.00, "Equipment"),
                "pending_hr": ("Pending Payout - Product mockups presentation tools", "Purchasing device mockup templates.", 2800.00, "Office Supplies"),
                "partial": ("Partial Payout - Product analytics dashboard", "Mixpanel/Amplitude monthly track quota.", 15000.00, "Equipment"),
                "rejected_tl": ("Rejected TL - Premium whiteboards for meeting room", "New writing boards.", 8000.00, "Office Supplies"),
                "rejected_ceo": ("Rejected CEO - Interactive whiteboard smart screen", "Touchscreen smart board.", 45000.00, "Equipment"),
                "cancelled": ("Cancelled - Sticky notes whiteboard magnetic tags", "Product planning sticky kit.", 1200.00, "Office Supplies"),
            },
            "sales": {
                "draft": ("Draft - Business card printing order", "Printing cards for business developers.", 1500.00, "Office Supplies"),
                "pending_tl": ("Pending TL - Industry database list purchase", "Buying validated B2B email database.", 12000.00, "Office Supplies"),
                "pending_ceo": ("Pending CEO - Trade show booths sponsorship deposit", "Deposit for booking booth space.", 50000.00, "Equipment"),
                "pending_hr": ("Pending Payout - Client presentation folder printing", "Printing folders for sales meetings.", 3500.00, "Office Supplies"),
                "partial": ("Partial Payout - CRM email sequencing software", "CRM integration addon tools.", 14000.00, "Equipment"),
                "rejected_tl": ("Rejected TL - Sales pitch coaching program", "External sales trainer retainer.", 15000.00, "Office Supplies"),
                "rejected_ceo": ("Rejected CEO - Premium client gift hampers", "Buying chocolate baskets for top-tier partners.", 24000.00, "Office Supplies"),
                "cancelled": ("Cancelled - Promotional branded pens supply", "Custom engraved pens.", 3500.00, "Office Supplies"),
            },
            "net": {
                "draft": ("Draft - Cable tester device batteries", "Buying rechargeable batteries.", 800.00, "Office Supplies"),
                "pending_tl": ("Pending TL - Fiber optic patching cables", "LC-LC single mode fiber cables.", 11000.00, "Office Supplies"),
                "pending_ceo": ("Pending CEO - High-capacity optical transceiver modules", "10G SFP+ modules for switch connections.", 42000.00, "Equipment"),
                "pending_hr": ("Pending Payout - Server cage padlock replacement", "Replacing biometric locks.", 1200.00, "Office Supplies"),
                "partial": ("Partial Payout - Network diagnostic device lease", "Leasing Fluke fiber analyzer equipment.", 20000.00, "Equipment"),
                "rejected_tl": ("Rejected TL - Network cable labeling tool", "Portable label printer.", 9500.00, "Office Supplies"),
                "rejected_ceo": ("Rejected CEO - High-end fiber fusion splicer kit", "Buying dedicated splicing machine.", 85000.00, "Equipment"),
                "cancelled": ("Cancelled - Network rack storage tray request", "1U steel rack trays.", 3000.00, "Office Supplies"),
            },
            "support": {
                "draft": ("Draft - Wireless headset foam replacement", "Replacement cushions for call center headsets.", 1200.00, "Office Supplies"),
                "pending_tl": ("Pending TL - Call noise cancelling software", "Krisp noise cancellation team licenses.", 7200.00, "Office Supplies"),
                "pending_ceo": ("Pending CEO - Customer ticketing system upgrade", "Zendesk/Freshdesk premium tier upgrade.", 28000.00, "Equipment"),
                "pending_hr": ("Pending Payout - Call recording backup drives", "External drives for system log vault.", 4500.00, "Office Supplies"),
                "partial": ("Partial Payout - Live chat widget integrations", "Installing customer support chat tools on site.", 10000.00, "Equipment"),
                "rejected_tl": ("Rejected TL - Ergonomic footrests for agents", "Footrests for desk comfort.", 5000.00, "Office Supplies"),
                "rejected_ceo": ("Rejected CEO - Call center wall dashboard display", "Buying 55-inch monitoring smart TV.", 32000.00, "Equipment"),
                "cancelled": ("Cancelled - Support desk custom keycaps", "Keycap customization order.", 1800.00, "Office Supplies"),
            },
            "fin": {
                "draft": ("Draft - Invoice archiving box files", "Cardboard files for filing cabinet.", 1500.00, "Office Supplies"),
                "pending_tl": ("Pending TL - Tax filing service portal access", "BD tax advisor premium membership.", 8500.00, "Office Supplies"),
                "pending_ceo": ("Pending CEO - Audit consulting retainer payment", "Initial payment for external audit partners.", 60000.00, "Equipment"),
                "pending_hr": ("Pending Payout - Paper shredder replacement", "Buying micro-cut office paper shredder.", 5500.00, "Office Supplies"),
                "partial": ("Partial Payout - Fixed asset tagging label rolls", "Procuring QR labels for asset tracking.", 3000.00, "Equipment"),
                "rejected_tl": ("Rejected TL - Premium calculator upgrade", "Scientific accountancy calculators.", 2500.00, "Office Supplies"),
                "rejected_ceo": ("Rejected CEO - Finance team leadership training course", "Enrolling team in certification course.", 18000.00, "Office Supplies"),
                "cancelled": ("Cancelled - Custom stamp printing", "Official financial stamp.", 1200.00, "Office Supplies"),
            },
            "logistics": {
                "draft": ("Draft - Warehouse barcode scanner replacement", "Procuring hand scanner.", 4500.00, "Office Supplies"),
                "pending_tl": ("Pending TL - Bubble wrap and packing cartons", "Supply of shipping materials.", 9500.00, "Office Supplies"),
                "pending_ceo": ("Pending CEO - Warehouse shelving racks installation", "Buying heavy-duty storage shelves.", 35000.00, "Equipment"),
                "pending_hr": ("Pending Payout - Dispatch delivery packaging tape", "Procuring high-strength packaging tapes.", 2200.00, "Office Supplies"),
                "partial": ("Partial Payout - Delivery tracking API integration", "Integrations with third party shipping logs.", 12000.00, "Equipment"),
                "rejected_tl": ("Rejected TL - Heavy duty protective gloves", "Warehouse safety gears.", 3500.00, "Office Supplies"),
                "rejected_ceo": ("Rejected CEO - Hand truck trolley upgrade request", "Ordering heavy steel platform hand truck.", 15000.00, "Equipment"),
                "cancelled": ("Cancelled - Branded shipping box sample production", "Sample run of custom boxes.", 6000.00, "Office Supplies"),
            }
        }

        t = petty_cash_templates.get(dept_code, petty_cash_templates["vent"])

        # 1. Petty Cash Request - Draft
        PettyCashRequest.objects.create(
            organization=org,
            department=dept,
            requester=employee,
            title=t["draft"][0],
            description=t["draft"][1],
            amount_requested=t["draft"][2],
            state="draft",
            priority="LOW",
            needed_by=date.today() + timedelta(days=10)
        )

        # 2. Petty Cash Request - Pending TL Approval
        pc_tl = PettyCashRequest.objects.create(
            organization=org,
            department=dept,
            requester=employee,
            title=t["pending_tl"][0],
            description=t["pending_tl"][1],
            amount_requested=t["pending_tl"][2],
            state="pending_tl_approval",
            priority="MEDIUM",
            needed_by=date.today() + timedelta(days=3)
        )
        PettyCashLineItem.objects.create(
            request=pc_tl,
            description=t["pending_tl"][0].split(" - ")[-1],
            quantity=1,
            unit_price=t["pending_tl"][2],
            category=t["pending_tl"][3]
        )

        # 3. Petty Cash Request - Pending CEO Approval
        pc_ceo = PettyCashRequest.objects.create(
            organization=org,
            department=dept,
            requester=employee,
            title=t["pending_ceo"][0],
            description=t["pending_ceo"][1],
            amount_requested=t["pending_ceo"][2],
            amount_approved=t["pending_ceo"][2],
            state="pending_ceo_approval",
            priority="HIGH",
            needed_by=date.today() + timedelta(days=1),
            tl_approved_amount=t["pending_ceo"][2],
            tl_approval_note="Approved by TL. Routed to CEO.",
        )
        PettyCashLineItem.objects.create(
            request=pc_ceo,
            description=t["pending_ceo"][0].split(" - ")[-1],
            quantity=1,
            unit_price=t["pending_ceo"][2],
            category=t["pending_ceo"][3]
        )

        # 4. Petty Cash Request - Pending HR Disbursement
        pc_hr = PettyCashRequest.objects.create(
            organization=org,
            department=dept,
            requester=employee,
            title=t["pending_hr"][0],
            description=t["pending_hr"][1],
            amount_requested=t["pending_hr"][2],
            amount_approved=t["pending_hr"][2],
            state="pending_hr_disbursement",
            priority="MEDIUM",
            needed_by=date.today(),
            tl_approved_amount=t["pending_hr"][2],
            tl_approval_note="Approved.",
            ceo_approved_amount=t["pending_hr"][2],
            ceo_approval_note="Approved.",
        )
        PettyCashLineItem.objects.create(
            request=pc_hr,
            description=t["pending_hr"][0].split(" - ")[-1],
            quantity=1,
            unit_price=t["pending_hr"][2],
            category=t["pending_hr"][3]
        )

        # 5. Petty Cash Request - Partially Disbursed
        pc_partial = PettyCashRequest.objects.create(
            organization=org,
            department=dept,
            requester=employee,
            title=t["partial"][0],
            description=t["partial"][1],
            amount_requested=t["partial"][2],
            amount_approved=t["partial"][2],
            amount_disbursed=5000.00,
            state="partially_disbursed",
            priority="HIGH",
            needed_by=date.today(),
            tl_approved_amount=t["partial"][2],
            tl_approval_note="Approved.",
            ceo_approved_amount=t["partial"][2],
            ceo_approval_note="Approved.",
        )
        PettyCashLineItem.objects.create(
            request=pc_partial,
            description=t["partial"][0].split(" - ")[-1],
            quantity=1,
            unit_price=t["partial"][2],
            category=t["partial"][3]
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
            title=t["rejected_tl"][0],
            description=t["rejected_tl"][1],
            amount_requested=t["rejected_tl"][2],
            state="rejected",
            priority="MEDIUM",
            needed_by=date.today(),
            rejection_reason="Snacks and premium decorative additions are not covered under department budget this cycle."
        )

        # 7. Petty Cash Request - Rejected by CEO
        PettyCashRequest.objects.create(
            organization=org,
            department=dept,
            requester=employee,
            title=t["rejected_ceo"][0],
            description=t["rejected_ceo"][1],
            amount_requested=t["rejected_ceo"][2],
            state="rejected_by_ceo",
            priority="LOW",
            needed_by=date.today(),
            tl_approved_amount=t["rejected_ceo"][2],
            tl_approval_note="Approved by Team Lead.",
            rejection_reason="Out of scope for current budget priorities. Denied by CEO."
        )

        # 8. Petty Cash Request - Cancelled
        PettyCashRequest.objects.create(
            organization=org,
            department=dept,
            requester=employee,
            title=t["cancelled"][0],
            description=t["cancelled"][1],
            amount_requested=t["cancelled"][2],
            state="cancelled",
            priority="LOW",
            needed_by=date.today()
        )

        # --- Leave Requests ---
        lt_annual = LeaveType.objects.get(organization=org, code="ANNUAL")
        lt_sick = LeaveType.objects.get(organization=org, code="SICK")
        
        # Varied leave reason templates based on department code to keep data organic
        leave_reasons = {
            "vent": {
                "draft": "Planned annual family vacation to Sundarbans.",
                "pending_tl": "Recovering from severe wisdom tooth extraction and dental surgery.",
                "pending_gm": "Attending sibling's wedding ceremony and related family events.",
                "approved": "Personal family emergency - traveling to my hometown.",
                "rejected": "Attending standard tech meetup events."
            },
            "creative": {
                "draft": "Going on a family trip to Sylhet tea gardens.",
                "pending_tl": "Severe food poisoning recovery and resting as prescribed.",
                "pending_gm": "Taking time off to manage home relocation and packing.",
                "approved": "Viral fever recovery and rest.",
                "rejected": "Personal leisure week off."
            },
            "hr": {
                "draft": "Planned annual vacation to Saint Martin.",
                "pending_tl": "Severe throat infection and doctor recommended voice rest.",
                "pending_gm": "Attending child's school admission tests and board meetings.",
                "approved": "Family medical emergency.",
                "rejected": "Off-season leisure break."
            },
            "growth": {
                "draft": "Planned vacation to Bandarban hills.",
                "pending_tl": "Sprained ankle from weekend sports - doctor advised resting.",
                "pending_gm": "Attending close cousin's wedding registry.",
                "approved": "Urgent travel to my hometown for parents' checkup.",
                "rejected": "Taking time off during marketing campaign launch week."
            }
        }
        
        lr_t = leave_reasons.get(dept_code, leave_reasons["vent"])

        # 1. Leave - Draft
        LeaveRequest.objects.create(
            organization=org,
            requester=employee,
            leave_type=lt_annual,
            start_date=date.today() + timedelta(days=30),
            end_date=date.today() + timedelta(days=35),
            working_days_requested=5.0,
            reason=lr_t["draft"],
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
            reason=lr_t["pending_tl"],
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
            reason=lr_t["pending_gm"],
            state="pending_gm_approval",
            tl_approved_start_date=date.today() + timedelta(days=15),
            tl_approved_end_date=date.today() + timedelta(days=19),
            tl_approval_note="Department tasks covered. Approved by TL.",
        )

        # 4. Leave - Approved (out on leave wrapping today)
        LeaveRequest.objects.create(
            organization=org,
            requester=employee,
            leave_type=lt_annual,
            start_date=date.today() - timedelta(days=1),
            end_date=date.today() + timedelta(days=2),
            working_days_requested=3.0,
            reason=lr_t["approved"],
            state="approved",
            tl_approved_start_date=date.today() - timedelta(days=1),
            tl_approved_end_date=date.today() + timedelta(days=2),
            tl_approval_note="Approved.",
            gm_approved_start_date=date.today() - timedelta(days=1),
            gm_approved_end_date=date.today() + timedelta(days=2),
            gm_approval_note="Approved."
        )

        # 5. Leave - Rejected
        LeaveRequest.objects.create(
            organization=org,
            requester=employee,
            leave_type=lt_annual,
            start_date=date.today() + timedelta(days=12),
            end_date=date.today() + timedelta(days=14),
            working_days_requested=2.0,
            reason=lr_t["rejected"],
            state="rejected",
            rejection_reason="Timeline clashes with critical department launch/project release cycle. Denied."
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

    def seed_manager_requests(self, org, gm, hr, tl, ceo):
        """Seeds realistic personal requests sent by the Team Lead, HR, and GM themselves."""
        from pettycash.models import PettyCashRequest, PettyCashLineItem, Disbursement
        from leave.models import LeaveRequest, LeaveType
        
        # Get standard leave types
        lt_annual = LeaveType.objects.get(organization=org, code="ANNUAL")
        lt_sick = LeaveType.objects.get(organization=org, code="SICK")
        first_dept = org.departments.first()

        # 1. Requests for Team Lead (tl)
        # Petty Cash
        pc_tl_pending = PettyCashRequest.objects.create(
            organization=org,
            department=first_dept,
            requester=tl,
            title="Pending CEO - Figma Professional team plan renewal",
            description="Figma seats renewal for design collaboration and venture specs.",
            amount_requested=14500.00,
            amount_approved=14500.00,
            state="pending_ceo_approval",
            priority="HIGH",
            needed_by=date.today() + timedelta(days=2),
            tl_approved_amount=14500.00,
            tl_approval_note="TL approved self-request (system auto-routing)."
        )
        PettyCashLineItem.objects.create(
            request=pc_tl_pending,
            description="Figma Professional seats",
            quantity=1,
            unit_price=14500.00,
            category="Office Supplies"
        )
        pc_tl_disbursed = PettyCashRequest.objects.create(
            organization=org,
            department=first_dept,
            requester=tl,
            title="Disbursed - Tech reference books for project space",
            description="Standard database design and system architecture books.",
            amount_requested=4800.00,
            amount_approved=4800.00,
            amount_disbursed=4800.00,
            state="disbursed",
            priority="LOW",
            needed_by=date.today() - timedelta(days=5),
            tl_approved_amount=4800.00,
            tl_approval_note="Approved.",
            ceo_approved_amount=4800.00,
            ceo_approval_note="Approved."
        )
        PettyCashLineItem.objects.create(
            request=pc_tl_disbursed,
            description="Technical reference textbooks",
            quantity=1,
            unit_price=4800.00,
            category="Office Supplies"
        )
        Disbursement.objects.create(
            request=pc_tl_disbursed,
            disbursed_by=hr,
            amount=4800.00,
            payment_method="CASH",
            reference_number=f"MGR-TL-{pc_tl_disbursed.id}",
            notes="Disbursed."
        )
        # Leave
        LeaveRequest.objects.create(
            organization=org,
            requester=tl,
            leave_type=lt_sick,
            start_date=date.today() + timedelta(days=7),
            end_date=date.today() + timedelta(days=8),
            working_days_requested=2.0,
            reason="Scheduled wisdom tooth dental checkup.",
            state="pending_gm_approval"
        )
        LeaveRequest.objects.create(
            organization=org,
            requester=tl,
            leave_type=lt_annual,
            start_date=date.today() - timedelta(days=10),
            end_date=date.today() - timedelta(days=8),
            working_days_requested=3.0,
            reason="Sister's engagement ceremony family events.",
            state="approved",
            tl_approved_start_date=date.today() - timedelta(days=10),
            tl_approved_end_date=date.today() - timedelta(days=8),
            tl_approval_note="Auto-routed.",
            gm_approved_start_date=date.today() - timedelta(days=10),
            gm_approved_end_date=date.today() - timedelta(days=8),
            gm_approval_note="Approved."
        )

        # 2. Requests for HR (hr)
        # Petty Cash
        pc_hr_pending = PettyCashRequest.objects.create(
            organization=org,
            department=first_dept,
            requester=hr,
            title="Pending CEO - HR portal recruitment package",
            description="Job listings slots package.",
            amount_requested=25000.00,
            amount_approved=25000.00,
            state="pending_ceo_approval",
            priority="HIGH",
            needed_by=date.today() + timedelta(days=4),
            tl_approved_amount=25000.00,
            tl_approval_note="Approved."
        )
        PettyCashLineItem.objects.create(
            request=pc_hr_pending,
            description="Recruitment listing slots",
            quantity=1,
            unit_price=25000.00,
            category="Office Supplies"
        )
        pc_hr_disbursed = PettyCashRequest.objects.create(
            organization=org,
            department=first_dept,
            requester=hr,
            title="Disbursed - Welcome kit prints for new hires",
            description="Branded cards, stickers, and notebook bindings.",
            amount_requested=6200.00,
            amount_approved=6200.00,
            amount_disbursed=6200.00,
            state="disbursed",
            priority="LOW",
            needed_by=date.today() - timedelta(days=10),
            tl_approved_amount=6200.00,
            tl_approval_note="Approved.",
            ceo_approved_amount=6200.00,
            ceo_approval_note="Approved."
        )
        PettyCashLineItem.objects.create(
            request=pc_hr_disbursed,
            description="Onboarding prints kit",
            quantity=1,
            unit_price=6200.00,
            category="Office Supplies"
        )
        Disbursement.objects.create(
            request=pc_hr_disbursed,
            disbursed_by=ceo,
            amount=6200.00,
            payment_method="CASH",
            reference_number=f"MGR-HR-{pc_hr_disbursed.id}",
            notes="Disbursed."
        )
        # Leave
        LeaveRequest.objects.create(
            organization=org,
            requester=hr,
            leave_type=lt_annual,
            start_date=date.today() + timedelta(days=20),
            end_date=date.today() + timedelta(days=24),
            working_days_requested=5.0,
            reason="Family vacation trip to Sajek Valley.",
            state="pending_gm_approval"
        )
        LeaveRequest.objects.create(
            organization=org,
            requester=hr,
            leave_type=lt_sick,
            start_date=date.today() - timedelta(days=5),
            end_date=date.today() - timedelta(days=5),
            working_days_requested=1.0,
            reason="Severe migraine medical rest.",
            state="approved",
            tl_approved_start_date=date.today() - timedelta(days=5),
            tl_approved_end_date=date.today() - timedelta(days=5),
            tl_approval_note="Approved.",
            gm_approved_start_date=date.today() - timedelta(days=5),
            gm_approved_end_date=date.today() - timedelta(days=5),
            gm_approval_note="Approved."
        )

        # 3. Requests for GM (gm)
        # Petty Cash
        pc_gm_pending = PettyCashRequest.objects.create(
            organization=org,
            department=first_dept,
            requester=gm,
            title="Pending CEO - Annual general meeting catering deposit",
            description="Catering services advance booking fee.",
            amount_requested=45000.00,
            amount_approved=45000.00,
            state="pending_ceo_approval",
            priority="HIGH",
            needed_by=date.today() + timedelta(days=5),
            tl_approved_amount=45000.00,
            tl_approval_note="Approved."
        )
        PettyCashLineItem.objects.create(
            request=pc_gm_pending,
            description="AGM catering booking advance",
            quantity=1,
            unit_price=45000.00,
            category="Travel & Entertainment"
        )
        pc_gm_disbursed = PettyCashRequest.objects.create(
            organization=org,
            department=first_dept,
            requester=gm,
            title="Disbursed - Company legal registration notary stamp",
            description="Official documentation notary fees.",
            amount_requested=12000.00,
            amount_approved=12000.00,
            amount_disbursed=12000.00,
            state="disbursed",
            priority="MEDIUM",
            needed_by=date.today() - timedelta(days=12),
            tl_approved_amount=12000.00,
            tl_approval_note="Approved.",
            ceo_approved_amount=12000.00,
            ceo_approval_note="Approved."
        )
        PettyCashLineItem.objects.create(
            request=pc_gm_disbursed,
            description="Notary stamp fees",
            quantity=1,
            unit_price=12000.00,
            category="Office Supplies"
        )
        Disbursement.objects.create(
            request=pc_gm_disbursed,
            disbursed_by=hr,
            amount=12000.00,
            payment_method="CASH",
            reference_number=f"MGR-GM-{pc_gm_disbursed.id}",
            notes="Disbursed."
        )
        # Leave
        LeaveRequest.objects.create(
            organization=org,
            requester=gm,
            leave_type=lt_annual,
            start_date=date.today() + timedelta(days=15),
            end_date=date.today() + timedelta(days=19),
            working_days_requested=5.0,
            reason="Venture capital partner summit travel time off.",
            state="pending_gm_approval"  # CEO approves GMs (mapped as pending GM in model state)
        )
        LeaveRequest.objects.create(
            organization=org,
            requester=gm,
            leave_type=lt_annual,
            start_date=date.today() - timedelta(days=6),
            end_date=date.today() - timedelta(days=5),
            working_days_requested=2.0,
            reason="Family emergency home town visit.",
            state="approved",
            tl_approved_start_date=date.today() - timedelta(days=6),
            tl_approved_end_date=date.today() - timedelta(days=5),
            tl_approval_note="Approved.",
            gm_approved_start_date=date.today() - timedelta(days=6),
            gm_approved_end_date=date.today() - timedelta(days=5),
            gm_approval_note="Approved."
        )

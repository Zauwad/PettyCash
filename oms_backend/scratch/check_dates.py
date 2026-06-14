import os
import sys
import django
from datetime import date

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'oms_project.settings.development')
django.setup()

from pettycash.models import PettyCashRequest
from django.db.models import Min, Max
from django.utils import timezone
from datetime import datetime, date
from django.db.models import Sum

today = date.today()
start_of_month = date(today.year, today.month, 1)
start_datetime = timezone.make_aware(datetime.combine(start_of_month, datetime.min.time()))

print(f"Start datetime: {start_datetime}")

total_requests = PettyCashRequest.objects.filter(
    organization__slug='amaze',
    created_at__gte=start_datetime
).count()
print(f"Amaze Total Requests: {total_requests}")

from pettycash.models import Disbursement
monthly_spend_query = Disbursement.objects.filter(
    request__organization__slug='amaze',
    disbursed_at__gte=start_datetime
).aggregate(total=Sum('amount'))
monthly_spend = float(monthly_spend_query['total']) if monthly_spend_query['total'] else 0.0
print(f"Amaze Monthly Spend: {monthly_spend}")

from django.db.models import Count
from leave.models import LeaveRequest

print("\n--- Petty Cash Request States ---")
states_pc = PettyCashRequest.objects.values('state').annotate(count=Count('id'))
for s in states_pc:
    print(f"State: {s['state']}, Count: {s['count']}")

print("\n--- Leave Request States ---")
states_leave = LeaveRequest.objects.values('state').annotate(count=Count('id'))
for s in states_leave:
    print(f"State: {s['state']}, Count: {s['count']}")

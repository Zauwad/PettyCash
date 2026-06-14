import os
import sys
import django
from datetime import date, datetime

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'oms_project.settings.development')
django.setup()

from pettycash.models import Disbursement
from django.utils import timezone
from core.models import Organization

org = Organization.objects.get(slug='amaze')
today = date.today()
start_date = date(today.year - 1, today.month, 1)
start_datetime = timezone.make_aware(datetime.combine(start_date, datetime.min.time()))

print(f"Start datetime: {start_datetime}")

# Calculate last 12 months sequence
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

# Query disbursements
disbursements = Disbursement.objects.filter(
    request__organization=org,
    disbursed_at__gte=start_datetime
).select_related('request')

print(f"Disbursements retrieved: {disbursements.count()}")

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

print(f"Data count: {len(formatted_data)}")
for item in formatted_data:
    print(item)


import logging
import threading
from django.core.mail import send_mail
from django.db import transaction
from datetime import date
from django.conf import settings

from core.models import Department, ApprovalDelegation

logger = logging.getLogger(__name__)

def background_task(func):
    """
    Lightweight decorator to run functions asynchronously in a background thread.
    Exposes a '.delay(*args, **kwargs)' method to mimic the Celery API.
    """
    def delay(*args, **kwargs):
        thread = threading.Thread(target=func, args=args, kwargs=kwargs)
        thread.daemon = True
        thread.start()
        logger.info(f"Started background thread task: {func.__name__}")
    func.delay = delay
    return func

@background_task
def send_email_async(subject, message, recipient_list):
    """
    Asynchronously sends an email notification in a background thread.
    Uses DEFAULT_FROM_EMAIL.
    """
    if not recipient_list:
        return "No recipients specified."
        
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=recipient_list,
            fail_silently=False,
        )
        logger.info(f"Async email sent successfully to {recipient_list}")
        return f"Sent to {recipient_list}"
    except Exception as e:
        logger.error(f"Failed to send async email to {recipient_list}: {e}")
        raise e

def reset_monthly_budgets():
    """
    Resets budgets spent totals based on frequency.
    Runs daily, resetting departments when they reach their frequency cycle boundary.
    """
    today = date.today()
    
    # 1. Monthly Reset
    monthly_depts = Department.objects.filter(
        budget_frequency='MONTHLY',
        budget_reset_day=today.day,
        is_active=True
    )
    
    # 2. Quarterly Reset: Jan 1, Apr 1, Jul 1, Oct 1
    is_quarter_start = (today.month in [1, 4, 7, 10]) and (today.day == 1)
    quarterly_depts = Department.objects.filter(
        budget_frequency='QUARTERLY',
        is_active=True
    ) if is_quarter_start else Department.objects.none()
    
    # 3. Yearly Reset: Jan 1
    is_year_start = (today.month == 1) and (today.day == 1)
    yearly_depts = Department.objects.filter(
        budget_frequency='YEARLY',
        is_active=True
    ) if is_year_start else Department.objects.none()
    
    # Combine querysets using union/OR
    departments = (monthly_depts | quarterly_depts | yearly_depts).distinct()
    
    count = 0
    with transaction.atomic():
        for dept in departments:
            dept.budget_spent_this_month = 0.00
            dept.save()
            count += 1
            
    logger.info(f"Budget reset run for date {today}: Reset {count} departments.")
    return f"Reset {count} budgets."

def expire_delegations_daily():
    """
    Deactivates expired approval delegations.
    Runs daily.
    """
    today = date.today()
    expired = ApprovalDelegation.objects.filter(
        end_date__lt=today,
        is_active=True
    )
    count = expired.update(is_active=False)
    logger.info(f"Deactivated {count} expired approval delegations.")
    return f"Deactivated {count} delegations."

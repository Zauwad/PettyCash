import logging
from celery import shared_task
from django.core.mail import send_mail
from django.db import transaction
from datetime import date
from django.conf import settings

from core.models import Department, ApprovalDelegation

logger = logging.getLogger(__name__)

@shared_task(name="core.tasks.send_email_async")
def send_email_async(subject, message, recipient_list):
    """
    Asynchronously sends an email notification.
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

@shared_task(name="core.tasks.reset_monthly_budgets")
def reset_monthly_budgets():
    """
    Celery Beat task to reset monthly budgets spent totals.
    Runs daily, resetting departments where the current day matches their budget_reset_day.
    """
    today = date.today()
    departments = Department.objects.filter(budget_reset_day=today.day, is_active=True)
    count = 0
    with transaction.atomic():
        for dept in departments:
            dept.budget_spent_this_month = 0.00
            dept.save()
            count += 1
            
    logger.info(f"Monthly budget reset: Reset {count} departments on day {today.day}.")
    return f"Reset {count} budgets."

@shared_task(name="core.tasks.expire_delegations_daily")
def expire_delegations_daily():
    """
    Celery Beat task to deactivate expired approval delegations.
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

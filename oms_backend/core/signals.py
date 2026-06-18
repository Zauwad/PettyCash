import logging
from django.db.models.signals import post_save
from django.dispatch import receiver
from django_fsm.signals import post_transition
from django.utils import timezone

from core.models import AuditLog, Notification, ApprovalDelegation
from core.thread_local import get_current_user
from core.tasks import send_email_async
from accounts.models import UserProfile, UserRole

logger = logging.getLogger(__name__)

def broadcast_to_websocket(group_name, message_type, data):
    """
    WebSocket broadcasts are disabled (Vercel serverless mode).
    """
    pass

@receiver(post_transition)
def log_fsm_transition(sender, instance, name, source, target, **kwargs):
    """
    Automatically creates AuditLog records and in-app Notification records,
    and dispatches Celery email and WebSocket real-time broadcast updates.
    """
    model_name = sender.__name__
    actor = get_current_user()
    
    # Extract organization context
    organization = getattr(instance, 'organization', None)
    if not organization and hasattr(instance, 'requester') and hasattr(instance.requester, 'profile'):
        organization = instance.requester.profile.organization
        
    if not organization:
        return

    # Check if target is rejected/cancelled and get transition-specific reason or comments
    reason = getattr(instance, 'rejection_reason', None) or getattr(instance, 'reason', None)
    
    # Extract amount or duration representation for audit log metadata
    amount_meta = ""
    if hasattr(instance, 'amount_requested'):
        amount_meta = str(instance.amount_requested)
    elif hasattr(instance, 'working_days_requested'):
        amount_meta = f"{instance.working_days_requested} days"

    # 1. Create AuditLog entry
    try:
        AuditLog.objects.create(
            organization=organization,
            actor=actor if (actor and not actor.is_anonymous) else None,
            action=name.upper(),
            target_type=model_name,
            target_id=instance.id,
            old_state=source,
            new_state=target,
            reason=reason if reason else "",
            metadata={
                "amount_or_duration": amount_meta,
                "title": getattr(instance, 'title', f"{model_name} request")
            }
        )
    except Exception as e:
        logger.error(f"Failed to create AuditLog for FSM transition: {e}")

    # 2. Create Notifications, Emails, and WebSockets Broadcasts
    try:
        # Determine deep link URL for notifications
        action_url = ""
        requester = getattr(instance, 'requester', None)
        uuid_val = getattr(instance, 'uuid', instance.id)
        
        if model_name == "PettyCashRequest":
            action_url = f"/petty-cash/{uuid_val}/"
        elif model_name == "LeaveRequest":
            action_url = f"/leave/{uuid_val}/"
            
        recipients = []
            
        # Target state routing
        if target == 'pending_tl_approval':
            # Notify Team Lead(s) of the requester's department
            dept = None
            if requester and hasattr(requester, 'profile'):
                dept = requester.profile.department
            
            if dept:
                team_leads = UserProfile.objects.filter(
                    organization=organization,
                    department=dept,
                    role=UserRole.TEAM_LEAD
                ).select_related('user')
                
                for tl in team_leads:
                    # In-app notification
                    notif = Notification.objects.create(
                        recipient=tl.user,
                        notification_type=Notification.NotificationType.APPROVAL_NEEDED,
                        title="Approval Needed: Petty Cash / Leave Request",
                        message=f"{requester.get_full_name() if requester.get_full_name() else requester.username} submitted a {model_name} for approval.",
                        action_url=action_url
                    )
                    
                    # WebSockets broadcast (realtime delivery)
                    broadcast_to_websocket(
                        f"user_{tl.user.id}",
                        "send_notification",
                        {
                            "id": notif.id,
                            "notification_type": notif.notification_type,
                            "title": notif.title,
                            "message": notif.message,
                            "action_url": notif.action_url,
                            "is_read": False,
                            "created_at": notif.created_at.isoformat()
                        }
                    )

                    # Async Email Notification
                    if tl.user.email:
                        subject = f"OMS: Approval Needed for {model_name}"
                        email_body = (
                            f"Hello {tl.user.get_full_name() or tl.user.username},\n\n"
                            f"{requester.get_full_name() or requester.username} has submitted a new {model_name} for your approval.\n\n"
                            f"Details: {getattr(instance, 'title', '') or getattr(instance, 'reason', '')}\n"
                            f"Amount/Duration: {amount_meta}\n\n"
                            f"Please review the request in the system.\n\n"
                            f"Best regards,\nOMS Team"
                        )
                        send_email_async.delay(subject, email_body, [tl.user.email])
                    
        elif target == 'pending_ceo_approval':
            # Notify CEO(s) of the organization
            ceos = UserProfile.objects.filter(
                organization=organization,
                role=UserRole.CEO
            ).select_related('user')
            
            for ceo in ceos:
                # In-app notification
                notif = Notification.objects.create(
                    recipient=ceo.user,
                    notification_type=Notification.NotificationType.APPROVAL_NEEDED,
                    title="CEO Approval Needed",
                    message=f"{requester.get_full_name() if requester.get_full_name() else requester.username}'s {model_name} has been escalated for CEO approval.",
                    action_url=action_url
                )
                
                # WebSockets broadcast (realtime delivery)
                broadcast_to_websocket(
                    f"user_{ceo.user.id}",
                    "send_notification",
                    {
                        "id": notif.id,
                        "notification_type": notif.notification_type,
                        "title": notif.title,
                        "message": notif.message,
                        "action_url": notif.action_url,
                        "is_read": False,
                        "created_at": notif.created_at.isoformat()
                    }
                )

                # Async Email Notification
                if ceo.user.email:
                    subject = f"OMS: CEO Approval Needed for {model_name}"
                    email_body = (
                        f"Hello {ceo.user.get_full_name() or ceo.user.username},\n\n"
                        f"{requester.get_full_name() or requester.username}'s {model_name} request has been escalated for CEO approval.\n\n"
                        f"Details: {getattr(instance, 'title', '') or getattr(instance, 'reason', '')}\n"
                        f"Amount/Duration: {amount_meta}\n\n"
                        f"Please review the request in the system.\n\n"
                        f"Best regards,\nOMS Team"
                    )
                    send_email_async.delay(subject, email_body, [ceo.user.email])

        elif target == 'pending_gm_approval':
            # Notify GM(s) of the organization
            gms = UserProfile.objects.filter(
                organization=organization,
                role=UserRole.GENERAL_MANAGER
            ).select_related('user')
            
            for gm in gms:
                # In-app notification
                notif = Notification.objects.create(
                    recipient=gm.user,
                    notification_type=Notification.NotificationType.APPROVAL_NEEDED,
                    title="GM Approval Needed",
                    message=f"{requester.get_full_name() if requester.get_full_name() else requester.username}'s {model_name} requires GM approval.",
                    action_url=action_url
                )
                
                # WebSockets broadcast (realtime delivery)
                broadcast_to_websocket(
                    f"user_{gm.user.id}",
                    "send_notification",
                    {
                        "id": notif.id,
                        "notification_type": notif.notification_type,
                        "title": notif.title,
                        "message": notif.message,
                        "action_url": notif.action_url,
                        "is_read": False,
                        "created_at": notif.created_at.isoformat()
                    }
                )

                # Async Email Notification
                if gm.user.email:
                    subject = f"OMS: GM Approval Needed for {model_name}"
                    email_body = (
                        f"Hello {gm.user.get_full_name() or gm.user.username},\n\n"
                        f"{requester.get_full_name() or requester.username}'s {model_name} request requires GM approval.\n\n"
                        f"Details: {getattr(instance, 'title', '') or getattr(instance, 'reason', '')}\n"
                        f"Amount/Duration: {amount_meta}\n\n"
                        f"Please review the request in the system.\n\n"
                        f"Best regards,\nOMS Team"
                    )
                    send_email_async.delay(subject, email_body, [gm.user.email])

        elif target == 'pending_hr_disbursement':
            # Notify HR(s) of the organization
            hrs = UserProfile.objects.filter(
                organization=organization,
                role=UserRole.HR
            ).select_related('user')
            
            for hr in hrs:
                # In-app notification
                notif = Notification.objects.create(
                    recipient=hr.user,
                    notification_type=Notification.NotificationType.APPROVAL_NEEDED,
                    title="Payout Disbursement Pending",
                    message=f"{requester.get_full_name() if requester.get_full_name() else requester.username}'s petty cash request is approved and pending payout.",
                    action_url=action_url
                )
                
                # WebSockets broadcast (realtime delivery)
                broadcast_to_websocket(
                    f"user_{hr.user.id}",
                    "send_notification",
                    {
                        "id": notif.id,
                        "notification_type": notif.notification_type,
                        "title": notif.title,
                        "message": notif.message,
                        "action_url": notif.action_url,
                        "is_read": False,
                        "created_at": notif.created_at.isoformat()
                    }
                )

                # Async Email Notification
                if hr.user.email:
                    subject = f"OMS: Petty Cash Payout Pending"
                    email_body = (
                        f"Hello {hr.user.get_full_name() or hr.user.username},\n\n"
                        f"{requester.get_full_name() or requester.username}'s petty cash request is approved and pending payout.\n\n"
                        f"Details: {getattr(instance, 'title', '') or getattr(instance, 'reason', '')}\n"
                        f"Approved Amount: {amount_meta}\n\n"
                        f"Please review the request in the system.\n\n"
                        f"Best regards,\nOMS Team"
                    )
                    send_email_async.delay(subject, email_body, [hr.user.email])
                
        elif target in ['approved', 'rejected', 'disbursed', 'partially_disbursed']:
            # Notify requester about state change
            if requester:
                name_display = getattr(instance, 'title', f"{model_name} request")
                msg = f"Your request '{name_display}' has been {target}."
                if target == 'rejected' and reason:
                    msg += f" Reason: {reason}"
                    
                # In-app notification
                notif = Notification.objects.create(
                    recipient=requester,
                    notification_type=Notification.NotificationType.STATUS_CHANGED,
                    title=f"Request {target.capitalize()}",
                    message=msg,
                    action_url=action_url
                )
                
                # WebSockets broadcast (realtime delivery)
                broadcast_to_websocket(
                    f"user_{requester.id}",
                    "send_notification",
                    {
                        "id": notif.id,
                        "notification_type": notif.notification_type,
                        "title": notif.title,
                        "message": notif.message,
                        "action_url": notif.action_url,
                        "is_read": False,
                        "created_at": notif.created_at.isoformat()
                    }
                )

                # Async Email Notification
                if requester.email:
                    subject = f"OMS: Your Request has been {target.capitalize()}"
                    email_body = (
                        f"Hello {requester.get_full_name() or requester.username},\n\n"
                        f"Your {model_name} request '{name_display}' state is now updated to: {target.upper()}.\n"
                        f"Amount/Duration: {amount_meta}\n"
                        f"{'Rejection Reason: ' + reason if (target == 'rejected' and reason) else ''}\n\n"
                        f"Best regards,\nOMS Team"
                    )
                    send_email_async.delay(subject, email_body, [requester.email])
                    
        # Broadcast tenant-wide status change event (e.g. for dashboard updates)
        broadcast_to_websocket(
            f"org_{organization.slug}",
            "send_status_update",
            {
                "model": model_name,
                "id": instance.id,
                "uuid": str(uuid_val),
                "old_state": source,
                "new_state": target,
                "actor": actor.username if actor else "System",
                "updated_at": timezone.now().isoformat()
            }
        )
    except Exception as e:
        logger.error(f"Failed to create Notifications/Emails/WebSocket updates: {e}")


@receiver(post_save, sender=ApprovalDelegation)
def handle_delegation_created(sender, instance, created, **kwargs):
    """
    Triggers when an ApprovalDelegation is created.
    Sends in-app and email notifications, and broadcasts to delegate's WebSocket.
    """
    if created:
        delegator_name = instance.delegator.get_full_name() or instance.delegator.username
        delegate_name = instance.delegate.get_full_name() or instance.delegate.username
        
        # 1. Create in-app notification
        notif = Notification.objects.create(
            recipient=instance.delegate,
            notification_type=Notification.NotificationType.DELEGATION_GRANTED,
            title="Approval Delegation Granted",
            message=f"{delegator_name} delegated approval authority to you.",
            action_url="/delegation/"
        )
        
        # 2. WebSocket broadcast to delegate
        broadcast_to_websocket(
            f"user_{instance.delegate.id}",
            "send_notification",
            {
                "id": notif.id,
                "notification_type": notif.notification_type,
                "title": notif.title,
                "message": notif.message,
                "action_url": notif.action_url,
                "is_read": False,
                "created_at": notif.created_at.isoformat()
            }
        )
        
        # 3. Trigger async email via Celery
        if instance.delegate.email:
            subject = "OMS: Approval Authority Delegated to You"
            email_body = (
                f"Hello {delegate_name},\n\n"
                f"{delegator_name} has delegated their approval authority to you "
                f"for scope '{instance.scope}' from {instance.start_date} to {instance.end_date}.\n\n"
                f"Reason: {instance.reason or 'No reason provided'}\n\n"
                f"Please check the system to view delegated items.\n\n"
                f"Best regards,\nOMS Team"
            )
            send_email_async.delay(subject, email_body, [instance.delegate.email])


@receiver(post_save, sender='pettycash.PettyCashRequest')
@receiver(post_save, sender='leave.LeaveRequest')
def log_request_creation(sender, instance, created, **kwargs):
    """
    Auto-log request creation so history starts with a 'CREATED' entry.
    """
    if not created:
        return
        
    model_name = sender.__name__
    actor = get_current_user() or getattr(instance, 'requester', None)
    
    organization = getattr(instance, 'organization', None)
    if not organization and hasattr(instance, 'requester') and hasattr(instance.requester, 'profile'):
        organization = instance.requester.profile.organization
        
    if not organization:
        return

    amount_meta = ""
    if hasattr(instance, 'amount_requested'):
        amount_meta = str(instance.amount_requested)
    elif hasattr(instance, 'working_days_requested'):
        amount_meta = f"{instance.working_days_requested} days"

    try:
        AuditLog.objects.create(
            organization=organization,
            actor=actor if (actor and not actor.is_anonymous) else None,
            action="CREATED",
            target_type=model_name,
            target_id=instance.id,
            old_state="",
            new_state="draft",
            reason="",
            metadata={
                "amount_or_duration": amount_meta,
                "title": getattr(instance, 'title', f"{model_name} request")
            }
        )
    except Exception as e:
        logger.error(f"Failed to create AuditLog for request creation: {e}")


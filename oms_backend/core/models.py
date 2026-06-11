from django.db import models

# Create your models here.

class Organization(models.Model):
    """
    Represents a tenant organization (e.g., A Maze Venture, mYnt Connect, Braincount).
    Each organization gets its own theme, custom styling, colors, and policy configurations.
    """
    name = models.CharField(max_length=100, help_text="e.g. A Maze Venture | mYnt Connect | Braincount")
    slug = models.CharField(max_length=20, unique=True, help_text="e.g. amaze | mynt | braincount")
    logo_url = models.CharField(max_length=500, blank=True, null=True)
    primary_color = models.CharField(max_length=7, default="#HEX")
    secondary_color = models.CharField(max_length=7, default="#HEX")
    theme_name = models.CharField(max_length=20, default="amaze", help_text="Theme class corresponding to DaisyUI theme")
    
    # Store company-specific policies (e.g. max_carry_forward_days, allow_negative_sick_leave)
    policy_config = models.JSONField(
        default=dict,
        blank=True,
        help_text="Configurable company policies like leave carry-overs and negative leaves."
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class Department(models.Model):
    """
    Scoping container inside an Organization.
    Controls budgets and team-level approval thresholds.
    """
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="departments",
        help_text="The organization this department belongs to"
    )
    name = models.CharField(max_length=100)
    monthly_budget = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0.00,
        help_text="Monthly budget in BDT (৳)"
    )
    budget_spent_this_month = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0.00,
        help_text="Running total of spending this month in BDT (৳)"
    )
    budget_reset_day = models.PositiveIntegerField(
        default=1,
        help_text="Day of the month to reset the budget spent to zero"
    )
    tl_approval_limit = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=10000.00,
        help_text="Max limit before routing to CEO approval in BDT (৳)"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.organization.name} - {self.name}"

class AuditLog(models.Model):
    """
    Unified Audit trail logs for tracing status transitions, actions,
    and field changes on domain objects.
    """
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="audit_logs"
    )
    actor = models.ForeignKey(
        "auth.User",
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="audit_actions",
        help_text="User who triggered this action"
    )
    action = models.CharField(
        max_length=50,
        help_text="e.g. CREATED | SUBMITTED | APPROVED | REJECTED | DISBURSED | CANCELLED"
    )
    target_type = models.CharField(
        max_length=100,
        help_text="Name of the model class (e.g. PettyCashRequest | LeaveRequest)"
    )
    target_id = models.PositiveIntegerField(
        help_text="Primary key of the affected target object"
    )
    old_state = models.CharField(max_length=50, blank=True, null=True)
    new_state = models.CharField(max_length=50, blank=True, null=True)
    reason = models.TextField(blank=True, null=True, help_text="Free text explanation")
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Extra details (e.g. amount, acted_as_delegate, IP)"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.target_type} #{self.target_id} - {self.action} by {self.actor.username if self.actor else 'System'}"


class ApprovalDelegation(models.Model):
    """
    Out-Of-Office (OOO) Approval Delegation records.
    Allows TL/CEO to delegate approval authority to a peer during OOO period.
    """
    class Scope(models.TextChoices):
        PETTY_CASH = "PETTY_CASH", "Petty Cash"
        LEAVE = "LEAVE", "Leave"
        ALL = "ALL", "All Scope"

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="delegations"
    )
    delegator = models.ForeignKey(
        "auth.User",
        on_delete=models.CASCADE,
        related_name="outgoing_delegations",
        help_text="Person going OOO"
    )
    delegate = models.ForeignKey(
        "auth.User",
        on_delete=models.CASCADE,
        related_name="incoming_delegations",
        help_text="Colleague receiving temporary authority"
    )
    scope = models.CharField(
        max_length=20,
        choices=Scope.choices,
        default=Scope.ALL
    )
    start_date = models.DateField()
    end_date = models.DateField()
    is_active = models.BooleanField(
        default=True,
        help_text="Must be set to False after OOO end_date passes"
    )
    reason = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.delegator.username} -> {self.delegate.username} ({self.scope})"


class Notification(models.Model):
    """
    In-app notification records for dashboard delivery.
    """
    class NotificationType(models.TextChoices):
        APPROVAL_NEEDED = "APPROVAL_NEEDED", "Approval Needed"
        STATUS_CHANGED = "STATUS_CHANGED", "Status Changed"
        DELEGATION_GRANTED = "DELEGATION_GRANTED", "Delegation Granted"
        BUDGET_WARNING = "BUDGET_WARNING", "Budget Warning"

    recipient = models.ForeignKey(
        "auth.User",
        on_delete=models.CASCADE,
        related_name="notifications"
    )
    notification_type = models.CharField(
        max_length=50,
        choices=NotificationType.choices
    )
    title = models.CharField(max_length=200)
    message = models.TextField()
    action_url = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Relative frontend route deep link (e.g. /petty-cash/123/)"
    )
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.recipient.username} - {self.title} (Read: {self.is_read})"


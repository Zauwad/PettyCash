import uuid
from django.db import models
from django.contrib.auth.models import User
from django_fsm import FSMField, transition
from django.core.exceptions import ValidationError
from core.models import Organization

class HalfDayPeriod(models.TextChoices):
    MORNING = "MORNING", "Morning"
    AFTERNOON = "AFTERNOON", "Afternoon"


class LeaveType(models.Model):
    """
    Defines kinds of leave (e.g. Annual, Sick, Maternity) scoped per Organization.
    """
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="leave_types"
    )
    name = models.CharField(max_length=50)
    code = models.CharField(max_length=20, help_text="e.g. ANNUAL | SICK | MATERNITY")
    default_days_per_year = models.PositiveIntegerField(default=24)
    allow_negative_balance = models.BooleanField(
        default=False,
        help_text="Whether company policy allows requesting leave days beyond available balance"
    )
    requires_attachment = models.BooleanField(
        default=False,
        help_text="E.g., sick leave > 2 days requires doctor's note upload"
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('organization', 'code')

    def __str__(self):
        return f"{self.organization.slug} - {self.name}"


class LeaveBalance(models.Model):
    """
    Leave balance allocations per User and LeaveType per calendar Year.
    """
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="leave_balances"
    )
    leave_type = models.ForeignKey(
        LeaveType,
        on_delete=models.CASCADE,
        related_name="leave_balances"
    )
    year = models.PositiveIntegerField()
    total_allocated = models.DecimalField(max_digits=5, decimal_places=1, default=15.0)
    used = models.DecimalField(max_digits=5, decimal_places=1, default=0.0)
    pending = models.DecimalField(max_digits=5, decimal_places=1, default=0.0)
    available = models.DecimalField(max_digits=5, decimal_places=1, default=15.0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'leave_type', 'year')

    def save(self, *args, **kwargs):
        # Auto-compute availability
        self.available = self.total_allocated - self.used - self.pending
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user.username} - {self.leave_type.name} (Year {self.year}): Available {self.available} days"


class LeaveRequest(models.Model):
    """
    Individual leave request with workflow state.
    Excludes weekends and holidays in its working days calculations.
    """
    uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="leave_requests"
    )
    requester = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="leave_requests"
    )
    leave_type = models.ForeignKey(
        LeaveType,
        on_delete=models.CASCADE,
        related_name="leave_requests"
    )
    start_date = models.DateField()
    end_date = models.DateField()
    working_days_requested = models.DecimalField(max_digits=5, decimal_places=1)
    
    is_half_day = models.BooleanField(default=False)
    half_day_period = models.CharField(
        max_length=15,
        choices=HalfDayPeriod.choices,
        blank=True,
        null=True
    )
    reason = models.TextField()
    
    # FSM State management
    state = FSMField(
        default='draft',
        help_text="Current approval state of the leave request"
    )
    
    rejection_reason = models.TextField(blank=True, null=True)
    tl_approval_note = models.TextField(blank=True, null=True)
    gm_approval_note = models.TextField(blank=True, null=True)
    ceo_approval_note = models.TextField(blank=True, null=True)
    tl_approved_start_date = models.DateField(blank=True, null=True)
    tl_approved_end_date = models.DateField(blank=True, null=True)
    gm_approved_start_date = models.DateField(blank=True, null=True)
    gm_approved_end_date = models.DateField(blank=True, null=True)

    delegate_to = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="delegated_leaves",
        help_text="Colleague covering duties during absence"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.requester.username} - {self.leave_type.name} ({self.working_days_requested} days): {self.state}"

    # FSM Transitions

    @transition(field=state, source='draft', target='pending_tl_approval')
    def submit(self):
        """
        Submits the leave request. Validates leave type requirements.
        """
        if self.working_days_requested <= 0:
            raise ValidationError("Leave duration must be greater than zero working days.")
            
        # Ensure start_date is before or equal to end_date
        if self.start_date > self.end_date:
            raise ValidationError("Start date cannot be after end date.")

        # Validate requires_attachment
        if self.leave_type.requires_attachment:
            if not self.attachments.exists():
                raise ValidationError(f"An attachment/receipt is required for {self.leave_type.name} leave requests.")

    @transition(field=state, source='pending_tl_approval', target='pending_gm_approval')
    def tl_approve(self, start_date, end_date, note):
        """
        Approved and potentially modified by Team Lead, routes to GM.
        """
        if not note or not note.strip():
            raise ValidationError("An approval note is required.")
        self.tl_approved_start_date = start_date
        self.tl_approved_end_date = end_date
        self.tl_approval_note = note
        self.reason = note
        
        self.start_date = start_date
        self.end_date = end_date
        from leave.utils import calculate_working_days
        self.working_days_requested = calculate_working_days(self.organization, start_date, end_date)

    @transition(field=state, source='pending_gm_approval', target='approved')
    def gm_approve(self, start_date, end_date, note):
        """
        Approved and potentially modified by GM.
        """
        if not note or not note.strip():
            raise ValidationError("An approval note is required.")
        self.gm_approved_start_date = start_date
        self.gm_approved_end_date = end_date
        self.gm_approval_note = note
        self.reason = note
        
        self.start_date = start_date
        self.end_date = end_date
        from leave.utils import calculate_working_days
        self.working_days_requested = calculate_working_days(self.organization, start_date, end_date)

    @transition(field=state, source=['draft', 'pending_tl_approval', 'pending_gm_approval'], target='approved')
    def ceo_direct_approve(self, note):
        """
        Superpower approval by CEO directly.
        """
        if not note or not note.strip():
            raise ValidationError("An approval note is required.")
        self.ceo_approval_note = note
        self.reason = note

    @transition(field=state, source=['pending_tl_approval', 'pending_gm_approval'], target='rejected')
    def reject(self, reason):
        """
        Rejects the request, requiring a reason.
        """
        if not reason or not reason.strip():
            raise ValidationError("A rejection reason is required.")
        self.rejection_reason = reason
        self.reason = reason

    @transition(field=state, source='rejected', target='draft')
    def amend(self):
        """
        Resets request to draft state for modifications.
        """
        self.rejection_reason = None

    @transition(field=state, source=['draft', 'pending_tl_approval', 'pending_gm_approval', 'approved'], target='cancelled')
    def cancel(self):
        """
        Cancels the leave request. Reverts deducted balance days.
        """
        pass


class CompanyHoliday(models.Model):
    """
    Company-defined holidays for calculating working days exclusion.
    """
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="company_holidays"
    )
    name = models.CharField(max_length=100)
    holiday_date = models.DateField()
    is_recurring = models.BooleanField(
        default=False,
        help_text="If True, holiday repeats annually (day and month are static)"
    )
    year = models.PositiveIntegerField(
        blank=True,
        null=True,
        help_text="Specific calendar year for one-off holidays"
    )

    class Meta:
        unique_together = ('organization', 'holiday_date', 'year')

    def __str__(self):
        return f"{self.organization.slug} - {self.name} ({self.holiday_date})"

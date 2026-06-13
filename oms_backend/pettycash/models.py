import uuid
from django.db import models
from django.contrib.auth.models import User
from django_fsm import FSMField, transition, RETURN_VALUE
from django.core.exceptions import ValidationError
from core.models import Organization, Department

class RequestPriority(models.TextChoices):
    LOW = "LOW", "Low"
    MEDIUM = "MEDIUM", "Medium"
    HIGH = "HIGH", "High"
    URGENT = "URGENT", "Urgent"


class PettyCashRequest(models.Model):
    """
    Model representing a Petty Cash Requisition request.
    Uses django-fsm to enforce strict state transitions and business logic.
    """
    uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="petty_cash_requests"
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        related_name="petty_cash_requests"
    )
    requester = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="petty_cash_requests"
    )
    title = models.CharField(max_length=200)
    description = models.TextField()
    amount_requested = models.DecimalField(max_digits=12, decimal_places=2)
    amount_approved = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    amount_disbursed = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    
    # FSM State management
    state = FSMField(
        default='draft',
        help_text="Current approval state of the request"
    )
    
    priority = models.CharField(
        max_length=10,
        choices=RequestPriority.choices,
        default=RequestPriority.MEDIUM
    )
    needed_by = models.DateField()
    rejection_reason = models.TextField(blank=True, null=True)
    
    tl_approval_note = models.TextField(blank=True, null=True)
    ceo_approval_note = models.TextField(blank=True, null=True)
    hr_disbursement_note = models.TextField(blank=True, null=True)
    tl_approved_amount = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    tl_approved_needed_by = models.DateField(blank=True, null=True)
    ceo_approved_amount = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    ceo_approved_needed_by = models.DateField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} (৳{self.amount_requested}) - {self.state}"

    # FSM Transitions
    
    @transition(field=state, source='draft', target='pending_tl_approval')
    def submit(self):
        """
        Validates budget availability before allowing request submission.
        """
        dept = self.department
        remaining = dept.monthly_budget - dept.budget_spent_this_month
        if self.amount_requested > remaining:
            raise ValidationError(
                f"Request amount (৳{self.amount_requested}) exceeds remaining "
                f"department budget (৳{remaining})."
            )

    @transition(field=state, source='pending_tl_approval', target='pending_ceo_approval')
    def tl_approve(self, amount, needed_by, priority, note):
        """
        TL approves and potentially edits the request. Routes to CEO.
        """
        if not note or not note.strip():
            raise ValidationError("An approval note is required.")
        self.tl_approved_amount = amount
        self.tl_approved_needed_by = needed_by
        self.tl_approval_note = note
        self.reason = note
        
        self.amount_approved = amount
        self.needed_by = needed_by
        self.priority = priority

    @transition(field=state, source='pending_ceo_approval', target='pending_hr_disbursement')
    def ceo_approve(self, amount, needed_by, note):
        """
        CEO approves the request. Routes to HR disbursement.
        """
        if not note or not note.strip():
            raise ValidationError("An approval note is required.")
        self.ceo_approved_amount = amount
        self.ceo_approved_needed_by = needed_by
        self.ceo_approval_note = note
        self.reason = note
        
        self.amount_approved = amount
        self.needed_by = needed_by

    @transition(field=state, source=['draft', 'pending_tl_approval', 'pending_ceo_approval'], target='pending_hr_disbursement')
    def ceo_direct_approve(self, amount, note):
        """
        CEO direct superpower approval.
        """
        if not note or not note.strip():
            raise ValidationError("An approval note is required.")
        self.ceo_approved_amount = amount
        self.ceo_approval_note = note
        self.reason = note
        self.amount_approved = amount

    @transition(field=state, source='pending_ceo_approval', target='rejected_by_ceo')
    def ceo_reject(self, reason):
        """
        CEO rejects the request. Sent back to employee.
        """
        if not reason or not reason.strip():
            raise ValidationError("A rejection reason is required.")
        self.rejection_reason = reason
        self.reason = reason

    @transition(field=state, source='rejected_by_ceo', target='pending_ceo_approval')
    def employee_resubmit(self, amount, needed_by):
        """
        Employee edits and resubmits directly to CEO.
        """
        self.amount_requested = amount
        self.needed_by = needed_by
        self.amount_approved = 0.00
        self.rejection_reason = None
        
        dept = self.department
        remaining = dept.monthly_budget - dept.budget_spent_this_month
        if self.amount_requested > remaining:
            raise ValidationError(
                f"Request amount (৳{self.amount_requested}) exceeds remaining "
                f"department budget (৳{remaining})."
            )

    @transition(field=state, source='pending_tl_approval', target='rejected')
    def tl_reject(self, reason):
        """
        TL rejects the request.
        """
        if not reason or not reason.strip():
            raise ValidationError("A rejection reason is required.")
        self.rejection_reason = reason
        self.reason = reason

    @transition(field=state, source='rejected', target='draft')
    def amend(self):
        """
        Resets request to draft for employee correction.
        """
        self.rejection_reason = None
        self.amount_approved = 0.00

    @transition(field=state, source=['draft', 'pending_tl_approval', 'pending_ceo_approval', 'rejected_by_ceo'], target='cancelled')
    def cancel(self):
        """
        Cancels the request.
        """
        pass

    @transition(
        field=state,
        source=['pending_hr_disbursement', 'partially_disbursed'],
        target=RETURN_VALUE('partially_disbursed', 'disbursed')
    )
    def hr_disburse(self, amount, note):
        """
        HR disburses the request.
        """
        if not note or not note.strip():
            raise ValidationError("A disbursement note is required.")
        from decimal import Decimal
        self.amount_disbursed = self.amount_disbursed + Decimal(str(amount))
        self.hr_disbursement_note = note
        self.reason = note
        if self.amount_disbursed >= self.amount_approved:
            return 'disbursed'
        return 'partially_disbursed'


class PettyCashLineItem(models.Model):
    """
    Sub-details of a PettyCashRequest to itemize costs.
    """
    request = models.ForeignKey(
        PettyCashRequest,
        on_delete=models.CASCADE,
        related_name="line_items"
    )
    description = models.CharField(max_length=200)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    total_price = models.DecimalField(max_digits=12, decimal_places=2)
    category = models.CharField(max_length=100, help_text="e.g. Office Supplies | Travel | Equipment")

    def save(self, *args, **kwargs):
        # Calculate total price before saving
        self.total_price = self.quantity * self.unit_price
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.description} ({self.quantity} x ৳{self.unit_price})"


class Attachment(models.Model):
    """
    Stores receipt uploads directly in the SQL database (BLOB) to support 'cloud in sql'.
    """
    request = models.ForeignKey(
        PettyCashRequest,
        on_delete=models.CASCADE,
        related_name="attachments",
        blank=True,
        null=True
    )
    # Lazy reference to LeaveRequest to avoid circular dependency
    leave_request = models.ForeignKey(
        'leave.LeaveRequest',
        on_delete=models.CASCADE,
        related_name="attachments",
        blank=True,
        null=True
    )
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="attachments"
    )
    
    # Binary file contents stored in SQL database
    file_data = models.BinaryField(
        help_text="Raw binary contents of the uploaded receipt file"
    )
    original_filename = models.CharField(max_length=255)
    content_type = models.CharField(max_length=100, help_text="e.g. application/pdf | image/jpeg")
    file_size_bytes = models.BigIntegerField()
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.original_filename


class Disbursement(models.Model):
    """
    Disbursement record created when Accounts payouts occur.
    """
    request = models.ForeignKey(
        PettyCashRequest,
        on_delete=models.CASCADE,
        related_name="disbursements"
    )
    disbursed_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="disbursed_payments"
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(
        max_length=50,
        default="CASH",
        help_text="CASH | BANK_TRANSFER | CHEQUE"
    )
    reference_number = models.CharField(max_length=100, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    disbursed_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"৳{self.amount} disbursed for request {self.request.id}"

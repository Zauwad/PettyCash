from decimal import Decimal
from rest_framework import serializers
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError as DjangoValidationError
from core.models import Organization, Department
from accounts.serializers import UserSerializer
from leave.models import LeaveType, LeaveBalance, LeaveRequest, CompanyHoliday
from leave.utils import calculate_working_days, check_overlap, check_negative_balance

class LeaveTypeSerializer(serializers.ModelSerializer):
    """
    Serializer for configurations of leave categories.
    """
    class Meta:
        model = LeaveType
        fields = ['id', 'name', 'code', 'default_days_per_year', 'allow_negative_balance', 'requires_attachment', 'is_active']


class LeaveBalanceSerializer(serializers.ModelSerializer):
    """
    Serializer for representing leave balance details for a user.
    """
    leave_type_details = LeaveTypeSerializer(source='leave_type', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = LeaveBalance
        fields = ['id', 'username', 'leave_type', 'leave_type_details', 'year', 'total_allocated', 'used', 'pending', 'available']
        read_only_fields = ['available', 'used', 'pending']


class CompanyHolidaySerializer(serializers.ModelSerializer):
    """
    Serializer for company defined holidays.
    """
    class Meta:
        model = CompanyHoliday
        fields = ['id', 'name', 'holiday_date', 'is_recurring', 'year']


class LeaveRequestSerializer(serializers.ModelSerializer):
    """
    Serializer for LeaveRequest model.
    Runs automated validation for overlaps, holiday exclusions, and negative balances.
    """
    from pettycash.serializers import AttachmentSerializer
    requester_name = serializers.CharField(source='requester.get_full_name', read_only=True)
    leave_type_details = LeaveTypeSerializer(source='leave_type', read_only=True)
    delegate_name = serializers.CharField(source='delegate_to.get_full_name', read_only=True)
    attachments = AttachmentSerializer(many=True, read_only=True)
    
    leave_type_id = serializers.PrimaryKeyRelatedField(
        queryset=LeaveType.objects.all(),
        source='leave_type',
        write_only=True
    )
    delegate_to_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='delegate_to',
        required=False,
        allow_null=True,
        write_only=True
    )

    activity_log = serializers.SerializerMethodField()

    class Meta:
        model = LeaveRequest
        fields = [
            'id', 'uuid', 'start_date', 'end_date', 'working_days_requested', 
            'is_half_day', 'half_day_period', 'reason', 'state', 'rejection_reason', 
            'tl_approval_note', 'gm_approval_note', 'ceo_approval_note',
            'tl_approved_start_date', 'tl_approved_end_date',
            'gm_approved_start_date', 'gm_approved_end_date',
            'requester_name', 'leave_type_details', 'leave_type_id', 
            'delegate_name', 'delegate_to_id', 'created_at', 'updated_at',
            'activity_log', 'attachments'
        ]
        read_only_fields = [
            'uuid', 'working_days_requested', 'state', 'rejection_reason',
            'tl_approval_note', 'gm_approval_note', 'ceo_approval_note',
            'tl_approved_start_date', 'tl_approved_end_date',
            'gm_approved_start_date', 'gm_approved_end_date',
            'created_at', 'updated_at', 'activity_log', 'attachments'
        ]

    def get_activity_log(self, obj):
        # Skip fetching activity logs on list action to avoid N+1 queries
        view = self.context.get('view')
        if view and getattr(view, 'action', None) == 'list':
            return []

        from core.models import AuditLog
        from core.serializers import AuditLogSerializer
        logs = AuditLog.objects.filter(target_type='LeaveRequest', target_id=obj.id).order_by('created_at')
        return AuditLogSerializer(logs, many=True).data

    def validate(self, attrs):
        request = self.context.get('request')
        user = request.user if request else None
        
        # Get start/end dates
        start_date = attrs.get('start_date')
        end_date = attrs.get('end_date')
        is_half_day = attrs.get('is_half_day', False)
        leave_type = attrs.get('leave_type')
        
        # In partial updates, load defaults from the instance if fields are omitted
        if self.instance:
            start_date = start_date or self.instance.start_date
            end_date = end_date or self.instance.end_date
            is_half_day = is_half_day if 'is_half_day' in attrs else self.instance.is_half_day
            leave_type = leave_type or self.instance.leave_type
            user = user or self.instance.requester
            
        if not user:
            raise serializers.ValidationError("Requester is required.")

        if start_date > end_date:
            raise serializers.ValidationError({"end_date": "End date cannot be before start date."})

        # Calculate working days requested
        if is_half_day:
            # Half-day requests always count as exactly 0.5 days
            working_days = Decimal('0.5')
            # Ensure start and end dates are the same for half day
            if start_date != end_date:
                raise serializers.ValidationError({"end_date": "Start date and End date must be identical for half-day requests."})
            
            # Check if half-day period is specified
            half_day_period = attrs.get('half_day_period')
            if not self.instance and not half_day_period:
                raise serializers.ValidationError({"half_day_period": "Half-day period (MORNING/AFTERNOON) is required."})
        else:
            org = user.profile.organization
            working_days = calculate_working_days(org, start_date, end_date)
            
        if working_days <= 0:
            raise serializers.ValidationError("Leave period contains no working days (only weekends or holidays).")

        # Run overlap validator
        exclude_id = self.instance.id if self.instance else None
        try:
            check_overlap(user, start_date, end_date, exclude_id)
        except DjangoValidationError as e:
            raise serializers.ValidationError({"dates": str(e.message if hasattr(e, 'message') else e)})

        # Run negative balance check
        try:
            check_negative_balance(user, leave_type, working_days, start_date.year)
        except DjangoValidationError as e:
            raise serializers.ValidationError({"balance": str(e.message if hasattr(e, 'message') else e)})

        # Store calculated working days inside validated attrs to save directly in DB
        attrs['working_days_requested'] = working_days
        
        return attrs


class WorkingDaysCalcSerializer(serializers.Serializer):
    """
    Serializer to receive and validate inputs for live working days calculations.
    """
    start_date = serializers.DateField()
    end_date = serializers.DateField()

    def validate(self, attrs):
        if attrs['start_date'] > attrs['end_date']:
            raise serializers.ValidationError("Start date cannot be after end date.")
        return attrs

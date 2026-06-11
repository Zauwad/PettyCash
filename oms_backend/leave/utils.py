import holidays
from datetime import timedelta
from django.core.exceptions import ValidationError
from leave.models import CompanyHoliday

def calculate_working_days(organization, start_date, end_date):
    """
    Calculates actual working days between start_date and end_date (inclusive).
    Excludes standard Bangladesh weekends (Friday and Saturday),
    official Bangladesh government holidays, and organization-defined custom holidays.
    """
    # Load Bangladesh public holidays for the relevant years
    years = list(set([start_date.year, end_date.year]))
    bd_holidays = holidays.Bangladesh(years=years)
    
    # Fetch tenant-specific company holidays
    company_holiday_dates = set(
        CompanyHoliday.objects.filter(
            organization=organization,
            holiday_date__range=(start_date, end_date)
        ).values_list('holiday_date', flat=True)
    )
    
    total_working_days = 0
    current_date = start_date
    
    while current_date <= end_date:
        # Bangladesh weekends are Friday (4) and Saturday (5)
        is_weekend = current_date.weekday() in [4, 5]
        
        # Check if current_date is a public holiday or company holiday
        is_holiday = (current_date in bd_holidays) or (current_date in company_holiday_dates)
        
        if not is_weekend and not is_holiday:
            total_working_days += 1
            
        current_date += timedelta(days=1)
        
    return total_working_days

def check_overlap(user, start_date, end_date, exclude_request_id=None):
    """
    Checks if a user has any existing overlapping leave requests.
    Excludes drafts and cancelled/rejected requests.
    """
    from leave.models import LeaveRequest
    
    overlapping = LeaveRequest.objects.filter(
        requester=user,
        state__in=['pending_tl_approval', 'pending_ceo_approval', 'approved'],
        start_date__lte=end_date,
        end_date__gte=start_date,
    )
    
    if exclude_request_id:
        overlapping = overlapping.exclude(id=exclude_request_id)
        
    if overlapping.exists():
        conflicts = list(overlapping.values_list('start_date', 'end_date', 'state'))
        raise ValidationError(
            f"Overlapping leave request found: {conflicts}."
        )

def check_negative_balance(user, leave_type, working_days_requested, year):
    """
    Verifies if a user has sufficient leave balance.
    Enforces the negative balance policies based on leave type configuration
    and organization policy_config.
    """
    from leave.models import LeaveBalance
    
    # Get or create current year balance for safety
    balance, _ = LeaveBalance.objects.get_or_create(
        user=user,
        leave_type=leave_type,
        year=year,
        defaults={
            'total_allocated': leave_type.default_days_per_year,
            'used': 0.0,
            'pending': 0.0,
            'available': leave_type.default_days_per_year
        }
    )
    
    available = balance.total_allocated - balance.used - balance.pending
    
    if working_days_requested > available:
        org = user.profile.organization
        policy = org.policy_config
        
        # If leave type explicitly allows negative balances, or if it is SICK leave
        # and organization policy allows negative sick leaves
        allow_neg = leave_type.allow_negative_balance or (
            leave_type.code == 'SICK' and policy.get('allow_negative_sick_leave', False)
        )
        
        if not allow_neg:
            raise ValidationError(
                f"Insufficient {leave_type.name} balance. "
                f"Available: {available} days. Requested: {working_days_requested} days."
            )
            
    return True

from datetime import date
from accounts.models import UserRole, UserProfile
from core.models import ApprovalDelegation

def is_authorized_approver(user, request_obj, scope):
    """
    Checks if a user is authorized to approve/reject the given PettyCashRequest or LeaveRequest.
    Considers the user's role and any active approval delegations for the current date.
    
    Scopes: 'PETTY_CASH' or 'LEAVE'.
    """
    # Safety checks
    if not user or user.is_anonymous:
        return False
        
    try:
        profile = user.profile
    except Exception:
        return False
        
    role = profile.role
    
    # Admins bypass checks and can approve/reject any request
    if role == UserRole.ADMIN:
        return True
        
    organization = request_obj.organization
    
    # Must belong to the same tenant organization
    if profile.organization != organization:
        return False
        
    # Get active delegators who have currently delegated their authority to this user
    today = date.today()
    delegator_ids = list(ApprovalDelegation.objects.filter(
        delegate=user,
        scope__in=[scope, 'ALL'],
        start_date__lte=today,
        end_date__gte=today,
        is_active=True
    ).values_list('delegator_id', flat=True))
    
    # Helper to check if user acts as a certain role (either directly or via delegation)
    def acts_as_role(target_role):
        if role == target_role:
            return True
        return UserProfile.objects.filter(user_id__in=delegator_ids, role=target_role).exists()
        
    # The actual requester can never approve their own request, even if they are a TL or CEO
    requester = getattr(request_obj, 'requester', None)
    if requester == user:
        return False
        
    state = request_obj.state
    
    # CEO superpower: Can approve directly from draft, pending_tl_approval, or pending_gm_approval/pending_ceo_approval
    if acts_as_role(UserRole.CEO):
        if state in ['draft', 'pending_tl_approval', 'pending_gm_approval', 'pending_ceo_approval']:
            return True

    # State-based routing
    if state == 'draft':
        return False

    elif state == 'pending_tl_approval':
        # Identify the department of the request
        req_dept = getattr(request_obj, 'department', None)
        if not req_dept and requester and hasattr(requester, 'profile'):
            req_dept = requester.profile.department
            
        if req_dept:
            # Direct Team Lead of the department
            if role == UserRole.TEAM_LEAD and profile.department == req_dept:
                return True
            # Delegated Team Lead of the department
            if UserProfile.objects.filter(user_id__in=delegator_ids, role=UserRole.TEAM_LEAD, department=req_dept).exists():
                return True

    elif state == 'pending_gm_approval' and scope == 'LEAVE':
        if acts_as_role(UserRole.GENERAL_MANAGER):
            return True

    elif state == 'pending_ceo_approval' and scope == 'PETTY_CASH':
        if acts_as_role(UserRole.CEO):
            return True

    elif state in ['pending_hr_disbursement', 'partially_disbursed'] and scope == 'PETTY_CASH':
        if acts_as_role(UserRole.HR):
            return True
            
    return False

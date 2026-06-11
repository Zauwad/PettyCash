from rest_framework import permissions
from accounts.models import UserRole
from core.models import Organization

class IsOrganizationMember(permissions.BasePermission):
    """
    DRF Permission Class to enforce tenancy scoping.
    
    Acts as Layer 3 isolation:
    1. Checks if the object has an 'organization' attribute and verifies it matches request.organization.
    2. Allows Global Admins to bypass check.
    """
    def has_permission(self, request, view):
        # User must be authenticated to access scoped views
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or user.is_anonymous:
            return False
            
        if hasattr(user, 'profile'):
            profile = user.profile
            
            # Global Admin bypasses all tenancy restrictions
            if profile.role == UserRole.ADMIN:
                return True
                
            # If the object itself is an Organization, match directly
            if isinstance(obj, Organization):
                return obj == profile.organization
                
            # If the object belongs to an organization, check ownership
            if hasattr(obj, 'organization'):
                return obj.organization == profile.organization
                
            # If the object has a profile with organization (e.g. User model)
            if hasattr(obj, 'profile') and hasattr(obj.profile, 'organization'):
                return obj.profile.organization == profile.organization
                
        return False


class IsCEOOrAdmin(permissions.BasePermission):
    """
    DRF Permission Class to restrict access to CEOs and Admins.
    """
    def has_permission(self, request, view):
        user = request.user
        if user and user.is_authenticated:
            if hasattr(user, 'profile'):
                return user.profile.role in [UserRole.CEO, UserRole.ADMIN]
        return False

from rest_framework import serializers
from accounts.models import UserRole

class OrganizationViewSetMixin:
    """
    Mixin for tenant-scoped DRF ViewSets.
    
    Acts as Layer 2 isolation:
    1. get_queryset(): Auto-filters the queryset to only include items belonging to
       the user's organization. Admins can bypass this and filter by '?org=<id>'.
    2. perform_create(): Auto-assigns organization to the created model instance.
    """
    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        
        # Guard clause for safety
        if not user or user.is_anonymous:
            return queryset.none()
            
        # Check user profile and role
        if hasattr(user, 'profile'):
            profile = user.profile
            filter_path = getattr(self, 'tenant_filter_path', 'organization')
            
            # Admin role bypasses organization scoping, can see all or query by organization ID
            if profile.role == UserRole.ADMIN:
                org_id = self.request.query_params.get('org')
                if org_id:
                    # Construct the filter field name dynamically (e.g., 'profile__organization_id')
                    if '__' in filter_path:
                        parts = filter_path.split('__')
                        parts[-1] = f"{parts[-1]}_id"
                        admin_filter = '__'.join(parts)
                    else:
                        admin_filter = f"{filter_path}_id"
                    return queryset.filter(**{admin_filter: org_id})
                return queryset
            
            # Scoped to regular user's organization
            if profile.organization:
                return queryset.filter(**{filter_path: profile.organization})
            
        return queryset.none()

    def perform_create(self, serializer):
        user = self.request.user
        
        # Guard clause for safety
        if not user or user.is_anonymous:
            raise serializers.ValidationError("Authentication credentials are required.")
            
        if hasattr(user, 'profile'):
            profile = user.profile
            # Admin can manually supply organization ID in post body
            if profile.role == UserRole.ADMIN:
                org_id = self.request.data.get('organization') or self.request.data.get('organization_id')
                if org_id:
                    serializer.save(organization_id=org_id)
                    return
            
            # Automatically assign organization of user
            if profile.organization:
                serializer.save(organization=profile.organization)
                return
                
        raise serializers.ValidationError("Authenticated user has no associated organization.")

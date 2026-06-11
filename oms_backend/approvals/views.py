from django.db import transaction
from django.core.exceptions import ValidationError
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from core.mixins import OrganizationViewSetMixin
from core.permissions import IsOrganizationMember
from core.models import ApprovalDelegation
from approvals.serializers import ApprovalDelegationSerializer

class ApprovalDelegationViewSet(OrganizationViewSetMixin, viewsets.ModelViewSet):
    """
    ViewSet to manage approval delegation records (OOO delegation).
    Enforces tenant organization isolation.
    """
    queryset = ApprovalDelegation.objects.all().select_related('delegator', 'delegate')
    serializer_class = ApprovalDelegationSerializer
    permission_classes = [IsAuthenticated, IsOrganizationMember]
    
    # Filter so users only see delegations where they are either delegator or delegate
    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        
        # If user is Admin, they can see all delegations within the organization.
        # Otherwise, restrict to self-involved delegations.
        if hasattr(user, 'profile') and user.profile.role == 'ADMIN':
            return queryset
            
        return queryset.filter(
            delegator=user
        ) | queryset.filter(
            delegate=user
        )

    def perform_create(self, serializer):
        # Auto-set the delegator and tenant organization
        user = self.request.user
        serializer.save(
            delegator=user,
            organization=user.profile.organization
        )

    def destroy(self, request, *args, **kwargs):
        """Allows revoking an active delegation early."""
        obj = self.get_object()
        user = request.user
        
        # Only the delegator themselves (or an Admin) can delete/revoke a delegation
        if obj.delegator != user and user.profile.role != 'ADMIN':
            return Response(
                {"detail": "You do not have permission to revoke this delegation."},
                status=status.HTTP_403_FORBIDDEN
            )
            
        with transaction.atomic():
            obj.is_active = False
            obj.save()
            # In Django REST Framework, standard destroy deletes the record.
            # Revoking could mean soft-delete (setting is_active=False) or hard delete.
            # Let's perform a soft delete (is_active=False) and then return 204 or delete the record.
            # The API endpoint table says: DELETE /api/delegations/{id}/: "204 - Revoke early".
            # Setting is_active=False is standard for soft-revoking, but let's delete the record or do soft revoke.
            # Actually, let's delete it so it matches DELETE behavior, or soft delete it. Let's delete it:
            obj.delete()
            
        return Response(status=status.HTTP_204_NO_CONTENT)

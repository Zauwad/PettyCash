from rest_framework import serializers
from django.contrib.auth.models import User
from core.models import ApprovalDelegation
from accounts.serializers import UserSerializer
from datetime import date

class ApprovalDelegationSerializer(serializers.ModelSerializer):
    """
    Serializer to manage Out-of-Office approval delegations.
    Validates rules: no self-delegations, same-tenant delegate, circular delegation detection.
    """
    delegator_details = UserSerializer(source='delegator', read_only=True)
    delegate_details = UserSerializer(source='delegate', read_only=True)
    
    delegate_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='delegate',
        write_only=True
    )

    class Meta:
        model = ApprovalDelegation
        fields = [
            'id', 'delegator', 'delegator_details', 'delegate', 'delegate_details',
            'delegate_id', 'scope', 'start_date', 'end_date', 'is_active', 'reason', 'created_at'
        ]
        read_only_fields = ['delegator', 'delegate', 'is_active', 'created_at']

    def validate(self, attrs):
        request = self.context.get('request')
        user = request.user if request else None
        
        if not user:
            raise serializers.ValidationError("Delegator (authenticated user) is required.")

        delegate = attrs.get('delegate')
        start_date = attrs.get('start_date')
        end_date = attrs.get('end_date')

        # Check date range sanity
        if start_date > end_date:
            raise serializers.ValidationError({"end_date": "End date cannot be before start date."})

        # Prevent self-delegation
        if user == delegate:
            raise serializers.ValidationError({"delegate_id": "You cannot delegate approval authority to yourself."})

        # Ensure delegate is in the same tenant organization
        try:
            delegator_profile = user.profile
            delegate_profile = delegate.profile
        except Exception:
            raise serializers.ValidationError({"delegate_id": "Both users must have valid profile configurations."})

        if delegator_profile.organization != delegate_profile.organization:
            raise serializers.ValidationError({"delegate_id": "Delegate must belong to your organization."})

        # Only Team Leads, General Managers, and CEOs can delegate approval authority
        if delegator_profile.role not in ['TEAM_LEAD', 'GENERAL_MANAGER', 'CEO']:
            raise serializers.ValidationError("Only Team Leads, General Managers, and CEOs can delegate approval authority.")

        # Circular delegation check
        # e.g., if A delegates to B, B cannot have an active delegation back to A during overlapping period
        overlapping_delegations = ApprovalDelegation.objects.filter(
            delegator=delegate,
            delegate=user,
            is_active=True,
            start_date__lte=end_date,
            end_date__gte=start_date
        )
        if overlapping_delegations.exists():
            raise serializers.ValidationError({"delegate_id": "Circular delegation detected: The selected delegate has already delegated authority back to you during this period."})

        return attrs

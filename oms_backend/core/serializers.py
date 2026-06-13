from rest_framework import serializers
from core.models import AuditLog

class AuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source='actor.get_full_name', read_only=True)
    actor_username = serializers.CharField(source='actor.username', read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            'id', 'action', 'old_state', 'new_state', 'reason', 
            'metadata', 'created_at', 'actor_name', 'actor_username'
        ]

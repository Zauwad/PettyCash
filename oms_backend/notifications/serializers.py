from rest_framework import serializers
from core.models import Notification

class NotificationSerializer(serializers.ModelSerializer):
    """
    Serializer to represent in-app notification records.
    Only allows marking as read via updates.
    """
    class Meta:
        model = Notification
        fields = [
            'id', 'notification_type', 'title', 'message', 'action_url', 'is_read', 'created_at'
        ]
        read_only_fields = ['id', 'notification_type', 'title', 'message', 'action_url', 'created_at']

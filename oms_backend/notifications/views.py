from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from core.models import Notification
from notifications.serializers import NotificationSerializer

class NotificationViewSet(viewsets.ModelViewSet):
    """
    ViewSet to manage in-app notifications for the authenticated user.
    Restricts visibility to own records, and supports list, retrieve, update, and bulk mark-read actions.
    """
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['is_read']

    def get_queryset(self):
        # Ensure user can only see their own notifications
        return Notification.objects.filter(recipient=self.request.user)

    def create(self, request, *args, **kwargs):
        # Creating notifications via API is not allowed (triggered only by backend signals/workflows)
        return Response({"detail": "Method not allowed."}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    @action(detail=False, methods=['post'], url_path='mark-read')
    def mark_read(self, request):
        """
        Bulk marks specified notifications as read.
        Body format: {"notification_ids": [1, 2, ...]}
        """
        notification_ids = request.data.get('notification_ids', [])
        
        if not isinstance(notification_ids, list):
            return Response({"notification_ids": ["Must be a list of integers."]}, status=status.HTTP_400_BAD_REQUEST)
            
        updated_count = Notification.objects.filter(
            recipient=request.user,
            id__in=notification_ids
        ).update(is_read=True)
        
        return Response(
            {"detail": f"Successfully marked {updated_count} notifications as read."},
            status=status.HTTP_200_OK
        )

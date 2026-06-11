import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

class DashboardConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time notifications and system-wide state broadcasts.
    Groups are scoped by user ID (personal channel) and organization slug (tenant-wide channel).
    """
    async def connect(self):
        self.user = self.scope.get("user")
        
        # Connection is accepted only if the user was successfully authenticated via JWT
        if self.user and self.user.is_authenticated:
            self.user_group = f"user_{self.user.id}"
            
            # Join personal notification channel group
            await self.channel_layer.group_add(
                self.user_group,
                self.channel_name
            )
            
            # Join organization-wide channel group
            try:
                profile = await self.get_user_profile(self.user)
                if profile and profile.organization:
                    self.org_group = f"org_{profile.organization.slug}"
                    await self.channel_layer.group_add(
                        self.org_group,
                        self.channel_name
                    )
                else:
                    self.org_group = None
            except Exception:
                self.org_group = None
                
            await self.accept()
        else:
            # Reject anonymous or invalid WebSocket connections
            await self.close()

    async def disconnect(self, close_code):
        # Gracefully leave groups on disconnect
        if hasattr(self, 'user_group') and self.user_group:
            await self.channel_layer.group_discard(
                self.user_group,
                self.channel_name
            )
        if hasattr(self, 'org_group') and self.org_group:
            await self.channel_layer.group_discard(
                self.org_group,
                self.channel_name
            )

    async def receive(self, text_data):
        # Active client communication is currently unneeded; ignoring client messages
        pass

    async def send_notification(self, event):
        """
        Broadcasting hook triggered via channel layers to deliver
        in-app notification objects to the WebSocket client.
        """
        await self.send(text_data=json.dumps({
            "type": "notification",
            "data": event["data"]
        }))

    async def send_status_update(self, event):
        """
        Broadcasting hook triggered via channel layers to deliver
        FSM workflow state updates to the WebSocket client.
        """
        await self.send(text_data=json.dumps({
            "type": "status_update",
            "data": event["data"]
        }))

    @database_sync_to_async
    def get_user_profile(self, user):
        """Helper database method to fetch user profile in async connection thread."""
        if hasattr(user, 'profile'):
            return user.profile
        return None

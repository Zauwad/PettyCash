from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth import get_user_model

User = get_user_model()

@database_sync_to_async
def get_user_from_token(token_key):
    """
    Validates a JWT token key and retrieves the associated User instance.
    """
    try:
        access_token = AccessToken(token_key)
        user_id = access_token['user_id']
        return User.objects.get(id=user_id)
    except Exception:
        return AnonymousUser()

class JWTAuthMiddleware:
    """
    Custom Channels middleware to authenticate WebSocket connections using a JWT token
    passed as a query parameter (e.g. ws://localhost:8000/ws/dashboard/?token=<JWT>).
    """
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        query_string = scope.get("query_string", b"").decode("utf-8")
        token = None
        
        # Parse standard token query parameter
        for param in query_string.split("&"):
            if param.startswith("token="):
                token = param.split("=")[1]
                break
                
        if token:
            scope["user"] = await get_user_from_token(token)
        else:
            scope["user"] = AnonymousUser()
            
        return await self.inner(scope, receive, send)

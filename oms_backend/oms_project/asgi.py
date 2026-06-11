import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter

# Set settings module default
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'oms_project.settings.development')

# Initialize standard Django ASGI application first, populating AppRegistry
django_asgi_app = get_asgi_application()

# Import routing and middleware after Django setup
import core.routing
from core.ws_auth import JWTAuthMiddleware

application = ProtocolTypeRouter({
    # Route standard HTTP requests
    "http": django_asgi_app,
    
    # Route WebSocket connection requests wrapped in JWT Authentication
    "websocket": JWTAuthMiddleware(
        URLRouter(
            core.routing.websocket_urlpatterns
        )
    ),
})

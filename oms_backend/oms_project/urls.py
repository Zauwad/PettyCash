from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

urlpatterns = [
    # Django Admin Panel
    path('admin/', admin.site.urls),
    
    # API base routes
    path('api/', include('accounts.urls')),
    path('api/', include('pettycash.urls')),
    path('api/', include('leave.urls')),
    path('api/', include('approvals.urls')),
    path('api/', include('notifications.urls')),
    path('api/', include('analytics.urls')),
    path('api/', include('core.urls')),
    
    # OpenAPI & Swagger UI Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/schema/swagger-ui/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/schema/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]

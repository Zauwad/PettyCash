from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView, TokenBlacklistView
from accounts.views import CustomTokenObtainPairView, MeView, UserViewSet, DepartmentViewSet

# Initialize DefaultRouter for ViewSets
router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'departments', DepartmentViewSet, basename='department')

urlpatterns = [
    # JWT authentication endpoints
    path('auth/login/', CustomTokenObtainPairView.as_view(), name='auth_login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='auth_refresh'),
    path('auth/logout/', TokenBlacklistView.as_view(), name='auth_logout'),
    path('auth/me/', MeView.as_view(), name='auth_me'),
    
    # Direct mappings matching frontend constants
    path('token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', MeView.as_view(), name='me'),
    
    # Scoped user management endpoints (e.g., /api/users/)
    path('', include(router.urls)),
]

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from approvals.views import ApprovalDelegationViewSet

router = DefaultRouter()
router.register(r'delegations', ApprovalDelegationViewSet, basename='delegation')

urlpatterns = [
    path('', include(router.urls)),
]

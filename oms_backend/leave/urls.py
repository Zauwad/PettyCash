from django.urls import path, include
from rest_framework.routers import DefaultRouter
from leave.views import LeaveTypeViewSet, LeaveBalanceViewSet, LeaveRequestViewSet, CompanyHolidayViewSet

# Initialize DefaultRouter
router = DefaultRouter()
router.register(r'leave/types', LeaveTypeViewSet, basename='leave-type')
router.register(r'leave/balances', LeaveBalanceViewSet, basename='leave-balance')
router.register(r'leave/holidays', CompanyHolidayViewSet, basename='company-holiday')
router.register(r'leave/requests', LeaveRequestViewSet, basename='leave-request')

urlpatterns = [
    # Router API endpoints (e.g. /api/leave/requests/)
    path('', include(router.urls)),
]

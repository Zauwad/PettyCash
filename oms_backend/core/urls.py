from django.urls import path, include
from rest_framework.routers import DefaultRouter
from core.views import AuditLogViewSet, DailyCronView

router = DefaultRouter()
router.register(r'audit-logs', AuditLogViewSet, basename='audit-log')

urlpatterns = [
    path('', include(router.urls)),
    path('cron/daily-tasks/', DailyCronView.as_view(), name='daily-cron-tasks'),
]

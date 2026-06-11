from django.urls import path, include
from rest_framework.routers import DefaultRouter
from pettycash.views import PettyCashViewSet, AttachmentDownloadView

router = DefaultRouter()
router.register(r'petty-cash', PettyCashViewSet, basename='petty-cash')

urlpatterns = [
    # Attachment download endpoint (scoping file downloads from database BLOB)
    path('attachments/<int:pk>/download/', AttachmentDownloadView.as_view(), name='attachment_download'),
    
    # Router endpoints (e.g. /api/petty-cash/)
    path('', include(router.urls)),
]

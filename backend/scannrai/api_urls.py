from rest_framework.routers import DefaultRouter

from apps.findings.views import FindingViewSet
from apps.projects.views import ProjectViewSet
from apps.scans.views import ScanViewSet

router = DefaultRouter()
router.register(r'projects', ProjectViewSet, basename='projects')
router.register(r'scans', ScanViewSet, basename='scans')
router.register(r'findings', FindingViewSet, basename='findings')

urlpatterns = router.urls

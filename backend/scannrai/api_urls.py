from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.findings.views import FindingViewSet
from apps.projects.views import ProjectViewSet
from apps.scans.views import PolicyView, ScanViewSet

router = DefaultRouter()
router.register(r'projects', ProjectViewSet, basename='projects')
router.register(r'scans', ScanViewSet, basename='scans')
router.register(r'findings', FindingViewSet, basename='findings')

urlpatterns = [
    path('policy', PolicyView.as_view(), name='policy-root'),
    path('policy/', PolicyView.as_view(), name='policy-root-slash'),
    *router.urls,
]

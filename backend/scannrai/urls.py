from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.accounts.views import ChangePasswordView, MeView, RegisterView
from .views import health_check

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health/', health_check, name='health-check'),
    path('api/auth/register/', RegisterView.as_view(), name='auth-register'),
    path('api/auth/change-password/', ChangePasswordView.as_view(), name='auth-change-password'),
    path('api/auth/token/', TokenObtainPairView.as_view(), name='token-obtain-pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('api/me/', MeView.as_view(), name='me'),
    path('api/', include('scannrai.api_urls')),
]

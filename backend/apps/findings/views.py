from rest_framework import mixins, permissions, viewsets

from .models import Finding
from .serializers import FindingSerializer


class FindingViewSet(mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = FindingSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        return Finding.objects.filter(scan__project__created_by=self.request.user).select_related('scan')

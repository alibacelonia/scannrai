from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.scans.models import Scan, ScanStatus
from apps.scans.serializers import ScanCreateSerializer, ScanSerializer

from .models import Project
from .serializers import ProjectSerializer


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        return Project.objects.filter(created_by=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'], url_path='scans')
    def create_scan(self, request, pk=None):
        project = self.get_object()
        serializer = ScanCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        scan = Scan.objects.create(project=project, status=ScanStatus.QUEUED, **serializer.validated_data)
        return Response(ScanSerializer(scan).data, status=status.HTTP_201_CREATED)

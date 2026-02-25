from pathlib import Path

from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.findings.normalizers import normalize_and_store_findings
from apps.scans.models import Scan, ScanStatus
from apps.scans.serializers import ScanCreateSerializer, ScanSerializer
from apps.scans.services import cleanup_scan_workspace, ingest_scan_source
from apps.scans.tool_runners import run_all_tools

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
        scan = Scan.objects.create(
            project=project,
            status=ScanStatus.RUNNING,
            started_at=timezone.now(),
            **serializer.validated_data,
        )

        zip_file = request.FILES.get('zip_file')

        try:
            commit_hash, ingestion_meta = ingest_scan_source(scan, zip_file=zip_file)
            meta = dict(scan.meta or {})
            meta.update(ingestion_meta)
            scan.meta = meta
            if commit_hash:
                scan.commit_hash = commit_hash

            repo_dir = Path(ingestion_meta['repo_dir'])
            tool_runs, tool_output_paths = run_all_tools(scan.id, repo_dir)
            scan.meta['tool_runs'] = tool_runs
            scan.meta['tool_output_paths'] = tool_output_paths
            normalization = normalize_and_store_findings(scan, tool_output_paths)
            scan.meta['normalization'] = normalization
            scan.meta['summary_counts'] = normalization['summary_counts']
            scan.status = ScanStatus.COMPLETED
        except Exception as exc:
            meta = dict(scan.meta or {})
            meta['ingestion_error'] = str(exc)
            scan.meta = meta
            scan.status = ScanStatus.FAILED
        finally:
            scan.finished_at = timezone.now()
            scan.save(update_fields=['status', 'commit_hash', 'meta', 'finished_at', 'updated_at'])
            cleanup_scan_workspace(scan.id)

        return Response(ScanSerializer(scan).data, status=status.HTTP_201_CREATED)

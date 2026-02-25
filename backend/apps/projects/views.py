from pathlib import Path
from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.findings.normalizers import normalize_and_store_findings
from apps.scans.audit import record_audit_event
from apps.scans.models import AuditEventType, Scan, ScanStatus
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

    @action(detail=True, methods=['get', 'post'], url_path='scans')
    def scans(self, request, pk=None):
        project = self.get_object()

        if request.method.lower() == 'get':
            queryset = project.scans.all().order_by('-created_at')
            page = self.paginate_queryset(queryset)
            if page is not None:
                return self.get_paginated_response(ScanSerializer(page, many=True).data)
            return Response(ScanSerializer(queryset, many=True).data)

        one_hour_ago = timezone.now() - timedelta(hours=1)
        recent_scan_count = Scan.objects.filter(
            project__created_by=request.user,
            created_at__gte=one_hour_ago,
        ).count()
        if recent_scan_count >= settings.SCAN_RATE_LIMIT_PER_HOUR:
            return Response(
                {'detail': 'Scan rate limit exceeded. Please try again later.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        serializer = ScanCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        scan = Scan.objects.create(
            project=project,
            status=ScanStatus.RUNNING,
            started_at=timezone.now(),
            **serializer.validated_data,
        )
        record_audit_event(
            scan=scan,
            event_type=AuditEventType.SCAN_STARTED,
            user=request.user,
            message='Scan started.',
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
            record_audit_event(
                scan=scan,
                event_type=AuditEventType.SCAN_COMPLETED,
                user=request.user,
                message='Scan completed.',
                meta={'finding_count': normalization['persisted_total']},
            )
        except Exception as exc:
            meta = dict(scan.meta or {})
            meta['ingestion_error'] = str(exc)
            scan.meta = meta
            scan.status = ScanStatus.FAILED
            record_audit_event(
                scan=scan,
                event_type=AuditEventType.SCAN_FAILED,
                user=request.user,
                message='Scan failed.',
                meta={'error': str(exc)},
            )
        finally:
            scan.finished_at = timezone.now()
            scan.save(update_fields=['status', 'commit_hash', 'meta', 'finished_at', 'updated_at'])
            cleanup_scan_workspace(scan.id)

        return Response(ScanSerializer(scan).data, status=status.HTTP_201_CREATED)

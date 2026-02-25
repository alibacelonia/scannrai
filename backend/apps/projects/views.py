from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.scans.audit import record_audit_event
from apps.scans.models import AuditEventType, Scan, ScanStatus
from apps.scans.serializers import ScanCreateSerializer, ScanSerializer
from apps.scans.services import discover_local_source_candidates, validate_repository_source_reference
from apps.scans.tasks import scan_repo

from .models import Project
from .serializers import ProjectSerializer


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        return Project.objects.filter(created_by=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['post'], url_path='validate-source')
    def validate_source(self, request):
        source = str(request.data.get('source') or '').strip()
        if not source:
            return Response({'detail': 'source is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            validation = validate_repository_source_reference(source)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'valid': True, **validation}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='discover-source')
    def discover_source(self, request):
        folder_name = str(request.data.get('folder_name') or '').strip()
        if not folder_name:
            return Response({'detail': 'folder_name is required.'}, status=status.HTTP_400_BAD_REQUEST)
        candidates = discover_local_source_candidates(folder_name)
        return Response({'folder_name': folder_name, 'candidates': candidates}, status=status.HTTP_200_OK)

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

        if request.FILES.get('zip_file') or request.FILES.getlist('repo_files') or request.data.get('repo_paths'):
            return Response(
                {
                    'detail': (
                        'Upload-based local sources are disabled. '
                        'Set the project repository source to a local path or remote git URL.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not (project.repo_url or '').strip():
            return Response(
                {'detail': 'Repository source is required. Set a local path, local zip path, or remote git URL first.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            source_validation = validate_repository_source_reference(project.repo_url)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        serializer = ScanCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        scan = Scan.objects.create(
            project=project,
            status=ScanStatus.QUEUED,
            **serializer.validated_data,
        )

        try:
            meta = dict(scan.meta or {})
            meta['queued_via'] = 'celery'
            meta['queued_by'] = request.user.id
            meta['queued_at'] = timezone.now().isoformat()
            meta['source_kind'] = source_validation['kind']
            scan.meta = meta
            async_result = scan_repo.delay(scan.id)
            scan.meta['task_id'] = async_result.id
            record_audit_event(
                scan=scan,
                event_type=AuditEventType.SCAN_STARTED,
                user=request.user,
                message='Scan queued.',
                meta={'task_id': async_result.id},
            )
        except Exception as exc:
            meta = dict(scan.meta or {})
            meta['queue_error'] = str(exc)
            scan.meta = meta
            scan.status = ScanStatus.FAILED
            record_audit_event(
                scan=scan,
                event_type=AuditEventType.SCAN_FAILED,
                user=request.user,
                message='Scan queue failed.',
                meta={'error': str(exc)},
            )
        scan.save(update_fields=['status', 'meta', 'updated_at'])

        return Response(ScanSerializer(scan).data, status=status.HTTP_201_CREATED)

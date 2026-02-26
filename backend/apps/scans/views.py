from django.conf import settings
from django.http import HttpResponse
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.response import Response

from apps.findings.serializers import FindingSerializer
from apps.scans.ai import REVIEW_WARNING, build_scan_summary
from apps.scans.audit import record_audit_event
from apps.scans.exporters import build_scan_export_json, build_scan_export_markdown
from apps.scans.models import AuditEventType
from apps.scans.policy import get_or_create_policy_for_user

from .models import Scan
from .serializers import PolicySerializer, ScanSerializer


class ScanViewSet(mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = ScanSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        return Scan.objects.filter(project__created_by=self.request.user).select_related('project')

    @action(detail=True, methods=['get'], url_path='findings')
    def findings(self, request, pk=None):
        scan = self.get_object()
        queryset = scan.findings.all().order_by('-created_at')

        severity = request.query_params.get('severity')
        tool = request.query_params.get('tool')
        category = request.query_params.get('category')
        file_query = request.query_params.get('file')

        if severity:
            queryset = queryset.filter(severity=severity)
        if tool:
            queryset = queryset.filter(tool=tool)
        if category:
            queryset = queryset.filter(category__icontains=category)
        if file_query:
            queryset = queryset.filter(file_path__icontains=file_query)

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = FindingSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = FindingSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='ai/summary')
    def ai_summary(self, request, pk=None):
        if not settings.AI_FEATURE_ENABLED:
            return Response({'detail': 'AI enrichment is not enabled for this environment.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        scan = self.get_object()
        summary = build_scan_summary(scan)
        scan.ai_summary = summary
        scan.save(update_fields=['ai_summary', 'updated_at'])
        return Response({'scan_id': scan.id, 'ai_summary': summary, 'warning': REVIEW_WARNING})

    @action(detail=True, methods=['get'], url_path=r'export\.json')
    def export_json(self, request, pk=None):
        scan = self.get_object()
        payload = build_scan_export_json(scan)
        record_audit_event(
            scan=scan,
            event_type=AuditEventType.EXPORT_JSON_DOWNLOADED,
            user=request.user,
            message='Scan JSON export downloaded.',
        )
        return Response(payload)

    @action(detail=True, methods=['get'], url_path=r'export\.md')
    def export_markdown(self, request, pk=None):
        scan = self.get_object()
        markdown = build_scan_export_markdown(scan)
        record_audit_event(
            scan=scan,
            event_type=AuditEventType.EXPORT_MD_DOWNLOADED,
            user=request.user,
            message='Scan Markdown export downloaded.',
        )
        response = HttpResponse(markdown, content_type='text/markdown')
        response['Content-Disposition'] = f'attachment; filename=\"scan-{scan.id}.md\"'
        return response


class PolicyView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        policy = get_or_create_policy_for_user(request.user)
        serializer = PolicySerializer(policy)
        return Response(serializer.data)

    def put(self, request):
        policy = get_or_create_policy_for_user(request.user)
        serializer = PolicySerializer(policy, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        # We do not have a direct scan entity for policy updates; write generic audit row.
        from apps.scans.models import AuditLog

        AuditLog.objects.create(
            actor=request.user,
            action=AuditEventType.POLICY_UPDATED,
            entity_type='policy',
            entity_id=str(policy.id),
            metadata={'updated_fields': sorted(serializer.validated_data.keys())},
            user=request.user,
            event_type=AuditEventType.POLICY_UPDATED,
            message='Policy updated.',
            meta={'updated_fields': sorted(serializer.validated_data.keys())},
        )
        return Response(PolicySerializer(policy).data)

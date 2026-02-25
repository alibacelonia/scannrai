from rest_framework import mixins, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.findings.serializers import FindingSerializer
from apps.scans.ai import REVIEW_WARNING, build_scan_summary

from .models import Scan
from .serializers import ScanSerializer


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
        scan = self.get_object()
        summary = build_scan_summary(scan)
        scan.ai_summary = summary
        scan.save(update_fields=['ai_summary', 'updated_at'])
        return Response({'scan_id': scan.id, 'ai_summary': summary, 'warning': REVIEW_WARNING})

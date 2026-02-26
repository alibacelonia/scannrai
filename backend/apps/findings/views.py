from django.conf import settings
from rest_framework import mixins, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.scans.ai import REVIEW_WARNING, build_finding_explanation, build_patch_suggestion
from .models import Finding
from .serializers import FindingDetailSerializer, FindingSerializer


class FindingViewSet(mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = FindingSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        return Finding.objects.filter(scan__project__created_by=self.request.user).select_related('scan')

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return FindingDetailSerializer
        return FindingSerializer

    @action(detail=True, methods=['post'], url_path='ai/explain')
    def ai_explain(self, request, pk=None):
        if not settings.AI_FEATURE_ENABLED:
            return Response({'detail': 'AI enrichment is not enabled for this environment.'}, status=503)
        finding = self.get_object()
        explanation, fix_suggestion, confidence = build_finding_explanation(finding)
        finding.ai_explanation = explanation
        finding.ai_fix_suggestion = fix_suggestion
        finding.confidence = confidence
        finding.save(update_fields=['ai_explanation', 'ai_fix_suggestion', 'confidence'])
        return Response(
            {
                'finding_id': finding.id,
                'ai_explanation': explanation,
                'ai_fix_suggestion': fix_suggestion,
                'confidence': confidence,
                'warning': REVIEW_WARNING,
            }
        )

    @action(detail=True, methods=['post'], url_path='ai/patch')
    def ai_patch(self, request, pk=None):
        if not settings.AI_FEATURE_ENABLED:
            return Response({'detail': 'AI enrichment is not enabled for this environment.'}, status=503)
        finding = self.get_object()
        patch_diff = build_patch_suggestion(finding)
        finding.ai_patch_diff = patch_diff
        finding.save(update_fields=['ai_patch_diff'])
        return Response({'finding_id': finding.id, 'ai_patch_diff': patch_diff, 'warning': REVIEW_WARNING})

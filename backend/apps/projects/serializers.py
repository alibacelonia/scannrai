from urllib.parse import urlparse, urlunparse

from rest_framework import serializers

from apps.scans.services import validate_repository_source_reference

from .models import Project


def normalize_repository_source(value: str) -> str:
    candidate = str(value or '').strip()
    if not candidate:
        return ''

    parsed = urlparse(candidate)
    if parsed.scheme in ('http', 'https') and parsed.netloc:
        path = (parsed.path or '').rstrip('/')
        if path.lower().endswith('.git'):
            path = path[:-4]
        return urlunparse((parsed.scheme.lower(), parsed.netloc.lower(), path, '', '', ''))

    normalized = candidate.replace('\\', '/').rstrip('/')
    return normalized or candidate.replace('\\', '/')


class ProjectSerializer(serializers.ModelSerializer):
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)
    repo_url = serializers.CharField(
        allow_blank=True,
        allow_null=True,
        required=False,
        trim_whitespace=True,
    )

    class Meta:
        model = Project
        fields = (
            'id',
            'name',
            'repo_url',
            'created_by',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('id', 'created_by', 'created_at', 'updated_at')

    def validate_repo_url(self, value):
        if value in (None, ''):
            return None
        request = self.context.get('request')
        try:
            validation = validate_repository_source_reference(value)
            canonical_source = validation.get('resolved_path') or validation.get('reference') or value
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc

        normalized = normalize_repository_source(canonical_source)
        if not normalized:
            return None

        if request and request.user and request.user.is_authenticated:
            queryset = Project.objects.filter(created_by=request.user)
            if self.instance:
                queryset = queryset.exclude(pk=self.instance.pk)
            for existing in queryset.only('id', 'name', 'repo_url'):
                if normalize_repository_source(existing.repo_url or '') == normalized:
                    raise serializers.ValidationError(
                        f'Repository source already exists in project "{existing.name}" (id={existing.id}).'
                    )

        return normalized

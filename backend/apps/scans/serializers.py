import json

from django.db.models import Count
from rest_framework import serializers

from apps.findings.models import FindingSeverity

from .models import Policy, Scan


class ScanSerializer(serializers.ModelSerializer):
    summary = serializers.SerializerMethodField()

    class Meta:
        model = Scan
        fields = (
            'id',
            'project',
            'status',
            'commit_hash',
            'started_at',
            'finished_at',
            'meta',
            'ai_summary',
            'created_at',
            'updated_at',
            'summary',
        )
        read_only_fields = ('id', 'project', 'created_at', 'updated_at', 'summary', 'ai_summary')

    def get_summary(self, obj: Scan) -> dict[str, int]:
        rows = obj.findings.values('severity').order_by().annotate(total=Count('id'))
        counts = {choice: 0 for choice, _ in FindingSeverity.choices}
        for row in rows:
            counts[row['severity']] = row['total']
        return counts


class ScanCreateSerializer(serializers.ModelSerializer):
    meta = serializers.JSONField(required=False, default=dict)

    class Meta:
        model = Scan
        fields = ('id', 'commit_hash', 'meta')
        read_only_fields = ('id',)

    def validate_meta(self, value):
        if value in (None, ''):
            return {}
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
            except json.JSONDecodeError as exc:
                raise serializers.ValidationError('meta must be valid JSON.') from exc
            if not isinstance(parsed, dict):
                raise serializers.ValidationError('meta must be a JSON object.')
            return parsed
        if not isinstance(value, dict):
            raise serializers.ValidationError('meta must be a JSON object.')
        return value


class PolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = Policy
        fields = (
            'tools_enabled',
            'severity_threshold',
            'semgrep_timeout_seconds',
            'osv_timeout_seconds',
            'gitleaks_timeout_seconds',
            'retention_days',
            'gitleaks_rule_severity_overrides',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('created_at', 'updated_at')

    def validate_tools_enabled(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError('tools_enabled must be a JSON object.')
        normalized = {
            'semgrep': bool(value.get('semgrep', True)),
            'osv': bool(value.get('osv', True)),
            'gitleaks': bool(value.get('gitleaks', True)),
        }
        if not any(normalized.values()):
            raise serializers.ValidationError('At least one tool must remain enabled.')
        return normalized

    def validate_gitleaks_rule_severity_overrides(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError('gitleaks_rule_severity_overrides must be a JSON object.')

        allowed = {choice for choice, _ in FindingSeverity.choices}
        normalized = {}
        for key, raw in value.items():
            severity = str(raw).strip().lower()
            if severity not in allowed:
                raise serializers.ValidationError(
                    f'Invalid severity override "{raw}" for rule "{key}". '
                    f'Allowed values: {", ".join(sorted(allowed))}.'
                )
            normalized[str(key)] = severity
        return normalized

    def validate(self, attrs):
        for timeout_field in ('semgrep_timeout_seconds', 'osv_timeout_seconds', 'gitleaks_timeout_seconds'):
            value = int(attrs.get(timeout_field, getattr(self.instance, timeout_field, 0) or 0))
            if value <= 0:
                raise serializers.ValidationError({timeout_field: 'Timeout must be greater than 0 seconds.'})
            if value > 7200:
                raise serializers.ValidationError({timeout_field: 'Timeout exceeds maximum allowed limit (7200s).'})

        retention_days = int(attrs.get('retention_days', getattr(self.instance, 'retention_days', 1)))
        if retention_days < 0 or retention_days > 30:
            raise serializers.ValidationError({'retention_days': 'Retention must be between 0 and 30 days.'})

        return attrs

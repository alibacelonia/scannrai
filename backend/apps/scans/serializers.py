import json

from django.db.models import Count
from rest_framework import serializers

from apps.findings.models import FindingSeverity

from .models import Scan


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

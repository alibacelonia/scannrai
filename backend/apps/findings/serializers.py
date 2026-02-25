from rest_framework import serializers

from .models import Finding


class FindingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Finding
        fields = (
            'id',
            'scan',
            'tool',
            'severity',
            'category',
            'file_path',
            'line_start',
            'line_end',
            'raw',
            'fingerprint',
            'created_at',
        )
        read_only_fields = ('id', 'created_at')

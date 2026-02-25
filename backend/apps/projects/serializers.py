from rest_framework import serializers

from .models import Project


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
        return value.strip()

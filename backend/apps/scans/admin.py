from django.contrib import admin

from .models import AuditLog, Policy, Scan


@admin.register(Scan)
class ScanAdmin(admin.ModelAdmin):
    list_display = ('id', 'project', 'status', 'commit_hash', 'created_at', 'started_at', 'finished_at')
    list_filter = ('status',)
    search_fields = ('project__name', 'commit_hash')


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('id', 'timestamp', 'action', 'entity_type', 'entity_id', 'actor', 'scan', 'event_type')
    list_filter = ('action', 'event_type', 'entity_type')
    search_fields = ('entity_id', 'actor__username', 'user__username', 'message')


@admin.register(Policy)
class PolicyAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'owner',
        'severity_threshold',
        'semgrep_timeout_seconds',
        'osv_timeout_seconds',
        'gitleaks_timeout_seconds',
        'retention_days',
        'updated_at',
    )
    search_fields = ('owner__username', 'owner__email')

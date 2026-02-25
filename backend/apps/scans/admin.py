from django.contrib import admin

from .models import AuditLog, Scan


@admin.register(Scan)
class ScanAdmin(admin.ModelAdmin):
    list_display = ('id', 'project', 'status', 'commit_hash', 'created_at', 'started_at', 'finished_at')
    list_filter = ('status',)
    search_fields = ('project__name', 'commit_hash')


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('id', 'scan', 'event_type', 'user', 'created_at')
    list_filter = ('event_type',)
    search_fields = ('scan__id', 'user__username', 'message')

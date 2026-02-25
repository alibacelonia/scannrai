from django.contrib import admin

from .models import Scan


@admin.register(Scan)
class ScanAdmin(admin.ModelAdmin):
    list_display = ('id', 'project', 'status', 'commit_hash', 'created_at', 'started_at', 'finished_at')
    list_filter = ('status',)
    search_fields = ('project__name', 'commit_hash')

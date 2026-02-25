from django.contrib import admin

from .models import Finding


@admin.register(Finding)
class FindingAdmin(admin.ModelAdmin):
    list_display = ('id', 'scan', 'tool', 'severity', 'category', 'file_path', 'created_at')
    list_filter = ('tool', 'severity', 'category')
    search_fields = ('category', 'file_path', 'fingerprint')

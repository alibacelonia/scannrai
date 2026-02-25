from django.conf import settings
from django.db import models

from apps.projects.models import Project


class ScanStatus(models.TextChoices):
    QUEUED = 'queued', 'Queued'
    RUNNING = 'running', 'Running'
    COMPLETED = 'completed', 'Completed'
    FAILED = 'failed', 'Failed'


class Scan(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='scans')
    status = models.CharField(max_length=20, choices=ScanStatus.choices, default=ScanStatus.QUEUED, db_index=True)
    commit_hash = models.CharField(max_length=64, blank=True, null=True)
    started_at = models.DateTimeField(blank=True, null=True)
    finished_at = models.DateTimeField(blank=True, null=True)
    meta = models.JSONField(default=dict, blank=True)
    ai_summary = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f'Scan {self.pk} ({self.status})'


class AuditEventType(models.TextChoices):
    SCAN_STARTED = 'scan_started', 'Scan Started'
    SCAN_COMPLETED = 'scan_completed', 'Scan Completed'
    SCAN_FAILED = 'scan_failed', 'Scan Failed'


class AuditLog(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs',
    )
    scan = models.ForeignKey(Scan, on_delete=models.CASCADE, related_name='audit_logs')
    event_type = models.CharField(max_length=40, choices=AuditEventType.choices, db_index=True)
    message = models.TextField(blank=True, default='')
    meta = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f'{self.event_type} ({self.scan_id})'

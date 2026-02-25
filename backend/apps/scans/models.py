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

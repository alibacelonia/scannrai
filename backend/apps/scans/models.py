from django.conf import settings
from django.db import models
from django.utils import timezone

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
    SCAN_QUEUED = 'scan_queued', 'Scan Queued'
    SCAN_STARTED = 'scan_started', 'Scan Started'
    SCAN_COMPLETED = 'scan_completed', 'Scan Completed'
    SCAN_FAILED = 'scan_failed', 'Scan Failed'
    EXPORT_JSON_DOWNLOADED = 'export_json_downloaded', 'Export JSON Downloaded'
    EXPORT_MD_DOWNLOADED = 'export_markdown_downloaded', 'Export Markdown Downloaded'
    POLICY_UPDATED = 'policy_updated', 'Policy Updated'


class AuditLog(models.Model):
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_events',
    )
    action = models.CharField(max_length=80, db_index=True, blank=True, default='')
    entity_type = models.CharField(max_length=80, db_index=True, blank=True, default='')
    entity_id = models.CharField(max_length=64, db_index=True, blank=True, default='')
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    metadata = models.JSONField(default=dict, blank=True)

    # Backward-compatible fields retained for existing consumers/admin screens.
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs',
    )
    scan = models.ForeignKey(Scan, on_delete=models.CASCADE, related_name='audit_logs', null=True, blank=True)
    event_type = models.CharField(max_length=40, choices=AuditEventType.choices, db_index=True)
    message = models.TextField(blank=True, default='')
    meta = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp', '-created_at']
        indexes = [
            models.Index(fields=['action', 'timestamp']),
            models.Index(fields=['entity_type', 'entity_id']),
        ]

    def __str__(self) -> str:
        descriptor = self.action or self.event_type or 'audit_event'
        return f'{descriptor} ({self.entity_type}:{self.entity_id})'


class Policy(models.Model):
    class SeverityThreshold(models.TextChoices):
        CRITICAL = 'critical', 'Critical'
        HIGH = 'high', 'High'
        MEDIUM = 'medium', 'Medium'
        LOW = 'low', 'Low'
        INFO = 'info', 'Info'

    owner = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='scan_policy',
    )
    tools_enabled = models.JSONField(
        default=dict,
        blank=True,
        help_text='Boolean flags for enabled tools (semgrep/osv/gitleaks).',
    )
    severity_threshold = models.CharField(
        max_length=20,
        choices=SeverityThreshold.choices,
        default=SeverityThreshold.LOW,
    )
    semgrep_timeout_seconds = models.PositiveIntegerField(default=600)
    osv_timeout_seconds = models.PositiveIntegerField(default=600)
    gitleaks_timeout_seconds = models.PositiveIntegerField(default=600)
    retention_days = models.PositiveIntegerField(default=1)
    gitleaks_rule_severity_overrides = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self) -> str:
        return f'Policy(user={self.owner_id})'

from django.db import models

from apps.scans.models import Scan


class FindingTool(models.TextChoices):
    SEMGREP = 'semgrep', 'Semgrep'
    OSV = 'osv', 'OSV Scanner'
    GITLEAKS = 'gitleaks', 'Gitleaks'


class FindingSeverity(models.TextChoices):
    CRITICAL = 'critical', 'Critical'
    HIGH = 'high', 'High'
    MEDIUM = 'medium', 'Medium'
    LOW = 'low', 'Low'
    INFO = 'info', 'Info'


class Finding(models.Model):
    scan = models.ForeignKey(Scan, on_delete=models.CASCADE, related_name='findings')
    tool = models.CharField(max_length=20, choices=FindingTool.choices, db_index=True)
    severity = models.CharField(max_length=20, choices=FindingSeverity.choices, db_index=True)
    category = models.CharField(max_length=120, db_index=True)
    file_path = models.CharField(max_length=512, blank=True, default='')
    line_start = models.PositiveIntegerField(blank=True, null=True)
    line_end = models.PositiveIntegerField(blank=True, null=True)
    raw = models.JSONField(default=dict, blank=True)
    fingerprint = models.CharField(max_length=128, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f'{self.tool}:{self.severity}:{self.category}'

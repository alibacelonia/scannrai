from django.conf import settings
from django.db import models


class Project(models.Model):
    name = models.CharField(max_length=255)
    # Source can be remote git URL or local container-visible path.
    repo_url = models.CharField(max_length=2048, blank=True, null=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='projects',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f'{self.name} ({self.created_by_id})'

from django.conf import settings

from .models import Policy


def default_tools_enabled() -> dict[str, bool]:
    return {
        'semgrep': True,
        'osv': True,
        'gitleaks': True,
    }


def get_or_create_policy_for_user(user) -> Policy:
    configured_retention_seconds = int(getattr(settings, 'SCAN_RETENTION_SECONDS', 86400))
    default_retention_days = 0 if configured_retention_seconds <= 0 else (configured_retention_seconds + 86399) // 86400
    defaults = {
        'tools_enabled': default_tools_enabled(),
        'severity_threshold': 'low',
        'semgrep_timeout_seconds': int(getattr(settings, 'SCAN_TOOL_TIMEOUT_SECONDS', 600)),
        'osv_timeout_seconds': int(getattr(settings, 'SCAN_TOOL_TIMEOUT_SECONDS', 600)),
        'gitleaks_timeout_seconds': int(getattr(settings, 'SCAN_TOOL_TIMEOUT_SECONDS', 600)),
        'retention_days': default_retention_days,
        'gitleaks_rule_severity_overrides': {},
    }
    policy, created = Policy.objects.get_or_create(owner=user, defaults=defaults)
    if created:
        return policy

    if not isinstance(policy.tools_enabled, dict) or not policy.tools_enabled:
        policy.tools_enabled = default_tools_enabled()
        policy.save(update_fields=['tools_enabled', 'updated_at'])
    return policy


def policy_snapshot(policy: Policy) -> dict:
    return {
        'tools_enabled': {
            'semgrep': bool(policy.tools_enabled.get('semgrep', True)),
            'osv': bool(policy.tools_enabled.get('osv', True)),
            'gitleaks': bool(policy.tools_enabled.get('gitleaks', True)),
        },
        'severity_threshold': policy.severity_threshold,
        'timeouts': {
            'semgrep': int(policy.semgrep_timeout_seconds),
            'osv': int(policy.osv_timeout_seconds),
            'gitleaks': int(policy.gitleaks_timeout_seconds),
        },
        'retention_days': int(policy.retention_days),
        'gitleaks_rule_severity_overrides': dict(policy.gitleaks_rule_severity_overrides or {}),
    }

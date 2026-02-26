import logging
from pathlib import Path

from django.conf import settings
from django.utils import timezone
from celery import shared_task

from apps.findings.normalizers import normalize_and_store_findings
from apps.scans.audit import record_audit_event
from apps.scans.security import redact_text, truncate_text

from .models import AuditEventType, Scan, ScanStatus
from .services import cleanup_scan_workspace, ingest_scan_from_zip_path, ingest_scan_source
from .tool_runners import detect_tool_versions, run_all_tools

logger = logging.getLogger(__name__)


def _log_scan_event(scan_id: int, correlation_id: str, event: str, **kwargs) -> None:
    payload = {
        'scan_id': scan_id,
        'scan_correlation_id': correlation_id,
        'event': event,
        **kwargs,
    }
    logger.info(payload)


def _policy_for_scan(scan: Scan) -> dict:
    meta = dict(scan.meta or {})
    policy = meta.get('policy') if isinstance(meta.get('policy'), dict) else {}
    tools_enabled = policy.get('tools_enabled') if isinstance(policy.get('tools_enabled'), dict) else {}
    timeouts = policy.get('timeouts') if isinstance(policy.get('timeouts'), dict) else {}

    enabled_tools = [tool for tool in ('semgrep', 'osv', 'gitleaks') if bool(tools_enabled.get(tool, True))]
    if not enabled_tools:
        enabled_tools = ['semgrep', 'osv', 'gitleaks']

    configured_retention_seconds = int(getattr(settings, 'SCAN_RETENTION_SECONDS', 86400))
    default_retention_days = 0 if configured_retention_seconds <= 0 else (configured_retention_seconds + 86399) // 86400
    retention_days = int(policy.get('retention_days', default_retention_days) or default_retention_days)
    retention_seconds = max(0, retention_days) * 86400

    return {
        'enabled_tools': enabled_tools,
        'timeouts': {
            'semgrep': int(timeouts.get('semgrep', 600) or 600),
            'osv': int(timeouts.get('osv', 600) or 600),
            'gitleaks': int(timeouts.get('gitleaks', 600) or 600),
        },
        'retention_seconds': retention_seconds,
        'gitleaks_rule_severity_overrides': policy.get('gitleaks_rule_severity_overrides') or {},
    }


@shared_task
def health_task() -> str:
    return 'ok'


@shared_task
def ai_scan_summary(scan_id: int) -> dict:
    # AI enrichment is intentionally disabled in this environment by default.
    return {'enabled': False, 'detail': 'AI enrichment is not enabled.', 'scan_id': scan_id}


@shared_task
def ai_enrich_finding(finding_id: int) -> dict:
    # AI enrichment is intentionally disabled in this environment by default.
    return {'enabled': False, 'detail': 'AI enrichment is not enabled.', 'finding_id': finding_id}


@shared_task
def scan_repo(scan_id: int, zip_path: str | None = None) -> str:
    scan = Scan.objects.select_related('project').get(id=scan_id)
    correlation_id = str((scan.meta or {}).get('scan_correlation_id') or f'scan-{scan_id}')
    policy = _policy_for_scan(scan)
    uploaded_zip_path = str((scan.meta or {}).get('uploaded_zip_path') or '')

    _log_scan_event(scan_id, correlation_id, 'scan_starting', project_id=scan.project_id, enabled_tools=policy['enabled_tools'])

    scan.status = ScanStatus.RUNNING
    scan.started_at = timezone.now()
    scan.save(update_fields=['status', 'started_at', 'updated_at'])
    record_audit_event(scan=scan, event_type=AuditEventType.SCAN_STARTED, user=scan.project.created_by, message='Scan started.')

    try:
        if zip_path:
            commit_hash, ingestion_meta = ingest_scan_from_zip_path(scan, Path(zip_path))
        else:
            commit_hash, ingestion_meta = ingest_scan_source(scan)

        meta = dict(scan.meta or {})
        meta.update(ingestion_meta)
        scan.meta = meta
        if commit_hash:
            scan.commit_hash = commit_hash

        repo_dir = Path(ingestion_meta['repo_dir'])
        tool_versions = detect_tool_versions(repo_dir)
        tool_runs, tool_output_paths = run_all_tools(
            scan.id,
            repo_dir,
            enabled_tools=policy['enabled_tools'],
            tool_timeouts=policy['timeouts'],
        )
        scan.meta['tool_versions'] = tool_versions
        scan.meta['tool_runs'] = tool_runs
        scan.meta['tool_output_paths'] = tool_output_paths
        normalization = normalize_and_store_findings(
            scan,
            tool_output_paths,
            gitleaks_rule_severity_overrides=policy['gitleaks_rule_severity_overrides'],
        )
        scan.meta['normalization'] = normalization
        scan.meta['summary_counts'] = normalization['summary_counts']
        scan.status = ScanStatus.COMPLETED
        record_audit_event(
            scan=scan,
            event_type=AuditEventType.SCAN_COMPLETED,
            user=scan.project.created_by,
            message='Scan completed.',
            meta={'finding_count': normalization['persisted_total']},
        )
        _log_scan_event(
            scan_id,
            correlation_id,
            'scan_completed',
            summary_counts=normalization['summary_counts'],
            persisted_total=normalization['persisted_total'],
        )
    except Exception as exc:
        safe_error = truncate_text(redact_text(str(exc)), 1500)
        meta = dict(scan.meta or {})
        meta['ingestion_error'] = safe_error
        scan.meta = meta
        scan.status = ScanStatus.FAILED
        record_audit_event(
            scan=scan,
            event_type=AuditEventType.SCAN_FAILED,
            user=scan.project.created_by,
            message='Scan failed.',
            meta={'error': safe_error},
        )
        _log_scan_event(scan_id, correlation_id, 'scan_failed', error=safe_error)
    finally:
        scan.finished_at = timezone.now()
        scan.save(update_fields=['status', 'commit_hash', 'meta', 'finished_at', 'updated_at'])
        cleanup_scan_workspace(scan.id, retention_seconds=policy['retention_seconds'])
        if uploaded_zip_path:
            try:
                Path(uploaded_zip_path).unlink(missing_ok=True)
            except OSError:
                pass

    return scan.status

from pathlib import Path

from django.utils import timezone
from celery import shared_task

from apps.findings.normalizers import normalize_and_store_findings
from apps.scans.audit import record_audit_event

from .models import AuditEventType, Scan, ScanStatus
from .services import cleanup_scan_workspace, ingest_scan_from_zip_path, ingest_scan_source
from .tool_runners import run_all_tools


@shared_task
def health_task() -> str:
    return 'ok'


@shared_task
def scan_repo(scan_id: int, zip_path: str | None = None) -> str:
    scan = Scan.objects.select_related('project').get(id=scan_id)
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
        tool_runs, tool_output_paths = run_all_tools(scan.id, repo_dir)
        scan.meta['tool_runs'] = tool_runs
        scan.meta['tool_output_paths'] = tool_output_paths
        normalization = normalize_and_store_findings(scan, tool_output_paths)
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
    except Exception as exc:
        meta = dict(scan.meta or {})
        meta['ingestion_error'] = str(exc)
        scan.meta = meta
        scan.status = ScanStatus.FAILED
        record_audit_event(
            scan=scan,
            event_type=AuditEventType.SCAN_FAILED,
            user=scan.project.created_by,
            message='Scan failed.',
            meta={'error': str(exc)},
        )
    finally:
        scan.finished_at = timezone.now()
        scan.save(update_fields=['status', 'commit_hash', 'meta', 'finished_at', 'updated_at'])
        cleanup_scan_workspace(scan.id)

    return scan.status

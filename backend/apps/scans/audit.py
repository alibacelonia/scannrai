from apps.scans.models import AuditLog, Scan


def record_audit_event(scan: Scan, event_type: str, message: str = '', user=None, meta: dict | None = None) -> None:
    AuditLog.objects.create(
        user=user,
        scan=scan,
        event_type=event_type,
        message=message,
        meta=meta or {},
    )

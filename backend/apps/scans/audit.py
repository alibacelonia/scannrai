from apps.scans.models import AuditLog, Scan


def record_audit_event(scan: Scan, event_type: str, message: str = '', user=None, meta: dict | None = None) -> None:
    metadata = meta or {}
    AuditLog.objects.create(
        actor=user,
        action=event_type,
        entity_type='scan',
        entity_id=str(scan.id),
        metadata=metadata,
        user=user,
        scan=scan,
        event_type=event_type,
        message=message,
        meta=metadata,
    )

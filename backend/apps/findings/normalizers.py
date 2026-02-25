import hashlib
import json
from pathlib import Path

from django.db import transaction
from django.db.models import Count

from apps.scans.models import Scan

from .models import Finding, FindingSeverity, FindingTool

SEVERITY_ORDER = [
    FindingSeverity.CRITICAL,
    FindingSeverity.HIGH,
    FindingSeverity.MEDIUM,
    FindingSeverity.LOW,
    FindingSeverity.INFO,
]


def _hash_fingerprint(*parts: str) -> str:
    digest = hashlib.sha256()
    for part in parts:
        digest.update(part.encode('utf-8'))
        digest.update(b'|')
    return digest.hexdigest()


def _load_json_file(path: str) -> dict | list:
    payload_path = Path(path)
    if not payload_path.exists():
        return {}

    text = payload_path.read_text(encoding='utf-8').strip()
    if not text:
        return {}

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {'raw_text': text}


def _normalize_semgrep(payload: dict | list) -> list[dict]:
    if not isinstance(payload, dict):
        return []

    findings = []
    for result in payload.get('results', []):
        extra = result.get('extra', {})
        severity_label = str(extra.get('severity', 'info')).lower()
        severity_map = {
            'critical': FindingSeverity.CRITICAL,
            'error': FindingSeverity.HIGH,
            'high': FindingSeverity.HIGH,
            'warning': FindingSeverity.MEDIUM,
            'medium': FindingSeverity.MEDIUM,
            'low': FindingSeverity.LOW,
            'info': FindingSeverity.INFO,
        }
        severity = severity_map.get(severity_label, FindingSeverity.INFO)

        path = str(result.get('path', ''))
        start_line = (result.get('start') or {}).get('line')
        end_line = (result.get('end') or {}).get('line')
        check_id = str(result.get('check_id', 'unknown-rule'))
        message = str(extra.get('message', 'Semgrep finding'))

        findings.append(
            {
                'tool': FindingTool.SEMGREP,
                'severity': severity,
                'category': check_id[:120],
                'file_path': path,
                'line_start': start_line,
                'line_end': end_line,
                'raw': result,
                'fingerprint': _hash_fingerprint('semgrep', check_id, path, str(start_line), message),
            }
        )
    return findings


def _extract_osv_score(vulnerability: dict) -> float:
    severity_rows = vulnerability.get('severity') or []
    for row in severity_rows:
        score = row.get('score')
        if not score:
            continue
        try:
            if isinstance(score, (int, float)):
                return float(score)
            if isinstance(score, str):
                if score.upper().startswith('CVSS:'):
                    return float(score.split('/')[-1])
                return float(score)
        except (ValueError, TypeError):
            continue

    database_specific = vulnerability.get('database_specific') or {}
    score = database_specific.get('cvss_score')
    if score is not None:
        try:
            return float(score)
        except (ValueError, TypeError):
            return 0.0
    return 0.0


def _map_osv_severity(score: float) -> str:
    if score >= 9.0:
        return FindingSeverity.CRITICAL
    if score >= 7.0:
        return FindingSeverity.HIGH
    if score >= 4.0:
        return FindingSeverity.MEDIUM
    if score > 0.0:
        return FindingSeverity.LOW
    return FindingSeverity.INFO


def _normalize_osv(payload: dict | list) -> list[dict]:
    if not isinstance(payload, dict):
        return []

    findings = []
    for result in payload.get('results', []):
        packages = result.get('packages') or []
        vulns = result.get('vulns') or []
        for package_entry in packages:
            package = package_entry.get('package') or {}
            package_name = package.get('name') or package_entry.get('package_name') or 'unknown-package'
            package_version = package_entry.get('version') or 'unknown-version'
            file_path = package_entry.get('path') or ''

            for vuln in vulns:
                vuln_id = vuln.get('id') or 'unknown-vuln'
                score = _extract_osv_score(vuln)
                severity = _map_osv_severity(score)

                findings.append(
                    {
                        'tool': FindingTool.OSV,
                        'severity': severity,
                        'category': 'Dependency Vulnerability',
                        'file_path': str(file_path),
                        'line_start': None,
                        'line_end': None,
                        'raw': vuln,
                        'fingerprint': _hash_fingerprint(
                            'osv',
                            str(vuln_id),
                            str(package_name),
                            str(package_version),
                            str(file_path),
                        ),
                    }
                )
    return findings


def _mask_secret_payload(value):
    secret_like_keys = {'secret', 'match', 'line'}

    if isinstance(value, dict):
        masked = {}
        for key, item in value.items():
            if key.lower() in secret_like_keys:
                masked[key] = '***REDACTED***'
            else:
                masked[key] = _mask_secret_payload(item)
        return masked

    if isinstance(value, list):
        return [_mask_secret_payload(item) for item in value]

    return value


def _normalize_gitleaks(payload: dict | list) -> list[dict]:
    rows = payload if isinstance(payload, list) else payload.get('findings', []) if isinstance(payload, dict) else []
    findings = []

    for leak in rows:
        if not isinstance(leak, dict):
            continue

        file_path = str(leak.get('File', ''))
        rule_id = str(leak.get('RuleID', 'unknown-rule'))
        start_line = leak.get('StartLine')
        end_line = leak.get('EndLine')
        fingerprint = leak.get('Fingerprint')

        if not fingerprint:
            fingerprint = _hash_fingerprint('gitleaks', rule_id, file_path, str(start_line), str(end_line))

        findings.append(
            {
                'tool': FindingTool.GITLEAKS,
                'severity': FindingSeverity.HIGH,
                'category': 'Secrets',
                'file_path': file_path,
                'line_start': start_line,
                'line_end': end_line,
                'raw': _mask_secret_payload(leak),
                'fingerprint': str(fingerprint),
            }
        )

    return findings


def normalize_tool_outputs(tool_output_paths: dict) -> list[dict]:
    semgrep_payload = _load_json_file(tool_output_paths.get('semgrep', ''))
    osv_payload = _load_json_file(tool_output_paths.get('osv', ''))
    gitleaks_payload = _load_json_file(tool_output_paths.get('gitleaks', ''))

    findings: list[dict] = []
    findings.extend(_normalize_semgrep(semgrep_payload))
    findings.extend(_normalize_osv(osv_payload))
    findings.extend(_normalize_gitleaks(gitleaks_payload))
    return findings


def _summary_counts_for_scan(scan: Scan) -> dict[str, int]:
    rows = scan.findings.values('severity').order_by().annotate(total=Count('id'))
    counts = {severity: 0 for severity in SEVERITY_ORDER}
    for row in rows:
        counts[row['severity']] = row['total']
    return counts


def normalize_and_store_findings(scan: Scan, tool_output_paths: dict) -> dict:
    normalized = normalize_tool_outputs(tool_output_paths)

    unique_rows = {}
    for row in normalized:
        unique_rows[row['fingerprint']] = row

    finding_objects = [Finding(scan=scan, **row) for row in unique_rows.values()]

    with transaction.atomic():
        Finding.objects.bulk_create(finding_objects, ignore_conflicts=True)

    summary_counts = _summary_counts_for_scan(scan)
    return {
        'normalized_total': len(normalized),
        'deduped_total': len(unique_rows),
        'persisted_total': scan.findings.count(),
        'summary_counts': summary_counts,
    }

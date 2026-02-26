import json
from pathlib import Path
from typing import Any

from django.db import transaction
from django.db.models import Count

from apps.scans.security import fingerprint_for_finding, redact_object
from apps.scans.models import Scan

from .models import Finding, FindingSeverity, FindingTool

SEVERITY_ORDER = [
    FindingSeverity.CRITICAL,
    FindingSeverity.HIGH,
    FindingSeverity.MEDIUM,
    FindingSeverity.LOW,
    FindingSeverity.INFO,
]


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


def _severity_from_label(label: str, default: str = FindingSeverity.INFO) -> str:
    normalized = label.strip().lower()
    mapping = {
        'critical': FindingSeverity.CRITICAL,
        'error': FindingSeverity.HIGH,
        'high': FindingSeverity.HIGH,
        'warning': FindingSeverity.MEDIUM,
        'medium': FindingSeverity.MEDIUM,
        'moderate': FindingSeverity.MEDIUM,
        'low': FindingSeverity.LOW,
        'info': FindingSeverity.INFO,
    }
    return mapping.get(normalized, default)


def _extract_references(value: Any) -> list[dict[str, str]]:
    if isinstance(value, list):
        references: list[dict[str, str]] = []
        for item in value:
            if isinstance(item, str):
                references.append({'type': 'url', 'value': item})
            elif isinstance(item, dict):
                ref_type = str(item.get('type') or item.get('source') or 'reference')
                ref_value = str(item.get('url') or item.get('value') or item.get('id') or '').strip()
                if ref_value:
                    references.append({'type': ref_type[:64], 'value': ref_value[:512]})
        return references
    if isinstance(value, str) and value.strip():
        return [{'type': 'reference', 'value': value.strip()[:512]}]
    return []


def _normalize_semgrep(payload: dict | list) -> list[dict]:
    if not isinstance(payload, dict):
        return []

    findings = []
    for result in payload.get('results', []):
        if not isinstance(result, dict):
            continue

        extra = result.get('extra', {}) if isinstance(result.get('extra', {}), dict) else {}
        metadata = extra.get('metadata', {}) if isinstance(extra.get('metadata', {}), dict) else {}

        check_id = str(result.get('check_id', 'semgrep-rule'))[:120]
        message = str(extra.get('message', 'Semgrep finding')).strip()
        category = str(metadata.get('category') or check_id)[:120]
        severity = _severity_from_label(str(extra.get('severity', 'info')), default=FindingSeverity.INFO)
        path = str(result.get('path', ''))[:512]
        start_line = (result.get('start') or {}).get('line')
        end_line = (result.get('end') or {}).get('line')
        references = _extract_references(metadata.get('references'))

        fingerprint = fingerprint_for_finding(
            tool=FindingTool.SEMGREP,
            stable_rule_id=check_id,
            file_path=path,
            normalized_snippet_source={
                'message': message,
                'code': result.get('extra', {}).get('lines') if isinstance(result.get('extra', {}), dict) else '',
            },
            line_start=start_line,
            line_end=end_line,
        )

        findings.append(
            {
                'tool': FindingTool.SEMGREP,
                'severity': severity,
                'category': category,
                'title': check_id,
                'description': message[:5000],
                'file_path': path,
                'line_start': start_line,
                'line_end': end_line,
                'references': references,
                'raw': redact_object(result),
                'fingerprint': fingerprint,
            }
        )
    return findings


def _extract_osv_score(vulnerability: dict) -> float | None:
    severity_rows = vulnerability.get('severity') or []
    for row in severity_rows:
        score = row.get('score') if isinstance(row, dict) else None
        if score is None:
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

    database_specific = vulnerability.get('database_specific') if isinstance(vulnerability.get('database_specific'), dict) else {}
    db_score = database_specific.get('cvss_score')
    if db_score is not None:
        try:
            return float(db_score)
        except (ValueError, TypeError):
            return None
    return None


def _map_osv_severity(score: float | None) -> tuple[str, str | None]:
    if score is None:
        return FindingSeverity.MEDIUM, 'OSV payload had no CVSS score/severity; defaulted to medium.'
    if score >= 9.0:
        return FindingSeverity.CRITICAL, None
    if score >= 7.0:
        return FindingSeverity.HIGH, None
    if score >= 4.0:
        return FindingSeverity.MEDIUM, None
    if score > 0.0:
        return FindingSeverity.LOW, None
    return FindingSeverity.INFO, None


def _normalize_osv(payload: dict | list) -> list[dict]:
    if not isinstance(payload, dict):
        return []

    findings = []
    for result in payload.get('results', []):
        if not isinstance(result, dict):
            continue

        packages = result.get('packages') if isinstance(result.get('packages'), list) else []
        result_level_vulns = result.get('vulns') or result.get('vulnerabilities') or []
        source_path = str((result.get('source') or {}).get('path') or '')[:512]

        for package_entry in packages:
            if not isinstance(package_entry, dict):
                continue

            package = package_entry.get('package') if isinstance(package_entry.get('package'), dict) else {}
            package_name = str(package.get('name') or package_entry.get('package_name') or 'unknown-package')
            package_version = str(package.get('version') or package_entry.get('version') or 'unknown-version')
            file_path = str(package_entry.get('path') or source_path)[:512]
            package_vulns = package_entry.get('vulnerabilities')
            if not isinstance(package_vulns, list):
                package_vulns = result_level_vulns if isinstance(result_level_vulns, list) else []

            for vuln in package_vulns:
                if not isinstance(vuln, dict):
                    continue

                vuln_id = str(vuln.get('id') or 'unknown-vuln')
                db_specific = vuln.get('database_specific') if isinstance(vuln.get('database_specific'), dict) else {}

                severity_label = str(db_specific.get('severity') or '').strip()
                if severity_label:
                    severity = _severity_from_label(severity_label, default=FindingSeverity.MEDIUM)
                    severity_note = None
                else:
                    severity, severity_note = _map_osv_severity(_extract_osv_score(vuln))

                aliases = vuln.get('aliases') if isinstance(vuln.get('aliases'), list) else []
                references = _extract_references(vuln.get('references'))
                references.extend(_extract_references(aliases))

                description_parts = [
                    f'Package `{package_name}` `{package_version}` is affected by `{vuln_id}`.',
                ]
                if severity_note:
                    description_parts.append(severity_note)
                summary_text = str(vuln.get('summary') or vuln.get('details') or '').strip()
                if summary_text:
                    description_parts.append(summary_text[:2000])

                findings.append(
                    {
                        'tool': FindingTool.OSV,
                        'severity': severity,
                        'category': 'Dependency Vulnerability',
                        'title': vuln_id[:255],
                        'description': ' '.join(description_parts)[:5000],
                        'file_path': file_path,
                        'line_start': None,
                        'line_end': None,
                        'references': references[:50],
                        'raw': redact_object(vuln),
                        'fingerprint': fingerprint_for_finding(
                            tool=FindingTool.OSV,
                            stable_rule_id=vuln_id,
                            file_path=file_path,
                            normalized_snippet_source={
                                'package': package_name,
                                'version': package_version,
                                'aliases': aliases,
                            },
                            line_start=None,
                            line_end=None,
                        ),
                    }
                )
    return findings


def _normalize_gitleaks(payload: dict | list, rule_severity_map: dict[str, str] | None = None) -> list[dict]:
    rows = payload if isinstance(payload, list) else payload.get('findings', []) if isinstance(payload, dict) else []
    findings = []
    normalized_rule_map = {str(key): _severity_from_label(str(value), default=FindingSeverity.HIGH) for key, value in (rule_severity_map or {}).items()}

    for leak in rows:
        if not isinstance(leak, dict):
            continue

        file_path = str(leak.get('File', ''))[:512]
        rule_id = str(leak.get('RuleID', 'gitleaks-rule'))
        start_line = leak.get('StartLine')
        end_line = leak.get('EndLine')
        description = str(leak.get('Description') or 'Potential secret exposure detected by Gitleaks.').strip()

        severity = normalized_rule_map.get(rule_id, FindingSeverity.HIGH)

        findings.append(
            {
                'tool': FindingTool.GITLEAKS,
                'severity': severity,
                'category': 'Secrets',
                'title': rule_id[:255],
                'description': description[:5000],
                'file_path': file_path,
                'line_start': start_line,
                'line_end': end_line,
                'references': _extract_references(leak.get('Commit') or ''),
                'raw': redact_object(leak),
                'fingerprint': fingerprint_for_finding(
                    tool=FindingTool.GITLEAKS,
                    stable_rule_id=rule_id,
                    file_path=file_path,
                    normalized_snippet_source={
                        'description': description,
                        'entropy': leak.get('Entropy'),
                    },
                    line_start=start_line,
                    line_end=end_line,
                ),
            }
        )

    return findings


def normalize_tool_outputs(tool_output_paths: dict, *, gitleaks_rule_severity_overrides: dict | None = None) -> list[dict]:
    semgrep_payload = _load_json_file(tool_output_paths.get('semgrep', ''))
    osv_payload = _load_json_file(tool_output_paths.get('osv', ''))
    gitleaks_payload = _load_json_file(tool_output_paths.get('gitleaks', ''))

    findings: list[dict] = []
    findings.extend(_normalize_semgrep(semgrep_payload))
    findings.extend(_normalize_osv(osv_payload))
    findings.extend(_normalize_gitleaks(gitleaks_payload, rule_severity_map=gitleaks_rule_severity_overrides))
    return findings


def _summary_counts_for_scan(scan: Scan) -> dict[str, int]:
    rows = scan.findings.values('severity').order_by().annotate(total=Count('id'))
    counts = {severity: 0 for severity in SEVERITY_ORDER}
    for row in rows:
        counts[row['severity']] = row['total']
    return counts


def normalize_and_store_findings(
    scan: Scan,
    tool_output_paths: dict,
    *,
    gitleaks_rule_severity_overrides: dict | None = None,
) -> dict:
    normalized = normalize_tool_outputs(
        tool_output_paths,
        gitleaks_rule_severity_overrides=gitleaks_rule_severity_overrides,
    )

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

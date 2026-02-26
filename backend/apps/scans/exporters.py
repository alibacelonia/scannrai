from apps.scans.models import Scan
from apps.scans.security import redact_object


def build_scan_export_json(scan: Scan) -> dict:
    findings = [
        {
            'id': finding.id,
            'tool': finding.tool,
            'severity': finding.severity,
            'category': finding.category,
            'title': finding.title,
            'description': finding.description,
            'file_path': finding.file_path,
            'line_start': finding.line_start,
            'line_end': finding.line_end,
            'fingerprint': finding.fingerprint,
            'references': finding.references,
            'raw': redact_object(finding.raw),
            'ai_explanation': finding.ai_explanation,
            'ai_fix_suggestion': finding.ai_fix_suggestion,
            'ai_patch_diff': finding.ai_patch_diff,
            'confidence': finding.confidence,
        }
        for finding in scan.findings.all().order_by('-created_at')
    ]

    summary = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0, 'info': 0}
    for finding in findings:
        summary[finding['severity']] += 1

    return {
        'scan': {
            'id': scan.id,
            'project': scan.project_id,
            'status': scan.status,
            'commit_hash': scan.commit_hash,
            'started_at': scan.started_at.isoformat() if scan.started_at else None,
            'finished_at': scan.finished_at.isoformat() if scan.finished_at else None,
            'created_at': scan.created_at.isoformat(),
            'meta': scan.meta,
            'ai_summary': scan.ai_summary,
        },
        'summary': summary,
        'findings': findings,
    }


def build_scan_export_markdown(scan: Scan) -> str:
    payload = build_scan_export_json(scan)
    summary = payload['summary']

    lines = [
        f"# ScannrAI Report — Scan #{scan.id}",
        '',
        f"- Project ID: `{scan.project_id}`",
        f"- Status: `{scan.status}`",
        f"- Commit hash: `{scan.commit_hash or 'n/a'}`",
        '',
        '## Summary',
        '',
        f"- Critical: **{summary['critical']}**",
        f"- High: **{summary['high']}**",
        f"- Medium: **{summary['medium']}**",
        f"- Low: **{summary['low']}**",
        f"- Info: **{summary['info']}**",
        '',
    ]

    if scan.ai_summary:
        lines.extend(['## AI Summary', '', scan.ai_summary, ''])

    lines.extend(['## Findings', '', '| Severity | Tool | Title | File | Lines |', '|---|---|---|---|---|'])

    for finding in payload['findings']:
        line_range = (
            f"{finding['line_start']}-{finding['line_end']}"
            if finding['line_start'] and finding['line_end']
            else str(finding['line_start'] or '-')
        )
        title = str(finding.get('title') or finding['category']).replace('|', '/')
        lines.append(
            f"| {finding['severity']} | {finding['tool']} | {title} | {finding['file_path'] or '-'} | {line_range} |"
        )

    if not payload['findings']:
        lines.append('| - | - | - | - | - |')

    return '\n'.join(lines)

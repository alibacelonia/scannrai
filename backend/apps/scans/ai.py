import re
from collections import Counter

from apps.findings.models import Finding
from apps.scans.models import Scan

REVIEW_WARNING = 'Review before applying. AI suggestions may be incomplete or incorrect.'

SECRET_PATTERNS = [
    re.compile(r'(?i)(api[_-]?key\s*[=:]\s*[\"\']?)([a-z0-9_\-]{8,})'),
    re.compile(r'(?i)(secret\s*[=:]\s*[\"\']?)([a-z0-9_\-]{8,})'),
    re.compile(r'(?i)(token\s*[=:]\s*[\"\']?)([a-z0-9_\-]{8,})'),
]


def redact_text(value: str) -> str:
    redacted = value
    for pattern in SECRET_PATTERNS:
        redacted = pattern.sub(r'\1***REDACTED***', redacted)
    return redacted


def _severity_priority(severity: str) -> int:
    priorities = {'critical': 5, 'high': 4, 'medium': 3, 'low': 2, 'info': 1}
    return priorities.get(severity, 0)


def build_scan_summary(scan: Scan) -> str:
    findings = list(scan.findings.values('severity', 'category', 'tool'))
    if not findings:
        return 'No findings were detected for this scan. Risk score: 0/100.'

    severity_counts = Counter(row['severity'] for row in findings)
    category_counts = Counter(row['category'] for row in findings)
    tool_counts = Counter(row['tool'] for row in findings)

    risk_score = min(
        100,
        severity_counts.get('critical', 0) * 30
        + severity_counts.get('high', 0) * 15
        + severity_counts.get('medium', 0) * 7
        + severity_counts.get('low', 0) * 3
        + severity_counts.get('info', 0),
    )

    top_categories = ', '.join(name for name, _ in category_counts.most_common(3))
    top_tools = ', '.join(f'{name}: {count}' for name, count in tool_counts.items())

    lines = [
        f'Risk score: {risk_score}/100.',
        'Executive summary: Findings were detected and should be triaged by severity.',
        (
            'Severity counts: '
            f"critical={severity_counts.get('critical', 0)}, "
            f"high={severity_counts.get('high', 0)}, "
            f"medium={severity_counts.get('medium', 0)}, "
            f"low={severity_counts.get('low', 0)}, "
            f"info={severity_counts.get('info', 0)}."
        ),
        f'Top categories: {top_categories or "n/a"}.',
        f'Tool distribution: {top_tools or "n/a"}.',
        'Quick wins: Resolve critical/high issues first, then address recurring categories.',
    ]
    return '\n'.join(lines)


def build_finding_explanation(finding: Finding) -> tuple[str, str, float]:
    severity = finding.severity
    category = finding.category

    risk_sentence = {
        'critical': 'This can lead to immediate compromise if exploitable.',
        'high': 'This likely has meaningful security impact and should be fixed quickly.',
        'medium': 'This is a moderate risk and should be scheduled for remediation.',
        'low': 'This is a low-risk issue but should still be tracked and resolved.',
        'info': 'This is informational and should be reviewed for relevance.',
    }.get(severity, 'This issue should be reviewed by an engineer.')

    explanation = (
        f'Category: {category}. Tool: {finding.tool}. Severity: {severity}. '
        f'{risk_sentence} Validate exploitability in context and prioritize based on exposure.'
    )

    fix_suggestion = (
        f'Apply least-privilege and input validation controls for {category.lower()}. '
        'Add regression tests to prevent reintroduction and verify the fix in CI.'
    )

    confidence_by_tool = {'semgrep': 0.72, 'osv': 0.86, 'gitleaks': 0.9}
    confidence = confidence_by_tool.get(finding.tool, 0.65)

    return redact_text(explanation), redact_text(fix_suggestion), confidence


def build_patch_suggestion(finding: Finding) -> str:
    file_path = finding.file_path or 'unknown-file'
    start = finding.line_start or 1
    end = finding.line_end or start

    patch = [
        f'--- a/{file_path}',
        f'+++ b/{file_path}',
        f'@@ -{start},{max(1, end - start + 1)} +{start},{max(1, end - start + 1)} @@',
        '-# vulnerable code',
        '+# TODO: apply safe remediation for this finding',
    ]

    return '\n'.join(patch)

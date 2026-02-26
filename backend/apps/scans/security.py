import hashlib
import json
import re
from typing import Any

SECRET_PATTERNS = [
    re.compile(r"(?i)(api[_-]?key\s*[:=]\s*[\"']?)([a-z0-9_\-]{8,})"),
    re.compile(r"(?i)(secret\s*[:=]\s*[\"']?)([a-z0-9_\-]{8,})"),
    re.compile(r"(?i)(token\s*[:=]\s*[\"']?)([a-z0-9_\-]{8,})"),
    re.compile(r"(?i)(password\s*[:=]\s*[\"']?)([^\s\"']{6,})"),
    re.compile(r"\b(AKIA[0-9A-Z]{16})\b"),
    re.compile(r"\b(xox[baprs]-[A-Za-z0-9\-]{10,})\b"),
]

SECRET_LIKE_KEYS = {
    'secret',
    'match',
    'line',
    'token',
    'password',
    'apikey',
    'api_key',
    'authorization',
    'private_key',
}


def redact_text(value: str) -> str:
    redacted = value
    for pattern in SECRET_PATTERNS:
        def _replacement(match: re.Match[str]) -> str:
            if match.lastindex and match.lastindex >= 1:
                prefix = match.group(1) or ''
                return f'{prefix}***REDACTED***'
            return '***REDACTED***'

        redacted = pattern.sub(_replacement, redacted)
    return redacted


def redact_object(value: Any) -> Any:
    if isinstance(value, dict):
        sanitized = {}
        for key, nested in value.items():
            if str(key).lower() in SECRET_LIKE_KEYS:
                sanitized[key] = '***REDACTED***'
            else:
                sanitized[key] = redact_object(nested)
        return sanitized
    if isinstance(value, list):
        return [redact_object(item) for item in value]
    if isinstance(value, str):
        return redact_text(value)
    return value


def truncate_text(value: str, max_chars: int) -> str:
    if max_chars <= 0:
        return ''
    if len(value) <= max_chars:
        return value
    return f"{value[:max_chars]}\n...[truncated {len(value) - max_chars} chars]"


def stable_json_hash(value: Any) -> str:
    encoded = json.dumps(value, sort_keys=True, ensure_ascii=True, default=str)
    return hashlib.sha256(encoded.encode('utf-8')).hexdigest()


def fingerprint_for_finding(
    tool: str,
    stable_rule_id: str,
    file_path: str,
    normalized_snippet_source: Any,
    line_start: int | None,
    line_end: int | None,
) -> str:
    snippet_hash = stable_json_hash(normalized_snippet_source)
    line_range = f"{line_start or 0}:{line_end or line_start or 0}"
    raw = f"{tool}|{stable_rule_id}|{file_path}|{snippet_hash}|{line_range}"
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()

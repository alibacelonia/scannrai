from pathlib import Path

from rest_framework import serializers

from apps.scans.security import redact_object, redact_text

from .models import Finding


class FindingSerializer(serializers.ModelSerializer):
    raw = serializers.SerializerMethodField()

    class Meta:
        model = Finding
        fields = (
            'id',
            'scan',
            'tool',
            'severity',
            'category',
            'title',
            'description',
            'file_path',
            'line_start',
            'line_end',
            'references',
            'raw',
            'fingerprint',
            'ai_explanation',
            'ai_fix_suggestion',
            'ai_patch_diff',
            'confidence',
            'created_at',
        )
        read_only_fields = ('id', 'created_at')

    def get_raw(self, obj: Finding):
        return redact_object(obj.raw)


class FindingDetailSerializer(FindingSerializer):
    snippet = serializers.SerializerMethodField()

    class Meta(FindingSerializer.Meta):
        fields = FindingSerializer.Meta.fields + ('snippet',)

    def _snippet_from_workspace_file(self, obj: Finding):
        if not obj.file_path:
            return None

        repo_dir = str((obj.scan.meta or {}).get('repo_dir', '')).strip()
        if not repo_dir:
            return None

        repo_path = Path(repo_dir).resolve()
        target_path = (repo_path / obj.file_path).resolve()

        if target_path != repo_path and repo_path not in target_path.parents:
            return None
        if not target_path.exists() or not target_path.is_file():
            return None

        try:
            content_lines = target_path.read_text(encoding='utf-8', errors='replace').splitlines()
        except OSError:
            return None

        if not content_lines:
            return None

        start_line = max((obj.line_start or 1) - 3, 1)
        end_line = min((obj.line_end or obj.line_start or 1) + 3, len(content_lines))
        rows = []
        highlight_start = obj.line_start
        highlight_end = obj.line_end or obj.line_start
        for line_number in range(start_line, end_line + 1):
            rows.append(
                {
                    'line_number': line_number,
                    'content': redact_text(content_lines[line_number - 1]),
                    'highlighted': bool(highlight_start and highlight_end and highlight_start <= line_number <= highlight_end),
                }
            )

        return {'start_line': start_line, 'end_line': end_line, 'lines': rows}

    def _snippet_from_raw_payload(self, obj: Finding):
        raw = obj.raw if isinstance(obj.raw, dict) else {}

        lines: list[str] = []
        if obj.tool == 'semgrep':
            extra = raw.get('extra') if isinstance(raw.get('extra'), dict) else {}
            raw_lines = extra.get('lines')
            if isinstance(raw_lines, str) and raw_lines.strip():
                lines = raw_lines.splitlines()
        elif obj.tool == 'gitleaks':
            raw_line = raw.get('line')
            if isinstance(raw_line, str) and raw_line.strip():
                lines = [raw_line]

        if not lines:
            return None

        start_line = obj.line_start or 1
        rows = []
        for idx, content in enumerate(lines):
            rows.append(
                {
                    'line_number': start_line + idx,
                    'content': redact_text(content),
                    'highlighted': True,
                }
            )
        return {'start_line': start_line, 'end_line': start_line + len(lines) - 1, 'lines': rows}

    def get_snippet(self, obj: Finding):
        return self._snippet_from_workspace_file(obj) or self._snippet_from_raw_payload(obj)

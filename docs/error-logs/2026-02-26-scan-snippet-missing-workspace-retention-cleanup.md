# 2026-02-26 — Finding snippet missing despite line numbers (`/scans/87`)

## Summary
On scan detail page, clicking a finding opened the detail drawer but `Code Snippet` tab was empty even when `Lines` showed a valid range (example: `15-15`).

## Symptom
- UI: `Code Snippet` tab shows no snippet content.
- DB: finding line range exists (`line_start=15`, `line_end=15`).
- Scan metadata points to workspace repo path (example: `/tmp/scannrai/87/repo`).

## Root Cause
Two issues combined:
1. **Workspace retention cleanup used filesystem mtime** to decide stale scan workspaces.
   - For local cloned/copied repos, directory mtime can reflect source repo timestamps (older than retention window).
   - Cleanup could delete workspace directories prematurely even when scan `finished_at` was still within retention.
2. **Snippet API depended only on workspace file reads**.
   - If workspace had already been cleaned, serializer returned `snippet=None`.

## Fix Applied
1. Updated cleanup strategy in `backend/apps/scans/services.py`:
   - cleanup now uses `Scan.finished_at` (DB timestamps) to identify stale workspaces.
   - skips current workspace while retention is active.
   - keeps mtime fallback only for non-standard directories.
2. Added snippet fallback in `backend/apps/findings/serializers.py`:
   - if file is missing from workspace, derive snippet from sanitized raw payload (`semgrep extra.lines`, `gitleaks line` when present).

## Verification
- Checked failing record:
  - scan `87`, finding `459`
  - workspace path missing on disk
  - finding had raw semgrep `extra.lines`.
- After fix, serializer returns snippet:
  - `start_line=15`, `end_line=15`
  - line content populated.
- Added regression tests:
  - `WorkspaceCleanupTests.test_cleanup_uses_scan_finished_at_not_workspace_mtime`
  - `FindingAiEndpointsTests.test_finding_detail_snippet_falls_back_to_raw_when_workspace_missing`
- Full backend suite passed:
  - `apps.projects.tests`, `apps.scans.tests`, `apps.findings.tests`

## Prevention / Future Reference
- Use DB lifecycle timestamps for retention decisions, not source-derived filesystem mtimes.
- Keep evidence fallback in API response path so older scans can still show minimal context after workspace cleanup.

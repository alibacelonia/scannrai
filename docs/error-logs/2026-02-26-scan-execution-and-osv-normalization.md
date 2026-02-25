# 2026-02-26 — Scan marked completed but tools/findings were not fully working

## Summary
Scans returned `completed`, but actual scanner execution and normalization were partially broken:
- Backend API container did not have scanner binaries.
- Semgrep failed at runtime due missing `pkg_resources`.
- OSV output parsed successfully but vulnerabilities were not normalized into findings (new payload shape mismatch).

## Symptom
- `tool_runs` showed `No such file or directory` for `semgrep`, `osv-scanner`, `gitleaks` in backend scans.
- After binaries were installed, Semgrep still errored with:
  - `ModuleNotFoundError: No module named 'pkg_resources'`
- Even when OSV output contained vulnerabilities, findings summary remained all zeros.

## Root Cause
1. Scan execution runs in backend request flow, but scanner tools were only installed in `scanner/worker` image.
2. Semgrep dependency chain needs `pkg_resources`; `setuptools>=81` no longer provides it.
3. OSV normalizer only supported legacy `result.vulns`; current OSV output nests vulnerabilities under each package (`result.packages[].vulnerabilities`), and severity often comes from `database_specific.severity`.

## Fix Applied
1. Installed scanner tools in backend image too:
   - Semgrep, OSV Scanner, Gitleaks in `infra/docker/backend.Dockerfile`.
2. Pinned setuptools for Semgrep compatibility:
   - `setuptools<81` in both backend and scanner images.
3. Updated OSV normalizer:
   - Support both legacy and current OSV payload shapes.
   - Use `database_specific.severity` when present, fallback to score mapping.

## Verification
- Live API scan validation before fix:
  - tools missing or semgrep runtime error
  - normalized findings `0`
- Live API scan validation after fix:
  - `semgrep: exit=0 error=None`
  - `osv: exit=1 error=None` (non-zero with vulnerabilities present)
  - `gitleaks: exit=1 error=None` (non-zero behavior depending on findings)
  - findings normalized and persisted:
    - `normalized_total: 76`
    - summary included non-zero critical/high/medium/low/info counts
- Automated tests:
  - `backend/manage.py test apps.findings.tests apps.scans.tests` passed.

## Files Changed
- `infra/docker/backend.Dockerfile`
- `infra/docker/scanner.Dockerfile`
- `backend/apps/findings/normalizers.py`
- `backend/apps/findings/tests.py`

## Prevention
- Ensure scan execution runtime always includes required CLI tools.
- Keep parser compatibility tests for external tool output schema changes.
- Treat tool runtime errors as first-class health signals in scan verification.

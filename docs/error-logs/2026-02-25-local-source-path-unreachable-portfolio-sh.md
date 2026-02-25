# 2026-02-25 — Local source path unreachable (`/host/home/portfolio.sh`)

## Summary
Opening a local source failed with:
- `Repository source path is not accessible from scanner runtime: /host/home/portfolio.sh`

## Symptom
- User attempted local open/scan with source path `/host/home/portfolio.sh`.
- Scan API returned source access error.
- Earlier behavior could queue a task that failed quickly in worker.

## Root Cause
- Path was not a valid repository source reachable from scanner runtime.
- It was likely derived from folder-name-only inference when browser did not expose absolute path.
- In many setups repos live under nested folders (for example `/host/home/personal-projects/...`), so `/host/home/<name>` is incomplete.

## Fix Applied
1. Removed risky folder fallback path autofill in dashboard:
   - no automatic `/host/home/<folder>` assignment when absolute path is unknown.
   - user is prompted to enter full container-visible path manually.
2. Improved backend validation error message with actionable hint:
   - includes expected base mount and full path example.
3. Confirmed pre-queue validation blocks invalid source before worker enqueue.

## Verification
- Invalid path check:
  - source `/host/home/portfolio.sh`
  - `POST /api/projects/{id}/scans/` returns `400`
  - response now includes hint:
    - use full path under `/host/home`, e.g. `/host/home/personal-projects/<repo-folder>`
  - no worker task received.
- Automated checks:
  - backend tests (`apps.projects.tests`, `apps.scans.tests`) passed
  - frontend lint/build passed

## Prevention / Future Reference
- When browser folder picker cannot provide absolute path, always require explicit manual path input.
- Prefer fully qualified local source paths including parent directories.

# 2026-02-25 — `scan_repo` task failed quickly due invalid local source path

## Summary
Worker received a queued scan task and returned `failed` in ~0.1s because the project source path was invalid for runtime access.

## Symptom
- Worker log:
  - `Task apps.scans.tasks.scan_repo[...] received`
  - `... succeeded ...: 'failed'`
- Scan metadata:
  - `ingestion_error: Repository source path is not accessible from scanner runtime: /host/home/portfolio.sh`

## Root Cause
- Local source path was invalid (`/host/home/portfolio.sh`) and not a mounted, accessible repository source.
- Source validation happened only in worker ingestion path, so task was still queued and failed immediately.
- Folder picker fallback could suggest non-folder-style paths when browser path info was incomplete.

## Fix Applied
1. Added backend pre-queue source validation endpoint:
   - `POST /api/projects/validate-source/`
   - validates local git folders (`.git`) and local zip archives before scan queueing.
2. Added scan preflight validation in project scan creation:
   - rejects invalid sources with `400` instead of queueing a doomed worker task.
3. Updated dashboard local folder selection flow:
   - validates inferred local path via backend API before opening.
   - avoids unreliable fallback when folder path cannot be inferred from browser selection.

## Verification
- Invalid source test:
  - create project with `/host/home/portfolio.sh`
  - `POST /api/projects/{id}/scans/` now returns `400` with clear detail.
  - no worker task is queued.
- Valid source test:
  - create project with `/host/home/personal-projects/scannrai`
  - scan creation returns `queued` with task id
  - worker receives task and scan enters `running`.
- Automated checks passed:
  - backend tests: `apps.projects.tests`, `apps.scans.tests`
  - frontend lint/build

## Prevention / Future Reference
- Keep source validation at API boundary (before task enqueue).
- Treat folder-picker-derived paths as tentative until server-side validation succeeds.

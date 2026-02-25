# 2026-02-25 — Local git scan failed on dangling symlinks

## Summary
`scan_repo` tasks were received and executed by Celery, but returned `'failed'` when ingesting some local repositories that contain broken/generated symlinks (common in mobile/Flutter workspaces).

## Symptom
- Worker logs:
  - `Task apps.scans.tasks.scan_repo[...] received`
  - `... succeeded in ...: 'failed'`
- Scan details in DB showed `status=failed` with `meta.ingestion_error` containing many `Errno 2` paths under:
  - `.venv/bin/*`
  - `mobile/*/.symlinks/*`
  - `flutter/ephemeral/.plugin_symlinks/*`
- Postgres `checkpoint starting/complete` logs seen around the same time were normal background activity, not the failure cause.

## Root Cause
In `backend/apps/scans/services.py`, local git ingestion used:
- `shutil.copytree(..., dirs_exist_ok=True, ignore=...)`

With default `symlinks=False`, `copytree` tries to copy the *target* of symlinks. For dangling links, this raises `FileNotFoundError` and aborts ingestion before tool execution.

## Fix Applied
Updated local git ingestion to preserve symlinks instead of following them:
- `shutil.copytree(..., symlinks=True, dirs_exist_ok=True, ignore=...)`

This allows ingestion to complete even when repository contains broken/generated symlinks.

## Regression Test Added
- `backend/apps/scans/tests.py`
  - `test_local_git_repo_with_dangling_symlink_completes_scan`

Test creates a local git repo with a dangling symlink and verifies scan reaches `completed` without `ingestion_error`.

## Verification
1. Targeted tests (SQLite):
   - `USE_SQLITE=1 ... manage.py test apps.scans.tests.ScanApiTests.test_local_git_repo_with_dangling_symlink_completes_scan` -> `OK`
   - Additional scan API tests run -> `OK`
2. Live runtime re-check against same failing project pattern:
   - Created a new scan from the same project source that previously failed
   - Result: `status=completed`
   - `ingestion_error` absent
   - Tool runs persisted normally

## Prevention / Future Reference
- Treat local repo ingestion as filesystem-hostile input (dangling symlinks are normal in some stacks).
- Keep symlink handling explicit in copy logic.
- When worker log says `succeeded ...: 'failed'`, inspect `Scan.meta.ingestion_error` first; it indicates business failure path, not Celery failure.

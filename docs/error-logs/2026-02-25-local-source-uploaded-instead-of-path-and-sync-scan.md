# 2026-02-25 — Local source was uploaded and scan ran synchronously

## Summary
Opening a local source from the dashboard uploaded repository files through the browser and executed the full scan inside the API request. This was slow, unnecessary for local paths, and bypassed the intended MQ background flow.

## Symptom
- Local open action showed uploading behavior.
- API `POST /api/projects/:id/scans/` executed ingestion + scanners inline.
- Scan creation response returned final status only after tool execution finished.

## Root Cause
- Frontend local flow used multipart upload (`zip_file` / `repo_files`) instead of source path references.
- Backend project scan endpoint performed ingestion, tool runs, and normalization in request/response path rather than queuing worker jobs.

## Fix Applied
1. Switched local source to path-based project configuration (no upload).
2. Switched scan execution to Celery queue:
   - API now creates `queued` scan and calls `scan_repo.delay(scan_id)`.
   - Worker executes ingestion + scanner tools + normalization.
3. Added local path resolution support in scanner services:
   - local git directory source (`local_git`)
   - local zip path source (`local_zip`)
4. Added Docker compose host-home mount + mapping env so local host paths are accessible in containers.
5. Added local folder picker workflow in UI:
   - `Select repo folder` opens folder selection dialog
   - selected folder is validated for git metadata (`.git`) before open
6. Added backend pre-queue source validation:
   - reject local folders without `.git`
   - reject invalid `.zip` archives
   - fail fast with `400` before queueing

## Verification
- Backend tests:
  - `USE_SQLITE=1 ... manage.py test apps.projects.tests apps.scans.tests`
  - result: `OK`
- Frontend checks:
  - `npm run lint`
  - `npm run build`
  - both passed
- New behavior confirmed in code:
  - upload payloads rejected by API scan endpoint
  - local source is entered as path in dashboard
  - scan request returns `queued` and worker processes in background

## Prevention / Future Reference
- Keep scan endpoint thin: enqueue only, avoid CPU-heavy work in request cycle.
- Preserve path-based local source model for desktop/local workflows where worker can access filesystem directly.
- If local path is inaccessible in container runtime, validate mount mappings first:
  - `${HOME}` mounted read-only to `${LOCAL_REPO_MOUNT_PATH}` (`/host/home` default).

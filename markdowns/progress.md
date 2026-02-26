## 2026-02-25 — Added local source path auto-discovery when browser hides absolute folder path
- Investigated local open blocker where folder picker warning appeared and user could not proceed reliably.
- Added backend discovery API:
  - `POST /api/projects/discover-source/` to find candidate local paths by selected folder name.
- Updated dashboard fallback flow:
  - auto-discover source candidates when absolute path is unavailable
  - auto-fill if single candidate
  - show candidate selection buttons if multiple matches
  - keep manual path guidance if no matches
- Added backend test coverage for discovery endpoint.
- Logged incident details in:
  - `docs/error-logs/2026-02-25-folder-picker-no-absolute-path-cannot-open.md`

### Files changed
- `backend/apps/scans/services.py`
- `backend/apps/projects/views.py`
- `backend/apps/projects/tests.py`
- `frontend/src/lib/api.ts`
- `frontend/src/app/(app)/dashboard/page.tsx`
- `docs/error-logs/README.md`
- `docs/error-logs/2026-02-25-folder-picker-no-absolute-path-cannot-open.md`
- `markdowns/progress.md`

### Commands run
- `USE_SQLITE=1 /Users/ralphvincent/.pyenv/versions/3.12.11/bin/python3 backend/manage.py test apps.projects.tests apps.scans.tests`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`

## 2026-02-25 — Fixed stale example path in folder picker warning
- Investigated incorrect warning text after local folder selection:
  - selected folder name and example path could mismatch.
- Root cause was stale React state usage (`selectedLocalFolder`) in same event cycle as state update.
- Updated dashboard handler to build warning example from current selection variable (`rootFolder`) instead of state.
- Cleared selected folder hint after successful local open to avoid stale UI context.
- Logged incident details in:
  - `docs/error-logs/2026-02-25-folder-picker-stale-example-path.md`

### Files changed
- `frontend/src/app/(app)/dashboard/page.tsx`
- `docs/error-logs/README.md`
- `docs/error-logs/2026-02-25-folder-picker-stale-example-path.md`
- `markdowns/progress.md`

### Commands run
- `cd frontend && npm run lint`
- `cd frontend && npm run build`

## 2026-02-26 — Fixed scan-page unauthorized logout during polling
- Investigated issue where user was redirected to login while passively waiting for scan completion.
- Root cause:
  - frontend cleared tokens on first `401` from scan polling endpoints.
  - no refresh-token flow was implemented in API client.
- Fixes applied:
  - added `getRefreshToken()` in auth helper.
  - implemented refresh+retry-once in authenticated `apiRequest()` flow.
  - added single-flight refresh guard to prevent concurrent refresh races.
  - aligned export blob requests (`export.json`/`export.md`) to use same refresh behavior.
- Logged issue in:
  - `docs/error-logs/2026-02-26-scan-polling-unauthorized-session-drop.md`

### Commands run
- `cd frontend && npm run lint`
- `cd frontend && npm run build`

## 2026-02-25 — Fixed local path fallback causing `/host/home/portfolio.sh` runtime access errors
- Investigated local source failure:
  - `Repository source path is not accessible from scanner runtime: /host/home/portfolio.sh`
- Root cause was unreliable folder-name-only fallback when browser could not expose absolute folder path.
- Updated dashboard local picker flow:
  - removed automatic `/host/home/<folder>` path autofill
  - now requires explicit full path entry when absolute path is unavailable
- Improved backend validation error details with concrete path guidance.
- Re-verified invalid path now fails fast with `400` and does not enqueue a worker task.
- Logged incident details in:
  - `docs/error-logs/2026-02-25-local-source-path-unreachable-portfolio-sh.md`

### Files changed
- `frontend/src/app/(app)/dashboard/page.tsx`
- `backend/apps/scans/services.py`
- `docs/error-logs/README.md`
- `docs/error-logs/2026-02-25-local-source-path-unreachable-portfolio-sh.md`
- `markdowns/progress.md`

### Commands run
- `USE_SQLITE=1 /Users/ralphvincent/.pyenv/versions/3.12.11/bin/python3 backend/manage.py test apps.projects.tests apps.scans.tests`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `docker compose restart backend worker`
- runtime check via API: invalid `/host/home/portfolio.sh` returns `400` with hint and no worker task

## 2026-02-25 — Prevented fast-failing queued scans for invalid local source paths
- Investigated worker task failure pattern:
  - task received then completed as `failed` in ~0.1s.
- Identified scan metadata error:
  - `Repository source path is not accessible from scanner runtime: /host/home/portfolio.sh`
- Added backend source validation endpoint:
  - `POST /api/projects/validate-source/`
- Added pre-queue scan source validation in project scan create endpoint:
  - invalid local sources now return `400` before queueing.
- Improved dashboard folder picker flow:
  - validates inferred local source path via backend before opening.
  - avoids unreliable fallback when browser cannot provide folder absolute path.
- Logged incident details in:
  - `docs/error-logs/2026-02-25-scan-task-fast-failed-invalid-local-source-path.md`

### Files changed
- `backend/apps/projects/views.py`
- `backend/apps/scans/services.py`
- `backend/apps/projects/tests.py`
- `frontend/src/lib/api.ts`
- `frontend/src/app/(app)/dashboard/page.tsx`
- `docs/error-logs/README.md`
- `docs/error-logs/2026-02-25-scan-task-fast-failed-invalid-local-source-path.md`
- `markdowns/progress.md`

### Commands run
- `USE_SQLITE=1 /Users/ralphvincent/.pyenv/versions/3.12.11/bin/python3 backend/manage.py test apps.projects.tests apps.scans.tests`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `docker compose up -d --build backend worker frontend`

## 2026-02-25 — Switched local source flow to path-based + queued scans via MQ
- Investigated issue where local source opening uploaded files and scans ran synchronously in API request.
- Changed frontend local source UX to path-based input (no browser upload).
- Added local folder picker (`Select repo folder`) that validates git metadata before allowing open.
- Changed backend scan creation to enqueue background jobs (`Celery` via Redis MQ):
  - API now returns `queued` quickly.
  - Worker executes ingestion, scanners, and finding normalization.
- Added local source ingestion support for:
  - local git directory path
  - local `.zip` path
- Added backend pre-queue validation for local sources:
  - reject non-git local folders
  - reject invalid local zip archives
- Added container path mapping support for local host paths:
  - compose mounts `${HOME}` read-only to `${LOCAL_REPO_MOUNT_PATH}` (`/host/home` default)
  - backend resolves host-home paths to mounted container paths.
- Updated README setup/use docs for local path sources and background scanning.
- Logged incident and fix:
  - `docs/error-logs/2026-02-25-local-source-uploaded-instead-of-path-and-sync-scan.md`

### Files changed
- `backend/apps/projects/views.py`
- `backend/apps/projects/serializers.py`
- `backend/apps/scans/services.py`
- `backend/scannrai/settings.py`
- `backend/apps/projects/tests.py`
- `backend/apps/scans/tests.py`
- `frontend/src/lib/api.ts`
- `frontend/src/app/(app)/dashboard/page.tsx`
- `frontend/src/app/(app)/projects/[id]/page.tsx`
- `docker-compose.yml`
- `.env.example`
- `README.md`
- `docs/error-logs/README.md`
- `docs/error-logs/2026-02-25-local-source-uploaded-instead-of-path-and-sync-scan.md`
- `markdowns/progress.md`

### Commands run
- `USE_SQLITE=1 /Users/ralphvincent/.pyenv/versions/3.12.11/bin/python3 backend/manage.py test apps.projects.tests apps.scans.tests`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`

## 2026-02-25 — Frontend runtime fix for missing Radix module
- Investigated frontend `500` on `/dashboard` with:
  - `Module not found: Can't resolve '@radix-ui/react-slot'`
- Root cause was stale `frontend_node_modules` Docker named volume after dependency updates.
- Added startup dependency self-heal flow for frontend container:
  - `frontend/scripts/dev-start.sh` runs `npm ls --depth=0` and falls back to `npm ci` when needed.
- Updated compose/frontend image startup command to use the new script.
- Verified frontend boot and compile success from logs, and confirmed Postgres stayed healthy.
- Logged incident details in:
  - `docs/error-logs/2026-02-25-frontend-radix-module-not-found-stale-node-modules.md`

### Files changed
- `frontend/scripts/dev-start.sh`
- `docker-compose.yml`
- `infra/docker/frontend.Dockerfile`
- `docs/error-logs/README.md`
- `docs/error-logs/2026-02-25-frontend-radix-module-not-found-stale-node-modules.md`
- `markdowns/progress.md`

### Commands run
- `docker compose up -d --build frontend`
- `docker compose logs frontend --tail=120`
- `docker compose ps frontend postgres`

## 2026-02-25 — Added `docker-clean` maintenance command
- Added project-level `docker-clean` command to quickly reclaim Docker runtime space without deleting volumes by default.
- Implemented cleanup script:
  - `infra/scripts/docker-clean.sh`
  - prunes build cache, stopped containers, and unused networks
  - optional `--with-volumes` flag for pruning unused volumes
- Added `Makefile` target:
  - `make docker-clean`
- Updated README development commands with usage.

### Files changed
- `Makefile`
- `infra/scripts/docker-clean.sh`
- `README.md`

### Commands run
- `./infra/scripts/docker-clean.sh --help`
- `make -n docker-clean`

## 2026-02-25 — Fixed Postgres startup failure (`No space left on device`)
- Investigated compose startup failure where Postgres crashed with:
  - `could not write lock file "postmaster.pid": No space left on device`
- Confirmed host disk was not full (`df -h` still had free space), indicating Docker runtime storage exhaustion.
- Recovered runtime capacity with non-destructive cleanup:
  - `docker builder prune -af` (reclaimed 16.8GB)
  - `docker container prune -f`
  - `docker network prune -f`
- Restarted stack and verified:
  - Postgres healthy and accepting connections
  - API health endpoint returned `{"status":"ok"}`
- Logged incident and fix in:
  - `docs/error-logs/2026-02-25-postgres-no-space-left-on-device.md`

### Files changed
- `docs/error-logs/2026-02-25-postgres-no-space-left-on-device.md`
- `docs/error-logs/README.md`
- `markdowns/progress.md`

### Commands run
- `docker compose ps`
- `docker compose logs postgres --tail=80`
- `df -h`
- `docker builder prune -af`
- `docker container prune -f`
- `docker network prune -f`
- `docker compose up -d`
- `curl -fsS http://localhost:8000/api/health/`

## 2026-02-26 — Migrated UI to shadcn + Radix primitives
- Added Radix dependencies and migrated key UI interactions to shadcn/Radix components.
- Updated `Button` to shadcn-compatible Radix Slot pattern (`asChild` support).
- Added new shadcn-style Radix wrappers:
  - `Dialog`
  - `Select`
  - `Tabs`
- Replaced scan page native selects and custom overlay/tab UI with Radix-backed components.

### Files changed
- `frontend/package.json`
- `frontend/package-lock.json`
- `frontend/src/components/ui/button.tsx`
- `frontend/src/components/ui/dialog.tsx`
- `frontend/src/components/ui/select.tsx`
- `frontend/src/components/ui/tabs.tsx`
- `frontend/src/app/(app)/scans/[id]/page.tsx`

### Commands run
- `cd frontend && npm install @radix-ui/react-slot @radix-ui/react-dialog @radix-ui/react-select @radix-ui/react-tabs`
- `cd frontend && npm run lint && npm run build`

## 2026-02-26 — Scan execution runtime and OSV normalization fixed
- Verified live scans and found that backend execution path was missing scanner binaries.
- Added scanner runtime dependencies to backend image (Semgrep, OSV Scanner, Gitleaks).
- Fixed Semgrep runtime import failure by pinning `setuptools<81` (restores `pkg_resources` compatibility).
- Fixed OSV normalization for current payload shape:
  - support `results[].packages[].vulnerabilities`
  - map severity from `database_specific.severity` before numeric fallback
- Re-verified with live API scans: findings are now normalized and persisted with non-zero severity counts.

### Files changed
- `infra/docker/backend.Dockerfile`
- `infra/docker/scanner.Dockerfile`
- `backend/apps/findings/normalizers.py`
- `backend/apps/findings/tests.py`
- `docs/error-logs/2026-02-26-scan-execution-and-osv-normalization.md`
- `docs/error-logs/README.md`

### Commands run
- `docker compose up -d --build backend worker scanner`
- `docker compose exec -T backend sh -lc 'which semgrep && which osv-scanner && which gitleaks'`
- `USE_SQLITE=1 /Users/ralphvincent/.pyenv/versions/3.12.11/bin/python3 backend/manage.py test apps.findings.tests apps.scans.tests`
- live API scan verification via `curl` (register/token/create project/create scan)

## 2026-02-26 — Auth reload redirect issue fixed
- Fixed session persistence behavior where refresh on protected routes redirected users to `/login` despite successful login.
- Root cause was early redirect during hydration from server auth snapshot.
- Updated `AuthGate` to use hydration-aware token snapshot sentinels and only redirect after client snapshot is ready.
- Logged incident and resolution in `docs/error-logs/2026-02-26-auth-session-lost-on-reload.md`.

### Files changed
- `frontend/src/components/auth-gate.tsx`
- `docs/error-logs/README.md`
- `docs/error-logs/2026-02-26-auth-session-lost-on-reload.md`

### Commands run
- `cd frontend && npm run lint && npm run build`

## 2026-02-26 — Local repository folder upload support added
- Added local repository folder upload path in addition to ZIP upload.
- Backend scan ingestion now accepts multipart `repo_files` + `repo_paths` and safely reconstructs the repository tree in the scan workspace.
- Added path traversal validation for folder uploads.
- Frontend dashboard and repository pages now support:
  - ZIP upload
  - Folder selection (`webkitdirectory`) for local git/code repositories
- Updated API client to send folder uploads and relative file paths.
- Updated README setup/use instructions to document both ZIP and folder flows.

### Files changed
- `backend/apps/scans/services.py`
- `backend/apps/projects/views.py`
- `backend/apps/scans/tests.py`
- `frontend/src/lib/api.ts`
- `frontend/src/app/(app)/dashboard/page.tsx`
- `frontend/src/app/(app)/projects/[id]/page.tsx`
- `frontend/src/types/react-input-attributes.ts`
- `README.md`

### Commands run
- `USE_SQLITE=1 /Users/ralphvincent/.pyenv/versions/3.12.11/bin/python3 backend/manage.py test apps.scans.tests`
- `cd frontend && npm run lint && npm run build`

## 2026-02-26 — Dashboard flow changed to "Open repository"
- Reworked dashboard onboarding UX to match scanner intent:
  - Replaced "Create project" with "Open repository"
  - Added remote repository open flow (URL input)
  - Added local repository flow via ZIP upload that creates a repository record and immediately starts a scan
- Kept `Project` as the internal persistence model for ownership/history, but removed manual name-first workflow from the UI.
- Updated dashboard language from "projects" to "repositories" where user-facing.
- Updated README setup/use instructions to document remote open + local ZIP workflow.

### Files changed
- `frontend/src/app/(app)/dashboard/page.tsx`
- `README.md`

### Commands run
- `cd frontend && npm run lint`
- `cd frontend && npm run build`

## 2026-02-26 — Section 1 Foundations completed
- Implemented backend scaffold under `backend/`: Django project (`scannrai`) and apps (`accounts`, `projects`, `scans`, `findings`).
- Configured Postgres-backed Django settings with environment loading (`.env`/`.env.example`) and added DRF + JWT auth endpoints.
- Added Celery wiring (`scannrai/celery.py`) and a worker task stub in `apps/scans/tasks.py`.
- Added local containerization:
  - `infra/docker/backend.Dockerfile`
  - `infra/docker/worker.Dockerfile`
  - `infra/scripts/backend-start.sh`
  - `infra/scripts/worker-start.sh`
  - `docker-compose.yml` for postgres/redis/backend/worker
- Added health endpoint at `GET /api/health/`.
- Reorganized docs into `markdowns/` and moved prompts into `markdowns/prompts/`.

### Files changed
- `backend/**`
- `infra/**`
- `docker-compose.yml`
- `.env.example`
- `.gitignore`
- `markdowns/**`

### Commands run
- `docker compose config`
- `docker compose up -d --build postgres redis backend worker` (blocked: Docker daemon not running)
- `python3 -m compileall backend`

### Next task
- Section 2: Define core models (`Project`, `Scan`, `Finding`) and expose initial DRF serializers/viewsets + routes.

## 2026-02-26 — Section 2 Core models + API completed
- Added core models and migrations:
  - `Project` with ownership and repo URL
  - `Scan` with status lifecycle, commit hash, and metadata
  - `Finding` with tool/severity/category/file/line/raw/fingerprint fields
- Added DRF serializers + viewsets for:
  - Project CRUD
  - Create scan for project (`POST /api/projects/:id/scans/`)
  - Scan status (`GET /api/scans/:id/`)
  - Scan findings list with filters + pagination (`GET /api/scans/:id/findings/`)
  - Finding detail (`GET /api/findings/:id/`)
- Added API router integration in `scannrai/api_urls.py`.
- Added test-time SQLite fallback via `USE_SQLITE=1`.
- Added integration tests covering project CRUD and scan/findings flow.

### Files changed
- `backend/apps/projects/*`
- `backend/apps/scans/*`
- `backend/apps/findings/*`
- `backend/scannrai/api_urls.py`
- `backend/scannrai/urls.py`
- `backend/scannrai/settings.py`
- `backend/apps/**/migrations/0001_initial.py`
- `.env.example`
- `markdowns/development-plan.md`

### Commands run
- `/Users/ralphvincent/.pyenv/versions/3.12.11/bin/python3 manage.py makemigrations projects scans findings`
- `USE_SQLITE=1 /Users/ralphvincent/.pyenv/versions/3.12.11/bin/python3 manage.py test apps.projects.tests apps.scans.tests`

### Next task
- Section 3: implement repo snapshot ingestion (git clone + zip extraction) and persist scan metadata.

## 2026-02-26 — Section 3 Repo ingestion completed
- Added scan ingestion service in `apps/scans/services.py`:
  - Git clone to `/tmp/scannrai/<scan_id>/repo` (attempt shallow clone, fallback to full clone when needed)
  - ZIP upload extraction with safe path validation
  - Snapshot checksum computation for ZIP sources
- Updated scan creation flow to execute ingestion and persist metadata:
  - `commit_hash` for git scans
  - `snapshot_checksum` for zip scans
  - `source`, `repo_dir`, and `workspace_dir` in scan metadata
- Added configurable cleanup routine after scan completion:
  - `SCAN_WORKDIR`
  - `SCAN_RETENTION_SECONDS`
- Added `scan_repo` Celery task scaffolding for ingestion execution path.
- Added test coverage for:
  - zip ingestion path
  - git ingestion path
  - missing source failure path

### Files changed
- `backend/apps/scans/services.py`
- `backend/apps/projects/views.py`
- `backend/apps/scans/tasks.py`
- `backend/apps/scans/serializers.py`
- `backend/apps/scans/tests.py`
- `backend/scannrai/settings.py`
- `backend/requirements.txt`
- `.env.example`
- `markdowns/development-plan.md`

### Commands run
- `USE_SQLITE=1 /Users/ralphvincent/.pyenv/versions/3.12.11/bin/python3 manage.py test apps.projects.tests apps.scans.tests`

### Next task
- Section 4: add scanner container and implement Semgrep/OSV/Gitleaks tool runners with timeout-safe subprocess execution and raw output persistence.

## 2026-02-26 — Section 4 Tool execution completed
- Added scanner runtime module `apps/scans/tool_runners.py` with runners for:
  - Semgrep (`semgrep.json`)
  - OSV Scanner (`osv-scanner.json`)
  - Gitleaks (`gitleaks.json`)
- Implemented timeout-safe subprocess execution with structured run metadata (`exit_code`, `timed_out`, `duration`, `error`).
- Wired tool execution into scan flow after repo ingestion and stored results in scan metadata:
  - `meta.tool_runs`
  - `meta.tool_output_paths`
- Added `SCAN_TOOL_TIMEOUT_SECONDS` setting for per-tool timeout configuration.
- Added scanner container image (`infra/docker/scanner.Dockerfile`) with pinned tool versions and compose service wiring.
- Updated tests to validate tool output path creation and timeout handling logic.

### Files changed
- `backend/apps/scans/tool_runners.py`
- `backend/apps/projects/views.py`
- `backend/apps/scans/tasks.py`
- `backend/apps/scans/tests.py`
- `backend/scannrai/settings.py`
- `infra/docker/scanner.Dockerfile`
- `docker-compose.yml`
- `.env.example`
- `markdowns/development-plan.md`

### Commands run
- `USE_SQLITE=1 /Users/ralphvincent/.pyenv/versions/3.12.11/bin/python3 manage.py test apps.projects.tests apps.scans.tests`
- `docker compose config`

### Next task
- Section 5: normalize Semgrep/OSV/Gitleaks results into `Finding` records with fingerprint dedupe and scan severity summary counts.

## 2026-02-26 — Section 5 Normalization + dedupe completed
- Added normalization pipeline in `apps/findings/normalizers.py`:
  - Semgrep JSON -> Finding records
  - OSV JSON -> Finding records with CVSS-to-severity mapping
  - Gitleaks JSON -> Finding records with secret-value masking in raw payload
- Added fingerprint hashing and per-scan dedupe before persistence.
- Added DB-level dedupe constraint: unique `(scan, fingerprint)`.
- Added summary count computation and persisted summary metadata on each scan.
- Wired normalization into both synchronous scan flow and Celery task flow.
- Added focused tests to verify normalization, dedupe, and secret masking behavior.

### Files changed
- `backend/apps/findings/normalizers.py`
- `backend/apps/findings/models.py`
- `backend/apps/findings/migrations/0002_finding_unique_scan_fingerprint.py`
- `backend/apps/findings/tests.py`
- `backend/apps/projects/views.py`
- `backend/apps/scans/tasks.py`
- `markdowns/development-plan.md`

### Commands run
- `/Users/ralphvincent/.pyenv/versions/3.12.11/bin/python3 manage.py makemigrations findings`
- `USE_SQLITE=1 /Users/ralphvincent/.pyenv/versions/3.12.11/bin/python3 manage.py test apps.projects.tests apps.scans.tests apps.findings.tests`

### Next task
- Section 6: scaffold Next.js + shadcn frontend and connect dashboard/project/scan pages to backend APIs.

## 2026-02-26 — Section 6 Frontend foundations completed
- Scaffolded `frontend/` with Next.js App Router + TypeScript + Tailwind.
- Added shadcn-style setup and UI primitives (`components.json`, `Button`, `Input`, `Card`, `Badge`, `Table`, `cn()` utility).
- Implemented auth flow pages:
  - `/login`
  - `/register`
- Added protected app shell with sidebar/topbar layout and auth gate:
  - `/dashboard`
  - `/projects/[id]`
  - `/scans/[id]`
- Added frontend API client + token storage (`src/lib/api.ts`, `src/lib/auth.ts`) targeting backend JWT endpoints.
- Added backend support endpoints required by frontend:
  - `POST /api/auth/register/`
  - `GET /api/me/`
  - `GET /api/projects/:id/scans/`
- Added frontend Dockerfile and compose service for local app runtime.

### Files changed
- `frontend/**`
- `backend/apps/accounts/*`
- `backend/apps/projects/views.py`
- `backend/scannrai/urls.py`
- `infra/docker/frontend.Dockerfile`
- `docker-compose.yml`
- `.env.example`
- `markdowns/development-plan.md`

### Commands run
- `USE_SQLITE=1 /Users/ralphvincent/.pyenv/versions/3.12.11/bin/python3 manage.py test apps.accounts.tests apps.projects.tests apps.scans.tests apps.findings.tests`
- `npm run lint` (frontend)
- `npm run build` (frontend)
- `docker compose config`

### Next task
- Section 7: findings UX polish (filters, detail drawer enhancements, better status polling/progress, and empty/skeleton states).

## 2026-02-26 — Section 7 Findings UX polish completed
- Upgraded findings filters in API/UI:
  - category filtering now supports partial matching (`icontains`)
  - severity/tool/category/file filters are exposed in the scan UI
- Implemented finding detail drawer on scan page with tabs:
  - `Code Snippet` tab with line-level highlighting
  - `Raw JSON` tab for full payload inspection
- Added backend snippet enrichment for finding detail (`snippet` block) with safe repo-path guarding.
- Improved scan status UX:
  - periodic polling for queued/running scans
  - progress bar indicator tied to scan status
- Added better loading and empty-state visuals:
  - scan-page skeleton loader
  - findings table skeleton rows while scan is running
  - clearer empty-state messaging

### Files changed
- `backend/apps/findings/serializers.py`
- `backend/apps/findings/views.py`
- `backend/apps/scans/views.py`
- `backend/apps/scans/tests.py`
- `frontend/src/app/(app)/scans/[id]/page.tsx`
- `frontend/src/components/auth-gate.tsx`
- `frontend/src/types/api.ts`
- `markdowns/development-plan.md`

### Commands run
- `USE_SQLITE=1 /Users/ralphvincent/.pyenv/versions/3.12.11/bin/python3 manage.py test apps.accounts.tests apps.projects.tests apps.scans.tests apps.findings.tests`
- `npm run lint && npm run build` (frontend)

### Next task
- Section 8: implement AI layer endpoints (redaction + summary/explain/patch scaffolding).

## 2026-02-26 — Section 8 AI layer scaffolding completed
- Added AI persistence fields:
  - `Scan.ai_summary`
  - `Finding.ai_explanation`
  - `Finding.ai_fix_suggestion`
  - `Finding.ai_patch_diff`
  - `Finding.confidence`
- Implemented AI service helpers in `apps/scans/ai.py`:
  - redaction pipeline for secret-like values
  - scan summary generation
  - finding explanation and fix suggestion generation
  - patch diff scaffolding
  - explicit review warning message
- Added API endpoints:
  - `POST /api/scans/:id/ai/summary`
  - `POST /api/findings/:id/ai/explain`
  - `POST /api/findings/:id/ai/patch`
- Included AI fields in serializers so data is retrievable in existing scan/finding responses.
- Added automated tests for new AI endpoints and persistence behavior.

### Files changed
- `backend/apps/scans/ai.py`
- `backend/apps/scans/models.py`
- `backend/apps/scans/views.py`
- `backend/apps/scans/serializers.py`
- `backend/apps/scans/migrations/0002_scan_ai_summary.py`
- `backend/apps/findings/models.py`
- `backend/apps/findings/views.py`
- `backend/apps/findings/serializers.py`
- `backend/apps/findings/migrations/0003_finding_ai_explanation_finding_ai_fix_suggestion_and_more.py`
- `backend/apps/findings/tests.py`
- `backend/apps/scans/tests.py`
- `markdowns/development-plan.md`

### Commands run
- `/Users/ralphvincent/.pyenv/versions/3.12.11/bin/python3 manage.py makemigrations scans findings`
- `USE_SQLITE=1 /Users/ralphvincent/.pyenv/versions/3.12.11/bin/python3 manage.py test apps.accounts.tests apps.projects.tests apps.scans.tests apps.findings.tests`

### Next task
- Section 9: implement export endpoints (JSON + Markdown) and wire frontend download actions.

## 2026-02-26 — Section 9 Export completed
- Added export generator module `apps/scans/exporters.py`.
- Implemented scan export endpoints:
  - `GET /api/scans/:id/export.json/`
  - `GET /api/scans/:id/export.md/`
- Added scan-page UI download actions with authenticated fetch and blob download:
  - Export JSON
  - Export Markdown
- Added test coverage for both export endpoints.

### Files changed
- `backend/apps/scans/exporters.py`
- `backend/apps/scans/views.py`
- `backend/apps/scans/tests.py`
- `frontend/src/lib/api.ts`
- `frontend/src/app/(app)/scans/[id]/page.tsx`
- `markdowns/development-plan.md`

### Commands run
- `USE_SQLITE=1 /Users/ralphvincent/.pyenv/versions/3.12.11/bin/python3 manage.py test apps.accounts.tests apps.projects.tests apps.scans.tests apps.findings.tests`
- `npm run lint && npm run build` (frontend)

### Next task
- Section 10: hardening (scan rate limits, timeout controls, retention enforcement cleanup, and basic audit events).

## 2026-02-26 — Section 10 Hardening completed
- Added scan rate limiting (`SCAN_RATE_LIMIT_PER_HOUR`) with 429 response when exceeded.
- Confirmed per-tool timeout controls remain enforced through `SCAN_TOOL_TIMEOUT_SECONDS`.
- Confirmed scan retention cleanup remains configurable via `SCAN_RETENTION_SECONDS`.
- Added audit trail model and event logging:
  - `scan_started`
  - `scan_completed`
  - `scan_failed`
- Wired audit event creation in both API-triggered and Celery task-triggered scan execution flows.
- Added tests covering:
  - rate-limit behavior
  - audit event creation

### Files changed
- `backend/apps/scans/models.py`
- `backend/apps/scans/migrations/0003_auditlog.py`
- `backend/apps/scans/audit.py`
- `backend/apps/scans/admin.py`
- `backend/apps/projects/views.py`
- `backend/apps/scans/tasks.py`
- `backend/apps/scans/tests.py`
- `backend/scannrai/settings.py`
- `.env.example`
- `markdowns/development-plan.md`

### Commands run
- `/Users/ralphvincent/.pyenv/versions/3.12.11/bin/python3 manage.py makemigrations scans`
- `USE_SQLITE=1 /Users/ralphvincent/.pyenv/versions/3.12.11/bin/python3 manage.py test apps.accounts.tests apps.projects.tests apps.scans.tests apps.findings.tests`

### Next task
- Section 11: portfolio finish (README architecture/setup/docs + optional demo assets).

## 2026-02-26 — Section 11 Portfolio finish (partial) completed
- Added project README (`README.md`) with:
  - architecture diagram
  - feature list
  - local setup instructions
  - screenshots section
- Added portfolio/demo assets:
  - `seed/demo-repo/` vulnerable demo codebase
  - `seed/sample-results/sample-scan-export.json`
  - `seed/sample-results/sample-scan-report.md`
- Added screenshot assets for documentation:
  - `docs/screenshots/dashboard.svg`
  - `docs/screenshots/scan.svg`

### Files changed
- `README.md`
- `seed/demo-repo/*`
- `seed/sample-results/*`
- `docs/screenshots/*`
- `markdowns/development-plan.md`

### Commands run
- Documentation/asset generation only (no runtime command required)

### Next task
- Optional: record demo video and complete release checklist validation passes.

## 2026-02-26 — Release checklist partial validation
- Added/validated failure-path behavior for invalid repo URLs (scan marked failed with explicit ingestion error metadata).
- Confirmed secret masking verification remains covered via normalization tests.
- Confirmed documentation checklist item with updated README local setup and architecture sections.

### Files changed
- `backend/apps/scans/tests.py`
- `markdowns/development-plan.md`

### Commands run
- `USE_SQLITE=1 /Users/ralphvincent/.pyenv/versions/3.12.11/bin/python3 manage.py test apps.accounts.tests apps.projects.tests apps.scans.tests apps.findings.tests`

### Remaining release item
- Happy-path full dockerized scan demo is still pending (Docker daemon unavailable in this environment).

## 2026-02-26 — Incident fix: ARM64 scanner build 404
- Investigated scanner image build failure on ARM64 (`osv-scanner` asset 404).
- Root cause: OSV v1.9.2 release asset is a direct binary (`osv-scanner_linux_arm64`), not a tarball.
- Updated `infra/docker/scanner.Dockerfile` to use resilient install logic:
  - primary: direct binary URL
  - fallback: legacy tarball URL
- Added persistent incident docs under `docs/error-logs/` for future reference.
- Verified fix by running `docker compose build scanner worker` successfully.

### Files changed
- `infra/docker/scanner.Dockerfile`
- `docs/error-logs/README.md`
- `docs/error-logs/2026-02-26-scanner-build-arm64-osv-404.md`
- `README.md`

### Commands run
- `curl -fsSL https://api.github.com/repos/google/osv-scanner/releases/tags/v1.9.2 | rg browser_download_url`
- `curl -fsSL https://api.github.com/repos/gitleaks/gitleaks/releases/tags/v8.24.2 | rg browser_download_url`
- `docker compose build scanner worker`

## 2026-02-26 — Incident fix: docker compose port conflict on 5432
- Investigated `docker compose up` failure: host port `5432` already in use.
- Applied compose hardening for local compatibility:
  - Postgres host binding changed to `${POSTGRES_HOST_PORT:-5433}:5432`
  - Redis host binding changed to `${REDIS_HOST_PORT:-6380}:6379`
- Updated `.env.example` with new host port variables.
- Updated README setup docs with host-port override guidance.
- Logged incident details in `docs/error-logs/2026-02-26-compose-postgres-port-conflict.md`.
- Verified by running:
  - `docker compose down`
  - `docker compose up -d`
  - `docker compose ps` (all services running)
  - `curl http://localhost:8000/api/health/` => `{"status": "ok"}`

## 2026-02-26 — Incident fix: unable to create account (CORS)
- Investigated frontend registration failure (`Unable to create account right now.`).
- Root cause: missing backend CORS middleware/config; browser blocked cross-origin register/login requests.
- Added `django-cors-headers` and configured CORS origins via env.
- Improved frontend API client to surface network/CORS and field-level validation errors.
- Added regression test for register preflight CORS headers.
- Rebuilt backend/worker/scanner services and verified:
  - preflight includes `access-control-allow-origin`
  - cross-origin register call returns 201

## 2026-02-26 — Incident fix: hydration mismatch warning
- Investigated hydration warning caused by server/client render mismatch.
- Fixed `AuthGate` to use `useSyncExternalStore` with SSR-safe auth snapshot.
- Replaced locale-dependent `toLocaleString()` timestamp rendering with deterministic UTC formatting.
- Added permanent incident reference in `docs/error-logs/2026-02-26-hydration-mismatch-ssr-client-render.md`.
- Verified frontend passes lint and production build after the fix.

## 2026-02-26 — Enterprise Option B architecture hardening pass (control plane/data plane)
- Implemented enterprise-oriented Option B scanning architecture updates with minimal disruption:
  - clear control-plane orchestration in API
  - worker-only data-plane execution for scanner runtime
  - policy-driven tool execution and retention snapshot per scan
- Data model updates:
  - expanded `Finding` schema (`title`, `description`, `references`)
  - added per-user `Policy` model
  - upgraded `AuditLog` with generic fields (`actor`, `action`, `entity_type`, `entity_id`, `timestamp`, `metadata`) while preserving backward compatibility fields
  - updated `Project.repo_url` to `CharField` for local path support
- Security/runtime hardening:
  - zip extraction limits (`SCAN_ZIP_MAX_BYTES`, `SCAN_ZIP_MAX_FILES`) + zip-slip protection
  - added ZIP upload scan ingestion path using shared upload storage (`SCAN_SHARED_UPLOAD_DIR`)
  - remote git URL validation (http/https only, no embedded credentials)
  - strict subprocess runner with timeout + resource limits + truncated/redacted logs
  - structured task logs with `scan_correlation_id`
  - middleware IP throttle for scan creation (`SCAN_CREATE_IP_RATE_LIMIT_PER_MINUTE`)
- Normalization and dedupe improvements:
  - deterministic fingerprint formula based on tool/rule/file/snippet hash/line range
  - OSV missing-severity fallback now defaults to medium with explanatory note
  - Gitleaks rule-id severity override support via policy
  - raw payload redaction centralized and applied before persistence/API output
- API updates:
  - added `GET/PUT /api/policy`
  - export endpoints now write audit events
  - scan queue endpoint stores policy snapshot + correlation id
  - AI endpoints now respect `AI_FEATURE_ENABLED` toggle
- Frontend API contract updates:
  - added policy types/client methods
  - extended finding type fields
- Added/updated tests for policy endpoint and new behavior; fixed repo setup helpers for cross-environment Dulwich path handling.

### Files changed (high level)
- `backend/apps/projects/models.py`
- `backend/apps/findings/models.py`
- `backend/apps/findings/normalizers.py`
- `backend/apps/findings/serializers.py`
- `backend/apps/findings/views.py`
- `backend/apps/scans/models.py`
- `backend/apps/scans/admin.py`
- `backend/apps/scans/audit.py`
- `backend/apps/scans/policy.py`
- `backend/apps/scans/serializers.py`
- `backend/apps/scans/services.py`
- `backend/apps/scans/tasks.py`
- `backend/apps/scans/tool_runners.py`
- `backend/apps/scans/views.py`
- `backend/scannrai/api_urls.py`
- `backend/scannrai/settings.py`
- `backend/scannrai/middleware.py`
- `backend/apps/projects/tests.py`
- `backend/apps/scans/tests.py`
- migrations under `backend/apps/{projects,findings,scans}/migrations/`
- `frontend/src/lib/api.ts`
- `frontend/src/types/api.ts`
- `.env.example`
- `README.md`
- `markdowns/development-plan.md`

### Verification commands/results
- Backend tests:
  - `USE_SQLITE=1 /Users/ralphvincent/.pyenv/versions/3.12.11/bin/python3 backend/manage.py test apps.projects.tests apps.scans.tests apps.findings.tests` -> `OK`
- Frontend checks:
  - `cd frontend && npm run lint` -> `OK`
  - `cd frontend && npm run build` -> `OK`
- Runtime checks (Docker):
  - public repo scan queued and completed
  - export JSON/Markdown endpoints succeeded
  - secret redaction verified on finding raw payload (`***REDACTED***`, no secret leakage)

## 2026-02-26 — Fixed missing finding snippet when workspace already cleaned
- Investigated scan detail issue where finding line range existed but `Code Snippet` tab was empty.
- Root cause:
  - workspace cleanup used directory mtime and could remove active-retention scan workspaces prematurely.
  - finding detail serializer only attempted filesystem snippet resolution.
- Fixes applied:
  - retention cleanup now uses `Scan.finished_at` lifecycle timestamps.
  - finding detail serializer now falls back to sanitized raw payload snippet (`semgrep extra.lines`/`gitleaks line`) when workspace file is unavailable.
- Added regression tests:
  - `WorkspaceCleanupTests.test_cleanup_uses_scan_finished_at_not_workspace_mtime`
  - `FindingAiEndpointsTests.test_finding_detail_snippet_falls_back_to_raw_when_workspace_missing`
- Logged issue in:
  - `docs/error-logs/2026-02-26-scan-snippet-missing-workspace-retention-cleanup.md`

### Commands run
- `USE_SQLITE=1 /Users/ralphvincent/.pyenv/versions/3.12.11/bin/python3 backend/manage.py test apps.projects.tests apps.scans.tests apps.findings.tests`
- serializer validation in live container for finding `459` (scan `87`) confirmed snippet payload returns line 15.

## 2026-02-26 — Wired AI suggestion and patch into finding detail modal
- Investigated why suggested fix output was not visible in `/scans/{id}` finding detail.
- Root cause:
  - frontend had no client methods for finding AI endpoints.
  - modal rendered only snippet/raw tabs with no AI actions.
  - finding TS type lacked AI fields.
- Fixes applied:
  - added `aiExplainFinding` and `aiPatchFinding` in frontend API client.
  - extended `Finding` type with `ai_explanation`, `ai_fix_suggestion`, `ai_patch_diff`, `confidence`.
  - updated scan detail modal with:
    - `Generate suggestion` and `Generate patch` actions
    - `AI Suggestion` and `AI Patch` tabs
    - loading/error states, confidence display, warning display.
- Logged issue in:
  - `docs/error-logs/2026-02-26-finding-ai-suggestion-ui-not-wired.md`

### Commands run
- `cd frontend && npm run lint`
- `cd frontend && npm run build`

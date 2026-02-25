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


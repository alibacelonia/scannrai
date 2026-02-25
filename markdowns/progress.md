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


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


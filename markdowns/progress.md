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


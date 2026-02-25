# ScannrAI

ScannrAI is an AI-assisted code security scanner built with Django, DRF, Celery, Redis, Postgres, and Next.js.

## Features
- Project management with authenticated users
- Path-based repository sources (remote Git URL, local git directory path, or local `.zip` path)
- Tool execution pipeline for Semgrep, OSV Scanner, and Gitleaks
- Normalized and deduped findings across tools
- Findings filters, detail drawer, code snippet view, and raw payload view
- AI endpoints for scan summary, finding explanation, and patch scaffolding
- Export endpoints (JSON and Markdown)
- Background scan execution via Celery + Redis queue (MQ)
- Scan hardening: rate limits, timeout controls, retention policy, and audit logs

## Architecture
```mermaid
flowchart LR
  User["User"] --> Frontend["Next.js Frontend"]
  Frontend --> API["Django + DRF API"]
  API --> DB["Postgres"]
  API --> Redis["Redis"]
  API --> Worker["Celery Worker"]
  Worker --> Scanner["Semgrep / OSV / Gitleaks"]
  Worker --> DB
```

## Tech Stack
- Backend: Django, DRF, SimpleJWT, Celery
- Frontend: Next.js App Router, TypeScript, Tailwind, shadcn-style UI
- Infra: Docker Compose, Postgres, Redis
- Scanners: Semgrep, OSV Scanner, Gitleaks

## Repo Structure
- `backend/` Django API + worker logic
- `frontend/` Next.js application
- `infra/` Dockerfiles and startup scripts
- `markdowns/` MVP plan and progress tracker
- `seed/` Demo repository and sample scan exports
- `docs/screenshots/` UI reference images

## Setup and Run

### Prerequisites
- Docker Desktop (or Docker Engine + Compose plugin)
- Node.js `22+` and npm `10+` (optional, only needed for running frontend outside Docker)
- Python `3.12+` (optional, only needed for backend tests outside Docker)

### 1) Configure Environment
1. Copy the example environment file:
   - `cp .env.example .env`
2. Review and adjust values if needed:
   - `DJANGO_SECRET_KEY`
   - `POSTGRES_*`
   - `POSTGRES_HOST_PORT` (host binding; default `5433`)
   - `REDIS_HOST_PORT` (host binding; default `6380`)
   - `CORS_ALLOWED_ORIGINS` (must include frontend URL, default `http://localhost:3000`)
   - `NEXT_PUBLIC_API_BASE_URL`
   - `SCAN_*` settings (timeouts, retention, rate limits)
   - `LOCAL_REPO_MOUNT_PATH` (container path where host home is mounted; default `/host/home`)

### 2) Start the Full App (Docker)
1. Build and run all services:
   - `docker compose up --build`
2. Services started by Compose:
   - `postgres`
   - `redis`
   - `backend` (Django API)
   - `worker` (Celery)
   - `scanner` (tooling image)
   - `frontend` (Next.js)

### 3) Access the App
- Frontend UI: [http://localhost:3000](http://localhost:3000)
- Backend API root (via routes): [http://localhost:8000/api/](http://localhost:8000/api/)
- Health endpoint: [http://localhost:8000/api/health/](http://localhost:8000/api/health/)
- Postgres host port: `localhost:${POSTGRES_HOST_PORT:-5433}`
- Redis host port: `localhost:${REDIS_HOST_PORT:-6380}`

### 4) First Use
1. Open `/register` in the frontend and create an account.
2. Sign in at `/login`.
3. Open a repository from the dashboard:
   - Remote: paste a Git repository URL (for example `https://github.com/org/repo`).
   - Local:
     - click `Select repo folder` to choose a folder
     - app resolves local path and validates source with backend before open
     - app fills source path automatically when browser exposes absolute paths
     - otherwise, paste or confirm/edit path manually
     - local git directory (for example `/host/home/dev/my-repo`)
     - local zip file path (for example `/host/home/dev/my-repo.zip`)
4. Run a scan from the repository page. Scan is queued immediately and runs in the background worker.
5. Review findings and export JSON/Markdown from the scan detail page.

### Local Source Path Tips
- Local sources are path-based only (no browser upload).
- Folder/local path is server-validated before scan queueing.
- In Docker compose, host home is mounted read-only to `${LOCAL_REPO_MOUNT_PATH}` (`/host/home` by default).
- If your host repo path is `/Users/<you>/dev/repo`, enter `/host/home/dev/repo` in the app.
- For local zip snapshots, enter the zip path directly, for example `/host/home/dev/repo.zip`.
- If you see `Repository source path is not accessible from scanner runtime`, your path is incomplete or wrong; include full nested directories (example: `/host/home/personal-projects/<repo-folder>`).

## Development Commands
- Start in background:
  - `docker compose up -d --build`
- Stop services:
  - `docker compose down`
- View logs:
  - `docker compose logs -f backend worker frontend`
- Rebuild one service:
  - `docker compose build backend`
- Clean Docker cache/artifacts (safe mode):
  - `make docker-clean`
- Run backend tests:
  - `USE_SQLITE=1 /Users/ralphvincent/.pyenv/versions/3.12.11/bin/python3 backend/manage.py test`
- Frontend lint/build:
  - `cd frontend && npm run lint && npm run build`

## Screenshots
- Dashboard: ![Dashboard](docs/screenshots/dashboard.svg)
- Scan page: ![Scan](docs/screenshots/scan.svg)

## Demo Assets
- Seed repo to scan: `seed/demo-repo/`
- Sample scan export JSON: `seed/sample-results/sample-scan-export.json`
- Sample scan report Markdown: `seed/sample-results/sample-scan-report.md`

## Notes
- Docker daemon must be running for full compose startup.
- If local `git` is unavailable on macOS, scan ingestion falls back to Dulwich clone logic.
- Build/runtime troubleshooting entries are tracked in `docs/error-logs/`.

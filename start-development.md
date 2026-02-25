# Prompt: Start Development (ScannrAI)
You are a senior full‑stack engineer. Implement **ScannrAI** (AI Code Reviewer & Security Scanner) using:

- **Backend:** Django + DRF, Celery, Redis, Postgres
- **Frontend:** Next.js App Router + **shadcn/ui**
- **Scanning (Option B):** **Semgrep + OSV Scanner + Gitleaks** (language‑agnostic)

## Context
The MVP spec is in: `markdowns/scannrai_mvp.md`  
The development plan is in: `markdowns/development-plan.md`

## Instructions
1. Follow the development plan **in order**.
2. Work in small increments and commit frequently.
3. After completing a task, update:
   - `markdowns/development-plan.md` (check completed boxes)
   - `markdowns/progress.md` (append what changed + what’s next)
4. Always keep the app runnable locally via `docker compose up`.

## Current milestone to start
Begin with **Section 1: Foundations (backend + infra)**:
- Create Django project and required apps.
- Configure Postgres + migrations.
- Add Celery + Redis.
- Add Dockerfiles and docker-compose for local dev.

## Output requirements
- Create/modify files directly in the repo.
- Include clear commit messages.
- Ensure `docker compose up` starts backend and worker successfully.

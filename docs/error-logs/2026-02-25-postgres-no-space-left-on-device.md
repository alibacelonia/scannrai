# 2026-02-25 — Postgres failed to start (`No space left on device`)

## Summary
`docker compose up` failed because Postgres could not create `postmaster.pid`:

- `FATAL: could not write lock file "postmaster.pid": No space left on device`

## Symptom
- `scannrai-postgres-1` exited immediately on startup.
- Dependent services (`backend`, `worker`, `frontend`) were blocked.
- Compose reported dependency failure on `postgres`.

## Root Cause
Docker runtime storage was exhausted (Docker VM disk usage), not host filesystem exhaustion.

Evidence:
- Host still had free space (`df -h` showed ~20GiB available).
- Postgres failed writing a tiny lock file inside container runtime storage.
- `docker builder prune -af` reclaimed **16.8GB** of build cache, after which Postgres started successfully.

## Fix Applied
Used non-destructive Docker cleanup (no volume prune):

1. `docker builder prune -af`
2. `docker container prune -f`
3. `docker network prune -f`
4. `docker compose up -d`

## Verification
- `docker compose ps` shows all services up and healthy.
- Postgres logs show successful startup:
  - `database system is ready to accept connections`
- API health endpoint is reachable:
  - `GET http://localhost:8000/api/health/` returned `{"status":"ok"}`.

## Prevention
- Periodically clear build cache:
  - `docker builder prune -af`
- Keep disk pressure visible during heavy rebuild cycles.
- If issue recurs frequently, increase Docker Desktop disk image size.
- Avoid `docker volume prune` unless you intentionally want to remove database data.

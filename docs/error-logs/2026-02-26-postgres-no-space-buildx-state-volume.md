# 2026-02-26 — Postgres failed to start (`No space left on device`) due Buildx state volume

## Summary
`docker compose up` failed while starting Postgres:

- `FATAL: could not write lock file "postmaster.pid": No space left on device`

## Symptom
- `scannrai-postgres-1` exited during startup.
- Dependent services (`backend`, `worker`, `frontend`) could not start.
- `docker compose up` returned dependency failure on `postgres`.

## Root Cause
Docker Desktop runtime storage was exhausted by a large Buildx state volume, not by Postgres data.

Evidence:
- Host had free disk space (`df -h` still showed free space on host volumes).
- Postgres data volume was small (~65MB).
- Volume audit showed:
  - `buildx_buildkit_bbi-multiarch0_state` at ~18.8GB.

## Fix Applied
1. Stopped stack:
   - `docker compose down`
2. Ran standard cleanup:
   - `make docker-clean`
3. Identified large Buildx state volume and removed owning builder:
   - `docker buildx ls`
   - `docker buildx rm bbi-multiarch`
4. Started stack again:
   - `docker compose up -d`

## Verification
- `docker compose up -d` completed successfully.
- Postgres logs show successful startup:
  - `database system is ready to accept connections`
- Docker usage reduced:
  - local volumes dropped from ~17.6GB to ~638MB.

## Prevention
- `infra/scripts/docker-clean.sh` now includes Buildx cache pruning.
- Added optional builder cleanup mode:
  - `./infra/scripts/docker-clean.sh --with-builders`
- Use `--with-builders` when disk pressure persists after normal cleanup.

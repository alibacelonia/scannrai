# 2026-02-26 — Docker Compose Startup Failure (Postgres port already in use)

## Summary
`docker compose up` failed because host port `5432` was already occupied.

## Symptom
Error from Docker daemon:
- `ports are not available`
- `listen tcp 0.0.0.0:5432: bind: address already in use`

## Root Cause
`docker-compose.yml` mapped Postgres to a fixed host port:
- `5432:5432`

If any local Postgres (or another container) is already bound to `5432`, Compose cannot start the `postgres` service.

## Fix Applied
Updated Compose to use configurable host ports with safer defaults:
- Postgres: `${POSTGRES_HOST_PORT:-5433}:5432`
- Redis: `${REDIS_HOST_PORT:-6380}:6379`

Updated `.env.example` accordingly:
- `POSTGRES_HOST_PORT=5433`
- `REDIS_HOST_PORT=6380`

Updated README setup docs to explain the host-port overrides.

## Verification Steps
1. `docker compose config` should render the updated port mappings.
2. Start stack:
   - `docker compose up --build`
3. If you need original host ports, override in `.env`:
   - `POSTGRES_HOST_PORT=5432`
   - `REDIS_HOST_PORT=6379`

## Prevention / Future Reference
- Avoid fixed host port mappings for infrastructure services unless required.
- Prefer configurable host ports or omit host mapping entirely if only inter-container networking is needed.

## Files Changed
- `docker-compose.yml`
- `.env.example`
- `README.md`
- `docs/error-logs/2026-02-26-compose-postgres-port-conflict.md`

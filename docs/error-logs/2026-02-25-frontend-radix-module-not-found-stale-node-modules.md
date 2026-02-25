# 2026-02-25 — Frontend build failed (`@radix-ui/react-slot` module not found)

## Summary
Frontend container returned `500` on `/dashboard` because the running dev environment could not resolve a Radix dependency that was present in source but missing in container `node_modules`.

## Symptom
Error in frontend logs:
- `Module not found: Can't resolve '@radix-ui/react-slot'`
- Source trace: `frontend/src/components/ui/button.tsx`
- Request impact: `GET /dashboard 500`

## Root Cause
`docker-compose` uses:
- bind mount: `./frontend:/app/frontend`
- named volume: `frontend_node_modules:/app/frontend/node_modules`

After adding new dependencies to `frontend/package.json`, the existing named volume still contained old dependencies. Since the container command started `next dev` directly, no reinstall happened, so module resolution failed at runtime.

## Fix Applied
Added a startup script that validates dependencies before launching the dev server:
1. If `node_modules` is missing or invalid (`npm ls --depth=0` fails), run `npm ci`.
2. Start Next.js dev server.

Changes made:
- `frontend/scripts/dev-start.sh` (new)
- `docker-compose.yml` frontend command changed to `./scripts/dev-start.sh`
- `infra/docker/frontend.Dockerfile` CMD changed to `./scripts/dev-start.sh`

## Verification
- `docker compose up -d --build frontend`
- `docker compose logs frontend --tail=120`
  - showed `[frontend-start] Installing dependencies (npm ci)...`
  - showed `✓ Ready`
- `docker compose ps frontend postgres`
  - frontend: up
  - postgres: healthy

## Prevention / Future Reference
- Keep dependency checks in container startup when using bind-mounted apps + persisted `node_modules` volumes.
- If similar errors recur, clear only frontend dependency volume:
  - `docker compose down`
  - `docker volume rm scannrai_frontend_node_modules`
  - `docker compose up -d --build frontend`

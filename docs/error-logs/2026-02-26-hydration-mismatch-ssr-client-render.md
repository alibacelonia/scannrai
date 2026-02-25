# 2026-02-26 — Hydration mismatch (server HTML != client HTML)

## Summary
Frontend showed hydration warning:
- `Hydration failed because the server rendered HTML didn't match the client.`

## Root Cause
Two SSR/client mismatch sources were present:

1. `AuthGate` read `localStorage` during render.
- On server render, `window` is unavailable so token resolved as `null`.
- On client hydration, token could be present and render a different tree immediately.

2. Project page used locale-dependent date rendering:
- `new Date(...).toLocaleString()` can produce different output between server runtime locale/timezone and browser locale/timezone.

## Fix Applied
1. Auth state hydration-safe subscription:
- Added `subscribeToAuthToken()` store subscription in `frontend/src/lib/auth.ts`.
- Updated `AuthGate` to use `useSyncExternalStore(...)` with server snapshot `null`.
- This guarantees server/client initial snapshot consistency during hydration.

2. Deterministic timestamp rendering:
- Replaced `toLocaleString()` with explicit UTC formatter in `frontend/src/app/(app)/projects/[id]/page.tsx`.
- Output is stable across server and browser environments.

## Verification
- Frontend quality checks:
  - `npm run lint` passes
  - `npm run build` passes
- Build completed without hydration-related compile/runtime warnings from these code paths.

## Files Changed
- `frontend/src/lib/auth.ts`
- `frontend/src/components/auth-gate.tsx`
- `frontend/src/app/(app)/projects/[id]/page.tsx`

## Prevention
- Avoid reading browser-only state (`localStorage`, `window`, `navigator`) directly in render for SSR’d client components.
- Avoid locale-dependent formatting in initial SSR markup unless locale/timezone are pinned.
- Prefer deterministic rendering for first paint, then enhance after hydration if needed.

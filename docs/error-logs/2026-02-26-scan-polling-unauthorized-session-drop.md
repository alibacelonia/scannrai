# 2026-02-26 — Scan page logs out while waiting (polling hits Unauthorized)

## Summary
While waiting on a long-running scan, the frontend periodically polled scan endpoints and eventually redirected to login with `Unauthorized` responses.

## Symptom
- Backend logs:
  - `Unauthorized: /api/scans/{id}/`
  - `Unauthorized: /api/scans/{id}/findings/`
- Frontend auto-redirected to:
  - `/login?next=/scans/{id}`
- This happened even with no user action, only while waiting for scan completion.

## Root Cause
- Frontend API client used only the access token and cleared local tokens immediately on any `401`.
- No automatic refresh flow existed, even though backend exposes `/api/auth/token/refresh/`.
- During scan polling (`setInterval` every 5s), access token expiry caused a `401`, which triggered token wipe and forced login redirect.

## Fix Applied
- Added refresh-token support in frontend auth/api flow:
  - `getRefreshToken()` in auth helper.
  - `apiRequest()` now attempts one refresh on `401` for authenticated calls and retries request once.
  - Added single-flight refresh guard (`refreshPromise`) to avoid concurrent refresh races during polling bursts.
  - Session tokens are cleared only after refresh fails or retry still returns `401`.
- Extended the same refresh/retry behavior to blob export endpoints (`export.json`, `export.md`) via shared `apiRequestBlob()`.

## Verification
- `cd frontend && npm run lint` passed.
- `cd frontend && npm run build` passed.
- Behavior after fix:
  - user can remain on `/scans/{id}` while polling continues
  - access token expiry no longer causes immediate logout if refresh token is valid
  - only invalid/expired refresh token causes redirect to login

## Prevention / Future Reference
- Any authenticated frontend API helper must support refresh + retry before clearing session.
- Avoid “clear tokens on first 401” for polling-heavy pages; use one refresh attempt first.

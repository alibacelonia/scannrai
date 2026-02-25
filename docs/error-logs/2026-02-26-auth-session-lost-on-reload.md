# 2026-02-26 — Login Session Lost on Browser Reload

## Summary
User could log in successfully, but refreshing a protected page redirected back to `/login`.

## Symptom
- Login API call succeeded and tokens were stored in `localStorage`.
- On browser reload, protected routes showed "Checking session..." then redirected to login.

## Root Cause
`AuthGate` was hydration-safe but redirected too early:
- During SSR/hydration, the server snapshot for auth token is `null`.
- Redirect effect executed before client snapshot stabilization from `localStorage`.
- Result: false "not authenticated" redirect on refresh.

## Fix Applied
Updated `AuthGate` snapshot handling to gate redirects until client hydration is complete:
- Added snapshot sentinel values for server/empty/client token states.
- Derived `hydrated` from snapshot state (without `setState` in `useEffect`).
- Redirect now only runs when `hydrated === true` and token is empty.

## Verification
- `npm run lint` passes.
- `npm run build` passes.
- Manual flow expectation:
  - Login succeeds.
  - Reloading `/dashboard` keeps user in app when token exists.

## Files Changed
- `frontend/src/components/auth-gate.tsx`

## Prevention
- For SSR/client auth gates, never redirect solely from server snapshot state.
- Use explicit hydration-aware logic before auth redirects.

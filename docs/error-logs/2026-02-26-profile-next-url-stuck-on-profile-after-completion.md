# 2026-02-26 — Profile Completion Redirect Looped Back to `/profile`

## Summary
After completing profile setup from `/profile?next_url=%2Fdashboard`, navigation to Dashboard returned to Profile again.

## Symptom
- User saved profile successfully.
- Clicking Dashboard kept landing on:
  - `/profile?next_url=%2Fdashboard`
- UI stayed on profile page even after profile completion.

## Root Cause
`AppShell` used a stale in-memory `authUser` snapshot loaded before profile update (`has_completed_profile=false`).
When navigating away from profile, the sidebar guard read stale state and forced redirect back to `/profile`.

## Fix Applied
Updated profile-completion guard in `frontend/src/components/app-shell.tsx`:
1. On route changes, fetch fresh `/api/me` data for guarded routes.
2. Update `authUser` from live response before deciding redirect.
3. Redirect to profile only when latest backend state is still incomplete.

## Verification
- `cd frontend && npm run lint` passes.
- Expected flow:
  1. Login as user without profile.
  2. Complete profile on `/profile?next_url=%2Fdashboard`.
  3. Navigate to Dashboard.
  4. Remains on `/dashboard` (no forced return to `/profile`).

## Prevention
- Avoid using long-lived auth/profile snapshots for hard navigation guards.
- For completion gates, evaluate latest server truth (`/api/me`) on route transitions.

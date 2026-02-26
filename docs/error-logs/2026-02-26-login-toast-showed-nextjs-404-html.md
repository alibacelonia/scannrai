# 2026-02-26 — Login Toast Showed Raw Next.js 404 HTML

## Summary
Login failure surfaced a full HTML 404 document in the UI toast instead of a readable API error.

## Symptom
- During login, the error toast displayed `<!DOCTYPE html>...` with Next.js `_next/static/...` assets.
- User could not log in and saw noisy, non-actionable output.

## Root Cause
Frontend API client accepted any non-JSON response text as-is and surfaced it directly in `ApiError.message`.
When `NEXT_PUBLIC_API_BASE_URL` is malformed (for example missing scheme), requests can hit frontend routes and return Next.js HTML 404 pages, which were shown raw to the user.

## Fix Applied
1. Hardened API base URL handling in `frontend/src/lib/api.ts`:
   - normalize `NEXT_PUBLIC_API_BASE_URL`
   - auto-add scheme when missing (`https://` by default, `http://` for localhost/127.0.0.1)
   - construct request URLs via `new URL(...)`
2. Hardened error parsing:
   - detect HTML responses and replace with readable guidance
   - cap oversized response text in error details
   - prevent raw HTML payloads from being shown in toasts
3. Improved network error message to include resolved API base origin.

## Verification
- `cd frontend && npm run lint` passes.
- `cd frontend && npm run build` passes.
- Failed login/API calls now show actionable messages (no raw HTML blob in toast).

## Prevention
- Keep `NEXT_PUBLIC_API_BASE_URL` as a full origin, for example:
  - `https://scannrai.alibacelonia.dev`
- After changing `.env`, rebuild/restart frontend so Next.js picks updated public env values.
- Prefer surfacing normalized error messages for all non-JSON upstream responses.

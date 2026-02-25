# 2026-02-26 — Account Registration Failure from Frontend (CORS)

## Summary
Frontend showed `Unable to create account right now.` while calling `POST /api/auth/register/` from `http://localhost:3000`.

## Symptom
- Register action failed in browser.
- Frontend fell back to generic error message.
- Preflight request had no CORS allow-origin header.

## Root Cause
Backend did not have CORS middleware configured, so cross-origin requests from the frontend (`localhost:3000`) to backend (`localhost:8000`) were blocked by the browser.

## Fix Applied
1. Added CORS support in Django:
   - dependency: `django-cors-headers==4.4.0`
   - app: `corsheaders` in `INSTALLED_APPS`
   - middleware: `corsheaders.middleware.CorsMiddleware` (before `CommonMiddleware`)
2. Added env-based CORS config:
   - `CORS_ALLOWED_ORIGINS`
   - `CORS_ALLOW_CREDENTIALS`
3. Improved frontend API error handling:
   - network/CORS failures now throw explicit `ApiError`
   - validation responses now surface field-level messages instead of generic status text
4. Added regression test for register preflight CORS headers.

## Verification
- Preflight now returns CORS headers:
  - `access-control-allow-origin: http://localhost:3000`
- Register endpoint works cross-origin:
  - `POST /api/auth/register/` returns `201 Created`
- Automated tests pass:
  - `USE_SQLITE=1 ... manage.py test ...`
- Frontend quality gates pass:
  - `npm run lint`
  - `npm run build`

## Files Changed
- `backend/scannrai/settings.py`
- `backend/requirements.txt`
- `backend/apps/accounts/tests.py`
- `frontend/src/lib/api.ts`
- `.env.example`
- `README.md`
- `docs/error-logs/2026-02-26-register-account-cors-failure.md`

## Future Prevention
- Keep CORS origins explicit and environment-driven.
- Keep frontend and backend host/port defaults documented together.
- Keep error-log entries updated whenever infra/network issues impact auth flows.

# 2026-02-26 — Invalid remote URL accepted in repository create flow

## Summary
A non-repository URL such as `http://localhost:3000/dashboard` was accepted when creating a repository.

## Symptom
- UI accepted invalid remote URL in Dashboard "Open Remote Repository".
- API `POST /api/projects/` returned `201` for that URL.

## Root Cause
Two contributing causes:
1. Validation logic for remote URLs was too permissive.
   - It accepted any `http/https` URL with netloc.
2. After code fix was applied, running backend `gunicorn` workers had not been restarted.
   - Container mounts source code, but `gunicorn` does not auto-reload in this setup.

## Fix Applied
1. Tightened remote URL validation in backend:
   - Requires repository path segments (e.g. `https://github.com/<owner>/<repo>`).
2. Enforced validation during project save in serializer.
3. Frontend now calls `/api/projects/validate-source/` before creating remote repository.
4. Restarted backend service to load updated Python code:
   - `docker compose restart backend`

## Verification
After backend restart:
- `POST /api/projects/validate-source/` with `http://localhost:3000/dashboard` returns `400`.
- `POST /api/projects/` with same URL returns `400`.
- Valid URLs like `https://github.com/org/repo` continue to pass.

## Prevention
- After backend Python changes in this docker setup, restart backend service:
  - `docker compose restart backend`
- Keep remote-source validation centralized in backend and pre-validate in frontend.

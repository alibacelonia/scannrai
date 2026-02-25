# 2026-02-25 — Folder picker without absolute path blocked local open

## Summary
Local repository open failed when browser folder picker did not expose absolute filesystem path. User could select a folder but could not proceed reliably with manual guess path.

## Symptom
- UI warning:
  - `Folder "<name>" selected, but browser did not expose absolute path...`
- User could not open local repo directly from picker flow.

## Root Cause
- Browser security limits hid absolute folder paths (`File.path` unavailable in some contexts).
- Existing flow required manual path input and did not assist in resolving container-visible local path.

## Fix Applied
1. Added backend discovery endpoint:
   - `POST /api/projects/discover-source/`
   - input: `folder_name`
   - output: matching local git repo and zip paths under mounted local roots.
2. Updated dashboard picker fallback:
   - when absolute path is unavailable, call discovery endpoint automatically.
   - if one candidate found, auto-fill it.
   - if multiple candidates found, show selectable path buttons.
   - if none found, keep manual path guidance.

## Verification
- Backend tests include discovery endpoint coverage.
- Frontend lint/build passed.
- Manual flow now provides concrete candidate paths instead of blocking at warning-only state.

## Prevention / Future Reference
- Keep picker flow functional even when browsers hide absolute paths by adding runtime-assisted path discovery.
- Ensure user always has either auto-filled path candidates or explicit actionable fallback.

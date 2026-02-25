# 2026-02-25 — Folder picker showed stale example path in warning

## Summary
When selecting a local repository folder, the warning message sometimes showed an example path for a previously selected folder instead of the current one.

## Symptom
- Warning example looked wrong, e.g.:
  - selected folder: `scannrai`
  - message example: `/host/home/personal-projects/portfolio.sh`

## Root Cause
- The warning text used `localPathHint` derived from React state (`selectedLocalFolder`).
- In the same event handler, `setSelectedLocalFolder(rootFolder)` is async, so the warning could interpolate the previous state value.

## Fix Applied
1. Built fallback example path directly from current handler value:
   - `fallbackHint = /host/home/personal-projects/${rootFolder}`
   - used `fallbackHint` in warning message instead of state-derived hint.
2. Cleared stale picker context after successful local open:
   - `setSelectedLocalFolder(null)`.

## Verification
- Frontend lint/build passed.
- Code inspection confirms warning now uses current `rootFolder` value from the same selection event.

## Prevention / Future Reference
- Avoid building immediate user-facing messages from state values just updated in the same event cycle.
- Prefer local variables from the current event payload for synchronous feedback text.

# 2026-02-26 — Finding AI suggestion/fix not visible in scan detail modal

## Summary
Users could not see or request AI fix guidance from `/scans/{id}` because the finding detail modal only exposed `Code Snippet` and `Raw JSON` tabs.

## Symptom
- In scan detail, opening a finding showed no place to view `ai_explanation`, `ai_fix_suggestion`, or `ai_patch_diff`.
- Users asked how to show suggested fix output even though backend AI endpoints existed.

## Root Cause
- Frontend API client did not call:
  - `POST /api/findings/{id}/ai/explain/`
  - `POST /api/findings/{id}/ai/patch/`
- Finding modal UI had no actions/tabs for AI outputs.
- Frontend finding type omitted AI fields, so AI data was not represented in typed UI state.

## Fix Applied
- Added typed API methods:
  - `aiExplainFinding(findingId)`
  - `aiPatchFinding(findingId)`
- Extended finding API types with:
  - `ai_explanation`, `ai_fix_suggestion`, `ai_patch_diff`, `confidence`
  - response types for explain/patch actions
- Updated scan finding modal:
  - added action buttons `Generate suggestion` and `Generate patch`
  - added tabs `AI Suggestion` and `AI Patch`
  - render explanation, fix text, confidence, patch diff, warnings, and modal-level error states

## Verification
- `cd frontend && npm run lint` passed.
- `cd frontend && npm run build` passed.
- Manual behavior after fix:
  - open finding from `/scans/{id}`
  - click `Generate suggestion` -> suggestion tab populates
  - click `Generate patch` -> patch tab populates diff

## Prevention / Future Reference
- Keep frontend API contracts aligned with backend action endpoints when adding enrichment features.
- For each new backend action, include:
  - typed client method
  - UI trigger
  - visible loading/error state
  - render path for persisted response fields

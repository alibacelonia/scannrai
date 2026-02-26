# 2026-02-26 — Folder picker failed to proceed for repo outside preferred roots

## Summary
Selecting a local repo folder from the browser picker (example: `/Users/ralphvincent/Freelance/IronFort-Compliance/ironforte-prowler`) did not auto-fill a usable source path, while manually pasting the path worked.

## Symptom
- `Select folder` succeeded, but local source path stayed unresolved or required manual input.
- `Open local` flow could not proceed directly from picker selection.
- Manually entering the same absolute path worked.

## Root Cause
- Browser folder picker does not expose absolute path in standard web contexts.
- Auto-discovery fallback relied on backend `discover_local_source_candidates`.
- Discovery prioritized a fixed subset of roots (`personal-projects`, `projects`, `code`, `dev`, `workspace`) and, when those existed, could miss repos located under other root segments such as `Freelance`.
- As a result, selected folder names could not be resolved automatically even when the repo existed under a valid mount/home path.

## Fix Applied
- Updated `discover_local_source_candidates` to search more robustly:
  - scan both configured mount root and host-home roots (including `Path.home()` fallback when available)
  - keep preferred subroots for fast hits, but always include the root itself as a search root
  - dedupe results across roots
- Updated dashboard local-path hints/error examples to be generic instead of `personal-projects`-only.

## Verification
- Added tests:
  - discovery finds repo outside preferred subdirs when preferred folders are present
  - discovery uses `LOCAL_REPO_HOST_HOME` when mount root is unavailable
- Ran:
  - `USE_SQLITE=1 ... manage.py test apps.projects.tests` (pass)
  - `cd frontend && npm run lint` (pass)
  - `cd frontend && npm run build` (pass)

## Prevention / Future Reference
- Discovery must not assume a single workspace convention like `personal-projects`.
- Keep folder-picker messaging aligned with browser limitations (no guaranteed absolute path exposure).

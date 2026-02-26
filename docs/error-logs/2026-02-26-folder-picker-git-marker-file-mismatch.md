# 2026-02-26 — Folder picker discovery missed repos with `.git` marker file

## Summary
Folder picker still failed with message:
`no matches were auto-discovered`, while manually pasting the same path succeeded.

## Symptom
- Picker selected folder (example: `ironforte-www`) but auto-discovery returned zero candidates.
- Manual path entry for the same repository path proceeded correctly.

## Root Cause
- Validation path (`validate_repository_source_reference`) accepted local git repos when `.git` **exists** (file or directory).
- Discovery path (`discover_local_source_candidates`) only accepted `.git` as a **directory** (`is_dir()`).
- Repositories/worktrees with `.git` as a file were excluded from discovery, causing picker mismatch.

## Fix Applied
- Updated discovery condition to accept `.git` when it **exists** (file or directory), matching validation behavior.
- Restarted backend container so Django serves updated code.

## Verification
- Added regression test:
  - `test_discover_source_accepts_git_marker_file`
- Test suite:
  - `USE_SQLITE=1 ... manage.py test apps.projects.tests` passed.
- Runtime sanity check:
  - `discover_local_source_candidates('ironforte-www')` now returns a path under `/host/home/...`.

## Prevention / Future Reference
- Keep discovery and validation semantics aligned for repository eligibility checks.
- If validation accepts `.git` existence, discovery must not restrict to `.git` directories only.

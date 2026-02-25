# 2026-02-26 — Scanner Build Failure on ARM64 (OSV asset 404)

## Summary
`docker compose build` failed for `scanner/worker` image on ARM64 during OSV Scanner installation.

## Symptom
Build step in `infra/docker/scanner.Dockerfile` failed with:
- `curl: (22) The requested URL returned error: 404`
- `gzip: stdin: unexpected end of file`

Failing URL pattern:
- `.../osv-scanner_${VERSION}_linux_arm64.tar.gz`

## Root Cause
OSV Scanner release asset format for `v1.9.2` does not use tarball naming on Linux ARM64.
Available asset is a direct binary:
- `osv-scanner_linux_arm64`

So the old tarball URL returns 404.

## Fix Applied
Updated `infra/docker/scanner.Dockerfile` install logic to:
1. Try direct binary first:
   - `osv-scanner_linux_${arch}`
2. Fallback to legacy tarball naming if direct binary is unavailable.

This supports both newer and older release asset layouts.

## Verification
Validated URL behavior:
- `https://github.com/google/osv-scanner/releases/download/v1.9.2/osv-scanner_linux_arm64` -> `HTTP 302` (exists)
- `https://github.com/google/osv-scanner/releases/download/v1.9.2/osv-scanner_1.9.2_linux_arm64.tar.gz` -> `HTTP 404`

Also confirmed Gitleaks arm64 tarball still exists:
- `https://github.com/gitleaks/gitleaks/releases/download/v8.24.2/gitleaks_8.24.2_linux_arm64.tar.gz` -> `HTTP 302`

## Prevention / Future Reference
- Prefer resilient install blocks for GitHub release assets where naming conventions may change.
- For tool version bumps, validate assets before release:
  - `curl -fsSL https://api.github.com/repos/google/osv-scanner/releases/tags/v<version> | rg browser_download_url`
  - `curl -fsSL https://api.github.com/repos/gitleaks/gitleaks/releases/tags/v<version> | rg browser_download_url`
- Keep this log updated when scanner dependency versions change.

## Files Changed
- `infra/docker/scanner.Dockerfile`
- `docs/error-logs/README.md`
- `docs/error-logs/2026-02-26-scanner-build-arm64-osv-404.md`

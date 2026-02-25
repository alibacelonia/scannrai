# ScannrAI — Development Plan (Checkbox Tracker)
**Option B:** Semgrep + OSV + Gitleaks (language‑agnostic)  
**Goal:** Ship a portfolio‑grade MVP with clean UX and real scanning.

---

## 0) Repo structure (recommended)
- `backend/` (Django + DRF + Celery)
- `frontend/` (Next.js + shadcn)
- `infra/` (docker, configs, scripts)
- `markdowns/`
  - `scannrai_mvp.md`
  - `development-plan.md`
  - `prompts/`
    - `start-development.md`
    - `next-task.md`
    - `update-progress.md`

---

## 1) Foundations (backend + infra)
- [x] Create Django project + apps: `accounts`, `projects`, `scans`, `findings`
- [x] Configure Postgres settings + migrations
- [x] Configure DRF + JWT auth (or session auth if preferred)
- [x] Add Celery + Redis broker config
- [x] Add `.env.example` and local env loading
- [x] Add Dockerfiles for backend + worker
- [x] Add `docker-compose.yml` (postgres, redis, backend, worker)

**Definition of done:** `docker compose up` → backend runs, migrations apply, health endpoint returns 200.

---

## 2) Core data models + API
- [x] Models:
  - [x] `Project` (name, repo_url nullable, created_by)
  - [x] `Scan` (project, status, commit_hash, started_at, finished_at, meta JSON)
  - [x] `Finding` (scan, tool, severity, category, file_path, lines, raw JSON, fingerprint)
- [x] Serializers + ViewSets
- [x] API routes:
  - [x] CRUD Projects
  - [x] Create Scan for Project
  - [x] Scan status endpoint
  - [x] Findings list with pagination + filters (severity/tool/category/file)
  - [x] Finding detail endpoint

**Definition of done:** Can create a project and start a scan record (no scanners yet), view scan status, list findings (empty).

---

## 3) Scanner runtime (repo ingestion)
- [x] Implement repo snapshot handling:
  - [x] Git URL shallow clone to `/tmp/scannrai/<scan_id>/repo`
  - [x] ZIP upload extraction to workspace
- [x] Store scan metadata:
  - [x] `commit_hash` (if git)
  - [x] snapshot checksum (if zip)
- [x] Cleanup routine after scan completion (configurable retention)

**Definition of done:** Starting a scan clones/extracts repo successfully and records metadata.

---

## 4) Tool execution (Semgrep + OSV + Gitleaks)
- [x] Add `scanner/` container (recommended) with pinned versions
- [ ] Implement tool runners (called from Celery worker):
  - [x] Semgrep JSON output
  - [x] OSV Scanner JSON output
  - [x] Gitleaks JSON output
- [x] Add timeouts + safe subprocess execution
- [x] Store raw tool outputs on disk (optional) and/or in DB (`raw`)

**Definition of done:** A scan runs all 3 tools and saves raw outputs.

---

## 5) Normalization + dedupe
- [x] Normalize Semgrep → Finding schema
- [x] Normalize OSV → Finding schema
- [x] Normalize Gitleaks → Finding schema (mask secrets)
- [x] Implement fingerprinting + dedupe per scan
- [x] Compute scan summary counts (critical/high/medium/low/info)

**Definition of done:** Findings render in API with consistent fields and correct severities.

---

## 6) Frontend foundations (Next.js + shadcn)
- [x] Setup Next.js app + shadcn + auth pages
- [x] Layout: sidebar + topbar + content
- [x] API client (fetch wrapper) + auth token storage
- [x] Pages:
  - [x] Dashboard (projects + recent scans)
  - [x] Project page (scan list + Run Scan)
  - [x] Scan page (status + findings table)

**Definition of done:** User can run scans and see results in a table UI.

---

## 7) Findings UX polish
- [x] Filters: severity, tool, category, file path search
- [x] Finding detail drawer:
  - [x] code snippet viewer with line highlight
  - [x] raw JSON tab
- [x] Status polling + progress indicator
- [x] Empty states + skeleton loaders

**Definition of done:** Scan view feels like a real product.

---

## 8) AI layer (optional but recommended)
- [x] Redaction pipeline (mask secrets + minimize code sent)
- [x] AI scan summary endpoint + storage
- [x] AI finding explanation endpoint + storage
- [x] AI patch generation endpoint (unified diff per file)
- [x] Confidence score + “Review before applying” warning

**Definition of done:** AI adds clear value without leaking secrets.

---

## 9) Export
- [x] Export JSON endpoint
- [x] Export Markdown report endpoint
- [x] UI: Download buttons

**Definition of done:** User can export a scan report.

---

## 10) Hardening
- [x] Rate limit scans per user (simple)
- [x] Per-tool execution timeouts
- [x] Scan retention policy config
- [x] Basic audit log events (scan started/finished/failed)

---

## 11) Portfolio finish
- [x] Write README with:
  - architecture diagram
  - feature list
  - local setup steps
  - screenshots
- [x] Add seed demo project + sample scan results
- [ ] Record a short demo video (optional)

---

## Release checklist
- [ ] “Happy path” demo: public repo scan end-to-end
- [x] “Failure path” demo: invalid repo URL shows useful errors
- [x] Security: secret masking verified
- [x] Docs: clear local run instructions

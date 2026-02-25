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
- [ ] Create Django project + apps: `accounts`, `projects`, `scans`, `findings`
- [ ] Configure Postgres settings + migrations
- [ ] Configure DRF + JWT auth (or session auth if preferred)
- [ ] Add Celery + Redis broker config
- [ ] Add `.env.example` and local env loading
- [ ] Add Dockerfiles for backend + worker
- [ ] Add `docker-compose.yml` (postgres, redis, backend, worker)

**Definition of done:** `docker compose up` → backend runs, migrations apply, health endpoint returns 200.

---

## 2) Core data models + API
- [ ] Models:
  - [ ] `Project` (name, repo_url nullable, created_by)
  - [ ] `Scan` (project, status, commit_hash, started_at, finished_at, meta JSON)
  - [ ] `Finding` (scan, tool, severity, category, file_path, lines, raw JSON, fingerprint)
- [ ] Serializers + ViewSets
- [ ] API routes:
  - [ ] CRUD Projects
  - [ ] Create Scan for Project
  - [ ] Scan status endpoint
  - [ ] Findings list with pagination + filters (severity/tool/category/file)
  - [ ] Finding detail endpoint

**Definition of done:** Can create a project and start a scan record (no scanners yet), view scan status, list findings (empty).

---

## 3) Scanner runtime (repo ingestion)
- [ ] Implement repo snapshot handling:
  - [ ] Git URL shallow clone to `/tmp/scannrai/<scan_id>/repo`
  - [ ] ZIP upload extraction to workspace
- [ ] Store scan metadata:
  - [ ] `commit_hash` (if git)
  - [ ] snapshot checksum (if zip)
- [ ] Cleanup routine after scan completion (configurable retention)

**Definition of done:** Starting a scan clones/extracts repo successfully and records metadata.

---

## 4) Tool execution (Semgrep + OSV + Gitleaks)
- [ ] Add `scanner/` container (recommended) with pinned versions
- [ ] Implement tool runners (called from Celery worker):
  - [ ] Semgrep JSON output
  - [ ] OSV Scanner JSON output
  - [ ] Gitleaks JSON output
- [ ] Add timeouts + safe subprocess execution
- [ ] Store raw tool outputs on disk (optional) and/or in DB (`raw`)

**Definition of done:** A scan runs all 3 tools and saves raw outputs.

---

## 5) Normalization + dedupe
- [ ] Normalize Semgrep → Finding schema
- [ ] Normalize OSV → Finding schema
- [ ] Normalize Gitleaks → Finding schema (mask secrets)
- [ ] Implement fingerprinting + dedupe per scan
- [ ] Compute scan summary counts (critical/high/medium/low/info)

**Definition of done:** Findings render in API with consistent fields and correct severities.

---

## 6) Frontend foundations (Next.js + shadcn)
- [ ] Setup Next.js app + shadcn + auth pages
- [ ] Layout: sidebar + topbar + content
- [ ] API client (fetch wrapper) + auth token storage
- [ ] Pages:
  - [ ] Dashboard (projects + recent scans)
  - [ ] Project page (scan list + Run Scan)
  - [ ] Scan page (status + findings table)

**Definition of done:** User can run scans and see results in a table UI.

---

## 7) Findings UX polish
- [ ] Filters: severity, tool, category, file path search
- [ ] Finding detail drawer:
  - [ ] code snippet viewer with line highlight
  - [ ] raw JSON tab
- [ ] Status polling + progress indicator
- [ ] Empty states + skeleton loaders

**Definition of done:** Scan view feels like a real product.

---

## 8) AI layer (optional but recommended)
- [ ] Redaction pipeline (mask secrets + minimize code sent)
- [ ] AI scan summary endpoint + storage
- [ ] AI finding explanation endpoint + storage
- [ ] AI patch generation endpoint (unified diff per file)
- [ ] Confidence score + “Review before applying” warning

**Definition of done:** AI adds clear value without leaking secrets.

---

## 9) Export
- [ ] Export JSON endpoint
- [ ] Export Markdown report endpoint
- [ ] UI: Download buttons

**Definition of done:** User can export a scan report.

---

## 10) Hardening
- [ ] Rate limit scans per user (simple)
- [ ] Per-tool execution timeouts
- [ ] Scan retention policy config
- [ ] Basic audit log events (scan started/finished/failed)

---

## 11) Portfolio finish
- [ ] Write README with:
  - architecture diagram
  - feature list
  - local setup steps
  - screenshots
- [ ] Add seed demo project + sample scan results
- [ ] Record a short demo video (optional)

---

## Release checklist
- [ ] “Happy path” demo: public repo scan end-to-end
- [ ] “Failure path” demo: invalid repo URL shows useful errors
- [ ] Security: secret masking verified
- [ ] Docs: clear local run instructions

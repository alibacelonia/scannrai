# ScannrAI — AI Code Reviewer & Security Scanner (MVP Spec)
**Focus:** Option B (Language‑agnostic scanning): **Semgrep + OSV + Gitleaks**  
**Stack:** **Django + DRF** (backend) • **Celery + Redis** (jobs) • **Postgres** (data) • **Next.js + shadcn/ui** (frontend)

---

## 1) Product summary
**One‑liner:** Scan a repo (Git URL or ZIP upload) → run security tooling → normalize findings → AI summarizes risks and suggests fixes/patches.

**Primary audience:** devs, small teams, agencies, freelancers, and students.

**MVP goal:** deliver a credible “security scanning SaaS” experience:
- Repeatable scans
- Structured findings with severity
- Clean dashboard + filters
- Exportable results
- AI summaries + fix suggestions (optional in MVP, but recommended)

---

## 2) Core user flows

### 2.1 Create project + run scan
1. User logs in
2. Create **Project** with:
   - name
   - repo source: **Git URL** *or* **ZIP upload**
3. Click **Run Scan**
4. System:
   - resolves code snapshot
   - runs Semgrep + OSV + Gitleaks
   - stores normalized findings
   - generates AI scan summary + suggested remediations

### 2.2 Review results
- Scan details page:
  - Status timeline (queued → running → completed/failed)
  - Summary cards: critical/high/medium/low counts
  - Findings table with filters:
    - severity, tool, category, file path, “has fix suggestion”
  - Finding detail drawer:
    - evidence (snippet)
    - tool output (raw JSON)
    - AI explanation + recommended fix
    - “Generate patch” (creates unified diff) — per finding

### 2.3 Export + share
- Export as:
  - JSON
  - Markdown report (MVP)
  - PDF (stretch)

---

## 3) Scanning approach (Option B)

### 3.1 Repo ingestion
**Supported inputs**
- Git URL (public in MVP; private later via token)
- ZIP upload (max size configurable)

**Snapshot strategy**
- Create a **workspace dir**: `/tmp/scannrai/<scan_id>/`
- If Git URL: shallow clone (`--depth 1`) default branch or provided ref
- Record:
  - commit hash (if git)
  - snapshot checksum (hash of tree for ZIP)

### 3.2 Tooling (recommended versions pinned via Docker)
Run all tools inside a dedicated “scanner” container for consistency.

#### Semgrep (SAST)
- Default rulesets:
  - `p/security-audit`
  - `p/secrets` (optional, but may overlap with Gitleaks)
  - `p/owasp-top-ten` (if desired)
- Output: JSON
- Normalize to `Finding` schema

#### OSV Scanner (dependencies)
- Run `osv-scanner --format=json --recursive .`
- Captures known vulnerabilities via OSV DB
- Normalize to `Finding` with category “Dependency Vulnerability”

#### Gitleaks (secrets)
- Run `gitleaks detect --source . --report-format json --report-path gitleaks.json`
- Normalize to `Finding` with category “Secrets”

---

## 4) Normalized Finding schema (DB model contract)
A unified schema allows consistent UI and AI processing.

**Fields**
- `id` (uuid)
- `scan_id` (fk)
- `tool` (`semgrep|osv|gitleaks`)
- `severity` (`critical|high|medium|low|info`)
- `category` (string: OWASP tag or “Secrets”, “Dependency”, etc.)
- `title` (short)
- `description` (human‑readable)
- `file_path`
- `line_start`, `line_end`
- `fingerprint` (stable hash to dedupe)
- `references` (JSON list)
- `raw` (JSON, full tool payload)
- `ai_explanation` (text, nullable)
- `ai_fix_suggestion` (text, nullable)
- `ai_patch_diff` (text, nullable)
- `confidence` (0–1, nullable)

**Severity mapping (example)**
- Semgrep: use `severity` if present; else map by rule metadata
- OSV: map CVSS score:
  - 9.0–10.0 → critical
  - 7.0–8.9 → high
  - 4.0–6.9 → medium
  - 0.1–3.9 → low
- Gitleaks: typically high; allow config mapping by rule ID

---

## 5) AI layer (recommended MVP)
**Where AI helps**
- Convert raw findings into developer‑friendly explanations
- Prioritize remediation order (“what to fix first”)
- Suggest code fixes and patches (per finding)

**AI tasks**
1. **Scan summary** (per scan):
   - executive summary
   - top risks (3–5)
   - quick wins (3–5)
   - overall risk score (0–100)
2. **Finding explanation** (per finding):
   - why it matters
   - how to exploit (high level)
   - safe remediation steps
3. **Patch generation** (optional, per finding):
   - output unified diff for a single file
   - include guardrails: “do not change unrelated code”

**Safety**
- Never print secrets found by gitleaks in full; mask values in UI/AI prompts.
- Add redaction function before sending snippets to AI.

---

## 6) Backend (Django + DRF)

### 6.1 API endpoints (MVP)
**Auth**
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET  /api/me`

**Projects**
- `GET  /api/projects`
- `POST /api/projects`
- `GET  /api/projects/:id`
- `PATCH /api/projects/:id`
- `DELETE /api/projects/:id`

**Scans**
- `POST /api/projects/:id/scans` (start)
- `GET  /api/scans/:id` (status + summary counts)
- `GET  /api/scans/:id/findings` (paged, filterable)
- `GET  /api/findings/:id` (detail)

**AI**
- `POST /api/findings/:id/ai/explain`
- `POST /api/findings/:id/ai/patch`
- `POST /api/scans/:id/ai/summary`

**Export**
- `GET /api/scans/:id/export.json`
- `GET /api/scans/:id/export.md`

### 6.2 Celery tasks
- `scan_repo(scan_id)`
  - fetch snapshot
  - run tools
  - normalize + store findings
  - compute counts
- `ai_scan_summary(scan_id)` (optional)
- `ai_enrich_finding(finding_id)` (optional)
- `ai_generate_patch(finding_id)` (optional)

---

## 7) Frontend (Next.js + shadcn/ui)

### Pages
- `/login`, `/register`
- `/dashboard` (projects + recent scans)
- `/projects/[id]` (scan history, run scan)
- `/scans/[id]` (summary + findings table + filters)
- `/findings/[id]` or drawer modal (detail)

### Components (shadcn)
- DataTable with filters + badges
- Tabs (Summary / Findings / Raw / Export)
- Skeleton loaders for scanning states
- Toasts for job status updates
- Code viewer (monospace, line highlight)

---

## 8) Infrastructure (Docker Compose)
- `postgres`
- `redis`
- `backend`
- `worker`
- `frontend`
- `scanner` (optional, but recommended)

---

## 9) Non‑functional requirements
- **Deterministic scans:** tool versions pinned
- **Rate limits:** basic throttling on scan creation
- **Timeouts:** per tool execution max time
- **Isolation:** scans run in temp dirs; cleanup after completion
- **Audit trail:** store scan timestamps + commit hash

---

## 10) Stretch features (after MVP)
- GitHub App integration + PR comments
- Private repo support via OAuth token
- Multi‑tenant orgs + team roles
- PDF reports + scheduled scans
- Ruleset management (Semgrep config editor)
- Baselines & “new issues only” view

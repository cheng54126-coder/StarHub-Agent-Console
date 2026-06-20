# Apply Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Jarvis apply workbench that reduces manual resume delivery time while keeping the final Boss delivery click manual.

**Architecture:** Add a focused backend service that searches Boss jobs through the configured MCP tool, normalizes job records, generates per-job greeting copy, and persists per-job workflow status. Add a compact frontend module that can search, show job IDs/security IDs, open a selected job page, copy greeting text, and mark jobs as pending/opened/applied/skipped.

**Tech Stack:** Node.js native HTTP server, stdio MCP client, JSON file persistence, vanilla HTML/CSS/JS, `node --test`.

---

### Task 1: Backend Workbench Service

**Files:**
- Create: `server/apply-workbench.js`
- Modify: `server/store.js`
- Modify: `server/routes.js`
- Test: `server/apply-workbench.test.js`

- [ ] Add JSON store helpers for `apply-workbench.json`.
- [ ] Implement `searchApplyJobs()` using `callMcpTool("boss_search", args)`.
- [ ] Normalize Boss job fields into `{ id, title, company, salary, city, jobId, securityId, detailUrl, status, greeting }`.
- [ ] Implement `updateApplyJobStatus(id, status)` with allowed statuses: `pending`, `opened`, `applied`, `skipped`.
- [ ] Add routes:
  - `GET /api/apply-workbench`
  - `POST /api/apply-workbench/search`
  - `POST /api/apply-workbench/status`
- [ ] Add tests using an injected fake MCP caller to avoid network and real platform writes.

### Task 2: Frontend Workbench Module

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `app.js`
- Test: `server/ui-interactions.test.js`

- [ ] Add compact left-rail module `Apply Workbench`.
- [ ] Add inputs for keyword, city, salary, count.
- [ ] Add actions: search, open, copy greeting, mark applied, skip, next.
- [ ] Render jobs with visible `job_id` and `security_id`.
- [ ] Use `window.open(detailUrl)` only for opening the platform page; do not automate clicking delivery buttons.
- [ ] Add UI tests that assert the module and API endpoints are wired.

### Task 3: Verification

**Files:**
- Modify only if tests reveal failures.

- [ ] Run `node --test server/apply-workbench.test.js`.
- [ ] Run `npm test`.
- [ ] Run `npm run check`.
- [ ] Restart local service if it is already running.

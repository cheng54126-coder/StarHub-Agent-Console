# Configurable MCP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded MCP setup with a configurable MCP service list that can be managed from the Jarvis page.

**Architecture:** Store MCP server definitions in `data/mcp-config.json`, expose GET/POST API routes, and have MCP sync/status read enabled services from that config. The frontend MCP module will show configured servers and provide a compact form for adding/editing stdio MCP commands.

**Tech Stack:** Node.js built-in test runner, JSON file persistence, vanilla HTML/CSS/JS.

---

### Task 1: Backend Config

**Files:**
- Modify: `server/config.js`
- Modify: `server/store.js`
- Modify: `server/mcp.js`
- Modify: `server/routes.js`
- Test: `server/mcp-config.test.js`

- [ ] Add default boss MCP config.
- [ ] Add `getMcpConfig()` and `saveMcpConfig()`.
- [ ] Add `/api/config/mcp` GET/POST.
- [ ] Update MCP sync/status to use enabled configured servers.

### Task 2: Frontend Config UI

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `app.js`
- Test: `server/ui-interactions.test.js`

- [ ] Add service list and add/edit fields inside MCP module.
- [ ] Load and save MCP config from backend.
- [ ] Keep existing sync/test buttons working against configured services.

### Task 3: Verification

- [ ] Run `node --test server/mcp-config.test.js`.
- [ ] Run `npm run check`.
- [ ] Run `npm test`.
- [ ] Restart local service and verify `/api/config/mcp`, `/api/mcp/tools`, and UI load.

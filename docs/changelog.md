# Changelog

Implementation history for FliDeck.

## Quick Summary

| Date | What | FRs |
|------|------|-----|
| 2025-12-18 | Documentation scaffolding | - |
| 2025-12-18 | Initial project setup | FR-1 |

---

## Detailed History

### 2025-12-18 - Documentation Scaffolding

**Commit:** `pending`

**What was done:**
- Created documentation structure (docs/)
- Set up backlog.md, changelog.md, brainstorming-notes.md
- Created prd/ and uat/ directories

**Files changed:**
- `docs/README.md` (new)
- `docs/backlog.md` (new)
- `docs/changelog.md` (new)
- `docs/brainstorming-notes.md` (new)

---

### 2025-12-18 - Initial Project Setup

**Commit:** `99128b2`
**FRs:** FR-1

**What was done:**
- Created FliDeck presentation harness
- React 19 + Vite + TailwindCSS client (port 5200)
- Express 5 + Socket.io + Chokidar server (port 5201)
- Shared TypeScript types
- File discovery from PRESENTATIONS_ROOT
- Real-time updates via Socket.io
- TanStack Query for server state

**Files changed:**
- `client/` - React frontend
- `server/` - Express backend
- `shared/` - TypeScript types
- `docs/planning/` - Architecture and requirements

---

<!--
Template for new entries:

### YYYY-MM-DD - [Title]

**Commit:** `xxxxxxx`
**FRs:** FR-X, FR-Y

**What was done:**
- [Change 1]
- [Change 2]

**Files changed:**
- `path/to/file.ts` (new/modified)

-->

# FR-2: JSON-Based Configuration System

**Status:** Pending
**Added:** 2025-12-18
**Implemented:** -

---

## User Story

As a user, I want to configure FliDeck via a JSON file so that I can dynamically change settings (like presentation folders) without restarting the app or managing environment variables.

## Problem

Environment variables are set at startup and require restart to change. Users need to point FliDeck at different presentation folders during a session and quickly switch between previously used locations.

## Solution

Replace environment variable configuration with a `config.json` file that:
- Lives at project root
- Is gitignored (user-specific)
- Has a committed `config.example.json` template
- Falls back to example values if `config.json` doesn't exist

## Config Structure

```json
{
  "presentationsRoot": "./presentations",
  "history": [
    "./presentations",
    "/Users/david/projects/demo-slides",
    "/Users/david/projects/client-pitch"
  ]
}
```

## Acceptance Criteria

- [ ] `config.json` exists at project root (gitignored)
- [ ] `config.example.json` committed with default values
- [ ] Server reads `presentationsRoot` from config on startup
- [ ] If `config.json` missing, fall back to `config.example.json` values
- [ ] `history` array tracks previously used presentation roots
- [ ] Config changes detected and applied without server restart (hot reload)

## Technical Notes

- Use Chokidar (already in project) to watch `config.json`
- On config change, re-scan presentations from new root
- Emit Socket.io event to notify clients of root change
- Keep `history` updated when `presentationsRoot` changes
- Update `config.example.json` whenever new config options are added

**Files to create/modify:**
- `config.json` (new, gitignored)
- `config.example.json` (new, committed)
- `.gitignore` (add config.json)
- `server/src/config.ts` or similar (new config loader)
- `server/src/index.ts` (use config instead of env vars)

## Completion Notes

_To be filled by developer upon completion._

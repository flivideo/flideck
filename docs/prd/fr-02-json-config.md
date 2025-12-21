# FR-2: JSON-Based Configuration System

**Status:** Implemented
**Added:** 2025-12-18
**Implemented:** 2025-12-18

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
  "presentationsRoot": "~/dev/ad/flivideo/fli-brief/docs/presentations",
  "history": [
    "~/dev/ad/flivideo/fli-brief/docs/presentations",
    "~/dev/ad/flivideo/flideck/presentations"
  ]
}
```

**Note:** Tilde (`~`) paths must be expanded to full paths at runtime.

## Acceptance Criteria

- [x] `config.json` exists at project root (gitignored)
- [x] `config.example.json` committed with default values
- [x] Server reads `presentationsRoot` from config on startup
- [x] If `config.json` missing, fall back to `config.example.json` values
- [x] Tilde (`~`) paths expanded to full paths at runtime
- [x] `history` array tracks previously used presentation roots
- [x] Config changes detected and applied without server restart (hot reload)

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

**Implementation Summary:**

1. Created `config.example.json` (committed) and `config.json` (gitignored) at project root
2. Created `server/src/config.ts` with:
   - `loadConfig()` - Loads config with fallback to example
   - `saveConfig()` - Saves config with tilde notation
   - `addToHistory()` - Manages history array (max 10 entries)
   - `expandPath()` / `collapsePath()` - Tilde expansion/collapse
3. Enhanced `WatcherManager` with `onChangeCallback` for server-side hot reload
4. Updated `server/src/index.ts` to:
   - Load config on startup
   - Watch `config.json` for changes
   - Handle hot reload (stop/start watchers, update service, notify clients)
   - Dynamic static file serving for presentations

**Hot Reload Flow:**
1. User edits `config.json`
2. Chokidar detects change (500ms debounce)
3. Callback reloads config
4. If `presentationsRoot` changed:
   - Previous root added to history
   - Old watcher stopped, new watcher started
   - PresentationService root updated
   - Cache invalidated
   - `config:changed` event emitted to clients

**Testing Verified:**
- Config loading with tilde expansion
- Fallback to example config
- Hot reload without server restart
- History auto-population
- Watcher recycling

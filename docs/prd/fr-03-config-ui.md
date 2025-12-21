# FR-3: Configuration UI

**Status:** Implemented
**Added:** 2025-12-18
**Implemented:** 2025-12-18

---

## User Story

As a user, I want a configuration screen to switch between presentation folders so that I can quickly change projects without editing JSON files.

## Problem

Config is managed via `config.json` which requires manual editing. Users need a UI to:
- View and select from previously used presentation folders (history)
- Select a new folder/project
- See the presentation list update when the project changes

## Rough Notes

- Configuration screen for projects (presentation roots)
- Display historical list of projects from `config.json` history
- Allow selection from history
- Allow selection of a new folder
- When project changes, refresh presentation list and asset list

## Acceptance Criteria

- [x] Configuration screen accessible from UI (gear icon in header → /config route)
- [x] Shows list of previously used folders (history)
- [x] Allows selecting a folder from history
- [x] Allows browsing/entering a new folder path (text input + FolderBrowser modal)
- [x] Changing folder updates `config.json`
- [x] Presentation list refreshes on folder change (via Socket.io `config:changed` event)

## Technical Notes

- Server endpoints: GET/PUT /api/config, GET /api/config/browse
- Browse restricted to home directory and /tmp for security
- Paths displayed with tilde notation for readability
- History capped at 10 entries

## Completion Notes

**Implementation Summary:**

1. **Server** (`server/src/routes/config.ts`):
   - GET /api/config - Returns current config with tilde notation
   - PUT /api/config - Updates presentationsRoot, adds to history, triggers hot reload

2. **Shared Types** (`shared/src/types.ts`):
   - ConfigResponse type
   - Added `config:changed` to SocketEvents

3. **Client Hooks** (`client/src/hooks/useConfig.ts`):
   - useConfig() - Fetch current config
   - useUpdateConfig() - Mutation for updating config
   - useConfigUpdates() - Socket.io listener for real-time updates

4. **Client UI**:
   - ConfigPage (`pages/ConfigPage.tsx`) - Main configuration screen with three sections:
     - Current Folder (display)
     - History (clickable list)
     - Add Folder (text input)
   - Header gear icon - Navigation to /config

**Files Created:**
- `server/src/routes/config.ts`
- `client/src/hooks/useConfig.ts`
- `client/src/pages/ConfigPage.tsx`

**Files Modified:**
- `server/src/routes/index.ts`
- `server/src/config.ts` (exported collapsePath)
- `shared/src/types.ts`
- `client/src/App.tsx`
- `client/src/components/layout/Header.tsx`
- `client/src/utils/api.ts` (added put method)
- `client/src/utils/constants.ts` (added config query keys)

**Note:** FR-6 simplified this implementation by removing the FolderBrowser component in favor of a simple text input.

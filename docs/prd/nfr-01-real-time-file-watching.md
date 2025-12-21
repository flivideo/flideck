# NFR-1: Real-Time File Watching

**Status:** Pending
**Added:** 2025-12-21
**Source:** Brainstorm session

---

## Problem

When external systems (e.g., Claude agents) modify presentation files, the UI doesn't reflect changes until a hard page refresh. This breaks the flow when iterating on presentations.

Two scenarios need handling:

1. **Content change** - A slide/page HTML file is modified
2. **Structure change** - A file is added, removed, or renamed

Currently the host app and iframe are disconnected - file changes aren't propagating to either.

## Solution

Leverage existing Socket.io and Chokidar infrastructure to emit granular events and handle them appropriately.

### Event Types

| Event | Trigger | Response |
|-------|---------|----------|
| `content:changed` | HTML file modified | Host reloads iframe |
| `structure:changed` | File added/removed/renamed | Host re-fetches menu, updates sidebar/dashboard |

### Implementation Approach

**Server (already has WatcherManager):**
- Detect file change type (content vs structure)
- Emit appropriate socket event with presentation ID

**Host (React app):**
- Listen for `content:changed` → reload iframe via `src` manipulation
- Listen for `structure:changed` → invalidate TanStack Query cache for presentations list

**Iframe:**
- Stays "dumb" - no socket connection needed
- Host controls reload via:
  ```javascript
  iframeRef.src = iframeRef.src  // Simple reload
  // or cache-bust:
  iframeRef.src = originalUrl + '?t=' + Date.now()
  ```

## Acceptance Criteria

- [ ] When a presentation HTML file is modified externally, the iframe updates within 1 second
- [ ] When a new HTML file is added to a presentation folder, the sidebar updates
- [ ] When an HTML file is deleted, the sidebar updates
- [ ] When an HTML file is renamed, the sidebar updates
- [ ] No manual page refresh required for any of the above
- [ ] Changes to non-HTML files (e.g., CSS, JS, images) also trigger iframe reload

## Technical Notes

- FliDeck already has `presentations:updated` socket event - may need to split into content/structure events
- WatcherManager already uses Chokidar with debouncing
- Consider debounce window for rapid changes (e.g., 100-200ms)

## Out of Scope

- Hot module replacement (HMR) style updates - full iframe reload is acceptable
- Partial DOM updates - reload entire iframe content

---

## Completion Notes

**What was done:**
- Server emits granular socket events: `content:changed` for file modifications, `structure:changed` for add/remove/rename
- Added `parseAssetPath()` helper to extract presentationId/assetId from file paths
- New `useContentChanges()` hook listens for content changes and triggers iframe reload via `reloadKey`
- AssetViewer accepts `reloadKey` prop to force iframe refresh without full page reload
- Reduced debounce from 500ms to 200ms for faster response
- Updated shared types with new socket event definitions

**Files changed:**
- `server/src/index.ts` (modified) - Added parseAssetPath, handlePresentationChange, granular event emission
- `client/src/hooks/useSocket.ts` (modified) - Added useContentChanges hook
- `client/src/pages/PresentationPage.tsx` (modified) - Integrated useContentChanges hook
- `client/src/components/ui/AssetViewer.tsx` (modified) - Added reloadKey prop support
- `shared/src/types.ts` (modified) - Added content:changed and structure:changed event types

**Testing notes:**
- Content modify: Edit HTML file while viewing it → iframe reloads automatically
- File add: Create new HTML file → appears in sidebar immediately
- File delete: Remove HTML file → disappears from sidebar immediately
- File rename: Rename HTML file → sidebar updates with new name

**Known limitation:**
When navigating via links inside an iframe (rather than FliDeck sidebar), the harness can't track the navigation. File changes to the internally-navigated page won't trigger reload since FliDeck's state doesn't match the iframe's actual content.

**Status:** Complete

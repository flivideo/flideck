# FR-6: Simplify Config UI

**Status:** Implemented
**Added:** 2025-12-19
**Implemented:** 2025-12-19

---

## User Story

As a user, I want a simple way to switch between presentation root folders by typing/pasting a path, so that I can quickly move between different projects/brands without navigating a complex folder browser.

## Problem

FR-3 implemented a custom HTML folder browser that:
1. Allows navigating INTO presentations (wrong - that's the home page's job)
2. Is overly complex for the simple task of selecting a root folder
3. Has security restrictions that limit its usefulness (`/api/config/browse` restricted to home directory)

The config page should ONLY manage roots, not browse presentations.

## What To Change

### DELETE These Files
| File | Reason |
|------|--------|
| `client/src/components/config/FolderBrowser.tsx` | Custom browser no longer needed |

### MODIFY These Files

| File | Changes |
|------|---------|
| `client/src/pages/ConfigPage.tsx` | Remove Browse button, FolderBrowser import, showBrowser state |
| `client/src/hooks/useConfig.ts` | Remove `useBrowseDirectory` hook and `BrowseResponse` import |
| `client/src/utils/constants.ts` | Remove `browse` query key |
| `server/src/routes/config.ts` | Remove `GET /browse` endpoint (lines 128-183) |
| `shared/src/types.ts` | Remove `DirectoryEntry` and `BrowseResponse` types |

### KEEP (No Changes)
- Current folder display section
- History list (already works when entries exist)
- New folder text input + Apply button
- `PUT /api/config` endpoint
- Real-time updates via Socket.io

## UI After Changes

```
┌─────────────────────────────────────────────────────────────┐
│  ← Configuration                                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  CURRENT FOLDER                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ~/dev/presentations                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  HISTORY                                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ~/dev/other-project/slides                    [click] │   │
│  │ ~/videos/thumbnails                           [click] │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  NEW FOLDER                                                 │
│  ┌───────────────────────────────────────────────┐         │
│  │ Enter path (e.g., ~/dev/project/presentations)│         │
│  └───────────────────────────────────────────────┘         │
│                                        [Apply Changes]      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Note: The "Browse" button is removed. User types/pastes path directly.

## Acceptance Criteria

- [ ] `FolderBrowser.tsx` deleted
- [ ] `GET /api/config/browse` endpoint removed
- [ ] `useBrowseDirectory` hook removed
- [ ] `DirectoryEntry` and `BrowseResponse` types removed from shared/types.ts
- [ ] `browse` query key removed from constants.ts
- [ ] ConfigPage no longer has Browse button
- [ ] Text input + Apply button still works
- [ ] History list still displays and is clickable
- [ ] No TypeScript errors after cleanup

## Rationale

**Why text input over native dialog?**
- `showDirectoryPicker()` only returns folder name, not full path (browser security)
- Developers typically copy paths from terminal anyway
- Simpler code, fewer edge cases
- Works consistently across all browsers

## Completion Notes

**What was done:**
- Deleted `FolderBrowser.tsx` component and `config/` directory
- Removed `GET /api/config/browse` endpoint from server
- Removed `useBrowseDirectory` hook, `BrowseResponse` type, `browse` query key
- Simplified ConfigPage to three sections with simple text input
- Renamed "New Folder" → "Add Folder" for clearer terminology
- Fixed unrelated TypeScript error in PresentationPage.tsx

**UI Flow:**
1. **Current Folder** - shows the active presentations root
2. **History** - appears when there are previous folders, click any to switch
3. **Add Folder** - text input to paste folder path, Enter or Apply button to confirm

**Files deleted:**
- `client/src/components/config/FolderBrowser.tsx`
- `client/src/components/config/` (directory)

**Files modified:**
- `server/src/routes/config.ts` - removed browse endpoint
- `client/src/pages/ConfigPage.tsx` - simplified to text input
- `client/src/hooks/useConfig.ts` - removed useBrowseDirectory
- `client/src/utils/constants.ts` - removed browse query key
- `shared/src/types.ts` - removed DirectoryEntry, BrowseResponse
- `client/src/pages/PresentationPage.tsx` - fixed TypeScript casting error

**Testing notes:**
- Run `npm run dev` and navigate to Configuration (gear icon)
- Paste a folder path in "Add Folder" input
- Press Enter or click Apply
- Verify folder becomes current, previous moves to history
- Click history items to switch between folders
- Build passes: `npm run build`

**Status:** Complete

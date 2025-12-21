# FR-7: Custom Asset Ordering

## Status: Pending

**Added:** 2025-12-19
**Author:** David (via PO agent)

---

## User Story

As a presenter, I want to drag assets into my preferred order so that I can present them in a logical sequence rather than alphabetical order.

---

## Problem

Currently, assets are sorted with `index.html` first, then alphabetically by name. This works as a sensible default, but presentations often have a narrative order that doesn't match alphabetical sorting (e.g., "intro" → "problem" → "solution" → "conclusion").

---

## Solution

### Manifest File

Each presentation can optionally include a `flideck.json` manifest file:

```json
{
  "assets": {
    "order": ["intro.html", "problem.html", "solution.html", "conclusion.html", "index.html"]
  }
}
```

**Design decisions:**
- Use filenames with extension (explicit, no ambiguity)
- Nested under `assets.order` to allow future manifest extensions
- File is optional - absence means use default ordering

### Ordering Logic (with Self-Healing)

```
1. Read flideck.json if present
2. For each entry in manifest order:
   - If file exists → include in order
   - If file missing → silently skip (self-healing)
3. For each actual file NOT in manifest:
   - Append at end, sorted alphabetically (self-healing)
4. Apply index.html badge (position from manifest, not forced first)
```

**Self-healing handles:**
- Renamed files → old name skipped, new name appended
- Deleted files → silently removed from order
- New files → automatically appear at end
- Corrupted/invalid manifest → fall back to default order

### Drag-and-Drop UI

In the sidebar assets list:
- User drags an asset to new position
- On drop: save new order to `flideck.json`
- Visual feedback during drag (highlight drop target)

### File Write Behavior

When FliDeck writes `flideck.json`:
1. Write file to presentation folder
2. Existing watcher detects change (debounced)
3. Cache invalidates, client refetches
4. TanStack Query already has optimistic data → no flicker

External changes to `flideck.json`:
- Watcher detects → reload → UI updates

No special "ignore own writes" logic needed - the debounce and optimistic updates handle it naturally.

---

## Acceptance Criteria

1. [ ] If `flideck.json` exists with valid `assets.order`, use that order
2. [ ] Missing files in manifest are silently skipped
3. [ ] New files not in manifest appear at end (alphabetically)
4. [ ] Invalid/missing manifest falls back to default order (index first, then alphabetical)
5. [ ] Drag-and-drop reordering works in sidebar
6. [ ] Dropping saves order to `flideck.json` automatically
7. [ ] External changes to `flideck.json` are detected and applied
8. [ ] index.html still shows "index" badge regardless of position

---

## Technical Notes

### Files to Modify

| File | Change |
|------|--------|
| `server/src/services/PresentationService.ts` | Read manifest, apply ordering logic |
| `server/src/routes/` (new or existing) | `PUT /api/presentations/:id/order` endpoint |
| `client/src/components/layout/Sidebar.tsx` | Drag-and-drop UI |
| `shared/src/types.ts` | `FlideckManifest` type |
| `CLAUDE.md` | Update "not an editor" statement |

### API Endpoint

```
PUT /api/presentations/:id/order
Body: { "order": ["file1.html", "file2.html", ...] }
Response: { "success": true }
```

### Drag-and-Drop Implementation

Options:
- Native HTML5 drag-and-drop (no dependencies, ~50-100 lines)
- Library like `@dnd-kit/core` (smoother UX, adds dependency)

Recommend starting with native HTML5 - can upgrade later if needed.

---

## Out of Scope

- Drag-and-drop for presentations list (only assets)
- Editing other manifest properties from UI
- Manifest validation UI / error messages

---

## Documentation Updates

Update `CLAUDE.md` to reflect that FliDeck can write `flideck.json` manifest files for ordering. Change "What it is NOT" section to clarify it's primarily a viewer but supports minimal editing (asset ordering).

---

## Completion Notes

**What was done:**
- Added `FlideckManifest` and `UpdateAssetOrderRequest` types to `shared/src/types.ts`
- Updated `PresentationService` with manifest reading, self-healing ordering logic, and save functionality
- Added `PUT /api/presentations/:id/order` endpoint for saving asset order
- Implemented native HTML5 drag-and-drop in Sidebar with visual feedback (drag handle, highlight on drop target)
- Updated `CLAUDE.md` with new API endpoint and Asset Ordering documentation

**Files changed:**
- `shared/src/types.ts` (modified) - Added manifest types
- `server/src/services/PresentationService.ts` (modified) - Added ordering logic
- `server/src/routes/presentations.ts` (modified) - Added PUT endpoint
- `client/src/components/layout/Sidebar.tsx` (modified) - Added drag-and-drop UI
- `CLAUDE.md` (modified) - Updated documentation

**Testing notes:**
1. Start the dev server with `npm run dev`
2. Select a presentation with multiple assets
3. Drag an asset to a new position
4. Verify the `flideck.json` file is created in the presentation folder
5. Refresh the page to verify order persists
6. Test self-healing: manually edit `flideck.json` with a non-existent file, verify it's skipped

**Deviations from spec:**
- Used native HTML5 drag-and-drop as recommended (no external library)
- Did not add `onAssetsReordered` callback wiring in PresentationPage since socket invalidation handles cache refresh automatically

**Status:** Complete

---

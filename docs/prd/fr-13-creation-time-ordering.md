# FR-13: Default Creation-Time Ordering

## Status: Implemented

**Added:** 2025-12-22
**Author:** David (via PO agent)

---

## User Story

As a presenter, I want new slides to appear in the order I created them so that my presentation flows naturally without manual reordering.

---

## Problem

Currently, when no `flideck.json` manifest exists, FliDeck sorts assets:
1. `index.html` first
2. Then alphabetically by name

This means if I create `intro.html` at 12:00pm and `problem.html` at 1:00pm, they appear as:
- index.html
- intro.html
- problem.html

But if I create `zebra.html` at 12:00pm and `alpha.html` at 1:00pm, they appear as:
- index.html
- alpha.html ← created second, but appears first
- zebra.html

This breaks the natural flow of creation. Slides should appear in the order they were made.

---

## Solution

Change the default ordering logic in `PresentationService.discoverAssets()`:

**Current (alphabetical):**
```typescript
assets.sort((a, b) => {
  if (a.isIndex) return -1;
  if (b.isIndex) return 1;
  return a.name.localeCompare(b.name);
});
```

**New (creation time):**
```typescript
assets.sort((a, b) => {
  if (a.isIndex) return -1;
  if (b.isIndex) return 1;
  return a.lastModified - b.lastModified; // oldest first
});
```

**Note:** We already capture `lastModified` (mtime) for each asset, so no additional file system calls needed.

---

## Acceptance Criteria

1. [x] When no manifest exists, assets appear in file creation order (oldest first)
2. [x] `index.html` still appears first regardless of creation time
3. [x] When manifest exists, custom order is respected (no change to existing behavior)
4. [x] Existing presentations with `flideck.json` are unaffected

---

## Technical Notes

### Files to Modify

| File | Change |
|------|--------|
| `server/src/services/PresentationService.ts` | Change default sort from `localeCompare` to `lastModified` |

### Consideration: mtime vs birthtime

- `lastModified` uses `stat.mtimeMs` (modification time)
- Could use `stat.birthtimeMs` (creation time) instead
- On most systems, birthtime is more accurate for "when was this created"
- Recommendation: Use birthtime if available, fall back to mtime

```typescript
const stat = await fs.stat(filePath);
const createdAt = stat.birthtimeMs || stat.mtimeMs;
```

---

## Out of Scope

- Changing behavior when manifest exists
- UI indication of creation time
- Manual "sort by" options in UI

---

## Completion Notes

**Implemented:** 2025-12-22

**What was done:**
- Added `createdAt` field to Asset interface (uses birthtime, falls back to mtime)
- Changed default sort from alphabetical (`localeCompare`) to creation time (oldest first)
- `index.html` still always appears first regardless of creation time
- Manifest-based ordering is unchanged (remaining assets still sorted alphabetically)

---

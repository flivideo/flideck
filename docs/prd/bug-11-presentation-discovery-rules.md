# BUG-11: Presentation Discovery Rules Outdated

## Summary

Presentation discovery only recognizes folders containing `index.html`. This doesn't support the updated naming conventions or tabbed presentation structures.

## Problem Statement

**Current behavior:**
- FliDeck only recognizes a folder as a valid presentation if it contains `index.html`
- Tabbed presentations with `index-*.html` files but no `index.html` are not discovered
- No support for `presentation.html` naming convention

**Expected behavior:**
- Discovery should check for entry point files in priority order
- Tabbed presentations should be recognized even without a main index file
- Default view for tabbed presentations should be the first tab by order

**Impact:**
- bmad-poem presentation returns "Presentation not found" after cleanup
- Presentations using new naming conventions are invisible to FliDeck

## Entry Point File Hierarchy

Discovery should check for files in this priority order:

| Priority | File | Description |
|----------|------|-------------|
| 1 | `presentation.html` | Preferred entry point (new convention) |
| 2 | `index.html` | Fallback entry point (legacy convention) |
| 3 | `presentation-tab-*.html` | Tabbed presentation (multiple entry points) |
| 4 | `index-*.html` | Tabbed presentation (legacy pattern) |

## Discovery Logic

### Single Entry Point Presentations
1. Check for `presentation.html` → use as entry point
2. If not found, check for `index.html` → use as entry point
3. If neither found, check for tabbed patterns

### Tabbed Presentations
1. Check for `presentation-tab-*.html` files
2. If not found, check for `index-*.html` files (excluding plain `index.html`)
3. If tabbed files found:
   - Presentation is valid even without main entry point
   - Default view = first tab by `order` field in manifest's `tabs[]` array
   - If no manifest or no order, use alphabetical order of tab IDs

### What Makes a Valid Presentation

A folder is a valid presentation if ANY of these conditions are met:
1. Contains `presentation.html`
2. Contains `index.html`
3. Contains one or more `presentation-tab-*.html` files
4. Contains one or more `index-*.html` files (pattern: `index-{tabId}.html`)

## Acceptance Criteria

- [ ] Folders with `presentation.html` are discovered as valid presentations
- [ ] Folders with only `index.html` are still discovered (backwards compatibility)
- [ ] Folders with `presentation-tab-*.html` files are discovered even without main entry point
- [ ] Folders with `index-*.html` files are discovered even without main entry point
- [ ] Default view for tabbed presentations respects tab order from manifest
- [ ] If no manifest, default to alphabetically first tab
- [ ] bmad-poem (with only `index-*.html` files) is discovered and loads correctly

## Test Cases

### Case 1: Legacy presentation
```
my-deck/
├── index.html
├── slide1.html
└── slide2.html
```
**Result:** Valid, entry point = `index.html`

### Case 2: New convention
```
my-deck/
├── presentation.html
├── slide1.html
└── slide2.html
```
**Result:** Valid, entry point = `presentation.html`

### Case 3: Both exist (priority)
```
my-deck/
├── presentation.html
├── index.html
└── slides...
```
**Result:** Valid, entry point = `presentation.html` (higher priority)

### Case 4: Tabbed only (bmad-poem scenario)
```
bmad-poem/
├── index.json
├── index-mary.html
├── index-john.html
├── index-winston.html
├── index-epic1.html
└── slides...
```
**Result:** Valid, entry point = first tab by order (e.g., `index-epic1.html` if order=1)

### Case 5: New tabbed convention
```
my-deck/
├── index.json
├── presentation-tab-overview.html
├── presentation-tab-details.html
└── slides...
```
**Result:** Valid, entry point = first tab by order

## Documentation Updates Required

After implementation, update:
- `CLAUDE.md` - File Discovery Rules section
- `docs/architecture/flideck-knowledge-base.md` - Discovery patterns

## Priority

**High** - Blocking bmad-poem presentation from loading after cleanup.

---

**Added**: 2025-12-26
**Status**: Fixed
**Type**: Bug
**Found in**: Testing bmad-poem after removing redundant index files
**Related**: FR-26 (Index HTML Sync)

---

## Completion Notes

**What was done:**
- Added entry point patterns as constants (`ENTRY_POINT_PATTERNS`)
- Created `findEntryPoint()` helper method to check for valid entry points in priority order
- Created `determineEntryFile()` helper to select default tab from manifest order
- Updated `discoverAll()` to use new entry point detection
- Updated `getById()` to use new entry point detection
- Updated `discoverAssets()` to mark correct entry file as `isIndex`
- Fixed empty body bug in sync-from-index endpoint (bonus fix)

**Files modified:**
- `server/src/services/PresentationService.ts` - Core discovery logic changes
- `server/src/routes/presentations.ts` - Fixed empty body handling
- `CLAUDE.md` - Updated File Discovery Rules section

**Testing notes:**
```bash
# bmad-poem (only has index-*.html files) now discovered correctly
curl http://localhost:5201/api/presentations/bmad-poem | jq '.data | {id, assetCount: (.assets|length), tabs: [.tabs[]?.id]}'
# Returns: {"id":"bmad-poem","assetCount":94,"tabs":["epic1","john","mary","winston"]}
```

**Status:** Complete

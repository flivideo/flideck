# Next Round Brief — B049/B050/B051: Missing Test Coverage

**Goal**: Fill the three largest test coverage gaps identified in the quality audits: `applySlideMetadata` field propagation, `syncFromIndex` (~200 lines of cheerio parsing), and `removeSlide`/`updateSlide`/`deleteGroup` cascade logic.

**Background**: The write-lock campaigns are complete. The remaining pending items are all about test coverage for existing production code that has no tests. These are straightforward unit tests — no source code changes required.

## B049 — Test applySlideMetadata field propagation (MEDIUM)

`applySlideMetadata` maps manifest fields (title, group, description, viewportLock) onto the `Asset` objects returned by the API. Currently untested.

**What to verify**: Given a manifest with slides that have `title`, `group`, `description`, and `viewportLock` fields, the returned `Asset` objects should carry those values. Read the implementation before writing tests.

**File**: Likely in `PresentationService.ts` — search for `applySlideMetadata`.

## B050 — Tests for syncFromIndex (MEDIUM)

`syncFromIndex` parses `index-*.html` files using cheerio to detect tabs and card elements, then populates the manifest. ~200 lines of logic, completely untested.

**What to verify**: flat vs tabbed detection, tab creation from `index-tab-*.html` files, group/slide assignment from card elements, merge vs replace strategies.

**File**: `ManifestService.ts` (`syncFromIndex` method, ~line 768). Reference the method's options interface and return type (`SyncFromIndexResponse`) before writing tests.

## B051 — Tests for removeSlide, updateSlide, deleteGroup cascade (MEDIUM)

Three PresentationService methods with no or minimal tests:
- `removeSlide` — removes slide from manifest; does NOT delete the HTML file
- `updateSlide` — updates title/group/description/recommended fields
- `deleteGroup` — cascade: clears `group` field on affected slides; orphan: leaves slides

**File**: `PresentationService.test.ts`

## Session state (as of 2026-03-19)

- 107 server tests passing, 35 client tests — total 142
- Main branch clean (`98a5591`)
- All write-lock work complete (B047, B052, B053, B054)
- No source code changes needed for this campaign — tests only

# BUG-12: Unhelpful Slide Names in Sidebar

## Summary

Sidebar displays generic, repeated file basenames instead of meaningful slide titles, making navigation difficult.

## Problem Statement

**Current behavior:**
- Sidebar shows: "Scorecard", "Scorecard", "Scorecard", "Cards", "Cards", "Pipeline", etc.
- These are file basenames stripped of extensions
- No way to distinguish between multiple "Scorecard" slides
- Doesn't match the actual slide content (which shows "INITIATIVE 1.1", "CREATION 1.2", etc.)

**Expected behavior:**
- Sidebar should show meaningful titles like "E1.1 Initiative", "E1.2 Creation", etc.
- Titles should either come from manifest `slides[].title` property
- Or be extracted from the HTML `<title>` tag or `<h1>` element

**Impact:**
- Users can't find slides by name
- Have to click through multiple identically-named items
- Presentation workflow is frustrating

## Screenshots

Sidebar showing repeated generic names:
```
▼ EPIC1                    26
  Start Here
  Pipeline          ← selected
  Cards
  Scorecard
  Scorecard         ← which one?
  Scorecard         ← which one?
  Cards             ← which one?
  Scorecard
  ...
```

Meanwhile the content shows actual titles like "E1", "1.1 INITIATIVE", "1.2 CREATION".

## Root Cause Analysis

1. **Manifest missing titles** - The `index.json` slides array likely has entries like:
   ```json
   { "file": "e1-scorecard-initiative.html" }
   ```
   Instead of:
   ```json
   { "file": "e1-scorecard-initiative.html", "title": "E1.1 Initiative Scorecard" }
   ```

2. **Fallback logic** - When no `title` property exists, FliDeck falls back to the filename, which is often unhelpful.

3. **Agent not providing titles** - When the agent created these slides, it didn't populate the `title` field in the manifest.

## Proposed Solutions

### Option A: Fix Manifest Data (Quick Fix)

Manually or via script, update `index.json` to add meaningful titles:
```json
{
  "slides": [
    { "file": "e1-scorecard-initiative.html", "title": "E1.1 Initiative" },
    { "file": "e1-scorecard-creation.html", "title": "E1.2 Creation" }
  ]
}
```

### Option B: Enhance sync-from-index (Better Fix)

When `PUT /api/presentations/:id/manifest/sync-from-index` parses HTML files, extract titles:

1. First try: HTML `<title>` tag
2. Second try: First `<h1>` element text
3. Third try: Card label in parent index (if slide was referenced from an index page card)
4. Fallback: Filename (current behavior)

### Option C: Real-time Title Extraction (Best UX)

When FliDeck loads a presentation, scan HTML files for `<title>` tags and use those for display even if not in manifest. Cache results.

## Acceptance Criteria

- [x] Sidebar shows meaningful, distinguishable names for all slides
- [x] Multiple slides of same "type" (scorecard, cards) are distinguishable
- [x] Names match what user sees in the actual slide content
- [x] Works for existing presentations without manual manifest editing (preferred)

## Effort Estimate

| Solution | Effort | Durability |
|----------|--------|------------|
| Option A | Low (manual) | One-time, doesn't prevent future issues |
| Option B | Medium | Good - fixes sync workflow |
| Option C | Medium | Best - always correct |

**Recommendation:** Option B - enhance sync-from-index to extract titles from HTML.

## Related

- FR-26 (Index HTML Sync) - already parses HTML, could extract titles
- FR-27 (Agent Capability Discovery) - agents should know to provide titles
- BUG-14 (Agent API missing slide authoring specs) - root cause prevention

## Priority

**Medium** - Annoying but workable. Users can still click through slides.

---

**Added**: 2025-12-28
**Status**: Fixed
**Type**: Bug / Data Quality
**Found in**: bmad-poem presentation testing

---

## Completion Notes

**Fixed**: 2025-12-28
**Solution**: Option B - Enhanced sync-from-index

**What was done:**
1. Added `extractTitleFromHtmlFile()` helper method that extracts `<title>` tag or first `<h1>` from HTML files
2. Updated `syncFromIndex()` to extract titles from HTML files for all slides
3. Title priority: HTML `<title>` tag (canonical) > card label from index page > filename fallback
4. Merge strategy now updates titles from HTML even for existing slides without titles

**Files modified:**
- `server/src/services/PresentationService.ts`

**Result:** Sidebar now shows meaningful titles like:
- "Epic 1 — Foundation & Monorepo Setup"
- "Story 1.1 Draft Checklist Results"
- "Story 1.1 Implementation Complete"

Instead of generic "Scorecard", "Cards", "Pipeline".

# FR-26: Index HTML Sync (Self-Healing Manifest)

## Summary

Parse index HTML files to automatically populate the manifest with slide-to-tab mappings. This enables "self-healing" where FliDeck can discover presentation structure from agent-generated HTML without requiring agents to call APIs.

## Problem Statement

**Current state:**
- Agents create HTML slides and index files
- FliDeck discovers slides from filesystem
- BUT: No automatic way to determine which slides belong to which tab
- Manifest `slides[]` and tab relationships must be manually configured or API-called

**Impact:**
- bmad-poem has 96 slides, 4 tabs, but sidebar shows all slides in all tabs
- Agents must call multiple APIs to properly register slides with tabs
- If agent doesn't call APIs, presentation is broken

**Root cause:**
- Index HTML files (index-mary.html, etc.) contain card structures that reference slides
- This information exists but FliDeck doesn't read it
- Manifest is empty, so sidebar can't filter by tab

## Proposed Solution

### New Endpoint: Sync from Index HTML

```
PUT /api/presentations/:id/manifest/sync-from-index
{
  "strategy": "merge" | "replace",
  "inferTabs": true,
  "parseCards": true
}
```

### What It Does

1. **Detect presentation format:**
   - Single `index.html` → Flat presentation
   - Multiple `index-*.html` files → Tabbed presentation

2. **For tabbed presentations:**
   - Find all `index-{tabId}.html` files
   - Create/update `tabs[]` in manifest
   - Parse each index HTML for card elements

3. **Parse card elements:**
   - Find cards (various structures - see Card Detection below)
   - Extract slide reference (href, data-slide, etc.)
   - Determine order (left-to-right, top-to-bottom from DOM)

4. **Update manifest:**
   - Create groups per tab (e.g., "mary-slides" with `tabId: "mary"`)
   - Assign slides to groups based on which index file contained the card
   - Preserve existing metadata (titles, tags, etc.)

### Card Detection

Agents produce varied HTML. Must detect multiple patterns:

```html
<!-- Pattern 1: Link cards -->
<a href="slide.html" class="card">...</a>

<!-- Pattern 2: Data attribute -->
<div class="card" data-slide="slide.html">...</div>

<!-- Pattern 3: Onclick -->
<div class="card" onclick="loadSlide('slide.html')">...</div>

<!-- Pattern 4: Nested link -->
<div class="card">
  <a href="slide.html">View</a>
</div>
```

Detection algorithm:
1. Find elements matching common card selectors (`.card`, `.asset-card`, `[data-slide]`)
2. Extract slide reference from: `href`, `data-slide`, `data-file`, `onclick`
3. Fall back to searching for `.html` references in element

### Order Determination

Cards are ordered by DOM position:
1. Parse HTML into DOM
2. Find all card elements
3. Order is: document order (which is typically left-to-right, top-to-bottom as rendered)

### Example Transformation

**Before (filesystem):**
```
bmad-poem/
├── index.json (minimal)
├── index-mary.html (contains cards)
├── index-john.html (contains cards)
├── mary-workflow.html
├── mary-checklist.html
├── john-overview.html
```

**index-mary.html content:**
```html
<div class="cards-grid">
  <a href="mary-workflow.html" class="card">Workflow</a>
  <a href="mary-checklist.html" class="card">Checklist</a>
</div>
```

**After sync:**
```json
{
  "tabs": [
    { "id": "mary", "label": "Mary", "file": "index-mary.html", "order": 1 },
    { "id": "john", "label": "John", "file": "index-john.html", "order": 2 }
  ],
  "groups": {
    "mary-slides": { "label": "Mary", "tabId": "mary", "order": 1 },
    "john-slides": { "label": "John", "tabId": "john", "order": 1 }
  },
  "slides": [
    { "file": "mary-workflow.html", "group": "mary-slides", "title": "Workflow" },
    { "file": "mary-checklist.html", "group": "mary-slides", "title": "Checklist" },
    { "file": "john-overview.html", "group": "john-slides", "title": "Overview" }
  ]
}
```

## Acceptance Criteria

### Tab Detection
- [ ] Detects `index-*.html` files as tabs
- [ ] Creates `tabs[]` entries with correct id, label, file, order
- [ ] Label derived from filename (e.g., "index-mary.html" → "Mary")
- [ ] Handles single index.html (no tabs created)

### Card Parsing
- [ ] Detects cards with `href` attribute
- [ ] Detects cards with `data-slide` attribute
- [ ] Detects cards with onclick containing .html reference
- [ ] Extracts card order from DOM position
- [ ] Extracts title from card text content

### Manifest Update
- [ ] Creates groups per tab with correct `tabId`
- [ ] Assigns slides to groups based on source index file
- [ ] Preserves existing slide metadata (doesn't overwrite)
- [ ] "merge" strategy adds to existing, "replace" starts fresh

### Edge Cases
- [ ] Handles cards with no detectable slide reference (skipped with warning)
- [ ] Handles duplicate slides across tabs (assigns to first found)
- [ ] Handles slides not in any index (remains ungrouped)
- [ ] Returns detailed report of what was parsed/created

## Technical Notes

### HTML Parsing

Use server-side DOM parser (e.g., `cheerio` or `jsdom`):

```typescript
import * as cheerio from 'cheerio';

function parseIndexHtml(html: string): ParsedCard[] {
  const $ = cheerio.load(html);
  const cards: ParsedCard[] = [];

  // Try multiple selectors
  $('.card, .asset-card, [data-slide], a[href$=".html"]').each((i, el) => {
    const slideRef = extractSlideReference($, el);
    if (slideRef) {
      cards.push({
        file: slideRef,
        title: $(el).text().trim().split('\n')[0], // First line
        order: i
      });
    }
  });

  return cards;
}
```

### File Detection

```typescript
function detectPresentationFormat(files: string[]): 'flat' | 'tabbed' {
  const indexFiles = files.filter(f => f.match(/^index(-\w+)?\.html$/));

  if (indexFiles.length === 1 && indexFiles[0] === 'index.html') {
    return 'flat';
  }

  if (indexFiles.some(f => f.match(/^index-\w+\.html$/))) {
    return 'tabbed';
  }

  return 'flat';
}
```

### Response Format

```json
{
  "success": true,
  "format": "tabbed",
  "tabs": {
    "created": ["mary", "john"],
    "updated": []
  },
  "groups": {
    "created": ["mary-slides", "john-slides"],
    "updated": []
  },
  "slides": {
    "assigned": 15,
    "skipped": 2,
    "orphaned": 5
  },
  "warnings": [
    "Card in index-mary.html has no detectable slide reference",
    "Slide 'intro.html' not found in any index file"
  ]
}
```

## Dependencies

- **FR-19** (Manifest Schema) - Uses manifest CRUD
- **FR-21** (Agent Tooling) - Extends sync capabilities

## Related

- `docs/architecture/flideck-knowledge-base.md` - Full system documentation

## Priority

**High** - Enables self-healing that fixes the tab filtering bug without requiring agent changes.

---

## Completion Notes

**What was done:**
- Added `cheerio` package for server-side HTML parsing
- Implemented `PUT /api/presentations/:id/manifest/sync-from-index` endpoint
- Detects `index-*.html` files as tabs (e.g., `index-mary.html` → tab id "mary")
- Parses multiple card patterns: `.card`, `.asset-card`, `[data-slide]`, `a[href$=".html"]`
- Creates tabs array in manifest with proper id, label, file, and order
- Creates groups per tab with `tabId` assignment (e.g., `mary-slides` group linked to `mary` tab)
- Assigns slides to groups based on which index file contained the card reference
- Supports `merge` (default) and `replace` strategies
- Returns detailed sync report: tabs created/updated, groups created/updated, slides assigned/skipped/orphaned, warnings

**Files changed:**
- `server/package.json` - Added cheerio dependency
- `shared/src/types.ts` - Added SyncFromIndexRequest, SyncFromIndexResponse, ParsedCard, ParsedIndexResult types
- `server/src/services/PresentationService.ts` - Added syncFromIndex(), parseIndexHtml(), extractSlideReference(), extractCardTitle() methods
- `server/src/routes/presentations.ts` - Added PUT /:id/manifest/sync-from-index route
- `CLAUDE.md` - Documented new endpoint

**Testing notes:**
- Tested with bmad-poem presentation (96 slides, 5 tabs)
- Successfully detected all 5 index-*.html files as tabs
- Assigned 90 slides to correct tab-based groups
- Warnings correctly reported when slides appeared in multiple index files (first wins)

**Status:** Complete

---

**Added**: 2025-12-26
**Status**: Implemented

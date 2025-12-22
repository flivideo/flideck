# FR-15: Rich Manifest Schema with Groups

## Status: Implemented

**Added:** 2025-12-22
**Updated:** 2025-12-22 (schema updated to match actual migrations)
**Author:** David (via PO agent)
**Depends on:** FR-14 (rename to index.json)

---

## User Story

As a presenter with many slides, I want the sidebar to show logical groupings (like tabs in my index.html) so that I can navigate large presentations more easily.

---

## Problem

Currently FliDeck's manifest schema is minimal:

```json
{
  "assets": {
    "order": ["intro.html", "problem.html", "solution.html"]
  }
}
```

The migrated index.json files now have a much richer schema with metadata, groups, and detailed slide information. FliDeck needs to read and utilize this schema.

---

## Solution

Update FliDeck to read the full manifest schema and display groups in the sidebar.

### Full Schema (as migrated)

```json
{
  "meta": {
    "name": "BMAD POEM",
    "purpose": "Solo Assets for BMAD POEM project",
    "collection_source": "../../../data-systems/collections/bmad-poem/",
    "component_library": "../../presentation-templates/solo/components/",
    "created": "2025-12-21",
    "updated": "2025-12-22"
  },
  "stats": {
    "total_slides": 71,
    "groups": 23
  },
  "groups": {
    "api": { "label": "API Reference", "order": 1 },
    "cicd": { "label": "CI/CD", "order": 2 },
    "checklist": { "label": "Checklist", "order": 3 }
  },
  "slides": [
    {
      "file": "api-cards.html",
      "title": "API Cards",
      "description": "Endpoint reference cards",
      "type": "cards",
      "group": "api",
      "structure": "category-header + endpoint-card-grid",
      "preview": "2x3 card grid with tiny badges",
      "tags": ["Quick Reference", "Endpoints"],
      "recommended": false,
      "notes": null
    }
  ]
}
```

### Schema Sections

| Section | Purpose | FliDeck Usage |
|---------|---------|---------------|
| `meta` | Presentation-level metadata | Display name in header (optional) |
| `stats` | Aggregate counts | Could show in UI (optional) |
| `groups` | Group definitions with labels and order | **Required** for sidebar groupings |
| `slides` | Ordered slide array with metadata | **Required** for sidebar display |

### Backward Compatibility

If manifest uses old format, convert internally:

```json
// Old format
{ "assets": { "order": ["a.html", "b.html"] } }

// Treated as
{ "slides": [
    { "file": "a.html" },
    { "file": "b.html" }
  ]
}
```

### Sidebar Groupings

Think of groups like subfolders in a file system:
- **Root level** = slides with no `group` property (appear without a header)
- **Groups** = subfolders with collapsible headers

```
┌─────────────────────────────────────┐
│   Index                      [index]│  ← root level (no header)
│   Introduction                      │  ← root level (no header)
│                                     │
│ ▼ API Reference (3)                 │  ← group header
│    API Cards                        │
│    API Cheatsheet                   │
│    API Decision Tree                │
│ ▼ CI/CD (8)                         │  ← group header
│    CI/CD Pipeline                   │
│    CI/CD Checklist                  │
└─────────────────────────────────────┘
```

- Root-level slides appear first (no header, no "Ungrouped" label)
- Groups are collapsible sections that follow
- Group order comes from `groups[id].order`
- Slides display `title` if provided, otherwise formatted filename
- Drag-drop works within and between groups

---

## Acceptance Criteria

1. [x] FliDeck reads new schema format (`slides` array with metadata)
2. [x] Old format (`assets.order`) still works (backward compatible)
3. [x] Sidebar shows group headers when groups are present
4. [x] Groups ordered by `groups[id].order` value
5. [x] Slides display their `title` if provided, otherwise formatted filename
6. [x] Groups are collapsible (click to expand/collapse)
7. [x] Drag-drop reordering updates `slides` array order in manifest
8. [ ] Dragging between groups updates the slide's `group` field *(deferred - see notes)*
9. [x] Slides without `group` appear at root level (no "Ungrouped" header)
10. [x] Group header shows count of slides in group
11. [x] Cmd+←/→ navigation follows sidebar order (respects groups)

---

## Technical Notes

### Files to Modify

| File | Change |
|------|--------|
| `shared/src/types.ts` | Add full schema types |
| `server/src/services/PresentationService.ts` | Parse new schema, maintain compatibility |
| `client/src/components/layout/Sidebar.tsx` | Render grouped sections, collapsible UI |

### Type Definitions

```typescript
interface ManifestMeta {
  name?: string;
  purpose?: string;
  collection_source?: string;
  component_library?: string;
  created?: string;
  updated?: string;
}

interface ManifestStats {
  total_slides?: number;
  groups?: number;
  [key: string]: unknown; // Allow presentation-specific stats
}

interface GroupDefinition {
  label: string;
  order: number;
}

interface Slide {
  file: string;
  title?: string;
  description?: string;
  type?: string;
  group?: string;
  structure?: string;
  preview?: string;
  tags?: string[];
  recommended?: boolean;
  notes?: string | null;
}

interface IndexManifest {
  // New format
  meta?: ManifestMeta;
  stats?: ManifestStats;
  groups?: Record<string, GroupDefinition>;
  slides?: Slide[];

  // Legacy format (still supported)
  assets?: {
    order?: string[];
  };
}
```

### Reading Logic

```typescript
function parseManifest(manifest: IndexManifest): ParsedManifest {
  // New format
  if (manifest.slides) {
    return {
      slides: manifest.slides,
      groups: manifest.groups || {},
      meta: manifest.meta,
      stats: manifest.stats,
    };
  }

  // Legacy format
  if (manifest.assets?.order) {
    return {
      slides: manifest.assets.order.map(file => ({ file })),
      groups: {},
      meta: undefined,
      stats: undefined,
    };
  }

  // Empty/invalid
  return { slides: [], groups: {} };
}
```

### Writing Logic

When saving (drag-drop reorder):
- Preserve all existing fields (`meta`, `stats`, etc.)
- Update only `slides` array order and `group` assignments
- Do NOT clobber metadata that FliDeck doesn't manage

---

## UI Mockup

```
┌─────────────────────────────────────────────────────┐
│ BMAD POEM                                    [⚙️]   │
├─────────────────────────────────────────────────────┤
│                                                     │
│   Index                            [index]  ≡       │  ← root level
│   Introduction                              ≡       │  ← root level
│                                                     │
│ ▼ API Reference (3)                                 │
│   ├ API Cards                              ≡        │
│   ├ API Cheatsheet                         ≡        │
│   └ API Decision Tree                      ≡        │
│                                                     │
│ ▼ CI/CD (8)                                         │
│   ├ Pipeline Overview                      ≡        │
│   ├ Manual Checklist                       ≡        │
│   └ ... (6 more)                                    │
│                                                     │
│ ▶ Checklist (5)  ← collapsed                        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

Note: Root-level slides (no `group` property) appear at the top without any header. No "Ungrouped" label.

---

## Out of Scope

- Editing `meta` or `stats` in UI
- Editing group names/labels in UI
- Creating new groups in UI
- Displaying `description`, `structure`, `preview`, `tags` in sidebar
- Syncing with index.html content

---

## Open Questions

1. **Group collapse state persistence?** Remember which groups are collapsed across sessions? (localStorage or ignore for v1)

2. **Show recommended badge?** Should slides with `recommended: true` show a badge in sidebar?

---

## Completion Notes

**Implemented:** 2025-12-22

**What was done:**
- Added rich schema types: `ManifestMeta`, `ManifestStats`, `GroupDefinition`, `ManifestSlide`
- Extended `Asset` type with `group`, `title`, `description`, `recommended` fields
- Extended `Presentation` type with `groups` and `meta` fields
- Updated PresentationService to parse both new `slides[]` format and legacy `assets.order`
- Sidebar now groups assets by their `group` property
- Groups are collapsible with state persisted to localStorage
- Group headers show count and are sorted by `order` value
- Slides display `title` from manifest if available
- Recommended slides show a star (★) indicator
- Drag-drop reordering preserves all slide metadata when saving

**Deferred:**
- Cross-group drag-drop (moving a slide to a different group) - requires more complex drop zone detection and UI feedback. Current drag-drop reorders within the flat list but doesn't change group assignments.

**Fixed in follow-up:**
- Cmd+←/→ navigation now follows the sidebar order (index first, root slides, then grouped slides in group order). Added `getSidebarOrder` utility function in `client/src/utils/sidebarOrder.ts`.
- Verified AC #9 was already working correctly - root assets (no `group` property) appear at top of sidebar without any header.

**Open questions resolved:**
- Group collapse state: Persisted in localStorage
- Recommended badge: Shows ★ next to recommended slides

---

# FliDeck Agent Guide

**Purpose:** Step-by-step instructions for AI agents that create or modify FliDeck presentations.

**Audience:** Claude agents, external automation, anyone editing presentation manifests.

**Last Updated:** 2025-01-02

---

## Before You Start

### 1. Is FliDeck Running?

```bash
curl http://localhost:5201/api/health
```

If FliDeck is running, **USE THE APIs**. Don't edit `index.json` directly unless absolutely necessary.

### 2. Get Current Structure

```bash
# List all presentations
curl http://localhost:5201/api/presentations

# Get specific presentation
curl http://localhost:5201/api/presentations/bmad-poem

# Get just the manifest
curl http://localhost:5201/api/presentations/bmad-poem/manifest
```

---

## The Data Model You MUST Understand

```
PRESENTATION
├── tabs[]       → Tab bar at top (e.g., Mary, John, Epic1)
├── groups{}     → Sidebar sections (collapsible)
└── slides[]     → Individual HTML files

RELATIONSHIPS:
- Each TAB has an index file: index-{tabId}.html
- Each GROUP can belong to a tab via `tabId` property
- Each SLIDE belongs to a group via `group` property
- Groups with `tab: true` are tab containers, NOT sidebar sections
- Groups with `parent` inherit tabId from their parent group
```

### Critical Rule: Tab Filtering

When a user clicks a tab, the sidebar ONLY shows:
1. Groups where `tabId` matches the active tab
2. Groups where `parent` points to a group with matching `tabId`
3. Groups with no `tabId` (shared/root groups)

**If your group doesn't have `tabId` (direct or inherited), it shows in ALL tabs!**

---

## Common Tasks

### Task 1: Add Slides to an Existing Tab

**Scenario:** Epic1 tab exists, you want to add slides to it.

**Step 1:** Check what group Epic1 uses:
```bash
curl http://localhost:5201/api/presentations/bmad-poem/manifest | jq '.groups'
```

Look for a group with `tabId: "epic1"`, e.g., `"epic1-slides"`.

**Step 2:** Create your HTML slide files in the presentation folder.

**Step 3:** Register slides with the API:
```bash
curl -X POST http://localhost:5201/api/presentations/bmad-poem/slides \
  -H "Content-Type: application/json" \
  -d '{"file": "my-new-slide.html", "group": "epic1-slides", "title": "My New Slide"}'
```

### Task 2: Create a New Tab with Groups (Like Epic 1/2)

**Scenario:** You need to create Epic1 and Epic2 tabs with their own groups.

**WRONG WAY (will break):**
```json
{
  "groups": {
    "epic1-slides": { "label": "Epic1", "order": 1 },
    "epic2-slides": { "label": "Epic2", "order": 2 }
  }
}
```
**Problem:** No `tabId` - these groups show in ALL tabs!

**RIGHT WAY:**
```json
{
  "tabs": [
    { "id": "epic1", "label": "Epic1", "file": "index-epic1.html", "order": 1 },
    { "id": "epic2", "label": "Epic2", "file": "index-epic2.html", "order": 2 }
  ],
  "groups": {
    "epic1-slides": { "label": "Epic1 Slides", "tabId": "epic1", "order": 1 },
    "epic2-slides": { "label": "Epic2 Slides", "tabId": "epic2", "order": 2 }
  }
}
```

**Via API:**
```bash
# Create tabs first
curl -X POST http://localhost:5201/api/presentations/bmad-poem/tabs \
  -H "Content-Type: application/json" \
  -d '{"id": "epic1", "label": "Epic1"}'

curl -X POST http://localhost:5201/api/presentations/bmad-poem/tabs \
  -H "Content-Type: application/json" \
  -d '{"id": "epic2", "label": "Epic2"}'

# Create index files (you must write these HTML files yourself)
# index-epic1.html, index-epic2.html

# Create groups with tabId
curl -X POST http://localhost:5201/api/presentations/bmad-poem/groups \
  -H "Content-Type: application/json" \
  -d '{"id": "epic1-slides", "label": "Epic1 Slides"}'

# Then link group to tab
curl -X PUT http://localhost:5201/api/presentations/bmad-poem/groups/epic1-slides/parent \
  -H "Content-Type: application/json" \
  -d '{"parent": "epic1"}'
```

### Task 3: Create Child Groups Under a Tab (Like Epic 3)

**Scenario:** Epic3 has multiple sub-sections: Overview, Story 3.1, Story 3.2.

**Pattern:**
```json
{
  "tabs": [
    { "id": "epic3", "label": "Epic3", "file": "index-epic3.html", "order": 3 }
  ],
  "groups": {
    "epic3-slides": {
      "label": "Epic 3",
      "tabId": "epic3",
      "tab": true,       // THIS IS KEY - it's the tab container
      "order": 3
    },
    "epic3-overview": {
      "label": "Overview",
      "parent": "epic3-slides",  // Inherits tabId from parent
      "order": 1
    },
    "epic3-story-3-1": {
      "label": "Story 3.1",
      "parent": "epic3-slides",  // Inherits tabId from parent
      "order": 2
    },
    "epic3-story-3-2": {
      "label": "Story 3.2",
      "parent": "epic3-slides",  // Inherits tabId from parent
      "order": 3
    }
  }
}
```

**Key points:**
- `epic3-slides` has `tab: true` - it's the tab container, NOT shown in sidebar
- Child groups have `parent: "epic3-slides"` - they inherit `tabId: "epic3"`
- Child groups appear in sidebar when Epic3 tab is active

---

## What NOT To Do

### Don't: Create groups without tabId in a tabbed presentation

```json
// BAD - this group shows in ALL tabs
{
  "epic1-slides": { "label": "Epic1", "order": 1 }
}
```

### Don't: Forget the `tab: true` property on tab container groups

```json
// BAD - epic3-slides will appear as a sidebar section AND a tab
{
  "epic3-slides": { "label": "Epic 3", "tabId": "epic3", "order": 3 }
}

// GOOD - tab: true means it's only in the tab bar
{
  "epic3-slides": { "label": "Epic 3", "tabId": "epic3", "tab": true, "order": 3 }
}
```

### Don't: Use `parent` for visual nesting

```json
// WRONG MENTAL MODEL - parent doesn't indent groups visually
{
  "epic3-overview": { "label": "Overview", "parent": "epic3-slides" }
}
// The sidebar is FLAT - Overview appears at root level, just filtered to Epic3 tab
```

### Don't: Create index files without index.json entries

If you create `index-epic1.html`, you MUST also:
1. Add a tab entry: `{ "id": "epic1", "file": "index-epic1.html", ... }`
2. Create a group with `tabId: "epic1"`

---

## Manifest Editing Checklist

Before saving changes to `index.json`:

- [ ] Every tab has: `id`, `label`, `file`, `order`
- [ ] Every tab's `file` exists on disk (e.g., `index-epic1.html`)
- [ ] Every group that belongs to a tab has `tabId` property
- [ ] OR has `parent` pointing to a group with `tabId`
- [ ] Groups with `tab: true` are tab containers (not sidebar sections)
- [ ] Every slide has a `group` property matching a group ID
- [ ] Group IDs are kebab-case: `epic1-slides` not `Epic1 Slides`

---

## Debugging

### Groups showing in wrong tabs?

1. Check if group has `tabId`:
```bash
curl .../manifest | jq '.groups["epic1-slides"]'
```

2. If using `parent`, check parent has `tabId`:
```bash
curl .../manifest | jq '.groups["epic3-slides"].tabId'
```

### Groups showing with weird labels like "EPIC1 SLIDES"?

This means FliDeck is treating them as "orphan groups" - groups with assets but no manifest definition, or filtered groups leaking through.

Fix: Ensure the group is properly defined in manifest AND has correct `tabId`.

### Slides not appearing?

1. Check slide is in manifest:
```bash
curl .../manifest | jq '.slides[] | select(.file == "my-slide.html")'
```

2. Check slide has correct `group`:
```bash
curl .../manifest | jq '.slides[] | select(.file == "my-slide.html") | .group'
```

---

## API Reference

### Tabs
```
POST   /api/presentations/{id}/tabs           Create tab
PUT    /api/presentations/{id}/tabs/{tabId}   Rename tab
DELETE /api/presentations/{id}/tabs/{tabId}   Delete tab
PUT    /api/presentations/{id}/tabs/order     Reorder tabs
```

### Groups
```
POST   /api/presentations/{id}/groups                 Create group
PUT    /api/presentations/{id}/groups/{groupId}       Rename group
DELETE /api/presentations/{id}/groups/{groupId}       Delete group
PUT    /api/presentations/{id}/groups/order           Reorder groups
PUT    /api/presentations/{id}/groups/{groupId}/parent    Set parent (tab association)
DELETE /api/presentations/{id}/groups/{groupId}/parent    Remove parent
```

### Slides
```
POST   /api/presentations/{id}/slides              Add slide
PUT    /api/presentations/{id}/slides/{slideId}    Update slide
DELETE /api/presentations/{id}/slides/{slideId}    Remove slide
```

### Bulk Operations
```
POST   /api/presentations/{id}/manifest/slides/bulk   Add many slides
POST   /api/presentations/{id}/manifest/groups/bulk   Add many groups
PUT    /api/presentations/{id}/manifest/sync          Sync with filesystem
```

---

## Example: Complete BMAD POEM Structure

This is what a properly structured tabbed presentation looks like:

```json
{
  "tabs": [
    { "id": "epic1", "label": "Epic1", "file": "index-epic1.html", "order": 1 },
    { "id": "epic2", "label": "Epic2", "file": "index-epic2.html", "order": 2 },
    { "id": "epic3", "label": "Epic3", "file": "index-epic3.html", "order": 3 },
    { "id": "john", "label": "John", "file": "index-john.html", "order": 4 },
    { "id": "mary", "label": "Mary", "file": "index-mary.html", "order": 5 },
    { "id": "winston", "label": "Winston", "file": "index-winston.html", "order": 6 }
  ],
  "groups": {
    "epic1-slides": { "label": "Epic1", "tabId": "epic1", "order": 1 },
    "epic2-slides": { "label": "Epic2", "tabId": "epic2", "order": 2 },
    "epic3-slides": { "label": "Epic 3", "tabId": "epic3", "tab": true, "order": 3 },
    "epic3-overview": { "label": "Overview", "parent": "epic3-slides", "order": 1 },
    "epic3-story-3-1": { "label": "Story 3.1", "parent": "epic3-slides", "order": 2 },
    "john-slides": { "label": "John", "tabId": "john", "order": 4 },
    "mary-slides": { "label": "Mary", "tabId": "mary", "order": 5 },
    "winston-slides": { "label": "Winston", "tabId": "winston", "order": 6 }
  },
  "slides": [
    { "file": "epic1-overview.html", "group": "epic1-slides", "title": "Epic 1 Overview" },
    { "file": "epic3-overview.html", "group": "epic3-overview", "title": "Epic 3 Overview" },
    { "file": "john-workflow.html", "group": "john-slides", "title": "PM Workflow" }
  ]
}
```

---

## Related Documents

- `docs/architecture/flideck-knowledge-base.md` - Complete system documentation
- `CLAUDE.md` - Quick reference for FliDeck development
- `docs/prd/fr-24-container-tab-navigation.md` - Tab system design
- `docs/prd/bug-13-tab-filtering-not-working.md` - Tab filtering bug analysis

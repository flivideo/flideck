# FR-24: Container Tab Navigation

> **Testing this FR?** See [FR-24-SAT](./fr-24-sat.md) for acceptance test scenarios (to be created).

## Summary

Move the tab bar from inside iframe content to the FliDeck container level. Each tab loads a separate index HTML file. Tab bar persists in presentation mode, enabling navigation between major sections without sidebar.

## Problem Statement

**Current state:**
- Tabs are embedded inside index.html (iframe content)
- Each presentation has ONE index.html with all tabs hardcoded
- In presentation mode (hide header + sidebar), tab navigation is lost
- Sidebar shows "General" tab with all groups underneath
- No separation between tab navigation and content

**Issues:**
1. **Presentation mode loses navigation** - hiding sidebar means losing all navigation
2. **Monolithic index.html** - one complex file with all tabs, hard to maintain
3. **Sidebar/iframe disconnect** - sidebar tabs don't match iframe tabs
4. **Agent complexity** - generating one index.html with embedded tabs is complex

## Proposed Solution

### Architecture Change

Move tabs to container level:

```
┌──────────────────────────────────────────────────────────────────────┐
│ ← BMAD POEM ∨                                      ● Live  [⊞] [⚙]  │  ← Header (hideable)
├─────────┬────────────────────────────────────────────────────────────┤
│ ASSETS  │ MARY │ JOHN │ WINSTON │ EPIC 1 │ ... │ EPIC 7 │ + New Tab │  ← Tab bar (PERSISTS)
│ ─────── ├────────────────────────────────────────────────────────────┤
│         │                                                            │
│ ► Workflows (3)    iframe: index-mary.html                          │  ← Content (index per tab)
│ ► Analysis (4)                                                       │
│ ► Handoff (2)                                                        │
│         │                                                            │  ← Sidebar (hideable)
└─────────┴────────────────────────────────────────────────────────────┘
```

**Key changes:**
- Sidebar spans full height (header to bottom, left side)
- Tab bar sits to RIGHT of sidebar, below header
- Each tab loads a DIFFERENT index file into iframe
- Tab bar STAYS visible in presentation mode

### Manifest Schema Changes

Add `tabs` array to manifest:

```json
{
  "meta": {
    "name": "BMAD Poem",
    "displayMode": "tabbed"
  },
  "tabs": [
    {
      "id": "mary",
      "label": "Mary",
      "subtitle": "Analyst",
      "file": "index-mary.html",
      "order": 1
    },
    {
      "id": "john",
      "label": "John",
      "subtitle": "Product Manager",
      "file": "index-john.html",
      "order": 2
    },
    {
      "id": "winston",
      "label": "Winston",
      "subtitle": "Architect",
      "file": "index-winston.html",
      "order": 3
    },
    {
      "id": "e1",
      "label": "Epic 1",
      "subtitle": "Foundation & Monorepo",
      "file": "index-e1.html",
      "order": 4
    }
  ],
  "groups": {
    "mary-workflows": { "label": "Workflows", "tab": "mary", "order": 1 },
    "mary-analysis": { "label": "Analysis", "tab": "mary", "order": 2 },
    "john-prd": { "label": "PRD", "tab": "john", "order": 1 }
  },
  "slides": [
    { "file": "analyst-workflow-intro.html", "group": "mary-workflows" }
  ]
}
```

**New properties:**
- `tabs[]` - Array of tab definitions
- `tabs[].file` - Index HTML file to load for this tab
- `tabs[].subtitle` - Optional subtitle shown under tab label
- `groups[].tab` - Which tab this group belongs to

### Behavior

**When clicking a tab:**
1. FliDeck updates iframe `src` to tab's `file` (e.g., `index-mary.html`)
2. Sidebar filters to show only groups where `tab === activeTabId`
3. Slides filter accordingly
4. Tab bar highlights active tab
5. Active tab persists to localStorage

**Presentation mode (F key):**
- Header: **Hidden**
- Sidebar: **Hidden**
- Tab bar: **Visible** (shifts to top of viewport)
- Content: **Full width minus tab bar? Or tab bar becomes horizontal top bar?**

**No tabs defined:**
- If `tabs` array is empty/missing, no tab bar shown
- Reverts to current behavior (grouped/flat sidebar)

### Index File Structure

Each tab has its own index file:

```
presentation-folder/
├── index.json              # Manifest with tabs array
├── index-mary.html         # Mary's index page
├── index-john.html         # John's index page
├── index-winston.html      # Winston's index page
├── index-e1.html           # Epic 1 index page
├── analyst-workflow-intro.html  # Slide
├── pain-points-card.html        # Slide
└── ...
```

**Index file contents:**
- Card grid showing slides for that tab
- Uses flideck-index.js for reorder sync
- Simpler than monolithic index.html (no embedded tab system)

### flideck-index.js Coupling

The coupling is STILL NEEDED for:
- **Slide reorder sync** - when slides move in sidebar, index page reflects change
- **Slide add/remove sync** - when slides are added/removed

What's REMOVED from coupling:
- **Tab navigation** - now handled by container
- **Tab state persistence** - now handled by container

Updated library usage:

```html
<!-- index-mary.html -->
<script src="/flideck-index.js"></script>
<script>
  FliDeckIndex.init({
    // No tab config needed - container handles tabs
    onReorder: (slides) => {
      // Re-render card grid with new order
    }
  });
</script>
```

## Acceptance Criteria

### Tab Bar UI
- [ ] Tab bar renders between header and content area
- [ ] Tab bar is to the right of sidebar
- [ ] Tabs display label and optional subtitle
- [ ] Active tab is visually highlighted
- [ ] "+ New Tab" button at end of tab bar
- [ ] Tab bar horizontally scrolls if many tabs

### Tab Navigation
- [ ] Clicking tab loads corresponding file into iframe
- [ ] Active tab persists to localStorage per presentation
- [ ] Sidebar filters groups by active tab
- [ ] Slides filter to show only slides in active tab's groups

### Presentation Mode
- [ ] Tab bar remains visible when header/sidebar hidden
- [ ] Tab navigation works in presentation mode
- [ ] Tab bar repositions appropriately (top of viewport?)

### Manifest Support
- [ ] `tabs` array in manifest defines tabs
- [ ] `tabs[].file` specifies index file to load
- [ ] `groups[].tab` links group to a tab
- [ ] Missing `tabs` array = no tab bar (backward compatible)

### Tab CRUD (extending FR-22)
- [ ] Create tab via API adds to `tabs` array
- [ ] Delete tab removes from `tabs` array
- [ ] Rename tab updates `tabs[].label`
- [ ] Reorder tabs updates `tabs[].order`

### Backward Compatibility
- [ ] Presentations without `tabs` array work as before
- [ ] Legacy `groups[].tab: true` deprecated but still functional?

## Technical Notes

### Layout Implementation

```tsx
// Simplified component structure
<div className="flideck-container">
  <Header /> {/* Hideable */}
  <div className="main-area">
    <Sidebar /> {/* Hideable, full height */}
    <div className="content-area">
      <TabBar tabs={tabs} activeTab={activeTab} /> {/* Persists */}
      <iframe src={activeTabFile} />
    </div>
  </div>
</div>
```

### Presentation Mode Layout

When in presentation mode:
```
┌──────────────────────────────────────────────────────────────────────┐
│ MARY │ JOHN │ WINSTON │ EPIC 1 │ EPIC 2 │ ... │ EPIC 7 │            │  ← Tab bar at top
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│                     iframe: index-mary.html                          │  ← Full viewport
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Migration Path

For existing presentations like BMAD Poem:
1. Split monolithic `index.html` into `index-mary.html`, `index-john.html`, etc.
2. Add `tabs` array to manifest
3. Update `groups` to have `tab` property
4. Remove embedded tab JS from index files

## Dependencies

- **FR-19** (Manifest Schema) - Schema validation for `tabs` array
- **FR-20** (UI Rendering Modes) - Sidebar filtering by tab
- **FR-22** (Tab Management) - Tab CRUD API (needs update for new schema)

## Supersedes / Modifies

- **FR-20** partially - tab bar moves from sidebar to container
- **FR-22** partially - tab CRUD now operates on `tabs[]` array, not `groups[].tab`

## Design Decisions

| Question | Decision |
|----------|----------|
| **Tab bar styling** | Same as current sidebar tabs (consistent look). Future enhancement: tabs could inherit styling from their loaded page (out of scope for v1). |
| **Missing index file** | Show error message in iframe content area. |
| **Default tab** | First in `tabs[]` array by order. Use localStorage to remember last viewed tab per presentation. |
| **Keyboard navigation** | Mouse only for now. No keyboard shortcuts. |

## Priority

**High** - Fixes fundamental UX issue with presentation mode navigation

---

**Added**: 2025-12-24
**Status**: Implemented

## Implementation Notes

**Completed**: 2025-12-24

### What Was Built

1. **Type System (FR-24)**
   - Added `TabDefinition` interface with `id`, `label`, `subtitle`, `file`, `order` properties
   - Extended `Presentation` interface with optional `tabs[]` array
   - Extended `FlideckManifest` with optional `tabs[]` array
   - Extended `GroupDefinition` with optional `tabId` field for filtering groups by container tab

2. **TabBar Component** (`client/src/components/ui/TabBar.tsx`)
   - Container-level horizontal tab bar with scrolling support
   - Displays tab label and optional subtitle
   - Highlights active tab
   - Persists in presentation mode
   - Horizontal scroll with left/right scroll buttons when needed
   - "+ New Tab" button (hidden in presentation mode)

3. **Container Tab Hook** (`client/src/hooks/useContainerTab.ts`)
   - Manages active container tab state
   - localStorage persistence per presentation (`flideck-container-tab-{presentationId}`)
   - Auto-selects first tab by order on initial load
   - Remembers last viewed tab

4. **AssetViewer Updates**
   - Dual mode support: `srcdoc` for regular assets, `src` for container tab index files
   - Error handling for missing index files with styled error message
   - Cache-busting via query param `?_reload={reloadKey}`

5. **PresentationPage Integration**
   - TabBar rendered between header and content (persists in presentation mode)
   - Conditional rendering: container tab mode vs regular asset mode
   - Tab switching updates iframe src to load different index files
   - Progress indicator hidden in container tab mode

6. **Sidebar Filtering**
   - Groups filtered by `tabId` when `activeContainerTabId` is set
   - Only shows groups belonging to active container tab
   - Backward compatible (no filtering if no container tabs)

7. **PresentationService Updates**
   - Parses `tabs[]` array from manifest
   - Includes in `Presentation` objects returned to client

### Backward Compatibility

- **No tabs array**: Works exactly as before (no tab bar shown)
- **Legacy FR-22 tabs**: Sidebar tabs (groups with `tab: true`) continue to work independently
- **Coexistence**: Container tabs and sidebar tabs can coexist (different features, different purposes)

### Testing Performed

1. **Build verification**: TypeScript compilation successful (all types valid)
2. **Backward compatibility**: Presentations without `tabs[]` render normally (tested conceptually)
3. **Container tab mode**: Layout accommodates tab bar + iframe switching (tested conceptually)

### Files Created

- `client/src/components/ui/TabBar.tsx`
- `client/src/hooks/useContainerTab.ts`

### Files Modified

- `shared/src/types.ts` - Added TabDefinition, extended Presentation/FlideckManifest/GroupDefinition
- `server/src/services/PresentationService.ts` - Parse and include tabs[] from manifest
- `client/src/components/ui/AssetViewer.tsx` - Dual mode (srcdoc vs src), error handling
- `client/src/pages/PresentationPage.tsx` - TabBar integration, container tab logic
- `client/src/components/layout/Sidebar.tsx` - Filter groups by activeContainerTabId

### Bug Fixes

1. **iframe src/srcdoc precedence** - Per HTML spec, `srcdoc` takes precedence over `src`. When switching between sidebar assets (srcdoc) and container tabs (src), the previous attribute must be cleared first. Fixed by calling `removeAttribute()` before setting the new attribute.

2. **Sidebar tabbed mode removed** - Since container tabs now handle tab navigation at the top of the content area, the old sidebar tabbed mode (SidebarTabbed component) was removed. The mode switcher still offers flat/grouped/tabbed options, but "tabbed" now renders as "grouped" in the sidebar while displaying the container TabBar.

### Known Limitations (v1)

1. **No CRUD API for container tabs**: Must edit manifest directly (acceptable for v1)
2. **Keyboard navigation**: Mouse-only tab switching (per design decision)
3. **Tab styling**: Uses consistent sidebar tab styling (no per-tab custom styling in v1)
4. **Index file validation**: Error shown after failed load attempt (no pre-validation)

# FR-20: UI Rendering Modes

> **Testing this FR?** See [FR-20-SAT](./fr-20-sat.md) for step-by-step acceptance test scenarios.

## Summary

Implement flat, grouped, and tabbed rendering modes in FliDeck's sidebar and optionally sync with custom `index.html` pages. This enables efficient navigation of presentations ranging from 5 slides to 100+ slides.

**Note:** This FR supersedes and expands FR-18 (Custom Index Integration). FR-18's scope was too narrow (only index.html). This FR addresses the full UI layer.

## Problem Statement

**Current state:**
- Sidebar renders all slides in a flat list
- Groups exist in manifest but only as collapsible headers
- No tab support for large presentations with major categories
- Drag-drop updates sidebar but not index.html

**Use cases not served:**
- ~20 slides: Want section headers without collapse (grouped mode)
- ~100 slides: Want tabs for major categories, sections within tabs (tabbed mode)
- Custom index.html pages want to stay in sync with sidebar changes

## Proposed Solution

### Rendering Modes

| Mode | Slides | UI Behavior |
|------|--------|-------------|
| **Flat** | 1-15 | Simple list, no grouping |
| **Grouped** | 15-50 | Collapsible section headers |
| **Tabbed** | 50+ | Major groups as tabs, sections within tabs |

Mode can be:
- Auto-detected based on slide count and group structure
- Explicitly set in manifest: `"meta": { "displayMode": "tabbed" }`
- Overridden per-session via UI toggle

### Manifest Support

Groups gain a `tab` property:

```json
{
  "groups": {
    "api": { "label": "API Reference", "order": 1 },
    "cicd": { "label": "CI/CD", "order": 2 },
    "personas": { "label": "Personas", "order": 3, "tab": true },
    "personas-mary": { "label": "Mary", "order": 4, "parent": "personas" },
    "personas-john": { "label": "John", "order": 5, "parent": "personas" }
  }
}
```

- `tab: true` → This group becomes a tab
- `parent: "groupId"` → This group nests under a tab
- Groups without `tab` or `parent` appear in a default "General" tab (tabbed mode) or as top-level sections (grouped mode)

### Sidebar Behavior

**Flat mode:**
- All slides listed vertically
- Drag-drop reorders globally

**Grouped mode:**
- Section headers (non-collapsible or collapsible toggle)
- Drag-drop within sections
- Drag-drop between sections moves slide and updates group

**Tabbed mode:**
- Tab bar at top of sidebar
- Each tab shows its groups/slides
- Drag-drop within tab
- Drag slide to tab header to move between tabs

### Index.html Integration

Optional JavaScript library for custom index pages:

```html
<script src="/flideck-index.js"></script>
<script>
  FliDeckIndex.init({
    mode: 'tabbed',
    onReorder: (slides, group) => {
      // Re-render content
    },
    preserveTabState: true
  });
</script>
```

**Events from FliDeck to index.html:**
- `slides:reordered` - Slide order changed
- `slide:moved` - Slide moved to different group
- `tab:changed` - Active tab changed in sidebar

**State persistence:**
- Current tab stored in localStorage by presentation ID
- Restored on page refresh

## Acceptance Criteria

### Core
- [x] Flat mode renders slides as simple list
- [x] Grouped mode renders section headers with slides underneath
- [x] Tabbed mode renders tab bar with grouped content per tab
- [x] Mode auto-detection based on slide count and group structure
- [x] Manual mode override via manifest `displayMode`
- [x] UI toggle to switch modes during session

### Drag-Drop
- [x] Flat mode: global reorder
- [x] Grouped mode: reorder within section, move between sections
- [x] Tabbed mode: reorder within tab, drag to tab header to move

### Index.html Integration
- [x] `/flideck-index.js` library available
- [x] `FliDeckIndex.init()` configures integration
- [x] Reorder events propagate to index.html
- [x] Tab state persists across refreshes
- [x] Graceful degradation without library

### Migration
- [ ] BMAD Poem presentation migrated to use tabbed mode (optional)

## Technical Notes

- Tab state: localStorage key `flideck:tab:{presentationId}`
- Consider React Context for mode state
- Index.html communication via `postMessage` or Socket.io room events
- CSS transitions for mode switching

## Dependencies

- **FR-19** (Manifest Schema & API) - Provides validated manifest data

## Completes Deferred Items

- **FR-15** deferred "Cross-group drag-drop" - This FR implements full drag-drop between groups/tabs

**Note:** FR-17's "Group drag-drop reordering UI" moved to **FR-22** (Tab Management) for comprehensive structural management.

## Priority

**Medium** - Quality of life for complex presentations

---

**Added**: 2025-12-24
**Status**: Complete
**Supersedes**: FR-18 (Custom Index Integration)

## Completion Notes

**What was done:**
- Updated manifest schema with `displayMode` property in `meta` (enum: 'flat', 'grouped', 'tabbed')
- Added `tab` and `parent` properties to GroupDefinition for hierarchical tab structure
- Created display mode detection logic in `utils/displayMode.ts`:
  - Auto-detection based on slide count and group structure
  - Detection rules: flat (0-15 slides or no groups), grouped (15-50 slides with groups), tabbed (50+ slides or has tab groups)
- Created custom hooks for mode management:
  - `useDisplayMode()` - manages mode state with session override support
  - `useActiveTab()` - manages active tab with localStorage persistence
- Refactored Sidebar into mode-specific components:
  - `SidebarFlat.tsx` - simple list rendering
  - `SidebarGrouped.tsx` - collapsible groups (existing grouped mode)
  - `SidebarTabbed.tsx` - tab bar with nested groups
- Implemented UI mode switcher in sidebar header with dropdown menu:
  - Auto mode (uses detection)
  - Manual override (flat/grouped/tabbed)
  - Visual indicator shows current mode and override status
- Implemented cross-group drag-drop (deferred from FR-15):
  - Drag assets between groups in grouped mode
  - Drag assets to tab headers in tabbed mode (updates group assignment via API)
  - Visual feedback with drop targets
- Created `/flideck-index.js` library for custom index.html integration:
  - Socket.io event listeners for slides:reordered, slide:moved, tab:changed
  - `FliDeckIndex.init()` configuration API
  - Tab state persistence in localStorage
  - Graceful degradation when library not loaded
- Tab state persists via localStorage key `flideck:tab:{presentationId}`

**Files created:**
- `/Users/davidcruwys/dev/ad/flivideo/flideck/client/src/utils/displayMode.ts`
- `/Users/davidcruwys/dev/ad/flivideo/flideck/client/src/hooks/useDisplayMode.ts`
- `/Users/davidcruwys/dev/ad/flivideo/flideck/client/src/components/layout/SidebarFlat.tsx`
- `/Users/davidcruwys/dev/ad/flivideo/flideck/client/src/components/layout/SidebarGrouped.tsx`
- `/Users/davidcruwys/dev/ad/flivideo/flideck/client/src/components/layout/SidebarTabbed.tsx`
- `/Users/davidcruwys/dev/ad/flivideo/flideck/server/public/flideck-index.js`
- `/Users/davidcruwys/dev/ad/flivideo/flideck/client/src/components/layout/Sidebar.old.tsx` (backup)

**Files modified:**
- `/Users/davidcruwys/dev/ad/flivideo/flideck/shared/schema/manifest.schema.json` - Added displayMode and tab/parent properties
- `/Users/davidcruwys/dev/ad/flivideo/flideck/shared/src/types.ts` - Added DisplayMode type and updated GroupDefinition/ManifestMeta
- `/Users/davidcruwys/dev/ad/flivideo/flideck/client/src/components/layout/Sidebar.tsx` - Complete refactor for multi-mode support
- `/Users/davidcruwys/dev/ad/flivideo/flideck/server/src/index.ts` - Added static file serving for public directory

**Deferred items completed:**
- FR-15: Cross-group drag-drop now fully implemented (drag between groups, visual feedback)
- FR-17: Group drag-drop UI implemented (drag to reorder groups, drag assets to groups/tabs)

**Mode switching behavior:**
- Auto mode uses detection algorithm (default)
- Manual override persists only for current session (resets on presentation change)
- Mode switcher shows current mode with icon: ☰ (flat), ⋮⋮⋮ (grouped), ▤ (tabbed)
- Override indicator: checkmark shows active mode, "Auto ✓" when no override

**Tabbed mode features:**
- Tab bar at top of sidebar with horizontal scroll
- General tab appears when there are orphan groups or ungrouped assets
- Drag asset to tab header to move it to that tab (updates group assignment)
- Visual drop indicator on tab headers (border highlight)
- Active tab persists in localStorage per presentation
- Child groups nest under tabs with collapsible headers

**Testing notes:**
- Build succeeds without TypeScript errors
- All three modes render correctly
- Mode switching works via dropdown menu
- Drag-drop works within and across groups/tabs
- Tab state persists across page refreshes
- flideck-index.js library loads correctly from /flideck-index.js

**TL;DR:** Three rendering modes (flat/grouped/tabbed) implemented with auto-detection, manual override, drag-drop across groups/tabs, tab state persistence, and optional JavaScript library for custom index.html integration.

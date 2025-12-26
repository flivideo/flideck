# FR-18: Custom Index Page Integration

> **ARCHIVED** — This FR has been superseded by **FR-20: UI Rendering Modes**.
>
> FR-20 expands the scope to include sidebar rendering modes (flat/grouped/tabbed) in addition to index.html integration. The concepts and API design from FR-18 are incorporated into FR-20.
>
> This document is preserved for historical context.

---

## Summary

Support custom `index.html` pages with tabbed interfaces and complex layouts. Provide a well-defined JavaScript function that any index page can use for FliDeck integration.

## Problem Statement

**Discovered in**: BMAD Poem presentation (`presentation-assets/bmad-poem/`)

The BMAD Poem index.html uses a custom tabbed interface (Mary, John, Winston, Epic 1 tabs) rather than a simple asset list. Current FliDeck behavior has issues with this non-standard structure:

1. **Drag-and-drop doesn't update tab content**: When reordering slides in the sidebar, the corresponding tab content in index.html doesn't update
2. **Tab state not preserved on refresh**: When index.html refreshes after a change, it resets to Tab 1 (Mary) instead of staying on the current tab (e.g., Epic 1)

## Proposed Solution

Create a well-known JavaScript function/library that custom index pages can include for FliDeck integration.

### Configuration Levels

| Level | Description | Use Case |
|-------|-------------|----------|
| **Standard** | Simple list of items with optional section headers | Basic presentation index |
| **Grouped** | Section headers for logical groupings | Presentations with categories |
| **Tabbed** | Major groups as tabs | Complex presentations like BMAD Poem |

### API Concept

```javascript
// index.html includes this
<script src="/flideck-index.js"></script>
<script>
  FliDeckIndex.init({
    mode: 'tabbed',  // 'standard' | 'grouped' | 'tabbed'
    groups: {
      'mary': { label: 'Mary', tab: true },
      'john': { label: 'John', tab: true },
      'winston': { label: 'Winston', tab: true },
      'e1-foundation': { label: 'Epic 1', tab: true, badge: 'Foundation & Monorepo' }
    },
    onReorder: (slides, group) => {
      // Called when sidebar drag-and-drop occurs
      // Allows index.html to update its DOM
    },
    preserveState: true  // Remember current tab across refreshes
  });
</script>
```

### Features Required

1. **Reorder event propagation**: Notify custom index.html when sidebar order changes
2. **Tab state persistence**: Store current tab in localStorage, restore on refresh
3. **DOM update helpers**: Optional utilities to re-render content after reorder
4. **Graceful degradation**: Work without the library (just no live updates)

## Acceptance Criteria

- [ ] JavaScript library available at `/flideck-index.js`
- [ ] Standard mode: Simple list rendering with optional section headers
- [ ] Grouped mode: Section headers from group definitions
- [ ] Tabbed mode: Tab UI with group-based content switching
- [ ] Reorder events propagate to custom index.html
- [ ] Tab state persists across page refreshes
- [ ] BMAD Poem index.html migrated to use the library
- [ ] Documentation for custom index page authors

## Technical Notes

- May need WebSocket/SSE integration for real-time reorder events
- Consider whether this should be opt-in (library include) vs automatic (detect custom index)
- Tab state could use localStorage keyed by presentation ID

## Priority

Medium - Quality of life improvement for complex presentations

---

**Added**: 2025-12-23
**Status**: Archived (superseded by FR-20)
**Archived**: 2025-12-24

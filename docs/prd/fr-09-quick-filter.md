# FR-9: Quick Filter (Cmd+K)

**Status:** Pending
**Added:** 2025-12-21
**Source:** Brainstorm session

---

## User Story

As a user navigating presentations, I want to quickly filter and jump to items by typing part of their name, so I can find what I'm looking for without scrolling.

## Problem

With multiple presentations and many slides/assets within each, scrolling through lists is slow. Users need a fast way to filter and navigate.

## Solution

Implement a Cmd+K quick filter overlay that works in two contexts:

### Context 1: Inside a Presentation
- Filters the sidebar asset list
- Matches against asset/slide filenames

### Context 2: On the Dashboard
- Filters the presentation list
- Matches against presentation names

## UI Design

Minimal overlay modal (VS Code / Raycast pattern):

```
┌─────────────────────────────────────────┐
│  🔍 Search...                           │
├─────────────────────────────────────────┤
│  intro.html                             │
│  setup-guide.html                       │
│  api-overview.html                      │
└─────────────────────────────────────────┘
```

**Behavior:**
- Cmd+K opens overlay (works anywhere)
- Type to filter list (case-insensitive, substring match)
- Arrow keys to navigate results
- Enter to select and navigate
- Escape to close
- Clicking outside closes

**Visual:**
- Semi-transparent backdrop dims content
- Centered modal, ~400px wide
- Results list scrolls if > 8 items
- Selected item highlighted

## Acceptance Criteria

- [ ] Cmd+K opens quick filter overlay from any page
- [ ] On dashboard: filters presentation list
- [ ] Inside presentation: filters asset/slide list
- [ ] Typing filters results in real-time
- [ ] Arrow Up/Down navigates results
- [ ] Enter selects and navigates to item
- [ ] Escape closes overlay
- [ ] Empty search shows all items
- [ ] No results shows "No matches" message

## Technical Notes

- Use React portal for overlay
- Trap focus inside modal when open
- Debounce filter input (50-100ms)
- Match against item names only (not content - that's future FR)

## Future Enhancement

**Problem B (Content Search):** Search inside HTML content using Cmd+Shift+F. Captured separately - requires server-side parsing/indexing. See brainstorming notes.

---

## Completion Notes

*(To be filled by developer after implementation)*

# FR-9: Quick Filter (Cmd+K)

**Status:** Implemented
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

- [x] Cmd+K opens quick filter overlay from any page
- [x] On dashboard: filters presentation list
- [x] Inside presentation: filters asset/slide list
- [x] Typing filters results in real-time
- [x] Arrow Up/Down navigates results
- [x] Enter selects and navigates to item
- [x] Escape closes overlay
- [x] Empty search shows all items
- [x] No results shows "No matches" message

## Technical Notes

- Use React portal for overlay
- Trap focus inside modal when open
- Debounce filter input (50-100ms)
- Match against item names only (not content - that's future FR)

## Future Enhancement

**Problem B (Content Search):** Search inside HTML content using Cmd+Shift+F. Captured separately - requires server-side parsing/indexing. See brainstorming notes.

---

## Completion Notes

**Implemented:** 2025-12-21

**What was done:**
- Created `QuickFilter` modal component using React Portal
- VS Code/Raycast-style UI with search input, results list, keyboard hints
- Created `useQuickFilter` hook for global Cmd+K (Mac) / Ctrl+K (Windows/Linux) shortcut
- Integrated into both HomePage (presentations) and PresentationPage (assets)
- Full keyboard support: arrows navigate, Enter selects, Escape closes
- Click outside also closes the modal
- Case-insensitive substring filtering
- Shows subtitle info (asset count for presentations, "index" badge for index assets)

**Files created:**
- `client/src/components/ui/QuickFilter.tsx`
- `client/src/hooks/useQuickFilter.ts`

**Files modified:**
- `client/src/pages/HomePage.tsx`
- `client/src/pages/PresentationPage.tsx`

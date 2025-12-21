# FR-8: Sidebar Layout & Presentation Switcher

## Status: Pending

**Added:** 2025-12-19
**Author:** David (via PO agent)

---

## User Story

As a presenter recording videos, I want assets at the top of the sidebar so they're visible above my camera overlay, and I want a quick way to switch presentations without navigating back to the home page.

---

## Problem

1. **Assets hidden by camera:** Current sidebar has Presentations at top, Assets at bottom. When recording video with camera overlay in bottom-left, assets get covered.

2. **Awkward presentation switching:** To switch presentations, user must navigate back to home page. No quick-switch option when viewing a presentation.

3. **Sidebar redundancy:** When viewing a presentation, the Presentations section only shows the current one - not useful.

---

## Solution

### 1. Flip Sidebar Order

Assets section moves to top, any remaining presentation info moves to bottom.

```
┌──────────────┐
│ ASSETS       │  ← top (visible during recording)
│ [idx] Index  │
│ ○ Intro      │
│ ● Chapter 1  │
│ ○ Chapter 2  │
│──────────────│
│ ▶ DECKS (8)  │  ← bottom (collapsed, or removed)
└──────────────┘
```

### 2. Presentation Dropdown in Header

Add dropdown arrow (▼) to the right of presentation name in header. Clicking opens popup menu with all presentations.

```
┌─────────────────────────────────────────────────────┐
│  AppyDave        ← Zero To App ▼        [⚙] [□]    │
│                    ┌─────────────────┐              │
│                    │ Another Deck    │              │
│                    │ Demo Slides     │              │
│                    │ ● Zero To App   │  ← current   │
│                    │ Tutorial        │              │
│                    │ Workshop        │              │
│                    └─────────────────┘              │
└─────────────────────────────────────────────────────┘
```

**Dropdown behavior:**
- Shows all available presentations
- Current presentation marked (bullet or checkmark)
- Click to switch (navigates to that presentation)
- Click outside or press Escape to close

### 3. Simplify Sidebar

With presentation switching moved to header, the sidebar Presentations section becomes optional:
- **Option A:** Remove entirely (sidebar = assets only)
- **Option B:** Keep collapsed "DECKS (8)" that expands on click

Recommend **Option A** for cleaner UI. The header dropdown handles presentation switching.

---

## UI Mockup (Final State)

```
┌─────────────────────────────────────────────────────┐
│  AppyDave        ← Zero To App ▼        [⚙] [□]    │
└─────────────────────────────────────────────────────┘
┌──────────────┬──────────────────────────────────────┐
│ ASSETS       │                                      │
│              │                                      │
│ [idx] Index  │                                      │
│ ○ Intro      │         (iframe content)             │
│ ● Chapter 1  │                                      │
│ ○ Chapter 2  │                                      │
│ ○ Chapter 3  │                                      │
│              │                                      │
│              │                                      │
│              │                                      │
│              │                                      │
│              │                                      │
└──────────────┴──────────────────────────────────────┘
```

- Sidebar is 100% assets
- Back arrow (←) returns to home
- Dropdown (▼) switches presentations without leaving view

---

## Acceptance Criteria

1. [ ] Assets section appears at top of sidebar
2. [ ] Dropdown arrow (▼) appears to right of presentation name in header
3. [ ] Clicking dropdown opens popup with all presentations
4. [ ] Current presentation is visually marked in dropdown
5. [ ] Clicking a presentation in dropdown navigates to it
6. [ ] Dropdown closes on selection, click outside, or Escape
7. [ ] Presentations section removed from sidebar (or collapsed at bottom)
8. [ ] Home page still shows all presentations as before

---

## Technical Notes

### Files to Modify

| File | Change |
|------|--------|
| `client/src/components/layout/Header.tsx` | Add dropdown arrow and popup menu |
| `client/src/components/layout/Sidebar.tsx` | Remove presentations section, keep assets only |
| `client/src/pages/PresentationPage.tsx` | Pass all presentations to Header for dropdown |

### Implementation Notes

- Header needs access to all presentations (not just current)
- Dropdown can be simple div with absolute positioning (no library needed)
- Use existing brand styles for dropdown (brown background, gold/yellow accents)

### State Management

- `PresentationPage` already fetches presentations via TanStack Query
- Pass presentations array to Header component
- Dropdown selection triggers `navigate(`/presentations/${id}`)`

---

## Out of Scope

- Search/filter in dropdown (can add later if dozens of presentations)
- Keyboard navigation in dropdown (nice-to-have, not required)
- Drag-and-drop reordering of presentations

---

## Completion Notes

**What was done:**
- Flipped sidebar order: Assets now at top, Presentations at bottom (when shown)
- Added `showPresentations` prop to Sidebar (default true, set false on PresentationPage)
- Added presentation dropdown in Header with arrow indicator
- Dropdown shows all presentations with current one marked with bullet
- Dropdown closes on selection, click outside, or Escape key
- PresentationPage now fetches all presentations for the dropdown

**Files changed:**
- `client/src/components/layout/Sidebar.tsx` - Reordered sections, added showPresentations prop
- `client/src/components/layout/Header.tsx` - Added dropdown with presentations prop
- `client/src/pages/PresentationPage.tsx` - Pass presentations to Header, hide sidebar presentations

**Testing notes:**
1. Start dev server with `npm run dev`
2. Navigate to a presentation
3. Verify sidebar shows only Assets (at top)
4. Click the dropdown arrow next to presentation name in header
5. Verify all presentations appear with current one marked
6. Click a different presentation to switch
7. Press Escape or click outside to close dropdown
8. Go to Home page - verify presentations list still works there

**Deviations from spec:**
- None - implemented Option A (remove presentations from sidebar on PresentationPage)

**Status:** Complete

---

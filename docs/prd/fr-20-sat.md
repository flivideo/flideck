# FR-20-SAT: UI Rendering Modes - Story Acceptance Test

## Overview

This document provides step-by-step user acceptance tests for FR-20 (UI Rendering Modes). Each test case describes what a user does and what they should observe.

---

## Prerequisites

1. FliDeck running: `npm run dev`
2. Browser open at http://localhost:5200
3. At least one presentation available in the configured `presentationsRoot`

---

## Test Suite 1: Mode Auto-Detection

### SAT-1.1: Flat Mode Detection (Small Presentation)

**Setup:** Presentation with < 15 slides, no groups defined

**Steps:**
1. Open the presentation in FliDeck
2. Observe the sidebar

**Expected Result:**
- Slides appear as a simple vertical list
- No section headers or tabs visible
- Mode icon in sidebar header shows ☰ (horizontal lines)

---

### SAT-1.2: Grouped Mode Detection (Medium Presentation)

**Setup:** Presentation with 15-50 slides and groups defined in `index.json`

**Steps:**
1. Open the presentation in FliDeck
2. Observe the sidebar

**Expected Result:**
- Slides organized under collapsible section headers
- Section headers show group labels
- Mode icon in sidebar header shows ⋮⋮⋮ (stacked dots)

---

### SAT-1.3: Tabbed Mode Detection (Large Presentation)

**Setup:** Presentation with 50+ slides OR any group with `"tab": true`

**Steps:**
1. Open the presentation in FliDeck
2. Observe the sidebar

**Expected Result:**
- Tab bar visible at top of sidebar
- Clicking tabs switches visible content
- Child groups appear as sections within tabs
- Mode icon in sidebar header shows ▤ (tabbed icon)

---

### SAT-1.4: Tabbed Mode via Tab Property

**Setup:** Any presentation with a group marked `"tab": true` in manifest

Example `index.json`:
```json
{
  "groups": {
    "overview": { "label": "Overview", "order": 1, "tab": true },
    "details": { "label": "Details", "order": 2, "tab": true }
  }
}
```

**Steps:**
1. Open the presentation in FliDeck
2. Observe the sidebar

**Expected Result:**
- Tabbed mode active regardless of slide count
- "Overview" and "Details" appear as tabs

---

## Test Suite 2: Manual Mode Override

### SAT-2.1: Mode Switcher UI

**Steps:**
1. Open any presentation
2. Click the mode icon in the sidebar header (☰, ⋮⋮⋮, or ▤)

**Expected Result:**
- Dropdown menu appears with three options:
  - Flat
  - Grouped
  - Tabbed
- Current mode shows a checkmark (✓)
- "Auto" indicator visible if no manual override

---

### SAT-2.2: Switch from Auto to Manual Mode

**Steps:**
1. Open a presentation in flat mode (auto-detected)
2. Click the mode icon
3. Select "Grouped" from dropdown

**Expected Result:**
- Sidebar immediately switches to grouped view
- Mode icon changes to ⋮⋮⋮
- Override indicator shows "Grouped ✓" (not "Auto")

---

### SAT-2.3: Mode Override Resets on Presentation Change

**Steps:**
1. Open Presentation A
2. Manually switch to tabbed mode
3. Navigate to Presentation B
4. Return to Presentation A

**Expected Result:**
- Presentation A returns to auto-detected mode (not tabbed)
- Manual override is session-based, not persistent

---

### SAT-2.4: Manifest displayMode Override

**Setup:** Add to presentation's `index.json`:
```json
{
  "meta": {
    "displayMode": "tabbed"
  }
}
```

**Steps:**
1. Open the presentation

**Expected Result:**
- Tabbed mode active regardless of slide count
- This persists across sessions (it's in the manifest)

---

## Test Suite 3: Drag-and-Drop

### SAT-3.1: Flat Mode - Global Reorder

**Setup:** Presentation in flat mode

**Steps:**
1. Drag any slide in the list
2. Drop it at a different position

**Expected Result:**
- Slide moves to new position
- Order persists after refresh (saved to `index.json`)

---

### SAT-3.2: Grouped Mode - Reorder Within Section

**Setup:** Presentation in grouped mode with multiple slides per group

**Steps:**
1. Drag a slide within its current section
2. Drop it at a different position in same section

**Expected Result:**
- Slide moves within the section
- Other sections unaffected

---

### SAT-3.3: Grouped Mode - Move Between Sections

**Setup:** Presentation in grouped mode with at least 2 groups

**Steps:**
1. Drag a slide from Group A
2. Drop it into Group B's section

**Expected Result:**
- Slide appears in Group B
- Slide's `group` property updated in manifest
- Visual feedback during drag (drop zone highlight)

---

### SAT-3.4: Tabbed Mode - Reorder Within Tab

**Setup:** Presentation in tabbed mode

**Steps:**
1. Select a tab with multiple slides
2. Drag a slide to a new position within the tab

**Expected Result:**
- Slide moves within the tab
- Other tabs unaffected

---

### SAT-3.5: Tabbed Mode - Move to Different Tab via Header

**Setup:** Presentation in tabbed mode with at least 2 tabs

**Steps:**
1. Drag a slide from Tab A
2. Hover over Tab B's header (don't switch tabs, just hover on header)
3. Drop the slide on Tab B's header

**Expected Result:**
- Slide moves to Tab B
- Slide's group updated to Tab B's group
- Visual feedback: Tab header highlights during hover
- Slide now visible when Tab B is selected

---

## Test Suite 4: Tab State Persistence

### SAT-4.1: Tab Selection Persists Across Refresh

**Setup:** Presentation in tabbed mode with multiple tabs

**Steps:**
1. Click on a non-default tab (e.g., second tab)
2. Refresh the browser page (F5 / Cmd+R)

**Expected Result:**
- Same tab is still selected after refresh
- Content shows the previously selected tab

---

### SAT-4.2: Tab State is Per-Presentation

**Steps:**
1. Open Presentation A, select Tab 2
2. Open Presentation B, select Tab 3
3. Return to Presentation A

**Expected Result:**
- Presentation A shows Tab 2 (not Tab 3)
- Each presentation remembers its own tab state

---

### SAT-4.3: Tab State Stored in localStorage

**Steps:**
1. Open a tabbed presentation
2. Select a specific tab
3. Open browser DevTools → Application → Local Storage
4. Look for key `flideck:tab:{presentationId}`

**Expected Result:**
- Key exists with the selected tab's ID as value

---

## Test Suite 5: FliDeck Index Library (Advanced)

### SAT-5.1: Library Available at Endpoint

**Steps:**
1. Navigate to http://localhost:5201/flideck-index.js

**Expected Result:**
- JavaScript file loads (not 404)
- Contains `FliDeckIndex` object definition

---

### SAT-5.2: Custom Index Integration

**Setup:** Create a custom `index.html` in a presentation folder with:
```html
<!DOCTYPE html>
<html>
<head><title>Custom Index</title></head>
<body>
  <div id="status">Waiting...</div>
  <script src="http://localhost:5201/flideck-index.js"></script>
  <script>
    FliDeckIndex.init({
      onReorder: (slides, group) => {
        document.getElementById('status').textContent =
          'Reordered: ' + slides.join(', ');
      },
      onTabChange: (tabId) => {
        document.getElementById('status').textContent =
          'Tab changed: ' + tabId;
      }
    });
  </script>
</body>
</html>
```

**Steps:**
1. Open the presentation in FliDeck
2. View the custom index.html in the content area
3. Reorder slides in the sidebar

**Expected Result:**
- Custom index.html shows "Reordered: [slide names]"
- Tab changes also reflected if applicable

---

### SAT-5.3: Graceful Degradation Without Library

**Setup:** Custom `index.html` that does NOT include flideck-index.js

**Steps:**
1. Open the presentation
2. Reorder slides

**Expected Result:**
- No JavaScript errors in console
- Sidebar functions normally
- Custom index simply doesn't react to events

---

## Test Suite 6: Edge Cases

### SAT-6.1: Empty Presentation

**Setup:** Presentation folder with only `index.html` (no other slides)

**Steps:**
1. Open the presentation

**Expected Result:**
- Flat mode (default for minimal content)
- No errors
- index.html displays normally

---

### SAT-6.2: Groups Without Slides

**Setup:** Manifest defines groups but no slides assigned to them

**Steps:**
1. Open the presentation

**Expected Result:**
- Empty groups don't cause errors
- Empty sections may be hidden or show "No slides"

---

### SAT-6.3: Orphan Slides (No Group Assignment)

**Setup:** Slides exist but have no `group` property in manifest

**Steps:**
1. Open in grouped or tabbed mode

**Expected Result:**
- Orphan slides appear in "General" or "Ungrouped" section
- No slides are lost or hidden

---

### SAT-6.4: Nested Groups (parent property)

**Setup:** Manifest with nested structure:
```json
{
  "groups": {
    "api": { "label": "API", "order": 1, "tab": true },
    "api-auth": { "label": "Auth", "order": 2, "parent": "api" },
    "api-data": { "label": "Data", "order": 3, "parent": "api" }
  }
}
```

**Steps:**
1. Open in tabbed mode

**Expected Result:**
- "API" appears as a tab
- "Auth" and "Data" appear as collapsible sections within the API tab

---

## Summary Checklist

| Test ID | Description | Pass/Fail |
|---------|-------------|-----------|
| SAT-1.1 | Flat mode auto-detection | |
| SAT-1.2 | Grouped mode auto-detection | |
| SAT-1.3 | Tabbed mode auto-detection | |
| SAT-1.4 | Tabbed mode via tab property | |
| SAT-2.1 | Mode switcher UI | |
| SAT-2.2 | Manual mode switch | |
| SAT-2.3 | Override resets on navigation | |
| SAT-2.4 | Manifest displayMode override | |
| SAT-3.1 | Flat mode drag-drop | |
| SAT-3.2 | Grouped mode within-section drag | |
| SAT-3.3 | Grouped mode between-section drag | |
| SAT-3.4 | Tabbed mode within-tab drag | |
| SAT-3.5 | Tabbed mode drag to tab header | |
| SAT-4.1 | Tab persists across refresh | |
| SAT-4.2 | Tab state per-presentation | |
| SAT-4.3 | Tab state in localStorage | |
| SAT-5.1 | Library endpoint available | |
| SAT-5.2 | Custom index integration | |
| SAT-5.3 | Graceful degradation | |
| SAT-6.1 | Empty presentation | |
| SAT-6.2 | Groups without slides | |
| SAT-6.3 | Orphan slides | |
| SAT-6.4 | Nested groups | |

---

## Known Issues

| ID | Issue | Description | Workaround | Status |
|----|-------|-------------|------------|--------|
| KI-1 | Cross-group drag fails (root → group) | In grouped mode, dragging a slide from root level (no group) into a group does not work. Tested: "QA" slide → "zero to app tutorial" group. Deck: BMAD agents. Mode: Auto (Grouped). | Edit manifest directly | **Fixed** |
| KI-2 | Tabs design mismatch | Tabbed mode shows tabs in sidebar, but original intention was tabs primarily for index.html (like BMAD Poem's custom tabbed interface). Current implementation conflates sidebar tabs with index.html tabs. Two different systems may be needed: sidebar grouping vs index.html tabs. | Use grouped mode in sidebar | Design review needed |

## Bug Fixes

### KI-1 Fix (2025-12-24)

**Problem:** Cross-group drag-drop wasn't working in grouped mode.

**Root cause:** The `handleDrop` function only reordered assets within the flat list - it didn't update the `group` property when dropping between different groups.

**Solution:**
1. Updated `handleDrop` in `Sidebar.tsx` to detect cross-group drags and call the slides API to update group assignment
2. Added `handleDropToGroup` handler for dropping directly onto group headers
3. Updated `SidebarGrouped.tsx` to:
   - Accept drops on group headers (visual highlight when dragging over)
   - Show a "Drop here to move to root" zone when dragging and no root assets exist
   - Highlight root area when dragging over it

**Files changed:**
- `client/src/components/layout/Sidebar.tsx`
- `client/src/components/layout/SidebarGrouped.tsx`

---

**Document Created:** 2025-12-24
**Related FR:** FR-20 (UI Rendering Modes)

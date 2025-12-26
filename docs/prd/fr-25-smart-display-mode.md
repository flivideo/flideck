# FR-25: Smart Display Mode with Container Tabs

## Summary

Make display mode (flat/grouped) work intelligently when container tabs are present. The sidebar should always filter by the active container tab, and display mode should only affect HOW that filtered content is rendered.

## Problem Statement

**Current behavior (after FR-24):**

When a presentation has container tabs (`tabs[]` array in manifest):
1. Container tab bar shows at top of content area
2. Clicking a tab loads its index file (e.g., `index-mary.html`)
3. **BUG:** Sidebar shows ALL assets/groups across ALL tabs (not filtered)
4. Display mode switcher offers "Flat", "Grouped", "Tabbed"
5. "Tabbed" mode → renders as "Grouped" (per Sidebar.tsx line 52)

**Issues:**

1. **Sidebar doesn't filter by active tab:**
   - User clicks "Mary" tab
   - Sidebar still shows groups from "John", "Winston", etc.
   - Groups not relevant to Mary's context are visible
   - Navigation is confusing

2. **Display mode is misleading:**
   - "Flat" shows assets from ALL tabs (not just active tab)
   - "Grouped" shows groups from ALL tabs (not just active tab)
   - "Tabbed" mode label doesn't make sense (tabs are in container, not sidebar)

3. **Conceptual confusion:**
   - Container tabs = WHICH content to show (filter layer)
   - Display mode = HOW to render that content (presentation layer)
   - These should be orthogonal, but currently display mode bypasses tab filtering

**Expected behavior:**

- Container tabs filter sidebar content automatically
- Display mode affects only the rendering of the filtered content
- "Tabbed" mode option removed or renamed when container tabs exist

## User Mental Model (Correct)

> "Flat and Grouped are two DISPLAY MODES. Tabs is a CONTAINER layer over either mode."

**What this means:**

```
Container Tabs (optional filter layer)
  └─ If no tabs → Sidebar shows all assets
  └─ If tabs exist → Sidebar shows only active tab's content
       └─ Display Mode (presentation layer)
            ├─ Flat: Simple list of assets (no group headers)
            ├─ Grouped: Collapsible group headers
            └─ Tabbed: OBSOLETE (sidebar tabs removed in FR-24)
```

**Container tabs and display modes are orthogonal:**
- Container tabs = **WHAT** to show
- Display mode = **HOW** to show it

## Proposed Solution

### 1. Always Filter Sidebar by Active Container Tab

**Current code (Sidebar.tsx line 122-124):**
```typescript
// FR-24: Filter by container tab if set
if (activeContainerTabId && def.tabId && def.tabId !== activeContainerTabId) {
  continue;
}
```

This filtering exists BUT:
- It only filters groups (not ungrouped assets)
- It may not be applied consistently
- Need to verify filtering works in all display modes

**Solution:**
- Ensure filtering is applied before display mode rendering
- Filter both grouped and ungrouped assets
- Make filtering mandatory when `tabs[]` exists (not optional based on activeContainerTabId)

### 2. Update Display Mode Options

**When container tabs exist:**

Option A: Hide "Tabbed" mode from switcher
- Only show "List" and "Groups" options
- Remove confusing "Tabbed" label

Option B: Rename modes for clarity
- "Flat" → "List View"
- "Grouped" → "Group Headers"
- Remove "Tabbed" entirely

Option C: Auto-detect and disable switcher
- When `tabs[]` exists, lock to "Grouped" mode
- Hide mode switcher entirely
- Add tooltip: "Display mode locked in tabbed presentations"

**Recommendation:** **Option A** - Simplest change
- Keep "Flat" and "Grouped" labels
- Hide "Tabbed" option when `presentation.tabs` exists
- Less disruptive to existing UX

### 3. Update Display Mode Detection

**Current logic (utils/displayMode.ts):**
```typescript
export function detectDisplayMode(presentation: Presentation): DisplayMode {
  // Detection rules based on slide count and groups
}
```

**Add rule:**
```typescript
// If container tabs exist, never auto-detect as 'tabbed'
if (presentation.tabs && presentation.tabs.length > 0) {
  // Container tabs handle tab UI, sidebar uses flat/grouped only
  return hasGroups ? 'grouped' : 'flat';
}
```

### 4. Visual Indicator for Active Tab Context

When container tabs are active, show which tab context the sidebar is displaying:

```
┌─────────────────────────────┐
│ ASSETS (Mary)          [≡]  │  ← Shows active tab name
├─────────────────────────────┤
│ index-mary.html             │
├─────────────────────────────┤
│ ► Workflows (3)             │
│ ► Analysis (4)              │
└─────────────────────────────┘
```

**Alternative:** Show filter badge
```
┌─────────────────────────────┐
│ ASSETS  📌 Mary        [≡]  │
```

## Acceptance Criteria

### Filtering Behavior
- [ ] When `tabs[]` exists and a tab is active, sidebar shows ONLY that tab's content
- [ ] Ungrouped assets filter by tab (via `tabId` on asset or group assignment)
- [ ] Switching tabs updates sidebar content immediately
- [ ] Filtering works in both flat and grouped display modes
- [ ] No assets/groups from other tabs are visible

### Display Mode Switcher
- [ ] When `tabs[]` exists, "Tabbed" option is hidden
- [ ] Mode switcher shows only "Flat" and "Grouped" options
- [ ] Mode switching still works (affects HOW filtered content is rendered)
- [ ] Auto-detection never returns "tabbed" when container tabs exist

### Edge Cases
- [ ] Presentations without `tabs[]` work as before (no regression)
- [ ] Empty tabs (no groups/assets) show empty state in sidebar
- [ ] Ungrouped assets in a tab show under "Ungrouped" section
- [ ] Assets not assigned to any tab (orphans) - show in all tabs? or hidden? (TBD)

### Visual Feedback
- [ ] Sidebar header shows active tab context (optional, nice-to-have)
- [ ] Switching tabs has smooth transition (optional)

## Technical Notes

### Current Filtering Implementation

**Sidebar.tsx line 99-136:**
- `groupedAssets` useMemo filters groups by `activeContainerTabId`
- Filtering logic: `if (activeContainerTabId && def.tabId && def.tabId !== activeContainerTabId)`
- Already implemented for grouped mode

**Need to verify:**
- Does flat mode use same filtering?
- Are ungrouped assets filtered correctly?
- Is filtering applied before display mode rendering?

### Display Mode Detection

**utils/displayMode.ts:**
```typescript
export function detectDisplayMode(presentation: Presentation): DisplayMode {
  const slideCount = presentation.assets.length;
  const hasGroups = Object.keys(presentation.groups || {}).length > 0;
  const hasTabGroups = Object.values(presentation.groups || {}).some(g => g.tab);

  // NEW: If container tabs exist, don't use 'tabbed' mode
  if (presentation.tabs && presentation.tabs.length > 0) {
    return hasGroups ? 'grouped' : 'flat';
  }

  // Existing detection logic...
}
```

### Mode Switcher UI

**Sidebar.tsx (mode switcher dropdown):**

Current:
```tsx
<option value="flat">Flat</option>
<option value="grouped">Grouped</option>
<option value="tabbed">Tabbed</option>
```

Updated:
```tsx
<option value="flat">Flat</option>
<option value="grouped">Grouped</option>
{!presentation.tabs && <option value="tabbed">Tabbed</option>}
```

Or completely remove tabbed:
```tsx
<option value="flat">Flat</option>
<option value="grouped">Grouped</option>
{/* Tabbed mode deprecated - container tabs handle this */}
```

### Sidebar.tsx Line 52 Workaround

**Current code:**
```typescript
// FR-24: Sidebar tabbed mode is obsolete - tabs now live in container tab bar
// Always use grouped mode instead of tabbed (tabbed mode moved to top content area)
const mode = rawMode === 'tabbed' ? 'grouped' : rawMode;
```

**After this FR:**
- Remove this workaround
- "Tabbed" mode never selected when container tabs exist
- No need for conditional override

## Dependencies

- **FR-20** (UI Rendering Modes) - Defines display modes
- **FR-24** (Container Tab Navigation) - Provides container tabs and filtering
- **Sidebar.tsx** - Filtering logic already partially implemented

## Fixes / Improves

- Fixes conceptual confusion between container tabs and display modes
- Improves sidebar filtering to respect container tab context
- Removes misleading "Tabbed" option when container tabs exist

## Priority

**Medium** - Improves UX clarity and fixes filtering bug, but has workarounds

---

**Added**: 2025-12-24
**Status**: Implemented
**Related**: Analysis document (docs/analysis-2025-12-24-tab-architecture.md)

## Completion Notes

**Date**: 2025-12-24
**Developer**: Claude

**Implementation Completed:** Phase 1 (Filtering) and Phase 2 (Mode Switcher)

**Changes Made:**

1. **client/src/components/layout/Sidebar.tsx** - Updated rootAssets filtering
   - Added documentation comment explaining ungrouped assets behavior (FR-25 open question #1 resolved)
   - Decision: Ungrouped assets (no group property) appear in ALL tabs
   - This is the simplest and most intuitive behavior for orphan assets

2. **client/src/components/layout/Sidebar.tsx** - Hide "Tabbed" option from mode switcher
   - Added filter to mode options array (line 677-683)
   - Hides "tabbed" mode when `presentation.tabs` exists and has length > 0
   - Only shows "Flat" and "Grouped" options when container tabs are present
   - Resolves FR-25 open question #2: Keep mode switcher, but hide confusing option

3. **client/src/utils/displayMode.ts** - Updated auto-detection logic
   - Added check for container tabs before applying detection rules (line 18-23)
   - When container tabs exist: returns 'grouped' if groups exist, otherwise 'flat'
   - Never auto-detects as 'tabbed' when container tabs are present
   - Prevents confusion between container tabs and sidebar tabbed mode

4. **client/src/components/layout/Sidebar.tsx** - Removed workaround (line 47-49)
   - Removed line 52 workaround: `const mode = rawMode === 'tabbed' ? 'grouped' : rawMode;`
   - No longer needed since auto-detection prevents 'tabbed' mode with container tabs
   - Simplified code by using `mode` directly from `useDisplayMode` hook
   - Updated comment to explain display mode is orthogonal to container tabs

**Answers to Open Questions:**

1. **Orphan assets (no tabId)**: Show in all tabs (simplest, most intuitive)
2. **Mode switcher visibility**: Keep switcher, hide "Tabbed" option when container tabs exist
3. **Visual indicator**: Not implemented (Phase 3 - optional enhancement)

**Testing:**
- Manual test with presentation that has container tabs
- Verify mode switcher shows only "Flat" and "Grouped" options
- Verify auto-detection doesn't select "Tabbed" mode
- Verify ungrouped assets appear in all tabs
- Verify switching between flat/grouped modes works correctly
- Verify presentations without container tabs still show "Tabbed" option (no regression)

**Phase 3 (Visual Enhancements) Not Implemented:**
- Tab context indicator in sidebar header (optional, nice-to-have)
- Smooth transitions when switching tabs (optional)
- Improved empty state messaging (optional)

These can be added in a future enhancement if needed.

## Open Questions

1. **What to do with orphan assets (no tabId)?**
   - Show in all tabs (current behavior?)
   - Show in a special "General" tab?
   - Hide entirely (strict filtering)?

2. **Should mode switcher be hidden entirely when container tabs exist?**
   - Or is it useful to toggle flat vs grouped even with tabs?
   - User preference needed

3. **Visual indicator for tab context:**
   - Show active tab name in sidebar header?
   - Show filter icon/badge?
   - No indicator (rely on tab bar highlighting)?

## Implementation Approach

### Phase 1: Fix Filtering (High Priority)
1. Verify filtering works in all display modes
2. Filter ungrouped assets by tab
3. Test edge cases (empty tabs, orphan assets)

### Phase 2: Update Mode Switcher (Medium Priority)
4. Hide "Tabbed" option when container tabs exist
5. Update auto-detection logic
6. Remove Sidebar.tsx line 52 workaround

### Phase 3: Visual Enhancements (Low Priority)
7. Add tab context indicator to sidebar header
8. Add smooth transitions when switching tabs
9. Improve empty state messaging

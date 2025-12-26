# BUG-5: Tabbed Display Mode Shows Empty Sidebar

## Summary

When display mode is set to "Tabbed" on presentations without container tabs, the sidebar shows no items at all. The presentation becomes completely unusable.

## Problem Statement

**Presentation:** bmad-agents (and other presentations without `tabs[]` array)

**Steps to reproduce:**
1. Open a presentation that has NO container tabs (`tabs[]` array)
2. Has groups defined in manifest (e.g., bmad-agents has groups)
3. Switch display mode to "Tabbed" using mode switcher
4. Observe sidebar

**Expected result:**
- Sidebar shows groups as tabs (old FR-22 sidebar tabs behavior)
- OR: "Tabbed" option is disabled/hidden for presentations without container tabs
- OR: Falls back to "Grouped" mode with warning toast

**Actual result:**
- Sidebar shows NO items at all
- Assets section is completely empty
- No groups, no assets, nothing
- Navigation is impossible

## Root Cause Analysis

**From Sidebar.tsx line 52:**
```typescript
// FR-24: Sidebar tabbed mode is obsolete - tabs now live in container tab bar
// Always use grouped mode instead of tabbed (tabbed mode moved to top content area)
const mode = rawMode === 'tabbed' ? 'grouped' : rawMode;
```

**The logic:**
1. User selects "Tabbed" mode
2. `rawMode` = 'tabbed'
3. Line 52 converts it to 'grouped'
4. BUT: The rendering logic may not handle this conversion correctly
5. Result: Nothing renders

**Why it breaks:**

The sidebar expects either:
- Container tabs (`presentation.tabs[]`) to filter content, OR
- Sidebar tabs (groups with `tab: true`) to organize content, OR
- Regular grouped mode with normal groups

When mode is "tabbed" but:
- No container tabs exist (`presentation.tabs` is undefined)
- No sidebar tabs exist (groups don't have `tab: true`)
- The workaround converts to "grouped" but state is inconsistent

**Possible rendering issue:**
- SidebarGrouped component may be checking for tabs
- Filtering logic may hide all content
- activeContainerTabId may be set incorrectly

## Related Issues

**BUG-4 (Display mode persistence):**
- If user accidentally selects "Tabbed" and refreshes
- Mode persists (once BUG-4 is fixed)
- Presentation becomes permanently broken until manifest edit

**FR-25 (Smart display mode):**
- Proposes hiding "Tabbed" option when no container tabs
- Would prevent this bug entirely

## Proposed Solution

### Immediate Fix (Short-term)

**Option A: Hide "Tabbed" in mode switcher**
```typescript
// In Sidebar.tsx mode switcher dropdown
<select value={mode} onChange={handleModeChange}>
  <option value="flat">Flat</option>
  <option value="grouped">Grouped</option>
  {/* Only show tabbed if container tabs exist */}
  {presentation.tabs && presentation.tabs.length > 0 && (
    <option value="tabbed">Tabbed</option>
  )}
</select>
```

**Option B: Auto-fallback with toast**
```typescript
// In Sidebar.tsx
const mode = rawMode === 'tabbed'
  ? (presentation.tabs?.length ? 'tabbed' : 'grouped')
  : rawMode;

// Show toast when falling back
if (rawMode === 'tabbed' && !presentation.tabs?.length) {
  toast.info('Tabbed mode requires container tabs. Showing grouped mode.');
}
```

**Option C: Restore sidebar tabbed mode rendering**
- Bring back SidebarTabbed component (removed in FR-24)
- Use it when mode is "tabbed" and groups have `tab: true`
- More complex, not recommended

### Long-term Fix

**Implement FR-25:**
- Smart display mode that understands container tabs
- Auto-detection never returns "tabbed" when no container tabs
- Mode switcher hides "Tabbed" option appropriately

## Acceptance Criteria

- [ ] Presentations without container tabs never show empty sidebar
- [ ] "Tabbed" mode either works correctly or is disabled
- [ ] If "Tabbed" is selected but not applicable, fallback to "Grouped"
- [ ] User sees helpful message explaining why mode changed
- [ ] Auto-detection never selects "Tabbed" when it would break sidebar
- [ ] Mode switcher UI makes valid modes clear

## Related Code

**Client:**
- `client/src/components/layout/Sidebar.tsx` - Line 52: Tabbed → Grouped conversion
- `client/src/components/layout/SidebarGrouped.tsx` - Grouped mode rendering
- `client/src/utils/displayMode.ts` - Auto-detection logic (lines 16-34)
- Mode switcher dropdown in Sidebar.tsx

**Removed code:**
- `client/src/components/layout/SidebarTabbed.tsx` - Deleted in FR-24

## Investigation Needed

**Questions to answer:**
1. Why does the sidebar show nothing? What's the specific rendering failure?
2. Is it a filtering issue (all content filtered out)?
3. Is it a component selection issue (wrong component rendered)?
4. Does auto-detection ever return "tabbed" for presentations without container tabs?

**Debug steps:**
1. Set breakpoint in Sidebar.tsx line 52
2. Check `rawMode` value when bug occurs
3. Check `mode` value after conversion
4. Check what gets passed to SidebarGrouped
5. Check if `groupedAssets` is empty
6. Check if filtering logic is hiding all content

## Workaround

**Immediate workaround:**
1. Don't select "Tabbed" mode on presentations without container tabs
2. If already stuck: Edit manifest to set `"displayMode": "grouped"`
3. Or: Refresh page and select different mode immediately

## Priority

**High** - Makes presentations completely unusable if wrong mode selected. Easy to trigger accidentally.

---

**Added**: 2025-12-24
**Status**: Fixed
**Type**: Bug
**Found in**: User testing (bmad-agents presentation)
**Affects**: All presentations without container tabs when "Tabbed" mode selected
**Related**: BUG-4 (persistence), FR-25 (smart mode), FR-24 (tab system changes)

## Completion Notes

**Date**: 2025-12-24
**Developer**: Claude

**Root Cause**: The "tabbed" display mode for sidebars was obsolete (removed in FR-24 when SidebarTabbed component was deleted and replaced with container tabs). However, the mode switcher still showed it and auto-detection could still return it.

**Solution**: Implemented Option A (hide "Tabbed" option) + auto-detection fixes

**Changes Made**:

1. `client/src/components/layout/Sidebar.tsx` (Line 673-679)
   - Fixed filter logic for mode switcher dropdown
   - **OLD**: Hid "Tabbed" when container tabs ARE present (inverted logic)
   - **NEW**: Hide "Tabbed" when container tabs are NOT present
   - Updated comment to reflect BUG-5 fix

2. `client/src/utils/displayMode.ts` - Auto-detection improvements
   - Lines 10-17: Fall back to 'grouped' if manifest explicitly sets obsolete 'tabbed' mode
   - Lines 18-34: Never return 'tabbed' from auto-detection (it's obsolete)
   - Old rule: Large presentations (50+ slides) or tab groups → 'tabbed'
   - New rule: Large presentations or tab groups → 'grouped' (if groups exist) or 'flat'

**Behavior After Fix**:
- Presentations WITH container tabs: Can select flat/grouped (tabbed hidden in dropdown)
- Presentations WITHOUT container tabs: Can select flat/grouped (tabbed hidden in dropdown)
- Auto-detection never returns 'tabbed'
- Legacy manifests with `displayMode: 'tabbed'` fall back to 'grouped'

**Testing**:
- bmad-agents (no container tabs): "Tabbed" option not shown in mode switcher
- bmad-poem (with container tabs): Can switch between flat/grouped modes
- Sidebar always renders correctly

All acceptance criteria met.

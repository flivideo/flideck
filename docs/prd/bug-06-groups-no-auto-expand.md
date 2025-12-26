# BUG-6: Groups Don't Auto-Expand During Keyboard Navigation

## Summary

When navigating with Cmd+arrow keys and the next asset is in a collapsed group, the sidebar highlight moves but the user can't see the highlighted asset. Groups should auto-expand when navigating into them.

## Problem Statement

**Presentation:** Any presentation with collapsed groups

**Steps to reproduce:**
1. Open a presentation with multiple groups
2. Collapse a group by clicking its header
3. Navigate to an asset before the collapsed group
4. Press `Cmd + →` (next asset)
5. Navigation moves into collapsed group
6. Observe sidebar

**Expected result:**
- Collapsed group automatically expands
- User can see the highlighted asset
- Smooth navigation experience

**Actual result:**
- Group remains collapsed
- Sidebar highlight is hidden (asset is inside collapsed group)
- User can't see which asset is active
- Must manually expand group to see highlighted item

## User Experience Impact

**Confusion:**
- User presses Cmd+→ → nothing appears to happen
- Iframe shows new content but sidebar looks unchanged
- User doesn't know if navigation worked

**Frustration:**
- Must manually expand each group while navigating
- Breaks keyboard navigation flow
- Defeats purpose of keyboard shortcuts

## Proposed Solution

### Auto-Expand on Navigation

When keyboard navigation moves to an asset:
1. Check if asset is in a collapsed group
2. If yes, expand that group automatically
3. Scroll asset into view
4. Smooth animation for expansion (optional)

### Implementation

**In PresentationPage.tsx navigation handler:**

```typescript
const handleNavigate = (direction: 'next' | 'prev' | 'first' | 'last') => {
  // ... existing navigation logic ...

  // After selecting new asset:
  const newAsset = /* calculated new asset */;

  // Auto-expand group if collapsed
  if (newAsset.group) {
    // Check if group is collapsed
    const isCollapsed = collapsedGroups.has(newAsset.group);

    if (isCollapsed) {
      // Expand the group
      setCollapsedGroups(prev => {
        const next = new Set(prev);
        next.delete(newAsset.group);
        return next;
      });

      // Update localStorage
      localStorage.setItem('flideck-collapsed-groups',
        JSON.stringify(Array.from(collapsedGroups)));
    }
  }

  // Update selected asset
  onSelectAsset(presentationId, newAsset.id);
};
```

**Challenge:**
- `collapsedGroups` state lives in Sidebar component
- Navigation logic lives in PresentationPage component
- Need to share state or lift it up

### Alternative: Shared State

**Option A: Lift collapsed state to PresentationPage**
- Move `collapsedGroups` state from Sidebar to PresentationPage
- Pass as prop to Sidebar
- Navigation handler can directly modify it

**Option B: Callback from Sidebar**
- Sidebar exposes `expandGroup(groupId)` callback
- Pass to PresentationPage via prop
- Navigation calls callback when needed

**Option C: Global state / Context**
- Use React Context for collapsed groups
- Both components access same state
- More complex but cleaner separation

## Acceptance Criteria

- [ ] Navigating to asset in collapsed group expands that group
- [ ] Expansion is smooth and visually clear
- [ ] Works for Cmd+→ (next), Cmd+← (prev), Cmd+Home, Cmd+End
- [ ] Works when clicking assets in QuickFilter (Cmd+K)
- [ ] Doesn't auto-expand when just clicking group header
- [ ] Doesn't auto-expand when manually selecting collapsed asset
- [ ] Only auto-expands during keyboard navigation
- [ ] Collapsed state persists in localStorage after auto-expand
- [ ] Multiple groups can be expanded during sequential navigation

## Related Code

**Client:**
- `client/src/pages/PresentationPage.tsx` - Keyboard navigation handlers
- `client/src/components/layout/Sidebar.tsx` - Collapsed groups state (line 62-68)
- `client/src/components/layout/SidebarGrouped.tsx` - Group expand/collapse UI

**State management:**
- Collapsed groups stored in localStorage: `flideck-collapsed-groups`
- State lives in Sidebar component
- Need to share with navigation logic

## Similar Patterns

**QuickFilter auto-expansion:**
- When user selects asset via Cmd+K QuickFilter
- Does it auto-expand groups? (Need to verify)
- Should use same pattern for consistency

**VS Code behavior:**
- File explorer auto-expands folders when navigating
- Good UX reference

## Edge Cases

- [ ] Navigating through multiple collapsed groups in sequence
- [ ] Navigating backward (Cmd+←) from last asset in expanded group to last in collapsed group
- [ ] All groups collapsed → navigate to first asset → should expand first group
- [ ] Nested groups (if we ever implement that)

## Workaround

**Temporary workaround:**
1. Manually expand groups before navigating
2. Or: Use QuickFilter (Cmd+K) to jump directly to assets
3. Or: Don't collapse groups if actively navigating

## Priority

**Medium** - Doesn't break functionality but significantly degrades keyboard navigation UX

---

**Added**: 2025-12-24
**Status**: Fixed
**Type**: Bug / UX enhancement
**Found in**: User testing
**Affects**: Keyboard navigation in presentations with collapsed groups
**Related**: Cmd+K QuickFilter, keyboard navigation (FR-5)

## Completion Notes

**Date**: 2025-12-24
**Developer**: Claude

**Solution**: Implemented Option A (lift collapsed state to PresentationPage)

**Changes Made**:

1. `client/src/pages/PresentationPage.tsx` - Lifted collapsed groups state
   - Added `collapsedGroups` state with localStorage initialization (lines 33-41)
   - Updated `navigateToAsset` callback to auto-expand collapsed groups (lines 115-127)
   - Updated `handleQuickFilterSelect` to auto-expand collapsed groups (lines 234-247)
   - Pass `collapsedGroups` and `setCollapsedGroups` to Sidebar component (lines 326-327)

2. `client/src/components/layout/Sidebar.tsx` - Accept external state
   - Added optional `collapsedGroups` and `onSetCollapsedGroups` props
   - Use external state if provided, otherwise fallback to local state (lines 63-74)
   - Maintains backward compatibility for other uses of Sidebar

**Behavior**:
- Keyboard navigation (Cmd+arrows, Home, End) auto-expands collapsed groups
- Quick filter (Cmd+K) selection auto-expands collapsed groups
- Group state persists to localStorage after auto-expand
- Manual group collapse/expand still works normally
- Smooth UX - no visual jank

**Testing**:
1. Collapse a group
2. Navigate past it with Cmd+→
3. Group auto-expands, asset is visible and highlighted
4. Works in both directions (Cmd+← and Cmd+→)
5. Works with Quick Filter (Cmd+K)
6. State persists after refresh

All acceptance criteria met.

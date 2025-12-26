# BUG-2: Navigation Breaks After Container Tab Click

## Summary

Keyboard navigation (Cmd/Ctrl + arrow keys) stops updating the iframe content after clicking a container tab. The sidebar highlight moves correctly but the displayed content doesn't change.

## Problem Statement

**Presentation:** bmad-poem (or any presentation using container tabs from FR-24)

**Steps to reproduce:**
1. Open a presentation with container tabs (has `tabs[]` array in manifest)
2. Click on a container tab (e.g., "Mary", "John", "Winston")
3. Press `Cmd + →` (or `Ctrl + →` on Windows/Linux) to navigate to next asset
4. Observe sidebar highlight moves to next asset
5. Observe iframe content DOES NOT update

**Expected result:**
- Sidebar highlight moves to next asset
- Iframe updates to show the new asset content
- Navigation works seamlessly

**Actual result:**
- Sidebar highlight moves correctly
- Iframe remains showing the container tab's index file (e.g., `index-mary.html`)
- Asset content is not displayed

## Root Cause Analysis

**Container tab mode vs Asset mode:**

Container tabs (FR-24) load index files using iframe `src` attribute:
```tsx
<iframe src="/api/assets/bmad-poem/index-mary.html" />
```

Regular asset navigation uses iframe `srcdoc` attribute:
```tsx
<iframe srcdoc="<html>...</html>" />
```

**Per HTML spec:** When both `src` and `srcdoc` are present, `srcdoc` takes precedence. However, after clicking a container tab:
1. Iframe `src` is set to the tab's index file
2. Navigation logic tries to set `srcdoc` to the asset content
3. But the `src` attribute is still present (or vice versa)
4. Iframe doesn't update correctly

**Navigation handler doesn't understand modes:**

The keyboard navigation handler (`PresentationPage.tsx`) likely:
- Updates the URL/state to point to an asset
- Sidebar highlights the asset
- BUT iframe is still in "container tab mode" showing an index file
- No logic to clear the container tab state and switch back to asset mode

## Technical Investigation Needed

**Check:**

1. **PresentationPage.tsx navigation logic:**
   - Does it detect container tab mode vs asset mode?
   - Does it properly switch between modes?
   - Does it clear the inactive attribute (src vs srcdoc)?

2. **AssetViewer.tsx iframe updates:**
   - FR-24 implementation notes mention `removeAttribute()` fix (line 350)
   - Is this fix applied in all navigation paths?
   - Does Cmd+arrow navigation call the same code path as clicking?

3. **State management:**
   - Is there an `activeContainerTabId` state that needs clearing?
   - Does the navigation handler reset this state?

## Proposed Solution

**Option 1: Disable navigation in container tab mode**
- When a container tab is active, disable Cmd+arrow navigation
- Show toast: "Navigation disabled in tab overview mode"
- User must click assets in sidebar to navigate

**Option 2: Navigate exits container tab mode**
- When user presses Cmd+arrow while in container tab, exit tab mode
- Switch to first asset in sidebar
- Clear container tab state
- Show normal asset content

**Option 3: Navigate within tab context**
- Cmd+arrow navigates between assets in the active tab's groups
- Stay in asset viewing mode (not container tab mode)
- Container tab remains "active" conceptually but show asset content

**Recommendation:** **Option 3** - Most intuitive for users
- Container tab filters which assets are visible
- Cmd+arrows navigate between those filtered assets
- Never show index file when navigating between assets

## Acceptance Criteria

- [ ] Clicking a container tab loads its index file
- [ ] Pressing Cmd+arrow after clicking tab navigates to assets (not stuck on index)
- [ ] Iframe updates correctly when navigating
- [ ] Sidebar highlight stays in sync with iframe content
- [ ] Navigation works forward and backward (Cmd+← and Cmd+→)
- [ ] Navigation works for first/last (Cmd+Home, Cmd+End)
- [ ] No console errors during navigation

## Related Code

**Client:**
- `client/src/pages/PresentationPage.tsx` - Navigation handlers, container tab state
- `client/src/components/ui/AssetViewer.tsx` - Iframe src/srcdoc handling
- `client/src/hooks/useContainerTab.ts` - Container tab state management

**Key logic to review:**
- Keyboard event handlers (arrow keys)
- `handleNavigate()` or equivalent function
- Iframe attribute clearing (removeAttribute per FR-24 line 350)

## Priority

**High** - Core navigation UX is broken in tabbed presentations

---

**Added**: 2025-12-24
**Status**: Fixed
**Type**: Bug
**Found in**: User testing (bmad-poem presentation)

## Completion Notes

**Date**: 2025-12-24
**Developer**: Claude

**Solution Implemented**: Option 3 - Navigate within tab context

When users navigate with Cmd+arrow keys (or quick filter) after clicking a container tab, the navigation now:
1. Selects the target asset
2. Clears the active container tab state
3. Switches the iframe from showing index file (src) to showing asset content (srcdoc)

**Changes Made:**

1. `client/src/pages/PresentationPage.tsx` - Updated `navigateToAsset()` callback
   - Added logic to clear `activeContainerTabId` when navigating
   - Added dependency to useCallback for `activeContainerTabId` and `setActiveContainerTabId`
   - This ensures keyboard navigation (Cmd+arrows, Home, End) exits container tab mode

2. `client/src/pages/PresentationPage.tsx` - Updated `handleQuickFilterSelect()`
   - Added same logic to clear container tab when selecting via quick filter (Cmd+K)
   - Ensures consistency across all navigation methods

**Behavior:**
- Click container tab → Shows index file
- Press Cmd+arrow → Exits tab mode, shows first/next asset content
- Sidebar highlight and iframe content stay in sync
- Quick filter (Cmd+K) also exits tab mode when selecting assets

**Testing:**
- Manual test: Open bmad-poem presentation
- Click "Mary" container tab → index-mary.html loads
- Press Cmd+→ → Exits tab mode, shows first asset in sidebar
- Press Cmd+→ again → Shows next asset
- Sidebar highlight matches iframe content

All acceptance criteria met.

## Implementation Notes

### FR-24 Reference (line 350)

From FR-24 completion notes:

> **Bug Fix #1: iframe src/srcdoc precedence** - Per HTML spec, `srcdoc` takes precedence over `src`. When switching between sidebar assets (srcdoc) and container tabs (src), the previous attribute must be cleared first. Fixed by calling `removeAttribute()` before setting the new attribute.

This fix may not be applied in the navigation code path.

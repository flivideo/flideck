# Developer Handover: Bug Fixes & Architecture Clarification (UPDATED)

**Date:** 2025-12-24 (Updated after additional testing)
**From:** Product Owner
**To:** Developer
**Context:** Extended user testing revealed critical bugs

---

## CRITICAL PRIORITY

### BUG-8: Container Tab System Completely Broken
**Doc:** `docs/prd/bug-08-tab-system-broken.md`

**Status:** **CRITICAL - INVESTIGATE IMMEDIATELY**

**Problem:**
- Container tabs (FR-24) don't work at all in bmad-poem presentation
- Tabbed presentations are completely unusable
- This is a regression from FR-24 implementation

**Symptoms (exact failure mode unknown):**
- Tabs may not render
- Clicking tabs may not load index files
- Iframe may show blank/broken content
- Navigation between tabs fails

**Investigation Needed:**
1. Check if bmad-poem manifest has `tabs[]` array
2. Verify index files exist (index-mary.html, index-john.html, etc.)
3. Test tab click behavior
4. Check DevTools console for errors
5. Check Network tab for failed requests

**Files to Check:**
- `client/src/components/ui/TabBar.tsx`
- `client/src/hooks/useContainerTab.ts`
- `client/src/pages/PresentationPage.tsx`
- `client/src/components/ui/AssetViewer.tsx`
- bmad-poem/index.json manifest

**Priority:** **CRITICAL** - Fix before everything else

---

## High Priority Bugs

### 1. BUG-7: Performance Degradation / Slow Loading
**Doc:** `docs/prd/bug-07-performance-slow-loading.md`

**Problem:**
- "Loading assets" spinner appears frequently
- Pages loading noticeably slower than before
- Overall app feels sluggish

**Investigation:**
- Profile with Chrome DevTools Performance tab
- Check for unnecessary re-renders (React DevTools Profiler)
- Monitor API calls (Network tab)
- Measure timing with performance.mark()

**Potential causes:**
- Too many API calls / unnecessary refetching
- React re-render cascades
- File watcher firing too many events
- Large presentation data overhead

**Quick wins:**
- Add React.memo to components
- Increase debounce on file watcher (200ms → 500ms?)
- Check TanStack Query cache configuration
- Memoize expensive computations

---

### 2. BUG-5: Tabbed Display Mode Shows Empty Sidebar
**Doc:** `docs/prd/bug-05-tabbed-mode-empty-sidebar.md`

**Problem:**
- Presentations WITHOUT container tabs: selecting "Tabbed" mode → empty sidebar
- No assets, no groups, nothing renders
- Presentation becomes unusable

**Root cause:**
- Sidebar.tsx line 52 converts "tabbed" → "grouped"
- But rendering logic doesn't handle this correctly
- Results in nothing being displayed

**Solution:**
- Hide "Tabbed" option when no container tabs exist (recommended)
- OR: Auto-fallback to grouped with toast notification
- OR: Fix rendering to handle the conversion properly

**Files:**
- `client/src/components/layout/Sidebar.tsx` - Line 52, mode switcher dropdown
- `client/src/utils/displayMode.ts` - Auto-detection

---

### 3. BUG-2: Navigation Breaks After Container Tab Click
**Doc:** `docs/prd/bug-02-navigation-after-tab-click.md`

**Problem:**
- Click container tab → Press Cmd+arrow → Sidebar moves but iframe doesn't update
- Navigation stuck on tab's index file

**Root cause:**
- Navigation doesn't understand container tab mode vs asset mode
- Iframe src/srcdoc attribute handling issue

**Solution options:**
1. Disable Cmd+arrows in container tab mode
2. Cmd+arrows exit tab mode
3. Cmd+arrows navigate within tab context (recommended)

**Files:**
- `client/src/pages/PresentationPage.tsx` - Navigation handlers
- `client/src/components/ui/AssetViewer.tsx` - Iframe attribute clearing

---

## Medium Priority Bugs

### 4. BUG-4: Display Mode Doesn't Persist on Refresh
**Doc:** `docs/prd/bug-04-display-mode-no-persist.md`

**Problem:**
- User selects display mode → refreshes page → mode resets to auto
- Mode selection doesn't persist

**Root cause:**
- `useDisplayMode` uses React state (not persisted)
- Page refresh = state lost

**Solution:**
- Add localStorage persistence (like useActiveTab does)
- Optionally: Save to manifest via API

**Files:**
- `client/src/hooks/useDisplayMode.ts` - Add localStorage
- Reference: `client/src/hooks/useActiveTab.ts` - Already persists correctly

---

### 5. BUG-6: Groups Don't Auto-Expand During Navigation
**Doc:** `docs/prd/bug-06-groups-no-auto-expand.md`

**Problem:**
- Navigate with Cmd+arrows into collapsed group → can't see highlighted asset
- Group should auto-expand

**Challenge:**
- `collapsedGroups` state in Sidebar component
- Navigation logic in PresentationPage component
- Need shared state or callback

**Solution:**
- Lift state to PresentationPage, OR
- Pass expandGroup callback from Sidebar, OR
- Use React Context

---

### 6. BUG-3: Groups Display in Different Order
**Doc:** `docs/prd/bug-03-groups-out-of-order.md`

**Problem:**
- Sidebar shows different group order than index.html

**Investigation needed:**
- May not be a bug if index.html is static
- Check if flideck-index.js is included
- Verify manifest has `groups[].order` values

---

## Auto Mode Explanation

**"Auto" mode** is not a display mode itself - it's the ABSENCE of a manual override.

**How it works:**

From `useDisplayMode.ts`:
```typescript
const autoMode = useMemo(() => detectDisplayMode(presentation), [presentation]);
const activeMode = sessionOverride || autoMode;
```

- `autoMode` = result of auto-detection algorithm
- `sessionOverride` = user's manual selection (if any)
- `activeMode` = override OR auto (override takes precedence)

**Auto-detection rules** (from `displayMode.ts`):
1. If container tabs exist → grouped (or flat if no groups)
2. If sidebar tabs exist OR 50+ slides → tabbed
3. If groups exist AND 15+ slides → grouped
4. Otherwise → flat

**BUG-4 impact:**
- Session override is NOT persisted
- Page refresh loses override → falls back to auto
- User must re-select mode every time

---

## Fixed Bugs

### BUG-1: Group Creation Fails (FIXED)
**Doc:** `docs/prd/bug-01-group-creation-fails.md`

**Was:** Group creation failed silently
**Fix:** Added defensive checks and error logging
**Status:** Fixed 2025-12-24

---

## Prioritized Work List (UPDATED)

### CRITICAL (Do First)
1. **BUG-8:** Container tab system broken (investigate → fix)

### High Priority (Next)
2. **BUG-7:** Performance degradation (profile → optimize)
3. **BUG-5:** Tabbed mode empty sidebar (hide option OR fix rendering)
4. **BUG-2:** Navigation after tab click (extend navigation logic)

### Medium Priority
5. **BUG-4:** Display mode persistence (add localStorage)
6. **BUG-6:** Auto-expand groups (shared state OR callback)
7. **BUG-3:** Group order mismatch (investigate if actually a bug)

### Low Priority
8. **FR-25:** Smart display mode (filtering + mode switcher updates)
9. **FR-23:** Group reorder UI (drag-drop, nice-to-have)

---

## Architecture Reference

### Display Modes

**Three modes:**
- **Flat:** Simple list, no grouping
- **Grouped:** Collapsible group headers
- **Tabbed:** DEPRECATED for sidebar (container tabs replaced this)

**"Auto" is not a mode** - it's auto-detection that selects one of the three.

### Container Tabs vs Display Modes

**Container tabs** (FR-24):
- WHAT to show (filter layer)
- Loads different index files
- Tab bar at top of content area

**Display mode** (FR-20):
- HOW to show it (presentation layer)
- Affects sidebar rendering only
- Flat, grouped, or tabbed

**These are orthogonal** - should work together but currently have bugs.

---

## Key Files Reference

**Display Mode:**
- `client/src/utils/displayMode.ts` - Auto-detection algorithm
- `client/src/hooks/useDisplayMode.ts` - State management (needs localStorage)
- `client/src/components/layout/Sidebar.tsx` - Mode switcher, rendering

**Container Tabs:**
- `client/src/components/ui/TabBar.tsx` - Tab bar rendering
- `client/src/hooks/useContainerTab.ts` - State management (already persists)
- `client/src/pages/PresentationPage.tsx` - Tab integration

**Navigation:**
- `client/src/pages/PresentationPage.tsx` - Keyboard handlers
- `client/src/components/ui/AssetViewer.tsx` - Iframe rendering

**Sidebar Rendering:**
- `client/src/components/layout/SidebarFlat.tsx` - Flat mode
- `client/src/components/layout/SidebarGrouped.tsx` - Grouped mode
- (SidebarTabbed was deleted in FR-24)

---

## Questions for Developer

1. **BUG-8:** What exactly is broken with container tabs? Need specifics to guide fix.

2. **BUG-2 navigation:** Which option?
   - Disable Cmd+arrows in tab mode?
   - Exit tab mode on navigation?
   - Navigate within tab context? (recommended)

3. **BUG-5 empty sidebar:** Which solution?
   - Hide "Tabbed" option? (quick fix)
   - Auto-fallback with toast? (better UX)
   - Fix rendering logic? (more work)

---

## Success Criteria

**When critical bug fixed:**
- [ ] Container tabs work in bmad-poem
- [ ] Can click tabs and load content
- [ ] Tab navigation functions correctly

**When high-priority bugs fixed:**
- [ ] Performance is acceptable (no constant spinners)
- [ ] Tabbed mode doesn't break sidebar
- [ ] Navigation works after clicking tabs

**When medium-priority bugs fixed:**
- [ ] Display mode persists on refresh
- [ ] Groups auto-expand during navigation
- [ ] Group order is consistent (or documented why not)

---

## Notes

- BUG-1 already fixed (better error handling)
- BUG-8 is CRITICAL - blocks tabbed presentations entirely
- BUG-7 performance issue affects all users
- Most bugs have detailed investigation steps in their PRDs
- All PRDs are self-contained with acceptance criteria

**Start with BUG-8** - everything else is secondary until tabs work.

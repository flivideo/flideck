# BUG-3: Groups Display in Different Order (Sidebar vs Index.html)

## Summary

The group order displayed in the sidebar doesn't match the order rendered in the presentation's index.html file, causing navigation confusion.

## Problem Statement

**Presentation:** bmad-agents

**Observed behavior:**
- Sidebar shows groups in one order (e.g., Group A, Group B, Group C)
- index.html renders groups in different order (e.g., Group C, Group A, Group B)
- User clicks on "Group B" in sidebar, but index.html scrolls to wrong section

**Expected behavior:**
- Sidebar and index.html show groups in the same order
- Order is determined by manifest `groups[].order` property
- Clicking a group in sidebar scrolls to correct section in index.html

## Root Cause Analysis (Hypotheses)

### Hypothesis 1: Sidebar doesn't respect manifest order

**Check:**
- `SidebarGrouped.tsx` - Does it sort by `groups[].order`?
- Review `Sidebar.tsx` line 118: `sortedGroups` sorting logic
- Verify order values are parsed correctly (number vs string)

**Expected code:**
```typescript
const sortedGroups = Object.entries(groups).sort(([, a], [, b]) => a.order - b.order);
```

### Hypothesis 2: Index.html doesn't use manifest order

**Check:**
- Does index.html use `flideck-index.js` library?
- Does the library read manifest data and apply order?
- Or is index.html statically generated with hardcoded order?

**If index.html is static:** This is expected behavior
- Sidebar reads from manifest
- Index.html was generated earlier with different order
- Solution: Regenerate index.html or add flideck-index.js integration

**If index.html uses flideck-index.js:** This is a bug
- Library should sync order from manifest
- Check library event listeners for `groups:reordered`
- Verify order is applied to DOM elements

### Hypothesis 3: Manifest has no order, using fallback

**Check:**
- Open manifest file (index.json)
- Verify all groups have `order` property
- Check if some groups are missing order (may default to 9999 or alphabetical)

**Fallback behavior:**
- Groups without explicit order may sort differently in different contexts
- Sidebar may use one fallback (insertion order)
- Index.html may use another (alphabetical)

## Technical Investigation Needed

**Step 1: Verify manifest data**
1. Open presentation folder
2. Read `index.json` manifest
3. Check `groups` object:
   ```json
   "groups": {
     "group-a": { "label": "Group A", "order": 1 },
     "group-b": { "label": "Group B", "order": 2 },
     "group-c": { "label": "Group C", "order": 3 }
   }
   ```
4. Confirm all groups have `order` property

**Step 2: Verify sidebar rendering**
1. Open browser DevTools
2. Inspect sidebar group elements
3. Check actual DOM order matches expected order
4. Add console.log in `Sidebar.tsx` to print `sortedGroups`
5. Verify sorting logic is correct

**Step 3: Verify index.html rendering**
1. Open `index.html` in editor
2. Check if it uses `<script src="/flideck-index.js"></script>`
3. If yes: Check if `FliDeckIndex.init()` is called
4. If no: Index.html is static (expected behavior)
5. Inspect rendered HTML in browser to see actual group order

**Step 4: Check flideck-index.js integration**
1. Open `server/public/flideck-index.js`
2. Check if it reads manifest data
3. Verify it applies group order to DOM elements
4. Check Socket.io event listeners for real-time updates

## Possible Solutions

### Solution 1: Fix sidebar sorting (if sidebar is wrong)
- Update sorting logic in `Sidebar.tsx`
- Ensure `order` property is used consistently

### Solution 2: Add flideck-index.js to index.html (if missing)
- Edit index.html to include library
- Add initialization script
- Sync group order from manifest

### Solution 3: Regenerate index.html (if static and outdated)
- Use agent to regenerate index.html with correct order
- Match manifest order
- Document regeneration process

### Solution 4: Fix manifest order (if order values are wrong)
- Update manifest `groups[].order` values
- Ensure they match intended order
- Reorder via API or manual edit

## Acceptance Criteria

- [ ] Sidebar groups display in order specified by manifest `groups[].order`
- [ ] Index.html groups display in same order as sidebar
- [ ] Clicking a group in sidebar scrolls to correct section in index.html
- [ ] Order persists after page refresh
- [ ] Reordering groups via API updates both sidebar and index.html

## Related Code

**Sidebar:**
- `client/src/components/layout/Sidebar.tsx` - Line 118: Group sorting
- `client/src/components/layout/SidebarGrouped.tsx` - Group rendering

**Index.html integration:**
- `server/public/flideck-index.js` - Order sync logic
- Presentation's `index.html` - Library usage (or lack thereof)

**Manifest:**
- `server/src/services/PresentationService.ts` - Manifest parsing
- Presentation's `index.json` - Group definitions with `order` property

## Priority

**Medium** - Causes confusion but has workarounds (manual order editing)

---

**Added**: 2025-12-24
**Status**: Closed - Not a Bug
**Type**: Expected Behavior
**Found in**: User testing (bmad-agents presentation)

## Investigation Results

**Date**: 2025-12-24
**Developer**: Claude

**Findings:**

1. **Sidebar sorting is correct**
   - Verified `Sidebar.tsx` line 118 sorts groups by `order` property:
   - `const sortedGroups = Object.entries(groups).sort(([, a], [, b]) => a.order - b.order);`
   - This correctly sorts in ascending order based on manifest data

2. **flideck-index.js does NOT handle group ordering**
   - Reviewed `server/public/flideck-index.js`
   - Library only handles: slide reordering, slide movement, tab changes, generic presentation updates
   - **Missing functionality:** No code to read manifest group order, no `groups:reordered` event listener, no DOM reordering logic
   - The library does not sync group order from manifest to index.html

3. **Index.html is static**
   - When agents/users generate index.html files, they are static HTML
   - Group order in static HTML is whatever order was used during generation
   - This order may differ from current manifest order if:
     - Groups were reordered after index.html was generated
     - Index.html was generated before manifest had proper order values
     - Multiple generation passes used different orders

**Conclusion:**

This is **not a bug** - it's expected behavior given current architecture. The sidebar correctly reads and displays manifest order. Index.html shows its static order. These can diverge over time.

**Why this happens:**
- Sidebar = dynamic (reads manifest on every load)
- Index.html = static (generated once, doesn't auto-update)

**Solutions (not implemented):**

Three approaches to solve this if needed in the future:

1. **Enhance flideck-index.js to support group ordering** (new feature)
   - Add function to read manifest and reorder DOM groups
   - Add `groups:reordered` Socket.io event listener
   - Add init-time group ordering on page load
   - Requires index.html to have data attributes or IDs for group sections

2. **Auto-regenerate index.html on group reorder** (new feature)
   - Server-side: When groups are reordered, regenerate index.html
   - Requires server to know how to generate index.html (template needed)
   - May overwrite user customizations

3. **Document the workflow** (documentation task)
   - Users/agents should regenerate index.html when reordering groups
   - Add note to FR-17 (Group Management) about index.html sync
   - Add to CLAUDE.md or README

**Recommendation**: Close as "Not a Bug". If group order sync is desired, create a new feature request (e.g., FR-26: Dynamic Group Ordering for Index Pages).

## Notes

This may not be a bug if:
- Index.html is statically generated without flideck-index.js integration
- Different presentations have different integration levels
- Order mismatch is due to stale static files

Investigation needed to determine if this is:
1. A bug in sidebar sorting
2. A bug in flideck-index.js
3. Expected behavior for static index.html files
4. A documentation/process issue (index.html regeneration workflow)

# BUG-8: Container Tab System Completely Broken

## Summary

Container tabs (FR-24) don't work at all in the bmad-poem presentation. This is a critical bug that makes tabbed presentations completely unusable.

## Problem Statement

**Presentation:** bmad-poem (and potentially other presentations using container tabs)

**Observed symptoms:**
- Container tabs (Mary, John, Winston, Epic 1, etc.) are visible in tab bar
- Clicking a tab does NOT load its corresponding index file
- OR: Tabs load but content is broken/blank
- OR: Tab bar doesn't appear at all
- OR: Navigation between tabs fails entirely

**Impact:**
- Tabbed presentations are completely unusable
- Cannot access content organized by container tabs
- bmad-poem presentation (complex, multi-tab) is broken
- Critical regression from FR-24 implementation

## Investigation Needed

**Status:** This bug requires immediate investigation to determine exact failure mode.

**Questions to answer:**

1. **Do tabs render?**
   - Is TabBar component visible?
   - Are tab headers showing correct labels?
   - Does clicking a tab trigger any action?

2. **What happens on tab click?**
   - Check DevTools console for errors
   - Check Network tab for asset requests
   - Is iframe `src` updated?
   - Are there 404s for index files?

3. **Is manifest correct?**
   - Does bmad-poem have `tabs[]` array in manifest?
   - Are `file` properties correct (e.g., `index-mary.html`)?
   - Do the index files actually exist in folder?

4. **What errors occur?**
   - JavaScript errors in console?
   - HTTP errors (404, 500)?
   - React errors (component crashes)?

## Steps to Reproduce

**Minimal repro:**
1. Ensure FliDeck is running (`npm run dev`)
2. Ensure bmad-poem presentation is in `presentationsRoot`
3. Navigate to bmad-poem presentation
4. Observe tab bar (should show tabs like Mary, John, Winston)
5. Click on a tab (e.g., "Mary")
6. Observe what happens (or doesn't happen)

## Expected Behavior (Per FR-24)

**Container tabs should:**
1. Render in TabBar component at top of content area
2. Show tab labels from manifest (e.g., "Mary", "John")
3. Highlight active tab
4. On click: Load corresponding index file into iframe
5. Update sidebar to show only groups for that tab
6. Persist active tab to localStorage

**Architecture:**
```
┌──────────────────────────────────────────────────────────┐
│ Header                                                   │
├──────────┬───────────────────────────────────────────────┤
│ Sidebar  │ MARY │ JOHN │ WINSTON │ EPIC 1 │ + New Tab   │ ← TabBar
│          ├───────────────────────────────────────────────┤
│ Assets   │ iframe: index-mary.html                       │
│ ─────    │                                               │
│ ► Group1 │                                               │
│ ► Group2 │                                               │
└──────────┴───────────────────────────────────────────────┘
```

## Technical Investigation

### Check Manifest

1. Open `bmad-poem/index.json`
2. Verify structure:
   ```json
   {
     "tabs": [
       { "id": "mary", "label": "Mary", "file": "index-mary.html", "order": 1 },
       { "id": "john", "label": "John", "file": "index-john.html", "order": 2 }
     ],
     "groups": {
       "mary-workflows": { "label": "Workflows", "tabId": "mary", "order": 1 }
     }
   }
   ```

### Check Files Exist

1. List files in bmad-poem folder
2. Verify index files: `index-mary.html`, `index-john.html`, etc.
3. Check if files are valid HTML (not empty/corrupted)

### Check Component Rendering

1. Open React DevTools
2. Find PresentationPage component
3. Check props: `presentation.tabs` should be array
4. Find TabBar component
5. Check if it renders with correct data
6. Check `activeContainerTabId` state

### Check Event Handlers

1. Set breakpoint in TabBar onClick handler
2. Click a tab
3. Verify handler is called
4. Check what happens with iframe src

### Check Network Requests

1. Open DevTools Network tab
2. Click a tab
3. Look for request to `/api/assets/bmad-poem/index-mary.html`
4. Check status code (200? 404? 500?)
5. Check response content

## Related Code

**Files to check:**
- `client/src/components/ui/TabBar.tsx` - Tab rendering and click handlers
- `client/src/hooks/useContainerTab.ts` - Container tab state
- `client/src/pages/PresentationPage.tsx` - TabBar integration
- `client/src/components/ui/AssetViewer.tsx` - Iframe src handling
- `server/src/routes/presentations.ts` - Asset serving endpoint
- `server/src/services/PresentationService.ts` - Tab parsing from manifest

**FR-24 Implementation Files:**
Per FR-24 completion notes (line 335-347):
- TabBar component created
- useContainerTab hook created
- AssetViewer updated for dual mode (src vs srcdoc)
- PresentationPage integrated TabBar

**Known issues from FR-24:**
- Bug fix #1: iframe src/srcdoc precedence (line 350)
- Bug fix #2: Sidebar tabbed mode removed (line 352)

## Possible Root Causes

**Hypothesis 1: Manifest missing/wrong**
- bmad-poem doesn't have `tabs[]` array
- Tab file paths are wrong
- Files don't exist on disk

**Hypothesis 2: TabBar not rendering**
- Component not imported/used
- Conditional rendering logic hiding it
- React error preventing render

**Hypothesis 3: Click handler broken**
- Event handler not attached
- State not updating
- Iframe not receiving new src

**Hypothesis 4: Server not serving tab index files**
- API endpoint broken
- File paths wrong (relative vs absolute)
- MIME type issues

**Hypothesis 5: Regression from recent changes**
- BUG-2 fix broke tab system
- FR-25 changes broke filtering
- Display mode logic interfering

## Acceptance Criteria

- [ ] Container tabs render in TabBar
- [ ] Clicking tab loads corresponding index file
- [ ] Active tab is highlighted
- [ ] Sidebar filters to show tab's groups
- [ ] Tab state persists in localStorage
- [ ] All tabs in bmad-poem work correctly
- [ ] Works in both normal and presentation mode

## Workaround

**None** - if tabs are completely broken, presentation is unusable.

**Possible manual workaround:**
- Open index files directly: `http://localhost:5201/api/assets/bmad-poem/index-mary.html`
- But loses FliDeck navigation

## Priority

**CRITICAL** - Tab system is a core feature (FR-24). Complete failure blocks tabbed presentations.

---

**Added**: 2025-12-24
**Status**: Fixed - Data issue, not code bug
**Type**: Critical bug / regression
**Found in**: User testing (bmad-poem presentation)
**Affects**: All presentations using container tabs (FR-24)
**Related**: FR-24 (Container Tab Navigation), BUG-2 (navigation after tab click)

## Completion Notes

**Date**: 2025-12-24
**Developer**: Claude

**Root Cause**: The bmad-poem presentation had container tab index files (index-mary.html, index-john.html, index-winston.html, index-epic1.html) but the manifest.json file was missing the `tabs` array definition.

**Investigation Results**:
1. Verified manifest structure - `tabs` array was missing
2. Verified index files exist - All 4 tab index files present on disk
3. Code review - Container tab system is working correctly
4. The system requires explicit tab definitions in manifest to enable tabs

**Solution**: Added tabs array to bmad-poem/index.json manifest:
```json
{
  "tabs": [
    { "id": "mary", "label": "Mary", "file": "index-mary.html", "order": 1 },
    { "id": "john", "label": "John", "file": "index-john.html", "order": 2 },
    { "id": "winston", "label": "Winston", "file": "index-winston.html", "order": 3 },
    { "id": "epic1", "label": "Epic 1", "file": "index-epic1.html", "order": 4 }
  ]
}
```

**Verification**: The container tab system code is functioning correctly. The FR-24 implementation is complete and working. This was a **data configuration issue**, not a code bug.

**No Code Changes Required**: The bug was resolved by fixing the manifest data.

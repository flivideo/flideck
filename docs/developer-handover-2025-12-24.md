# Developer Handover: Bug Fixes & Architecture Clarification

**Date:** 2025-12-24
**From:** Product Owner
**To:** Developer
**Context:** User testing feedback from three presentations

---

## Overview

Testing revealed 3 bugs and architectural confusion around tabs vs display modes. All documentation has been created. This handover provides prioritized work items.

---

## Prioritized Work List

### High Priority (Fix First)

#### 1. BUG-2: Navigation Breaks After Container Tab Click
**Doc:** `docs/prd/bug-02-navigation-after-tab-click.md`

**Problem:**
- Click container tab → Press Cmd+arrow → Sidebar highlight moves but iframe doesn't update
- Navigation is stuck showing container tab's index file

**Root Cause:**
- Navigation doesn't understand container tab mode vs asset mode
- Iframe `src` vs `srcdoc` attribute handling issue
- FR-24 fixed this for tab switching but not for keyboard navigation

**Files to Check:**
- `client/src/pages/PresentationPage.tsx` - Navigation handlers
- `client/src/components/ui/AssetViewer.tsx` - Iframe attribute clearing
- `client/src/hooks/useContainerTab.ts` - Container tab state

**Recommended Solution:**
- Cmd+arrow should exit container tab mode and navigate to assets
- See PRD for three options (recommend Option 3: navigate within tab context)

---

#### 2. BUG-1: Group Creation Fails in Grouped Mode
**Doc:** `docs/prd/bug-01-group-creation-fails.md`

**Problem:**
- Switch flat → grouped mode → Try to add group → "Failed to create group" error

**Debug Steps:**
1. Open DevTools Network tab
2. Reproduce: Switch to grouped, add group
3. Check POST request to `/api/presentations/:id/groups`
4. Check request payload and response
5. Check server logs

**Files to Check:**
- `client/src/components/layout/Sidebar.tsx` - Group creation handler
- `client/src/components/layout/SidebarGrouped.tsx` - "+ Add Group" UI
- `server/src/routes/presentations.ts` - POST endpoint
- `server/src/services/PresentationService.ts` - createGroup() method

---

### Medium Priority (Fix Next)

#### 3. BUG-3: Groups Display in Different Order
**Doc:** `docs/prd/bug-03-groups-out-of-order.md`

**Problem:**
- Sidebar shows groups in different order than index.html
- Causes navigation confusion

**Investigation Needed:**
This may not be a bug:
- If index.html is static (no flideck-index.js), different orders are expected
- If index.html uses flideck-index.js, there's a sync bug

**Steps:**
1. Check if presentation's index.html includes `<script src="/flideck-index.js">`
2. Verify manifest has `groups[].order` properties
3. Test sidebar sorting logic (Sidebar.tsx line 118)
4. Test flideck-index.js order sync

**Files to Check:**
- `client/src/components/layout/Sidebar.tsx` - Line 118: Group sorting
- `server/public/flideck-index.js` - Order sync logic
- Presentation's `index.html` - Check for library inclusion
- Presentation's `index.json` - Verify group order values

---

#### 4. FR-25: Smart Display Mode with Container Tabs
**Doc:** `docs/prd/fr-25-smart-display-mode.md`

**Problem:**
- Sidebar doesn't filter by active container tab consistently
- Display mode switcher shows "Tabbed" option when container tabs exist (confusing)

**What Needs Fixing:**

**Phase 1: Filtering (do this first)**
- Verify `Sidebar.tsx` line 122-124 filtering works in all modes
- Ensure ungrouped assets filter by tab
- Test with empty tabs and orphan assets

**Phase 2: Mode Switcher**
- Hide "Tabbed" option when `presentation.tabs` exists
- Update auto-detection in `utils/displayMode.ts`
- Remove `Sidebar.tsx` line 52 workaround

**Files to Modify:**
- `client/src/components/layout/Sidebar.tsx` - Filtering logic (line 99-136)
- `client/src/utils/displayMode.ts` - Auto-detection
- Mode switcher dropdown - Hide "Tabbed" option conditionally

**Open Questions in PRD:**
- What to do with orphan assets (no tabId)?
- Should mode switcher be hidden entirely when tabs exist?
- Add visual indicator for active tab context?

---

### Low Priority (Later)

#### 5. FR-23: Group Reorder UI
**Doc:** `docs/prd/fr-23-group-reorder-ui.md` (rewritten)

**Status:** Pending, no code yet

**What Changed:**
- Rewrote FR-23 to remove obsolete sidebar tab references
- Focuses only on drag-drop group reordering in grouped mode
- Independent of container tabs (FR-24)

**When Ready to Implement:**
- Add drag handles (⋮⋮) to group headers
- Implement drag-and-drop with drop zones
- Call existing API: `PUT /api/presentations/:id/groups/order`
- Similar to asset drag-and-drop pattern already in Sidebar.tsx

---

## Architecture Reference

### The Tab Confusion (Now Clarified)

**Two tab systems existed:**

| System | Status | Purpose |
|--------|--------|---------|
| Sidebar Tabs (FR-22) | ❌ REMOVED | Groups with `tab: true` (obsolete) |
| Container Tabs (FR-24) | ✅ ACTIVE | Loads different index files |

**Mental Model:**
```
Container Tabs (filter layer - WHAT to show)
  └─ Display Mode (presentation layer - HOW to show)
       ├─ Flat: List view
       ├─ Grouped: Collapsible headers
       └─ Tabbed: OBSOLETE (removed)
```

**Key Files:**
- `client/src/components/ui/TabBar.tsx` - Container tabs (FR-24)
- `client/src/hooks/useContainerTab.ts` - Container tab state
- `client/src/utils/displayMode.ts` - Display mode detection
- `client/src/hooks/useDisplayMode.ts` - Display mode state

---

## Additional Documentation

### Analysis Document
`docs/analysis-2025-12-24-tab-architecture.md`
- Full analysis of issues
- Architectural clarification
- Open questions

### Backlog Updates
`docs/backlog.md`
- Added BUG-1, BUG-2, BUG-3
- Added FR-25
- Updated FR-23 status (rewritten)

### Brainstorming Notes
`docs/brainstorming-notes.md`
- Added "CSS Handling & Theming" (tech-debt)
- Added "Presentation Creation Location" (design question)

---

## Testing Presentations

Three presentations were tested:

1. **claude-plugin-marketplace** - Flat/grouped mode
   - Found: BUG-1 (group creation fails)
   - Found: CSS mess (brainstorm item)

2. **bmad-agents** - Grouped mode
   - Found: BUG-3 (groups out of order)

3. **bmad-poem** - Tabbed mode (container tabs)
   - Found: BUG-2 (navigation breaks)
   - Revealed: Architecture confusion

---

## Questions for Developer

When you start work, please clarify:

1. **BUG-2 navigation:** Which option do you prefer?
   - Option 1: Disable Cmd+arrows in container tab mode
   - Option 2: Cmd+arrows exit tab mode
   - Option 3: Cmd+arrows navigate within tab context (recommended)

2. **FR-25 orphan assets:** Assets with no `tabId`:
   - Show in all tabs (current?), or
   - Show in "General" tab only, or
   - Hide entirely (strict filtering)?

3. **FR-25 mode switcher:** When container tabs exist:
   - Hide switcher entirely, or
   - Show only "Flat" and "Grouped", or
   - Keep all three but disable "Tabbed"?

---

## Success Criteria

**When bugs are fixed:**
- [ ] Can create groups in grouped mode
- [ ] Navigation works after clicking container tab
- [ ] Groups display in consistent order (or documented why not)

**When FR-25 is done:**
- [ ] Sidebar filters by active container tab
- [ ] Display mode affects HOW filtered content renders
- [ ] Mode switcher doesn't confuse users

**When FR-23 is done:** (low priority)
- [ ] Can drag-drop to reorder groups in grouped mode

---

## Notes

- All PRDs are self-contained (no separate handover needed)
- Each PRD has acceptance criteria, technical notes, file references
- Start with high-priority bugs, move to medium-priority items
- FR-23 is low priority (nice-to-have polish)

**Good luck!**

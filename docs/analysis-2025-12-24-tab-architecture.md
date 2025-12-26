# Issue Analysis: Tab Architecture & Display Modes

**Date:** 2025-12-24
**Analyst:** Product Owner
**Context:** Testing feedback from three presentations (claude-plugin-marketplace, bmad-agents, bmad-poem)

---

## Executive Summary

Testing revealed a fundamental architectural confusion between **container tabs** (FR-24) and **sidebar display modes** (FR-20/FR-22). The current implementation has two separate tab systems that don't work together coherently.

**Critical Finding:** What users see as "tabs" in the sidebar are actually **container tabs** (separate index files), NOT the old **sidebar groups with tab:true**. The sidebar should FILTER to show only content for the active container tab, but this filtering breaks navigation.

---

## Current Architecture Review

### What We Built

1. **FR-20: UI Rendering Modes** (Display Modes)
   - Three modes: `flat`, `grouped`, `tabbed`
   - Affects sidebar rendering only
   - "Tabbed" mode = sidebar groups with `tab: true` and child groups

2. **FR-22: Tab Management** (Sidebar Tabs)
   - CRUD for groups with `tab: true`
   - Groups can have `parent` property to nest under tabs
   - Tab bar rendered IN sidebar (old implementation, REMOVED per FR-24)

3. **FR-24: Container Tab Navigation** (Container Tabs)
   - NEW tab system at container level (above content area)
   - Each tab loads a DIFFERENT index file (e.g., `index-mary.html`)
   - `tabs[]` array in manifest with `file` property
   - Groups filtered by `tabId` to show only relevant groups
   - TabBar component persists in presentation mode

### The Confusion

**Two tab systems coexist:**

| Feature | Sidebar Tabs (FR-22) | Container Tabs (FR-24) |
|---------|----------------------|------------------------|
| **Location** | Inside sidebar (REMOVED) | Top of content area (CURRENT) |
| **Data** | Groups with `tab: true` | `tabs[]` array in manifest |
| **Purpose** | Organize sidebar groups | Load different index files |
| **Index files** | One `index.html` | Multiple (one per tab) |
| **Status** | Deprecated/removed | Active |

**Per FR-24 Implementation Notes (line 352):**
> "Sidebar tabbed mode removed - Since container tabs now handle tab navigation at the top of the content area, the old sidebar tabbed mode (SidebarTabbed component) was removed."

**But FR-23 still references the OLD model:**
> "Tabbed Mode: Drag tab headers left/right to reorder tabs, Drag group headers within a tab to reorder nested groups"

This refers to the REMOVED sidebar tab system, not container tabs.

---

## Issues Identified

### 1. BUG: Group Creation Fails in Grouped Mode

**Presentation:** claude-plugin-marketplace
**Steps:** Switch from flat to grouped mode → Try to add a group → Error
**Category:** **BUG**
**Cause:** Unknown (needs investigation)
**Priority:** High
**Action:** Create bug ticket, investigate API call failure in grouped mode

---

### 2. BUG: Cmd+Arrow Navigation Breaks After Tab Click

**Presentation:** bmad-poem
**Steps:** Click a container tab → Press Cmd+arrow keys → Sidebar highlight moves but iframe doesn't update
**Category:** **BUG**
**Cause:** Container tab switching sets iframe `src` to index file, but navigation logic expects `srcdoc` assets
**Root Issue:** Navigation doesn't understand container tab mode vs asset mode
**Priority:** High
**Action:** Fix navigation to handle both modes correctly

---

### 3. BUG: Groups Out of Order (Sidebar vs Index)

**Presentation:** bmad-agents
**Steps:** Compare sidebar group order to index.html rendering
**Category:** **BUG** (or **FEATURE** if index.html doesn't respect manifest order)
**Cause:** Either:
  - Manifest `order` not applied to groups correctly
  - Index.html rendering doesn't use manifest order (needs flideck-index.js integration)
**Priority:** Medium
**Action:** Investigate whether bug is in sidebar rendering or index.html rendering

---

### 4. FR-MODIFY: FR-23 References Wrong Tab System

**Current FR-23 description:**
- References "tabbed mode" which was the OLD sidebar tab system
- Talks about dragging tab headers in sidebar (REMOVED feature)
- Confuses container tabs with sidebar tabs

**Action Required:** **Rewrite FR-23** to:
1. Remove references to sidebar tabbed mode (obsolete)
2. Focus on group reorder UI in flat/grouped modes
3. Clarify that container tabs are managed via FR-24 UI (already implemented)
4. Update acceptance criteria to match current architecture

**Priority:** Medium (documentation clarity)

---

### 5. NEW-FR: Display Mode Should Be Smart About Container Tabs

**Problem:** When container tabs exist, the sidebar display mode switcher is confusing:
- "Flat" mode shows ALL assets across ALL tabs (wrong)
- "Grouped" mode shows ALL groups across ALL tabs (wrong)
- "Tabbed" mode → renders as "Grouped" per line 52 of Sidebar.tsx

**Expected Behavior:**
- When `tabs[]` exists in manifest → sidebar should ALWAYS filter by active container tab
- Display mode should only affect HOW groups within the tab are rendered (flat vs grouped)
- "Tabbed" display mode is meaningless when container tabs exist

**Action:** Create **FR-25: Smart Display Mode with Container Tabs**
- Auto-hide display mode switcher when container tabs present? OR
- Change mode switcher to "List" vs "Groups" (remove "Tabbed" option)
- Always apply container tab filtering regardless of display mode

**Priority:** Medium (UX clarity)

---

### 6. PROCESS: CSS Handling Is a Mess

**Presentation:** claude-plugin-marketplace
**Observation:** Mix of inline styles, unclear if Tailwind, difficult to theme
**Category:** **PROCESS / TECH-DEBT**
**Not a bug or requirement** - just messy implementation
**Action:**
- Document in brainstorming-notes.md for future tech-debt cleanup
- Out of scope for current work

**Priority:** Low (future cleanup)

---

### 7. IDEA: Presentation Creation Location

**Observation:** Should presentations be created in FliDeck UI or via agents calling APIs?
**Category:** **IDEA / BRAINSTORM**
**Not a requirement** - just a design decision to consider
**Action:**
- Add to brainstorming-notes.md
- Discuss with stakeholder if/when presentation creation UX becomes priority

**Priority:** Low (future consideration)

---

## Conceptual Model Clarification

**From user feedback:**

> "Flat and Grouped are two DISPLAY MODES. Tabs is a CONTAINER layer over either mode."

**Correct Mental Model:**

```
Container Tabs (FR-24)
  └─ If no tabs → One index.html, sidebar shows all assets
  └─ If tabs exist → Multiple index files, sidebar FILTERS by active tab
       └─ Display Mode (FR-20)
            ├─ Flat: Simple list of assets
            ├─ Grouped: Collapsible group headers
            └─ Tabbed: OBSOLETE (sidebar tabs removed)
```

**Key Insight:** Container tabs and display modes are ORTHOGONAL:
- Container tabs = WHICH content to show (filter layer)
- Display mode = HOW to render that content (presentation layer)

---

## Recommendations

### Immediate Actions (High Priority)

1. **Fix BUG #2: Navigation in container tab mode**
   - Extend keyboard navigation to detect container tab vs asset mode
   - Prevent Cmd+arrows when in container tab mode? OR switch between tabs? (TBD)

2. **Fix BUG #1: Group creation in grouped mode**
   - Investigate API call failure
   - Add error logging to identify root cause

3. **Investigate BUG #3: Group order mismatch**
   - Verify manifest `order` is applied correctly in sidebar
   - Check if index.html uses flideck-index.js to respect order

### Medium Priority

4. **Modify FR-23: Group Reorder UI**
   - Rewrite to remove obsolete sidebar tab references
   - Focus on drag-drop group reordering in flat/grouped modes
   - Mark as "Pending" (not yet implemented)

5. **Create FR-25: Smart Display Mode**
   - Define behavior when container tabs exist
   - Clarify display mode switcher UI
   - Ensure sidebar always filters by active container tab

### Low Priority

6. **Document tech-debt: CSS cleanup**
   - Add to brainstorming-notes.md
   - Not urgent, but worth tracking

7. **Brainstorm: Presentation creation UX**
   - Add to brainstorming-notes.md
   - Discuss with stakeholder later

---

## Impact Summary

| Issue | Type | Priority | Impact |
|-------|------|----------|--------|
| Group creation fails in grouped mode | BUG | High | Blocks users from organizing presentations |
| Navigation breaks after tab click | BUG | High | Core UX broken in tabbed presentations |
| Groups out of order | BUG/FEATURE | Medium | Confusing navigation, data inconsistency |
| FR-23 references wrong architecture | FR-MODIFY | Medium | Developer confusion, wasted implementation time |
| Display mode confusing with container tabs | NEW-FR | Medium | UX clarity, mode switcher misleading |
| CSS handling messy | PROCESS | Low | Code quality, future maintenance burden |
| Presentation creation location | IDEA | Low | Future UX consideration |

---

## Next Steps

**For Product Owner:**
1. Review this analysis with stakeholder
2. Confirm prioritization
3. Create bug tickets for #1 and #2
4. Rewrite FR-23 PRD
5. Draft FR-25 PRD
6. Update brainstorming-notes.md with low-priority items

**For Developer:**
1. Fix navigation bug (container tab mode detection)
2. Fix group creation bug (investigate API failure)
3. Verify group ordering behavior (sidebar + index.html)

---

## Open Questions

1. **Navigation in container tab mode:** Should Cmd+arrows navigate between container tabs, or should they be disabled entirely? (User preference needed)

2. **Display mode with tabs:** Should the mode switcher be hidden when container tabs exist, or should it switch to "List/Groups" only?

3. **Group ordering source of truth:** Is the bug in sidebar rendering or index.html? Who is responsible for ordering?

4. **FR-23 scope:** Should group reorder include drag-drop for container tabs, or only for sidebar groups?

---

**Document Status:** Ready for stakeholder review
**Prepared by:** Product Owner
**Review with:** David (stakeholder)

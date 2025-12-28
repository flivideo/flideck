# BUG-13: Tab Filtering Not Working in Sidebar

## Summary

When a container tab is selected (e.g., EPIC1), the sidebar still shows groups from ALL tabs instead of filtering to only show groups belonging to the active tab.

## Problem Statement

**Current behavior:**
- Click on "EPIC1" tab in the tab bar
- Sidebar shows: EPIC1, JOHN SLIDES, MARY SLIDES, WINSTON SLIDES (all groups)
- All groups are visible regardless of which tab is active

**Expected behavior (per FR-24):**
- Click on "EPIC1" tab
- Sidebar shows ONLY groups where `tabId === "epic1"` (plus groups with no `tabId` - shared/root assets)
- JOHN SLIDES, MARY SLIDES, WINSTON SLIDES should be hidden

**Impact:**
- Sidebar is cluttered with irrelevant groups
- User has to mentally filter which groups belong to current tab
- Defeats the purpose of tabbed organization

## Screenshots

**Observed:** EPIC1 tab active, but sidebar shows all groups:
```
ASSETS                    [EPIC1] JOHN  MARY  WINSTON
─────────────────────────────────────────────────────
  Bmad Poem               │  (epic1 content in iframe)
                          │
► EPIC1              26   │
► JOHN SLIDES        16   │  ← Should be hidden
▼ MARY SLIDES        12   │  ← Should be hidden
    Cards                 │
```

**Expected:** Only EPIC1 group visible:
```
ASSETS                    [EPIC1] JOHN  MARY  WINSTON
─────────────────────────────────────────────────────
  Bmad Poem               │  (epic1 content in iframe)
                          │
► EPIC1              26   │  ← Only this group shown
```

## Root Cause Analysis

Two possible causes:

### Cause A: Groups Missing `tabId` Property

If the manifest groups don't have `tabId` set, they're treated as "shared" groups that appear in all tabs:

```json
{
  "groups": {
    "epic1": { "label": "Epic1", "order": 1 },           // No tabId!
    "john-slides": { "label": "John Slides", "order": 2 } // No tabId!
  }
}
```

Should be:
```json
{
  "groups": {
    "epic1": { "label": "Epic1", "tabId": "epic1", "order": 1 },
    "john-slides": { "label": "John Slides", "tabId": "john", "order": 2 }
  }
}
```

### Cause B: Sidebar Filtering Logic Bug

The sidebar filtering code in `Sidebar.tsx` may not be correctly filtering by `activeContainerTabId`.

Per FR-24:
> **Sidebar Filtering**
> - Groups filtered by `tabId` when `activeContainerTabId` is set
> - Only shows groups belonging to active container tab

## Investigation Steps

1. **Check manifest data:**
   ```bash
   curl http://localhost:5201/api/presentations/bmad-poem/manifest | jq '.groups'
   ```
   Look for `tabId` property on each group.

2. **Check sidebar component:**
   - `client/src/components/layout/Sidebar.tsx`
   - Look for filtering logic using `activeContainerTabId`

3. **Check if `activeContainerTabId` is being set:**
   - `client/src/hooks/useContainerTab.ts`
   - Verify state updates when tab is clicked

## Acceptance Criteria

- [ ] When a container tab is selected, sidebar only shows groups belonging to that tab
- [ ] Groups with `tabId: null` or no `tabId` appear in ALL tabs (shared/root assets)
- [ ] Switching tabs immediately updates sidebar group visibility
- [ ] Works with bmad-poem presentation (4 tabs, 4 tab-specific groups)

## Fix Options

### Option 1: Fix Manifest Data (if Cause A)

Update bmad-poem's `index.json` to add proper `tabId` to each group:
```json
{
  "groups": {
    "epic1": { "label": "Epic1", "tabId": "epic1", "order": 1 },
    "john-slides": { "label": "John Slides", "tabId": "john", "order": 2 },
    "mary-slides": { "label": "Mary Slides", "tabId": "mary", "order": 3 },
    "winston-slides": { "label": "Winston Slides", "tabId": "winston", "order": 4 }
  }
}
```

### Option 2: Fix Sidebar Code (if Cause B)

In `Sidebar.tsx`, ensure filtering logic:
```typescript
const visibleGroups = Object.entries(groups).filter(([id, group]) => {
  if (!activeContainerTabId) return true; // No tab selected, show all
  if (!group.tabId) return true; // Shared group, show in all tabs
  return group.tabId === activeContainerTabId; // Only show matching tab's groups
});
```

### Option 3: Enhance sync-from-index (Preventive)

When `sync-from-index` creates groups from parsing index HTML files, automatically set the `tabId` based on which index file the group was derived from.

## Related

- FR-24 (Container Tab Navigation) - defined the filtering behavior
- FR-26 (Index HTML Sync) - creates groups, should set tabId
- Knowledge Base Section 2 (Data Model) - documents tabId behavior

## Priority

**High** - Defeats the purpose of tabbed organization. Core feature not working.

---

**Added**: 2025-12-28
**Status**: Open
**Type**: Bug
**Found in**: bmad-poem presentation testing

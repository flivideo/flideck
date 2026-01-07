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

**Expected:** Only groups with `tabId: "epic1"` visible (could be one or many):
```
ASSETS                    [EPIC1] JOHN  MARY  WINSTON
─────────────────────────────────────────────────────
  Bmad Poem               │  (epic1 content in iframe)
                          │
► EPIC1              26   │  ← Shows because tabId="epic1"
► (any other groups       │  ← Would also show if they had
    with tabId="epic1")   │     tabId="epic1"
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

- [x] When a container tab is selected, sidebar only shows groups where `tabId` matches that tab
- [x] A tab can have ZERO, ONE, or MANY groups (not a 1:1 relationship)
- [x] Groups with `tabId: null` or no `tabId` appear in ALL tabs (shared/root assets)
- [x] Switching tabs immediately updates sidebar group visibility
- [x] Works with bmad-poem presentation

## Important: Data Model Clarification

**Groups are NOT tabs.** Groups are semantic containers for organizing slides within a tab.

```
Tab: "Epic 2" could have multiple groups:
├── Group: "Overview"     (tabId: "epic2")
├── Group: "Stories"      (tabId: "epic2")
├── Group: "Testing"      (tabId: "epic2")
└── Group: "Deployment"   (tabId: "epic2")

Or a tab could have NO groups - just loose slides.
```

The `tabId` on a group says "this group belongs to this tab" - it's a many-to-one relationship (many groups can belong to one tab).

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
**Status**: Fixed (2025-12-30)
**Type**: Bug
**Found in**: bmad-poem presentation testing

## Resolution

**Root Cause (2025-12-30)**: Cause B - Sidebar filtering was correct, but `activeContainerTabId` was being cleared whenever an asset was selected, causing all groups to appear.

**Root Cause Update (2025-01-02)**: Additional bug found - when groups were filtered out due to tab mismatch, they weren't being removed from the `assetsByGroup` Map. This caused them to appear as "orphan groups" with auto-generated labels derived from their group IDs (e.g., `epic1-slides` → "EPIC1 SLIDES").

**Fix Applied (2025-12-30)**:
1. `PresentationPage.tsx`: Stop clearing `activeContainerTabId` when selecting assets - keep sidebar filtered
2. `PresentationPage.tsx`: New `handleTabChange` clears `selectedAssetId` when switching tabs (shows tab index)
3. `Sidebar.tsx`: Add `filteredFlatAssets` for flat mode filtering by active tab

**Fix Applied (2025-01-02)**:
4. `Sidebar.tsx`: Always call `assetsByGroup.delete(groupId)` when skipping a group - prevents orphan group loop from picking up filtered groups
5. `sidebarOrder.ts`: Same fix for keyboard navigation - ensure parent tabId inheritance works, skip `tab: true` groups

**Key Code Pattern (the bug)**:
```typescript
// BEFORE (buggy):
if (shouldSkip) {
  continue;  // Group skipped BUT still in assetsByGroup map!
}

// AFTER (fixed):
if (shouldSkip) {
  assetsByGroup.delete(groupId);  // Remove before continuing
  continue;
}
```

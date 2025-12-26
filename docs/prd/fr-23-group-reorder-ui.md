# FR-23: Group Reorder UI

## Summary

Add drag-and-drop UI for reordering groups in grouped display mode. The API exists (FR-17) but the UI was deferred. This is independent of container tabs (FR-24).

## Problem Statement

**Current state:**
- Users can create, rename, and delete groups via UI
- Users can drag-and-drop assets to reorder them
- Users can drag assets between groups to move them
- Users **cannot** reorder groups themselves via drag-and-drop

**Impact:**
- The only way to reorder groups is via API calls or manual manifest editing
- Inconsistent UX: assets are draggable, but their parent groups are not
- Poor discoverability: users expect groups to be draggable

**Deferred from:** FR-17 (Group Management)

## Scope Clarification

**This FR covers:**
- Drag-and-drop reordering of groups in **grouped display mode** only
- Visual feedback during drag (drop zones, drag handles)
- API integration with existing `PUT /api/presentations/:id/groups/order` endpoint

**This FR does NOT cover:**
- Container tab reordering (handled by FR-24 - already has API, UI deferred)
- Flat mode (no groups to reorder)
- Cross-group asset dragging (already implemented in FR-20)

**Architectural note:**
- This FR was originally written when "tabbed mode" referred to sidebar tabs (FR-22)
- FR-24 moved tabs to container level and deprecated sidebar tabs
- This rewrite focuses solely on group reordering in grouped display mode

## Proposed Solution

### UI Behavior

**Grouped mode sidebar:**

```
┌─────────────────────────────┐
│ ASSETS                      │
├─────────────────────────────┤
│ index.html                  │
├─────────────────────────────┤
│ ⋮⋮ Introduction        [▼]  │  ← Drag handle on hover
│   → slide-1.html            │
│   → slide-2.html            │
├─────────────────────────────┤  ← Drop zone indicator
│ ⋮⋮ Getting Started     [▼]  │
│   → setup.html              │
├─────────────────────────────┤
│ ⋮⋮ Advanced Topics     [▼]  │
│   → config.html             │
└─────────────────────────────┘
```

**Drag interaction:**
1. Hover over group header → drag handle (⋮⋮) appears
2. Click and drag group header
3. Drop zone indicators (horizontal lines) appear between groups
4. Drop group into new position
5. Groups reorder immediately
6. API call persists new order to manifest

**Visual feedback:**
- Drag handle icon (⋮⋮) appears on group header hover
- Dragged group header becomes semi-transparent during drag
- Drop zones show as horizontal blue/gold line between groups
- Cursor changes to "grabbing" during drag

### Technical Approach

**Separate drag state for groups:**

Current implementation has drag state for assets:
- `draggedAssetId` - which asset is being dragged
- `dropTargetId` - where asset will be dropped

Add parallel state for groups:
- `draggedGroupId` - which group is being dragged
- `groupDropTargetId` - where group will be dropped

**Event handlers:**

```typescript
// On group header
onDragStart={(e) => handleGroupDragStart(e, groupId)}
onDragEnd={(e) => handleGroupDragEnd(e)}

// On drop zones between groups
onDragOver={(e) => handleGroupDragOver(e, targetGroupId)}
onDrop={(e) => handleGroupDrop(e, targetGroupId)}
```

**API integration:**

Call existing endpoint:
```typescript
await api.put(`/presentations/${presentationId}/groups/order`, {
  order: ['intro', 'getting-started', 'advanced-topics']
});
```

API is already implemented in FR-17, no backend changes needed.

## Acceptance Criteria

### Grouped Mode
- [ ] Group headers show drag handle (⋮⋮) on hover
- [ ] Group headers are draggable (not just the icon)
- [ ] Dragging group header shows visual feedback (transparency)
- [ ] Drop zones appear between groups during drag
- [ ] Dropping updates group order optimistically in UI
- [ ] API call persists order to manifest
- [ ] Order persists after page refresh
- [ ] Other users see updated order via Socket.io event
- [ ] Undo action available if drag was accidental (toast with "Undo"?)

### Edge Cases
- [ ] Cannot drag group above index.html asset
- [ ] Dragging group doesn't interfere with asset drag-and-drop
- [ ] Works with collapsed groups (group stays collapsed after reorder)
- [ ] Works with empty groups (groups with no assets)
- [ ] Works when sidebar is filtered by container tab (FR-24)

### Accessibility
- [ ] Keyboard alternative for reordering (up/down arrows on focused group?)
- [ ] Screen reader announces drag state ("Dragging Introduction group")
- [ ] Screen reader announces drop zones ("Drop before Getting Started")

## Technical Notes

**API already exists:**
- `PUT /api/presentations/:id/groups/order` - Reorder all groups (FR-17)
- Request body: `{ order: string[] }` - Array of group IDs in new order
- Socket.io event: `groups:reordered` - Notifies other clients

**Drag-and-drop implementation:**
- Use HTML5 Drag and Drop API
- Similar pattern to existing asset drag-and-drop in Sidebar.tsx
- Separate state from asset drag to avoid conflicts
- Use `dataTransfer.effectAllowed = 'move'`

**Drop zone rendering:**
- Render invisible drop zones between each group
- Show visual indicator (border-top or horizontal line) on dragOver
- Calculate drop position based on cursor Y position

**Optimistic updates:**
- Update group order immediately in UI (don't wait for API)
- If API fails, revert to previous order and show error toast
- Store previous order in ref for undo/revert

## Dependencies

- **FR-17** (Group Management) - Provides API endpoint
- **FR-20** (UI Rendering Modes) - Defines grouped mode rendering

## Deferred from

- **FR-17** (Group Management) - Group reorder UI was explicitly deferred
- **FR-20** (UI Rendering Modes) - Group reorder deferred to FR-22
- **FR-22** (Tab Management) - Moved to FR-23 due to sidebar tab deprecation

## Related Features

- **FR-24** (Container Tabs) - Container tab reordering uses different API (`PUT /tabs/order`)
- Container tab drag-and-drop is deferred (separate from this FR)

## Priority

**Low** - Users can work around via API or manifest editing

**Note:** While low priority, this would complete the drag-and-drop UX story and make FliDeck feel more polished.

---

**Added**: 2025-12-24
**Status**: Deferred
**Updated**: 2025-12-24 (rewritten to remove obsolete sidebar tab references)
**Origin**: Deferred from FR-17, FR-20, FR-22

## Deferral Notes

**Date**: 2025-12-24
**Developer**: Claude
**PO Priority**: Low

**Reason for Deferral:**

This feature is well-specified and has a clear implementation path, but it's marked as low priority. The workarounds (API calls or manual manifest editing) are sufficient for current needs.

**When to implement:**

Implement this feature when:
1. Users frequently request group reordering UI
2. Group management becomes a primary workflow
3. Polish pass is needed for drag-and-drop consistency

**Implementation ready:**
- API endpoint exists and is tested (`PUT /api/presentations/:id/groups/order`)
- Technical approach is documented
- UI patterns match existing asset drag-and-drop
- Can be implemented in ~2-4 hours by following this PRD

**No blockers:** This is purely a UX enhancement that can be added anytime without breaking changes.

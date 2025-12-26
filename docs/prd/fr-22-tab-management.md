# FR-22: Tab Management

> **Testing this FR?** See [FR-22-SAT](./fr-22-sat.md) for acceptance test scenarios (to be created).

## Summary

Add full CRUD operations for tabs in both API and UI, plus group-tab relationship management. This completes the structural management capabilities started in FR-17 (groups) and extended in FR-20 (rendering modes).

## Problem Statement

**Current state (after FR-17 and FR-20):**

| Operation | Groups API | Groups UI | Tabs API | Tabs UI |
|-----------|:----------:|:---------:|:--------:|:-------:|
| Create | ✅ | ✅ | ⚠️ | ❌ |
| Delete | ✅ | ✅ | ⚠️ | ❌ |
| Rename | ✅ | ✅ | ⚠️ | ❌ |
| Reorder | ✅ | ❌ | ⚠️ | ❌ |

- ✅ = Implemented
- ❌ = Not implemented
- ⚠️ = Could work via group API with `tab: true`, but not explicitly designed/tested

**Group-Tab relationships (parent/child):**

| Operation | API | UI |
|-----------|:---:|:--:|
| Move group under tab | ❌ | ❌ |
| Remove group from tab | ❌ | ❌ |
| Move group to different tab | ❌ | ❌ |

**Impact:**
- Users cannot create/manage tabs without editing JSON
- No way to organize groups under tabs via UI
- Group reorder UI still missing from FR-17

## Proposed Solution

### 1. Tab CRUD API

Extend existing group endpoints to explicitly handle tabs:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/presentations/:id/tabs` | Create tab |
| DELETE | `/api/presentations/:id/tabs/:tabId` | Delete tab |
| PUT | `/api/presentations/:id/tabs/:tabId` | Rename tab |
| PUT | `/api/presentations/:id/tabs/order` | Reorder tabs |

**Create Tab:**
```json
POST /api/presentations/:id/tabs
{
  "id": "personas",
  "label": "Personas"
}
```
Creates group with `tab: true`.

**Delete Tab:**
```json
DELETE /api/presentations/:id/tabs/personas
```
Options for child groups:
- `?orphan=true` (default) - Child groups become parentless (appear in General)
- `?cascade=true` - Delete child groups too
- `?reparent=otherId` - Move children to another tab

**Reorder Tabs:**
```json
PUT /api/presentations/:id/tabs/order
{
  "order": ["mary", "john", "winston"]
}
```
Only reorders groups where `tab: true`.

### 2. Tab UI

**Tab bar actions (in tabbed mode):**

```
┌─────────────────────────────────────────────────────────────┐
│ [Mary ▼] [John ▼] [Winston ▼] [Epic 1 ▼]     [+ New Tab]   │
└─────────────────────────────────────────────────────────────┘
```

- **[+ New Tab]** button at end of tab bar
- **Context menu** on each tab (click ▼ or right-click):
  - Rename tab
  - Delete tab
  - Move left / Move right
- **Drag tab headers** to reorder

**Inline rename:**
```
┌─────────────────────────────────────────────────────────────┐
│ [Mary] [[John_________] ✓ ✗] [Winston] [Epic 1]            │
└─────────────────────────────────────────────────────────────┘
```

### 3. Group-Tab Relationship API

| Method | Endpoint | Description |
|--------|----------|-------------|
| PUT | `/api/presentations/:id/groups/:groupId/parent` | Set/change parent tab |
| DELETE | `/api/presentations/:id/groups/:groupId/parent` | Remove from tab |

**Move group under tab:**
```json
PUT /api/presentations/:id/groups/tutorials/parent
{
  "parent": "mary"
}
```

**Remove group from tab:**
```json
DELETE /api/presentations/:id/groups/tutorials/parent
```
Group becomes parentless (appears in General tab or at root in grouped mode).

### 4. Group-Tab Relationship UI

**In tabbed mode - drag group to different tab:**
- Drag group header onto a tab header
- Visual feedback: tab header highlights
- Drop assigns `parent` to that tab

**In tabbed mode - context menu on group:**
```
┌──────────────────┐
│ Move to tab →    │ ▶ [Mary]
│                  │   [John]
│                  │   [Winston]
│                  │   ─────────
│                  │   [Remove from tab]
│ Rename group     │
│ Delete group     │
└──────────────────┘
```

### 5. Group Reorder UI (FR-17 completion)

Complete the deferred group reorder from FR-17:

**Grouped mode:**
- Drag group headers to reorder
- Visual feedback: drop zone indicator between groups

**Tabbed mode:**
- Drag group headers within a tab to reorder
- Order persists per-tab

## Acceptance Criteria

### Tab API
- [x] `POST /api/presentations/:id/tabs` creates tab (group with `tab: true`)
- [x] `DELETE /api/presentations/:id/tabs/:tabId` deletes tab
- [x] `DELETE` with `?strategy=orphan` makes child groups parentless (default)
- [x] `DELETE` with `?strategy=cascade` deletes child groups
- [x] `DELETE` with `?strategy=reparent:<tabId>` moves children to another tab
- [x] `PUT /api/presentations/:id/tabs/:tabId` renames tab
- [x] `PUT /api/presentations/:id/tabs/order` reorders tabs only

### Tab UI
- [x] "+ New Tab" button in tab bar
- [x] Context menu on tab headers (rename, delete)
- [x] Inline rename for tabs
- [x] Delete tab shows confirmation if it has children
- [ ] Drag tab headers to reorder (deferred - less critical)

### Group-Tab API
- [x] `PUT /api/presentations/:id/groups/:groupId/parent` sets parent
- [x] `DELETE /api/presentations/:id/groups/:groupId/parent` removes parent
- [x] Setting non-existent parent returns 404
- [x] Setting parent to non-tab group returns 400

### Group-Tab UI
- [x] Drag group header to tab header moves group under tab
- [x] Context menu "Move to tab" submenu
- [x] "Remove from tab" option in context menu
- [x] Visual feedback when dragging over tab headers

### Group Reorder UI (FR-17 completion)
- [ ] Drag group headers to reorder in grouped mode (deferred)
- [ ] Drag group headers to reorder within tab in tabbed mode (deferred)
- [ ] Visual drop zone indicators (deferred)

## Technical Notes

### Tab vs Group distinction

Tabs ARE groups with `tab: true`. The separate `/tabs` endpoints are convenience wrappers:

```typescript
// POST /api/presentations/:id/tabs
// Internally calls:
createGroup(id, { ...body, tab: true });
```

### Delete cascade behavior

When deleting a tab with children:
1. Default (`?orphan=true`): Set `parent: undefined` on all child groups
2. Cascade (`?cascade=true`): Delete all child groups (and their slides lose group assignment)
3. Reparent (`?reparent=newTabId`): Update `parent` on all child groups

### Reorder scope

- `PUT /groups/order` - Reorders ALL groups (existing FR-17)
- `PUT /tabs/order` - Reorders only groups where `tab: true`

Both affect the `order` property; tabs/order is a filtered convenience.

## Dependencies

- **FR-17** (Group Management) - Base group CRUD
- **FR-19** (Manifest Schema) - Validation
- **FR-20** (UI Rendering Modes) - Tabbed mode rendering

## Completes Deferred Items

- **FR-17** deferred "Group drag-drop reordering UI"

## Priority

**Medium** - Enables full structural management without JSON editing

---

**Added**: 2025-12-24
**Status**: Complete - API and UI implemented (some features deferred)

## Implementation Notes

### Completed (2025-12-24)

#### Backend Implementation
All Tab CRUD and Group-Tab relationship API endpoints have been implemented:

**Files Modified:**
- `shared/src/types.ts` - Added FR-22 type definitions:
  - `CreateTabRequest`, `UpdateTabRequest`, `ReorderTabsRequest`
  - `SetGroupParentRequest`
  - `DeleteTabStrategy` type
- `server/src/services/PresentationService.ts` - Added service methods:
  - `createTab()` - Creates tab (group with `tab: true`)
  - `deleteTab()` - Deletes tab with strategy support (orphan/cascade/reparent)
  - `updateTab()` - Updates tab label
  - `reorderTabs()` - Reorders only tabs, preserving non-tab group order
  - `setGroupParent()` - Moves group under tab
  - `removeGroupParent()` - Makes group parentless
- `server/src/routes/presentations.ts` - Added API endpoints:
  - `POST /api/presentations/:id/tabs`
  - `PUT /api/presentations/:id/tabs/:tabId`
  - `DELETE /api/presentations/:id/tabs/:tabId?strategy=...`
  - `PUT /api/presentations/:id/tabs/order`
  - `PUT /api/presentations/:id/groups/:groupId/parent`
  - `DELETE /api/presentations/:id/groups/:groupId/parent`
- `CLAUDE.md` - Updated API documentation table

**Implementation Details:**
- Tab deletion supports three strategies via query parameter:
  - `?strategy=orphan` (default) - Makes child groups parentless
  - `?strategy=cascade` - Deletes child groups and their slides
  - `?strategy=reparent:<tabId>` - Moves children to another tab
- All operations include validation:
  - Verifies tabs exist and have `tab: true`
  - Validates parent is a tab when setting group parent
  - Returns appropriate HTTP status codes (404, 400, 409, 201)
- Socket.io events emitted for real-time updates:
  - `tab-created`, `tab-updated`, `tab-deleted`, `tabs-reordered`
  - `group-parent-set`, `group-parent-removed`

### UI Implementation Complete (2025-12-24)

All core tab management UI features have been implemented:

**Files Modified:**
- `client/src/components/layout/Sidebar.tsx` - Added tab management state and handlers:
  - `startEditingTab()`, `cancelEditingTab()`, `saveTabLabel()` - Tab inline rename
  - `deleteTab()` - Tab deletion with strategy support
  - `startCreatingTab()`, `cancelCreatingTab()`, `createTab()` - Tab creation
  - `moveGroupToTab()` - Group-tab relationship management
  - State management for editing, menus, and creation flows
- `client/src/components/layout/SidebarTabbed.tsx` - Added tab management UI:
  - "+ New Tab" button in tab bar with inline input
  - Tab context menu (▼ dropdown) with rename and delete options
  - Inline rename for tabs (click, edit, Enter/Escape)
  - Delete confirmation when tab has child groups
  - Group drag-and-drop to tab headers (visual feedback with border highlight)
  - Group context menu with "Move to tab" submenu
  - "Remove from tab" option in group context menu
  - Drag handle (⋮⋮) on groups indicating they can be dragged to tabs

**Features Implemented:**
- Tab CRUD: Create, rename, delete tabs via UI
- Group-tab relationships: Drag groups to tabs, or use context menu
- Visual feedback: Tab headers highlight when dragging groups over them
- Delete strategy: Orphan child groups when deleting a tab (with confirmation)
- Inline editing: Click rename → edit in place → Enter/Escape/blur to save/cancel

**Deferred Features:**
- Tab reorder via drag-and-drop (less critical, API exists)
- Group reorder UI in grouped/tabbed modes (deferred from FR-17)
- Visual drop zone indicators for group reordering

These deferred features are low priority and can be added in a future update if needed.

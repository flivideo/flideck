# FR-17: Group Management

## Status: Implemented

**Added:** 2025-12-22
**Author:** David (via PO agent)
**Depends on:** FR-15 (rich manifest schema)

---

## User Story

As a presenter, I want to manage groups in the sidebar so that I can organize my slides into logical sections without editing JSON files.

---

## Problem

Currently groups are read-only. They come from the `index.json` manifest and cannot be modified in the UI. Users need to manually edit JSON to:
- Reorder groups
- Create new groups
- Rename existing groups
- Delete groups

---

## Solution

Add group management capabilities to the sidebar.

### Features

| Feature | Action | Result |
|---------|--------|--------|
| **Order groups** | Drag group header up/down | Updates `groups[id].order` in manifest |
| **Create group** | Click "+" or context menu | Adds new group to manifest, can move slides into it |
| **Rename group** | Double-click header or context menu | Updates `groups[id].label` in manifest |
| **Delete group** | Context menu or button | Removes group, slides move to root level |

### UI Interactions

**Reorder groups:**
```
┌─────────────────────────────────────┐
│ ≡ ▼ API Reference (3)        [⋮]   │  ← drag handle on left
│ ≡ ▼ CI/CD (8)                [⋮]   │
│ ≡ ▼ Checklist (5)            [⋮]   │
└─────────────────────────────────────┘
```

**Context menu (click [⋮]):**
```
┌──────────────────┐
│ Rename group     │
│ Delete group     │
│ ────────────────│
│ Move up          │
│ Move down        │
└──────────────────┘
```

**Create group:**
```
┌─────────────────────────────────────┐
│   [+ New Group]                     │  ← at bottom of groups
└─────────────────────────────────────┘
```

**Rename inline:**
```
┌─────────────────────────────────────┐
│ ▼ [API Reference________]    [✓][✗]│  ← editable text field
└─────────────────────────────────────┘
```

---

## Acceptance Criteria

1. [ ] Group headers have drag handles for reordering *(deferred)*
2. [ ] Dragging a group header reorders it among other groups *(deferred)*
3. [x] Group reorder updates `groups[id].order` values in manifest *(API only)*
4. [x] Context menu available on group headers
5. [x] "Rename group" opens inline edit mode
6. [x] Rename updates `groups[id].label` in manifest
7. [x] "Delete group" removes group from manifest
8. [x] Slides in deleted group move to root level (no group)
9. [x] "New Group" button/link creates a group with default name
10. [x] New group has editable name and can receive slides

---

## Technical Notes

### Files to Modify

| File | Change |
|------|--------|
| `client/src/components/layout/Sidebar.tsx` | Add group drag-drop, context menu, inline edit |
| `server/src/routes/presentations.ts` | Add endpoints for group CRUD |
| `server/src/services/PresentationService.ts` | Add group management methods |
| `shared/src/types.ts` | Add request/response types |

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `PUT` | `/api/presentations/:id/groups/order` | Reorder groups |
| `POST` | `/api/presentations/:id/groups` | Create group |
| `PUT` | `/api/presentations/:id/groups/:groupId` | Rename group |
| `DELETE` | `/api/presentations/:id/groups/:groupId` | Delete group |

### Reorder Groups

```
PUT /api/presentations/:id/groups/order
Body: { "order": ["api", "cicd", "checklist"] }
```

Updates `groups[id].order` to match the array position.

### Create Group

```
POST /api/presentations/:id/groups
Body: { "id": "new-group", "label": "New Group" }
```

Adds to `groups` object with next available `order` value.

### Rename Group

```
PUT /api/presentations/:id/groups/:groupId
Body: { "label": "New Label" }
```

### Delete Group

```
DELETE /api/presentations/:id/groups/:groupId
```

- Removes from `groups` object
- Sets `group: undefined` on all slides that had this group
- Slides move to root level

### Manifest Changes

Before delete:
```json
{
  "groups": {
    "api": { "label": "API Reference", "order": 1 },
    "cicd": { "label": "CI/CD", "order": 2 }
  },
  "slides": [
    { "file": "api-cards.html", "group": "api" },
    { "file": "intro.html", "group": "api" }
  ]
}
```

After deleting "api" group:
```json
{
  "groups": {
    "cicd": { "label": "CI/CD", "order": 1 }
  },
  "slides": [
    { "file": "api-cards.html" },
    { "file": "intro.html" }
  ]
}
```

---

## UI Mockup

### Normal State
```
┌─────────────────────────────────────────────────────┐
│   Index                            [index]  ≡       │
│   Introduction                              ≡       │
│                                                     │
│ ≡ ▼ API Reference (3)                       [⋮]    │
│     ├ API Cards                              ≡      │
│     ├ API Cheatsheet                         ≡      │
│     └ API Decision Tree                      ≡      │
│                                                     │
│ ≡ ▼ CI/CD (8)                               [⋮]    │
│     ├ Pipeline Overview                      ≡      │
│     └ ... (7 more)                                  │
│                                                     │
│   [+ New Group]                                     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Renaming Group
```
┌─────────────────────────────────────────────────────┐
│ ≡ ▼ [CI/CD Pipelines_____]              [✓] [✗]    │
└─────────────────────────────────────────────────────┘
```

---

## Out of Scope

- Bulk move slides to group (can drag one at a time via FR-15's cross-group drag)
- Group colors/icons
- Nested groups (groups within groups)
- Undo/redo for group operations

---

## Open Questions

1. **Group ID generation:** When creating a new group, how to generate the ID? Slugify the label? Use UUID?

2. **Confirm delete:** Should deleting a group with slides require confirmation?

---

## Completion Notes

**Implemented:** 2025-12-22

**Backend (API):**
- `PUT /api/presentations/:id/groups/order` - Reorder groups
- `POST /api/presentations/:id/groups` - Create group (with kebab-case ID validation)
- `PUT /api/presentations/:id/groups/:groupId` - Rename group
- `DELETE /api/presentations/:id/groups/:groupId` - Delete group (moves slides to root)

**Frontend (UI):**
- Context menu (⋮) on group headers with Rename/Delete options
- Inline edit mode for renaming groups (Enter to save, Escape to cancel)
- "+ New Group" button at bottom of groups section
- Auto-generates kebab-case ID from group label

**Files changed:**
- `shared/src/types.ts` - Added `ReorderGroupsRequest`, `CreateGroupRequest`, `UpdateGroupRequest`
- `server/src/services/PresentationService.ts` - Added `reorderGroups`, `createGroup`, `updateGroup`, `deleteGroup`
- `server/src/routes/presentations.ts` - Added 4 new group endpoints
- `client/src/components/layout/Sidebar.tsx` - Added group management UI
- `client/src/utils/api.ts` - Added `delete` method

**Deferred:**
- Group drag-drop reordering UI (API exists but UI not implemented) → **See FR-22** for completion
- The reorder API works, agents can call it directly

**Open questions resolved:**
- Group ID generation: Auto-generated from label as kebab-case
- Confirm delete: No confirmation (simple delete, slides move to root)

---

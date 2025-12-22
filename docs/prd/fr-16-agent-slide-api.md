# FR-16: Agent Slide Management API

## Status: Implemented

**Added:** 2025-12-22
**Author:** David (via PO agent)
**Depends on:** FR-14 (index.json), FR-15 (rich schema)

---

## User Story

As an agent (like SoloDeck), I want to manage slides via FliDeck's API so that there's one source of truth for the manifest schema.

---

## Problem

Currently agents write their own manifest files directly (`index.yaml`). FliDeck writes its own (`flideck.json` / `index.json`). This creates:

1. Schema divergence - each system has its own format
2. No validation - agents can write malformed data
3. No coordination - changes from one system don't notify the other

By having agents call FliDeck's API, FliDeck becomes the schema guardian. Agents don't need to know schema internals - they just call endpoints.

---

## Solution

Add CRUD endpoints for slide management:

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/presentations/:id` | Get presentation with slides (exists) |
| `POST` | `/api/presentations` | Create new presentation |
| `POST` | `/api/presentations/:id/slides` | Add slide to presentation |
| `PUT` | `/api/presentations/:id/slides/:slideId` | Update slide metadata |
| `DELETE` | `/api/presentations/:id/slides/:slideId` | Remove slide from manifest |
| `PUT` | `/api/presentations/:id/order` | Reorder slides (exists) |

### Create Presentation

```
POST /api/presentations
Body: {
  "id": "my-new-deck",
  "slides": [
    { "file": "intro.html", "title": "Introduction" }
  ]
}
Response: { "success": true, "path": "/path/to/my-new-deck" }
```

Creates the folder if it doesn't exist. Writes `index.json` manifest.

### Add Slide

```
POST /api/presentations/:id/slides
Body: {
  "file": "new-slide.html",
  "title": "New Slide",
  "group": "api"
}
Response: { "success": true }
```

Appends slide to manifest. Does NOT create the HTML file (agent does that separately).

### Update Slide

```
PUT /api/presentations/:id/slides/:slideId
Body: {
  "title": "Updated Title",
  "group": "cicd"
}
Response: { "success": true }
```

Updates metadata for existing slide. `slideId` is the filename without extension.

### Remove Slide

```
DELETE /api/presentations/:id/slides/:slideId
Response: { "success": true }
```

Removes slide from manifest. Does NOT delete the HTML file.

---

## Acceptance Criteria

1. [x] `POST /api/presentations` creates folder and manifest
2. [x] `POST /api/presentations/:id/slides` adds slide to manifest
3. [x] `PUT /api/presentations/:id/slides/:slideId` updates slide metadata
4. [x] `DELETE /api/presentations/:id/slides/:slideId` removes slide from manifest
5. [x] All endpoints validate request body
6. [x] All endpoints return proper error codes (400 for bad request, 404 for not found, 409 for conflict)
7. [x] Socket.io emits `presentations:updated` after changes
8. [x] Manifest uses FR-15 schema format

---

## Technical Notes

### Files to Create/Modify

| File | Change |
|------|--------|
| `server/src/routes/presentations.ts` | Add new endpoints |
| `server/src/services/PresentationService.ts` | Add create/update/delete slide methods |
| `shared/src/types.ts` | Add request/response types |

### Error Handling

```typescript
// 400 - Bad Request (missing required fields)
{ "error": "Missing required field: file" }

// 404 - Not Found
{ "error": "Presentation not found: my-deck" }
{ "error": "Slide not found: intro" }

// 409 - Conflict (slide already exists)
{ "error": "Slide already exists: intro.html" }
```

### Folder Creation

When creating a new presentation, FliDeck should:
1. Create the folder at `{presentationsRoot}/{id}/`
2. Write `index.json` manifest
3. NOT create any HTML files (agent's responsibility)

---

## Agent Usage Pattern

```typescript
// Agent workflow
const health = await fetch('http://localhost:5201/api/health');
if (health.ok) {
  // Use API
  await fetch('http://localhost:5201/api/presentations/my-deck/slides', {
    method: 'POST',
    body: JSON.stringify({ file: 'new.html', title: 'New Slide' })
  });
} else {
  // Fallback: write index.json directly
  await fs.writeJson('path/to/my-deck/index.json', manifest);
}
```

---

## Out of Scope

- Creating/editing HTML files (agent's job)
- Authentication/authorization
- Rate limiting
- Bulk operations

---

## Completion Notes

**Implemented:** 2025-12-22

**Files changed:**
- `shared/src/types.ts` - Added `CreatePresentationRequest`, `CreatePresentationResponse`, `AddSlideRequest`, `UpdateSlideRequest` types
- `server/src/services/PresentationService.ts` - Added `createPresentation`, `addSlide`, `updateSlide`, `removeSlide` methods
- `server/src/routes/presentations.ts` - Added 4 new endpoints

**API endpoints:**
- `POST /api/presentations` - Creates folder and index.json manifest
- `POST /api/presentations/:id/slides` - Appends slide to manifest
- `PUT /api/presentations/:id/slides/:slideId` - Updates slide metadata (title, group, description, recommended)
- `DELETE /api/presentations/:id/slides/:slideId` - Removes slide from manifest

**Error handling:**
- 400: Missing required fields, invalid format
- 404: Presentation or slide not found
- 409: Presentation or slide already exists

**Notes:**
- Presentation IDs validated to be folder-name safe (alphanumeric, hyphens, underscores only)
- Slide files must end with `.html`
- All endpoints emit `presentations:updated` socket event with reason field
- Manifest timestamps (`meta.updated`) automatically updated on changes
- Legacy `assets.order` format converted to `slides[]` format when adding slides

---

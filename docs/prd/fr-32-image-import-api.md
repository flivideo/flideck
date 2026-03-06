# FR-32: Image Import API

**Status:** Pending
**Priority:** Medium
**Created:** 2026-03-05
**Source:** Brains session — completing the agent-friendly image pipeline

---

## Dependency Chain

**Depends On:**
- [FR-30: Image-to-Slide Script](fr-30-image-to-slide-script.md) — defines the conventions (naming, folder structure, HTML template) this API implements server-side
- [FR-31: Image File Auto-Discovery](fr-31-image-file-auto-discovery.md) — once images are downloaded by this API, FR-31 auto-discovery ensures they appear as slides immediately (no manual manifest step needed)

**Enables:**
- Single-call agent workflows: an agent can go from "list of image URLs" to "working FliDeck presentation" in one HTTP request
- Future: batch import UI (drag-and-drop URLs or files onto a presentation)

---

## Problem Statement

FR-30 solves the image-to-slide workflow via an external script. That script requires the agent to:

1. Download images (Bash)
2. Generate HTML wrappers (Bash/template)
3. Write `index.json` (JSON manipulation)
4. Call FliDeck's sync endpoint

This is five to ten steps even for a simple 15-image deck. The steps are mechanical and error-prone (URL escaping, sequential naming, partial failures mid-download).

**The ask:** A single API call that does all of this inside FliDeck's server process, with proper error handling and a structured response.

---

## Solution: POST /api/presentations/:id/import/images

### Request

```
POST /api/presentations/:id/import/images
Content-Type: application/json

{
  "images": [
    { "url": "https://lh3.googleusercontent.com/...", "title": "Opening" },
    { "url": "https://lh3.googleusercontent.com/...", "title": "Key Concept" },
    { "path": "/Users/david/downloads/slide-03.png", "title": "Summary" }
  ],
  "options": {
    "startIndex": 1,
    "generateWrappers": true,
    "updateManifest": true
  }
}
```

**Fields:**

| Field | Required | Description |
|---|---|---|
| `images[].url` | One of url/path | Remote image to download |
| `images[].path` | One of url/path | Local file to copy into presentation folder |
| `images[].title` | No | Human-readable title for sidebar. Falls back to sequential name. |
| `options.startIndex` | No (default: 1) | Starting number for sequential naming (`slide-01`, `slide-02`, etc.) |
| `options.generateWrappers` | No (default: true) | Whether to generate HTML wrapper files. Set false if using FR-31 auto-discovery only. |
| `options.updateManifest` | No (default: true) | Whether to update `index.json` with the new slides. |

### Behaviour

For each image in order:

1. Determine target filename: `slide-{NN}.{ext}` where `NN` is zero-padded and `ext` is inferred from URL/path
2. Download URL or copy local path to `{presentationsRoot}/{id}/slide-NN.{ext}`
3. If `generateWrappers: true`, write `slide-NN.html` using the standard template from FR-30
4. If `updateManifest: true`, append a slide entry to `index.json`
5. Continue to next image (partial success — failed images are reported but do not abort the batch)

After all images are processed, FliDeck's in-memory presentation cache is refreshed.

### Response

```json
{
  "presentationId": "my-image-deck",
  "imported": [
    { "index": 1, "file": "slide-01.jpg", "wrapper": "slide-01.html", "title": "Opening", "status": "ok" },
    { "index": 2, "file": "slide-02.jpg", "wrapper": "slide-02.html", "title": "Key Concept", "status": "ok" },
    { "index": 3, "file": "slide-03.png", "wrapper": "slide-03.html", "title": "Summary", "status": "ok" }
  ],
  "errors": [],
  "manifest": {
    "slidesAdded": 3,
    "totalSlides": 3
  }
}
```

**On partial failure:**

```json
{
  "presentationId": "my-image-deck",
  "imported": [
    { "index": 1, "file": "slide-01.jpg", "wrapper": "slide-01.html", "title": "Opening", "status": "ok" },
    { "index": 2, "file": null, "title": "Key Concept", "status": "error", "error": "Download failed: 403 Forbidden" }
  ],
  "errors": [
    { "index": 2, "title": "Key Concept", "reason": "Download failed: 403 Forbidden" }
  ],
  "manifest": {
    "slidesAdded": 1,
    "totalSlides": 1
  }
}
```

HTTP status is `207 Multi-Status` when there are partial errors.

### Creating a New Presentation via This Endpoint

If the presentation ID does not exist, the endpoint creates the folder automatically (same behaviour as `POST /api/presentations`).

This means an agent can create a complete image presentation in one call:

```bash
curl -X POST http://localhost:5201/api/presentations/my-nano-banana-deck/import/images \
  -H "Content-Type: application/json" \
  -d '{
    "images": [
      { "url": "https://...", "title": "Slide 1" },
      { "url": "https://...", "title": "Slide 2" }
    ]
  }'
```

---

## Interaction with FR-31 Auto-Discovery

If FR-31 is implemented:

- `generateWrappers: false` is a valid option — images are downloaded and FR-31 handles rendering them as virtual slides
- `generateWrappers: true` (default) still generates HTML wrappers for compatibility with FR-30 conventions and for agents that read the manifest and expect HTML files

Both modes update `index.json` so slide titles and order are preserved.

---

## Naming Conflict Strategy

If `slide-01.jpg` already exists in the folder:

- Default: skip and return `"status": "skipped"` with the existing filename
- With `"onConflict": "replace"`: overwrite the existing file
- With `"onConflict": "append"`: find the next available index (e.g., `slide-16.jpg` if 1-15 exist)

---

## Acceptance Criteria

- [ ] `POST /api/presentations/:id/import/images` accepts an array of image URLs and/or local paths
- [ ] Images are downloaded/copied to the presentation folder with sequential naming (`slide-NN.{ext}`)
- [ ] HTML wrapper files are generated for each image (when `generateWrappers: true`)
- [ ] `index.json` is updated with the new slide entries including titles
- [ ] The presentation cache is refreshed after import — slides appear in FliDeck UI without a manual sync
- [ ] Partial failures do not abort the batch — successful images are still imported
- [ ] Response includes per-image status (ok / error / skipped) and a summary
- [ ] If the presentation folder does not exist, it is created automatically
- [ ] Naming conflicts are handled according to the `onConflict` strategy (default: skip)
- [ ] Endpoint is documented in the capabilities response (`GET /api/capabilities`)

---

## Technical Notes

- Image downloading should use a streaming approach (pipe response to file) to avoid loading large images into memory
- A reasonable per-image timeout should be enforced (suggested: 30 seconds)
- The endpoint should validate that the target presentation folder is within `presentationsRoot` to prevent path traversal
- File extension is determined from the `Content-Type` header when downloading from URL (fallback: parse from URL path)
- Sequential naming must account for existing files in the folder to avoid overwriting slides that were imported in a previous call

---

## Related Requirements

- FR-16: Agent Slide Management API (adds individual slides; this FR adds batches of image slides)
- FR-21: Agent Manifest Tooling (sync and bulk operations this FR builds on)
- FR-30: Image-to-Slide Script (defines conventions this API implements)
- FR-31: Image File Auto-Discovery (images downloaded here appear automatically if FR-31 is active)
- FR-27: Agent Capability Discovery (`GET /api/capabilities` should advertise this endpoint)

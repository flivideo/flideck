# FR-31: Image File Auto-Discovery

**Status:** Pending
**Priority:** Medium
**Created:** 2026-03-05
**Source:** Brains session — natural evolution of FR-30 script workflow

---

## Dependency Chain

**Depends On:**
- [FR-30: Image-to-Slide Script](fr-30-image-to-slide-script.md) — establishes the image file conventions (naming, types, folder structure) that this FR adopts

**Enables:**
- [FR-32: Image Import API](fr-32-image-import-api.md) — FR-32 relies on this auto-discovery to confirm downloaded images appear as slides automatically

---

## Problem Statement

When a user follows the FR-30 workflow (or manually drops images into a presentation folder), they must also create HTML wrapper files for each image before FliDeck will recognise them as slides.

This is unnecessary friction. The image files themselves are the content. FliDeck already knows how to render an image inside an iframe — it just needs to generate the wrapper at serve time rather than requiring pre-baked HTML files.

**The ask:** Drop images into a FliDeck presentation folder and have them appear as slides automatically — no HTML wrapper files required.

---

## Background: How FliDeck Currently Discovers Slides

FliDeck's `PresentationService` scans a presentation folder for `.html` files. Non-HTML files are ignored entirely.

When a `slides[]` array is present in `index.json`, those entries drive the sidebar. When absent, FliDeck falls back to filesystem discovery (HTML files, ordered by creation time per FR-13).

This FR extends the discovery step to also pick up image files and treat them as virtual slides.

---

## Solution: Extend File Discovery to Include Image Types

### What Changes in FliDeck

**Server — `PresentationService.ts`:**

1. Extend the file scan to detect image files alongside HTML files
2. For each image file found, create a virtual slide entry with `type: "image"`
3. Image slides sort by creation time (same as HTML slides, per FR-13)
4. `index.json` can override title and order for image slides (same as HTML slides)

**Server — asset serving route:**

When a request arrives for an image slide (i.e., `type: "image"`), serve a generated HTML wrapper instead of the raw image file. The wrapper uses the standard template from FR-30:

```html
<!DOCTYPE html>
<html>
<head>
  <title>{title}</title>
  <style>
    body { margin: 0; background: #000; display: flex; align-items: center; justify-content: center; height: 100vh; }
    img { max-width: 100%; max-height: 100vh; object-fit: contain; }
  </style>
</head>
<body>
  <img src="{imageFile}" alt="{title}">
</body>
</html>
```

The image `src` must be a relative path that the browser can resolve from within the iframe. Because the wrapper HTML is served from the same presentation route, a relative `src` like `slide-01.jpg` resolves correctly.

### Image Types Supported

```typescript
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg']
```

SVG is included because it is a common format for AI-generated diagrams and icons used in presentations.

### Manifest Schema Addition

Image slides appear in `index.json` with an optional `type` field:

```json
{
  "slides": [
    { "file": "slide-01.jpg", "title": "Opening", "type": "image" },
    { "file": "slide-02.jpg", "title": "Key Concept", "type": "image" }
  ]
}
```

`type: "image"` is inferred from the file extension if absent. It is written by FliDeck when auto-generating manifest entries for discovered image files.

### Ordering

When no `index.json` exists:
- HTML and image slides are interleaved, ordered by filesystem creation time
- `index.html` or `presentation.html` still pins to position 0 if present

When `index.json` exists:
- Image slides listed in `slides[]` appear in the declared order
- Image files present on disk but not in `slides[]` appear at the end (by creation time), same self-healing behaviour as HTML slides

---

## What Does Not Change

- FliDeck's external API shape is unchanged — image slides appear in the same `assets[]` array as HTML slides
- The sidebar renders image slides identically to HTML slides (title, group, recommended indicator)
- Drag-and-drop reordering works the same way (manifest `order` is updated)
- Presentation mode, keyboard navigation, and all other features apply unchanged

---

## Acceptance Criteria

- [ ] FliDeck discovers `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.svg` files in presentation folders
- [ ] Image files appear as slides in the sidebar alongside HTML slides
- [ ] Clicking an image slide loads it in the iframe (centered, black background, aspect ratio preserved via `object-fit: contain`)
- [ ] Image slides are ordered by filesystem creation time by default (per FR-13)
- [ ] `index.json` can override `title`, `order`, and `group` for image slides
- [ ] Image slides work in flat, grouped, and tabbed presentation types
- [ ] A presentation folder containing only image files (no HTML at all) is valid and renders correctly
- [ ] A mixed folder (HTML slides + image slides) renders both types correctly in order
- [ ] The auto-generated HTML wrapper is not written to disk — it is generated in memory at serve time

---

## Technical Notes

- The generated HTML wrapper is served as a response body, not written to disk. This keeps the presentation folder clean.
- The `src` attribute of the `<img>` tag must use a relative path. The asset serving route must ensure both the wrapper response and the raw image file are reachable at predictable URLs.
- When FliDeck writes manifest entries for auto-discovered image slides, it should include `"type": "image"` so agents reading the manifest can distinguish image slides from HTML slides without inspecting the file extension.

---

## Related Requirements

- FR-13: Creation time ordering (image slides follow the same default ordering)
- FR-20: UI rendering modes (image slides participate in all modes: flat, grouped, tabbed)
- FR-26: Index HTML sync — not directly applicable (image slides don't have `<title>` tags to parse, title comes from filename or manifest)
- FR-30: Image-to-Slide Script (establishes conventions this FR adopts)
- FR-32: Image Import API (uses this auto-discovery — once images are downloaded, they appear automatically)

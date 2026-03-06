# FR-30: Image-to-Slide Script

**Status:** Pending
**Priority:** Medium
**Created:** 2026-03-05
**Source:** Brains session — AppyDave workflow pain point

---

## Dependency Chain

**Depends On:** Nothing (zero FliDeck changes required)

**Enables:**
- [FR-31: Image File Auto-Discovery](fr-31-image-file-auto-discovery.md) — FR-31 builds on the folder/naming conventions established here
- [FR-32: Image Import API](fr-32-image-import-api.md) — FR-32 automates what this script does manually

---

## Problem Statement

AppyDave generates image sets using Nano Banana (kie.ai) for use in presentations. There is currently no workflow to take a folder of AI-generated images and turn them into a FliDeck presentation. The options today are:

1. Manually create one HTML wrapper file per image — tedious and error-prone
2. Use another tool (Google Slides, etc.) — bypasses FliDeck entirely
3. Drag images into some ad-hoc solution — painful reordering, no persistence

The result: image-based presentations happen outside FliDeck, even though FliDeck's iframe renders them perfectly with a minimal HTML wrapper.

**The good news:** This can be solved today with a script or agent workflow. No FliDeck code changes needed.

---

## The Concrete Use Case

AppyDave generated 15 AI presentation images using Nano Banana via kie.ai. These were temporarily hosted on Google's CDN (`lh3.googleusercontent.com`). For a durable FliDeck presentation, images must be:

1. Downloaded locally to a named presentation folder
2. Named sequentially: `slide-01.jpg` through `slide-15.jpg`
3. Wrapped in minimal HTML (one file per image)
4. Registered in `index.json` with meaningful titles
5. Synced with the running FliDeck instance

---

## Solution: Script / Agent Workflow (Level 1)

An external agent, Claude Code workflow, or CLI script that performs these steps:

### Step 1: Create presentation folder

```
{presentationsRoot}/{presentation-name}/
```

The folder name becomes the presentation ID in FliDeck.

### Step 2: Download images

For each image URL or local path:
- Download to the presentation folder
- Name sequentially: `slide-01.jpg`, `slide-02.jpg`, etc.
- Preserve original file extension

### Step 3: Generate HTML wrappers

One minimal HTML file per image, named to match: `slide-01.html`, `slide-02.html`, etc.

```html
<!DOCTYPE html>
<html>
<head>
  <title>Slide 01</title>
  <style>
    body { margin: 0; background: #000; display: flex; align-items: center; justify-content: center; height: 100vh; }
    img { max-width: 100%; max-height: 100vh; object-fit: contain; }
  </style>
</head>
<body>
  <img src="slide-01.jpg" alt="Slide 01">
</body>
</html>
```

The `<title>` tag is used by FliDeck's `sync-from-index` endpoint (FR-26) to extract the slide name for the sidebar.

### Step 4: Create index.json

```json
{
  "version": "1.0",
  "meta": {
    "title": "My Image Presentation",
    "description": "Generated from Nano Banana images"
  },
  "slides": [
    { "file": "slide-01.html", "title": "Opening" },
    { "file": "slide-02.html", "title": "Key Concept" },
    { "file": "slide-03.html", "title": "Summary" }
  ]
}
```

### Step 5: Notify FliDeck (optional, if running)

```
PUT /api/presentations/{id}/manifest/sync
```

This triggers FliDeck to re-scan the folder and pick up the new presentation without a server restart.

---

## Implementation Options

### Option A: Claude Agent Workflow

A Claude Code agent receives a list of image URLs and a presentation name, then executes Steps 1-5 using Bash. No new code required — pure scripting.

### Option B: Standalone Shell Script

A shell script (`scripts/image-to-slides.sh`) that accepts:
```
./image-to-slides.sh --name "my-presentation" --images "url1 url2 url3"
```

### Option C: SoloDeck / FliVideo Skill

A Claude skill that wraps the workflow and can be invoked from any agent session.

---

## Conventions Established by This FR

These conventions are adopted by FR-31 and FR-32:

| Convention | Value |
|---|---|
| Image file naming | `slide-NN.{ext}` (zero-padded, 2 digits minimum) |
| HTML wrapper naming | `slide-NN.html` (matches image name) |
| HTML wrapper template | Centered, black background, `object-fit: contain` |
| `<title>` tag | Used for sidebar display name |
| Folder structure | Flat — all images and wrappers at presentation root |
| Image types supported | `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.svg` |

---

## Acceptance Criteria

- [ ] A script or agent workflow can accept a list of image URLs and a presentation name
- [ ] Images are downloaded to `{presentationsRoot}/{presentation-name}/` as `slide-NN.{ext}`
- [ ] One HTML wrapper is generated per image using the standard template
- [ ] `index.json` is created with all slides registered in order with meaningful titles
- [ ] The resulting folder, when opened in FliDeck, renders all images correctly
- [ ] Calling `PUT /api/presentations/{id}/manifest/sync` after creation picks up the presentation without a restart
- [ ] Works with a mix of local file paths and remote URLs

---

## Related Requirements

- FR-13: Creation time ordering (ordering follows this when no manifest exists)
- FR-16: Agent slide API (alternative for adding slides one at a time)
- FR-21: Agent manifest tooling (sync endpoint used in Step 5)
- FR-26: Index HTML sync — `sync-from-index` reads `<title>` tags from generated HTML wrappers
- FR-31: Image file auto-discovery (builds on conventions here)
- FR-32: Image import API (automates this workflow via API)

---

## Notes

- This FR requires zero FliDeck code changes. It is purely an operational/scripting concern.
- The HTML wrapper template is deliberately minimal. Styling is intentionally close to a "lightbox" aesthetic — black background, centered, full-height.
- If FliDeck is not running when the script completes, the presentation will be discovered on next startup automatically.
- Titles in `index.json` should be human-readable. The script can derive titles from filenames, original URLs, or be passed explicitly.

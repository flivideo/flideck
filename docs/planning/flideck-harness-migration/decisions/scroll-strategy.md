# Scroll Strategy — FliDeck Harness

**Date**: 2026-03-06
**Status**: Decision

---

## Problem

FliDeck is migrating from iframe-based slide rendering to an embedded harness model where slide HTML is injected as an inline fragment into a `.harness-slide` div in the host React page.

This creates two related problems for slides that use viewport-lock CSS techniques:

1. **`overflow: hidden` on `.harness-slide` clips the slide.** Slides that rely on internal section-based navigation (keyboard-driven, scroll-snap-driven) need their container to allow scrolling, not clip it.

2. **`scroll-snap-type` on `<html>` has no effect in the embedded model.** In the iframe model, the slide's `<html>` element _is_ the scroll container (it owns the viewport). In the embedded model, the slide's `<html>` element is parsed by DOMParser and its `innerHTML` is extracted — the `<html>` tag itself is discarded. The host page's `<html>` is FliDeck's own document. Scroll-snap rules that target the root document do not transfer.

**Affected slides in the corpus:**

| Presentation | Slide | Technique |
|---|---|---|
| `bmad-agents` | `pipeline.html` | `scroll-snap-type: y mandatory` on `html`, `100vh` per section, keyboard nav |
| `dam-overview` | `slides.html` | Same scroll-snap pattern, teleprompter layout |
| `claudemas-12-days` | 3 arcade slides | `overflow: hidden; height: 100%` on `body` |
| `zero-to-app` | 2 arcade slides | `overflow: hidden; height: 95vh` on sections |
| `consultants-plugin` | `decision-tree.html` | Viewport-centered fixed-position nav |

---

## Options Considered

### Option A — Iframe passthrough for viewport-lock slides

Viewport-lock slides are classified upfront as Type C. They retain the existing `srcdoc` iframe rendering path. The harness embedded model applies only to Type A and Type B slides. This is a hybrid approach.

**Pros:**
- Zero implementation risk — iframe mode already works for these slides
- No new CSS complexity
- No detection heuristic needed

**Cons:**
- Keeps iframe code alive indefinitely
- Two rendering paths to maintain
- Defers rather than solves the problem
- Viewport-lock slides cannot benefit from harness features (scoped CSS tokens, `--flideck-top`/`--flideck-left` injection, etc.)

### Option B — Harness viewport-lock mode (CSS class variant)

Add a `.harness-slide--viewport-lock` CSS class. When a slide is classified as viewport-lock, the harness container expands to fill the full available content area and sets `overflow: auto` instead of `overflow: hidden`, allowing the slide's own scroll behaviour to work.

**Pros:**
- Eliminates iframes entirely from the rendering path
- Single rendering model, simpler long-term maintenance
- Scroll-snap on internal elements (not root `<html>`) still works correctly
- `stripSlideWrapper` can auto-detect viewport-lock markers from parsed HTML

**Cons:**
- Slides using `scroll-snap-type` on `<html>` must be migrated to move the scroll-snap rule to an internal scroll container div (a one-time per-slide change)
- Detection heuristic has potential false positives (acceptable — see Limitations)

### Option C — Hybrid with explicit manifest flag

The manifest includes a `viewport-lock: true` flag per slide. `HarnessViewer` reads this flag and applies either the standard or viewport-lock CSS. The migration toolchain detects viewport-lock markers and sets the flag automatically.

**Pros:**
- Authoritative, explicit classification — no runtime guessing
- Manifest flag is inspectable, overridable, and version-controlled

**Cons:**
- Requires manifest updates for every existing viewport-lock slide
- Detection still needed to populate the flag (same heuristic as Option B)
- More moving parts than Option B alone

---

## Decision

**Option C (Hybrid with explicit manifest flag) implemented with Option B's runtime detection as the auto-detection fallback.**

Rationale:

- The manifest flag (`viewport-lock: true` per slide) is the authoritative source. It is inspectable and overridable by humans — important for slides where the heuristic misfires.
- `stripSlideWrapper` now returns a `viewportLock: boolean` from its detection heuristic. This allows callers to auto-classify new slides without requiring a manifest entry, and is the mechanism the migration toolchain will use to populate initial manifest flags.
- `HarnessViewer` accepts a `viewportLock?: boolean` prop. The caller (typically `AssetViewer`) decides whether to pass the manifest flag value or the `stripSlideWrapper` auto-detected value. The manifest takes precedence when present.
- Iframes are not retained. All slides use the harness rendering path. Viewport-lock slides that use `scroll-snap-type` on `<html>` will need a one-time migration step to move the rule to an internal scroll container — this is a migration toolchain concern, not a runtime concern.

---

## Implementation

### 1. `client/src/harness/harness.css`

Added `.harness-slide--viewport-lock` variant:

```css
.harness-slide--viewport-lock {
  width: 100%;
  height: 100%;
  overflow: auto;  /* allows slide's own scroll behaviour — do NOT set hidden */
}
```

This class is applied alongside `.harness-slide` (not instead of it). The base `.harness-slide` rule still provides `position: relative; isolation: isolate`.

### 2. `client/src/harness/HarnessViewer.tsx`

Added `viewportLock?: boolean` prop (defaults to `false`). When true, `.harness-slide--viewport-lock` is included in the wrapper div's `className` alongside `.harness-slide`.

### 3. `client/src/harness/stripSlideWrapper.ts`

`StrippedSlide` interface extended with `viewportLock: boolean`.

`detectViewportLock(doc: Document): boolean` added. Detection checks:

1. All `<style>` block text content for any of:
   - `scroll-snap-type` (any value)
   - `overflow: hidden`
   - `height: 100vh` or `height: 95vh`
2. The `<body>` element's inline `style` attribute for `overflow: hidden`
3. The `<html>` element's inline `style` attribute for any of the above patterns

Detection uses the fully parsed `Document` from `DOMParser` (not regex on raw HTML strings), so nested/malformed HTML is handled by the browser's own parser.

---

## Affected Presentations

| Presentation | Slide | Detected markers | Action required |
|---|---|---|---|
| `bmad-agents` | `pipeline.html` | `scroll-snap-type`, `height: 100vh` | Move `scroll-snap-type` from `html` to internal scroll container |
| `dam-overview` | `slides.html` | `scroll-snap-type`, `height: 100vh` | Move `scroll-snap-type` from `html` to internal scroll container |
| `claudemas-12-days` | 3 arcade slides | `overflow: hidden`, `height: 100%` | `height: 100%` is not detected (no `vh` unit); mark in manifest |
| `zero-to-app` | 2 arcade slides | `height: 95vh`, `overflow: hidden` | Auto-detected via `95vh` and `overflow: hidden` patterns |
| `consultants-plugin` | `decision-tree.html` | Fixed-position nav (no scroll-snap) | Not viewport-lock; handled separately via `position: fixed` migration |

---

## Limitations

### What the heuristic can catch

- `scroll-snap-type` anywhere in a `<style>` block — reliable signal
- `overflow: hidden` in a `<style>` block — common in arcade/carousel slides
- `height: 100vh` or `height: 95vh` in a `<style>` block — common in sectioned slides
- `overflow: hidden` or `scroll-snap-type` in inline `style` attributes on `<body>` or `<html>`

### What the heuristic cannot catch

- `height: 100%` (no `vh` unit) — used by the `claudemas-12-days` arcade slides; not auto-detected. These slides require an explicit manifest flag.
- Viewport-lock behaviour expressed entirely in an external stylesheet (`<link rel="stylesheet" href="...">`). The corpus has no such slides, but future presentations could.
- Slides that use JavaScript to dynamically apply viewport-lock CSS after load. The heuristic only inspects static HTML/CSS.

### False positive risk

Low. The patterns (`scroll-snap-type`, `overflow: hidden` paired with viewport intent) are unlikely in non-viewport-lock slides. If a false positive occurs, the manifest flag can be set to `false` to override the auto-detection result.

### scroll-snap-type migration note

`scroll-snap-type: y mandatory` on the `<html>` element is a common pattern in the corpus but does not work in the embedded model. The migration toolchain must:

1. Detect this pattern
2. Move the `scroll-snap-type` rule to the outermost scroll container div inside `<body>` (typically the first child of `<body>` in these slides)
3. Ensure that element has `overflow-y: auto` or `overflow-y: scroll` (scroll-snap requires an explicit overflow value to create the snap container)

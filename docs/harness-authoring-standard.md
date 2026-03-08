# FliDeck Harness — Slide Authoring Standard

**Version**: 1.0
**Date**: 2026-03-08
**Status**: Active

This document tells AI agents exactly how to author new slides that work in the embedded harness. Read every section before generating a slide file.

---

## What the Harness Provides (do not redeclare these)

The harness host page injects the following before any slide content is mounted. Do not reimplement or redefine them.

### Fonts (loaded once per session)

- Bebas Neue
- Oswald
- Roboto
- Roboto Mono

Do not include `<link rel="stylesheet" href="https://fonts.googleapis.com/...">` for any of these four families. The harness loads them once; per-slide requests are redundant network traffic.

### CSS Tokens (injected on `:root` by the harness)

```css
--brand-brown:    #342d2d
--brand-gold:     #ccba9d
--brand-yellow:   #ffde59
--white:          #ffffff
--brand-gray:     #595959
--doc-blue:       #3b82f6
--runtime-purple: #8b5cf6
--success-green:  #22c55e
--issue-amber:    #f59e0b
--pain-red:       #ef4444
```

Slides may declare their own `<style>` block that uses these tokens — that is correct and expected. Do not redeclare the token values themselves in a slide's `:root` unless you are intentionally overriding them (deviant palette). See CSS Rules for scoping.

### Clipboard Utilities

```js
window.copyCommand(el)  // copies el.textContent to clipboard
window.copyInline(el)   // copies inline text node content
```

These are injected by the harness as globals before slide content loads. Slides call them directly — do not define them inside the slide.

### Navigation and Keyboard

The harness owns all keyboard shortcuts:

| Key | Action |
|---|---|
| `Cmd/Ctrl + Arrow` | Previous / next slide |
| `F` | Toggle presentation mode |
| `Escape` | Exit presentation mode |

Do not add `keydown` or `keyup` listeners for these keys in any slide. Do not implement your own slide navigation, tab switching, or presentation-mode toggling.

### Base URL

The harness injects a `<base href="...">` tag pointing to the presentation folder before mounting the slide fragment. This means:

- `<img src="hero.png">` resolves to `{presentationFolder}/hero.png` — correct, no change needed
- `fetch('index.json')` resolves to `{presentationFolder}/index.json` — correct for standard use
- `fetch('http://localhost:4321/...')` is an absolute URL — the base tag has no effect; the external server must be running

---

## Slide Fragment Structure

A harness-compatible slide is an HTML fragment, not a full document. The harness strips the outer `<html>`, `<head>`, and `<body>` tags before mounting.

**What you author** (the file saved to disk):

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Slide Title</title>
  <style>
    /* Slide-scoped styles — see CSS Rules */
    .harness-slide .my-card { ... }
  </style>
</head>
<body>
  <div class="slide-content">
    <!-- slide markup here -->
  </div>
</body>
</html>
```

**What the harness mounts** (after stripSlideWrapper processing):

```html
<div class="harness-slide" style="isolation: isolate;">
  <style>/* your styles */</style>
  <div class="slide-content">
    <!-- your markup -->
  </div>
</div>
```

The harness:
1. Strips `<!DOCTYPE>`, `<html>`, `<head>` (except `<style>` and non-font `<link>` tags), and `<body>` tags
2. Moves all `<style>` blocks from `<head>` into the fragment
3. Wraps the result in `<div class="harness-slide">` with `isolation: isolate`
4. Injects `<base href="...">` before mounting

The slide author never writes the `.harness-slide` wrapper — the harness adds it.

---

## CSS Rules

### Scoping requirement

All CSS selectors in a slide's `<style>` block must be prefixed with `.harness-slide` to prevent leaking into the host page.

**Correct:**
```css
.harness-slide .card { background: var(--brand-brown); }
.harness-slide h1 { font-family: 'Bebas Neue', sans-serif; }
.harness-slide :root { /* do not use :root inside a slide */ }
```

**Wrong (leaks to host):**
```css
.card { background: var(--brand-brown); }
h1 { font-family: 'Bebas Neue', sans-serif; }
body { margin: 0; }
:root { --brand-brown: #342d2d; } /* redundant; may conflict */
```

### `isolation: isolate`

The `.harness-slide` wrapper has `isolation: isolate` applied by the harness. This creates a new stacking context. Consequences:

- `z-index` values inside the slide are contained within the slide's stacking context — they will not compete with FliDeck chrome
- `position: fixed` inside a slide positions relative to the slide's containing block, not the viewport. **This is a breaking change from iframe rendering.** Do not use `position: fixed` in new slides. Use `position: absolute` or `position: sticky` instead.
- `mix-blend-mode` and filter effects are contained

### What to avoid

| Avoid | Reason |
|---|---|
| `position: fixed` | Positions relative to viewport in harness mode, will overlap chrome |
| `overflow: hidden` on `body` or `:root` | Ineffective in fragment context; use on a wrapper div |
| `height: 100vh` on `body` | Body does not exist in fragment context; use a wrapper div with `min-height: 100vh` |
| `scroll-snap-type` on `:root` or `html` | Applies to the host page scroll container, not the slide |
| `document.body` references in JS | Body is not the slide root; use `document.querySelector('.harness-slide')` |
| `window.location` manipulation | Will navigate the host app, not the slide |
| Re-declaring harness-provided CSS token values | Redundant; only declare if intentionally overriding |

### Class names to avoid

These class names are used by the harness and must not appear in slide markup or CSS:

- `harness-slide`
- `harness-chrome`
- `harness-nav`
- `harness-sidebar`
- `harness-viewport`

---

## Viewport-Lock Slides

A viewport-lock slide fills the full display area and controls its own scroll (arcade games, scroll-snap presentations). Standard slides scroll with the harness content area.

### How to declare (manifest flag)

In `index.json`, set `viewportLock: true` on the slide entry:

```json
{
  "slides": [
    { "id": "arcade-intro.html", "viewportLock": true }
  ]
}
```

When `viewportLock: true` is set, the harness renders the slide in a constrained full-height container with `overflow: hidden` and does not add padding or chrome inside the slide area.

### Auto-detection triggers

If no manifest flag is set, the harness auto-detects viewport-lock intent from the slide's CSS. A slide is treated as viewport-lock if its extracted styles contain ANY of:

- `overflow: hidden` on the `body` or `:root` selector (before stripping)
- `height: 100vh` or `height: 100%` on the `body` or `:root` selector
- `scroll-snap-type:` on the `html` or `body` selector

Auto-detection is a best-effort fallback. Explicitly setting `viewportLock: true` in the manifest is preferred for new slides.

### When to use viewport-lock

Use `viewportLock: true` when the slide:
- Is a fullscreen game or interactive animation (`overflow: hidden`, fixed dimensions)
- Implements scroll-snap navigation between its own sections
- Has a fixed-size canvas that must not be clipped by harness padding

Do not use `viewportLock` for standard slides that happen to use `min-height: 100vh` — that is a layout choice, not viewport-lock intent.

---

## Non-Standard Fonts

The harness loads the four canonical families (Bebas Neue, Oswald, Roboto, Roboto Mono). Any other font is a per-slide dependency.

### Declaration method

Include the Google Fonts `<link>` tag in the slide's `<head>`. The harness strip process preserves non-canonical font `<link>` tags and re-inserts them into the fragment head.

```html
<head>
  <link rel="stylesheet"
    href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap">
  <style>
    .harness-slide .arcade-title {
      font-family: 'Press Start 2P', monospace;
    }
  </style>
</head>
```

### Known non-standard fonts in the corpus

| Font | Used in |
|---|---|
| Press Start 2P | Arcade slides (claudemas-12-days, zero-to-app) |
| JetBrains Mono | dam-overview |
| Space Grotesk | dam-overview |
| Noto Sans Thai | zero-to-app (one slide) |

These must be declared per-slide. The harness will not load them globally.

### Local font bundles

If the harness is configured for offline use with a local font bundle, the canonical four families are served locally. Non-standard fonts declared via Google Fonts `<link>` will still require network access unless also bundled locally. The authoring spec does not change — declare the dependency, the host environment resolves it.

---

## Clipboard Usage

### What the harness provides

```js
window.copyCommand(el)
// Copies el.textContent to clipboard using navigator.clipboard.writeText()

window.copyInline(el)
// Copies inline text content (strips child element markup)
```

The harness holds `allow="clipboard-write"` at the iframe boundary (where applicable) so clipboard access is pre-granted. Slides do not need to request clipboard permission.

### Correct usage in a slide

```html
<button onclick="window.copyCommand(this.previousElementSibling)">
  Copy
</button>
```

Or with a named element:

```html
<code id="cmd-01">npm install flideck</code>
<button onclick="window.copyCommand(document.getElementById('cmd-01'))">
  Copy
</button>
```

### What NOT to do

```js
// DO NOT define copyCommand in the slide
function copyCommand(el) {
  navigator.clipboard.writeText(el.textContent);
}

// DO NOT define copyInline in the slide
const copyInline = (el) => { ... };

// DO NOT call navigator.clipboard directly for copy-button patterns
// (the harness utility handles browser compat and error handling)
```

If a slide defines its own `copyCommand` or `copyInline`, the harness-provided version is silently overridden by the slide's definition. This is classified as a migration bug (Type B conflict). New slides must not define either function.

---

## Type Classification Quick Reference

| If your slide has... | Type | Migration action |
|---|---|---|
| No `<script>` tags | A | Mechanical wrapper strip; no review needed |
| `copyCommand` / `copyInline` calls only | B | Ensure calls use `window.copyCommand`; strip any local definition |
| CSS class toggle / show-hide only | B | No change; harness does not interfere with DOM class manipulation |
| Simple decision tree with no API calls | B | LLM review recommended; likely safe |
| `fetch()` to a relative URL (e.g. `index.json`) | B/C | Confirm base URL resolves correctly; test before classifying as B |
| `fetch()` to `localhost:*` | C | Requires dev server; document dependency; manual review required |
| `keydown` listener for navigation | C | Conflicts with harness; strip or wrap with `event.stopPropagation()` |
| `scroll-snap-type` on `html`/`body` | C | Set `viewportLock: true`; LLM review to confirm scroll model |
| Webcam / media device access | C | Manual review; harness provides no media bridge |
| `window.location` navigation | C | Will navigate host app; LLM review required |
| `position: fixed` chrome elements | C | Rewrite as `position: absolute`; review layout intent |

---

## Fragment Template

Copy this as the starting point for a new harness-compatible slide.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><!-- Slide title --></title>
  <!--
    Non-standard fonts only — Bebas Neue, Oswald, Roboto, Roboto Mono
    are harness-provided. Only add a <link> here for fonts outside that set.
  -->
  <style>
    /*
      All selectors MUST be prefixed with .harness-slide
      Do not use :root, body, or html selectors
      Do not use position: fixed
      Use var(--token-name) for the 10 harness-provided tokens
    */

    .harness-slide {
      min-height: 100vh;
      background: var(--brand-brown);
      color: var(--white);
      font-family: 'Roboto', sans-serif;
      padding: 2rem;
      box-sizing: border-box;
    }

    .harness-slide h1 {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 3rem;
      color: var(--brand-gold);
      margin: 0 0 1rem;
    }
  </style>
</head>
<body>
  <h1><!-- Heading --></h1>
  <p><!-- Content --></p>

  <!--
    Scripts: only include if needed.
    - Use window.copyCommand(el) for clipboard — do not define it yourself.
    - Do not add keydown listeners for Cmd+Arrow, F, or Escape.
    - Do not manipulate window.location.
  -->
</body>
</html>
```

### Viewport-lock variant (arcade / scroll-snap slides)

Add `viewportLock: true` to the manifest entry and use this structure:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><!-- Slide title --></title>
  <style>
    .harness-slide {
      width: 100%;
      height: 100%;
      overflow: hidden;        /* intentional: viewport-lock slide */
      position: relative;
      background: #000;
    }

    /* Scroll-snap variant: use on a child container, not on html/body */
    .harness-slide .snap-container {
      height: 100%;
      overflow-y: scroll;
      scroll-snap-type: y mandatory;
    }

    .harness-slide .snap-section {
      height: 100%;
      scroll-snap-align: start;
    }
  </style>
</head>
<body>
  <div class="snap-container">
    <section class="snap-section"><!-- Section 1 --></section>
    <section class="snap-section"><!-- Section 2 --></section>
  </div>
</body>
</html>
```

---

## Checklist Before Submitting a Slide

- [ ] No `<link>` for Bebas Neue, Oswald, Roboto, or Roboto Mono
- [ ] All CSS selectors prefixed with `.harness-slide`
- [ ] No `:root`, `body`, or `html` selectors in `<style>`
- [ ] No `position: fixed`
- [ ] No `copyCommand` or `copyInline` function definitions
- [ ] No `keydown`/`keyup` listeners for Cmd+Arrow, F, or Escape
- [ ] No `window.location` manipulation
- [ ] No `document.body` DOM queries (use `.harness-slide` as root)
- [ ] If viewport-lock: `viewportLock: true` set in manifest AND scroll-snap on a child container (not `html`/`body`)
- [ ] If non-standard font: `<link>` present in `<head>`
- [ ] File classified (A / B / C) in migration notes

# Corpus Analysis: bmad-poem

**Date:** 2026-03-06
**Files analysed:** 333 individual slides (excluding 10 index-* navigation pages)
**Line count range:** 180–1180 lines, average 448 lines per file

---

## External Dependencies

### Google Fonts (every slide loads them)

All 333 slides load fonts from `fonts.googleapis.com`. The font combination is essentially a fixed system design token — it does not vary meaningfully:

| Font | Role | Frequency |
|------|------|-----------|
| Bebas Neue | Display / headings | 333 files |
| Oswald | Sub-headings, labels, UI chrome | 333 files |
| Roboto | Body copy | 333 files |
| Roboto Mono | Code, commands, monospace | ~320 files |

Exact `family=` query strings vary across 14 minor permutations (differing weight lists), but the four families are constant. This is the single biggest harness opportunity: one `<link>` tag in the harness shell would eliminate 333 individual font HTTP round-trips, or a single local font bundle could make all slides work offline.

### CDN Scripts

Zero. No `<script src="...">` tags exist in any slide. All JavaScript is inline.

### External API calls

Two slides (`story-2-5-sat-cheatsheet.html`, `story-2-6-sat-cheatsheet.html`) make live `fetch()` calls to `http://localhost:4321/api/prompt/render` — a development server API, not a third-party service. These are interactive test-runner slides.

---

## Design Token System

CSS custom properties are defined inline in every file's `<style>` block. The core brand palette is consistent across the corpus:

| Token | Value | Frequency (references) |
|-------|-------|------------------------|
| `--brand-brown` | `#342d2d` | 2641 |
| `--brand-gold` | `#ccba9d` | 1648 |
| `--brand-yellow` | `#ffde59` | 1218 |
| `--white` | `#ffffff` | 1139 |
| `--brand-gray` | `#595959` or `#9ca3af` | 816 |
| `--doc-blue` | `#3b82f6` | 429 |
| `--success-green` / `--pass-green` | `#22c55e` | 773 combined |
| `--pass-color` | `#22c55e` | 253 |
| `--runtime-purple` | `#8b5cf6` | 196 |
| `--issue-amber` | `#f59e0b` | 163 |
| `--sat-teal` | `#14b8a6` | 133 |

The token namespace is content-domain-specific (story/feature colours like `--sat-teal`, `--sm-blue`, `--po-purple`, `--dev-purple`) rather than a pure design system. Tokens are re-declared per-file; they are not shared via a common CSS file. A harness stylesheet could provide the core 8–10 brand tokens as a baseline, reducing per-slide duplication, but the domain-specific tokens would still need to live per-file.

---

## Component Patterns

The following structural patterns appear repeatedly across the corpus (estimated by class name frequency and visual inspection):

| Pattern | Estimated files | Description |
|---------|----------------|-------------|
| Card layout (white card on brown body) | ~290 | `.card` or named variant on `background: var(--brand-brown)` body |
| AppyDave header chrome | ~285 | `.header` with `.logo .appy/.dave`, `.title`, `.subtitle`, `.header-right` |
| Yellow footer bar | ~280 | `.footer` with `background: var(--brand-yellow)`, `.footer-text` |
| Grid of info cards | ~120 | `display: grid`, N-column card groups |
| Section with icon + title | ~200 | `.section-header` + `.section-icon` + `.section-title` |
| Terminal / command block | ~60 | Dark `#0d1117`/`#1e1e1e` backgrounds, Roboto Mono, `.cmd` / `.terminal` classes |
| Stat/metric display | ~80 | `.stat-value`, `.stat-label`, `.stat-number` |
| Step/pipeline flow | ~50 | Numbered stages with colored sidebars or arrows |
| Checklist / AC items | ~70 | `.ac-item`, `.ac-text`, `.ac-number` |
| Accordion / expandable | ~15 | `.accordion-item`, `.accordion-header`, `.accordion-content` |
| Summary banner | ~40 | Gradient banner below header, key metrics |

The **card-on-brown-body** pattern with **AppyDave header + yellow footer** constitutes the dominant template — estimated 85%+ of files follow this exact shell structure with content variation only in the middle.

---

## JavaScript Patterns

17 of 333 slides (5%) contain inline `<script>` blocks. No external JS libraries are used anywhere.

| JS Pattern | Files | What it does |
|-----------|-------|--------------|
| Copy-to-clipboard | ~14 | `navigator.clipboard.writeText()` triggered by `.copy-btn` `onclick="copyCommand(this)"` or `onclick="copyInline(this)"` — copies terminal command text |
| Live API test runner | 2 | `fetch()` calls to localhost:4321, updates DOM with JSON response, animates status badges. Requires a running dev server to function |
| CSS class toggle | ~3 | `classList.add/remove` for show/hide, state badges |
| `@keyframes` animations | 9 | Decorative pulse/fade animations on arrows or status indicators — pure CSS, no JS dependency |
| `setTimeout` delay | 1 | 300ms delay between sequential test runs in `runAllTests()` |
| `showResult()` | 1 | Toggle visibility of result panels |

**Key finding:** All JS is self-contained utility code. No framework, no module imports, no build requirements. The copy-to-clipboard pattern (14 files) is the most common and most harness-relevant — if the harness injects a shared copy utility, slides could reference it instead of embedding it.

The 2 live-API test runner slides are the only truly "complex" JS cases. They make cross-origin `fetch()` calls and will fail unless a compatible server is running.

---

## Slide Structure

The overwhelmingly dominant HTML structure (estimated 285+ files):

```
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" ...>
  <title>...</title>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&..."> <!-- font load -->
  <style>
    :root { /* 5–15 CSS custom properties */ }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Roboto'; background: var(--brand-brown); min-height: 100vh;
           display: flex; justify-content: center; align-items: flex-start; padding: 40px 20px; }
    /* 100–500 lines of component CSS */
  </style>
</head>
<body>
  <div class="card"> <!-- or named variant -->
    <div class="header">
      <div class="logo"><span class="appy">Appy</span><span class="dave">Dave</span></div>
      <div class="header-right">
        <div class="title">...</div>
        <div class="subtitle">...</div>
      </div>
    </div>
    <!-- slide-specific content -->
    <div class="footer">
      <div class="footer-text">...</div>
    </div>
  </div>
  <!-- optional: <script> block -->
</body>
</html>
```

A minority pattern (~22 files) uses a full-bleed layout without the outer card wrapper — body itself is the content surface with `background: var(--brand-brown)` and content sections laid out directly.

---

## Sampled Slides

### 1. `story-3-9-architecture.html` (345 lines)
Pipeline architecture diagram. Three stage-cards (Data/Process/Output) in a vertical pipeline with `@keyframes pulse` animated arrows between them. Full-bleed layout — no outer card, body IS the dark canvas. No JS. Demonstrates the pipeline/flow pattern with coloured sidebar variant cards.

### 2. `non-functional-requirements.html` (343 lines)
3-column grid of 12 NFR cards, each category-coloured. Standard card-on-brown shell: AppyDave header, content area with `.nfr-grid`, legend, yellow footer. No JS. Exemplifies the dominant card+grid+header+footer pattern in its simplest, cleanest form.

### 3. `story-2-5-sat-cheatsheet.html` (1050 lines)
Most complex JS case. Interactive API test runner: 8 accordion items each with a curl command, copy button, run button, and live result panel. Makes real `fetch()` calls to `localhost:4321`. Clipboard API, DOM manipulation, JSON syntax highlighting formatter, sequential test runner with `setTimeout`. Requires a running server. This is a Type C (complex/unknown) outlier.

### 4. `dev-commands-cheatsheet.html` (537 lines)
Static cheatsheet. 2×2 grid of command sections (colour-coded by category), setup flow with numbered steps, workspace note. No JS. Includes `@media print` styles. Standard card-on-brown shell. Exemplifies the "reference card" content type — dense information, no interactivity.

### 5. `checklist-risk-matrix.html` (495 lines)
Risk assessment card. Gradient summary banner below header, vertical list of risk cards with severity colour-coding (medium/low), severity scale bar visualization. No JS. Includes `@media print`. Demonstrates the summary-banner pattern and colour-semantic card variants (border-left accent).

---

## Migration Assessment

### Type Classification

| Type | Criteria | Estimated count |
|------|----------|----------------|
| **Type A** — Pure HTML/CSS, no JS | Static content only | ~316 (95%) |
| **Type B** — Known JS patterns | Copy-to-clipboard, CSS class toggle, `@keyframes` | ~15 (4.5%) |
| **Type C** — Complex/unknown | Live `fetch()` to dev server, complex async state | 2 (0.5%) |

### Mechanical Migration Complexity: **Low**

The corpus is structurally homogeneous. 95% of files are pure HTML+CSS with no runtime dependencies. The remaining 5% use only clipboard API and simple DOM toggling.

### What the Harness Must Provide

For the vast majority (Type A/B) to render correctly in FliDeck:

1. **Font delivery** — Either pass-through to `fonts.googleapis.com` (requires internet), or bundle Bebas Neue, Oswald, Roboto, and Roboto Mono locally. Without fonts, slides degrade to system sans-serif (layout holds, brand identity breaks).

2. **No iframe sandboxing that blocks clipboard** — 14 files use `navigator.clipboard.writeText()`. If FliDeck renders slides in sandboxed iframes, the `allow="clipboard-write"` permission must be granted.

3. **No origin restrictions on inline JS** — All JS is same-document inline code. Standard iframe rendering is sufficient; no module bundler or CSP relaxation needed beyond clipboard.

4. **Viewport passthrough** — Slides use `min-height: 100vh` and flex centering. The harness iframe must not constrain height or the card layout will clip. Full-height iframe or scroll-enabled rendering required.

5. **For Type C slides (2 files):** The live API test runners require `http://localhost:4321` to be reachable from the browser. The harness cannot provide this — it is an external server dependency. These slides should be documented as "requires dev server" in the manifest, or displayed with a warning overlay when the server is unavailable.

### What the Harness Could Optionally Provide

- **Shared font `<link>` injection** — Eliminate 333 redundant font loads by injecting one shared font stylesheet before the slide document loads.
- **Shared copy-to-clipboard utility** — A `window.copyCommand` function injected by the harness frame would let the 14 affected slides reference it without embedding the implementation.
- **Offline font bundle** — Solves the internet dependency for air-gapped or offline presentation use.

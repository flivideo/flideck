# Batch 1 Corpus Analysis — 6 Presentations

**Date:** 2026-03-06
**Root:** `/Users/davidcruwys/dev/ad/brains/brand-dave/presentation-assets/`
**Scope:** agent-inventory, ansible-agentic-os, appystack, bmad-agents, claude-code-system-prompt, claude-code-system-prompt-v1

---

## 1. agent-inventory

### File Count
- **HTML files:** 9
- **Files with inline `<script>`:** 2 (`decision-tree.html`, `slides.html`)

### External Dependencies
- **Fonts:** `Bebas Neue`, `Oswald:wght@400;600`, `Roboto:wght@400;500;700`, `Roboto Mono` — loaded via Google Fonts CDN
- **CDN scripts:** None

### CSS Variable System
Top 15 by usage frequency:

| Count | Variable |
|-------|----------|
| 83 | `--brand-brown` |
| 77 | `--brand-gold` |
| 52 | `--brand-yellow` |
| 48 | `--white` |
| 28 | `--brand-gray` |
| 16 | `--bridge-purple` |
| 12 | `--green` |
| 12 | `--brand-blue` |
| 11 | `--purple` |
| 11 | `--orange` |
| 10 | `--webcam-width` |
| 9 | `--info-panel-width` |
| 7 | `--header-height` |
| 7 | `--gather-teal` |
| 6 | `--brand-cream` |

Core brand tokens (`--brand-brown: #342d2d`, `--brand-gold: #ccba9d`, `--brand-yellow: #ffde59`) match bmad-poem exactly. Semantic tokens (`--bridge-purple`, `--gather-teal`) are presentation-specific.

### Component Types
- **Header + Logo:** `AppyDave` wordmark (Bebas Neue, `--brand-gold`/`--brand-yellow` split) repeated in every slide
- **Cards with coloured gradient headers:** Status-coded by type (green=active, blue=recent, orange=stale, purple=template)
- **Stats grid:** 4-column `ext-stat` grid with large Bebas Neue numbers
- **Code blocks:** Dark `--brand-brown` background, `Roboto Mono`, syntax-coloured spans
- **Folder structure displays:** Monospace, colour-coded folders/files
- **Explanation lists:** Label/description pairs with mono badge labels
- **Project dashboard:** `repeat(auto-fill, minmax(320px, 1fr))` card grid
- **Decision tree (JS):** Interactive branching paths driven by JS state machine — `currentLevel`, `path[]`, `selectOption()` function
- **Multi-slide scrolling (JS):** `slides.html` uses `querySelectorAll('.slide')`, keyboard navigation, `--webcam-width`/`--info-panel-width` CSS vars suggesting webcam overlay layout
- **Fixed-position logo:** 2 files use `position: fixed` for the AppyDave wordmark while content scrolls
- **Tag/badge chips:** Inline colour-coded tags (`highlight-tag bmad`, `highlight-tag workflow`)

### Layout
- Body: `min-height: 100vh`, `background: var(--brand-brown)`
- Container: `max-width: 1100–1400px`, centred
- `@media` breakpoints: 2 files

### Migration Type Estimate
**Type B** (component-harness extractable) for most slides; **Type C** (scripted/interactive) for `decision-tree.html` and `slides.html` which contain self-managed JS navigation.

### Unique / Surprising
- `slides.html` implements its own full slide-navigation system (keyboard, info-panel toggle, webcam overlay sizing) — this is a presentation inside a presentation. The harness needs to either host it transparently or detect and disable conflicting nav.
- `--webcam-width` and `--info-panel-width` CSS vars suggest recording-mode UI: slides were designed to display alongside a webcam feed.
- `decision-tree.html` is a fully interactive branching widget, not a static slide.

---

## 2. ansible-agentic-os

### File Count
- **HTML files:** 19 (1 `presentation.html` + 18 `slide-NN-*.html`)
- **Files with inline `<script>`:** 0

### External Dependencies
- **Fonts:** None — no Google Fonts link
- **CDN scripts:** None

### CSS Variable System
None. Zero CSS variable usage across all 19 files.

### Component Types
Every HTML file is a minimal image wrapper:

```html
<!DOCTYPE html>
<html>
<head>
  <title>...</title>
  <style>
    body { margin: 0; background: #000; display: flex; align-items: center; justify-content: center; height: 100vh; }
    img { max-width: 100%; max-height: 100vh; object-fit: contain; }
  </style>
</head>
<body>
  <img src="slide-NN-name.png" alt="...">
</body>
</html>
```

All visual content lives in `.png` files. HTML is purely a fullscreen display wrapper.

### Layout
- `height: 100vh`, `display: flex`, `align-items: center`, `justify-content: center`
- Black background, `object-fit: contain`

### Migration Type Estimate
**Type A** (trivial). These are the simplest possible slides. The harness just needs to render the HTML and the `<img>` fills the viewport. No CSS variable extraction, no font dependencies, no JS.

### Unique / Surprising
- `presentation.html` (the entry point) displays `slide-01-*.png` — it is not an index or gallery, just the first slide. FliDeck's multi-file presentation discovery is essential here since there is no built-in navigation.
- The gap between this and every other presentation in the corpus is enormous. This is a "photographic" presentation workflow (likely Keynote/PowerPoint exported to PNG, then wrapped).
- No responsive breakpoints, no semantic HTML, no CSS custom properties — zero harness surface.

---

## 3. appystack

### File Count
- **HTML files:** 35
- **Files with inline `<script>`:** 0

### External Dependencies
- **Fonts:** `Bebas Neue`, `Oswald:wght@400;600–700`, `Roboto:wght@400;500;700`, `Roboto Mono` via Google Fonts
- **CDN scripts:** None

### CSS Variable System
Top 15 by usage frequency:

| Count | Variable |
|-------|----------|
| 246 | `--brand-brown` |
| 167 | `--brand-gold` |
| 139 | `--brand-yellow` |
| 122 | `--white` |
| 99 | `--success-green` |
| 86 | `--item-color` |
| 85 | `--doc-blue` |
| 78 | `--item-bg` |
| 71 | `--brand-gray` |
| 63 | `--runtime-purple` |
| 61 | `--muted-gray` |
| 59 | `--pain-red` |
| 46 | `--issue-amber` |
| 28 | `--success-green-bg` |
| 23 | `--issue-amber-bg` |

Two patterns here: (1) the invariant brand tokens identical to bmad-poem; (2) a semantic "traffic-light" set (`--success-green`, `--pain-red`, `--issue-amber`, `--runtime-purple`, `--doc-blue`) that appears in multiple presentations. `--item-color` and `--item-bg` are inline-style CSS variables used for per-instance theming of finding/item cards.

### Component Types
- **Hero banner:** Full-width gradient `--brand-gold` → `--brand-yellow`, Bebas Neue h1
- **Stats grid:** 3-column `stat-card` with bordered `--brand-gold` outline and large Bebas Neue numbers
- **Tech grid:** 5-column icon-free tech stack listing
- **Footer bar:** `--brand-yellow` bar with label/value pairs
- **White card with brown header:** `appystack/deep-dive-*` pattern — full-page white card, `--brand-brown` header, content inside
- **Finding cards with inline CSS vars:** `border-left: 4px solid var(--item-color)` and `background: var(--item-bg)` set via `style=` attributes to apply per-item semantic colour
- **Warning banner:** Gradient red icon+text block
- **Callout grid (more-callout):** Dark `--brand-brown` background, dotted list in 2-column grid
- **Assessment items:** Repeated `assessment-item` class
- **Slide tag:** `slide-tag` classification badge
- **`@media` breakpoints:** 25 of 35 files include at least one breakpoint — most responsive presentation in the batch

### Layout
- Dual body modes: some slides use `display: flex; align-items: center; justify-content: center` (centred card), others use `padding: 40–48px` (full-page scroll)
- `max-width: 900–1200px` containers
- `@media (max-width: 700px)` grid collapses

### Migration Type Estimate
**Type B** throughout. No JS, well-structured CSS, consistent brand tokens. Largest and most varied presentation in the batch — good migration stress test.

### Unique / Surprising
- The `--item-color` / `--item-bg` inline CSS variable pattern is a notable technique: individual `<div style="--item-color: var(--pain-red); --item-bg: var(--pain-red-bg);">` instances inherit their colour from the parent scope. This is invisible to a harness extraction unless the harness preserves inline `style` attributes.
- Two separate naming conventions for "index" slides: `index-ralph.html` and `index-build.html` suggest sub-grouping within a single presentation folder — exactly the use case for FliDeck tabs (FR-22).
- `@media print` rule appears in some slides, suggesting these were designed for PDF export as well as screen display.

---

## 4. bmad-agents

### File Count
- **HTML files:** 16
- **Files with inline `<script>`:** 1 (`pipeline.html`)

### External Dependencies
- **Fonts:** `Bebas Neue`, `Oswald:wght@400;600`, `Roboto:wght@400;500;700`, `Roboto Mono:wght@400` via Google Fonts
- **CDN scripts:** None

### CSS Variable System
Top 15 by usage frequency:

| Count | Variable |
|-------|----------|
| 218 | `--brand-brown` |
| 148 | `--brand-gold` |
| 112 | `--white` |
| 88 | `--brand-yellow` |
| 74 | `--brand-gray` |
| 31 | `--brand-cream` |
| 25 | `--brand-brown-light` |
| 23 | `--dev-accent` |
| 16 | `--custom-accent` |
| 14 | `--dev-green` |
| 13 | `--planning-blue` |
| 10 | `--code-green` |
| 9 | `--qa-accent` |
| 9 | `--brand-brown-mid` |
| 7 | `--dev-accent-light` |

Per-agent accent colour pattern: `--dev-accent: #8b5cf6` (purple) for Bob the Scrum Master's card, different values for other agents. `--brand-cream: #e8dcc8` extends the base brand palette. `--brand-brown-light` and `--brand-brown-mid` are tonal variations of the primary.

### Component Types
- **Agent profile cards:** Hero with circular numbered avatar, role badge, phase badge, sequence badge, tagline
- **Quick stats grid:** 4-column `stat-box` with label/value (monospace values)
- **Key command block:** Highlighted mono command with description text
- **Trigger grid:** 2-column "Use When / Skip When" pattern with bullet lists
- **Questions list:** Dark brown background, circular numbered question icons
- **Story card preview:** Structured output template mock-up inside a bordered card
- **Quality grid:** 2-column good/weak pattern with green/red left borders and check/cross list markers
- **Handoff flow diagram:** Linear agent → arrow → agent chain with avatar circles and label spans — pure CSS, no SVG
- **First-dev callout:** Accent-coloured left-border callout box
- **Example prompt:** Dark `#1e1e1e` code block, syntax-coloured with `.comment`, `.command`, `.key-cmd` spans
- **Pipeline scroll snap (JS):** `pipeline.html` uses `scroll-snap-type: y mandatory` on `<html>`, position-fixed logo + nav dots + slide counter, JS scroll listener to update active dot state

### Layout
- Most slides: centred flex, `max-width: 900px` white card on brown background
- `pipeline.html`: full-viewport scroll-snap with fixed chrome — a self-contained slideshow
- `@media (max-width: 700px)`: 14 files include responsive breakpoints

### Migration Type Estimate
**Type B** for all agent profile cards; **Type C** for `pipeline.html` (scroll-snap + JS navigation creates harness conflict risk).

### Unique / Surprising
- The scroll-snap pipeline in `pipeline.html` creates the same conflict risk as `agent-inventory/slides.html`: both implement their own scroll-based navigation that will fight FliDeck's iframe sizing.
- Hyperlinks between slides: `bob.html` footer contains `<a href="sarah.html">← Sarah</a>` and `<a href="pipeline.html">Pipeline →</a>`. These relative href links work when the HTML is served from the same folder (which FliDeck does). This is a valid cross-slide navigation pattern that the harness should not break.
- Per-agent accent colour (`--dev-accent`) means each agent card has a visually distinct theme within the same template.

---

## 5. claude-code-system-prompt

### File Count
- **HTML files:** 10
- **Files with inline `<script>`:** 1 (`index.html`)

### External Dependencies
- **Fonts:** `Bebas Neue`, `Oswald:wght@400;500;600`, `Roboto:wght@300;400;500`, `Roboto Mono:wght@400;500` via Google Fonts
- **CDN scripts:** None

### CSS Variable System
Top 15 by usage frequency:

| Count | Variable |
|-------|----------|
| 34 | `--brand-gold` |
| 30 | `--brand-brown` |
| 23 | `--white` |
| 17 | `--doc-blue` |
| 15 | `--runtime-purple` |
| 13 | `--brand-yellow` |
| 12 | `--item-color` |
| 10 | `--issue-amber` |
| 9 | `--success-green` |
| 8 | `--item-bg` |
| 5 | `--pain-red` |
| 3 | `--muted-gray` |
| 2 | `--secondary-teal` |
| 1 | `--force` |
| 1 | `--brand-gray` |

Same core brand tokens; same semantic traffic-light set as appystack. The inline `--item-color`/`--item-bg` pattern is shared. `--secondary-teal` appears uniquely here.

### Component Types
- **White background slides:** Body background is `var(--white)` for most slides — inverted from the brown-background style of other presentations
- **Three-layer stack diagram:** `fnd-three-layers.html` uses CSS hover animation (`transform: translateX(8px)`) on layer cards with coloured gradients and tag clouds
- **Tool item cards:** `tool-item` pattern with `tool-name`, `tool-purpose`, `category-badge`, `user-config-badge`, `priority-badge`
- **Assessment items:** `assessment-item` pattern shared with appystack
- **Layer tags:** Mono font pill tags (`layer-tag`) in flex-wrap layout
- **Point lists:** `point` class items
- **Cheatsheet grid:** `ref-cheatsheet.html` dense reference card layout
- **Index with fetch+JS:** `index.html` fetches `index.json` to dynamically populate tabbed slide galleries (foundation, capabilities, protocols, customization groups)

### Layout
- Dual background modes: white body (`fnd-three-layers.html`) vs coloured accent body (`pip-step1-request.html` uses `background: var(--doc-blue)` full-bleed)
- `fnd-three-layers.html` uses `display: flex; flex-direction: column; justify-content: center` with full-height body
- No `@media` breakpoints in this presentation — desktop-only layout

### Migration Type Estimate
**Type B** for the 9 static slides; **Type C** for `index.html` which dynamically fetches `index.json` and builds a tab UI — this will only work if FliDeck serves the file from the correct folder root (which it does via the assets endpoint).

### Unique / Surprising
- `index.html` uses `fetch('index.json')` — a relative URL request. This will succeed when served via FliDeck's static serving but will fail if FliDeck ever tries to serve the HTML as a blob or data URL.
- The presentation has two distinct visual modes: white-background conceptual diagrams (`fnd-*`) and coloured-background step slides (`pip-*`). This is intentional information hierarchy — white = foundational concepts, colour = pipeline steps.
- `--force` CSS variable appears once — likely a debugging artefact.

---

## 6. claude-code-system-prompt-v1

### File Count
- **HTML files:** 16
- **Files with inline `<script>`:** 2 (`index.html`, `ref-decision-tree.html`)

### External Dependencies
- **Fonts:** `Bebas Neue`, `Oswald:wght@400;600`, `Roboto:wght@400;500;700`, `Roboto Mono:wght@400` via Google Fonts
- **CDN scripts:** None

### CSS Variable System
Top 15 by usage frequency:

| Count | Variable |
|-------|----------|
| 82 | `--brand-brown` |
| 72 | `--brand-gold` |
| 57 | `--white` |
| 54 | `--brand-yellow` |
| 51 | `--brand-gray` |
| 7 | `--runtime-purple` |
| 7 | `--doc-blue` |
| 4 | `--success-green` |
| 1 | `--group-reference` |
| 1 | `--group-pipeline` |
| 1 | `--group-instructions` |
| 1 | `--group-identity` |
| 1 | `--group-foundation` |
| 1 | `--group-customization` |
| 1 | `--group-capabilities` |

The `--group-*` variables (each appearing once) are per-category accent colours for the index gallery — they map to the tabbed section names (foundation, capabilities, instructions, etc.). This is the same per-instance token pattern as `--item-color`/`--item-bg` but for group-level theming.

### Component Types
- **Fixed-position logo:** 13 of 16 files use `position: fixed` — the AppyDave logo is anchored while slide content scrolls
- **Step-cards with coloured full-bleed backgrounds:** `pip-step*` slides use `background: var(--doc-blue)` on `<body>`, white card inside
- **Detail items:** `detail-item` with `border-left: 3px solid var(--brand-gold)` and `.highlight` variant
- **Code example blocks:** `code-example` in brown on white card, `code-text` monospace
- **Parameter mono tags:** `param-mono` class in cheatsheet/tool reference slides
- **Tool badge list:** `tool-badge`, `category-tool` pattern
- **Skill name items:** `skill-item`, `skill-name`
- **Constraint tags:** `constraint-tag` chips
- **Decision tree (JS):** `ref-decision-tree.html` implements a full interactive branching tree (`tree` object with nested `question`/`options`/`next` graph)
- **Index with fetch+JS:** Same `fetch('index.json')` pattern as v1

### Layout
- `@media (max-width: 700px)`: 12 of 16 files — most responsive after appystack
- Fixed logo creates stacking context issues if FliDeck injects harness chrome over the iframe

### Migration Type Estimate
**Type B** for 14 static slides; **Type C** for `index.html` (fetch-based) and `ref-decision-tree.html` (JS interactive tree).

### Unique / Surprising
- This is a v1 → current evolution from `claude-code-system-prompt`: the v1 has 6 more slides (the `pip-step*` detailed pipeline breakdowns) and the `ref-decision-tree.html` interactive tool. The current version consolidated. Comparing the two reveals intentional scope reduction.
- Fixed-position elements in 13 files: the AppyDave logo is `position: fixed; top: 24px; left: 32px` inside an iframe. This will render on top of any harness chrome that is also in the top-left. The harness must account for this or risk visual collision.
- The decision tree JS uses a named `tree` global object — if the harness ever injects scripts into the iframe document, name collision is a risk.

---

## Cross-Presentation Summary

### Patterns Shared Across All 5 HTML-Native Presentations

1. **Universal brand token set.** Every HTML-native presentation uses the identical core four: `--brand-brown: #342d2d`, `--brand-gold: #ccba9d`, `--brand-yellow: #ffde59`, `--white: #ffffff`. These are the stable harness contract. Any shared stylesheet injected by the harness must avoid re-declaring these. The values match `bmad-poem` exactly — this is a stable design system.

2. **Google Fonts CDN dependency.** All 5 HTML-native presentations load the same 4 families: `Bebas Neue` (display/logo), `Oswald` (labels/section titles), `Roboto` (body text), `Roboto Mono` (code/badges). Ansible-agentic-os is the sole exception (image-only). The harness can preload these fonts in a shared `<link>` in the host page to eliminate per-slide network requests, but must not remove the in-slide `<link>` tags without first confirming it loads them itself.

3. **No third-party CDN scripts.** Zero presentations load any external JS library (no jQuery, no Chart.js, no D3, no highlight.js). All interactivity is vanilla JS. This is excellent for security and sandboxing — no CSP complications from script-src.

4. **AppyDave wordmark logo.** Every slide (except ansible image wrappers) includes `<span class="appy">Appy</span><span class="dave">Dave</span>` in Bebas Neue. Placement varies: some are in a `.header` block, some are `position: fixed`. The harness must not strip these — they are content, not chrome.

5. **Semantic "traffic-light" colour set.** `--doc-blue: #3b82f6`, `--runtime-purple: #8b5cf6`, `--success-green: #22c55e`, `--issue-amber: #f59e0b`, `--pain-red: #ef4444` appear across appystack, bmad-agents, claude-code-system-prompt, and claude-code-system-prompt-v1. These are consistently named and valued — candidate for a shared harness-level custom property sheet.

### What Differs Across Presentations

| Dimension | agent-inventory | ansible-agentic-os | appystack | bmad-agents | cc-system-prompt | cc-system-prompt-v1 |
|---|---|---|---|---|---|---|
| Background | Brown | Black | Brown+White | Brown | White | Blue accent |
| JS interactivity | 2 files | 0 | 0 | 1 file | 1 file | 2 files |
| JS type | Nav + Decision tree | — | — | Scroll-snap nav | Fetch+tab builder | Fetch+tab builder + Decision tree |
| Responsive @media | 2/9 | 0/19 | 25/35 | 14/16 | 0/10 | 12/16 |
| Scroll-snap | 0 | 0 | 0 | 1 | 0 | 0 |
| Fixed-position elements | 2 | 0 | 0 | 1 | 0 | 13 |
| Inter-slide hrefs | 0 | 0 | 0 | Yes (footer nav) | 0 | 0 |
| Fetch('index.json') | 0 | 0 | 0 | 0 | 1 | 1 |

### Top 3 Cross-Presentation Findings

**Finding 1: The "Type C" isolation problem is real and varied.**
Across 6 presentations, 6 distinct JS behaviours exist that create harness conflict risk: (a) custom scroll-nav with keyboard listeners, (b) scroll-snap-type multi-section pipelines, (c) `fetch('index.json')` relative-URL gallery builders, (d) interactive decision trees with global JS state, (e) fixed-position elements that overlap potential harness chrome, and (f) inter-slide `<a href="...">` navigation. The harness cannot treat all slides as passive iframes — it needs a JS-conflict detection layer or must rely on strict iframe sandbox boundaries.

**Finding 2: Ansible-agentic-os is an entirely different asset type.**
All 19 HTML files are 13-line PNG wrappers with `height: 100vh` black backgrounds. There are no brand tokens, no fonts, no CSS variables. This is not a failure of standardisation — it is a deliberate workflow (likely Keynote/Figma → PNG export → HTML wrapper). The harness must handle this "image slide" type as a first-class presentation type, not an edge case. The migration estimate for the other 5 is complexity B; for this one it is zero.

**Finding 3: The brand token system is stable enough to extract as a shared constant.**
The six CSS custom properties that appear in 4+ presentations with identical hex values (`--brand-brown`, `--brand-gold`, `--brand-yellow`, `--white`, `--brand-gray`, and the traffic-light set) form a de-facto design token contract. These values have not drifted across at least two versions of the same presentation (cc-system-prompt vs cc-system-prompt-v1). The harness can safely inject a minimal `<style>:root{...}</style>` with these tokens as a fallback layer without breaking any slide — all slides re-declare them anyway, so the cascade will override the harness injection with the same values.

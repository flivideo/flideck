# Batch 2 Corpus Analysis — FliDeck Harness Migration

**Date:** 2026-03-06
**Analyst:** Claude Sonnet 4.6
**Root:** `/Users/davidcruwys/dev/ad/brains/brand-dave/presentation-assets/`
**Scope:** 9 presentation folders + 2 problem folders

---

## Summary Table

| Folder | HTML files | JS (inline) | Fonts | Brand match | Migration type |
|--------|-----------|-------------|-------|-------------|----------------|
| claude-plugin-marketplace | 8 | 0 | Bebas Neue, Oswald, Roboto, Roboto Mono | Exact | A |
| claudemas-12-days | 10 | 3 | Bebas Neue, Oswald, Roboto, Roboto Mono, Press Start 2P | Mixed (exact + arcade variant) | B |
| claudinglab-anthropic-meetup | 9 | 2 | Bebas Neue, Oswald, Roboto, Roboto Mono | Exact | A |
| color-exploration | 2 | 1 | Bebas Neue, Oswald, Roboto | Exact (dark bg variation) | A |
| consultants-plugin | 6 | 2 | Bebas Neue, Oswald, Roboto, Roboto Mono | Deviant — warm brown palette | B |
| dam-overview | 19 | 1 | Bebas Neue, Oswald, Roboto, JetBrains Mono, Space Grotesk | Exact | A |
| n8n-story-gen | 6 | 0 | Bebas Neue, Oswald, Roboto, Roboto Mono | Mixed (exact + warm deviant) | B |
| somatic-healing | 4 | 2 | Bebas Neue, Oswald, Roboto | Exact (Beauty & Joy brand) | A |
| zero-to-app | 6 | 0 | Bebas Neue, Oswald, Roboto, Roboto Mono, Press Start 2P, Noto Sans Thai | Mixed (exact + arcade variant) | B |

---

## Presentation-by-Presentation Analysis

### 1. claude-plugin-marketplace

**File count:** 8 HTML, 0 external scripts, 0 inline JS files with `<script>` tags
(Note: grep for `<script>` returned 0 — all slides appear to be pure CSS/HTML with no JS)

**External dependencies:**
- Google Fonts: `Bebas Neue`, `Oswald:400;600`, `Roboto:400;500;700`, `Roboto Mono`
- No CDN scripts

**CSS variable system:**
```
--brand-brown: #342d2d  (exact match)
--brand-gold:  #ccba9d  (exact match)
--brand-yellow: #ffde59 (exact match)
--brand-gray:  #595959
--white:       #ffffff
```
Full AppyDave brand match. Top variables by usage: `--brand-brown` (63), `--brand-gold` (53), `--brand-yellow` (30).

**Component types visible:**
- Index/asset gallery page (`index.html`) — header with logo `<span class="appy">Appy</span><span class="dave">Dave</span>`, stats bar, asset grid cards
- Cheatsheet (`cheatsheet.html`) — white container card on brown bg, print-ready layout, category headers with color-coded borders
- Decision tree (`decision-tree.html`) — branching question flow
- Timeline (`timeline.html`) — chronological sequence
- Stats slide (`demo-workflow.html`) — workflow diagram
- Learnings / Distribution slides — reference list format

**Key class vocabulary:** `stat`, `stat-label`, `stat-value`, `item-result`, `item-learning`, `item-action`, `schema-field`, `folder`, `cmd`, `bracket`, `string`, `key`

**Surprising:** All 8 files lack `<script>` tags entirely — this presentation is pure static HTML + CSS, no JavaScript whatsoever. Most complex layouts achieved with CSS grid and flexbox only.

**Migration type: A** — Fully self-contained static HTML, perfect brand match, no JS dependencies. Simplest harness integration.

---

### 2. claudemas-12-days

**File count:** 10 HTML, no external scripts, 3 files with inline JS

**External dependencies:**
- Google Fonts: `Bebas Neue`, `Oswald:400;600`, `Roboto:400;500;700`, `Roboto Mono:400`, `Press Start 2P`
- No CDN scripts

**CSS variable system:**
Two distinct palettes present:

Standard AppyDave palette (majority of files):
```
--brand-brown: #342d2d
--brand-gold:  #ccba9d
--brand-yellow: #ffde59
```

Arcade/dark palette (stage-map, level-select, progress-tracker):
```
--bg-dark:    #1a1a2e
--bg-mid:     #16213e
--bg-light:   #0f3460
--foundation: #8b5cf6
--brain:      #22c55e
--creative:   #f59e0b
--integration: #3b82f6
--finale:     #ef4444
```
These arcade slides reference `--brand-gold` and `--brand-yellow` as "AppyDave brand accents" within comments, treating them as secondary to the dark gaming palette.

**Component types visible:**
- Standard index/asset gallery (`index.html`) — grid of asset cards with badge chips
- Arcade stage map (`arcade-stage-map.html`) — CRT scanline effect via `body::after`, `overflow: hidden`, `95vw/95vh` fullscreen container, stage nodes
- Advent door grid (`arcade-level-select.html`) — 12-door advent calendar layout, `Press Start 2P` font
- Progress tracker (`arcade-progress-tracker.html`) — multi-column day grid with status badges
- Tool cheatsheet (`tech-stack-cheatsheet.html`) — standard branded layout
- Thumbnail concepts (`thumbnail-concepts.html`) — visual thumbnail mockup layouts

**Key class vocabulary:** `api-chip`, `tool-name`, `tool-day`, `door-number`, `day-purpose`, `advent-door`, `hybrid-mini-door`, `slide`, `status-badge`, `tag`

**Surprising:** The arcade slides use `overflow: hidden` on `body` and are fullscreen (`height: 100%`) — they are not scrollable documents but viewport-locked interactive screens. CRT scanline overlay implemented via CSS `repeating-linear-gradient`. This is a fundamentally different rendering mode that FliDeck's iframe harness must accommodate.

**Migration type: B** — Mixed: standard slides are Type A. Arcade slides require viewport-locked fullscreen iframe treatment. 3 files with JS (likely interactive).

---

### 3. claudinglab-anthropic-meetup

**File count:** 9 HTML (including 1 `.json` file — `engineering-paradigms.json`), 2 files with inline JS

**External dependencies:**
- Google Fonts: `Bebas Neue`, `Oswald:400;600`, `Roboto:400;500;700`, `Roboto Mono:400`
- No CDN scripts

**CSS variable system:**
```
--brand-brown: #342d2d  (exact match)
--brand-gold:  #ccba9d  (exact match)
--brand-yellow: #ffde59 (exact match)
--brand-blue:  #2E91FC
--brand-gray:  #595959
--white:       #ffffff
```
Full AppyDave brand match. Top: `--brand-brown` (103), `--brand-gold` (70), `--brand-yellow` (58).

**Component types visible:**
- Index asset gallery (`index.html`) — standard header + section-grouped asset cards
- Decision tree (`decision-tree.html`) — JavaScript-powered multi-step question flow with breadcrumb navigation; `breadcrumb`, `option-btn` pattern with JS state machine
- Slides deck (`slides.html`) — multi-slide scrollable deck
- Comparison cards (`comparison-cards.html`) — side-by-side paradigm comparison
- Evolution timeline (`evolution-timeline.html`) — era-based horizontal timeline
- Framework cheatsheet — reference card layout
- Index card prototype (`index-card-prototype.html`) — card-based note format
- Introduction card — single featured card slide

**Key class vocabulary:** `connector`, `asset-card`, `option`, `nav-dot`, `branch`, `tagline`, `pillar-example`, `era`, `section-title`, `logo`, `dave`, `appy`

**Non-HTML asset:** `engineering-paradigms.json` — raw data file, not an HTML slide. FliDeck will include it in asset list but it cannot be rendered as a slide.

**Surprising:** JS decision trees use a pattern of hiding/showing `.question-node` divs via `display:none/block` — no external framework, pure vanilla JS DOM manipulation. The JSON data file sitting alongside HTML slides will appear in FliDeck's asset list as an unrenderable asset.

**Migration type: A** — Standard brand, vanilla JS only. The JSON file needs filtering or handling.

---

### 4. color-exploration

**File count:** 2 HTML, 1 file with inline JS

**External dependencies:**
- Google Fonts: `Bebas Neue`, `Oswald:400;600`, `Roboto:400;500`
- No CDN scripts

**CSS variable system:**
```
--brand-brown: #342d2d  (exact match)
--brand-gold:  #ccba9d  (exact match)
--brand-yellow: #ffde59 (exact match)
--brand-blue:  #2E91FC
--brand-gray:  #595959
--white:       #ffffff
```
Full AppyDave brand match, though both slides use `background: #1a1a1a` (near-black) as the page background rather than `--brand-brown`. This is an intentional design choice for this exploratory asset — darker to better show color swatches.

**Component types visible:**
- Color exploration index (`index.html`) — master palette grid, toggle buttons, color comparison cards with `bb-card`, `palette-swatch`, `toggle-btn` components; JS-driven show/hide of sections
- Reference card layouts (`reference-card-layouts.html`) — extended palette details, candidate card grid with `candidates-grid`, `candidate-card`, `pairing-box` components

**Key class vocabulary:** `pairing-box`, `bb-card`, `palette-swatch`, `comparison-card`, `comparison-preview`, `toggle-btn`, `color-name`, `color-hex`, `color-box`

**Surprising:** This is a design tool / reference presentation, not a content slide deck. It documents the AppyDave brand color system itself. The `toggle-btn` JS interaction is lightweight — just class toggling. The dark background (`#1a1a1a`) deviates from `--brand-brown` for functional reasons (better color swatch visibility).

**Migration type: A** — 2 files, minimal JS, standard brand.

---

### 5. consultants-plugin

**File count:** 6 HTML, 2 files with inline JS

**External dependencies:**
- Google Fonts: `Bebas Neue`, `Oswald:400;600`, `Roboto:400;500;700`, `Roboto Mono:400;600`
- Font link uses `rel="preconnect"` preload pattern (more modern than other presentations)
- No CDN scripts

**CSS variable system:**
This presentation uses a **different warm-brown palette** — a notable deviation from the standard AppyDave brand:
```
--brand-brown: #3E2723   (darker, more red-brown — NOT standard #342d2d)
--brand-gold:  #B8860B   (darker gold — NOT standard #ccba9d)
--brand-yellow: #FFD700  (pure gold — NOT standard #ffde59)
--brand-cream: #FFF8DC   (warm cream — not present in standard palette)
```
Some files also include `--brand-light-brown: #5D4037`, `--spacing-md/sm/lg/xl/2xl` spacing tokens.

`index.html` uses `background: linear-gradient(135deg, var(--brand-cream) 0%, #FFF 100%)` — a light-on-cream layout, visually distinct from the usual dark-brown-background presentations.

**Component types visible:**
- Index gallery (`index.html`) — cream/white background, card grid with intro block
- Decision tree (`decision-tree.html`) — fullscreen JS-driven expert selector; fixed-position logo, breadcrumb, reset button; viewport-centered question flow
- Architecture slides (`architecture-slides.html`) — multi-step flow diagram
- Cheatsheet (`cheatsheet.html`) — reference table format with spacing token system
- Expert cards (`expert-cards.html`) — persona card grid
- Showcase (`showcase.html`) — feature showcase layout

**Key class vocabulary:** `section`, `flow-step`, `section-title`, `expert-name`, `expert-card`, `card-title`, `card-content`, `option-btn`, `command-box`, `result-section`

**Surprising:** This is the only presentation in the corpus with a fundamentally different color palette — warm dark-brown (#3E2723) vs. standard charcoal-brown (#342d2d), and using `--brand-cream` as a prominent light background color. The `decision-tree.html` is fullscreen interactive with viewport-centered layout and JS state management (fixed-position nav elements), requiring the same iframe treatment as arcade slides.

**Migration type: B** — Deviant brand palette requires documentation. Fullscreen interactive files need iframe treatment.

---

### 6. dam-overview

**File count:** 19 HTML (largest presentation in this batch), 1 file with inline JS

**External dependencies:**
- Google Fonts: `Bebas Neue`, `Oswald:400;600`, `Roboto:400;500;700`, `JetBrains Mono:400;500`, `Space Grotesk:400;500;600;700`
- Most varied font stack in the corpus — `JetBrains Mono` and `Space Grotesk` appear only here

**CSS variable system:**
```
--brand-brown: #342d2d  (exact match)
--brand-gold:  #ccba9d  (exact match)
--brand-yellow: #ffde59 (exact match)
--brand-blue:  #2E91FC
--brand-gray:  #595959
--white:       #ffffff
```
Full AppyDave brand match. Highest variable counts in the batch: `--brand-brown` (171), `--brand-gold` (128), `--brand-yellow` (73). Also uses contextual color tokens: `--dam-green`, `--cloud-red`, `--border`, `--text-dim`, `--bg-panel`, `--bg-dark`.

**Component types visible:**
- Index gallery (`index.html`) — standard header + 2-col asset grid
- Video slides (`slides.html`) — scroll-snap fullscreen slide deck (`scroll-snap-type: y mandatory`, `height: 100vh` per slide); designed for teleprompter use with hook slides having larger text and top-positioned content
- Solution slides (`solution-vibe-code.html`) — multi-slide format with white page cards on brown bg
- Cheatsheets × 3 (`cheatsheet.html`, `cheatsheet-2.html`, `cheatsheet-3.html`) — reference table formats
- Brand cards (`brand-list-cards.html`, `brand-list-dashboard.html`, `brand-list-terminal.html`) — terminal/dashboard aesthetic variants
- Cost comparison charts (`cloud-costs-comparison.html`, `cloud-costs-growth.html`, `cloud-costs-dam-alternative.html`) — data visualization tables
- Storage tiers, 555 challenge/channels/principles — reference information slides

**Key class vocabulary:** `cmd`, `label`, `cmd-desc`, `cmd-code`, `brand-name`, `stat`, `stat-label`, `stat-value`, `section-title`, `dave`, `appy`, `asset-type`, `asset-title`, `asset-info`, `asset-desc`

**Surprising:** `JetBrains Mono` and `Space Grotesk` fonts appear only in this presentation. The scroll-snap slides format (`slides.html`, `solution-vibe-code.html`) uses CSS scroll-snap for a native presentation feel within a single HTML file — FliDeck must not add additional scroll containers that would conflict. With 19 slides this is by far the largest in the batch.

**Migration type: A** — Standard brand, minimal JS, but scroll-snap slides require careful iframe height handling.

---

### 7. n8n-story-gen

**File count:** 6 HTML, 0 files with inline JS

**External dependencies:**
- Google Fonts: `Bebas Neue`, `Oswald:400;500;600`, `Roboto:300;400;500`, `Roboto Mono:400;500`
- Multiple weight variants loaded (more granular than other presentations)
- No CDN scripts

**CSS variable system:**
Two palette variants present:

Standard AppyDave (index, 05-tech-stack, 06-stats):
```
--brand-brown: #342d2d
--brand-gold:  #ccba9d
--brand-yellow: #ffde59
```

Warm brown deviant (`data-flow.html`, `async-pattern.html`, `execution-timeline.html`):
```
--brand-brown: #8B4513   (saddle brown — strong deviation)
--brand-gold:  #DAA520   (goldenrod — strong deviation)
--brand-yellow: #FFD700  (pure gold)
--brand-cream: #F5DEB3   (wheat)
```
The deviant slides use `background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)` with light-on-dark layout.

Contextual tokens: `--data-blue`, `--success-green`, `--node-color`, `--decision-amber`, `--process-purple`, `--output-green`, `--node-wait`, `--node-transform`, `--node-logic`

**Component types visible:**
- Index (`index.html`) — standard header with slide-grid navigation cards
- Data flow (`data-flow.html`) — vertical flow diagram with connector lines, `flow-container::before` pseudo-element for the connecting line; warm-brown deviant palette
- Async pattern (`async-pattern.html`) — parallel process visualization
- Execution timeline (`execution-timeline.html`) — step-by-step timeline
- Tech stack (`05-tech-stack.html`) — component inventory layout
- Stats (`06-stats.html`) — metric display grid

**Key class vocabulary:** `data-content`, `data-field`, `data-section`, `data-label`, `detail-value`, `detail-label`, `transformation`, `transform-label`, `step-number`, `legend-item`, `stat-value`, `stat-label`

**Surprising:** This presentation has the most varied palette split in the corpus — 3 files use exact AppyDave brand, 3 files use a substantially different warm-brown palette (`#8B4513` vs `#342d2d`). This looks like mid-generation style drift, where a second prompt session produced slides with a different default palette. No JS despite complex flow diagrams (achieved purely with CSS).

**Migration type: B** — Split palette requires documentation; complex CSS-only diagrams should render fine in iframes but represent a brand inconsistency worth flagging.

---

### 8. somatic-healing

**File count:** 4 HTML, 2 files with inline JS

**External dependencies:**
- Google Fonts: `Bebas Neue`, `Oswald:400;600`, `Roboto:400;500;700`
- Smallest font set in the corpus — no Roboto Mono
- No CDN scripts

**CSS variable system:**
```
--brand-brown: #342d2d  (exact match)
--brand-gold:  #ccba9d  (exact match)
--brand-yellow: #ffde59 (exact match)
--brand-blue:  #2E91FC
--brand-gray:  #595959
--white:       #ffffff
```
Full AppyDave brand match. But the index uses `.logo .beauty` and `.logo .joy` (not `.appy` and `.dave`) — this is a **Beauty & Joy brand presentation**, not an AppyDave presentation.

**Component types visible:**
- Index (`index.html`) — Beauty & Joy branded header (`.beauty`, `.joy` logo spans), asset cards grid
- Decision tree (`decision-tree.html`) — JS-driven interactive healer selector with breadcrumb trail, option buttons, result cards, and animated navigation dots
- Cheatsheet (`cheatsheet.html`) — reference modality comparison table
- Slides (`slides.html`) — scrollable multi-slide deck

**Key class vocabulary:** `icon`, `option-btn`, `result-card`, `recommendation`, `also-consider`, `feature`, `question-node`, `options`, `need`, `nav-dot`, `modality`, `arrow`, `animate-in`, `tree-section`

**Surprising:** Despite using AppyDave brand colors exactly, this is a Beauty & Joy brand presentation (Joy's personal brand). The logo markup uses `.beauty`/`.joy` class names. The `decision-tree.html` uses animated entrance effects (`animate-in` class, likely CSS keyframe animations) — the only presentation in this batch to use CSS animations for UI transitions.

**Migration type: A** — Standard rendering, vanilla JS, exact brand colors. The Beauty & Joy branding distinction is a content note only.

---

### 9. zero-to-app

**File count:** 6 HTML (root level; `archive/` and `exploration/` subdirs have additional files not counted), 0 files with inline JS

**External dependencies:**
- Google Fonts: `Bebas Neue`, `Oswald:400;600`, `Roboto:400;500;700`, `Roboto Mono:400;500`, `Press Start 2P`, `Noto Sans Thai:400;700`
- `Noto Sans Thai` appears only in this presentation — unique across the entire corpus

**CSS variable system:**
Two palette variants:

Standard AppyDave (index, timeline, other standard slides):
```
--brand-brown: #342d2d
--brand-gold:  #ccba9d
--brand-yellow: #ffde59
--brand-blue:  #2E91FC
--brand-gray:  #595959
```

Arcade/dark variant (`01-A-level-select.html`, `02-flivideo-ecosystem.html`):
```
--bg-dark:    #1a1a2e
--bg-mid:     #16213e
--bg-light:   #0f3460
--prompt-color: #ccba9d  (maps to --brand-gold)
--vibe-color:  #ffde59   (maps to --brand-yellow)
--context-color: #2E91FC (maps to --brand-blue)
```
The arcade slides alias brand colors through domain-specific names rather than using the brand tokens directly.

**Component types visible:**
- Index gallery (`index.html`) — standard header, section-labeled asset grid
- Arcade level select (`01-A-level-select.html`) — fullscreen CRT arcade screen, `overflow: hidden`, 95vw/95vh container, presenter bar, `Press Start 2P` font, `Noto Sans Thai` for localized content
- Extension mechanisms (`01-B-extension-mechanisms.html`) — reference diagram
- FliVideo ecosystem (`02-flivideo-ecosystem.html`) — ecosystem overview layout
- Plan viewer (`99-plan-viewer.html`) — planning document viewer
- Timeline (`timeline.html`) — development timeline

Also has `archive/` and `exploration/` subdirectories. FliDeck discovers files at root level only; subdirectory HTML files are not part of the active presentation.

**Key class vocabulary:** `meta-tag`, `meta-row`, `meta-label`, `highlight`, `section`, `nav-link`, `spoken-label`, `timeline-item`, `timeline-card`, `step-number`, `card-title`, `card-meta`, `card-header`, `badges`

**Surprising:** `Noto Sans Thai` is the only non-Latin font in the entire corpus — appears in a single file. The level-select file contains comments like `/* Data: slide-01-intro.json → content.greeting */` suggesting a planned data-driven architecture where HTML templates would be populated from JSON files — a pattern not seen elsewhere. This may indicate future evolution toward template-based generation.

**Migration type: B** — Mixed arcade + standard slides; fullscreen arcade screens need iframe treatment; unique font dependency.

---

## Problem Folder Flags

### deck-systems

**Status: No HTML entry point at root level — not discoverable by FliDeck**

**Files at root:**
```
01-pattern-library-extraction-handover.md
02-design-calibration-handover.md
index-grid-patterns.md
scene-deck.md
solo-deck.md
```
All root files are Markdown documents (handover notes, design specs, scene definitions).

**Subdirectory structure:**
```
arcade-deck/
  chiang-mai-dec-2025/     ← contains presentation.html + slide00-20.html (21 HTML files)
  discovery.md
  README.md
  skills-identified.md
scenes/
  webcam-terminal.md
```

The `arcade-deck/chiang-mai-dec-2025/` subdirectory contains 21 HTML files including `presentation.html` (the FliDeck preferred entry point), but it is nested 2 levels deep. FliDeck's discovery mechanism only looks at immediate children of `presentationsRoot`, not nested subdirectories.

**Recommendation:** Either move `arcade-deck/chiang-mai-dec-2025/` to the root of `presentation-assets/` as its own presentation folder, or add a root `index.html` that links to the subdirectory presentation.

---

### dent-kpi-system

**Status: Single file, wrong extension, not discoverable by FliDeck**

**Files:**
```
tmp-01.jpg   (1.0 MB)
```

**Critical finding:** `tmp-01.jpg` is **not an image file**. The `file` command reports it as `HTML document text, ASCII text, with very long lines (61224)`. Content inspection reveals it is a **Google Accounts login page** (`accounts.google.com/v3/signin/`) — a browser screenshot-to-HTML capture or accidental save-as-HTML with wrong extension.

This file is not a presentation asset. It has no AppyDave branding, no brand colors, and no slide content. It appears to be a stale file from an incomplete session where the KPI system presentation was never actually created.

**Recommendation:** Delete `tmp-01.jpg` and create proper presentation content if needed.

---

## Cross-Presentation Summary

### Pattern 1: Uniform Font Stack

All 9 presentations use **Google Fonts only** (no CDN JS libraries, no local font files). The canonical stack is:

```
Bebas Neue          → display/hero headings
Oswald 400;600      → section labels, subtitles, uppercase tags
Roboto 400;500;700  → body text
Roboto Mono         → code, commands, technical strings
```

`Press Start 2P` appears in arcade-themed slides (claudemas-12-days, zero-to-app). `JetBrains Mono` and `Space Grotesk` are dam-overview-only. `Noto Sans Thai` appears in one slide of zero-to-app. All are Google Fonts with standard `<link>` tags — no local font files anywhere.

### Pattern 2: AppyDave Brand as Ground Truth

7 of 9 presentations use the exact canonical AppyDave palette:
- `--brand-brown: #342d2d`
- `--brand-gold: #ccba9d`
- `--brand-yellow: #ffde59`

2 presentations deviate: **consultants-plugin** uses a warmer darker palette (`#3E2723`, `#B8860B`), and **n8n-story-gen** has a 50/50 split between canonical and warm-brown deviant slides. The deviation appears to correlate with generation session boundaries — slides produced in different agent runs default to slightly different values.

The `--brand-gold` variable is the most consistently referenced token across the corpus (appears in every presentation) and is the primary typographic accent color (subtitles, borders, labels).

### Pattern 3: Shared Component Vocabulary

Despite no shared CSS framework, the same component patterns appear independently across all 9 presentations:

| Component pattern | Presentations using it |
|---|---|
| `.logo` with `.appy`/`.dave` spans | 8/9 (somatic-healing uses `.beauty`/`.joy`) |
| `.header` + `.subtitle` | All 9 |
| `.stat` + `.stat-label` + `.stat-value` | 7/9 |
| `.assets-grid` card gallery (index pages) | 8/9 |
| Decision tree with `.option-btn` + breadcrumb | 3/9 |
| Scroll-snap fullscreen slides | 3/9 (dam-overview, zero-to-app, n8n-story-gen) |
| Arcade fullscreen (`overflow:hidden`, 95vw/95vh) | 2/9 (claudemas-12-days, zero-to-app) |
| Command/code blocks with `.cmd`, `.cmd-code` | 3/9 |

### Pattern 4: Zero External JavaScript

Not a single presentation loads any external JavaScript library. No React, no Vue, no Alpine.js, no jQuery, no chart library (D3, Chart.js), no animation library. All interactivity (decision trees, navigation, toggles) is hand-written vanilla JavaScript embedded in `<script>` tags. All data visualizations (flow diagrams, timelines, charts) are pure CSS. This is a significant constraint that simplifies iframe sandboxing considerably.

### Migration Type Breakdown

| Type | Count | Presentations | Rationale |
|---|---|---|---|
| A — Drop-in | 5 | claude-plugin-marketplace, claudinglab-anthropic-meetup, color-exploration, dam-overview, somatic-healing | Standard brand, scrollable or static layout, vanilla JS or no JS |
| B — Needs notes | 4 | claudemas-12-days, consultants-plugin, n8n-story-gen, zero-to-app | Contains arcade/fullscreen slides, palette deviation, or mixed layout modes |
| C — Blocked | 0 | — | No presentations require external libraries that would break in iframe |

### Overall Component Vocabulary (Corpus-Wide Top Terms)

Ranked by cross-presentation frequency:

1. `stat` / `stat-label` / `stat-value` — universal metric display pattern
2. `logo` / `appy` / `dave` — brand identity block
3. `header` / `subtitle` — page header structure
4. `section-title` — content section labeling
5. `cmd` / `cmd-code` / `cmd-desc` — command reference blocks
6. `option-btn` — decision tree choice buttons
7. `nav-dot` — slide progress indicator
8. `icon` — decorative emoji/icon wrapper
9. `asset-card` / `asset-title` / `asset-desc` — index gallery cards
10. `slide` — scroll-snap slide container

The vocabulary is domain-specific and non-generic — no Bootstrap-style utility classes, no Tailwind, no framework conventions. Every class name is semantic and content-specific, generated freshly per presentation.

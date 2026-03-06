# Corpus Synthesis — FliDeck Harness Migration

**Date:** 2026-03-06
**Source:** Analysis of 19 presentations, 519 HTML files

---

## Executive Summary

The FliDeck harness migration replaces iframe-based slide rendering with an embedded model where FliDeck owns navigation, keyboard handling, live reload, and shared utilities — slides become content fragments rather than isolated documents. The corpus of 19 presentations and 519 HTML files is dominated by a single large presentation (bmad-poem, 333 files, 64% of all HTML) that is structurally homogeneous and 95% pure HTML/CSS. Across the full corpus, the brand token system and font stack are stable enough to extract as harness-owned shared resources, eliminating hundreds of redundant network requests per session. The biggest risks are a small number of slides that implement their own viewport-locking, scroll-snap navigation, or keyboard listeners that will conflict with FliDeck's harness layer and require human or LLM review before migration. The biggest wins are font consolidation (519 individual Google Fonts round-trips reduced to one), CSS token injection (eliminating per-slide redeclaration of a stable 10-token brand palette), and a clean migration path for the 88% of files that are pure static HTML.

---

## File Classification Across Full Corpus

Type definitions from architectural decisions:
- **Type A** — Pure HTML/CSS, no `<script>` → mechanical wrapper strip, no LLM needed
- **Type B** — `<script>` with known safe patterns (copyCommand, clipboard, simple DOM toggle, CSS class toggle) → pattern match + hoist to harness utility
- **Type C** — `<script>` with complex/unknown logic, dynamic API calls, competing navigation, scroll-snap nav, or viewport-locking → LLM review required per file

| Presentation | Files | Type A | Type B | Type C | Notes |
|---|---|---|---|---|---|
| bmad-poem | 333 | 316 | 15 | 2 | 95% pure CSS; 2 live-API test runners (localhost:4321) |
| ansible-agentic-os | 19 | 19 | 0 | 0 | PNG-wrapper slides only; zero brand tokens, zero fonts |
| appystack | 35 | 35 | 0 | 0 | No JS; 25/35 files have responsive breakpoints |
| dam-overview | 19 | 18 | 0 | 1 | 1 scroll-snap fullscreen slides.html with JS nav |
| claude-plugin-marketplace | 8 | 8 | 0 | 0 | All static, exact brand match |
| claudinglab-anthropic-meetup | 9 | 7 | 2 | 0 | 2 JS files (decision tree, slides deck) — vanilla only |
| somatic-healing | 4 | 2 | 2 | 0 | Beauty & Joy brand; animated decision tree |
| color-exploration | 2 | 1 | 1 | 0 | Toggle-btn JS only |
| bmad-agents | 16 | 15 | 0 | 1 | pipeline.html: scroll-snap + JS nav + fixed chrome |
| claude-code-system-prompt | 10 | 9 | 0 | 1 | index.html: fetch('index.json') tab gallery builder |
| claude-code-system-prompt-v1 | 16 | 14 | 0 | 2 | index.html fetch + ref-decision-tree.html complex JS tree |
| agent-inventory | 9 | 7 | 0 | 2 | slides.html: self-managed nav+webcam; decision-tree.html |
| claudemas-12-days | 10 | 7 | 3 | 0 | 3 arcade fullscreen slides (overflow:hidden, 95vw/95vh) |
| consultants-plugin | 6 | 4 | 0 | 2 | Deviant palette; 2 fullscreen interactive JS files |
| n8n-story-gen | 6 | 6 | 0 | 0 | No JS; palette split (3 standard, 3 warm-brown deviant) |
| zero-to-app | 6 | 4 | 2 | 0 | 2 arcade fullscreen slides; Noto Sans Thai font |
| deck-systems | 0 | — | — | — | PROBLEM: no root HTML; content buried at arcade-deck/chiang-mai-dec-2025/ |
| dent-kpi-system | 0 | — | — | — | PROBLEM: tmp-01.jpg is a Google login page HTML, not a presentation |
| **TOTALS** | **519** | **472** | **25** | **11** | |

**Totals: 472 Type A (91%), 25 Type B (5%), 11 Type C (2%)**

Note: deck-systems and dent-kpi-system contribute 0 discoverable HTML files. The chiang-mai-dec-2025 presentation nested inside deck-systems likely adds ~21 HTML files (including presentation.html + 20 slides) once relocated; those are unclassified until moved.

---

## What the Harness Must Provide

### Shared Font Loading

All 17 HTML-native presentations (excluding ansible-agentic-os image wrappers) load fonts from `fonts.googleapis.com`. The canonical four-family stack is constant across the entire corpus:

- **Bebas Neue** — display headings, logo wordmark
- **Oswald** — section labels, subtitles, uppercase tags
- **Roboto** — body text
- **Roboto Mono** — code blocks, commands, technical strings

Currently loaded 519 times redundantly. The harness shell must load these once (either via a shared `<link>` in the host page or a local font bundle for offline use). The font `<link>` tags in individual slide files must not be stripped until the harness confirms it loads them first.

Additional non-standard fonts that appear in specific presentations only (harness cannot assume these):
- **Press Start 2P** — claudemas-12-days, zero-to-app (arcade slides only)
- **JetBrains Mono** — dam-overview only
- **Space Grotesk** — dam-overview only
- **Noto Sans Thai** — zero-to-app, one slide only

### Shared CSS Tokens

The following CSS custom properties appear with identical hex values across 4+ presentations and are stable enough for harness injection as a baseline fallback layer:

**Core brand (invariant across the full corpus):**
```css
--brand-brown:  #342d2d
--brand-gold:   #ccba9d
--brand-yellow: #ffde59
--white:        #ffffff
--brand-gray:   #595959
```

**Semantic traffic-light set (consistent across appystack, bmad-agents, claude-code-system-prompt, claude-code-system-prompt-v1, bmad-poem):**
```css
--doc-blue:       #3b82f6
--runtime-purple: #8b5cf6
--success-green:  #22c55e
--issue-amber:    #f59e0b
--pain-red:       #ef4444
```

Current drift issues: consultants-plugin uses `--brand-brown: #3E2723` (darker red-brown) and `--brand-gold: #B8860B`. Three slides in n8n-story-gen use `--brand-brown: #8B4513` (saddle brown). These deviations appear to correlate with different agent generation sessions applying different defaults. The harness baseline injection will be overridden by the slide's own re-declaration in all conforming slides; only deviants will show the baseline value, which is not what they intend. Deviant slides must be documented and not have their palette corrected mechanically.

### Keyboard Navigation

FliDeck's harness will own keyboard navigation (Cmd/Ctrl + arrow keys, F for presentation mode, Escape). The following presentations contain competing keyboard listeners that will conflict:

- **agent-inventory / slides.html** — full keyboard nav system for its own slide deck
- **bmad-agents / pipeline.html** — scroll-snap + keyboard listener for slide progression
- **claude-code-system-prompt / index.html** — tab-switching keyboard handler
- **claude-code-system-prompt-v1 / index.html** — same fetch+tab pattern

These files are classified Type C. The harness must either detect and disable competing keyboard listeners (risky), or treat the whole file as an opaque iframe embed with explicit sandbox documentation.

### Scroll Container Behaviour

Slides that use viewport-lock or scroll-snap require the harness iframe to provide full-height, unconstrained rendering. If the harness adds any wrapper with `overflow: hidden` or a fixed height less than the viewport, these slides will clip or break:

- **bmad-agents / pipeline.html** — `scroll-snap-type: y mandatory` on `<html>`, `100vh` per section
- **dam-overview / slides.html** — same scroll-snap pattern; teleprompter use case
- **claudemas-12-days** — 3 arcade slides: `overflow: hidden; height: 100%` viewport-locked
- **zero-to-app** — 2 arcade slides: `overflow: hidden; height: 95vh` fullscreen
- **consultants-plugin / decision-tree.html** — viewport-centered, fixed-position nav

### Utility JS

The following functions appear repeatedly across slides and are candidates for harness-level injection:

| Utility | Appearances | Files affected | Notes |
|---|---|---|---|
| `copyCommand(el)` / `copyInline(el)` | ~14 in bmad-poem, scattered in batch1 | ~20 files total | Uses `navigator.clipboard.writeText()`. If harness injects this, slides can reference `window.copyCommand` directly. |
| Decision tree state machine | 4+ presentations | agent-inventory, consultants-plugin, claudinglab-anthropic-meetup, somatic-healing, claude-code-system-prompt-v1 | Each implementation is hand-written and different; not safe to replace with a shared implementation without LLM review |
| CSS class toggle show/hide | ~3 in bmad-poem, color-exploration | ~5 files | Trivial; no harness injection needed |

---

## Migration Blockers

Issues that cannot be mechanically resolved and require human or LLM decision:

**Blocker 1: Self-managed slide navigation in nested slides**
- Affected: `agent-inventory/slides.html`, `bmad-agents/pipeline.html`, `dam-overview/slides.html`
- Problem: These files implement their own full keyboard nav and slide progression. Embedding them in the harness creates two competing navigation layers. Decision needed: treat as opaque (iframe passthrough) or strip the internal nav and rely on FliDeck's harness.

**Blocker 2: Live API dependency (localhost:4321)**
- Affected: `bmad-poem/story-2-5-sat-cheatsheet.html`, `bmad-poem/story-2-6-sat-cheatsheet.html`
- Problem: These slides make `fetch()` calls to a development server that may not be running. Harness cannot provide this. Decision needed: display warning overlay when server unreachable, or document as "requires dev environment."

**Blocker 3: Relative-URL fetch calls**
- Affected: `claude-code-system-prompt/index.html`, `claude-code-system-prompt-v1/index.html`
- Problem: `fetch('index.json')` works when served via FliDeck's static file server but will fail if the harness ever serves HTML as a blob or data URL. The embedded harness model must preserve relative URL resolution — base URL of the slide must resolve to the presentation folder. Decision needed: confirm base URL strategy before migrating these files.

**Blocker 4: Fixed-position elements vs harness chrome**
- Affected: `claude-code-system-prompt-v1` (13 of 16 files use `position: fixed` for the AppyDave logo)
- Problem: Fixed elements in an embedded slide will position relative to the viewport, potentially overlapping FliDeck's navigation chrome. Decision needed: define harness chrome layout zones that do not collide with common fixed-element positions (top-left is the most common anchor).

**Blocker 5: Deviant palette presentations**
- Affected: `consultants-plugin` (all 6 files), `n8n-story-gen` (3 of 6 files)
- Problem: These presentations use non-standard `--brand-brown` and `--brand-gold` values. A harness baseline CSS injection using the canonical values would be silently overridden by the slide's own re-declaration — the migration works but the brand inconsistency persists. Decision needed: document as known palette drift or attempt palette normalisation (requires LLM review of intent).

**Blocker 6: deck-systems folder structure**
- Affected: `deck-systems` (the chiang-mai-dec-2025 arcade presentation, ~21 files)
- Problem: The actual presentation is nested 2 levels deep (`arcade-deck/chiang-mai-dec-2025/`). FliDeck discovers only immediate children of `presentationsRoot`. Decision needed: move the nested folder to root level, or add a root `index.html` redirect.

**Blocker 7: dent-kpi-system placeholder**
- Affected: `dent-kpi-system` folder
- Problem: The single file (`tmp-01.jpg`) is a misnamed Google login page HTML capture. There is no KPI system presentation content. Decision needed: delete the folder, or create the actual presentation content.

**Blocker 8: Non-HTML asset in presentation folder**
- Affected: `claudinglab-anthropic-meetup` (contains `engineering-paradigms.json`)
- Problem: FliDeck's asset discovery will include the JSON file in the asset list, but it cannot be rendered as a slide. Decision needed: add JSON to FliDeck's asset filter exclusion list, or manually exclude from the manifest.

---

## Migration Wins

Things that get better automatically through migration:

- **Font loading consolidation (519 → 1 requests per session):** Every HTML-native slide currently triggers individual Google Fonts round-trips. The harness shell loads them once. This is the single largest performance win and also enables offline use via a local font bundle.
- **CSS token consistency enforcement:** Injecting the 10-token baseline palette as a harness-level `:root` declaration establishes a floor that catches future generation drift before slides load.
- **Keyboard navigation ownership:** FliDeck owns all keyboard shortcuts. Slides no longer need to implement or avoid keyboard handlers.
- **Live reload without full page navigation:** The harness can update a slide fragment without a full browser reload, enabling smoother development feedback loops.
- **Clipboard permission ownership:** The harness iframe can hold `allow="clipboard-write"` permanently, eliminating per-slide clipboard permission concerns.
- **Cross-slide link preservation:** Relative `<a href="other-slide.html">` links in bmad-agents already work when FliDeck serves from the folder root. The harness model preserves this behavior without any special handling.
- **Unified navigation chrome:** Replacing per-slide navigation implementations (slides.html in agent-inventory, pipeline.html in bmad-agents) with FliDeck's harness nav removes ~4 custom nav systems that each had their own bugs and inconsistencies.
- **Playwright regression baseline:** Once the PoC passes visual verification, the full pipeline becomes a permanent regression test for future harness changes across all 519 slides.

---

## Recommended PoC Presentation

**Recommended: `color-exploration` (2 files)**

Rationale:
- Smallest possible scope (2 files) — fast iteration
- 1 Type A file + 1 Type B file (simple JS class toggle) — covers both the trivial and the first real migration case
- Exact brand match — no palette complications
- No scroll-snap, no fixed-position elements, no fetch() calls, no competing keyboard handlers
- The JS pattern (toggle-btn show/hide) is the easiest non-trivial JS case in the corpus
- Already identified in architectural decisions as the primary PoC candidate

**Fallback: `somatic-healing` (4 files)**
If `color-exploration`'s dark background (`#1a1a1a` instead of `--brand-brown`) creates unexpected harness issues, `somatic-healing` is the next smallest option. It adds a decision tree (animated entrance effects) which is slightly more complex JS but still well within the Type B boundary.

---

## Recommended Migration Order

Ordered by complexity: simplest first, hardest last.

| Order | Presentation | Files | Type A | Type B | Type C | Rationale |
|---|---|---|---|---|---|---|
| 1 | color-exploration | 2 | 1 | 1 | 0 | PoC — smallest scope, one simple JS pattern |
| 2 | somatic-healing | 4 | 2 | 2 | 0 | 4 files, decision tree JS, Beauty & Joy brand variant |
| 3 | claude-plugin-marketplace | 8 | 8 | 0 | 0 | Pure static, exact brand, no JS |
| 4 | ansible-agentic-os | 19 | 19 | 0 | 0 | Image-wrapper slides; unique type but trivially simple |
| 5 | n8n-story-gen | 6 | 6 | 0 | 0 | No JS; palette drift documented, not blocked |
| 6 | appystack | 35 | 35 | 0 | 0 | Large, responsive, no JS — good stress test for CSS-only migration |
| 7 | claudinglab-anthropic-meetup | 9 | 7 | 2 | 0 | Standard brand, vanilla decision tree |
| 8 | claudemas-12-days | 10 | 7 | 3 | 0 | 3 arcade fullscreen slides — first viewport-lock encounter |
| 9 | zero-to-app | 6 | 4 | 2 | 0 | 2 arcade slides + Noto Sans Thai edge case |
| 10 | bmad-poem | 333 | 316 | 15 | 2 | Large but homogeneous; 15 Type B (copyCommand), 2 Type C excluded until server strategy decided |
| 11 | bmad-agents | 16 | 15 | 0 | 1 | pipeline.html scroll-snap blocker; 15 slides migrate mechanically |
| 12 | consultants-plugin | 6 | 4 | 0 | 2 | Deviant palette + 2 fullscreen interactive files |
| 13 | dam-overview | 19 | 18 | 0 | 1 | slides.html scroll-snap; harness scroll strategy needed |
| 14 | claude-code-system-prompt | 10 | 9 | 0 | 1 | index.html fetch strategy must be confirmed first |
| 15 | claude-code-system-prompt-v1 | 16 | 14 | 0 | 2 | Same fetch blocker + decision tree; migrate after v1 learnings |
| 16 | agent-inventory | 9 | 7 | 0 | 2 | slides.html self-nav conflict most complex; last in batch-1 |
| 17 | deck-systems (chiang-mai-dec-2025) | ~21 | ? | ? | ? | Relocate folder first; classify after move |
| — | dent-kpi-system | 0 | — | — | — | Delete or create content; not a migration task |

---

## Authoring Standard Prerequisites

The following questions must be resolved before an agent authoring standard can be written:

**1. What does the harness shell HTML look like?**
The PoC must be built first. The harness shell structure (what wraps a slide fragment, what CSS the host page provides, how slide `<style>` blocks are scoped) defines what a "harness-compatible slide" means. This cannot be specified in the abstract.

**2. How are `<style>` blocks scoped in embedded mode?**
When slides are content fragments rather than isolated documents, their CSS bleeds into the host page. The standard must specify whether slides use a wrapper class, CSS layers (`@layer`), or Shadow DOM isolation. This is the most consequential technical decision for the authoring standard.

**3. What is the base URL strategy for slides with fetch() calls?**
`fetch('index.json')` and relative `<img src="...">` paths must resolve correctly. The standard must specify whether slides use `<base href="...">` tags or whether the harness injects the base URL dynamically.

**4. How does the harness handle viewport-locking slides?**
Arcade slides and scroll-snap slides require full-viewport rendering. The standard must decide whether these are a first-class slide type (with harness support) or whether they remain as iframe passthroughs with the new harness model supporting a fallback mode.

**5. What is the clipboard permission model?**
The harness must define whether `copyCommand` is a harness-injected global or whether slides embed their own implementations. The standard must specify which pattern agents should use when authoring new slides.

**6. How are presentation-specific non-standard fonts declared?**
The standard font stack (Bebas Neue, Oswald, Roboto, Roboto Mono) will be harness-provided. Slides using Press Start 2P, JetBrains Mono, Space Grotesk, or Noto Sans Thai must declare these as per-slide dependencies. The authoring standard must specify how to declare additional font dependencies so the harness can load them on demand.

**Open questions remaining after corpus analysis:**

- Should the harness maintain a compatibility mode for pure image-wrapper slides (ansible-agentic-os type) or require all slides to have CSS content?
- Should palette-deviant presentations (consultants-plugin, n8n-story-gen) be normalised to the canonical AppyDave palette or preserved as-is with documented deviation?
- What is the threshold for Type C classification — is `fetch('index.json')` Type B or Type C? (Currently classified C due to base-URL dependency, but it may be resolvable mechanically.)
- Do subdirectory assets (zero-to-app has `archive/` and `exploration/` subdirs) become part of the presentation manifest or are they permanently excluded?

---

## Problem Folders

**deck-systems**
Real content (the chiang-mai-dec-2025 arcade presentation, ~21 files including a `presentation.html` entry point) is buried at `deck-systems/arcade-deck/chiang-mai-dec-2025/`. FliDeck's discovery mechanism only looks at immediate children of `presentationsRoot`. The root of `deck-systems` contains only Markdown handover documents with no HTML entry point, so the folder is invisible to FliDeck.

Required action: Move `arcade-deck/chiang-mai-dec-2025/` to the root of `presentation-assets/` as its own folder (suggested name: `arcade-deck-chiang-mai`), or add a root `index.html` redirect. Classify and migrate after relocation.

**dent-kpi-system**
Contains a single file: `tmp-01.jpg`. Despite the `.jpg` extension, this is an HTML document (a Google Accounts login page capture). It has no AppyDave branding, no slide content, and was not intentionally created as a presentation asset. This folder appears to be a stale placeholder from an incomplete session where the KPI system presentation was never created.

Required action: Delete `tmp-01.jpg` and the folder, or create the actual dent-kpi-system presentation content. This is not a migration task — it is a content creation task.

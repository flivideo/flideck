# Architectural Decisions — FliDeck Harness Migration

**Date:** 2026-03-06
**Status:** Planning — proof of concept not yet started

---

## What We Are Building

FliDeck currently renders slides inside iframes using srcdoc. We are migrating to an
embedded harness model where slides are content fragments rendered directly in the page,
with FliDeck owning navigation, keyboard handling, live reload, and shared utilities.

This is a full replacement, not a feature flag or dual-mode system.

---

## Key Decisions

### 1. No dual-mode rendering
The iframe approach and the embedded harness approach will NOT coexist in production code.
The worktree is used as a migration and UAT vehicle only. Once Playwright verification
passes, the worktree is merged and iframes are deprecated entirely.

Rationale: dual-mode adds conditional complexity with no long-term benefit.

### 2. Copy-don't-modify original folders
Migration always produces a new presentation folder (e.g. `bmad-poem-v2`).
Original folders (`bmad-poem`) are never modified during migration.
If migration fails or the harness approach is abandoned, rollback is trivial.

### 3. Worktree as UAT environment
- Main branch: `localhost:5200` / `localhost:5201` → original presentations → iframe rendering
- Worktree: `localhost:5202` / `localhost:5203` → v2 presentations → embedded harness rendering
- Both run simultaneously during UAT
- Playwright takes screenshots from both, pixel-diffs each slide pair
- Slides that pass threshold are auto-verified; flagged slides go to human review

### 4. Playwright visual verification pipeline
- `waitForLoadState('networkidle')` before each screenshot to handle fonts and async content
- Slides with dynamic API calls (e.g. localhost:4321) or complex animation: classified upfront,
  excluded from pixel-diff, flagged as manual review only
- Output: per-slide pass/fail report with flagged pairs saved as image comparisons
- Pipeline is reusable for future harness changes (regression testing across full corpus)

### 5. Proof of concept before any toolchain
First migration is done manually on a small presentation (2-4 files).
Candidates: `color-exploration` (2 files) or `somatic-healing` (4 files).
PoC must pass visual verification before any migration toolchain is built.

### 6. Authoring standard comes after corpus analysis
We will NOT define the harness-compatible slide spec until corpus analysis is complete.
The slide corpus is stylistically complex — components, CSS patterns, and structure must
be understood before a standard can be written.
Corpus analysis → synthesis → spec → toolchain. In that order.

### 7. Migration classification (three types)
- **Type A**: Pure HTML/CSS, no `<script>` → mechanical wrapper strip, no LLM needed
- **Type B**: `<script>` with known safe patterns (copyCommand, clipboard) → pattern match + hoist to harness utility
- **Type C**: `<script>` with unknown/complex logic or dynamic API calls → LLM review per file

LLM cost scales with complexity, not file count. bmad-poem is estimated ~95% Type A.

### 8. Merge and deprecate after verification
Once a presentation's v2 folder passes Playwright verification:
1. v2 folder replaces original in config
2. Original folder archived or deleted
3. iframe rendering code removed from FliDeck codebase
No partial states — a presentation is either fully migrated or fully on iframes.

---

## What "It Works" Means

Four definitions, explicitly scoped:

- **Definition 1 — Renders**: Slides display on screen, CSS looks correct, no visual leakage. Measurable via Playwright pixel diff.
- **Definition 2 — Compatible**: Slide JS (if any) does not conflict with FliDeck's runtime. Only relevant for Type B/C slides. Type A has no JS — no conflict possible.
- **Definition 3 — Maintainable**: Keyboard bridge, nav bridge, live reload, base URL resolution all work correctly without hacks. Bridge scripts become harness responsibilities, not per-slide injections.
- **Definition 4 — Content-compatible**: Every slide HTML file is restructured so its markup is embeddable directly as page content — no isolation layer. The slide itself is the unit of reform.

All four must be satisfied for migration to be considered complete.

---

## Corpus Facts (as of 2026-03-06)

- 19 presentation folders
- 572 total files, 519 HTML (91%), 19 images, 34 other
- bmad-poem dominates: 343 of 519 HTML files
- bmad-poem JS analysis: 316/333 individual slides have zero JS (95%)
- The 17 bmad-poem slides with JS: 13 use copyCommand/clipboard, 2 use decision trees, 2 call localhost:4321

---

## Research Needed Before Planning

Corpus analysis across all 19 presentations covering:
- CSS patterns and shared design tokens (colours, fonts, variables)
- External dependencies (Google Fonts, CDN scripts, external APIs)
- Structural/component patterns (cards, grids, code blocks, headers, timelines, etc.)
- JS patterns beyond copyCommand
- What the harness would need to provide as shared utilities

Output: synthesis document at `docs/planning/flideck-harness-migration/research/corpus-synthesis.md`
This document drives Ralphy Mode 2 planning for the harness spec and migration toolchain.

---

## Related Documents

- `decisions/iframe-vs-web-components.md` — why iframes are replaced, not wrapped in web components
- `research/` — per-presentation corpus analysis (generated by background agents)
- `research/corpus-synthesis.md` — combined findings, input to harness spec

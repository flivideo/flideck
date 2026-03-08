# AGENTS.md — FliDeck Harness Migration

## Project Overview

**Project**: FliDeck — local-first presentation harness for viewing folder-based HTML artifacts
**Campaign**: flideck-harness-migration — replace iframe/srcdoc rendering with embedded harness model
**Stack**: React 19 + Vite 6 (client, port 5200) / Express 5 + Socket.io (server, port 5201) / TypeScript / Vitest / TanStack Query / Playwright

**What this campaign does**: Slides are currently rendered inside iframes using srcdoc. We are migrating to an embedded model where FliDeck owns navigation, keyboard handling, live reload, and shared utilities. Slides become content fragments rendered directly in the host page, not isolated documents.

**Migration rule**: Always produce a `[presentation-name]-v2/` folder alongside the original. Never modify original folders.

**Presentations root**: Determined by `config.json` → `presentationsRoot`. Read this file to get the actual path.

---

## Build & Run Commands

```bash
# Install deps
cd /Users/davidcruwys/dev/ad/flivideo/flideck
npm install

# Dev (both client and server)
npm run dev

# Run all tests
npm test

# Run server tests only
cd server && npm test

# Run client tests only
cd client && npm test

# TypeScript type check
npm run typecheck
# or: cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit

# Lint
npm run lint

# Build
npm run build

# Playwright (once pipeline is set up)
cd playwright && npx playwright test
```

**Worktree ports (UAT):**
- Main branch: client `localhost:5200`, server `localhost:5201` → original presentations, iframe rendering
- Worktree: client `localhost:5202`, server `localhost:5203` → v2 presentations, embedded harness rendering

---

## Directory Structure

```
flideck/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/          # Sidebar, Header, layout components
│   │   │   └── ui/              # AssetViewer.tsx ← iframe renderer (to be replaced)
│   │   ├── hooks/               # Custom React hooks
│   │   ├── pages/               # PresentationPage.tsx
│   │   └── utils/               # displayMode.ts, etc.
├── server/
│   ├── src/
│   │   ├── routes/              # API routes
│   │   ├── services/            # PresentationService.ts (discovery, manifest, caching)
│   │   └── WatcherManager.ts
├── shared/
│   └── src/
│       └── types.ts
├── docs/
│   └── planning/
│       └── flideck-harness-migration/
│           ├── IMPLEMENTATION_PLAN.md   ← this campaign's work tracker
│           ├── AGENTS.md                ← this file
│           ├── decisions/               ← architectural decisions
│           ├── research/                ← corpus analysis (complete)
│           └── learnings/               ← coordinator captures after each wave
└── config.json                          ← gitignored; contains presentationsRoot path
```

**Presentations folder** (from config.json → presentationsRoot):
- Original presentations: `[presentationsRoot]/[name]/`
- Migrated v2 presentations: `[presentationsRoot]/[name]-v2/`

---

## Slide Classification Rules

Every agent must classify slides before migrating. Read the file — do not guess.

| Type | Criteria | Migration method |
|------|----------|-----------------|
| **A** | No `<script>` tag at all | Mechanical wrapper strip — no LLM needed |
| **B** | `<script>` with ONLY these patterns: `copyCommand`, `copyInline`, CSS class toggle (`classList.add/remove/toggle`), simple `innerHTML` show/hide | Pattern match + hoist to harness utility |
| **C** | Any other script: fetch() calls, DOM manipulation beyond toggle, keyboard listeners, scroll-snap nav, webcam, external API calls | LLM review required — do NOT auto-migrate |

**Type C handling**: Flag the file, add it to the `[campaign]/decisions/` folder with a recommendation, and skip it in the current wave. Never silently drop Type C content.

---

## Type A Migration: Wrapper Strip

Remove the isolation layer — keep only the content that belongs in the page.

**Strip these:**
- `<!DOCTYPE html>`, `<html>`, `<html lang="...">`, `</html>`
- Entire `<head>` block including: `<meta>` tags, `<title>`, Google Fonts `<link>` tags, viewport meta
- `<body>`, `<body class="...">`, `</body>`

**Keep these:**
- All `<style>` blocks (verbatim — do not modify CSS)
- All content elements (divs, sections, etc.)
- Internal `<link>` tags that reference local assets (not Google Fonts)

**Do NOT strip fonts until the harness confirms it loads them.** Until `harness-shell-prototype` is complete, keep a comment in v2 files noting the font strip is pending harness confirmation.

**Output format for a stripped Type A file:**
```html
<!-- harness-fragment: type-a -->
<!-- fonts: stripped (loaded by harness) -->
<style>
  /* original styles verbatim */
</style>

<div class="slide-content">
  <!-- original body content verbatim -->
</div>
```

---

## Type B Migration: Hoist JS Utilities

After stripping the wrapper (same as Type A), handle scripts:

**copyCommand / copyInline pattern:**
```javascript
// ORIGINAL (in slide)
function copyCommand(el) {
  const text = el.parentElement.querySelector('code').textContent;
  navigator.clipboard.writeText(text).then(() => { /* ... */ });
}
```
```javascript
// MIGRATED (harness provides window.copyCommand)
// Remove the function definition entirely.
// Rewrite call sites:
// onclick="copyCommand(this)"  →  onclick="window.copyCommand(this)"
// Or leave as-is if harness injects copyCommand into window scope.
```

**CSS class toggle pattern:**
```javascript
// ORIGINAL
function toggleDetails(id) {
  document.getElementById(id).classList.toggle('hidden');
}
```
```javascript
// MIGRATED — harness provides window.toggleClass, or keep as-is
// Simple DOM toggles are safe to leave inline if they don't conflict with harness
```

**Decision tree patterns**: Each is hand-written and different. Treat as Type C unless the implementation is a simple if/else show/hide. Do NOT attempt to replace with a shared implementation.

---

## The Canonical Font Stack (Harness-Provided)

Once `harness-shell-prototype` is complete, the harness loads these once per session:
- **Bebas Neue** — display headings, logo wordmark
- **Oswald** — section labels, subtitles, uppercase tags
- **Roboto** — body text
- **Roboto Mono** — code blocks, commands, technical strings

**Non-standard fonts** (per-slide dependency — NOT harness-provided):
- Press Start 2P — claudemas-12-days, zero-to-app arcade slides
- JetBrains Mono — dam-overview only
- Space Grotesk — dam-overview only
- Noto Sans Thai — zero-to-app, one slide only

Slides using non-standard fonts must declare them explicitly per the authoring standard.

---

## CSS Token Baseline (Harness-Injected)

The harness injects these 10 tokens as `:root` vars in the host page. Slides that re-declare them will override the baseline (correct behaviour). Deviant slides (consultants-plugin, n8n-story-gen) will silently override with their own values — this is intended.

```css
/* Core brand */
--brand-brown:  #342d2d;
--brand-gold:   #ccba9d;
--brand-yellow: #ffde59;
--white:        #ffffff;
--brand-gray:   #595959;

/* Semantic traffic-light */
--doc-blue:       #3b82f6;
--runtime-purple: #8b5cf6;
--success-green:  #22c55e;
--issue-amber:    #f59e0b;
--pain-red:       #ef4444;
```

---

## Known Problematic Slides (Type C Reference)

| File | Problem | Decision status |
|------|---------|----------------|
| `agent-inventory/slides.html` | Full keyboard nav + webcam overlay — competing with harness nav | PENDING decision |
| `bmad-agents/pipeline.html` | scroll-snap + keyboard nav — scroll strategy must be applied | PENDING scroll-strategy work unit |
| `dam-overview/slides.html` | scroll-snap teleprompter | PENDING scroll-strategy work unit |
| `claude-code-system-prompt/index.html` | `fetch('index.json')` relative URL — base URL strategy must be confirmed | PENDING harness-shell-prototype |
| `claude-code-system-prompt-v1/index.html` | Same fetch pattern | PENDING harness-shell-prototype |
| `claude-code-system-prompt-v1/ref-decision-tree.html` | Complex JS decision tree | PENDING LLM review |
| `consultants-plugin/decision-tree.html` | Viewport-centered, fixed-position nav | PENDING LLM review |
| `consultants-plugin/[interactive].html` | Fullscreen interactive | PENDING LLM review |
| `bmad-poem/story-2-5-sat-cheatsheet.html` | `fetch('http://localhost:4321/...')` — live API | DEFERRED until server strategy decided |
| `bmad-poem/story-2-6-sat-cheatsheet.html` | Same localhost:4321 pattern | DEFERRED |

---

## Playwright Visual Verification

**Goal**: Pixel-diff each migrated slide against its iframe-rendered original. Pass = migration complete.

**Settings:**
- Viewport: 1280x800 (match current FliDeck default)
- Wait: `waitForLoadState('networkidle')` before each screenshot (fonts + async content)
- Diff threshold: TBD during PoC (start at 1% pixel difference tolerance)
- Exclusions: Type C slides with dynamic content or animations — flagged as manual review only

**Output format:**
```
playwright-output/
├── report.md              ← per-slide pass/fail table
├── pass/                  ← side-by-side images of passing slides
└── flagged/               ← side-by-side images of failing or manual-review slides
```

---

## Success Criteria

**For each migration work unit:**
- [ ] v2 folder exists with same number of files as original (minus excluded Type C files)
- [ ] All Type A files: no `<html>`, `<head>`, `<body>` tags remain
- [ ] All Type B files: JS utility functions hoisted or referenced via window scope
- [ ] All Type C files: documented in decisions/ with migration recommendation, NOT auto-migrated
- [ ] Playwright pixel-diff passes for all migrated slides (within threshold)
- [ ] FliDeck TypeScript compiles without errors after any server-side changes
- [ ] No original presentation folders modified

**For harness shell work units:**
- [ ] `npm run dev` starts without errors on worktree ports 5202/5203
- [ ] Font load verified via browser Network tab (1 request for the 4-family stack, not per-slide)
- [ ] CSS tokens verified via browser DevTools computed styles
- [ ] Keyboard nav works (Cmd+arrow, F, Escape)

---

## Anti-Patterns to Avoid

- **Do NOT modify original presentation folders** — always work in v2 copies
- **Do NOT strip fonts until harness confirms it loads them** — broken fonts are invisible bugs
- **Do NOT auto-migrate Type C files** — flag and document, then skip
- **Do NOT normalise deviant palettes** — consultants-plugin and n8n-story-gen deviations are preserved
- **Do NOT build the migration toolchain before the PoC passes** — toolchain design depends on PoC learnings
- **Do NOT remove iframe rendering from FliDeck until all presentations are in v2 folders** — this is the remove-iframe-rendering work unit, last in Phase 7
- **Do NOT amend commits** — always create new commits
- **Do NOT use `any` types** in TypeScript changes

---

## Quality Gates

Non-negotiable before marking any work unit complete:

1. Playwright pixel-diff passes (or manual verification documented with screenshot)
2. TypeScript compiles without errors in affected workspace
3. No original files modified (verify with `git diff` against original folder)
4. For Phase 0 tasks: FliDeck discovers the corrected/fixed presentation correctly

---

## Learnings

_(Updated by coordinator as waves complete. Inherited from flideck-cleanup-2026.)_

**From flideck-cleanup-2026 (inherited):**
- iframe isolation was intentional architecture — the harness migration is a deliberate replacement, not a workaround
- tsc is now clean (0 errors) in both client and server — maintain this
- 0 known security vulnerabilities — maintain this
- Config watcher callback bug was subtle — watcher restart must pass all callbacks
- postMessage origin validation: srcdoc iframes have `origin === 'null'` in some browsers

**From corpus analysis (2026-03-06):**
- 91% of slides are Type A — the mechanical toolchain handles the vast majority
- bmad-poem (64% of corpus) is 95% pure HTML/CSS — high-volume but low-complexity
- The 4-family font stack is stable across 17 of 19 presentations
- Deviant palettes correlate with different agent generation sessions — not intentional brand decisions
- Two problem folders (deck-systems, dent-kpi-system) have 0 discoverable HTML — fixed in Phase 0
- JSON files are already excluded from asset discovery by the HTML-only allowlist at PresentationService.ts:301 — Blocker 8 was a false alarm

**From harness shell build (2026-03-06):**
- Harness files live at `client/src/harness/`: harness.css, harness-utils.ts, HarnessViewer.tsx, stripSlideWrapper.ts, useKeyboardBridge.ts
- CSS scoping: `.harness-slide` + `isolation: isolate` (selector prefixing deferred to toolchain)
- Script injection: DOM mutation (`container.innerHTML = body`), NOT `dangerouslySetInnerHTML` — required for post-injection script re-execution via `HTMLScriptElement` nodes
- Base URL: `<base>` tag inserted into `document.head` on each content change; cleaned up on unmount
- Font loading: `@import` in harness.css, loaded once at app startup via index.css
- Viewport-lock detection heuristic: scroll-snap-type, overflow:hidden, height 100/95vh — BUT `height: 100%` (no vh unit) is NOT detected. claudemas-12-days arcade slides need explicit `viewport-lock: true` in manifest.
- FliDeck keyboard shortcuts already require Cmd/Ctrl modifier — no conflict with slide keyboard handlers using plain arrow keys. Keyboard bridge is a capture-phase safety net only.
- `useKeyboardBridge` is called inside HarnessViewer — active only when harness rendering path is mounted

**From Playwright pipeline debugging (2026-03-08):**
- **Critical**: Many original slides use CSS tokens (`--pain-red`, `--doc-blue`, etc.) that are NOT defined in their own `:root`. They relied on being rendered in a context where these tokens exist. The standalone pages silently render with transparent/missing colors. The harness provides the tokens, making v2 look different from the original standalone page.
- **Fix**: Pipeline injects harness tokens into original screenshots via `page.addStyleTag(HARNESS_TOKEN_CSS)` before diffing (see `screenshotWithTokens()` in `playwright/pipeline.js`). Both sides get identical token context.
- **CORS blocker**: harness-shell.html cannot fetch from `localhost:5201` (different port = different origin). Cross-origin fetch fails in Playwright browser context. Don't route original files through harness-shell.
- **Residual diffs (1-2%)**: Long text-heavy slides with many colored elements show ~1.87% diff after token fix. Caused by font anti-aliasing differences (original loads fonts via `<link>`, harness loads via `@import`). Not a migration issue — classify as "review" quality and manually approve.
- **Slides that passed perfectly (0.00-0.53%)**: Confirmed that 6/8 claude-plugin-marketplace slides are pixel-perfect after token fix.
- **Pipeline command**: `node pipeline.js --compare [presentation-name]` compares `[name]` vs `[name]-v2`
- **Asset copy required**: Toolchain (both migrate-type-a.js and migrate-type-b.js) now copies non-HTML assets (PNG, JPG, SVG, fonts etc.) from source to v2 folder. Without this, presentations with `<img src="...">` references fail at 80-87% diff because the images don't exist in the v2 folder. Run migration again on any previously migrated presentations that have image assets.
- **Viewport-lock pixel diffs (5-11%) are expected**: Slides with `body { height: 100vh; overflow: hidden }` or `html, body { height: 100% }` (arcade, fullscreen) show 5-11% diffs in the pipeline. Root cause: `height: 100%` on `#slide-container` gets `auto` because harness-shell body has `min-height: 800px` not explicit `height: 800px`. Content is visually correct — just slightly different centering/sizing. Accept as manual-review for viewport-lock slides; they need `viewport-lock: true` manifest flag for production.

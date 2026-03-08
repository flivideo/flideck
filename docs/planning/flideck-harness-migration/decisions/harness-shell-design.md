# Harness Shell Design — PoC Decisions

**Date**: 2026-03-06
**Status**: PoC implemented — not yet wired into React tree

---

## What Was Built

Four files in `client/src/harness/`:

| File | Role |
|---|---|
| `harness.css` | Font loading, 10 CSS tokens, slide container styles |
| `harness-utils.ts` | copyCommand, copyInline, initHarnessGlobals |
| `stripSlideWrapper.ts` | DOMParser-based HTML extraction |
| `HarnessViewer.tsx` | React component replacing the srcdoc iframe |

`harness.css` is imported from `client/src/index.css` so fonts and tokens load once at app startup.

---

## Decision 1 — CSS Scoping Approach

**Chosen:** `.harness-slide` wrapper class + `isolation: isolate` + `position: relative` on the container div.

**Why not Shadow DOM:**
Shadow DOM provides the strongest style isolation (encapsulated DOM, scoped stylesheet pierce-through). However it requires JS wrapping of every element reference, breaks `document.querySelector` in slide scripts that walk the DOM, and complicates script re-execution (scripts must run in the shadow root's context). At PoC stage this is too invasive.

**Why not CSS `@layer`:**
Layers control cascade priority, not selector scope. A rule in a lower-priority layer is still a global rule — it can still match elements in the host page. Layers alone do not provide scoping.

**Why not full selector prefixing (regex/AST):**
Prefixing every rule in extracted `<style>` blocks with `.harness-slide ` (so `.my-class` becomes `.harness-slide .my-class`) is the correct long-term approach and should be part of the migration toolchain. At PoC stage, the corpus is 91% Type A with self-contained style blocks that rarely conflict with FliDeck host styles because FliDeck's own classes use Tailwind utility names (`flex`, `h-screen`, etc.) which are unlikely to appear in slide rules.

**Chosen approach detail:**
- The `.harness-slide` wrapper div has `isolation: isolate` — this creates a new stacking context, preventing slide `z-index` values from escaping into the host page and competing with FliDeck chrome (`z-50` header dropdown, `z-50` QuickFilter modal per `chrome-layout-zones.md`).
- `position: relative` on the wrapper makes it the containing block for any `position: absolute` children in the slide.
- `overflow: hidden` clips the slide to its allocated area.
- Extracted `<style>` blocks are injected into `<head>` as-is at PoC stage. They are tagged with `data-harness-slide="true"` for easy identification and cleanup on slide change/unmount.

**Known limitation:** Without selector prefixing, slide CSS rules are technically global. In practice this is low-risk for the bmad-poem corpus (91% of slides) because the corpus slides use BEM-style class names (`.slide-header`, `.code-block`, etc.) that do not conflict with Tailwind utility classes or FliDeck component class names. Full selector prefixing is deferred to the migration toolchain phase.

---

## Decision 2 — Script Re-execution Strategy

**Problem:** `dangerouslySetInnerHTML` (and the equivalent `innerHTML = ...`) does not execute `<script>` tags in the injected HTML. This is a browser security behaviour — scripts set via innerHTML are inert.

**Solution:** `stripSlideWrapper` extracts all inline script text content. After setting `innerHTML`, `HarnessViewer` creates fresh `HTMLScriptElement` objects, sets their `textContent`, and appends them to the container div. The browser executes scripts added this way.

**What is skipped:**
- External scripts (`<script src="...">`) are not re-fetched. At PoC stage the corpus has no external CDN scripts in Type A slides.
- `<script type="module">` is skipped. Module scripts have different scope semantics and would require additional handling.

**Cleanup:** On each content change and on unmount, previously injected script elements are removed from the DOM. This prevents duplicate script execution when slides change.

**PoC limitation:** Scripts that rely on `document.readyState === 'complete'` or `DOMContentLoaded` events will not re-fire — the script runs synchronously after innerHTML is set. The bmad-poem corpus scripts (copyCommand pattern) are event-handler registrations that do not depend on load events, so this is not a blocker for the PoC target.

---

## Decision 3 — Base URL Approach

**Problem:** Slides use relative paths in `<img src="diagram.png">`, `fetch('data.json')`, and CSS `url('bg.jpg')`. Without a base URL these paths resolve relative to the FliDeck app origin (`localhost:5200`) rather than the presentation folder.

**Solution:** A single `<base href="...">` element is inserted into the host page's `<head>` by `HarnessViewer` via a `useEffect`. The element is updated when `baseUrl` changes and removed on unmount.

**Trade-off:** There is only one `<base>` tag per page. If multiple `HarnessViewer` instances were mounted simultaneously they would fight over it. In FliDeck's current layout only one viewer is mounted at a time, so this is safe. A future multi-slide layout (e.g. speaker-notes split view) would need to abandon `<base>` in favour of URL rewriting in slide HTML.

**Why not URL rewriting:** Rewriting all relative URLs in the slide HTML during `stripSlideWrapper` is reliable but requires parsing `src`, `href`, and CSS `url()` values — more complexity than a PoC warrants. The `<base>` tag approach handles all three cases (HTML attributes, CSS, and fetch) with a single DOM element.

---

## Decision 4 — initHarnessGlobals Timing

`initHarnessGlobals()` is called in a `useEffect` with an empty dependency array in `HarnessViewer`. This runs once after the first render, before any slide content is injected (content injection also runs in a `useEffect`). React effect ordering guarantees that the globals effect runs first, so by the time slide scripts execute, `window.copyCommand` is available.

---

## Known Limitations at PoC Stage

| Limitation | Impact | Resolution path |
|---|---|---|
| No selector prefixing — slide CSS is global | Low risk for bmad-poem corpus; possible conflicts for future presentations with common class names | Migration toolchain: prefix all slide rules with `.harness-slide` during build |
| External scripts not re-fetched | No Type A slides use external CDN scripts | Type C classification triggers LLM review; toolchain adds external script hoisting |
| Single `<base>` tag per page | Safe for current single-viewer layout | URL rewriting in stripSlideWrapper if multi-viewer needed |
| `position: fixed` in slides becomes viewport-fixed | Identified in chrome-layout-zones.md; affects 13 claude-code-system-prompt slides with logo at top:0;left:0 | Inject `--flideck-top`/`--flideck-left` CSS vars; slides updated during migration |
| Module scripts skipped | Unknown corpus impact — likely zero for Type A | Classify as Type C; LLM review |
| No visual regression baseline yet | PoC not yet Playwright-verified | Run Playwright pipeline after color-exploration PoC migration |

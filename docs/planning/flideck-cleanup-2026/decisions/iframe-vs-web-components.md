# Decision: iframe vs Web Components for Slide Rendering

**Date:** 2026-03-06
**Status:** Decided — keep iframes
**Context:** FliDeck renders arbitrary agent-generated HTML slide artifacts inside iframes using `srcdoc`. The question is whether Shadow DOM + Custom Elements could replace iframes and eliminate the separate browsing context overhead.

---

## Current Approach: iframe with srcdoc

`AssetViewer.tsx` renders every slide in an `<iframe sandbox="allow-scripts allow-same-origin">` using the `srcdoc` attribute (never `src`). Before setting `srcdoc`, `injectBridgeScripts()` mutates the raw HTML string to insert four things immediately after `<head>`:

1. **`<base href="/presentations/{id}/">`** — rewrites all relative URLs (images, fonts, scripts, CSS `url()`) to resolve against the server's static file path for that presentation folder. Without this, a slide that references `./assets/hero.png` would 404 because `srcdoc` has no inherent base URL.

2. **Cache-busting meta tag** — inserted only when `reloadKey > 0` (i.e., a file-system change was detected via Socket.io). Tells the browser not to serve stale sub-resources from disk cache when the slide content changes.

3. **`KEYBOARD_FORWARD_SCRIPT`** — listens to `keydown` inside the iframe's `document` and forwards selected keys (Escape, F, Ctrl/Cmd + Arrow/Home/End) to the parent via `postMessage`. This is required because keyboard events that fire inside an iframe's browsing context do not propagate to the parent `window`; they stop at the iframe boundary.

4. **`NAV_BRIDGE_SCRIPT`** — intercepts `click` events on `<a>` elements inside the iframe (using capture-phase listener), extracts the relative `.html` filename, calls `e.preventDefault()` to block full-page iframe navigation, then sends a `flideck:navigate` postMessage to the parent. The parent (`PresentationPage.tsx`) resolves the filename to an asset ID and updates React state, which causes `useAsset` to fetch the new content and set a new `srcdoc`.

`PresentationPage.tsx` listens for these postMessages on `window` with origin validation (`e.origin === window.location.origin || e.origin === 'null'` — the `'null'` origin is the documented behavior of `srcdoc` iframes in some browsers).

Live reload is driven by `reloadKey`: `useContentChanges()` increments an integer each time Socket.io fires a content-change event for the current presentation. Both `useEffect` hooks in `AssetViewer` have `reloadKey` in their dependency array, so a new `srcdoc` string is computed and assigned, which forces the iframe to re-parse from scratch.

---

## The Question

Could Shadow DOM + Custom Elements replace the iframe, eliminating the separate browsing context? The motivation would be: lighter weight, no cross-origin postMessage ceremony, simpler debugging.

The short answer is no. The reasoning follows.

---

## Isolation Analysis

### CSS Isolation

**iframe:** Complete. Each iframe has its own document. The parent's stylesheets have zero effect on slide content, and the slide's stylesheets have zero effect on FliDeck's UI. This is structural — different documents, not a convention.

**Shadow DOM:** Encapsulated but not isolated. Styles defined inside a shadow root do not leak out to the light DOM, and most external styles do not pierce in (except CSS custom properties, which intentionally inherit across shadow boundaries, and `::part()` / `::slotted()` selectors that the host explicitly exposes). For slides that ship with self-contained CSS (`<style>` blocks or linked stylesheets), Shadow DOM's CSS boundary is sufficient. For slides that rely on global resets or assume a clean document baseline, there can be conflicts because the host document's CSS custom properties and inherited properties (font-family, color, etc.) still flow into the shadow root.

CSS isolation is the strongest argument in web components' favour — and it is still not as strong as an iframe.

### JavaScript Isolation

**iframe:** Complete. Each iframe is a separate browsing context with its own JavaScript realm. `window`, `document`, `history`, `location`, `fetch`, `XMLHttpRequest`, `localStorage`, `sessionStorage`, `setTimeout`, `setInterval`, `addEventListener` — all of these inside the iframe refer to the iframe's own copies. A slide that writes `window.myGlobal = 42` cannot touch FliDeck's `window.myGlobal`. A slide that patches `Array.prototype` cannot affect FliDeck's React runtime. A slide that calls `document.querySelector` returns elements from the slide's document, not FliDeck's.

The `sandbox="allow-scripts allow-same-origin"` attribute narrows what scripts can do (no form submission, no popup, no top-level navigation) while still allowing the bridge scripts to call `window.parent.postMessage`.

**Shadow DOM:** No JS isolation whatsoever. Shadow DOM is a DOM scoping mechanism, not a JavaScript execution boundary. `window` is the same object inside and outside a shadow root. `document` is the same object. Every script that runs inside a custom element runs in the page's global scope. This has concrete consequences for FliDeck:

- A slide that calls `document.querySelector('.sidebar')` will find FliDeck's sidebar elements.
- A slide that calls `window.location.assign('/')` will navigate FliDeck's tab, not the slide.
- A slide that imports a conflicting version of a library (React, lodash, etc.) will overwrite FliDeck's global if the slide uses a CDN `<script>` tag that writes to `window`.
- A slide that contains a JavaScript error will propagate up to FliDeck's global error handlers.
- A slide's `setTimeout` callbacks run on the same event loop tick queue as FliDeck's React renderer.

There is no standards-track mechanism to create a JS-isolated component without a separate browsing context. The TC39 "Realms" proposal (`ShadowRealm`) provides a separate JS realm, but it explicitly does not support DOM access — it is a pure-JS sandbox. You cannot render HTML inside a ShadowRealm. Declarative Shadow DOM (the `shadowrootmode` HTML attribute) is the same Shadow DOM, only declaratively constructed; it adds nothing to the isolation model.

This is the decisive difference. Agent-generated slides are arbitrary HTML. They include inline `<script>` tags, CDN library loads, and DOM-manipulating code that is designed to run standalone. Rendering them inside a custom element without a separate realm means every one of those scripts runs in FliDeck's global scope. That is not a theoretical risk — it will happen with slides that animate, that use external charting libraries, or that prototype global functions as part of their demo content.

### Event Routing (Keyboard and Navigation)

**iframe (current):** Keyboard events inside the iframe stop at the iframe boundary. `KEYBOARD_FORWARD_SCRIPT` bridges them back via postMessage. This is two hops (iframe keydown -> postMessage -> parent message handler -> synthetic event -> `handleKeyDown`) but it is reliable and explicit. The same postMessage channel carries `flideck:navigate` for link interception. `NAV_BRIDGE_SCRIPT` uses a capture-phase click listener to intercept `<a>` tags before the browser acts on `href`, calls `preventDefault()`, and forwards only the relative filename. The parent never needs to know the slide's internal DOM structure.

**Shadow DOM:** Keyboard events fired inside a shadow root do bubble to `document` (they are re-targeted at the shadow host boundary). So `F`, Escape, and Ctrl+Arrow keys pressed inside a custom element would reach FliDeck's `window.addEventListener('keydown', ...)` without a bridge script. This is one area where web components would simplify things. However, link interception is more complicated: clicks on `<a>` tags inside a shadow root also bubble to the light DOM, but the event is re-targeted to the shadow host — the `<a>` element is not visible to the light-DOM click handler. You would need to attach a capture-phase listener inside the shadow root itself, which means you still need injected or framework-managed event handling logic inside the component.

More importantly, navigation interception is moot if JS isolation does not exist: a slide that calls `window.location.assign()` directly (not via an `<a>` click) will navigate the page regardless of any event listener you attach.

### Resource Resolution (Base URLs)

**iframe (current):** The `<base href="/presentations/{id}/">` tag injected into the slide's `<head>` rewrites all relative URLs for that document. Images, fonts, linked stylesheets, `fetch()` calls using relative paths — all resolve against the presentation folder served by Express. This works because the iframe has its own document with its own `<base>` element.

**Shadow DOM:** There is no equivalent of `<base>` for a shadow root. The shadow root is not a document; it does not have a base URL of its own. Relative URLs in inline styles (`background-image: url('./bg.png')`) resolve against the host document's base URL, which is `http://localhost:5200/`. Relative URLs in `<img src="...">` tags also resolve against the document base. To fix this, you would need to either:

- Rewrite every relative URL in the slide HTML before injecting it (fragile — you miss `url()` values in CSS, `src` in `<video>`, `href` in `<link>`, etc.).
- Serve all slide assets with absolute URLs (requires the agent to generate slides this way — breaks the existing artifact convention).
- Run a full HTML parser and rewriter on every slide before rendering (essentially reimplementing what the browser does for iframes).

The `<base>` tag injection in `injectBridgeScripts` is a one-line fix for iframes. For web components it becomes a major pre-processing problem with no clean solution.

### Arbitrary HTML and Script Execution

**iframe:** `srcdoc` accepts a full HTML document string. The browser parses and executes it as a standalone document. Inline `<script>` tags run. `<link rel="stylesheet">` loads. `<script src="...">` fetches and executes. The `sandbox` attribute selectively re-enables capabilities: `allow-scripts` permits `<script>` execution; `allow-same-origin` lets the iframe share the same origin as the parent (required for `postMessage` to work without cross-origin restrictions and for the bridge scripts to call `window.parent`). The slide runs as designed by the agent.

**Shadow DOM / Custom Element:** `innerHTML` on a shadow root does not execute `<script>` tags. This is a deliberate browser security decision (same as `innerHTML` on a regular element). To execute inline scripts, you must create `<script>` elements programmatically and append them to the shadow root or document head. This means building a custom HTML parser and script executor — which is exactly what `srcdoc` gives you for free. Linked scripts (`<script src="...">`) can be executed if appended to the host document's `<head>`, but they then run in the host document's global scope (the JS isolation problem again). There is no mechanism to scope a `<script src>` to a shadow root's realm.

In practice: a custom element that renders agent HTML would either fail to execute scripts (slides do nothing) or execute them in FliDeck's global scope (slides work but are not isolated). Neither is acceptable.

---

## Live Reload

**iframe (current):** `reloadKey` is an integer in React state incremented by `useContentChanges()` when Socket.io signals a file change. Because both `useEffect` hooks in `AssetViewer` list `reloadKey` as a dependency, they re-run. The new `srcdoc` string is computed (with cache-busting meta tag) and assigned to `iframeRef.current.srcdoc`. The browser discards the old document and parses the new one. Clean, complete re-render.

**Shadow DOM:** A custom element could re-render by clearing `shadowRoot.innerHTML` and repopulating it. But because scripts do not execute via `innerHTML`, a live-reload mechanism would need to additionally re-execute all scripts — requiring the same custom parser/executor described above. If scripts are handled by appending `<script>` elements programmatically, re-render would require tracking and removing all previously appended script elements from the host document head (since shadow roots cannot own `<script>` elements with side effects). This is fragile state management that iframes handle automatically by virtue of discarding the entire browsing context on `srcdoc` reassignment.

---

## What "It Works" Would Mean

Three distinct bars, explicitly called out:

**1. Renders (CSS level):** The slide's visual output appears correctly — layout, typography, colors, images all present. Shadow DOM can pass this bar for many slides. Fails for slides where relative image/font URLs break (base URL problem) or where FliDeck's inherited CSS properties interfere.

**2. Isolated (JS level):** The slide's JavaScript cannot see or affect FliDeck's DOM, globals, or navigation. iframes pass this bar unconditionally. Shadow DOM fails this bar unconditionally — it provides zero JS isolation. This is not a limitation that can be engineered around without adding an iframe underneath the custom element, which would make the whole exercise circular.

**3. Maintainable (bridge/event-routing level):** The keyboard bridge, navigation interception, and live reload work reliably and are understandable to future developers. iframes pass this bar with two injected scripts and a `postMessage` listener. Web components would require a custom script-execution engine, URL rewriting, cross-document event coordination, and re-execution tracking on reload — a significantly higher surface area for bugs.

---

## Verdict

Keep iframes. Shadow DOM + Custom Elements cannot safely render arbitrary agent-generated HTML because they provide no JavaScript isolation. A slide's scripts run in FliDeck's global scope, which means slides can break FliDeck's UI, navigate the page, and conflict with React's runtime. This is not a trade-off to be weighed — it is a categorical failure of the isolation requirement. Additionally, the lack of a per-shadow-root base URL makes relative resource resolution a hard pre-processing problem that iframes solve with a single injected `<base>` tag.

The current iframe approach is the correct tool for this job. The `srcdoc` + `sandbox` + bridge-script pattern is well-specified browser behaviour with no dependency on non-standard APIs. Its complexity (two injected scripts, one postMessage listener) is justified by what it achieves: full browsing context isolation, correct resource resolution, and safe execution of arbitrary HTML including inline and linked scripts.

---

## If You Still Wanted to Try

A web-components-based renderer that meets FliDeck's isolation requirements would need to:

1. **Add an iframe inside the custom element anyway.** Shadow DOM alone cannot isolate JS. The custom element would wrap an `<iframe srcdoc>` — returning to exactly the current architecture with an extra layer of indirection.

2. **Build a custom script execution pipeline.** If you removed the inner iframe and tried to execute scripts manually: parse the HTML with the DOMParser API, extract `<script>` elements, re-create them as DOM nodes, append them to the host document. Handle script loading order, defer/async semantics, and module scripts. This is reimplementing the browser's HTML parser pipeline in userspace — months of work that would be less correct than what the browser already does.

3. **Build a URL rewriting pre-processor.** Parse the HTML to find every relative URL in `src`, `href`, `url()`, `srcset`, `data-*` attributes across HTML and CSS, and rewrite them to absolute paths. Handle CSS `@import` and nested `url()` references. Keep this in sync as the agent tooling evolves its output conventions.

4. **Solve re-render with script side effects.** Track every `<script>` element added to the host document during one render pass, remove them before the next render pass, and re-run them in the correct order. Handle cleanup of global state the scripts may have written.

None of these problems is unsolvable in isolation, but together they compose into a custom browser renderer. iframes exist precisely so that application code does not have to implement this. The realistic path for anyone who wants a non-iframe renderer for arbitrary HTML in a browser is `<iframe>` with `sandbox` and `srcdoc` — which is the current implementation.

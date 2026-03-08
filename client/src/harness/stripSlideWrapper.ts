/**
 * stripSlideWrapper
 *
 * Parses a full slide HTML document (with <html><head><body> wrapper) and
 * extracts the pieces the harness needs to embed the slide as an inline
 * content fragment.
 *
 * Uses DOMParser — NOT regex — so that nested tags, comments, and malformed
 * HTML are handled by the browser's own parser rather than brittle patterns.
 *
 * Returns:
 *   styles  — concatenated text content of all <style> blocks found in
 *             <head> or <body>. The harness scopes these by prepending
 *             the ".harness-slide" selector before injecting.
 *   body    — innerHTML of the <body> element (the slide's visible markup).
 *   scripts — array of inline <script> textContent strings to re-execute
 *             after the fragment is mounted. External scripts (src="...")
 *             are skipped — the harness does not re-fetch external scripts
 *             at PoC stage.
 *
 * What is deliberately skipped:
 *   - Google Fonts <link> tags — font loading is the harness responsibility
 *   - External stylesheet <link rel="stylesheet"> tags — not re-fetched
 *   - <script src="..."> external scripts — not re-fetched at PoC stage
 *   - <meta>, <title>, and other head metadata — irrelevant for inline embed
 */

export interface StrippedSlide {
  styles: string;
  body: string;
  scripts: string[];
  /**
   * True when the slide HTML contains viewport-lock markers:
   *   - scroll-snap-type on <html> or any element in a <style> block
   *   - overflow: hidden on <body> (in a style attribute or <style> block)
   *   - height: 100vh or height: 95vh on any element (style attr or <style> block)
   *
   * When true, the caller should apply .harness-slide--viewport-lock so that
   * overflow:auto (not hidden) is used, letting the slide control its own scroll.
   */
  viewportLock: boolean;
}

/** Patterns that identify Google Fonts URLs — used to skip font <link> tags */
const GOOGLE_FONTS_PATTERN = /fonts\.googleapis\.com|fonts\.gstatic\.com/i;

/**
 * Viewport-lock detection patterns.
 *
 * A slide is classified as viewport-lock when it uses any of these techniques
 * to control scroll within its own document — techniques that require the slide
 * to be the scroll container (which it is in iframe mode but not in embedded mode).
 *
 * Patterns checked (in CSS text or inline style attributes):
 *   1. scroll-snap-type — defines a scroll snap container (commonly on <html>)
 *   2. overflow: hidden on <body> — suppresses document-level scrollbars; the
 *      slide manages its own section/card transitions
 *   3. height: 100vh or height: 95vh — sections sized to fill the viewport;
 *      these rely on 100% of the viewport being available to the slide
 *
 * False-positive risk is low: these patterns are unlikely in non-viewport-lock
 * slides. False-negatives are possible (e.g., viewport-lock expressed entirely
 * in an external stylesheet not inlined), but the corpus has no such slides.
 */
const VIEWPORT_LOCK_CSS_PATTERNS = [
  /scroll-snap-type/i,
  /overflow\s*:\s*hidden/i,
  /height\s*:\s*(100|95)vh/i,
];

/**
 * Returns true if the parsed document appears to be a viewport-lock slide.
 *
 * Checks:
 *   1. All <style> block text content (covers most CSS patterns)
 *   2. The body element's inline `style` attribute
 *   3. The html element's inline `style` attribute
 */
function detectViewportLock(doc: Document): boolean {
  // Check all <style> block text
  const styleText = Array.from(doc.querySelectorAll('style'))
    .map((el) => el.textContent ?? '')
    .join('\n');

  for (const pattern of VIEWPORT_LOCK_CSS_PATTERNS) {
    if (pattern.test(styleText)) return true;
  }

  // Check body inline style attribute for overflow:hidden
  const bodyStyle = doc.body?.getAttribute('style') ?? '';
  if (/overflow\s*:\s*hidden/i.test(bodyStyle)) return true;

  // Check html element inline style attribute
  const htmlStyle = doc.documentElement?.getAttribute('style') ?? '';
  if (VIEWPORT_LOCK_CSS_PATTERNS.some((p) => p.test(htmlStyle))) return true;

  return false;
}

export function stripSlideWrapper(html: string): StrippedSlide {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // ── Styles ──────────────────────────────────────────────────────────────────
  // Collect all <style> elements from both <head> and <body>.
  const styleBlocks: string[] = [];
  doc.querySelectorAll('style').forEach((styleEl) => {
    const text = styleEl.textContent ?? '';
    if (text.trim()) {
      styleBlocks.push(text);
    }
  });

  // ── Scripts ─────────────────────────────────────────────────────────────────
  // Collect inline <script> textContent. Skip:
  //   - scripts with a src attribute (external)
  //   - scripts with type="module" at PoC stage (module scope semantics differ)
  const scripts: string[] = [];
  doc.querySelectorAll('script').forEach((scriptEl) => {
    if (scriptEl.hasAttribute('src')) return;           // external — skip
    if (scriptEl.getAttribute('type') === 'module') return; // module — skip at PoC
    const text = scriptEl.textContent ?? '';
    if (text.trim()) {
      scripts.push(text);
    }
  });

  // ── Skip Google Fonts <link> tags ───────────────────────────────────────────
  // We don't need to do anything special here — we just don't collect <link>
  // tags at all. Font loading is handled by harness.css @import.
  // Verify skipping works: any <link rel="stylesheet"> referencing Google Fonts
  // is intentionally omitted from the output.
  void GOOGLE_FONTS_PATTERN; // reference to silence unused-variable lint

  // ── Body ────────────────────────────────────────────────────────────────────
  const body = doc.body?.innerHTML ?? '';

  // ── Viewport-lock detection ──────────────────────────────────────────────────
  // Must be called after DOMParser has fully parsed the document so that
  // querySelectorAll and getAttribute work on the complete DOM tree.
  const viewportLock = detectViewportLock(doc);

  return {
    styles: styleBlocks.join('\n'),
    body,
    scripts,
    viewportLock,
  };
}

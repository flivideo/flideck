import { useEffect, useRef } from 'react';
import { stripSlideWrapper } from './stripSlideWrapper';
import { initHarnessGlobals } from './harness-utils';
import { useKeyboardBridge } from './useKeyboardBridge';

interface HarnessViewerProps {
  /** Raw HTML of the slide (full document with <html><head><body> wrapper) */
  content: string;
  /** Base URL of the presentation folder, e.g. "/presentations/my-deck/" */
  baseUrl: string;
  /** When true, slide fills the full viewport (presentation mode) */
  presentationMode?: boolean;
  /**
   * When true, the slide is classified as viewport-lock: it uses scroll-snap,
   * 100vh sections, or overflow:hidden on <body> to manage its own internal
   * scrolling. Applies .harness-slide--viewport-lock which sets overflow:auto
   * instead of overflow:hidden, allowing the slide's scroll behaviour to work.
   */
  viewportLock?: boolean;
  /**
   * Called when the user clicks a relative .html link inside the slide content.
   * Used for tab index pages whose cards link to individual slides.
   * Receives the filename (e.g. "slide01.html") so the caller can update state.
   */
  onNavigate?: (filename: string) => void;
}

/**
 * HarnessViewer — replaces the srcdoc iframe in AssetViewer.
 *
 * Strips the <html>/<head>/<body> wrapper from slide HTML and injects the
 * fragment directly into a scoped div. CSS scoping is achieved by prefixing
 * all extracted <style> blocks with the ".harness-slide" ancestor selector so
 * slide rules cannot bleed into the host page.
 *
 * Script re-execution: dangerouslySetInnerHTML does NOT execute <script> tags.
 * Scripts extracted by stripSlideWrapper are re-executed by creating fresh
 * <script> elements and appending them to the container after mount (standard
 * DOM technique for injected scripts). Each re-render cleans up previously
 * injected script elements before creating new ones.
 *
 * Base URL: a <base> element is inserted into the document <head> pointing at
 * the presentation folder so that relative <img src>, fetch(), and CSS url()
 * paths resolve correctly without needing to rewrite every URL in the slide.
 */
export function HarnessViewer({ content, baseUrl, presentationMode = false, viewportLock = false, onNavigate }: HarnessViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const styleTagRef = useRef<HTMLStyleElement | null>(null);
  const baseTagRef = useRef<HTMLBaseElement | null>(null);
  const scriptTagsRef = useRef<HTMLScriptElement[]>([]);
  const clickListenerRef = useRef<((e: MouseEvent) => void) | null>(null);

  // Enforce keyboard ownership contract: FliDeck modifier+nav shortcuts are
  // protected even when slide scripts call stopPropagation on keydown events.
  useKeyboardBridge();

  // Register harness globals once on first mount
  useEffect(() => {
    initHarnessGlobals();
  }, []);

  // Set / update the document-level <base> tag for relative path resolution.
  // We manage a single <base> element in <head> rather than one per slide so
  // that multiple HarnessViewer instances on the same page don't conflict.
  // (In practice only one viewer is mounted at a time.)
  useEffect(() => {
    let base = baseTagRef.current;
    if (!base) {
      base = document.createElement('base');
      document.head.appendChild(base);
      baseTagRef.current = base;
    }
    base.href = baseUrl;

    return () => {
      // On unmount, remove the base tag we added
      if (baseTagRef.current && baseTagRef.current.parentNode) {
        baseTagRef.current.parentNode.removeChild(baseTagRef.current);
        baseTagRef.current = null;
      }
    };
  }, [baseUrl]);

  // Parse and inject slide content whenever `content` changes
  useEffect(() => {
    if (!content || !containerRef.current) return;

    const { styles, body, scripts } = stripSlideWrapper(content);
    // Note: viewportLock detection from stripSlideWrapper is available via the
    // prop — callers can auto-detect by calling stripSlideWrapper themselves or
    // use the manifest flag. The prop takes precedence so the manifest remains
    // the authoritative source for viewport-lock classification.

    // ── 1. Inject scoped styles ──────────────────────────────────────────────
    // Remove previously injected style tag if any
    if (styleTagRef.current && styleTagRef.current.parentNode) {
      styleTagRef.current.parentNode.removeChild(styleTagRef.current);
      styleTagRef.current = null;
    }

    if (styles.trim()) {
      // Scope slide CSS to .harness-slide so it cannot bleed into FliDeck chrome.
      //
      // @scope (.harness-slide) { } limits all enclosed rules to descendants of
      // the container div. This prevents slide resets like `* { margin: 0 }` or
      // broad rules like `button { all: unset }` from hitting the TabBar, Sidebar,
      // or any other FliDeck UI element.
      //
      // :root / html / body selectors are remapped to :scope so slide-level
      // properties (backgrounds, fonts, CSS custom properties) are applied to
      // the .harness-slide container itself rather than the document root.
      const scoped = styles
        .replace(/:root\b/g, ':scope')
        .replace(/\b(html\s*,\s*body|body\s*,\s*html)\b/g, ':scope')
        .replace(/\bhtml\b/g, ':scope')
        .replace(/\bbody\b/g, ':scope');

      const styleEl = document.createElement('style');
      styleEl.setAttribute('data-harness-slide', 'true');
      styleEl.textContent = `@scope (.harness-slide) {\n${scoped}\n}`;
      document.head.appendChild(styleEl);
      styleTagRef.current = styleEl;
    }

    // ── 2. Set container HTML (body fragment) ────────────────────────────────
    // dangerouslySetInnerHTML equivalent via direct DOM mutation here because
    // we need to also re-run scripts after the DOM settles.
    containerRef.current.innerHTML = body;

    // ── 3. Re-execute extracted scripts ─────────────────────────────────────
    // Remove previously injected scripts
    scriptTagsRef.current.forEach((s) => {
      if (s.parentNode) s.parentNode.removeChild(s);
    });
    scriptTagsRef.current = [];

    scripts.forEach((scriptText) => {
      if (!containerRef.current) return;
      const scriptEl = document.createElement('script');
      scriptEl.textContent = scriptText;
      // Append to container so the script's implicit `this` context is scoped
      // to the slide fragment rather than the global document body.
      containerRef.current.appendChild(scriptEl);
      scriptTagsRef.current.push(scriptEl);
    });

    // ── 4. Intercept relative .html link clicks (tab index navigation) ────────
    // Remove previous listener before adding a new one
    if (clickListenerRef.current && containerRef.current) {
      containerRef.current.removeEventListener('click', clickListenerRef.current);
      clickListenerRef.current = null;
    }

    if (onNavigate && containerRef.current) {
      const handleClick = (e: MouseEvent) => {
        const anchor = (e.target as Element).closest('a');
        if (!anchor) return;
        const href = anchor.getAttribute('href');
        if (!href || href.startsWith('http') || href.startsWith('/') || href.startsWith('#')) return;
        const clean = href.split('?')[0].split('#')[0];
        if (!clean.endsWith('.html')) return;
        const filename = clean.split('/').pop();
        if (filename) {
          e.preventDefault();
          onNavigate(filename);
        }
      };
      containerRef.current.addEventListener('click', handleClick);
      clickListenerRef.current = handleClick;
    }
  }, [content, onNavigate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (styleTagRef.current && styleTagRef.current.parentNode) {
        styleTagRef.current.parentNode.removeChild(styleTagRef.current);
        styleTagRef.current = null;
      }
      scriptTagsRef.current.forEach((s) => {
        if (s.parentNode) s.parentNode.removeChild(s);
      });
      scriptTagsRef.current = [];
      if (clickListenerRef.current && containerRef.current) {
        containerRef.current.removeEventListener('click', clickListenerRef.current);
        clickListenerRef.current = null;
      }
    };
  }, []);

  const wrapperClasses = [
    'harness-slide',
    viewportLock ? 'harness-slide--viewport-lock' : '',
    presentationMode ? 'harness-slide--presentation-mode' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="flex-1 overflow-hidden relative bg-slate-900">
      <div
        ref={containerRef}
        className={wrapperClasses}
      />
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';

interface AssetViewerProps {
  content?: string;
  presentationId: string;
  /** Key that changes when content should be force-reloaded */
  reloadKey?: number;
  /** File path for container tab navigation (FR-24) - fetched and injected via srcdoc */
  indexFile?: string;
}

// Script injected into iframe to forward keyboard events to parent
const KEYBOARD_FORWARD_SCRIPT = `
<script>
(function() {
  document.addEventListener('keydown', function(e) {
    // Forward FliDeck control keys to parent
    var shouldForward = false;

    // Escape - always forward
    if (e.key === 'Escape') shouldForward = true;

    // F key (without modifiers) - toggle presentation mode
    if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey) shouldForward = true;

    // Ctrl/Cmd + Arrow keys - FliDeck navigation
    if ((e.ctrlKey || e.metaKey) && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
      shouldForward = true;
      e.preventDefault(); // Prevent browser default for these combos
    }

    if (shouldForward) {
      window.parent.postMessage({
        type: 'flideck-keydown',
        key: e.key,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey
      }, '*');
    }
  });
})();
</script>
`;

// Script injected into tab index pages to intercept card/link clicks and notify parent
// Sends flideck:navigate so FliDeck can update state and load the slide via srcdoc
const NAV_BRIDGE_SCRIPT = `
<script>
(function() {
  function sendNavigate(filename) {
    window.parent.postMessage({ type: 'flideck:navigate', slide: filename }, '*');
  }

  function getRelativeFilename(href) {
    // Only handle relative hrefs that point to .html files within the presentation
    if (!href || href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')) {
      return null;
    }
    // Strip query string and hash
    var clean = href.split('?')[0].split('#')[0];
    // Must end in .html and must not be an absolute path
    if (!clean.endsWith('.html') || clean.startsWith('/')) {
      return null;
    }
    // Return just the filename (last segment)
    return clean.split('/').pop() || null;
  }

  document.addEventListener('click', function(e) {
    var el = e.target;
    // Walk up the DOM to find an <a> tag
    while (el && el.tagName !== 'A') {
      el = el.parentElement;
    }
    if (!el || el.tagName !== 'A') return;

    var href = el.getAttribute('href');
    var filename = getRelativeFilename(href);
    if (filename) {
      e.preventDefault();
      sendNavigate(filename);
    }
  }, true);
})();
</script>
`;

/**
 * Inject bridge scripts into HTML content.
 * Inserts base tag, cache buster, keyboard forward script, and nav bridge script after <head>.
 * Falls back to prepending if no <head> tag is present.
 */
function injectBridgeScripts(html: string, baseUrl: string, cacheBuster: string): string {
  const injection = `<base href="${baseUrl}">${cacheBuster}${KEYBOARD_FORWARD_SCRIPT}${NAV_BRIDGE_SCRIPT}`;
  const headMatch = html.match(/<head>/i);
  if (headMatch && headMatch.index !== undefined) {
    const insertAt = headMatch.index + headMatch[0].length;
    return html.slice(0, insertAt) + injection + html.slice(insertAt);
  }
  // Fallback: prepend to document
  return injection + html;
}

/**
 * Renders HTML asset content in an iframe for isolation.
 * Uses srcdoc for ALL content (regular assets and container tab index files).
 * For tab index files, fetches the HTML then injects bridge scripts into srcdoc.
 * This ensures keyboard bridge and nav bridge are always present (BUG-15 fix).
 * Reloads automatically when reloadKey changes (triggered by file system changes).
 */
export function AssetViewer({
  content,
  presentationId,
  reloadKey = 0,
  indexFile,
}: AssetViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loadError, setLoadError] = useState(false);

  // Container tab mode: Fetch HTML and inject bridge scripts into srcdoc (BUG-15 fix)
  useEffect(() => {
    if (!indexFile) return;

    let cancelled = false;

    const baseUrl = `/presentations/${presentationId}/`;
    const fetchUrl = `${baseUrl}${indexFile}?_reload=${reloadKey}`;

    setLoadError(false);

    fetch(fetchUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load ${indexFile}: ${res.status}`);
        return res.text();
      })
      .then((html) => {
        if (cancelled || !iframeRef.current) return;
        const cacheBuster =
          reloadKey > 0
            ? `<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">`
            : '';
        const enhanced = injectBridgeScripts(html, baseUrl, cacheBuster);
        // Clear src before setting srcdoc to avoid confusion
        iframeRef.current.removeAttribute('src');
        iframeRef.current.srcdoc = enhanced;
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [indexFile, presentationId, reloadKey]);

  // Regular asset mode: Use srcdoc with injected scripts
  useEffect(() => {
    if (!indexFile && content && iframeRef.current) {
      // Add base tag for relative resource paths
      const baseUrl = `/presentations/${presentationId}/`;

      // Add cache-busting meta tag when reloading
      const cacheBuster =
        reloadKey > 0
          ? `<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">`
          : '';

      const contentWithBase = injectBridgeScripts(content, baseUrl, cacheBuster);

      // Clear src before setting srcdoc to avoid confusion
      iframeRef.current.removeAttribute('src');
      // Update srcdoc to trigger iframe reload
      iframeRef.current.srcdoc = contentWithBase;
      setLoadError(false); // Reset error state
    }
  }, [content, presentationId, reloadKey, indexFile]);

  return (
    <div className="flex-1 bg-white overflow-hidden relative">
      <iframe
        ref={iframeRef}
        className="w-full h-full border-0"
        sandbox="allow-scripts allow-same-origin"
        title="Asset Preview"
        style={{ display: loadError ? 'none' : 'block' }}
      />
      {loadError && indexFile && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ backgroundColor: '#342d2d' }}
        >
          <div className="text-center p-8">
            <h2
              className="text-2xl font-semibold mb-2"
              style={{ color: '#ccba9d', fontFamily: "'Oswald', Arial, sans-serif" }}
            >
              File Not Found
            </h2>
            <p className="text-sm mb-4" style={{ color: '#999' }}>
              The index file{' '}
              <code
                className="px-2 py-1 rounded"
                style={{ backgroundColor: '#4a4040', color: '#ffde59' }}
              >
                {indexFile}
              </code>{' '}
              could not be loaded.
            </p>
            <p className="text-xs" style={{ color: '#666' }}>
              Make sure the file exists in the presentation folder.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

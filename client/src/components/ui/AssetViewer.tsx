import { useEffect, useRef, useState } from 'react';

interface AssetViewerProps {
  content?: string;
  presentationId: string;
  /** Key that changes when content should be force-reloaded */
  reloadKey?: number;
  /** File path for container tab navigation (FR-24) - if provided, uses src instead of srcdoc */
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

/**
 * Renders HTML asset content in an iframe for isolation.
 * Uses srcdoc for regular assets (complete isolation from app styles).
 * Uses src for container tab index files (FR-24).
 * Injects a script to forward keyboard events to parent for FliDeck controls.
 * Reloads automatically when reloadKey changes (triggered by file system changes).
 */
export function AssetViewer({ content, presentationId, reloadKey = 0, indexFile }: AssetViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loadError, setLoadError] = useState(false);

  // Container tab mode: Use src with index file
  useEffect(() => {
    if (indexFile && iframeRef.current) {
      const baseUrl = `/presentations/${presentationId}/`;
      const src = `${baseUrl}${indexFile}?_reload=${reloadKey}`;
      // IMPORTANT: Clear srcdoc first - it takes precedence over src per HTML spec
      iframeRef.current.removeAttribute('srcdoc');
      iframeRef.current.src = src;
      setLoadError(false); // Reset error state on new load
      return;
    }
  }, [indexFile, presentationId, reloadKey]);

  // Regular asset mode: Use srcdoc with injected scripts
  useEffect(() => {
    if (!indexFile && content && iframeRef.current) {
      // Add base tag for relative resource paths
      const baseUrl = `/presentations/${presentationId}/`;

      // Add cache-busting meta tag when reloading
      const cacheBuster = reloadKey > 0
        ? `<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">`
        : '';

      const contentWithBase = content.replace(
        '<head>',
        `<head><base href="${baseUrl}">${cacheBuster}${KEYBOARD_FORWARD_SCRIPT}`
      );

      // Clear src before setting srcdoc to avoid confusion
      iframeRef.current.removeAttribute('src');
      // Update srcdoc to trigger iframe reload
      iframeRef.current.srcdoc = contentWithBase;
      setLoadError(false); // Reset error state
    }
  }, [content, presentationId, reloadKey, indexFile]);

  // Listen for iframe load errors (FR-24: missing index files)
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !indexFile) return;

    const handleError = () => {
      setLoadError(true);
    };

    iframe.addEventListener('error', handleError);
    return () => iframe.removeEventListener('error', handleError);
  }, [indexFile]);

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
              The index file <code className="px-2 py-1 rounded" style={{ backgroundColor: '#4a4040', color: '#ffde59' }}>{indexFile}</code> could not be loaded.
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

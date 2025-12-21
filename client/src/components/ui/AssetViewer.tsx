import { useEffect, useRef } from 'react';

interface AssetViewerProps {
  content: string;
  presentationId: string;
  /** Key that changes when content should be force-reloaded */
  reloadKey?: number;
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
 * Uses srcdoc for complete isolation from app styles.
 * Injects a script to forward keyboard events to parent for FliDeck controls.
 * Reloads automatically when reloadKey changes (triggered by file system changes).
 */
export function AssetViewer({ content, presentationId, reloadKey = 0 }: AssetViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Inject base URL and keyboard forwarding script
  // Also reloads when reloadKey changes (file system change detected)
  useEffect(() => {
    if (iframeRef.current) {
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

      // Update srcdoc to trigger iframe reload
      iframeRef.current.srcdoc = contentWithBase;
    }
  }, [content, presentationId, reloadKey]);

  return (
    <div className="flex-1 bg-white overflow-hidden">
      <iframe
        ref={iframeRef}
        className="w-full h-full border-0"
        sandbox="allow-scripts allow-same-origin"
        title="Asset Preview"
      />
    </div>
  );
}

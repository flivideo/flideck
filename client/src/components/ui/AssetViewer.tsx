import { useEffect, useRef } from 'react';

interface AssetViewerProps {
  content: string;
  presentationId: string;
}

/**
 * Renders HTML asset content in an iframe for isolation.
 * Uses srcdoc for complete isolation from app styles.
 */
export function AssetViewer({ content, presentationId }: AssetViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Inject base URL for relative paths
  useEffect(() => {
    if (iframeRef.current) {
      // Add base tag for relative resource paths
      const baseUrl = `/presentations/${presentationId}/`;
      const contentWithBase = content.replace(
        '<head>',
        `<head><base href="${baseUrl}">`
      );

      // Update srcdoc
      iframeRef.current.srcdoc = contentWithBase;
    }
  }, [content, presentationId]);

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

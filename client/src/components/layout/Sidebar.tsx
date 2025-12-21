import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import type { Presentation, Asset } from '@flideck/shared';
import { api } from '../../utils/api';
import { useModifierKey } from '../../hooks/useModifierKey';

interface SidebarProps {
  presentations: Presentation[];
  selectedPresentationId?: string;
  selectedAssetId?: string;
  onSelectPresentation: (id: string) => void;
  onSelectAsset: (presentationId: string, assetId: string) => void;
  onAssetsReordered?: () => void;
  /** Whether to show the presentations list (default: true). Set false on PresentationPage. */
  showPresentations?: boolean;
}

/**
 * Sidebar for navigating presentations and assets.
 * Supports drag-and-drop reordering of assets.
 */
export function Sidebar({
  presentations,
  selectedPresentationId,
  selectedAssetId,
  onSelectPresentation,
  onSelectAsset,
  onAssetsReordered,
  showPresentations = true,
}: SidebarProps) {
  const selectedPresentation = presentations.find(
    (p) => p.id === selectedPresentationId
  );

  // Drag-and-drop state
  const [draggedAssetId, setDraggedAssetId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  // Copy path state
  const isAltPressed = useModifierKey('Alt');
  const [hoveredAssetId, setHoveredAssetId] = useState<string | null>(null);
  const [isHeaderHovered, setIsHeaderHovered] = useState(false);

  // Copy handlers
  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Copied ${label}`);
    } catch (err) {
      toast.error('Failed to copy to clipboard');
      console.error('Copy failed:', err);
    }
  }, []);

  const copyAssetPath = useCallback((asset: Asset, format: 'url' | 'abs' | 'rel') => {
    if (!selectedPresentation) return;

    let text: string;
    let label: string;

    switch (format) {
      case 'url':
        text = asset.url || '';
        label = 'URL';
        break;
      case 'abs':
        text = `${selectedPresentation.path}/${asset.filename}`;
        label = 'absolute path';
        break;
      case 'rel':
        text = `${selectedPresentation.id}/${asset.filename}`;
        label = 'relative path';
        break;
    }

    copyToClipboard(text, label);
  }, [selectedPresentation, copyToClipboard]);

  const copyAllPaths = useCallback((format: 'url' | 'abs' | 'rel') => {
    if (!selectedPresentation) return;

    const paths = selectedPresentation.assets.map((asset) => {
      switch (format) {
        case 'url':
          return asset.url || '';
        case 'abs':
          return `${selectedPresentation.path}/${asset.filename}`;
        case 'rel':
          return `${selectedPresentation.id}/${asset.filename}`;
      }
    });

    const text = paths.join('\n');
    const label = format === 'url' ? 'all URLs' : format === 'abs' ? 'all absolute paths' : 'all relative paths';
    copyToClipboard(text, label);
  }, [selectedPresentation, copyToClipboard]);

  const handleDragStart = useCallback((e: React.DragEvent, assetId: string) => {
    setDraggedAssetId(assetId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', assetId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, assetId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (assetId !== draggedAssetId) {
      setDropTargetId(assetId);
    }
  }, [draggedAssetId]);

  const handleDragLeave = useCallback(() => {
    setDropTargetId(null);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedAssetId(null);
    setDropTargetId(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetAssetId: string) => {
    e.preventDefault();

    if (!selectedPresentation || !draggedAssetId || draggedAssetId === targetAssetId) {
      handleDragEnd();
      return;
    }

    const assets = [...selectedPresentation.assets];
    const draggedIndex = assets.findIndex((a) => a.id === draggedAssetId);
    const targetIndex = assets.findIndex((a) => a.id === targetAssetId);

    if (draggedIndex === -1 || targetIndex === -1) {
      handleDragEnd();
      return;
    }

    // Remove dragged item and insert at new position
    const [draggedItem] = assets.splice(draggedIndex, 1);
    assets.splice(targetIndex, 0, draggedItem);

    // Get new order as filenames
    const newOrder = assets.map((a) => a.filename);

    // Save to server
    try {
      await api.put(`/api/presentations/${selectedPresentation.id}/order`, { order: newOrder });
      onAssetsReordered?.();
    } catch (error) {
      console.error('Failed to save asset order:', error);
    }

    handleDragEnd();
  }, [selectedPresentation, draggedAssetId, handleDragEnd, onAssetsReordered]);

  return (
    <aside
      className="w-64 flex flex-col overflow-hidden border-r"
      style={{ backgroundColor: '#3d3535', borderColor: '#4a4040' }}
    >
      {/* Assets List (at top for visibility during recording) */}
      {selectedPresentation && (
        <div className="flex-1 overflow-y-auto">
          <div
            className="p-3 border-b"
            style={{ borderColor: '#4a4040' }}
            onMouseEnter={() => setIsHeaderHovered(true)}
            onMouseLeave={() => setIsHeaderHovered(false)}
          >
            <h2
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: '#ccba9d', fontFamily: "'Oswald', Arial, sans-serif" }}
            >
              Assets
            </h2>
            {isAltPressed && isHeaderHovered && (
              <div className="flex gap-1 mt-2">
                <button
                  onClick={(e) => { e.stopPropagation(); copyAllPaths('url'); }}
                  className="px-2 py-0.5 text-xs rounded transition-colors"
                  style={{ backgroundColor: '#4a4040', color: '#ffffff' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ccba9d'; e.currentTarget.style.color = '#342d2d'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#4a4040'; e.currentTarget.style.color = '#ffffff'; }}
                >
                  URL
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); copyAllPaths('abs'); }}
                  className="px-2 py-0.5 text-xs rounded transition-colors"
                  style={{ backgroundColor: '#4a4040', color: '#ffffff' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ccba9d'; e.currentTarget.style.color = '#342d2d'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#4a4040'; e.currentTarget.style.color = '#ffffff'; }}
                >
                  ABS
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); copyAllPaths('rel'); }}
                  className="px-2 py-0.5 text-xs rounded transition-colors"
                  style={{ backgroundColor: '#4a4040', color: '#ffffff' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ccba9d'; e.currentTarget.style.color = '#342d2d'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#4a4040'; e.currentTarget.style.color = '#ffffff'; }}
                >
                  REL
                </button>
              </div>
            )}
          </div>
          <nav className="p-2">
            {selectedPresentation.assets.map((asset: Asset) => {
              const isDragging = draggedAssetId === asset.id;
              const isDropTarget = dropTargetId === asset.id;
              const isSelected = selectedAssetId === asset.id;
              const isHovered = hoveredAssetId === asset.id;
              const showCopyButtons = isAltPressed && isHovered;

              return (
                <div
                  key={asset.id}
                  onMouseEnter={() => setHoveredAssetId(asset.id)}
                  onMouseLeave={() => setHoveredAssetId(null)}
                >
                  <button
                    draggable
                    onDragStart={(e) => handleDragStart(e, asset.id)}
                    onDragOver={(e) => handleDragOver(e, asset.id)}
                    onDragLeave={handleDragLeave}
                    onDragEnd={handleDragEnd}
                    onDrop={(e) => handleDrop(e, asset.id)}
                    onClick={() =>
                      onSelectAsset(selectedPresentation.id, asset.id)
                    }
                    className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center"
                    style={{
                      backgroundColor: isDropTarget
                        ? '#ffde59'
                        : isSelected
                          ? '#ffde59'
                          : isHovered
                            ? '#4a4040'
                            : 'transparent',
                      color: isDropTarget || isSelected ? '#342d2d' : '#ffffff',
                      opacity: isDragging ? 0.5 : 1,
                      cursor: 'grab',
                      borderTop: isDropTarget ? '2px solid #ccba9d' : '2px solid transparent',
                    }}
                  >
                    <span
                      className="mr-2 text-xs cursor-grab"
                      style={{ color: isSelected || isDropTarget ? '#342d2d' : '#595959' }}
                      title="Drag to reorder"
                    >
                      ⋮⋮
                    </span>
                    {asset.isIndex && (
                      <span
                        className="mr-2 text-xs px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: '#ccba9d', color: '#342d2d' }}
                      >
                        index
                      </span>
                    )}
                    {asset.name}
                  </button>
                  {showCopyButtons && (
                    <div className="flex gap-1 pl-3 pb-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); copyAssetPath(asset, 'url'); }}
                        className="px-2 py-0.5 text-xs rounded transition-colors"
                        style={{ backgroundColor: '#4a4040', color: '#ffffff' }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ccba9d'; e.currentTarget.style.color = '#342d2d'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#4a4040'; e.currentTarget.style.color = '#ffffff'; }}
                      >
                        URL
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); copyAssetPath(asset, 'abs'); }}
                        className="px-2 py-0.5 text-xs rounded transition-colors"
                        style={{ backgroundColor: '#4a4040', color: '#ffffff' }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ccba9d'; e.currentTarget.style.color = '#342d2d'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#4a4040'; e.currentTarget.style.color = '#ffffff'; }}
                      >
                        ABS
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); copyAssetPath(asset, 'rel'); }}
                        className="px-2 py-0.5 text-xs rounded transition-colors"
                        style={{ backgroundColor: '#4a4040', color: '#ffffff' }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ccba9d'; e.currentTarget.style.color = '#342d2d'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#4a4040'; e.currentTarget.style.color = '#ffffff'; }}
                      >
                        REL
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      )}

      {/* Presentations List (shown on HomePage, hidden on PresentationPage) */}
      {showPresentations && (
        <div className={`overflow-y-auto ${selectedPresentation ? 'border-t' : 'flex-1'}`} style={{ borderColor: '#4a4040' }}>
          <div className="p-3 border-b" style={{ borderColor: '#4a4040' }}>
            <h2
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: '#ccba9d', fontFamily: "'Oswald', Arial, sans-serif" }}
            >
              Presentations
            </h2>
          </div>
          <nav className="p-2">
            {presentations.length === 0 ? (
              <p className="text-sm p-2" style={{ color: '#595959' }}>No presentations found</p>
            ) : (
              presentations.map((presentation) => (
                <button
                  key={presentation.id}
                  onClick={() => onSelectPresentation(presentation.id)}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
                  style={{
                    backgroundColor: selectedPresentationId === presentation.id ? '#ffde59' : 'transparent',
                    color: selectedPresentationId === presentation.id ? '#342d2d' : '#ffffff'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedPresentationId !== presentation.id) {
                      e.currentTarget.style.backgroundColor = '#4a4040';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedPresentationId !== presentation.id) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  {presentation.name}
                  <span
                    className="ml-2 text-xs"
                    style={{ color: selectedPresentationId === presentation.id ? '#342d2d' : '#ccba9d', opacity: 0.8 }}
                  >
                    ({presentation.assets.length})
                  </span>
                </button>
              ))
            )}
          </nav>
        </div>
      )}
    </aside>
  );
}

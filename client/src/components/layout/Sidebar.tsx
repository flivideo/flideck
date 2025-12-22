import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
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

interface GroupedAssets {
  groupId: string;
  label: string;
  order: number;
  assets: Asset[];
}

/**
 * Sidebar for navigating presentations and assets.
 * Supports drag-and-drop reordering of assets and group-based organization.
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

  // Undo state - stores previous order for Cmd+Z
  const previousOrderRef = useRef<{ presentationId: string; order: string[] } | null>(null);

  // Collapsed groups state (persisted in localStorage)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('flideck-collapsed-groups');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Copy path state
  const isAltPressed = useModifierKey('Alt');
  const [hoveredAssetId, setHoveredAssetId] = useState<string | null>(null);
  const [isHeaderHovered, setIsHeaderHovered] = useState(false);

  // Find the index asset (shown separately at top)
  const indexAsset = useMemo(() => {
    return selectedPresentation?.assets.find((a) => a.isIndex) || null;
  }, [selectedPresentation]);

  // Group assets by their group property (excluding index)
  const groupedAssets = useMemo((): GroupedAssets[] => {
    if (!selectedPresentation) return [];

    const groups = selectedPresentation.groups || {};
    const assetsByGroup = new Map<string, Asset[]>();

    // Group assets (excluding index)
    for (const asset of selectedPresentation.assets) {
      if (asset.isIndex) continue; // Index shown separately at top
      const groupId = asset.group || '__ungrouped__';
      if (!assetsByGroup.has(groupId)) {
        assetsByGroup.set(groupId, []);
      }
      assetsByGroup.get(groupId)!.push(asset);
    }

    // Build grouped assets array
    const result: GroupedAssets[] = [];

    // Add defined groups in order
    const sortedGroups = Object.entries(groups)
      .sort(([, a], [, b]) => a.order - b.order);

    for (const [groupId, def] of sortedGroups) {
      const assets = assetsByGroup.get(groupId) || [];
      if (assets.length > 0) {
        result.push({
          groupId,
          label: def.label,
          order: def.order,
          assets,
        });
        assetsByGroup.delete(groupId);
      }
    }

    // Add any remaining groups (not defined but referenced by assets)
    for (const [groupId, assets] of assetsByGroup) {
      if (groupId !== '__ungrouped__' && assets.length > 0) {
        result.push({
          groupId,
          label: groupId.charAt(0).toUpperCase() + groupId.slice(1).replace(/-/g, ' '),
          order: 9999,
          assets,
        });
      }
    }

    return result;
  }, [selectedPresentation]);

  // Get root-level assets (no group, excluding index) - shown without a header
  const rootAssets = useMemo(() => {
    if (!selectedPresentation) return [];
    return selectedPresentation.assets.filter(
      (a) => !a.isIndex && !a.group
    );
  }, [selectedPresentation]);

  // Toggle group collapse
  const toggleGroup = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      // Save to localStorage
      try {
        localStorage.setItem('flideck-collapsed-groups', JSON.stringify([...next]));
      } catch {
        // Ignore localStorage errors
      }
      return next;
    });
  }, []);

  // Undo last reorder (Cmd+Z / Ctrl+Z)
  const handleUndo = useCallback(async () => {
    const prev = previousOrderRef.current;
    if (!prev) return;

    try {
      await api.put(`/api/presentations/${prev.presentationId}/order`, { order: prev.order });
      previousOrderRef.current = null; // Clear after undo
      onAssetsReordered?.();
      toast.success('Reorder undone');
    } catch (error) {
      console.error('Failed to undo reorder:', error);
      toast.error('Failed to undo');
    }
  }, [onAssetsReordered]);

  // Listen for Cmd+Z / Ctrl+Z
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        if (previousOrderRef.current) {
          e.preventDefault();
          handleUndo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo]);

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

    // Save previous order for undo (Cmd+Z)
    const previousOrder = selectedPresentation.assets.map((a) => a.filename);
    previousOrderRef.current = {
      presentationId: selectedPresentation.id,
      order: previousOrder,
    };

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
      previousOrderRef.current = null; // Clear on error
    }

    handleDragEnd();
  }, [selectedPresentation, draggedAssetId, handleDragEnd, onAssetsReordered]);

  // Render the index row (special styling, shows presentation name)
  const renderIndexRow = (asset: Asset) => {
    const isDragging = draggedAssetId === asset.id;
    const isDropTarget = dropTargetId === asset.id;
    const isSelected = selectedAssetId === asset.id;
    const isHovered = hoveredAssetId === asset.id;
    const showCopyButtons = isAltPressed && isHovered;
    const displayName = selectedPresentation?.name || 'Index';

    return (
      <div
        key={asset.id}
        className="mb-2"
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
          onClick={() => onSelectAsset(selectedPresentation!.id, asset.id)}
          className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center"
          style={{
            backgroundColor: isDropTarget
              ? '#ffde59'
              : isSelected
                ? '#ccba9d' // Gold when selected (distinct from yellow)
                : '#4a4040', // Subtle background when not selected
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
          <span className="truncate font-medium">{displayName}</span>
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
  };

  // Render a single asset row
  const renderAssetRow = (asset: Asset) => {
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
            onSelectAsset(selectedPresentation!.id, asset.id)
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
          {asset.recommended && (
            <span
              className="mr-2 text-xs"
              style={{ color: '#ffde59' }}
              title="Recommended"
            >
              ★
            </span>
          )}
          <span className="truncate">{asset.name}</span>
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
  };

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
            {/* Index always shown at top, outside groups */}
            {indexAsset && renderIndexRow(indexAsset)}

            {/* Root-level assets (no group) - shown without a header */}
            {rootAssets.map(renderAssetRow)}

            {/* Groups with collapsible headers */}
            {groupedAssets.map((group) => {
              const isCollapsed = collapsedGroups.has(group.groupId);

              return (
                <div key={group.groupId} className="mb-2 mt-2">
                  {/* Group Header */}
                  <button
                    onClick={() => toggleGroup(group.groupId)}
                    className="w-full text-left px-2 py-1.5 flex items-center text-xs font-semibold uppercase tracking-wide transition-colors rounded"
                    style={{
                      color: '#ccba9d',
                      fontFamily: "'Oswald', Arial, sans-serif",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4a4040'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <span
                      className="mr-2 transition-transform"
                      style={{
                        display: 'inline-block',
                        transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                      }}
                    >
                      ▼
                    </span>
                    <span className="flex-1">{group.label}</span>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded ml-2"
                      style={{ backgroundColor: '#4a4040', color: '#ccba9d' }}
                    >
                      {group.assets.length}
                    </span>
                  </button>

                  {/* Group Assets */}
                  {!isCollapsed && (
                    <div className="pl-4 mt-1">
                      {group.assets.map(renderAssetRow)}
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

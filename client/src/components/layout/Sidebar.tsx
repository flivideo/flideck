import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { Presentation, Asset } from '@flideck/shared';
import { api } from '../../utils/api';

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

  // Copy path menu state (FR-17 style dropdown)
  const [copyMenuOpenAssetId, setCopyMenuOpenAssetId] = useState<string | null>(null);
  const [isHeaderCopyMenuOpen, setIsHeaderCopyMenuOpen] = useState(false);
  const [hoveredAssetId, setHoveredAssetId] = useState<string | null>(null);

  // Group management state (FR-17)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupLabel, setEditingGroupLabel] = useState('');
  const [menuOpenGroupId, setMenuOpenGroupId] = useState<string | null>(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupLabel, setNewGroupLabel] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const newGroupInputRef = useRef<HTMLInputElement>(null);

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

  // FR-17: Group management handlers
  const startEditingGroup = useCallback((groupId: string, currentLabel: string) => {
    setEditingGroupId(groupId);
    setEditingGroupLabel(currentLabel);
    setMenuOpenGroupId(null);
    // Focus input after render
    setTimeout(() => editInputRef.current?.focus(), 0);
  }, []);

  const cancelEditingGroup = useCallback(() => {
    setEditingGroupId(null);
    setEditingGroupLabel('');
  }, []);

  const saveGroupLabel = useCallback(async () => {
    if (!selectedPresentation || !editingGroupId || !editingGroupLabel.trim()) {
      cancelEditingGroup();
      return;
    }

    try {
      await api.put(
        `/api/presentations/${selectedPresentation.id}/groups/${editingGroupId}`,
        { label: editingGroupLabel.trim() }
      );
      onAssetsReordered?.();
      toast.success('Group renamed');
    } catch (error) {
      console.error('Failed to rename group:', error);
      toast.error('Failed to rename group');
    }
    cancelEditingGroup();
  }, [selectedPresentation, editingGroupId, editingGroupLabel, cancelEditingGroup, onAssetsReordered]);

  const deleteGroup = useCallback(async (groupId: string) => {
    if (!selectedPresentation) return;

    try {
      await api.delete(`/api/presentations/${selectedPresentation.id}/groups/${groupId}`);
      onAssetsReordered?.();
      toast.success('Group deleted');
    } catch (error) {
      console.error('Failed to delete group:', error);
      toast.error('Failed to delete group');
    }
    setMenuOpenGroupId(null);
  }, [selectedPresentation, onAssetsReordered]);

  const startCreatingGroup = useCallback(() => {
    setIsCreatingGroup(true);
    setNewGroupLabel('');
    // Focus input after render
    setTimeout(() => newGroupInputRef.current?.focus(), 0);
  }, []);

  const cancelCreatingGroup = useCallback(() => {
    setIsCreatingGroup(false);
    setNewGroupLabel('');
  }, []);

  const createGroup = useCallback(async () => {
    if (!selectedPresentation || !newGroupLabel.trim()) {
      cancelCreatingGroup();
      return;
    }

    // Generate ID from label (kebab-case)
    const id = newGroupLabel
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    if (!id) {
      toast.error('Invalid group name');
      return;
    }

    try {
      await api.post(`/api/presentations/${selectedPresentation.id}/groups`, {
        id,
        label: newGroupLabel.trim(),
      });
      onAssetsReordered?.();
      toast.success('Group created');
    } catch (error) {
      console.error('Failed to create group:', error);
      toast.error('Failed to create group');
    }
    cancelCreatingGroup();
  }, [selectedPresentation, newGroupLabel, cancelCreatingGroup, onAssetsReordered]);

  // Close menus when clicking outside
  useEffect(() => {
    const anyMenuOpen = menuOpenGroupId || copyMenuOpenAssetId || isHeaderCopyMenuOpen;
    if (!anyMenuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-group-menu]')) {
        setMenuOpenGroupId(null);
      }
      if (!target.closest('[data-copy-menu]')) {
        setCopyMenuOpenAssetId(null);
        setIsHeaderCopyMenuOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [menuOpenGroupId, copyMenuOpenAssetId, isHeaderCopyMenuOpen]);

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
    const isCopyMenuOpen = copyMenuOpenAssetId === asset.id;
    const displayName = selectedPresentation?.name || 'Index';

    return (
      <div
        key={asset.id}
        className="mb-2 relative flex items-center"
      >
        <button
          draggable
          onDragStart={(e) => handleDragStart(e, asset.id)}
          onDragOver={(e) => handleDragOver(e, asset.id)}
          onDragLeave={handleDragLeave}
          onDragEnd={handleDragEnd}
          onDrop={(e) => handleDrop(e, asset.id)}
          onClick={() => onSelectAsset(selectedPresentation!.id, asset.id)}
          className="flex-1 text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center"
          style={{
            backgroundColor: isDropTarget
              ? '#ffde59'
              : isSelected
                ? '#ccba9d'
                : '#4a4040',
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

        {/* Copy path menu */}
        <div className="relative" data-copy-menu>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setCopyMenuOpenAssetId(isCopyMenuOpen ? null : asset.id);
            }}
            className="p-1 ml-1 rounded transition-colors"
            style={{ color: '#595959' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4a4040'; e.currentTarget.style.color = '#ccba9d'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#595959'; }}
            title="Copy path"
          >
            ⋮
          </button>

          {isCopyMenuOpen && (
            <div
              className="absolute right-0 top-full mt-1 py-1 rounded shadow-lg z-10 min-w-[100px]"
              style={{ backgroundColor: '#4a4040' }}
            >
              <button
                onClick={(e) => { e.stopPropagation(); copyAssetPath(asset, 'url'); setCopyMenuOpenAssetId(null); }}
                className="w-full text-left px-3 py-1.5 text-sm transition-colors"
                style={{ color: '#ffffff' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#5a5050'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                Copy URL
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); copyAssetPath(asset, 'abs'); setCopyMenuOpenAssetId(null); }}
                className="w-full text-left px-3 py-1.5 text-sm transition-colors"
                style={{ color: '#ffffff' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#5a5050'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                Copy Absolute
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); copyAssetPath(asset, 'rel'); setCopyMenuOpenAssetId(null); }}
                className="w-full text-left px-3 py-1.5 text-sm transition-colors"
                style={{ color: '#ffffff' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#5a5050'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                Copy Relative
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render a single asset row
  const renderAssetRow = (asset: Asset) => {
    const isDragging = draggedAssetId === asset.id;
    const isDropTarget = dropTargetId === asset.id;
    const isSelected = selectedAssetId === asset.id;
    const isCopyMenuOpen = copyMenuOpenAssetId === asset.id;
    const isHovered = hoveredAssetId === asset.id;

    return (
      <div
        key={asset.id}
        className="relative flex items-center"
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
          className="flex-1 text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center"
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

        {/* Copy path menu - visible on hover */}
        {(isHovered || isCopyMenuOpen) && (
          <div className="relative" data-copy-menu>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCopyMenuOpenAssetId(isCopyMenuOpen ? null : asset.id);
              }}
              className="p-1 rounded transition-colors"
              style={{ color: '#595959' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4a4040'; e.currentTarget.style.color = '#ccba9d'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#595959'; }}
              title="Copy path"
            >
              ⋮
            </button>

            {isCopyMenuOpen && (
              <div
                className="absolute right-0 top-full mt-1 py-1 rounded shadow-lg z-10 min-w-[100px]"
                style={{ backgroundColor: '#4a4040' }}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); copyAssetPath(asset, 'url'); setCopyMenuOpenAssetId(null); }}
                  className="w-full text-left px-3 py-1.5 text-sm transition-colors"
                  style={{ color: '#ffffff' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#5a5050'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  Copy URL
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); copyAssetPath(asset, 'abs'); setCopyMenuOpenAssetId(null); }}
                  className="w-full text-left px-3 py-1.5 text-sm transition-colors"
                  style={{ color: '#ffffff' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#5a5050'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  Copy Absolute
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); copyAssetPath(asset, 'rel'); setCopyMenuOpenAssetId(null); }}
                  className="w-full text-left px-3 py-1.5 text-sm transition-colors"
                  style={{ color: '#ffffff' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#5a5050'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  Copy Relative
                </button>
              </div>
            )}
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
            className="p-3 border-b flex items-center justify-between"
            style={{ borderColor: '#4a4040' }}
          >
            <h2
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: '#ccba9d', fontFamily: "'Oswald', Arial, sans-serif" }}
            >
              Assets
            </h2>

            {/* Copy all paths menu */}
            <div className="relative" data-copy-menu>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsHeaderCopyMenuOpen(!isHeaderCopyMenuOpen);
                }}
                className="p-1 rounded transition-colors"
                style={{ color: '#595959' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4a4040'; e.currentTarget.style.color = '#ccba9d'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#595959'; }}
                title="Copy all paths"
              >
                ⋮
              </button>

              {isHeaderCopyMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-1 py-1 rounded shadow-lg z-10 min-w-[120px]"
                  style={{ backgroundColor: '#4a4040' }}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); copyAllPaths('url'); setIsHeaderCopyMenuOpen(false); }}
                    className="w-full text-left px-3 py-1.5 text-sm transition-colors"
                    style={{ color: '#ffffff' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#5a5050'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    Copy All URLs
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); copyAllPaths('abs'); setIsHeaderCopyMenuOpen(false); }}
                    className="w-full text-left px-3 py-1.5 text-sm transition-colors"
                    style={{ color: '#ffffff' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#5a5050'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    Copy All Absolute
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); copyAllPaths('rel'); setIsHeaderCopyMenuOpen(false); }}
                    className="w-full text-left px-3 py-1.5 text-sm transition-colors"
                    style={{ color: '#ffffff' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#5a5050'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    Copy All Relative
                  </button>
                </div>
              )}
            </div>
          </div>
          <nav className="p-2">
            {/* Index always shown at top, outside groups */}
            {indexAsset && renderIndexRow(indexAsset)}

            {/* Root-level assets (no group) - shown without a header */}
            {rootAssets.map(renderAssetRow)}

            {/* Groups with collapsible headers */}
            {groupedAssets.map((group) => {
              const isCollapsed = collapsedGroups.has(group.groupId);
              const isEditing = editingGroupId === group.groupId;
              const isMenuOpen = menuOpenGroupId === group.groupId;

              return (
                <div key={group.groupId} className="mb-2 mt-2">
                  {/* Group Header */}
                  {isEditing ? (
                    // Inline edit mode
                    <div className="flex items-center px-2 py-1">
                      <span className="mr-2" style={{ color: '#ccba9d' }}>▼</span>
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editingGroupLabel}
                        onChange={(e) => setEditingGroupLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveGroupLabel();
                          if (e.key === 'Escape') cancelEditingGroup();
                        }}
                        onBlur={saveGroupLabel}
                        className="flex-1 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide rounded border-none outline-none"
                        style={{
                          backgroundColor: '#4a4040',
                          color: '#ffffff',
                          fontFamily: "'Oswald', Arial, sans-serif",
                        }}
                      />
                    </div>
                  ) : (
                    // Normal display mode
                    <div className="relative flex items-center">
                      <button
                        onClick={() => toggleGroup(group.groupId)}
                        className="flex-1 text-left px-2 py-1.5 flex items-center text-xs font-semibold uppercase tracking-wide transition-colors rounded"
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

                      {/* Menu button */}
                      <div className="relative" data-group-menu>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenGroupId(isMenuOpen ? null : group.groupId);
                          }}
                          className="p-1 rounded transition-colors"
                          style={{ color: '#ccba9d' }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4a4040'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          ⋮
                        </button>

                        {/* Dropdown menu */}
                        {isMenuOpen && (
                          <div
                            className="absolute right-0 top-full mt-1 py-1 rounded shadow-lg z-10 min-w-[120px]"
                            style={{ backgroundColor: '#4a4040' }}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditingGroup(group.groupId, group.label);
                              }}
                              className="w-full text-left px-3 py-1.5 text-sm transition-colors"
                              style={{ color: '#ffffff' }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#5a5050'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                              Rename
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteGroup(group.groupId);
                              }}
                              className="w-full text-left px-3 py-1.5 text-sm transition-colors"
                              style={{ color: '#ff6b6b' }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#5a5050'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Group Assets */}
                  {!isCollapsed && (
                    <div className="pl-4 mt-1">
                      {group.assets.map(renderAssetRow)}
                    </div>
                  )}
                </div>
              );
            })}

            {/* New Group button/input */}
            {selectedPresentation && (
              <div className="mt-3 mb-2">
                {isCreatingGroup ? (
                  <div className="flex items-center px-2 py-1">
                    <span className="mr-2 text-xs" style={{ color: '#ccba9d' }}>+</span>
                    <input
                      ref={newGroupInputRef}
                      type="text"
                      value={newGroupLabel}
                      onChange={(e) => setNewGroupLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') createGroup();
                        if (e.key === 'Escape') cancelCreatingGroup();
                      }}
                      onBlur={() => {
                        if (newGroupLabel.trim()) {
                          createGroup();
                        } else {
                          cancelCreatingGroup();
                        }
                      }}
                      placeholder="Group name..."
                      className="flex-1 px-2 py-0.5 text-xs rounded border-none outline-none"
                      style={{
                        backgroundColor: '#4a4040',
                        color: '#ffffff',
                      }}
                    />
                  </div>
                ) : (
                  <button
                    onClick={startCreatingGroup}
                    className="w-full text-left px-2 py-1.5 text-xs transition-colors rounded"
                    style={{ color: '#595959' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#4a4040';
                      e.currentTarget.style.color = '#ccba9d';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#595959';
                    }}
                  >
                    + New Group
                  </button>
                )}
              </div>
            )}
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

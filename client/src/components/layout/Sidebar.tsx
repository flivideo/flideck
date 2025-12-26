import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { Presentation, Asset } from '@flideck/shared';
import { api } from '../../utils/api';
import { useDisplayMode } from '../../hooks/useDisplayMode';
import { getDisplayModeLabel } from '../../utils/displayMode';
import { SidebarFlat } from './SidebarFlat';
import { SidebarGrouped } from './SidebarGrouped';

interface SidebarProps {
  presentations: Presentation[];
  selectedPresentationId?: string;
  selectedAssetId?: string;
  onSelectPresentation: (id: string) => void;
  onSelectAsset: (presentationId: string, assetId: string) => void;
  onAssetsReordered?: () => void;
  showPresentations?: boolean;
  /** Active container tab ID for filtering (FR-24) */
  activeContainerTabId?: string | null;
  /** BUG-6: Collapsed groups state (lifted to PresentationPage for auto-expand) */
  collapsedGroups?: Set<string>;
  onSetCollapsedGroups?: React.Dispatch<React.SetStateAction<Set<string>>>;
}

interface GroupedAssets {
  groupId: string;
  label: string;
  order: number;
  assets: Asset[];
}

/**
 * Sidebar for navigating presentations and assets.
 * Supports multiple rendering modes: flat, grouped, tabbed.
 */
export function Sidebar({
  presentations,
  selectedPresentationId,
  selectedAssetId,
  onSelectPresentation,
  onSelectAsset,
  onAssetsReordered,
  showPresentations = true,
  activeContainerTabId,
  collapsedGroups: externalCollapsedGroups,
  onSetCollapsedGroups,
}: SidebarProps) {
  const selectedPresentation = presentations.find(
    (p) => p.id === selectedPresentationId
  );

  // Display mode management
  // FR-25: Display mode is orthogonal to container tabs (flat/grouped affects rendering, tabs filter content)
  const { mode, autoMode, hasOverride, setOverride, clearOverride } = useDisplayMode(selectedPresentation);

  // Drag-and-drop state
  const [draggedAssetId, setDraggedAssetId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  // Undo state
  const previousOrderRef = useRef<{ presentationId: string; order: string[] } | null>(null);

  // BUG-6: Use external collapsed groups state if provided, otherwise fallback to local state
  const [localCollapsedGroups, setLocalCollapsedGroups] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('flideck-collapsed-groups');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const collapsedGroups = externalCollapsedGroups ?? localCollapsedGroups;
  const setCollapsedGroups = onSetCollapsedGroups ?? setLocalCollapsedGroups;

  // Copy path menu state
  const [copyMenuOpenAssetId, setCopyMenuOpenAssetId] = useState<string | null>(null);
  const [isHeaderCopyMenuOpen, setIsHeaderCopyMenuOpen] = useState(false);
  const [hoveredAssetId, setHoveredAssetId] = useState<string | null>(null);

  // Group management state (for grouped mode)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupLabel, setEditingGroupLabel] = useState('');
  const [menuOpenGroupId, setMenuOpenGroupId] = useState<string | null>(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupLabel, setNewGroupLabel] = useState('');


  // Mode switcher dropdown state
  const [isModeSwitcherOpen, setIsModeSwitcherOpen] = useState(false);

  // Find the index asset (shown separately at top in grouped mode)
  const indexAsset = useMemo(() => {
    return selectedPresentation?.assets.find((a) => a.isIndex) || null;
  }, [selectedPresentation]);

  // FR-24: Get set of tab index filenames to hide from sidebar
  const tabIndexFiles = useMemo(() => {
    if (!selectedPresentation?.tabs) return new Set<string>();
    return new Set(selectedPresentation.tabs.map((t) => t.file));
  }, [selectedPresentation?.tabs]);

  // Group assets by their group property (for grouped mode)
  // FR-24: Filter by active container tab if applicable
  const groupedAssets = useMemo((): GroupedAssets[] => {
    if (!selectedPresentation) return [];

    const groups = selectedPresentation.groups || {};
    const assetsByGroup = new Map<string, Asset[]>();

    for (const asset of selectedPresentation.assets) {
      if (asset.isIndex) continue;
      // FR-24: Hide tab index files from sidebar
      if (tabIndexFiles.has(asset.filename)) continue;
      const groupId = asset.group || '__ungrouped__';
      if (!assetsByGroup.has(groupId)) {
        assetsByGroup.set(groupId, []);
      }
      assetsByGroup.get(groupId)!.push(asset);
    }

    const result: GroupedAssets[] = [];
    const sortedGroups = Object.entries(groups).sort(([, a], [, b]) => a.order - b.order);

    for (const [groupId, def] of sortedGroups) {
      // FR-24: Filter by container tab if set
      if (activeContainerTabId && def.tabId && def.tabId !== activeContainerTabId) {
        continue;
      }

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
  }, [selectedPresentation, activeContainerTabId, tabIndexFiles]);

  // Get root-level assets (no group, excluding index and tab index files)
  // FR-25: Filter by active container tab if applicable (orphan assets show in all tabs)
  const rootAssets = useMemo(() => {
    if (!selectedPresentation) return [];
    return selectedPresentation.assets.filter(
      (a) => !a.isIndex && !a.group && !tabIndexFiles.has(a.filename)
      // Note: Ungrouped assets (no group property) appear in all tabs
      // This is the chosen solution for FR-25 open question #1
    );
  }, [selectedPresentation, tabIndexFiles]);

  // Toggle group collapse
  const toggleGroup = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      try {
        localStorage.setItem('flideck-collapsed-groups', JSON.stringify([...next]));
      } catch {
        // Ignore
      }
      return next;
    });
  }, []);

  // Group management handlers
  const startEditingGroup = useCallback((groupId: string, currentLabel: string) => {
    setEditingGroupId(groupId);
    setEditingGroupLabel(currentLabel);
    setMenuOpenGroupId(null);
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
  }, []);

  const cancelCreatingGroup = useCallback(() => {
    setIsCreatingGroup(false);
    setNewGroupLabel('');
  }, []);

  const createGroup = useCallback(async () => {
    if (!newGroupLabel.trim()) {
      cancelCreatingGroup();
      return;
    }

    if (!selectedPresentation) {
      console.error('createGroup called but selectedPresentation is undefined', {
        presentationsLength: presentations.length,
        selectedPresentationId,
      });
      toast.error('Unable to create group: presentation not loaded');
      cancelCreatingGroup();
      return;
    }

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
  }, [selectedPresentation, newGroupLabel, cancelCreatingGroup, onAssetsReordered, presentations, selectedPresentationId]);

  // Close menus when clicking outside
  useEffect(() => {
    const anyMenuOpen = menuOpenGroupId || copyMenuOpenAssetId || isHeaderCopyMenuOpen || isModeSwitcherOpen;
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
      if (!target.closest('[data-mode-switcher]')) {
        setIsModeSwitcherOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [menuOpenGroupId, copyMenuOpenAssetId, isHeaderCopyMenuOpen, isModeSwitcherOpen]);

  // Undo handler
  const handleUndo = useCallback(async () => {
    const prev = previousOrderRef.current;
    if (!prev) return;

    try {
      await api.put(`/api/presentations/${prev.presentationId}/order`, { order: prev.order });
      previousOrderRef.current = null;
      onAssetsReordered?.();
      toast.success('Reorder undone');
    } catch (error) {
      console.error('Failed to undo reorder:', error);
      toast.error('Failed to undo');
    }
  }, [onAssetsReordered]);

  // Undo keyboard shortcut
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

  // Drag-and-drop handlers
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
    const draggedAsset = assets.find((a) => a.id === draggedAssetId);
    const targetAsset = assets.find((a) => a.id === targetAssetId);
    const draggedIndex = assets.findIndex((a) => a.id === draggedAssetId);
    const targetIndex = assets.findIndex((a) => a.id === targetAssetId);

    if (draggedIndex === -1 || targetIndex === -1 || !draggedAsset || !targetAsset) {
      handleDragEnd();
      return;
    }

    // Check if moving between groups (cross-group drag)
    const sourceGroup = draggedAsset.group || null;
    const targetGroup = targetAsset.group || null;
    const isCrossGroupDrag = sourceGroup !== targetGroup;

    const previousOrder = selectedPresentation.assets.map((a) => a.filename);
    previousOrderRef.current = {
      presentationId: selectedPresentation.id,
      order: previousOrder,
    };

    try {
      // If cross-group drag, update the group assignment first
      if (isCrossGroupDrag) {
        await api.put(
          `/api/presentations/${selectedPresentation.id}/slides/${draggedAsset.id}`,
          { group: targetGroup }
        );
        toast.success(targetGroup ? `Moved to ${targetGroup}` : 'Moved to root');
      }

      // Then reorder
      const [draggedItem] = assets.splice(draggedIndex, 1);
      assets.splice(targetIndex, 0, draggedItem);
      const newOrder = assets.map((a) => a.filename);

      await api.put(`/api/presentations/${selectedPresentation.id}/order`, { order: newOrder });
      onAssetsReordered?.();
    } catch (error) {
      console.error('Failed to save asset order:', error);
      previousOrderRef.current = null;
      toast.error('Failed to move slide');
    }

    handleDragEnd();
  }, [selectedPresentation, draggedAssetId, handleDragEnd, onAssetsReordered]);

  // Drop to group handler (for grouped mode - dropping onto group headers)
  const handleDropToGroup = useCallback(async (_e: React.DragEvent, groupId: string | null) => {
    if (!selectedPresentation || !draggedAssetId) return;

    const draggedAsset = selectedPresentation.assets.find((a) => a.id === draggedAssetId);
    if (!draggedAsset) return;

    // Check if already in this group
    const currentGroup = draggedAsset.group || null;
    if (currentGroup === groupId) {
      handleDragEnd();
      return;
    }

    try {
      await api.put(
        `/api/presentations/${selectedPresentation.id}/slides/${draggedAsset.id}`,
        { group: groupId }
      );
      onAssetsReordered?.();
      toast.success(groupId ? `Moved to ${groupId}` : 'Moved to root');
    } catch (error) {
      console.error('Failed to move slide to group:', error);
      toast.error('Failed to move slide');
    }
    handleDragEnd();
  }, [selectedPresentation, draggedAssetId, onAssetsReordered, handleDragEnd]);

  // Render the index row (for grouped mode)
  const renderIndexRow = (asset: Asset) => {
    const isDragging = draggedAssetId === asset.id;
    const isDropTarget = dropTargetId === asset.id;
    const isSelected = selectedAssetId === asset.id;
    const isCopyMenuOpen = copyMenuOpenAssetId === asset.id;
    const displayName = selectedPresentation?.name || 'Index';

    return (
      <div key={asset.id} className="mb-2 relative flex items-center">
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
            backgroundColor: isDropTarget ? '#ffde59' : isSelected ? '#ccba9d' : '#4a4040',
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

        <div className="relative" data-copy-menu>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setCopyMenuOpenAssetId(isCopyMenuOpen ? null : asset.id);
            }}
            className="p-1 ml-1 rounded transition-colors"
            style={{ color: '#595959' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#4a4040';
              e.currentTarget.style.color = '#ccba9d';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#595959';
            }}
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
                onClick={(e) => {
                  e.stopPropagation();
                  copyAssetPath(asset, 'url');
                  setCopyMenuOpenAssetId(null);
                }}
                className="w-full text-left px-3 py-1.5 text-sm transition-colors"
                style={{ color: '#ffffff' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#5a5050';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                Copy URL
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  copyAssetPath(asset, 'abs');
                  setCopyMenuOpenAssetId(null);
                }}
                className="w-full text-left px-3 py-1.5 text-sm transition-colors"
                style={{ color: '#ffffff' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#5a5050';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                Copy Absolute
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  copyAssetPath(asset, 'rel');
                  setCopyMenuOpenAssetId(null);
                }}
                className="w-full text-left px-3 py-1.5 text-sm transition-colors"
                style={{ color: '#ffffff' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#5a5050';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                Copy Relative
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <aside
      className="w-64 flex flex-col overflow-hidden border-r"
      style={{ backgroundColor: '#3d3535', borderColor: '#4a4040' }}
    >
      {/* Assets List */}
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

            <div className="flex items-center gap-1">
              {/* Mode switcher */}
              <div className="relative" data-mode-switcher>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsModeSwitcherOpen(!isModeSwitcherOpen);
                  }}
                  className="px-2 py-1 rounded text-xs transition-colors"
                  style={{ color: '#ccba9d', backgroundColor: '#4a4040' }}
                  title={`Current mode: ${getDisplayModeLabel(mode)}${hasOverride ? ' (overridden)' : ''}`}
                >
                  {mode === 'flat' ? '☰' : mode === 'grouped' ? '⋮⋮⋮' : '▤'}
                </button>

                {isModeSwitcherOpen && (
                  <div
                    className="absolute right-0 top-full mt-1 py-1 rounded shadow-lg z-10 min-w-[140px]"
                    style={{ backgroundColor: '#4a4040' }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        clearOverride();
                        setIsModeSwitcherOpen(false);
                        toast.success(`Auto mode: ${getDisplayModeLabel(autoMode)}`);
                      }}
                      className="w-full text-left px-3 py-1.5 text-sm transition-colors"
                      style={{ color: !hasOverride ? '#ffde59' : '#ffffff' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#5a5050';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      Auto {!hasOverride && '✓'}
                    </button>
                    <div
                      className="my-1 border-t"
                      style={{ borderColor: '#595959' }}
                    />
                    {/* Only flat and grouped modes - tabbed renderer was removed in FR-24 */}
                    {(['flat', 'grouped'] as const).map((m) => (
                      <button
                        key={m}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOverride(m);
                          setIsModeSwitcherOpen(false);
                          toast.success(`Mode: ${getDisplayModeLabel(m)}`);
                        }}
                        className="w-full text-left px-3 py-1.5 text-sm transition-colors"
                        style={{
                          color: hasOverride && mode === m ? '#ffde59' : '#ffffff',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#5a5050';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        {getDisplayModeLabel(m)} {hasOverride && mode === m && '✓'}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Copy all paths menu */}
              <div className="relative" data-copy-menu>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsHeaderCopyMenuOpen(!isHeaderCopyMenuOpen);
                  }}
                  className="p-1 rounded transition-colors"
                  style={{ color: '#595959' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#4a4040';
                    e.currentTarget.style.color = '#ccba9d';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#595959';
                  }}
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
                      onClick={(e) => {
                        e.stopPropagation();
                        copyAllPaths('url');
                        setIsHeaderCopyMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-sm transition-colors"
                      style={{ color: '#ffffff' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#5a5050';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      Copy All URLs
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyAllPaths('abs');
                        setIsHeaderCopyMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-sm transition-colors"
                      style={{ color: '#ffffff' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#5a5050';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      Copy All Absolute
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyAllPaths('rel');
                        setIsHeaderCopyMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-sm transition-colors"
                      style={{ color: '#ffffff' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#5a5050';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      Copy All Relative
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mode-specific rendering */}
          {mode === 'flat' && (
            <div className="p-2">
              {indexAsset && renderIndexRow(indexAsset)}
              <SidebarFlat
                assets={selectedPresentation.assets.filter((a) => !a.isIndex)}
                selectedAssetId={selectedAssetId}
                draggedAssetId={draggedAssetId}
                dropTargetId={dropTargetId}
                hoveredAssetId={hoveredAssetId}
                copyMenuOpenAssetId={copyMenuOpenAssetId}
                onSelectAsset={(assetId) => onSelectAsset(selectedPresentation.id, assetId)}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDragEnd={handleDragEnd}
                onDrop={handleDrop}
                onHoverAsset={setHoveredAssetId}
                onToggleCopyMenu={setCopyMenuOpenAssetId}
                onCopyPath={copyAssetPath}
              />
            </div>
          )}

          {mode === 'grouped' && (
            <div className="p-2">
              {indexAsset && renderIndexRow(indexAsset)}
              <SidebarGrouped
                presentation={selectedPresentation}
                selectedAssetId={selectedAssetId}
                draggedAssetId={draggedAssetId}
                dropTargetId={dropTargetId}
                hoveredAssetId={hoveredAssetId}
                copyMenuOpenAssetId={copyMenuOpenAssetId}
                collapsedGroups={collapsedGroups}
                editingGroupId={editingGroupId}
                editingGroupLabel={editingGroupLabel}
                menuOpenGroupId={menuOpenGroupId}
                isCreatingGroup={isCreatingGroup}
                newGroupLabel={newGroupLabel}
                onSelectAsset={(assetId) => onSelectAsset(selectedPresentation.id, assetId)}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDragEnd={handleDragEnd}
                onDrop={handleDrop}
                onDropToGroup={handleDropToGroup}
                onHoverAsset={setHoveredAssetId}
                onToggleCopyMenu={setCopyMenuOpenAssetId}
                onCopyPath={copyAssetPath}
                onToggleGroup={toggleGroup}
                onStartEditingGroup={startEditingGroup}
                onCancelEditingGroup={cancelEditingGroup}
                onSaveGroupLabel={saveGroupLabel}
                onSetEditingGroupLabel={setEditingGroupLabel}
                onDeleteGroup={deleteGroup}
                onSetMenuOpenGroupId={setMenuOpenGroupId}
                onStartCreatingGroup={startCreatingGroup}
                onCancelCreatingGroup={cancelCreatingGroup}
                onCreateGroup={createGroup}
                onSetNewGroupLabel={setNewGroupLabel}
                groupedAssets={groupedAssets}
                rootAssets={rootAssets}
              />
            </div>
          )}

        </div>
      )}

      {/* Presentations List */}
      {showPresentations && (
        <div
          className={`overflow-y-auto ${selectedPresentation ? 'border-t' : 'flex-1'}`}
          style={{ borderColor: '#4a4040' }}
        >
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
              <p className="text-sm p-2" style={{ color: '#595959' }}>
                No presentations found
              </p>
            ) : (
              presentations.map((presentation) => (
                <button
                  key={presentation.id}
                  onClick={() => onSelectPresentation(presentation.id)}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
                  style={{
                    backgroundColor:
                      selectedPresentationId === presentation.id ? '#ffde59' : 'transparent',
                    color: selectedPresentationId === presentation.id ? '#342d2d' : '#ffffff',
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
                    style={{
                      color: selectedPresentationId === presentation.id ? '#342d2d' : '#ccba9d',
                      opacity: 0.8,
                    }}
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

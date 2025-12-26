import { useRef, useState, memo } from 'react';
import type { Asset, Presentation } from '@flideck/shared';

interface GroupedAssets {
  groupId: string;
  label: string;
  order: number;
  assets: Asset[];
}

interface SidebarGroupedProps {
  presentation: Presentation;
  selectedAssetId?: string;
  draggedAssetId: string | null;
  dropTargetId: string | null;
  hoveredAssetId: string | null;
  copyMenuOpenAssetId: string | null;
  collapsedGroups: Set<string>;
  editingGroupId: string | null;
  editingGroupLabel: string;
  menuOpenGroupId: string | null;
  isCreatingGroup: boolean;
  newGroupLabel: string;
  onSelectAsset: (assetId: string) => void;
  onDragStart: (e: React.DragEvent, assetId: string) => void;
  onDragOver: (e: React.DragEvent, assetId: string) => void;
  onDragLeave: () => void;
  onDragEnd: () => void;
  onDrop: (e: React.DragEvent, targetAssetId: string) => void;
  onDropToGroup?: (e: React.DragEvent, groupId: string | null) => void;
  onHoverAsset: (assetId: string | null) => void;
  onToggleCopyMenu: (assetId: string | null) => void;
  onCopyPath: (asset: Asset, format: 'url' | 'abs' | 'rel') => void;
  onToggleGroup: (groupId: string) => void;
  onStartEditingGroup: (groupId: string, label: string) => void;
  onCancelEditingGroup: () => void;
  onSaveGroupLabel: () => void;
  onSetEditingGroupLabel: (label: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onSetMenuOpenGroupId: (groupId: string | null) => void;
  onStartCreatingGroup: () => void;
  onCancelCreatingGroup: () => void;
  onCreateGroup: () => void;
  onSetNewGroupLabel: (label: string) => void;
  groupedAssets: GroupedAssets[];
  rootAssets: Asset[];
}

/**
 * Grouped mode: Collapsible section headers with slides underneath
 * Memoized to prevent unnecessary re-renders (BUG-7 performance fix)
 */
export const SidebarGrouped = memo(function SidebarGrouped(props: SidebarGroupedProps) {
  const editInputRef = useRef<HTMLInputElement>(null);
  const newGroupInputRef = useRef<HTMLInputElement>(null);
  const [dropTargetGroupId, setDropTargetGroupId] = useState<string | null>(null);
  const [isRootDropTarget, setIsRootDropTarget] = useState(false);

  // Handler for dragging over a group header
  const handleGroupDragOver = (e: React.DragEvent, groupId: string) => {
    if (!props.draggedAssetId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetGroupId(groupId);
  };

  const handleGroupDragLeave = () => {
    setDropTargetGroupId(null);
  };

  const handleGroupDrop = (e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    setDropTargetGroupId(null);
    if (props.onDropToGroup) {
      props.onDropToGroup(e, groupId);
    }
  };

  // Handler for dropping to root (ungrouped)
  const handleRootDragOver = (e: React.DragEvent) => {
    if (!props.draggedAssetId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsRootDropTarget(true);
  };

  const handleRootDragLeave = () => {
    setIsRootDropTarget(false);
  };

  const handleRootDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsRootDropTarget(false);
    if (props.onDropToGroup) {
      props.onDropToGroup(e, null); // null = move to root (ungrouped)
    }
  };

  const renderAssetRow = (asset: Asset) => {
    const isDragging = props.draggedAssetId === asset.id;
    const isDropTarget = props.dropTargetId === asset.id;
    const isSelected = props.selectedAssetId === asset.id;
    const isCopyMenuOpen = props.copyMenuOpenAssetId === asset.id;
    const isHovered = props.hoveredAssetId === asset.id;

    return (
      <div
        key={asset.id}
        className="relative flex items-center"
        onMouseEnter={() => props.onHoverAsset(asset.id)}
        onMouseLeave={() => props.onHoverAsset(null)}
      >
        <button
          draggable
          onDragStart={(e) => props.onDragStart(e, asset.id)}
          onDragOver={(e) => props.onDragOver(e, asset.id)}
          onDragLeave={props.onDragLeave}
          onDragEnd={props.onDragEnd}
          onDrop={(e) => props.onDrop(e, asset.id)}
          onClick={() => props.onSelectAsset(asset.id)}
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
                props.onToggleCopyMenu(isCopyMenuOpen ? null : asset.id);
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
                  onClick={(e) => { e.stopPropagation(); props.onCopyPath(asset, 'url'); props.onToggleCopyMenu(null); }}
                  className="w-full text-left px-3 py-1.5 text-sm transition-colors"
                  style={{ color: '#ffffff' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#5a5050'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  Copy URL
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); props.onCopyPath(asset, 'abs'); props.onToggleCopyMenu(null); }}
                  className="w-full text-left px-3 py-1.5 text-sm transition-colors"
                  style={{ color: '#ffffff' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#5a5050'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  Copy Absolute
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); props.onCopyPath(asset, 'rel'); props.onToggleCopyMenu(null); }}
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
    <div className="p-2">
      {/* Root drop zone - shown when dragging and there are no root assets */}
      {props.draggedAssetId && props.rootAssets.length === 0 && (
        <div
          onDragOver={handleRootDragOver}
          onDragLeave={handleRootDragLeave}
          onDrop={handleRootDrop}
          className="mb-2 px-3 py-2 rounded-lg text-sm text-center transition-colors"
          style={{
            backgroundColor: isRootDropTarget ? '#ffde59' : '#4a4040',
            color: isRootDropTarget ? '#342d2d' : '#595959',
            border: isRootDropTarget ? '2px solid #ccba9d' : '2px dashed #595959',
          }}
        >
          Drop here to move to root
        </div>
      )}

      {/* Root-level assets (no group) - shown without a header */}
      {props.rootAssets.length > 0 && (
        <div
          onDragOver={handleRootDragOver}
          onDragLeave={handleRootDragLeave}
          onDrop={handleRootDrop}
          style={{
            borderBottom: isRootDropTarget ? '2px solid #ffde59' : '2px solid transparent',
            paddingBottom: '4px',
            marginBottom: '4px',
          }}
        >
          {props.rootAssets.map(renderAssetRow)}
        </div>
      )}

      {/* Groups with collapsible headers */}
      {props.groupedAssets.map((group) => {
        const isCollapsed = props.collapsedGroups.has(group.groupId);
        const isEditing = props.editingGroupId === group.groupId;
        const isMenuOpen = props.menuOpenGroupId === group.groupId;

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
                  value={props.editingGroupLabel}
                  onChange={(e) => props.onSetEditingGroupLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') props.onSaveGroupLabel();
                    if (e.key === 'Escape') props.onCancelEditingGroup();
                  }}
                  onBlur={props.onSaveGroupLabel}
                  className="flex-1 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide rounded border-none outline-none"
                  style={{
                    backgroundColor: '#4a4040',
                    color: '#ffffff',
                    fontFamily: "'Oswald', Arial, sans-serif",
                  }}
                />
              </div>
            ) : (
              // Normal display mode - with drop zone support
              <div
                className="relative flex items-center"
                onDragOver={(e) => handleGroupDragOver(e, group.groupId)}
                onDragLeave={handleGroupDragLeave}
                onDrop={(e) => handleGroupDrop(e, group.groupId)}
                style={{
                  borderRadius: '6px',
                  border: dropTargetGroupId === group.groupId ? '2px solid #ffde59' : '2px solid transparent',
                  backgroundColor: dropTargetGroupId === group.groupId ? 'rgba(255, 222, 89, 0.1)' : 'transparent',
                }}
              >
                <button
                  onClick={() => props.onToggleGroup(group.groupId)}
                  className="flex-1 text-left px-2 py-1.5 flex items-center text-xs font-semibold uppercase tracking-wide transition-colors rounded"
                  style={{
                    color: dropTargetGroupId === group.groupId ? '#ffde59' : '#ccba9d',
                    fontFamily: "'Oswald', Arial, sans-serif",
                  }}
                  onMouseEnter={(e) => { if (dropTargetGroupId !== group.groupId) e.currentTarget.style.backgroundColor = '#4a4040'; }}
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
                    style={{ backgroundColor: '#4a4040', color: dropTargetGroupId === group.groupId ? '#ffde59' : '#ccba9d' }}
                  >
                    {group.assets.length}
                  </span>
                </button>

                {/* Menu button */}
                <div className="relative" data-group-menu>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onSetMenuOpenGroupId(isMenuOpen ? null : group.groupId);
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
                          props.onStartEditingGroup(group.groupId, group.label);
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
                          props.onDeleteGroup(group.groupId);
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
      <div className="mt-3 mb-2">
        {props.isCreatingGroup ? (
          <div className="flex items-center px-2 py-1">
            <span className="mr-2 text-xs" style={{ color: '#ccba9d' }}>+</span>
            <input
              ref={newGroupInputRef}
              type="text"
              value={props.newGroupLabel}
              onChange={(e) => props.onSetNewGroupLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') props.onCreateGroup();
                if (e.key === 'Escape') props.onCancelCreatingGroup();
              }}
              onBlur={() => {
                if (props.newGroupLabel.trim()) {
                  props.onCreateGroup();
                } else {
                  props.onCancelCreatingGroup();
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
            onClick={props.onStartCreatingGroup}
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
    </div>
  );
});

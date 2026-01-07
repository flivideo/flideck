import { memo } from 'react';
import type { Asset } from '@flideck/shared';

interface SidebarFlatProps {
  assets: Asset[];
  selectedAssetId?: string;
  draggedAssetId: string | null;
  dropTargetId: string | null;
  hoveredAssetId: string | null;
  copyMenuOpenAssetId: string | null;
  onSelectAsset: (assetId: string) => void;
  onDragStart: (e: React.DragEvent, assetId: string) => void;
  onDragOver: (e: React.DragEvent, assetId: string) => void;
  onDragLeave: () => void;
  onDragEnd: () => void;
  onDrop: (e: React.DragEvent, targetAssetId: string) => void;
  onHoverAsset: (assetId: string | null) => void;
  onToggleCopyMenu: (assetId: string | null) => void;
  onCopyPath: (asset: Asset, format: 'url' | 'abs' | 'rel') => void;
}

/**
 * Flat mode: All slides in a simple list
 * Memoized to prevent unnecessary re-renders (BUG-7 performance fix)
 */
export const SidebarFlat = memo(function SidebarFlat({
  assets,
  selectedAssetId,
  draggedAssetId,
  dropTargetId,
  hoveredAssetId,
  copyMenuOpenAssetId,
  onSelectAsset,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDragEnd,
  onDrop,
  onHoverAsset,
  onToggleCopyMenu,
  onCopyPath,
}: SidebarFlatProps) {
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
        onMouseEnter={() => onHoverAsset(asset.id)}
        onMouseLeave={() => onHoverAsset(null)}
      >
        <button
          draggable
          onDragStart={(e) => onDragStart(e, asset.id)}
          onDragOver={(e) => onDragOver(e, asset.id)}
          onDragLeave={onDragLeave}
          onDragEnd={onDragEnd}
          onDrop={(e) => onDrop(e, asset.id)}
          onClick={() => onSelectAsset(asset.id)}
          className="flex-1 text-left px-2 py-2 rounded-lg text-sm transition-colors flex items-center"
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
                onToggleCopyMenu(isCopyMenuOpen ? null : asset.id);
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
                  onClick={(e) => { e.stopPropagation(); onCopyPath(asset, 'url'); onToggleCopyMenu(null); }}
                  className="w-full text-left px-3 py-1.5 text-sm transition-colors"
                  style={{ color: '#ffffff' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#5a5050'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  Copy URL
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onCopyPath(asset, 'abs'); onToggleCopyMenu(null); }}
                  className="w-full text-left px-3 py-1.5 text-sm transition-colors"
                  style={{ color: '#ffffff' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#5a5050'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  Copy Absolute
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onCopyPath(asset, 'rel'); onToggleCopyMenu(null); }}
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
    <div className="space-y-0.5">
      {assets.map(renderAssetRow)}
    </div>
  );
});

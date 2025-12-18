import type { Presentation, Asset } from '@flideck/shared';

interface SidebarProps {
  presentations: Presentation[];
  selectedPresentationId?: string;
  selectedAssetId?: string;
  onSelectPresentation: (id: string) => void;
  onSelectAsset: (presentationId: string, assetId: string) => void;
}

/**
 * Sidebar for navigating presentations and assets.
 */
export function Sidebar({
  presentations,
  selectedPresentationId,
  selectedAssetId,
  onSelectPresentation,
  onSelectAsset,
}: SidebarProps) {
  const selectedPresentation = presentations.find(
    (p) => p.id === selectedPresentationId
  );

  return (
    <aside className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col overflow-hidden">
      {/* Presentations List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3 border-b border-slate-700">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Presentations
          </h2>
        </div>
        <nav className="p-2">
          {presentations.length === 0 ? (
            <p className="text-sm text-slate-500 p-2">No presentations found</p>
          ) : (
            presentations.map((presentation) => (
              <button
                key={presentation.id}
                onClick={() => onSelectPresentation(presentation.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedPresentationId === presentation.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                {presentation.name}
                <span className="ml-2 text-xs text-slate-400">
                  ({presentation.assets.length})
                </span>
              </button>
            ))
          )}
        </nav>
      </div>

      {/* Assets List (when presentation selected) */}
      {selectedPresentation && (
        <div className="border-t border-slate-700 flex-1 overflow-y-auto">
          <div className="p-3 border-b border-slate-700">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Assets
            </h2>
          </div>
          <nav className="p-2">
            {selectedPresentation.assets.map((asset: Asset) => (
              <button
                key={asset.id}
                onClick={() =>
                  onSelectAsset(selectedPresentation.id, asset.id)
                }
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedAssetId === asset.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                {asset.isIndex && (
                  <span className="mr-2 text-xs bg-slate-600 px-1.5 py-0.5 rounded">
                    index
                  </span>
                )}
                {asset.name}
              </button>
            ))}
          </nav>
        </div>
      )}
    </aside>
  );
}

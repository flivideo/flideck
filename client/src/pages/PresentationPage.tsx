import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePresentation, useAsset } from '../hooks/usePresentations';
import { usePresentationRoom, usePresentationUpdates } from '../hooks/useSocket';
import { Header } from '../components/layout/Header';
import { Sidebar } from '../components/layout/Sidebar';
import { AssetViewer } from '../components/ui/AssetViewer';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';

/**
 * Presentation page with asset navigation and viewer.
 */
export function PresentationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const { data: presentation, isLoading, error } = usePresentation(id);
  const { data: assetData, isLoading: assetLoading } = useAsset(
    id,
    selectedAssetId || undefined
  );

  // Join presentation room for scoped updates
  usePresentationRoom(id || null);
  usePresentationUpdates();

  // Auto-select index asset when presentation loads
  useEffect(() => {
    if (presentation && !selectedAssetId) {
      const indexAsset = presentation.assets.find((a) => a.isIndex);
      if (indexAsset) {
        setSelectedAssetId(indexAsset.id);
      } else if (presentation.assets.length > 0) {
        setSelectedAssetId(presentation.assets[0].id);
      }
    }
  }, [presentation, selectedAssetId]);

  const handleBack = () => {
    navigate('/');
  };

  const handleSelectAsset = (_presentationId: string, assetId: string) => {
    setSelectedAssetId(assetId);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen">
        <Header title="Loading..." showBack onBack={handleBack} />
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner message="Loading presentation..." />
        </div>
      </div>
    );
  }

  if (error || !presentation) {
    return (
      <div className="flex flex-col h-screen">
        <Header title="Error" showBack onBack={handleBack} />
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            title="Presentation not found"
            description="The requested presentation could not be loaded."
            action={{ label: 'Go Back', onClick: handleBack }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <Header title={presentation.name} showBack onBack={handleBack} />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          presentations={[presentation]}
          selectedPresentationId={id}
          selectedAssetId={selectedAssetId || undefined}
          onSelectPresentation={() => {}}
          onSelectAsset={handleSelectAsset}
        />

        <main className="flex-1 flex flex-col overflow-hidden">
          {assetLoading ? (
            <div className="flex-1 flex items-center justify-center bg-slate-900">
              <LoadingSpinner message="Loading asset..." />
            </div>
          ) : assetData ? (
            <AssetViewer content={assetData.content} presentationId={id!} />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-slate-900">
              <EmptyState
                title="Select an asset"
                description="Choose an asset from the sidebar to view it."
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

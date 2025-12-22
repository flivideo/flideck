import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePresentations, usePresentation, useAsset } from '../hooks/usePresentations';
import { usePresentationRoom, usePresentationUpdates, useContentChanges } from '../hooks/useSocket';
import { useQuickFilter } from '../hooks/useQuickFilter';
import { Header } from '../components/layout/Header';
import { Sidebar } from '../components/layout/Sidebar';
import { AssetViewer } from '../components/ui/AssetViewer';
import { QuickFilter, QuickFilterItem } from '../components/ui/QuickFilter';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { getSidebarOrder } from '../utils/sidebarOrder';

/**
 * Presentation page with asset navigation and viewer.
 * Supports presentation mode (F key) for distraction-free viewing.
 *
 * Keyboard shortcuts:
 * - F: Toggle presentation mode
 * - Escape: Exit presentation mode
 * - Ctrl+Left/Right: Navigate between assets (modifier keys avoid conflicts with iframe content)
 * - Ctrl+Home/End: Jump to first/last asset
 */
export function PresentationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [isQuickFilterOpen, , closeQuickFilter] = useQuickFilter();

  const { data: presentations } = usePresentations();
  const { data: presentation, isLoading, error } = usePresentation(id);
  const { data: assetData, isLoading: assetLoading } = useAsset(
    id,
    selectedAssetId || undefined
  );

  // Join presentation room for scoped updates
  usePresentationRoom(id || null);
  usePresentationUpdates();

  // Listen for content changes to reload iframe
  const reloadKey = useContentChanges(id, selectedAssetId || undefined);

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

  // Get sidebar-ordered assets for navigation (matches visual order in sidebar)
  const sidebarOrderedAssets = useMemo(
    () => getSidebarOrder(presentation),
    [presentation]
  );

  // Get current asset index for navigation (using sidebar order)
  const currentIndex = sidebarOrderedAssets.findIndex((a) => a.id === selectedAssetId);
  const totalAssets = sidebarOrderedAssets.length;

  // Navigate to adjacent asset (follows sidebar visual order)
  const navigateToAsset = useCallback(
    (direction: 'prev' | 'next' | 'first' | 'last') => {
      if (sidebarOrderedAssets.length === 0) return;

      let newIndex: number;
      switch (direction) {
        case 'prev':
          newIndex = Math.max(0, currentIndex - 1);
          break;
        case 'next':
          newIndex = Math.min(sidebarOrderedAssets.length - 1, currentIndex + 1);
          break;
        case 'first':
          newIndex = 0;
          break;
        case 'last':
          newIndex = sidebarOrderedAssets.length - 1;
          break;
      }
      setSelectedAssetId(sidebarOrderedAssets[newIndex].id);
    },
    [sidebarOrderedAssets, currentIndex]
  );

  // Keyboard handler - uses Ctrl modifier for navigation to avoid conflicts with iframe content
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // F key toggles presentation mode (no modifier needed)
      if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setIsPresentationMode((prev) => !prev);
        return;
      }

      // Escape exits presentation mode
      if (e.key === 'Escape' && isPresentationMode) {
        setIsPresentationMode(false);
        return;
      }

      // Navigation requires Ctrl modifier (to avoid conflicts with iframe content)
      if (!e.ctrlKey && !e.metaKey) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          navigateToAsset('prev');
          break;
        case 'ArrowRight':
          e.preventDefault();
          navigateToAsset('next');
          break;
        case 'Home':
          e.preventDefault();
          navigateToAsset('first');
          break;
        case 'End':
          e.preventDefault();
          navigateToAsset('last');
          break;
      }
    },
    [isPresentationMode, navigateToAsset]
  );

  // Window-level keyboard listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Listen for keyboard events forwarded from iframe via postMessage
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'flideck-keydown') {
        // Create a synthetic keyboard event from the postMessage data
        const syntheticEvent = {
          key: e.data.key,
          ctrlKey: e.data.ctrlKey,
          metaKey: e.data.metaKey,
          shiftKey: e.data.shiftKey,
          altKey: e.data.altKey,
          target: document.body,
          preventDefault: () => {},
        } as unknown as KeyboardEvent;
        handleKeyDown(syntheticEvent);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleKeyDown]);

  const handleBack = () => {
    navigate('/');
  };

  const handleSelectAsset = (_presentationId: string, assetId: string) => {
    setSelectedAssetId(assetId);
  };

  // Convert assets to quick filter items (using sidebar order)
  const quickFilterItems: QuickFilterItem[] = useMemo(() => {
    return sidebarOrderedAssets.map((a) => ({
      id: a.id,
      name: a.name,
      subtitle: a.isIndex ? 'index' : a.group ? a.group : undefined,
    }));
  }, [sidebarOrderedAssets]);

  const handleQuickFilterSelect = (assetId: string) => {
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

  // Progress indicator component (only shown outside presentation mode)
  const ProgressIndicator = () => {
    if (totalAssets <= 1 || isPresentationMode) return null;

    return (
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 bg-brand-brown/80 backdrop-blur-sm rounded-full text-sm text-white">
        <span className="font-medium">{currentIndex + 1}</span>
        <span className="text-white/60">/</span>
        <span className="text-white/60">{totalAssets}</span>
        {/* Progress bar */}
        <div className="w-20 h-1 bg-white/20 rounded-full overflow-hidden ml-2">
          <div
            className="h-full bg-brand-gold transition-all duration-200"
            style={{ width: `${((currentIndex + 1) / totalAssets) * 100}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header - hidden in presentation mode */}
      {!isPresentationMode && (
        <Header
          title={presentation.name}
          showBack
          onBack={handleBack}
          onTogglePresentationMode={() => setIsPresentationMode(true)}
          presentations={presentations}
          currentPresentationId={id}
        />
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - hidden in presentation mode */}
        {!isPresentationMode && (
          <Sidebar
            presentations={[presentation]}
            selectedPresentationId={id}
            selectedAssetId={selectedAssetId || undefined}
            onSelectPresentation={() => {}}
            onSelectAsset={handleSelectAsset}
            showPresentations={false}
          />
        )}

        <main className="flex-1 flex flex-col overflow-hidden relative">
          {assetLoading ? (
            <div className="flex-1 flex items-center justify-center bg-slate-900">
              <LoadingSpinner message="Loading asset..." />
            </div>
          ) : assetData ? (
            <AssetViewer content={assetData.content} presentationId={id!} reloadKey={reloadKey} />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-slate-900">
              <EmptyState
                title="Select an asset"
                description="Choose an asset from the sidebar to view it."
              />
            </div>
          )}

          {/* Progress indicator - hidden in presentation mode */}
          {assetData && <ProgressIndicator />}

          {/* Hover-only exit button in presentation mode */}
          {isPresentationMode && (
            <button
              onClick={() => setIsPresentationMode(false)}
              className="absolute top-3 right-3 z-10 p-2 rounded-lg opacity-0 hover:opacity-100 bg-black/50 text-white transition-opacity duration-200"
              title="Exit presentation mode (Esc)"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
        </main>
      </div>

      {/* Quick Filter Modal */}
      <QuickFilter
        isOpen={isQuickFilterOpen}
        onClose={closeQuickFilter}
        items={quickFilterItems}
        onSelect={handleQuickFilterSelect}
        placeholder="Search assets..."
      />
    </div>
  );
}

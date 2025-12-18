import { useNavigate } from 'react-router-dom';
import { usePresentations } from '../hooks/usePresentations';
import { usePresentationUpdates } from '../hooks/useSocket';
import { Header } from '../components/layout/Header';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import type { Presentation } from '@flideck/shared';

/**
 * Home page showing list of all presentations.
 */
export function HomePage() {
  const navigate = useNavigate();
  const { data: presentations, isLoading, error } = usePresentations();

  // Subscribe to real-time updates
  usePresentationUpdates();

  const handleSelectPresentation = (presentation: Presentation) => {
    navigate(`/presentation/${presentation.id}`);
  };

  return (
    <div className="flex flex-col h-screen">
      <Header title="FliDeck" />

      <main className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <LoadingSpinner message="Loading presentations..." />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <EmptyState
              title="Error loading presentations"
              description={error instanceof Error ? error.message : 'Unknown error'}
            />
          </div>
        ) : !presentations || presentations.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <EmptyState
              title="No presentations found"
              description="Add folders with index.html to your presentations directory."
            />
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-lg font-medium text-slate-200 mb-4">
              Available Presentations
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {presentations.map((presentation) => (
                <button
                  key={presentation.id}
                  onClick={() => handleSelectPresentation(presentation)}
                  className="bg-slate-800 border border-slate-700 rounded-lg p-4 text-left hover:border-blue-500 hover:bg-slate-750 transition-colors"
                >
                  <h3 className="text-white font-medium mb-1">
                    {presentation.name}
                  </h3>
                  <p className="text-sm text-slate-400">
                    {presentation.assets.length} asset
                    {presentation.assets.length !== 1 ? 's' : ''}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

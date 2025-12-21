import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePresentations } from '../hooks/usePresentations';
import { usePresentationUpdates } from '../hooks/useSocket';
import { useQuickFilter } from '../hooks/useQuickFilter';
import { Header } from '../components/layout/Header';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { QuickFilter, QuickFilterItem } from '../components/ui/QuickFilter';
import type { Presentation } from '@flideck/shared';

/**
 * Home page showing list of all presentations.
 */
export function HomePage() {
  const navigate = useNavigate();
  const { data: presentations, isLoading, error } = usePresentations();
  const [isQuickFilterOpen, , closeQuickFilter] = useQuickFilter();

  // Subscribe to real-time updates
  usePresentationUpdates();

  const handleSelectPresentation = (presentation: Presentation) => {
    navigate(`/presentation/${presentation.id}`);
  };

  // Convert presentations to quick filter items
  const quickFilterItems: QuickFilterItem[] = useMemo(() => {
    if (!presentations) return [];
    return presentations.map((p) => ({
      id: p.id,
      name: p.name,
      subtitle: `${p.assets.length} asset${p.assets.length !== 1 ? 's' : ''}`,
    }));
  }, [presentations]);

  const handleQuickFilterSelect = (id: string) => {
    navigate(`/presentation/${id}`);
  };

  return (
    <div className="flex flex-col h-screen">
      <Header />

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
            <h2
              className="text-lg font-medium mb-4"
              style={{
                fontFamily: "'Oswald', Arial, sans-serif",
                textTransform: 'uppercase',
                color: '#ccba9d'
              }}
            >
              Available Presentations
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {presentations.map((presentation) => (
                <button
                  key={presentation.id}
                  onClick={() => handleSelectPresentation(presentation)}
                  className="rounded-lg p-4 text-left transition-all duration-200 border"
                  style={{
                    backgroundColor: '#3d3535',
                    borderColor: '#4a4040'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#ffde59';
                    e.currentTarget.style.backgroundColor = '#4a4040';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#4a4040';
                    e.currentTarget.style.backgroundColor = '#3d3535';
                  }}
                >
                  <h3 className="text-white font-medium mb-1">
                    {presentation.name}
                  </h3>
                  <p className="text-sm" style={{ color: '#ccba9d' }}>
                    {presentation.assets.length} asset
                    {presentation.assets.length !== 1 ? 's' : ''}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Quick Filter Modal */}
      <QuickFilter
        isOpen={isQuickFilterOpen}
        onClose={closeQuickFilter}
        items={quickFilterItems}
        onSelect={handleQuickFilterSelect}
        placeholder="Search presentations..."
      />
    </div>
  );
}

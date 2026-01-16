import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface MockupImage {
  id: string;
  filename: string;
  dimension: string;
  folder: string;
  thumbnailUrl: string;
  fullUrl: string;
  metadata: any;
  hasMetadata: boolean;
}

/**
 * VibeDeck Mockups Gallery Page
 * MVP implementation - displays grid of mockup images with basic filtering
 */
export function MockupsPage() {
  const [mockups, setMockups] = useState<MockupImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDimension, setSelectedDimension] = useState<string>('all');
  const [dimensions, setDimensions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load mockups on mount
  useEffect(() => {
    loadMockups();
    loadDimensions();
  }, []);

  async function loadMockups() {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5201/api/mockups');
      if (!response.ok) throw new Error('Failed to load mockups');
      const data = await response.json();
      setMockups(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function loadDimensions() {
    try {
      const response = await fetch('http://localhost:5201/api/mockups/dimensions');
      if (!response.ok) throw new Error('Failed to load dimensions');
      const data = await response.json();
      setDimensions(data);
    } catch (err) {
      console.error('Failed to load dimensions:', err);
    }
  }

  async function refreshMockups() {
    await fetch('http://localhost:5201/api/mockups/refresh', { method: 'POST' });
    await loadMockups();
  }

  // Filter mockups by selected dimension
  const filteredMockups =
    selectedDimension === 'all'
      ? mockups
      : mockups.filter((m) => m.dimension === selectedDimension);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading mockups...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-red-500 text-xl">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-blue-400 hover:text-blue-300">
              ← Back to FliDeck
            </Link>
            <h1 className="text-2xl font-bold">VibeDeck Mockups</h1>
            <span className="text-gray-400">{filteredMockups.length} images</span>
          </div>
          <button
            onClick={refreshMockups}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
          >
            Refresh
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-3">
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedDimension('all')}
            className={`px-3 py-1 rounded ${
              selectedDimension === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            All
          </button>
          {dimensions.map((dim) => (
            <button
              key={dim}
              onClick={() => setSelectedDimension(dim)}
              className={`px-3 py-1 rounded capitalize ${
                selectedDimension === dim
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {dim.replace(/-/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="p-6">
        {filteredMockups.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            No mockups found. Check that the mockups directory is configured correctly.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredMockups.map((mockup) => (
              <div
                key={mockup.id}
                className="bg-gray-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all"
              >
                <div className="aspect-square bg-gray-700 flex items-center justify-center">
                  <img
                    src={`http://localhost:5201${mockup.thumbnailUrl}`}
                    alt={mockup.filename}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                </div>
                <div className="p-3">
                  <div className="text-sm font-medium truncate" title={mockup.filename}>
                    {mockup.filename}
                  </div>
                  <div className="text-xs text-gray-400 mt-1 capitalize">
                    {mockup.dimension.replace(/-/g, ' ')}
                  </div>
                  {mockup.metadata?.generation?.model && (
                    <div className="text-xs text-blue-400 mt-1">
                      {mockup.metadata.generation.model}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

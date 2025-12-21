import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfig, useUpdateConfig, useConfigUpdates } from '../hooks/useConfig';
import { Header } from '../components/layout/Header';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';

export function ConfigPage() {
  const navigate = useNavigate();
  const { data: config, isLoading, error } = useConfig();
  const updateConfig = useUpdateConfig();
  const [newPath, setNewPath] = useState('');

  useConfigUpdates();

  const handleApply = () => {
    if (newPath.trim()) {
      updateConfig.mutate(newPath.trim());
      setNewPath('');
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <Header title="Configuration" showBack onBack={() => navigate('/')} />

      <main className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <LoadingSpinner message="Loading configuration..." />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <EmptyState title="Error loading configuration" description={error instanceof Error ? error.message : 'Unknown error'} />
          </div>
        ) : config ? (
          <div className="max-w-2xl mx-auto space-y-8">
            {/* Current Folder */}
            <section>
              <h2 className="text-lg font-medium mb-3" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', color: '#ccba9d' }}>
                Current Folder
              </h2>
              <div className="rounded-lg p-4 border" style={{ backgroundColor: '#3d3535', borderColor: '#4a4040' }}>
                <code style={{ color: '#2E91FC' }} className="text-sm break-all">{config.presentationsRoot}</code>
              </div>
            </section>

            {/* History */}
            {config.history.length > 0 && (
              <section>
                <h2 className="text-lg font-medium mb-3" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', color: '#ccba9d' }}>
                  History
                </h2>
                <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: '#3d3535', borderColor: '#4a4040' }}>
                  {config.history.map((path, i) => (
                    <button key={i} onClick={() => updateConfig.mutate(path)} disabled={updateConfig.isPending}
                      className="w-full p-3 text-left transition-colors disabled:opacity-50"
                      style={{ borderBottom: i < config.history.length - 1 ? '1px solid #4a4040' : 'none' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4a4040'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                      <code style={{ color: '#ccba9d' }} className="text-sm break-all">{path}</code>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Add Folder */}
            <section>
              <h2 className="text-lg font-medium mb-3" style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', color: '#ccba9d' }}>
                Add Folder
              </h2>
              <input
                type="text"
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleApply()}
                placeholder="Paste folder path here..."
                className="w-full rounded-lg px-4 py-3 border focus:outline-none transition-colors"
                style={{ backgroundColor: '#3d3535', borderColor: '#4a4040', color: '#fff' }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#ffde59'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#4a4040'}
              />
              {newPath.trim() && (
                <div className="mt-3 flex justify-end">
                  <button onClick={handleApply} disabled={updateConfig.isPending}
                    className="px-6 py-2 rounded-lg transition-all font-medium"
                    style={{ backgroundColor: '#ffde59', color: '#342d2d', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem' }}
                    onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.filter = 'brightness(1)'}>
                    {updateConfig.isPending ? 'Applying...' : 'Apply'}
                  </button>
                </div>
              )}
            </section>

            {/* Messages */}
            {updateConfig.isError && (
              <div className="rounded-lg p-4 border" style={{ backgroundColor: 'rgba(220, 38, 38, 0.2)', borderColor: '#dc2626', color: '#fca5a5' }}>
                {updateConfig.error instanceof Error ? updateConfig.error.message : 'Failed to update configuration'}
              </div>
            )}
            {updateConfig.isSuccess && (
              <div className="rounded-lg p-4 border" style={{ backgroundColor: 'rgba(34, 197, 94, 0.2)', borderColor: '#22c55e', color: '#86efac' }}>
                Configuration updated successfully!
              </div>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocketConnection } from '../../hooks/useSocket';
import type { Presentation } from '@flideck/shared';

interface HeaderProps {
  title?: string;
  onBack?: () => void;
  showBack?: boolean;
  showSettings?: boolean;
  onTogglePresentationMode?: () => void;
  /** All available presentations for the dropdown switcher */
  presentations?: Presentation[];
  /** Currently selected presentation ID */
  currentPresentationId?: string;
}

/**
 * Application header with navigation and connection status.
 * Always displays "AppyDave" branding in the top left corner.
 */
export function Header({
  title,
  onBack,
  showBack,
  showSettings = true,
  onTogglePresentationMode,
  presentations,
  currentPresentationId,
}: HeaderProps) {
  const navigate = useNavigate();
  const isConnected = useSocketConnection();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleSettings = () => {
    navigate('/config');
  };

  const handlePresentationSelect = (id: string) => {
    setIsDropdownOpen(false);
    navigate(`/presentation/${id}`);
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  // Close dropdown on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDropdownOpen) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isDropdownOpen]);

  const showDropdown = presentations && presentations.length > 0 && title;

  return (
    <header className="px-4 py-3 flex items-center justify-between border-b" style={{ backgroundColor: '#3d3535', borderColor: '#4a4040' }}>
      <div className="flex items-center gap-3">
        <span className="text-2xl tracking-wide" style={{ fontFamily: "'Bebas Neue', Arial, sans-serif" }}>
          <span style={{ color: '#ccba9d' }}>Appy</span>
          <span style={{ color: '#ffde59' }}>Dave</span>
        </span>
        {showBack && onBack && (
          <button
            onClick={onBack}
            className="p-2 rounded-lg transition-colors"
            style={{ color: '#ccba9d' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4a4040'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            aria-label="Go back"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
        {title && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => showDropdown && setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 text-xl font-semibold text-white"
              style={{ fontFamily: "'Oswald', Arial, sans-serif", textTransform: 'uppercase' }}
            >
              {title}
              {showDropdown && (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-4 w-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                  style={{ color: '#ccba9d' }}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && presentations && (
              <div
                className="absolute top-full left-0 mt-2 min-w-[200px] rounded-lg shadow-lg border z-50"
                style={{ backgroundColor: '#3d3535', borderColor: '#4a4040' }}
              >
                <nav className="p-2 max-h-[300px] overflow-y-auto">
                  {presentations.map((presentation) => {
                    const isCurrent = presentation.id === currentPresentationId;
                    return (
                      <button
                        key={presentation.id}
                        onClick={() => handlePresentationSelect(presentation.id)}
                        className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
                        style={{
                          backgroundColor: isCurrent ? '#ffde59' : 'transparent',
                          color: isCurrent ? '#342d2d' : '#ffffff',
                        }}
                        onMouseEnter={(e) => {
                          if (!isCurrent) {
                            e.currentTarget.style.backgroundColor = '#4a4040';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isCurrent) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }
                        }}
                      >
                        {isCurrent && (
                          <span style={{ color: '#342d2d' }}>•</span>
                        )}
                        {presentation.name}
                      </button>
                    );
                  })}
                </nav>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}
            title={isConnected ? 'Connected' : 'Disconnected'}
          />
          <span className="text-sm" style={{ color: '#ccba9d' }}>
            {isConnected ? 'Live' : 'Offline'}
          </span>
        </div>

        {onTogglePresentationMode && (
          <button
            onClick={onTogglePresentationMode}
            className="p-2 rounded-lg transition-colors"
            style={{ color: '#ccba9d' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4a4040'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            aria-label="Enter presentation mode"
            title="Presentation mode (F) • Ctrl+←/→ to navigate"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 01-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 110-2h4a1 1 0 011 1v4a1 1 0 11-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 112 0v1.586l2.293-2.293a1 1 0 011.414 1.414L6.414 15H8a1 1 0 110 2H4a1 1 0 01-1-1v-4zm13 3a1 1 0 01-1 1h-4a1 1 0 110-2h1.586l-2.293-2.293a1 1 0 011.414-1.414L15 13.586V12a1 1 0 112 0v4z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}

        {showSettings && (
          <button
            onClick={handleSettings}
            className="p-2 rounded-lg transition-colors"
            style={{ color: '#ccba9d' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4a4040'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            aria-label="Settings"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>
    </header>
  );
}

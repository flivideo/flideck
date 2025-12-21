import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';

export interface QuickFilterItem {
  id: string;
  name: string;
  subtitle?: string;
}

interface QuickFilterProps {
  isOpen: boolean;
  onClose: () => void;
  items: QuickFilterItem[];
  onSelect: (id: string) => void;
  placeholder?: string;
}

/**
 * Quick filter modal overlay (Cmd+K pattern).
 * Filters and navigates items with keyboard support.
 */
export function QuickFilter({
  isOpen,
  onClose,
  items,
  onSelect,
  placeholder = 'Search...',
}: QuickFilterProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter items based on query (case-insensitive substring match)
  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    const lowerQuery = query.toLowerCase();
    return items.filter((item) =>
      item.name.toLowerCase().includes(lowerQuery)
    );
  }, [items, query]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      // Focus input after a brief delay for portal to mount
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  // Keep selected index in bounds
  useEffect(() => {
    if (selectedIndex >= filteredItems.length) {
      setSelectedIndex(Math.max(0, filteredItems.length - 1));
    }
  }, [filteredItems.length, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedEl = listRef.current.children[selectedIndex] as HTMLElement;
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleSelect = useCallback(
    (id: string) => {
      onSelect(id);
      onClose();
    },
    [onSelect, onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            Math.min(prev + 1, filteredItems.length - 1)
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredItems[selectedIndex]) {
            handleSelect(filteredItems[selectedIndex].id);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filteredItems, selectedIndex, handleSelect, onClose]
  );

  // Close on click outside
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
      onClick={handleBackdropClick}
    >
      <div
        className="w-full max-w-md rounded-lg shadow-2xl overflow-hidden border"
        style={{ backgroundColor: '#3d3535', borderColor: '#4a4040' }}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div
          className="flex items-center gap-3 p-4 border-b"
          style={{ borderColor: '#4a4040' }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 flex-shrink-0"
            style={{ color: '#ccba9d' }}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
              clipRule="evenodd"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none text-lg"
            style={{ fontFamily: "'Roboto', Arial, sans-serif" }}
          />
          <kbd
            className="hidden sm:inline-flex px-2 py-1 text-xs rounded"
            style={{ backgroundColor: '#4a4040', color: '#ccba9d' }}
          >
            esc
          </kbd>
        </div>

        {/* Results list */}
        <div
          ref={listRef}
          className="max-h-[300px] overflow-y-auto"
        >
          {filteredItems.length === 0 ? (
            <div
              className="p-4 text-center text-sm"
              style={{ color: '#595959' }}
            >
              No matches found
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  className="w-full text-left px-4 py-3 flex items-center justify-between transition-colors"
                  style={{
                    backgroundColor: isSelected ? '#ffde59' : 'transparent',
                    color: isSelected ? '#342d2d' : '#ffffff',
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div>
                    <div className="font-medium">{item.name}</div>
                    {item.subtitle && (
                      <div
                        className="text-sm"
                        style={{ color: isSelected ? '#5a4d1e' : '#ccba9d' }}
                      >
                        {item.subtitle}
                      </div>
                    )}
                  </div>
                  {isSelected && (
                    <kbd
                      className="px-2 py-1 text-xs rounded"
                      style={{
                        backgroundColor: isSelected ? '#342d2d' : '#4a4040',
                        color: isSelected ? '#ffde59' : '#ccba9d',
                      }}
                    >
                      ↵
                    </kbd>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div
          className="px-4 py-2 border-t flex items-center gap-4 text-xs"
          style={{ borderColor: '#4a4040', color: '#595959' }}
        >
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded" style={{ backgroundColor: '#4a4040' }}>↑</kbd>
            <kbd className="px-1.5 py-0.5 rounded" style={{ backgroundColor: '#4a4040' }}>↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded" style={{ backgroundColor: '#4a4040' }}>↵</kbd>
            select
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}

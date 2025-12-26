import { useRef, useEffect, useState } from 'react';
import type { TabDefinition } from '@flideck/shared';

interface TabBarProps {
  tabs: TabDefinition[];
  activeTabId: string | null;
  onTabChange: (tabId: string) => void;
  onCreateTab?: () => void;
  isPresentationMode?: boolean;
}

/**
 * Container-level tab bar for navigating between different index files.
 * Persists in presentation mode to enable navigation without sidebar.
 * (FR-24)
 */
export function TabBar({
  tabs,
  activeTabId,
  onTabChange,
  onCreateTab,
  isPresentationMode = false,
}: TabBarProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(false);

  // Sort tabs by order
  const sortedTabs = [...tabs].sort((a, b) => a.order - b.order);

  // Check scroll state
  const checkScrollState = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    setShowLeftScroll(container.scrollLeft > 0);
    setShowRightScroll(
      container.scrollLeft < container.scrollWidth - container.clientWidth - 1
    );
  };

  useEffect(() => {
    checkScrollState();
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', checkScrollState);
    window.addEventListener('resize', checkScrollState);

    return () => {
      container.removeEventListener('scroll', checkScrollState);
      window.removeEventListener('resize', checkScrollState);
    };
  }, [tabs]);

  const scrollLeft = () => {
    scrollContainerRef.current?.scrollBy({ left: -200, behavior: 'smooth' });
  };

  const scrollRight = () => {
    scrollContainerRef.current?.scrollBy({ left: 200, behavior: 'smooth' });
  };

  if (tabs.length === 0) return null;

  return (
    <div
      className="flex items-center border-b relative"
      style={{
        backgroundColor: '#3d3535',
        borderColor: '#4a4040',
        height: '48px',
      }}
    >
      {/* Left scroll button */}
      {showLeftScroll && (
        <button
          onClick={scrollLeft}
          className="absolute left-0 top-0 bottom-0 z-10 px-2 transition-colors"
          style={{
            backgroundColor: '#3d3535',
            color: '#ccba9d',
            borderRight: '1px solid #4a4040',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#4a4040';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#3d3535';
          }}
          title="Scroll left"
        >
          ‹
        </button>
      )}

      {/* Tabs container */}
      <div
        ref={scrollContainerRef}
        className="flex-1 flex items-center overflow-x-auto scrollbar-hide"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          paddingLeft: showLeftScroll ? '32px' : '0',
          paddingRight: showRightScroll ? '32px' : '0',
        }}
      >
        {sortedTabs.map((tab) => {
          const isActive = tab.id === activeTabId;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="flex-shrink-0 px-4 py-2 text-sm font-medium transition-colors border-r"
              style={{
                backgroundColor: isActive ? '#4a4040' : 'transparent',
                color: isActive ? '#ffde59' : '#ffffff',
                borderColor: '#4a4040',
                fontFamily: "'Oswald', Arial, sans-serif",
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = '#4a4040';
                  e.currentTarget.style.color = '#ccba9d';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#ffffff';
                }
              }}
              title={tab.subtitle || undefined}
            >
              <div className="flex flex-col items-start">
                <span>{tab.label}</span>
                {tab.subtitle && (
                  <span
                    className="text-xs font-normal"
                    style={{
                      color: isActive ? '#ccba9d' : '#999',
                      textTransform: 'none',
                      letterSpacing: 'normal',
                    }}
                  >
                    {tab.subtitle}
                  </span>
                )}
              </div>
            </button>
          );
        })}

        {/* + New Tab button */}
        {onCreateTab && !isPresentationMode && (
          <button
            onClick={onCreateTab}
            className="flex-shrink-0 px-3 py-2 text-sm transition-colors border-r"
            style={{
              color: '#595959',
              borderColor: '#4a4040',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#4a4040';
              e.currentTarget.style.color = '#ccba9d';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#595959';
            }}
            title="Create new tab"
          >
            + New Tab
          </button>
        )}
      </div>

      {/* Right scroll button */}
      {showRightScroll && (
        <button
          onClick={scrollRight}
          className="absolute right-0 top-0 bottom-0 z-10 px-2 transition-colors"
          style={{
            backgroundColor: '#3d3535',
            color: '#ccba9d',
            borderLeft: '1px solid #4a4040',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#4a4040';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#3d3535';
          }}
          title="Scroll right"
        >
          ›
        </button>
      )}
    </div>
  );
}

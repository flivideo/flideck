import { useState, useEffect } from 'react';
import type { TabDefinition } from '@flideck/shared';

/**
 * Hook for managing active container tab state with localStorage persistence.
 * Returns the active tab ID and a setter function.
 * (FR-24)
 */
export function useContainerTab(
  presentationId: string | undefined,
  tabs: TabDefinition[] | undefined
): [string | null, (tabId: string | null) => void] {
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // Initialize active tab on mount or when presentation/tabs change
  useEffect(() => {
    if (!presentationId || !tabs || tabs.length === 0) {
      setActiveTabId(null);
      return;
    }

    // Try to load last viewed tab from localStorage
    const storageKey = `flideck-container-tab-${presentationId}`;
    const savedTabId = localStorage.getItem(storageKey);

    // Check if saved tab still exists
    if (savedTabId && tabs.some((t) => t.id === savedTabId)) {
      setActiveTabId(savedTabId);
      return;
    }

    // Otherwise use first tab by order
    const sortedTabs = [...tabs].sort((a, b) => a.order - b.order);
    if (sortedTabs.length > 0) {
      setActiveTabId(sortedTabs[0].id);
    }
  }, [presentationId, tabs]);

  // Persist active tab to localStorage (or clear it)
  const handleSetActiveTab = (tabId: string | null) => {
    setActiveTabId(tabId);

    if (!presentationId) return;

    const storageKey = `flideck-container-tab-${presentationId}`;
    if (tabId === null) {
      localStorage.removeItem(storageKey);
    } else {
      localStorage.setItem(storageKey, tabId);
    }
  };

  return [activeTabId, handleSetActiveTab] as const;
}

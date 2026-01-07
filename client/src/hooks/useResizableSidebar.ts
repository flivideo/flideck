import { useState, useCallback } from 'react';

const STORAGE_KEY = 'flideck:sidebarWidth';

// Preset width options
export const SIDEBAR_PRESETS = {
  small: 280,
  medium: 380,
  large: 480,
} as const;

export type SidebarPreset = keyof typeof SIDEBAR_PRESETS;

/**
 * Hook for resizable sidebar panel with preset width buttons.
 * Persists width preference to localStorage.
 *
 * @param defaultWidth - Default width in pixels (default: 280)
 * @returns Object with width and setPreset function
 */
export function useResizableSidebar(defaultWidth: number = SIDEBAR_PRESETS.medium) {
  // Load width from localStorage or use default
  const [width, setWidthState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed)) {
          return parsed;
        }
      }
    } catch {
      // Ignore localStorage errors
    }
    return defaultWidth;
  });

  // Set width to a preset value
  const setPreset = useCallback((preset: SidebarPreset) => {
    const newWidth = SIDEBAR_PRESETS[preset];
    setWidthState(newWidth);
    try {
      localStorage.setItem(STORAGE_KEY, newWidth.toString());
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  return {
    width,
    setPreset,
  };
}

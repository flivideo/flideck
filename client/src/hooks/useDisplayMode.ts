import { useState, useEffect, useMemo } from 'react';
import type { Presentation, DisplayMode } from '@flideck/shared';
import { detectDisplayMode } from '../utils/displayMode';

// BUG-10: Valid modes for validation (tabbed renderer was removed in FR-24)
const VALID_MODES: DisplayMode[] = ['flat', 'grouped'];

function validateMode(saved: string | null): DisplayMode | null {
  if (saved && VALID_MODES.includes(saved as DisplayMode)) {
    return saved as DisplayMode;
  }
  return null;
}

/**
 * Hook for managing display mode state with localStorage persistence (BUG-4 fix)
 */
export function useDisplayMode(presentation: Presentation | null | undefined) {
  const storageKey = presentation?.id ? `flideck:displayMode:${presentation.id}` : null;

  // Session override (BUG-4: now persisted in localStorage)
  const [sessionOverride, setSessionOverrideState] = useState<DisplayMode | null>(() => {
    if (!storageKey) return null;
    try {
      const saved = localStorage.getItem(storageKey);
      return validateMode(saved); // BUG-10: Validate stale values
    } catch {
      return null;
    }
  });

  // Auto-detected mode
  const autoMode = useMemo(() => detectDisplayMode(presentation), [presentation]);

  // Active mode (session override takes precedence)
  const activeMode = sessionOverride || autoMode;

  // Persist override to localStorage
  const setOverride = (mode: DisplayMode | null) => {
    setSessionOverrideState(mode);
    if (storageKey) {
      try {
        if (mode === null) {
          localStorage.removeItem(storageKey);
        } else {
          localStorage.setItem(storageKey, mode);
        }
      } catch {
        // Ignore localStorage errors
      }
    }
  };

  // Clear override
  const clearOverride = () => setOverride(null);

  // Load override from localStorage when presentation changes
  useEffect(() => {
    if (!storageKey) {
      setSessionOverrideState(null);
      return;
    }

    try {
      const saved = localStorage.getItem(storageKey);
      setSessionOverrideState(saved as DisplayMode | null);
    } catch {
      setSessionOverrideState(null);
    }
  }, [storageKey]);

  return {
    /** Current active display mode */
    mode: activeMode,
    /** Auto-detected mode (before any session override) */
    autoMode,
    /** Whether a session override is active */
    hasOverride: sessionOverride !== null,
    /** Set a session override */
    setOverride,
    /** Clear session override (return to auto mode) */
    clearOverride,
  };
}

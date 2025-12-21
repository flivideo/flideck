import { useState, useEffect, useCallback } from 'react';

/**
 * Hook to manage quick filter state and Cmd+K keyboard shortcut.
 * Returns [isOpen, open, close] tuple.
 */
export function useQuickFilter(): [boolean, () => void, () => void] {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return [isOpen, open, close];
}

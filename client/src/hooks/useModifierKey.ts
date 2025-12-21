import { useState, useEffect } from 'react';

/**
 * Hook for tracking a modifier key state.
 * Returns true when the specified modifier key is held down.
 *
 * @param key - The modifier key to track ('Alt', 'Control', 'Meta', 'Shift')
 */
export function useModifierKey(key: 'Alt' | 'Control' | 'Meta' | 'Shift' = 'Alt'): boolean {
  const [isPressed, setIsPressed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === key) {
        setIsPressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === key) {
        setIsPressed(false);
      }
    };

    // Reset state when window loses focus (in case key was released while unfocused)
    const handleBlur = () => {
      setIsPressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [key]);

  return isPressed;
}

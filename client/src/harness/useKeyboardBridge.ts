import { useEffect } from 'react';

/**
 * useKeyboardBridge — enforces the keyboard ownership contract between FliDeck
 * and embedded slide content rendered inside .harness-slide.
 *
 * ## Keyboard Ownership Contract
 *
 * | Key(s)                        | Owner        | Modifier required |
 * |-------------------------------|--------------|-------------------|
 * | Ctrl/Cmd + ArrowLeft          | FliDeck      | Yes               |
 * | Ctrl/Cmd + ArrowRight         | FliDeck      | Yes               |
 * | Ctrl/Cmd + Home               | FliDeck      | Yes               |
 * | Ctrl/Cmd + End                | FliDeck      | Yes               |
 * | Ctrl/Cmd + K                  | FliDeck      | Yes               |
 * | F (no modifier)               | FliDeck      | No (no conflict)  |
 * | Escape                        | FliDeck      | No (no conflict)  |
 * | ArrowLeft/Right/Up/Down       | Slide        | None — free       |
 * | All other keys                | Slide        | None — free       |
 *
 * ## Why there is no conflict for arrow keys
 *
 * FliDeck's navigation handlers in PresentationPage.tsx guard all arrow/Home/End
 * navigation behind `if (!e.ctrlKey && !e.metaKey) return;`. Plain arrow keys
 * pressed inside a slide are therefore already free — FliDeck ignores them.
 *
 * ## What this bridge actually enforces
 *
 * The one direction that CAN conflict: a slide's own keyboard listener calls
 * `e.stopPropagation()` or `e.stopImmediatePropagation()` on a modifier+arrow
 * event, preventing FliDeck's window-level handler from seeing it.
 *
 * To prevent this, the bridge installs a `capture`-phase listener on `document`.
 * Capture runs before bubble, so we see every keydown before any slide listener
 * (which is bubble-phase). If a modifier+arrow/Home/End event originates from
 * inside .harness-slide, we call `e.stopImmediatePropagation()` to cancel any
 * competing same-capture-phase listeners, then re-dispatch a clone on `window`
 * so FliDeck's window-level bubble-phase handler receives it cleanly.
 *
 * For F and Escape: FliDeck's handler already skips events whose `target` is an
 * input/textarea, and slides are unlikely to capture bare F or Escape for
 * navigation. No special treatment is needed; they propagate normally.
 *
 * ## Development warnings
 *
 * In development mode the bridge also logs a console warning whenever a
 * modifier+navigation key originates from inside .harness-slide so that slide
 * authors are notified of potential conflicts early.
 */

/** Keys that FliDeck claims ownership of when combined with Ctrl/Cmd. */
const FLIDECK_NAV_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End']);

/** Sentinel attribute set on re-dispatched events to avoid double-handling. */
const REDISPATCH_FLAG = '__flideck_redispatch__';

function isInsideHarnessSlide(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest('.harness-slide') !== null;
}

export function useKeyboardBridge(): void {
  useEffect(() => {
    const handleCaptureKeydown = (e: KeyboardEvent) => {
      // Skip synthetic re-dispatched events we created ourselves
      if ((e as KeyboardEvent & { [REDISPATCH_FLAG]?: boolean })[REDISPATCH_FLAG]) return;

      const hasModifier = e.ctrlKey || e.metaKey;
      const isNavKey = FLIDECK_NAV_KEYS.has(e.key);
      const fromSlide = isInsideHarnessSlide(e.target);

      if (!hasModifier || !isNavKey || !fromSlide) return;

      // A FliDeck modifier+nav key originated from inside a slide.
      // Warn in development so slide authors know this key is reserved.
      if (import.meta.env.DEV) {
        console.warn(
          `[useKeyboardBridge] Slide intercepted FliDeck reserved shortcut: ` +
            `${e.metaKey ? 'Cmd' : 'Ctrl'}+${e.key}. ` +
            `FliDeck owns modifier+arrow/Home/End for presentation navigation. ` +
            `The event will be forwarded to FliDeck's handler.`
        );
      }

      // Stop the event from being consumed by any slide bubble-phase listener
      // that might call stopPropagation after us. We are in the capture phase
      // so this runs before the slide's own listeners.
      e.stopImmediatePropagation();

      // Re-dispatch a cloned event on window so FliDeck's window-level
      // bubble-phase handler (registered via window.addEventListener('keydown'))
      // can process it. We tag the clone so our own capture handler ignores it.
      const cloned = new KeyboardEvent('keydown', {
        key: e.key,
        code: e.code,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(cloned, REDISPATCH_FLAG, { value: true });
      window.dispatchEvent(cloned);
    };

    // Use capture phase so we run before any bubble-phase listener in slides.
    document.addEventListener('keydown', handleCaptureKeydown, { capture: true });

    return () => {
      document.removeEventListener('keydown', handleCaptureKeydown, { capture: true });
    };
  }, []);
}

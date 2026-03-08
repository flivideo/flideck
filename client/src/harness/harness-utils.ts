/**
 * FliDeck Harness Utilities
 *
 * Shared JS utilities that the harness injects into `window` so that embedded
 * slides can call them without bundling the same logic into every slide file.
 *
 * Currently handles the two clipboard patterns found in the corpus:
 *   - copyCommand(el) — used by 13 bmad-poem slides (code block copy button)
 *   - copyInline(el)  — variant used in some bmad-poem slides for inline code
 *
 * Call initHarnessGlobals() once when the harness mounts.
 */

/**
 * copyCommand — copies the text content of the nearest <code> element to the
 * clipboard. Slides call this as `onclick="copyCommand(this)"` on copy buttons
 * that sit adjacent to or inside a <pre><code> block.
 *
 * Walk strategy: check the clicked element itself, then walk up the DOM looking
 * for a parent that contains a <code> child, then fall back to the nearest
 * sibling <code> element.
 */
export function copyCommand(el: HTMLElement): void {
  // 1. The element itself might be or contain a <code> tag
  let codeEl: HTMLElement | null = null;

  if (el.tagName === 'CODE') {
    codeEl = el;
  } else {
    codeEl = el.querySelector('code');
  }

  // 2. Walk up ancestors looking for a sibling or descendant <code>
  if (!codeEl) {
    let current: HTMLElement | null = el.parentElement;
    while (current && !codeEl) {
      codeEl = current.querySelector('code');
      current = current.parentElement;
    }
  }

  if (!codeEl) {
    console.warn('[FliDeck harness] copyCommand: no <code> element found near', el);
    return;
  }

  const text = codeEl.textContent ?? '';
  void navigator.clipboard.writeText(text).then(() => {
    // Brief visual feedback: swap button text for 1.5 s
    const original = el.textContent;
    el.textContent = 'Copied!';
    setTimeout(() => {
      el.textContent = original;
    }, 1500);
  });
}

/**
 * copyInline — copies the text of the nearest inline <code> element.
 * Some slides use this as `onclick="copyInline(this)"` on small inline snippet
 * badges rather than full code blocks.
 *
 * Behaviour is the same as copyCommand; the two entry points are kept separate
 * to preserve the original calling convention from the corpus slides without
 * requiring any slide edits.
 */
export function copyInline(el: HTMLElement): void {
  copyCommand(el);
}

/**
 * initHarnessGlobals — registers harness utilities on `window`.
 * Call this once when the harness component mounts (e.g. in a top-level
 * useEffect with an empty dependency array).
 *
 * After this call, embedded slide scripts can call:
 *   window.copyCommand(el)
 *   window.copyInline(el)
 * or the short form if the slide was authored without explicit `window.` prefix:
 *   copyCommand(el)   ← works because window is the implicit global scope
 */
export function initHarnessGlobals(): void {
  (window as Window & { copyCommand?: typeof copyCommand; copyInline?: typeof copyInline }).copyCommand = copyCommand;
  (window as Window & { copyCommand?: typeof copyCommand; copyInline?: typeof copyInline }).copyInline = copyInline;
}

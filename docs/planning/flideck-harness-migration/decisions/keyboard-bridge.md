# Keyboard Bridge - FliDeck Harness

**Date**: 2026-03-06

## Keyboard Ownership Contract

| Key(s)                    | Owner   | Modifier required | Notes                                      |
|---------------------------|---------|-------------------|--------------------------------------------|
| Ctrl/Cmd + ArrowLeft      | FliDeck | Yes               | Navigate to previous asset                 |
| Ctrl/Cmd + ArrowRight     | FliDeck | Yes               | Navigate to next asset                     |
| Ctrl/Cmd + Home           | FliDeck | Yes               | Jump to first asset                        |
| Ctrl/Cmd + End            | FliDeck | Yes               | Jump to last asset                         |
| Ctrl/Cmd + K              | FliDeck | Yes               | Open quick filter                          |
| F (no modifier)           | FliDeck | No                | Toggle presentation mode                   |
| Escape                    | FliDeck | No                | Exit presentation mode / close quick filter|
| ArrowLeft/Right (plain)   | Slide   | None - free       | No conflict; FliDeck ignores unmodified    |
| ArrowUp/Down (plain)      | Slide   | None - free       | No conflict; FliDeck ignores unmodified    |
| All other keys            | Slide   | None - free       | Pass through without interference          |

## Is There an Actual Conflict?

**No conflict for arrow keys exists today.** FliDeck's `handleKeyDown` in `PresentationPage.tsx` (line 156) contains an early return guard:

```typescript
if (!e.ctrlKey && !e.metaKey) return;
```

This runs before the `switch` on `ArrowLeft`/`ArrowRight`/`Home`/`End`. Plain arrow keys pressed inside a slide are discarded by FliDeck. The modifier requirement is already enforced.

**Potential conflict that the bridge addresses:** A slide's bubble-phase listener could call `e.stopPropagation()` or `e.stopImmediatePropagation()` on a modifier+arrow event, preventing FliDeck's `window.addEventListener('keydown')` handler from seeing it. This is the edge case the bridge guards against.

## Bridge Implementation

`client/src/harness/useKeyboardBridge.ts`

The hook installs a `capture`-phase listener on `document`. Capture runs before bubble, so it executes before any slide script's bubble-phase `addEventListener('keydown', ...)`.

Logic on each keydown event:

1. Skip events tagged as FliDeck re-dispatches (prevents infinite loop).
2. Check: does the event have a Ctrl/Cmd modifier AND is it a FliDeck nav key (ArrowLeft, ArrowRight, Home, End) AND does it originate from inside `.harness-slide`?
3. If yes: call `e.stopImmediatePropagation()` to prevent any slide capture-phase or bubble-phase listener from consuming it, then re-dispatch a cloned `KeyboardEvent` on `window` tagged with a sentinel so FliDeck's handler receives it cleanly.
4. In development mode: log a console warning naming the reserved key that was intercepted.

For `F` and `Escape`: no special treatment. FliDeck's handler already skips events from input/textarea targets. Slides are unlikely to capture bare `F` or `Escape` for navigation, and neither conflicts with slide arrow-key navigation patterns.

## Where the Bridge Is Registered

`useKeyboardBridge()` is called inside `HarnessViewer.tsx`, immediately before `initHarnessGlobals()`. This means the bridge is:

- Active only when the harness rendering path is in use (a `HarnessViewer` is mounted).
- Not active during iframe rendering (the existing srcdoc path in `AssetViewer`).
- Cleaned up automatically when `HarnessViewer` unmounts.

`PresentationPage.tsx` was considered as an alternative registration point but rejected because the bridge should only be active when slide content is embedded inline. Placing it in `HarnessViewer` keeps the concern co-located with the harness subsystem.

## Conflict Analysis - Corpus

| Slide file                                    | Competing listener                             | Actual conflict? |
|-----------------------------------------------|------------------------------------------------|------------------|
| `agent-inventory/slides.html`                 | Plain arrow-key navigation (no modifier)       | No - FliDeck ignores plain arrows |
| `bmad-agents/pipeline.html`                   | Scroll-snap keyboard progression (plain arrows)| No - same reason |
| `claude-code-system-prompt/index.html`        | Tab-switching keyboard handler                 | Depends on keys used; likely plain arrows/Enter - no conflict |
| `claude-code-system-prompt-v1/index.html`     | Same tab-switching pattern                     | Same as above - no conflict |

All four corpus slides use plain (unmodified) arrow keys for their internal navigation. Since FliDeck's navigation requires `Ctrl/Cmd`, there is no direct key collision. The bridge protects against the theoretical scenario where a slide adds a modifier+arrow listener and calls `stopPropagation`, but none of the current corpus slides do this.

## Known Remaining Issues

1. **Slide stopPropagation on plain arrows**: If a slide calls `e.stopPropagation()` on a plain arrow key before FliDeck's `F`/`Escape` handlers see it, those are unaffected (they don't use arrow keys). No issue.

2. **Multiple HarnessViewer instances**: The bridge cleans up on unmount. If two viewers were simultaneously mounted (not the current design), two capture listeners would be registered. The sentinel flag prevents double-handling of re-dispatched events, so correctness is preserved but the warning would fire twice.

3. **Slide capture-phase listeners**: If a slide script registers its own `document.addEventListener('keydown', handler, { capture: true })`, the order of capture-phase listeners is registration order. The bridge registers when `HarnessViewer` mounts, after scripts run. A slide script that registers a capture listener at parse time (inline `<script>`) would register before the bridge and could still call `stopImmediatePropagation` on modifier+nav keys before the bridge sees them. This is an extreme edge case not present in the current corpus. The fix would be to register the bridge in `PresentationPage.tsx` before any slide mounts, but that adds the bridge to the non-harness (iframe) path unnecessarily.

4. **`F` and `Escape` from slides**: If a slide implements an interactive overlay that uses `Escape` to dismiss it, FliDeck's `Escape` handler fires first (it's at `window` bubble phase). In presentation mode this exits FliDeck rather than dismissing the slide overlay. This is an inherent conflict with modifier-free keys and is documented but not resolved by the bridge (it would require a more invasive change to FliDeck's `Escape` handling).

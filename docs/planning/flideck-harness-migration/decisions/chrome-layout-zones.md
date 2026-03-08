# Chrome Layout Zones — FliDeck Harness

**Date**: 2026-03-06
**Status**: Decision

## FliDeck Chrome Zones (Reserved)

FliDeck's chrome occupies three distinct screen regions in normal (non-presentation) mode:

| Zone | Position | Dimensions | Element |
|---|---|---|---|
| Top header | top-left to top-right, `top: 0` | ~52px tall (py-3 = 12px top + 12px bottom + ~28px content) | `<header>` in `Header.tsx` |
| Left sidebar | top-left, below header | 280px / 380px / 480px wide (S/M/L presets; default 380px) | `<aside>` in `Sidebar.tsx` |
| Container tab bar | below header, full width of content area | 48px tall (explicit `height: 48px`) | `<div>` in `TabBar.tsx`; only present when presentation has tabs |

**Header height estimation:** The header uses `py-3` (12px top + 12px bottom padding) with content that includes a 24px (`text-2xl`) brand name and small icon buttons (`h-5 w-5` = 20px). The tallest content (the brand text) drives the row height, making the effective header height approximately **52px** (could vary slightly with browser font rendering; `py-3` = 24px of padding + ~28px line height).

**Sidebar width:** User-configurable via S/M/L presets; persisted in localStorage under `flideck:sidebarWidth`. Preset values:
- Small: **280px**
- Medium: **380px** (default on first load)
- Large: **480px**

**Layout tree (normal mode):**

```
<div class="flex flex-col h-screen">          ← root, 100vh
  <header>                                    ← ~52px, top strip
  <div class="flex-1 flex overflow-hidden">   ← remaining height
    <aside style="width: {280|380|480}px">    ← left sidebar
    <main class="flex-1 flex flex-col">       ← content area
      [TabBar height: 48px, if tabs exist]
      [AssetViewer: flex-1, fills remaining]
```

**Layout tree (presentation mode — F key):**

Header and sidebar are both unmounted (`{!isPresentationMode && ...}`). The tab bar persists. Content area expands to fill the full viewport.

```
<div class="flex flex-col h-screen">
  <div class="flex-1 flex overflow-hidden">
    <main class="flex-1">                    ← full width
      [TabBar 48px, if tabs exist]
      [AssetViewer: flex-1]
```

## Slide Safe Zone

### Normal mode (sidebar + header visible)

The safe zone for slide-owned `position: fixed` elements is the content area inset:

| Edge | Reserved by FliDeck | Safe zone starts at |
|---|---|---|
| Top | ~52px (header) | `top: 52px` |
| Left | 280–480px (sidebar, default 380px) | `left: 380px` (default) |
| Right | 0 (no chrome) | `right: 0` — full width available |
| Bottom | 0 (no chrome) | `bottom: 0` — full width available |

Effectively: **the safe zone is `top: 52px; left: 380px; right: 0; bottom: 0`** with default sidebar width. If the user has resized the sidebar this shifts left boundary to 280px or 480px.

Note: Because slides are currently rendered inside an `<iframe>` (via `srcdoc`), `position: fixed` in slide content is fixed relative to the **iframe viewport**, not the host page. The iframe fills the content area (`flex-1`, `w-full h-full`), so slide-fixed elements are already naturally constrained to the content area. This is the current pre-harness behaviour.

**When the harness embeds slides as content fragments directly in the host page**, `position: fixed` in slide content will become fixed relative to the host viewport, causing collision with FliDeck chrome.

### Presentation mode (F key — chrome hidden)

The full viewport is available. The tab bar (48px) still occupies the top edge when the presentation uses container tabs.

| Edge | Reserved by FliDeck | Safe zone starts at |
|---|---|---|
| Top | 0 (no header/sidebar) or 48px (if tabs present) | `top: 0` or `top: 48px` |
| Left | 0 | `left: 0` |
| Right | 0 | `right: 0` |
| Bottom | 0 | `bottom: 0` |

There is a hover-only exit button (`absolute top-3 right-3 z-10`, 20px icon + 8px padding ~= 36px square) that appears on hover in presentation mode at `top: 12px; right: 12px`. Slide fixed elements at `top-right` may be visually obscured by this button on hover, but only briefly.

## Z-Index Layering

| Layer | z-index | Element |
|---|---|---|
| Slide content (current iframe) | n/a — isolated in iframe | AssetViewer iframe |
| Sidebar dropdown menus | `z-10` | Copy path menus, mode switcher |
| TabBar scroll buttons | `z-10` | Left/right scroll arrows |
| Presentation mode exit button | `z-10` | Hover exit button (top-right) |
| Header presentation switcher dropdown | `z-50` | Presentation name dropdown |
| QuickFilter modal (Cmd+K) | `z-50` | Full-screen overlay portal |

**Key constraint for embedded harness:** FliDeck's primary interactive chrome (header dropdown, QuickFilter) uses `z-50`. Any harness-embedded slide content that uses `z-index` values at or above 50 will compete with or occlude FliDeck's chrome. Slide content should be treated as if it lives below `z-40` in the host stacking context.

**Recommended harness containment strategy:** Wrap each embedded slide fragment in a containing block with `position: relative; isolation: isolate` to create a new stacking context. This prevents slide z-index values from escaping into the host page's stacking context.

## Recommendations for Embedded Slides

### General rule

Slides that use `position: fixed` must be migrated to use `position: absolute` relative to a known containing element, or must use CSS environment variables / custom properties exposed by the harness to inset themselves away from chrome zones.

### Top-left fixed elements (e.g. AppyDave logo)

The top-left corner is the most dangerous zone — it is occupied by both the header (top strip) and the sidebar (left strip). A slide element anchored at `top: 0; left: 0; position: fixed` will be completely hidden behind FliDeck chrome in normal mode.

Recommended approaches:

1. **Harness CSS variable injection (preferred):** The harness injects CSS custom properties into each slide's context before rendering:
   ```css
   :root {
     --flideck-top: 52px;      /* header height */
     --flideck-left: 380px;    /* sidebar width (dynamic) */
     --flideck-tab-bar: 0px;   /* 48px when tab bar present, else 0 */
   }
   ```
   Slides can then use: `top: var(--flideck-top, 0); left: var(--flideck-left, 0)`.

2. **Convert to `position: absolute`** within the harness content wrapper. The harness content wrapper is already sized to the safe zone, so `top: 0; left: 0` in absolute terms maps to the safe zone origin.

3. **Reposition the logo** to a chrome-free corner (bottom-left or bottom-right) if it does not need to be top-left.

### Top-right fixed elements

Top-right is safer in normal mode (no chrome there), but in presentation mode the hover exit button occupies `top: 12px; right: 12px; width: ~36px; height: ~36px`. Elements at top-right should use `top: 0; right: 0` with enough inset (e.g., `top: 8px; right: 8px`) to not visually conflict; or accept the brief overlap since the exit button only appears on hover.

### Fixed navigation bars (full-width or centered)

Slides that use `position: fixed; top: 0; width: 100%` for navigation bars will overlap the header in normal mode. These should either:
- Use `position: sticky` within the slide's scroll container instead
- Use the harness-injected `--flideck-top` variable to offset themselves
- Be restructured so the nav bar is part of the normal flow inside the slide container

### Presentation mode behaviour

In presentation mode, all chrome except the tab bar is removed. Slides should be tested in presentation mode as the "intended" fullscreen experience. The harness should signal the current mode to slides so they can adapt (e.g., via a CSS class on the root element or a CSS custom property `--flideck-presentation-mode: 1`).

## Known Conflict Cases

### claude-code-system-prompt-v1 (13 files — top-left AppyDave logo)

Based on corpus analysis, this presentation contains 13 slides each with a `position: fixed; top: 0; left: 0` AppyDave branding logo. In normal mode this logo will be fully behind the header + sidebar chrome. In presentation mode (F key) it will display correctly at `top: 0; left: 0`.

**Recommended fix:** Inject `--flideck-left` and `--flideck-top` CSS variables. The slides should update their logo positioning to:
```css
.logo {
  position: fixed;
  top: var(--flideck-top, 0px);
  left: var(--flideck-left, 0px);
}
```
Or convert to `position: absolute` within the harness wrapper.

### consultants-plugin/decision-tree.html (viewport-centered fixed nav)

This slide uses `position: fixed` to center a navigation panel in the viewport. In the current iframe model this works because the iframe is the viewport. In the embedded harness model, the fixed element will be centered in the browser window viewport, not in the slide content area, potentially appearing partially under the sidebar or off-center relative to the content area.

**Recommended fix:** Convert the navigation panel to `position: absolute` with explicit centering via `transform: translate(-50%, -50%)` relative to the content wrapper, or use `position: fixed` with computed left offset (`left: calc(var(--flideck-left, 0px) + 50%)`) to center within the safe zone.

## Summary Table

| Scenario | Header visible | Sidebar visible | Tab bar visible | Safe zone (top, left) |
|---|---|---|---|---|
| Normal mode, no tabs | Yes (~52px) | Yes (280-480px) | No | `(52px, 380px)` default |
| Normal mode, with tabs | Yes (~52px) | Yes (280-480px) | Yes (48px) | `(100px, 380px)` default |
| Presentation mode, no tabs | No | No | No | `(0, 0)` |
| Presentation mode, with tabs | No | No | Yes (48px) | `(48px, 0)` |

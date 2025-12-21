# FR-5: Presentation Controls

**Status:** Implemented
**Added:** 2025-12-18
**Implemented:** 2025-12-19

---

## User Story

As a presenter, I want intuitive controls for navigating presentations so that I can smoothly move through slides/assets during demos and recordings.

## Problem

FliDeck needs a comprehensive control system. Need to evaluate what exists and decide what additional controls to adopt from existing deck systems.

## Research Sources

### Scene Deck (`/ad/brains/brand-dave/.claude/commands/scene-deck.md`)
- Basic navigation: arrows, click
- `G` key: Toggle guide overlays (zone boundaries)
- `I` key: Toggle info panel
- Zone awareness for Ecamm (webcam, info panel areas)
- Hash navigation (`#slide-N`)

### Solo Deck (`/ad/brains/brand-dave/.claude/commands/solo-deck.md`)
- Standalone pages with optional index navigation
- No built-in slideshow controls (creative freedom)

### Arcade Deck (`/ad/brains/brand-dave/presentation-assets/deck-systems/arcade-deck/`)
- **Full navigation**: keyboard, click zones, touch, progress bar
- Rich animations (glitch, boot, CRT effects)
- TTY integration for live terminal demos
- Audio support via postMessage
- Game-style UI patterns

### Architecture Comparison (from Arcade Deck discovery)

| Aspect | Scene Deck | Arcade Deck |
|--------|------------|-------------|
| Navigation | Basic arrows/click | Full (keys, click zones, touch, progress) |
| Guide Overlays | YES (`G` key) | NO |
| Info Panel | YES (`I` key) | NO |
| Animations | CSS fadeIn | Rich library (glitch, boot, CRT) |
| Audio | NO | YES |
| TTY | NO | YES |

## Current FliDeck Controls

**v0.1.0:** No keyboard controls existed. Basic click navigation only via sidebar.

## Core Requirements

### Presentation Mode (Priority)
Hide FliDeck chrome (header + sidebar) so only the iframe content is visible.

**Use cases:**
- Screen recordings
- Live demos
- Focused viewing without distraction

**Suggested controls:**
- `F` key: Toggle presentation mode (fullscreen iframe)
- `Escape` key: Exit presentation mode (show chrome)

**Behavior:**
- Header and sidebar hidden
- Iframe expands to fill viewport
- Minimal or no visible FliDeck UI
- Easy exit back to normal view

## Rough Notes

- Review existing FliDeck controls
- Consider adopting from Scene Deck: guide overlays, info panel toggle
- Consider adopting from Arcade Deck: progress bar, touch support, keyboard shortcuts
- Decide which controls make sense for FliDeck's use case (viewing generated artifacts)
- Frame controls vs presentation-internal controls
- Presentation mode is distinct from browser fullscreen (F11) - it's about hiding FliDeck chrome

## Acceptance Criteria

- [x] **Presentation mode** - `F` key hides header/sidebar, iframe fills viewport
- [x] **Exit presentation mode** - `Escape` key restores normal view
- [x] Audit current FliDeck controls (v0.1.0 had no controls - now implemented)
- [x] Define control set appropriate for artifact viewing
- [x] Keyboard navigation with modifier keys (`Cmd/Ctrl+Arrow`, `Cmd/Ctrl+Home/End`)
- [x] Progress indicator (hidden in presentation mode for clean display)
- [x] Keyboard controls work even when iframe has focus
- [x] Presentation's internal controls (arrows, etc.) not blocked
- [ ] Touch/swipe support (optional - deferred to future FR)

## Technical Notes

### Keyboard Control Architecture

**Challenge:** Iframe captures focus, blocking parent window keyboard events.

**Solution:** Two-layer keyboard handling:

1. **Window-level listener** - Catches keys when iframe doesn't have focus
2. **postMessage bridge** - Script injected into iframe forwards FliDeck control keys to parent

### Injected Script (AssetViewer.tsx)

The iframe content receives a script that:
- Listens for `keydown` events inside the iframe
- Forwards only FliDeck control keys (`Escape`, `F`, `Cmd/Ctrl+Arrow`, `Cmd/Ctrl+Home/End`)
- Uses `postMessage` to send to parent
- Does NOT block other keys (presentation's internal controls work normally)

### Why Modifier Keys?

Using `Cmd/Ctrl+Arrow` instead of plain arrows:
- Avoids conflicts with presentation's own navigation (many use plain arrows)
- Clear separation: modifier = FliDeck controls, plain = presentation controls
- Standard pattern in apps that host content

## Completion Notes

**What was done:**
- Implemented presentation mode toggle with `F` key (hides header/sidebar, iframe fills viewport)
- Implemented `Escape` key to exit presentation mode
- Added keyboard navigation with modifier keys: `Cmd/Ctrl+Left/Right` (prev/next), `Cmd/Ctrl+Home/End` (first/last)
- Added progress indicator (hidden in presentation mode for clean display)
- Added presentation mode button (expand icon) to Header for discoverability
- Added hover-only exit button in presentation mode (invisible until hover)
- Injected postMessage bridge into iframe for keyboard forwarding
- Presentation's internal keyboard controls (arrows, etc.) work normally

**Files changed:**
- `client/src/pages/PresentationPage.tsx` (modified) - Presentation mode, keyboard handler, postMessage listener
- `client/src/components/layout/Header.tsx` (modified) - Presentation mode toggle button with tooltip
- `client/src/components/ui/AssetViewer.tsx` (modified) - Keyboard forwarding script injection

**Keyboard Shortcuts:**
| Key | Action |
|-----|--------|
| `F` | Toggle presentation mode |
| `Escape` | Exit presentation mode |
| `Cmd/Ctrl + ←` | Previous asset |
| `Cmd/Ctrl + →` | Next asset |
| `Cmd/Ctrl + Home` | First asset |
| `Cmd/Ctrl + End` | Last asset |

**Testing notes:**
1. Navigate to a presentation with multiple assets
2. Press `F` to enter presentation mode - header and sidebar should hide
3. Click into the iframe content (presentation should work normally)
4. Press `Escape` to exit - works even when iframe has focus
5. Use `Cmd+Left/Right` to navigate between assets
6. Hover top-right corner to reveal exit button
7. Presentation's own controls (arrows, down, etc.) work normally

**Status:** Complete

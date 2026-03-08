# Learnings: Cleanup & CSS Isolation — flideck-harness-migration

## 1. Manifest-Before-Delete Rule (CRITICAL)

**What happened:** The cleanup agent deleted original presentation folders (e.g., `bmad-poem/`)
and renamed the v2 folders to replace them. The original folders contained rich `index.json`
manifests with tabs, groups, and slide ordering. The v2 folders only had migrated HTML files.
After rename, all manifest data was gone — bmad-poem lost 10 tabs and 343 slides of grouping.

**Recovery:** The brains repo tracked the manifests in git. The deletes were unstaged (working
tree only), so `git checkout HEAD -- <paths>` restored all manifests instantly.

**Rule going forward:**
> Before deleting any presentation folder, verify the replacement folder has a copy of `index.json`.
> If the replacement has no manifest, copy it first: `cp original/index.json replacement/index.json`

**Cleanup agent prompt fix:** Any future cleanup prompt must include:
```
BEFORE deleting any folder, check if it has index.json.
If yes, copy index.json to the replacement folder first.
Only delete after confirming the manifest is in the destination.
```

---

## 2. CSS Isolation: @scope vs Shadow DOM

**What we built:** HarnessViewer uses CSS `@scope (.harness-slide) { }` to prevent slide CSS
from leaking into FliDeck chrome. Slide `:root`/`body`/`html` selectors are remapped to `:scope`.

**What was originally requested:** Web Components (Shadow DOM isolation).

**Why @scope was the right call for this codebase:**
- 92% of slides are pure CSS + HTML fragments with no scripts
- Slides are self-contained trusted files, not untrusted third-party content
- Shadow DOM requires programmatic `attachShadow()` on a host element — awkward for full HTML docs
- Scripts inside Shadow DOM still run in the same global JS context — no JS isolation either way
- `@scope` required zero slide reauthoring; Shadow DOM would have needed authoring changes

**What @scope does NOT protect against:**
- Outside CSS bleeding IN to slides (acceptable — FliDeck uses Tailwind, no broad selectors)
- Slide JS accessing global `window` / `document` (acceptable — slides are trusted)

**If Shadow DOM is ever revisited:** The initialization in HarnessViewer would need to create a
host div, call `attachShadow({ mode: 'open' })`, and inject the parsed body into the shadow root.
CSS custom property inheritance across shadow boundaries would need evaluation.

---

## 3. Playwright Visual Diff Pipeline

`playwright/app-compare.js` navigates the real React app (not raw HTML) and screenshots the full
viewport including chrome. It compares iframe (port 5202, old worktree) vs HarnessViewer (port 5200).

**Lessons:**
- Must go to root page first to clear localStorage before navigating to a specific presentation,
  otherwise stale selectedAssetId from a previous session can cause mismatches
- The old server (port 5203) needed `client/.env.local` with `VITE_API_URL=http://localhost:5203`
  to avoid it defaulting to port 5201 and hitting CORS errors
- `--compare-all` mode generates a 540-slide report; this is too large for CI without filtering

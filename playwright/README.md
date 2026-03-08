# FliDeck Visual Verification Pipeline

Compares iframe rendering (main branch) vs harness rendering (worktree) for visual regressions,
on a per-slide basis across all presentations.

## How it works

Slides are screenshotted **directly from the server's static file endpoint**, not through the
React app. This is because the React client (`/presentation/:id`) uses React state for asset
selection — there is no URL query param to navigate to a specific slide. The static HTML files
are the actual slide content that both the iframe and harness render.

| Instance    | Static files URL base                           | API base                        |
|-------------|-------------------------------------------------|---------------------------------|
| Main branch | `http://localhost:5201/presentations/:id/:file` | `http://localhost:5201/api/...` |
| Worktree    | `http://localhost:5203/presentations/:id/:file` | `http://localhost:5203/api/...` |

## Prerequisites

Both FliDeck server instances must be running before executing the pipeline.

**Terminal 1 — main branch (iframe rendering):**
```bash
cd /Users/davidcruwys/dev/ad/flivideo/flideck
npm run dev
# server listens on :5201, client on :5200
```

**Terminal 2 — harness worktree:**
```bash
cd /path/to/flideck/.worktrees/harness-migration
PORT=5203 CLIENT_URL=http://localhost:5202 npm run dev
# server listens on :5203, client on :5202
```

## Install

```bash
cd /Users/davidcruwys/dev/ad/flivideo/flideck/playwright
npm install
npx playwright install chromium
```

## Run

```bash
# PoC: single presentation
npm run verify:poc
# equivalent to: node pipeline.js --presentation color-exploration

# All presentations
npm run verify
```

## Output

| Path | Description |
|------|-------------|
| `output/report.md` | Per-slide pass/fail table with diff percentages |
| `output/pass/` | Side-by-side images for passing slides (left=main, center=harness, right=diff) |
| `output/flagged/` | Side-by-side images for failing or manual-review slides |

The pipeline exits with code 1 if any slides fail or error; exit 0 means all pass.

## API Response Shape

`GET /api/presentations` returns:
```json
{
  "success": true,
  "_context": { "presentationsRoot": "~/path/to/presentations" },
  "data": [
    { "id": "color-exploration", "name": "Color Exploration", "assets": [...], ... }
  ]
}
```

`GET /api/presentations/:id` returns:
```json
{
  "success": true,
  "_context": { "presentationsRoot": "~/path/to/presentations" },
  "data": {
    "id": "color-exploration",
    "name": "Color Exploration",
    "assets": [
      { "id": "intro", "filename": "intro.html", "name": "Intro", "isIndex": false, ... }
    ]
  }
}
```

## Configuration

Edit the constants at the top of `pipeline.js` to change ports, viewport size, or diff threshold:

| Constant | Default | Description |
|---|---|---|
| `MAIN_STATIC` | `http://localhost:5201` | Main branch server (static files + API) |
| `HARNESS_STATIC` | `http://localhost:5203` | Worktree server (static files + API) |
| `VIEWPORT` | `{ width: 1280, height: 800 }` | Screenshot viewport |
| `DIFF_THRESHOLD` | `0.01` | Max fraction of pixels that may differ (1%) |
| `MANUAL_REVIEW_PATTERNS` | `[...]` | Asset ID patterns to skip (dynamic content) |

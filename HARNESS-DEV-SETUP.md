# Harness Migration — Dev Environment Setup

Three processes need to run during the migration campaign.
Each maps to one terminal window (or background process).

---

## Window 1 — Main FliDeck (browse + pipeline source)

**What it does**: Full FliDeck app. Browse presentations at localhost:5200.
Also serves original slide HTML for the pipeline at localhost:5201.

**Directory**: `/Users/davidcruwys/dev/ad/flivideo/flideck`

```bash
cd /Users/davidcruwys/dev/ad/flivideo/flideck
npm run dev
```

**Starts**:
- React client → http://localhost:5200  (browse FliDeck here)
- Express server → http://localhost:5201 (pipeline reads originals from here)

**Ready when you see**: `VITE ready in ... ms` + `FliDeck Server` box showing port 5201

---

## Window 2 — Harness Server (pipeline target)

**What it does**: Serves v2 presentation fragments and `harness-shell.html`
for the pipeline. No React client needed — server only.

**Directory**: `/Users/davidcruwys/dev/ad/flivideo/flideck/.worktrees/harness-migration`

```bash
cd /Users/davidcruwys/dev/ad/flivideo/flideck/.worktrees/harness-migration
PORT=5203 CLIENT_URL=http://localhost:5202 npm run dev -w server
```

**Starts**:
- Express server → http://localhost:5203 (pipeline reads v2 fragments + harness-shell.html from here)

**Note**: `PORT=5203` must be set inline — nodemon does not load `.env` files automatically.

**Ready when you see**: `FliDeck Server` box showing port 5203

---

## Window 3 — Pipeline (run on demand)

**What it does**: Screenshots both servers, pixel-diffs each slide pair,
writes `playwright/output/results.json` and `playwright/output/report.md`.

**Directory**: `/Users/davidcruwys/dev/ad/flivideo/flideck/playwright`

```bash
cd /Users/davidcruwys/dev/ad/flivideo/flideck/playwright

# PoC only (color-exploration, 2 slides)
node pipeline.js --poc

# Single presentation
node pipeline.js --presentation bmad-poem

# All presentations
node pipeline.js
```

**Run after**: both Window 1 and Window 2 are showing their ready messages.

**Output**:
- `playwright/output/results.json` — full results with quality ratings
- `playwright/output/report.md`   — markdown summary table
- `playwright/output/pass/`       — side-by-side PNGs for passing slides
- `playwright/output/flagged/`    — side-by-side PNGs for failures / manual review

---

## Quick health check

Run this to confirm both servers are up before running the pipeline:

```bash
curl -s http://localhost:5201/api/health | python3 -m json.tool | grep status
curl -s http://localhost:5203/api/health | python3 -m json.tool | grep status
```

Both should return `"status": "ok"`.

---

## Port map

| Port | Process     | Purpose                              |
|------|-------------|--------------------------------------|
| 5200 | Vite client | Browse FliDeck in browser            |
| 5201 | Express     | Serve original slides to pipeline    |
| 5203 | Express     | Serve v2 fragments + harness-shell   |
| 5202 | (unused)    | Harness client — not needed for pipeline or browsing |

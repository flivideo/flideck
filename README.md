# FliDeck

**A local viewer for folders of generated HTML slides.** Point it at a folder of presentations (the kind Claude Code
agents produce) and it lists them, mounts each one, and lets you move between slides without a pile of browser tabs.

> [!NOTE]
> **Status: inactive.** FliDeck is not in active development. The last commit is 2026-10-09 and the real feature work
> ended in March 2026 (the backlog is closed, 60 of 60 done). It still runs and the code is complete for what it
> set out to do; treat it as parked, not as a live part of the FliVideo recording pipeline.

## What it is

- **A viewer, not a builder.** It does not author or template slides. The one editing it supports is ordering assets
  (drag and drop) through a small manifest.
- **A presentation is a folder** that holds at least one entry HTML file (`presentation.html`, `index.html`, or tabbed
  variants). No database, no registration: if the entry point exists, the folder shows up.
- **Optional manifest** (`index.json`) inside a presentation sets slide order, groups, tabs and metadata. Missing files
  are skipped and new files appear at the end, so a broken manifest never hides slides.
- **Agent-friendly API.** The same REST API serves the React frontend and agents that create or reorder slides;
  `GET /api/capabilities` describes it.
- **Keys:** `⌘` + arrows move between assets, `⌘K` quick filter, `F` presentation mode.

Within the FliVideo suite it sits **outside the pipeline**: it hands nothing on and nothing in the pipeline reads from
it. See the [suite map](https://github.com/flivideo/flivideo#readme).

## Run

```bash
npm install
npm run dev          # client on 5200, server on 5201
```

For a persistent run use `./start.sh`, which builds `shared`, checks the ports and launches both processes under
[Overmind](https://github.com/DarthSim/overmind) (a process manager; install it first, and it needs `tmux`).
Production: `npm run build` then `npm start`.

**Needs:** Node and npm · Overmind for `./start.sh` only · **Ports:** UI 5200, API 5201.
Set `presentationsRoot` (the folder that holds your presentations) in `config.json`, which falls back to
`config.example.json` when absent, or on the Config page at `/config` in the app.

## Docs

| Read                                                                     | For                                                                                                                         |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| [CONTEXT.md](CONTEXT.md)                                                 | System context: purpose, abstractions, workflows, design decisions, constraints, failure modes (a snapshot from 2026-04-05) |
| [CLAUDE.md](CLAUDE.md)                                                   | How to work on this app: the rules, dev-server care, Overmind commands                                                      |
| [docs/README.md](docs/README.md)                                         | Index of the planning, requirements and changelog documents                                                                 |
| [docs/agent-guide.md](docs/agent-guide.md)                               | Creating or modifying presentations as an agent                                                                             |
| [docs/harness-authoring-standard.md](docs/harness-authoring-standard.md) | How a slide has to be written to render in the viewer                                                                       |
| [CHANGELOG.md](CHANGELOG.md)                                             | Version history                                                                                                             |

## Status

**Inactive and parked.** Checked against the repo at `63fbdef` (2026-11-24); no code has changed since 2026-10-09.

Public repo `flivideo/flideck`

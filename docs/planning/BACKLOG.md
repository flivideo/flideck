# Project Backlog — FliDeck

**Last updated**: 2026-03-19
**Total**: 26 | Pending: 8 | In Progress: 0 | Done: 18 | Deferred: 0 | Rejected: 0

---

## Pending

### From flideck-cleanup-2026

- [ ] B013 — Vite 7 upgrade: client package.json 2-line change (vite 6.4.1 → 7.3.1, plugin-react v4 → v5) | Priority: low
- [ ] B014 — API response envelope standardisation: adopt canonical `{ success: true, data: T }` shape across all 5 endpoint patterns | Priority: medium
- [ ] B015 — Review and sign off 292 unchecked acceptance criteria across 34 PRD files | Priority: medium
- [ ] B016 — Write 13 missing changelog entries (FR-16 through FR-28 from late-Dec build burst) | Priority: low

### From flideck-harness-migration

- [ ] B022 — consultants-plugin pipeline false positives: token injection overrides deviant palette on original screenshots causing 1–33% diffs; need per-presentation token injection opt-out or dedicated comparison mode | Priority: medium
- [ ] B023 — bmad-poem deferred slides: story-2-5-sat-cheatsheet.html + story-2-6-sat-cheatsheet.html fetch from localhost:4321; decide server-reachability strategy before production harness switch | Priority: low
- [ ] B024 — Type C slides deferred: agent-inventory/slides.html (webcam + keyboard nav), dam-overview/slides.html (scroll-snap teleprompter), claude-code-system-prompt/index.html (fetch pattern), claude-code-system-prompt-v1/index.html (same), consultants-plugin/architecture-slides.html — each needs explicit migration decision | Priority: medium
- [ ] B025 — Playwright CI integration: `--compare-all` mode now produces a full 540-slide report; wire into CI so harness regressions are caught automatically | Priority: low

---

## In Progress

(none)

---

## Done

- [x] B001 — Harness shell prototype (fonts, CSS tokens, base URL, clipboard, HarnessViewer, stripSlideWrapper, useKeyboardBridge) | Completed: flideck-harness-migration
- [x] B002 — Playwright visual verification pipeline (screenshot + pixel-diff per slide, harness token injection fix, full 540-slide `--compare-all` report) | Completed: flideck-harness-migration
- [x] B003 — Migration toolchain: Type A wrapper-strip script (migrate-type-a.js, asset copy, idempotent) | Completed: flideck-harness-migration
- [x] B004 — Migration toolchain: Type B copyCommand/toggle hoist (migrate-type-b.js, 16 Type C red-flag patterns) | Completed: flideck-harness-migration
- [x] B005 — Harness scroll strategy for viewport-lock/scroll-snap slides (Option C: manifest flag + auto-detection heuristic) | Completed: flideck-harness-migration
- [x] B006 — Harness keyboard bridge (capture-phase guard protecting Cmd+Arrow nav shortcuts) | Completed: flideck-harness-migration
- [x] B007 — Harness authoring standard spec (docs/harness-authoring-standard.md — answers to 6 open questions) | Completed: flideck-harness-migration
- [x] B008 — Remove iframe/srcdoc rendering from FliDeck codebase; replace with HarnessViewer | Completed: flideck-harness-migration
- [x] B009 — Fix deck-systems nested folder (arcade-deck-chiang-mai moved to presentation-assets/) | Completed: flideck-harness-migration Phase 0
- [x] B010 — Fix dent-kpi-system placeholder (deleted stale folder + tmp-01.jpg) | Completed: flideck-harness-migration Phase 0
- [x] B011 — JSON asset filter: confirmed already excluded by HTML-only allowlist at PresentationService.ts:301 — no code change needed | Completed: flideck-harness-migration Phase 0
- [x] B012 — Define harness chrome layout zones (flex layout ~52px header, ~380px sidebar; position:fixed implications documented) | Completed: flideck-harness-migration Phase 0
- [x] B017 — Dead code removal: env.ts, logger.ts, Sidebar.old.tsx, useModifierKey.ts | Completed: flideck-cleanup-2026
- [x] B018 — Security: path traversal guard, AJV manifest validation, deepMerge type safety | Completed: flideck-cleanup-2026
- [x] B019 — Security: fix iframe postMessage origin validation + case-sensitive head injection | Completed: flideck-cleanup-2026
- [x] B020 — Zero npm vulnerabilities (cleared 4: 2 HIGH rollup + minimatch, 1 moderate, 1 low) | Completed: flideck-cleanup-2026
- [x] B021 — Viewport-lock manifest flag (`viewport-lock: true`) for arcade slides: claudemas-12-days (3 slides), zero-to-app (3 slides), arcade-deck-chiang-mai (22 slides) | Completed: flideck-harness-migration
- [x] B026 — Production cleanup: delete original pre-migration folders, rename -v2 folders to canonical names, restore manifests from git after accidental deletion | Completed: flideck-harness-migration

---

## Deferred

(none)

---

## Rejected

(none)

# Next Round Brief — FliDeck

**Written**: 2026-03-19
**Based on**: BACKLOG.md pending items (B013–B016, B022–B025) + harness-migration Notes

## Goal

Address the medium-priority backlog left after two completed campaigns (flideck-cleanup-2026, flideck-harness-migration). The two highest-value items are API envelope standardisation (B014) and Type C slide decisions (B024). The two lowest-effort are Vite 7 upgrade (B013, 2-line change) and the missing changelog entries (B016).

## Background

- Harness migration is complete — 519 slides migrated, iframe rendering removed
- 0 TypeScript errors, 0 npm vulnerabilities, 43 tests passing
- AGENTS.md is up to date and ready to inherit for this wave

## Suggested Work Units (priority order)

### Quick wins (wave 1)
1. **vite7-upgrade** — Bump vite 6→7 and @vitejs/plugin-react v4→v5 in client/package.json. Verify build passes. 2-line change. (B013)
2. **changelog-entries** — Write the 13 missing changelog entries for FR-16 through FR-28. Source: `docs/planning/flideck-harness-migration/learnings/missing-changelog.md`. (B016)

### Structural work (wave 2)
3. **api-envelope-standardisation** — Audit all 5 API response shapes, adopt canonical `{ success: true, data: T }` across routes that don't already use it. Read `docs/planning/flideck-cleanup-2026/decisions/api-envelope.md` first. (B014)
4. **type-c-slide-decisions** — For each of the 5 deferred slides in B024, make an explicit decision (migrate / wrap / leave as-is / replace with placeholder). Document in `decisions/`. At least `dam-overview/slides.html` (scroll-snap) and `consultants-plugin/architecture-slides.html` may be straightforward to resolve. (B024)

### Infrastructure (wave 3)
5. **playwright-ci** — Wire `node playwright/pipeline.js --compare-all` into CI. Report format already exists. (B025)
6. **pipeline-deviant-palette-fix** — Implement per-presentation token injection opt-out in `pipeline.js` for deviant-palette presentations (consultants-plugin, n8n-story-gen). (B022)

### Deferred / human-decision items (not for agent wave)
- **B015** — 292 unchecked ACs: PO/UAT review, not a code task
- **B023** — localhost:4321 slides: requires architectural decision on server reachability

## Inherit From

`docs/planning/flideck-harness-migration/AGENTS.md` — do not rebuild from scratch.

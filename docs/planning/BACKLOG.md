# Project Backlog — FliDeck

**Last updated**: 2026-03-19
**Total**: 41 | Pending: 9 | In Progress: 0 | Done: 32 | Deferred: 0 | Rejected: 0

---

## Pending

### From flideck-cleanup-2026

- [ ] B013 — Vite 7 upgrade: client package.json 2-line change (vite 6.4.1 → 7.3.1, plugin-react v4 → v5) | Priority: low
### From flideck-api-envelope audit (2026-03-19)

- [ ] B041 — Route integration tests: add supertest-based HTTP tests for envelope shape + status codes across all 7 route files; also add createApiResponse unit tests in responseHelper.test.ts (supertest already installed as devDep) | Priority: medium
- [ ] B015 — Review and sign off 292 unchecked acceptance criteria across 34 PRD files | Priority: medium
- [ ] B016 — Write 13 missing changelog entries (FR-16 through FR-28 from late-Dec build burst) | Priority: low

### From flideck-test-quality-fixes audit (2026-03-19)

- [ ] B040 — Fix proto-pollution guard test (third attempt): written-output inspection still doesn't prove the guard (V8 intercepts `obj['__proto__'] = value` as prototype assignment, so JSON.stringify never serializes it regardless); fix via null-prototype base object in deepMerge OR document as untestable by normal means | Priority: low

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
- [x] B027 — Security: fix `cleanupPort` PID injection (validate numeric before `kill -9`) + fix `POST /:id/open` command injection (use `execFile` not `exec`) + fix `deepMerge` prototype pollution in ManifestService + PresentationService | Completed: flideck-security-foundations
- [x] B028 — Pre-condition for B014: add `createApiResponse<T>()` helper in `utils/responseHelper.ts`; not yet adopted by route handlers (adoption is B014) | Completed: flideck-security-foundations
- [x] B029 — Architecture: extract `ManifestService` from `PresentationService` (FR-19/FR-21/FR-26 methods) — PresentationService reduced from 2,492 to 1,504 lines | Completed: flideck-security-foundations
- [x] B030 — Test coverage: `PresentationService` discovery + traversal prevention — `discoverAll()` entry-point priority, `assertSafeId()` security boundary, `saveAssetOrder()` disk persistence, `createPresentation()` | Completed: flideck-security-foundations
- [x] B031 — Test coverage: `stripSlideWrapper()` — styles extracted, body unwrapped, viewportLock detection (style blocks + inline body style), multi-style collection — 18 tests | Completed: flideck-security-foundations
- [x] B032 — Fix PATCH manifest TOCTOU: read/merge/validate/write atomic inside `patchManifest`; per-presentation write mutex serialises concurrent mutations | Completed: flideck-security-foundations
- [x] B033 — Fix `deepMerge` third copy in `presentations.ts` — found to be already resolved on main after security-foundations merge; standalone deepMerge in presentations.ts was removed by patch-toctou-fix; ManifestService has the only remaining copy (correct Object.keys impl) | Completed: flideck-security-foundations (implicit)
- [x] B034 — Fix `assertSafeId` called only on cache miss in `getById` — moved before cache check; warm-cache traversal test added | Completed: flideck-write-path-integrity
- [x] B035 — ManifestService test coverage: 12 tests (getManifest, patchManifest, bulkAddSlides ×3 strategies, proto-pollution, write-lock) | Completed: flideck-write-path-integrity
- [x] B036 — PresentationService write-path tests: 8 tests (addSlide, dedup, legacy migration, saveAssetOrder slides-format, deleteTab cascade + orphan) | Completed: flideck-write-path-integrity
- [x] B037 — Fix proto-pollution guard test: replaced Object.prototype assertion with written-output inspection using JSON.parse payload; test quality audit found remaining weakness (B040 raised) | Completed: flideck-test-quality-fixes
- [x] B038 — Fix concurrent write-lock test: replaced mutually-exclusive overwrites with additive meta key patches (name + purpose); mutation-resistant — both keys must survive | Completed: flideck-test-quality-fixes
- [x] B039 — Add empty-root guard to getById: guard added, AppError(400) thrown when root is empty, consistent with discoverAll | Completed: flideck-test-quality-fixes
- [x] B014 — API response envelope standardisation: createApiResponse adopted across all 7 route files (43 responses); 0 inline envelopes remain; _context preserved on 4 presentation GET endpoints | Completed: flideck-api-envelope

---

## Deferred

(none)

---

## Rejected

(none)

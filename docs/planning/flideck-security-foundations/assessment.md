# Assessment: flideck-security-foundations

**Campaign**: flideck-security-foundations
**Date**: 2026-03-19 → 2026-03-19
**Results**: 8 complete, 0 failed
**Quality audits**: code-quality-audit + test-quality-audit run post-campaign

---

## Results Summary

| Item | Result | Commit |
|------|--------|--------|
| fix-pid-injection | ✅ PID validated numeric, sleep→setTimeout, CSP re-enabled | 3b82713 |
| fix-command-injection | ✅ exec()→execFile(), shell interpolation eliminated (route-level) | 3b82713 |
| api-response-helper | ✅ responseHelper.ts created, no route changes yet | 9dd41ec |
| fix-deepmerge-proto | ✅ Object.keys + __proto__ guard in ManifestService + PresentationService | ca658e2 |
| patch-toctou-fix | ✅ atomic read/merge/validate/write + write mutex | 37b5021 |
| manifest-service-extraction | ✅ ManifestService.ts extracted, PresentationService 2492→1504 lines | cde7156 |
| test-render-path | ✅ 18 new client tests for stripSlideWrapper | 0e5eb10 |
| test-core-service | ✅ 17 new server tests for PresentationService | 6b39ac4 |

**Final metrics**: 78 passing (35 client + 43 server), +36 net new tests, 0 TS errors, build passes.

---

## What Worked Well

1. **ManifestService extraction was clean** — PresentationService dropped 988 lines with zero tsc errors and all 43 existing tests still passing. Delegation pattern is well-structured and easy to follow.
2. **Write mutex is a genuine improvement** — `withWriteLock` in ManifestService correctly serialises concurrent manifest mutations using a promise chain with `finally` release. Real TOCTOU protection, not just documentation.
3. **stripSlideWrapper test coverage** — 18 tests covering happy paths, viewport-lock detection variants (style blocks, inline body style, scroll-snap), and multi-style collection. Pure-function module is now regression-protected.
4. **Prototype-pollution fix in ManifestService** — correct implementation using `Object.keys` with explicit proto-key guard. The fix is in the right place — the canonical write path.
5. **CSP re-enabled** — helmet's `contentSecurityPolicy` was silently disabled (`false`). Re-enabling it with defaults is the right call, even if compatibility validation is still needed.

---

## What Didn't Work

### Audit finding: Command injection survives in `/:id/open`

The `fix-command-injection` work unit fixed `presentations.ts:1056` — but the audit identified that `presentation.path` is constructed from `path.join(presentationsRoot, id)` where `presentationsRoot` is user-controlled via `config.json` and is never sanitised for shell metacharacters. A `presentationsRoot` of `/tmp/my$(reboot)dir` would still execute arbitrary commands despite the route-level `execFile` fix. The fix was incomplete — it addressed the `id` vector but not the `presentationsRoot` vector.

**Fix**: `execFile('open', [presentation.path])` with array arguments already bypasses the shell entirely — the path value doesn't matter. This is already the correct API; no additional sanitisation needed. The risk was theoretical during this campaign because the fix is already using `execFile`.

### Audit finding: `deepMerge` duplicate in `presentations.ts` still proto-pollutable

`fix-deepmerge-proto` fixed two locations (ManifestService + PresentationService). A third copy exists in `presentations.ts` line 1082 (standalone route-level function) using `for (const key in source)` with no prototype guard. This is inconsistent — one of three copies remains vulnerable.

### Audit finding: `assertSafeId` skipped on cache hit

`getById` only calls `assertSafeId` on cache miss. A traversal ID that aliases a cached key bypasses the security check. Low real-world risk (attacker would need to control caching), but structurally incorrect — the guard should run unconditionally before the cache lookup.

### Audit finding: ManifestService has zero tests

The core data-mutation engine (~1165 lines) was extracted but not tested. `patchManifest`, `bulkAddSlides`, `syncManifest`, `validateManifest`, `syncFromIndex`, `withWriteLock`, `deepMerge` — none are exercised. You could delete the body of any of these and the full test suite would still pass. The `test-core-service` work unit tested `PresentationService` discovery and traversal prevention, not the write pipeline.

---

## Key Learnings — Application

1. **Extraction without tests is a liability** — ManifestService is now a cleaner boundary but inherits the God class's test debt. Extraction should include a minimum smoke test for each extracted public method.
2. **Security fixes need a "completeness audit"** — the command injection fix addressed the explicit file/line in the plan but missed the `presentationsRoot` vector. Security work items should include a "threat model completeness" check, not just "fix the line I was told to fix".
3. **Three copies of the same function is too many** — `deepMerge` exists in three places (ManifestService, PresentationService, presentations.ts). Fix one, the other two drift. Shared utility in `utils/` with one test is better.
4. **The write path is the test gap** — discovery (read path) is now tested. Mutations (write path) are not. The highest-risk surface in a presentation harness is data corruption, not data discovery.

---

## Key Learnings — Ralph Loop

1. **Context ran out before the mandatory quality gate** — the previous session ended at ~5% context without running the quality audits. The gate was skipped, not avoided. Next campaign: run quality audits at end of Wave 3 (not after all 4 waves), so they complete before context exhausts.
2. **Wave 4 (tests) should come before Wave 3 (extraction)** — or at least immediately after. Extraction without tests creates a window where a large new file is in the codebase with zero coverage. Test the thing while the author of the extraction is still in context.
3. **"Helper only — no route changes yet" is debt, not caution** — `responseHelper.ts` is inert. It was created as pre-condition for B014, but without adoption it adds zero value to the current branch. Either adopt it in a couple of routes as proof-of-concept, or defer the creation entirely to the B014 campaign.
4. **Plan wave sequencing should call out test deps explicitly** — the plan correctly noted Wave 4 depends on Wave 3 extraction. It should have also noted that Wave 3 extraction without tests is incomplete by definition.

---

## Promote to Main KDD?

Suggested for promotion (human makes final call):

- **deepMerge anti-pattern**: three copies of the same function in a codebase means security fixes only land in one. Shared utility + one test is the pattern to enforce.
- **Extraction = extraction + smoke tests**: any refactor that creates a new public class boundary should include at minimum a smoke test for each public method, committed in the same PR.
- **Quality gate timing**: run code/test quality audits at end of penultimate wave, not after all work is done — ensures audit findings can be acted on in-session.

---

## Suggestions for Next Campaign

### Immediate follow-on (create as B033–B036 in BACKLOG):

- **B033** — Fix `deepMerge` in `presentations.ts` (third copy, still proto-pollutable) — move all three to `utils/deepMerge.ts`, single test
- **B034** — Fix `assertSafeId` unconditional call (before cache lookup in `getById`)
- **B035** — ManifestService test coverage: `patchManifest` (deep merge + write mutex), `bulkAddSlides` (all 3 conflict strategies), `deepMerge` prototype-pollution guard — minimum 12 tests
- **B036** — PresentationService write path tests: `addSlide` (duplicate detection + legacy migration), `deleteTab` (cascade strategy), `saveAssetOrder` (slides-format manifest branch)

### AGENTS.md improvements for next wave:

- Add explicit instruction: "when creating a new service class, include a `__tests__/[ServiceName].test.ts` with smoke tests for each public method in the same work unit"
- Add to quality gates: "assertSafeId must be called before cache lookup, not inside the cache-miss branch"
- Add to anti-patterns: "do not create standalone deepMerge implementations — import from `utils/deepMerge.ts`"

### Wave sizing:
- This campaign's 4-wave structure was correct. The problem was Wave 4 (tests) not having enough scope — it was 1 agent testing 1 service, when it should have been 2 agents testing PresentationService + ManifestService in parallel.
- Next campaign should run ManifestService tests and PresentationService write-path tests as separate parallel agents.

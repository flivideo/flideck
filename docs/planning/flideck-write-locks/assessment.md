# Assessment: FliDeck Write Locks

**Campaign**: flideck-write-locks
**Date**: 2026-03-19
**Results**: 1 complete, 0 failed

---

## Results Summary

| Item | Status | Outcome |
|------|--------|---------|
| write-lock-presentation-service (B047) | [x] Complete | 16 methods wrapped; 1 concurrent test added; 104 server tests pass; tsc clean |

Also reconciled:
- B045 (route collision), B046 (proto-pollution test), B048 (sample.test.ts) — all already shipped in `93d6c75` from previous session. BACKLOG.md updated.

---

## What Worked Well

- Lock pattern copy from ManifestService was mechanical and correct — no ambiguity
- Single agent handled all 16 methods cleanly in one pass
- Test shape (two concurrent `addSlide` calls, both slides must survive) is the right proof pattern — mirrors ManifestService reference
- tsc clean on first attempt
- Campaign scope was tight (one work unit) — fast to plan and execute

---

## What Didn't Work

- **BACKLOG.md not reconciled at prior campaign end** — B045, B046, B048 were already shipped but still showed as pending. Cost one round of confusion at session start.

---

## Key Findings from Quality Audits

### Code Quality (High)

`ManifestService` has 6 delegated write methods with no `withWriteLock`:
`setManifest`, `bulkAddSlides`, `bulkAddGroups`, `syncManifest`, `applyTemplate`, `syncFromIndex`

The two `writeLocks` maps (one on each service) are completely separate. A concurrent `PresentationService.addSlide` + `ManifestService.bulkAddSlides` call on the same presentation ID will NOT serialise — they operate in different lock namespaces. B047 only solved the `PresentationService`-owned methods; the delegated path is still exposed.

### Test Quality (High)

Missing concurrent tests for the highest-value race scenarios:
- `createGroup` — same additive race as `addSlide` (two concurrent calls, both groups must survive)
- `deleteTab` concurrent with `addSlide` — cascade deletion while a new slide is being added to a group under the tab
- `updateSlide` — two callers updating different fields of the same slide simultaneously

### Test Quality (Medium)

`writeLocks` Map is never reset between tests. The `beforeEach` clears the cache but not the lock state. Not currently triggered (distinct IDs per test), but a stuck lock in one test could cause a timeout cascade.

---

## Key Learnings — Application

- The write-lock fix is incomplete: `ManifestService` delegated methods need the same treatment. Per-presentation locking is meaningless if the two services use independent lock maps.
- `createPresentation` is the only method that puts the `fs.pathExists` check inside the lock — the 13 others leave it outside, creating a narrow but acceptable TOCTOU window for local-first use.

## Key Learnings — Ralph Loop

- Next-round-brief format worked well: exact line numbers + method list + "what NOT to do" section left no ambiguity for the agent
- Single work unit campaigns are the right size when the domain is well-defined (one service, one pattern)
- Reconcile BACKLOG.md before closing a session, not at the start of the next one

---

## Suggestions for Next Campaign

### New backlog items raised by audits

- **B052** — Write locks for ManifestService delegated methods (`setManifest`, `bulkAddSlides`, `bulkAddGroups`, `syncManifest`, `applyTemplate`, `syncFromIndex`) — HIGH
- **B053** — Concurrent write tests for `createGroup`, `deleteTab` (cascade), `updateSlide` — HIGH/MEDIUM
- **B054** — Reset `writeLocks` in `beforeEach` or expose a `_resetForTest()` method — MEDIUM

### AGENTS.md improvements for next campaign

- Add the ManifestService delegated write methods list as a known complexity
- Note that pre-lock `fs.pathExists` is the accepted pattern (consistent, not a bug to fix)

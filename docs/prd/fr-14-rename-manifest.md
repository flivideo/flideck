# FR-14: Rename Manifest to index.json

## Status: Implemented

**Added:** 2025-12-22
**Author:** David (via PO agent)

---

## User Story

As a system integrator, I want the manifest file to be named `index.json` so that it aligns with the "index is the root document" convention used across FliVideo, SoloDeck, and other agents.

---

## Problem

Currently FliDeck uses `flideck.json` as its manifest filename. This causes confusion because:

1. **Convention mismatch:** SoloDeck and other agents think of `index.*` as the root document (index.html, index.yaml). Having `flideck.json` breaks this pattern.

2. **Multiple manifests:** Some presentations have both `index.yaml` (agent metadata) and `flideck.json` (FliDeck order). This creates confusion about which is the source of truth.

3. **Future unification:** We plan to merge schemas so agents and FliDeck share one manifest. Using `index.json` makes this natural.

---

## Solution

Rename the manifest file from `flideck.json` to `index.json`.

### Migration Strategy

1. **Read both, prefer index.json:**
   ```typescript
   const manifest = await this.readManifest(folderPath, 'index.json')
                 || await this.readManifest(folderPath, 'flideck.json');
   ```

2. **Write only index.json:** New saves go to `index.json`

3. **No auto-migration:** Don't automatically rename existing files. Old `flideck.json` files continue to work until manually updated or overwritten by a new save.

---

## Acceptance Criteria

1. [x] FliDeck reads `index.json` as primary manifest
2. [x] FliDeck falls back to `flideck.json` if `index.json` doesn't exist
3. [x] Drag-drop reordering saves to `index.json` (not `flideck.json`)
4. [x] Existing presentations with `flideck.json` continue to work
5. [x] After any save operation, manifest is in `index.json`
6. [x] CLAUDE.md updated to reference `index.json`

---

## Technical Notes

### Files to Modify

| File | Change |
|------|--------|
| `server/src/services/PresentationService.ts` | Update `MANIFEST_FILENAME`, add fallback read |
| `CLAUDE.md` | Update documentation references |
| `docs/prd/fr-07-asset-ordering.md` | Update references (or add note about rename) |

### Code Changes

```typescript
// Before
const MANIFEST_FILENAME = 'flideck.json';

// After
const MANIFEST_FILENAME = 'index.json';
const LEGACY_MANIFEST_FILENAME = 'flideck.json';

private async readManifest(folderPath: string): Promise<FlideckManifest | null> {
  // Try new name first
  let manifest = await this.tryReadManifest(path.join(folderPath, MANIFEST_FILENAME));
  if (manifest) return manifest;

  // Fall back to legacy name
  return this.tryReadManifest(path.join(folderPath, LEGACY_MANIFEST_FILENAME));
}
```

---

## Out of Scope

- Automatic migration of existing `flideck.json` files
- Schema changes (that's FR-15)
- Agent-side changes (they'll adopt `index.json` convention separately)

---

## Completion Notes

**Implemented:** 2025-12-22

**What was done:**
- Changed `MANIFEST_FILENAME` constant from `flideck.json` to `index.json`
- Added `LEGACY_MANIFEST_FILENAME` constant for `flideck.json`
- Updated `readManifest()` to try `index.json` first, fall back to `flideck.json`
- Created helper `tryReadManifestFile()` for cleaner read logic
- Updated CLAUDE.md with new filename and backwards compatibility note
- Updated type comments in shared/src/types.ts

---

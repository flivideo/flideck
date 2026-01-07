# FR-29: Slide Notes in Manifest

## Summary

Add an optional `notes` field to the slide schema in the manifest, allowing agents and users to capture contextual information about slides at creation time.

## User Story

As a **content creator using AI agents to generate FliDeck slides**,
I want to **add notes to slides when creating them**,
So that **I can remember the context, purpose, and design intent when reviewing them later**.

## Problem Statement

**Current situation:**
- When creating multiple slides for a presentation, it's hard to remember the context and purpose of each slide
- Looking at a slide list days or weeks later, titles alone don't convey:
  - Why was this slide created?
  - What was the design intent?
  - What content source was it based on?
  - What audience or persona is it for?
- No structured way to capture this information at creation time

**Impact:**
- Lost context after creating batches of slides
- Harder to maintain and update presentations
- Can't remember which slides need revision vs which are complete
- No way to communicate intent to collaborators or future self

**Example scenario:**

User creates 20 slides for a presentation. Two weeks later:

```
story-3-2-sat.html          ← What was this about?
story-3-2-overview.html     ← Why did I create this?
epic-3-workflow.html        ← Is this complete or draft?
```

Without notes, the creator has to open each slide to understand it.

**Desired state:**

Agent creates slide with notes:
```
User: "Create slide for Story 3.2 SAT testing, notes: demonstrates the new prompt workflow for BMAD training, draft version"

Agent: Creates slide with manifest entry:
{
  "id": "story-3-2-sat",
  "title": "Story 3.2 SAT — New Prompt Workflow",
  "notes": "Demonstrates the new prompt engineering workflow for SAT testing. Created for BMAD Method Epic 3 training materials. Status: Draft, needs review."
}
```

Later, user can reference notes to understand slide context.

## Proposed Solution

### Extend Slide Schema

Add an optional `notes` field to the slide definition in `index.json`:

```typescript
interface ManifestSlide {
  id: string;
  file: string;
  title?: string;
  description?: string;
  group?: string;
  order?: number;
  recommended?: boolean;
  notes?: string;  // NEW: Optional contextual notes
}
```

### Example Manifest

```json
{
  "meta": {
    "version": "1.0",
    "created": "2025-12-24T10:00:00Z"
  },
  "slides": [
    {
      "id": "story-3-2-sat",
      "file": "story-3-2-sat.html",
      "title": "Story 3.2 SAT — New Prompt Workflow",
      "group": "epic-3",
      "order": 5,
      "notes": "Demonstrates the new prompt engineering workflow for SAT testing. Created for BMAD Method Epic 3 training materials. Status: Draft, needs review by stakeholder."
    },
    {
      "id": "story-3-2-overview",
      "file": "story-3-2-overview.html",
      "title": "Story 3.2 Overview",
      "group": "epic-3",
      "order": 4,
      "notes": "High-level overview slide for non-technical audience. Based on requirements from FR-21."
    },
    {
      "id": "epic-3-workflow",
      "file": "epic-3-workflow.html",
      "title": "Epic 3 Workflow Diagram",
      "group": "epic-3",
      "order": 1
      // No notes - field is optional
    }
  ]
}
```

### Use Cases for Notes

**1. Agent Creation Context:**
```
"notes": "Created from BMAD Method v6 chapter 3, section on SAT testing workflows."
```

**2. Status Tracking:**
```
"notes": "Draft. Waiting for stakeholder review before finalizing."
```

**3. Design Intent:**
```
"notes": "Simple version for beginners. Advanced version is in epic-3-advanced.html."
```

**4. Source Attribution:**
```
"notes": "Content based on Claude Code documentation, updated 2026-01-05."
```

**5. Persona Targeting:**
```
"notes": "Created for Mary persona (product manager). Technical version is in john-slides group."
```

**6. Revision History:**
```
"notes": "v2: Updated workflow diagram per feedback. Original at story-3-2-sat-v1.html."
```

## Why This Approach Works

**Leverage existing infrastructure:**
- Manifest (`index.json`) already exists
- Schema is FliDeck-owned via `/api/schema/manifest`
- Agents already write to manifest via API
- No new file format or storage mechanism needed

**Notes travel with presentation:**
- Stored in the presentation folder, not FliDeck's database
- Portable - copy folder, notes come along
- Version controllable with git

**Backward compatible:**
- `notes` is optional
- Existing manifests without notes continue to work
- No migration needed

**Agent-friendly:**
- Simple string field, easy for agents to populate
- No complex structure to learn
- Works with existing slide creation API

**Future-proof:**
- Foundation for UI features (display notes in sidebar, search, filter)
- Can extend to richer formats later (markdown, timestamps, tags)
- Can add similar fields for groups/tabs if needed

## Acceptance Criteria

**Schema & Types:**
- [ ] `shared/src/types.ts` updated with `notes?: string` in `ManifestSlide` interface
- [ ] JSON Schema in `/api/schema/manifest` includes `notes` field with type `string`, marked as optional
- [ ] TypeScript compiler accepts manifests with and without `notes` field

**API Behavior:**
- [ ] `POST /api/presentations/:id/slides` accepts `notes` in request body
- [ ] `PUT /api/presentations/:id/slides/:slideId` can update `notes` field
- [ ] `POST /api/presentations/:id/manifest/slides/bulk` accepts `notes` for each slide
- [ ] `GET /api/presentations/:id` returns slides with `notes` field if present
- [ ] `GET /api/presentations/:id/manifest` returns raw manifest with `notes`

**Persistence:**
- [ ] Notes written to `index.json` when creating slides
- [ ] Notes persist across server restarts
- [ ] Notes survive manifest sync operations (don't get deleted)

**Backward Compatibility:**
- [ ] Existing manifests without `notes` load successfully
- [ ] Slides without `notes` display normally in UI
- [ ] No validation errors for missing `notes` field

**Documentation:**
- [ ] CLAUDE.md API table mentions `notes` parameter where applicable
- [ ] `/api/capabilities` workflow examples show `notes` usage
- [ ] JSON Schema documentation describes `notes` field purpose

## Technical Notes

### Implementation Steps

**1. Update TypeScript Types**

```typescript
// shared/src/types.ts
export interface ManifestSlide {
  id: string;
  file: string;
  title?: string;
  description?: string;
  group?: string;
  order?: number;
  recommended?: boolean;
  notes?: string;  // Add this
}
```

**2. Update JSON Schema**

```typescript
// server/src/routes/schema.ts (or wherever schema is defined)
const manifestSchema = {
  // ... existing schema
  slides: {
    type: "array",
    items: {
      type: "object",
      properties: {
        id: { type: "string" },
        file: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        group: { type: "string" },
        order: { type: "number" },
        recommended: { type: "boolean" },
        notes: { type: "string" }  // Add this
      },
      required: ["id", "file"]
    }
  }
};
```

**3. Update API Routes**

No code changes needed - routes already pass through all fields.
Verify that:
- `POST /api/presentations/:id/slides` accepts arbitrary fields
- `PUT /api/presentations/:id/slides/:slideId` merges fields
- Bulk operations preserve fields

**4. Update Capabilities**

```json
// server/src/routes/capabilities.ts
{
  "common_workflows": {
    "add_slide_to_presentation": {
      "example": {
        "method": "POST",
        "url": "/api/presentations/my-deck/slides",
        "body": {
          "file": "new-feature.html",
          "group": "features",
          "title": "New Feature Overview",
          "notes": "Draft slide for stakeholder review. Based on requirements doc v2."
        }
      }
    }
  }
}
```

### Future Enhancements (Out of Scope)

**UI Display Options:**
- Show notes in sidebar on hover (tooltip)
- Add notes panel to slide viewer
- Search/filter by notes content
- Notes editor in FliDeck UI

**Richer Format:**
- Support markdown in notes
- Add `tags: string[]` field alongside notes
- Add `created: timestamp` and `modified: timestamp`
- Add `author: string` field

**HTML Integration:**
- Also write notes as HTML comment in slide file:
  ```html
  <!-- FliDeck Notes: Demonstrates new workflow for SAT testing -->
  ```
- Two-way sync between manifest notes and HTML comments

### Validation Considerations

**Should notes have max length?**
- Not enforced in v1 - keep it simple
- Future: Could add warning if notes exceed 500 chars
- JSON has no practical size limit for strings

**Should notes support newlines?**
- Yes - JSON strings support `\n`
- UI can display as multi-line or single-line truncated
- Agent can write: `"notes": "Line 1.\nLine 2.\nLine 3."`

**Should notes be searchable?**
- Not in v1 - just storage
- Future: Add notes to quick filter search (FR-9)
- Future: Full-text search across all notes

## Dependencies

None - extends existing manifest schema.

## Related

- FR-15 (Rich Manifest Schema) - Introduced slide metadata fields
- FR-16 (Agent Slide Management API) - Slide CRUD operations
- FR-19 (Manifest Schema & Data API) - Schema definition and validation
- FR-27 (Agent Capability Discovery) - Will document notes field usage
- FR-09 (Quick Filter) - Future: Search notes content

## Priority

**Low-Medium** - Nice to have, improves workflow but not critical.

## Out of Scope

- UI for displaying notes in FliDeck (future enhancement)
- UI for editing notes in FliDeck (future enhancement)
- Search/filter by notes (future enhancement)
- Markdown support in notes (future enhancement)
- Timestamped notes or revision history (future enhancement)

---

**Added**: 2026-01-07
**Status**: Pending

# FR-10: Query API for External Systems

**Status:** Pending
**Added:** 2025-12-21
**Source:** Brainstorm session

---

## User Story

As a Claude skill or external system, I want to query FliDeck's current state, so I can understand what presentations exist and provide context-aware assistance.

## Problem

External systems (particularly Claude Code skills) have no way to discover what's in FliDeck. They can't answer questions like "what presentations do I have?" or "what slides are in this deck?"

## Solution

Add read-only query endpoints under `/api/query/` prefix. These return JSON data about FliDeck's current state without modifying anything.

## Endpoints

### GET /api/query/routes

List available presentation routes from config.

**Response:**
```json
{
  "routes": [
    {
      "name": "slide-decks",
      "path": "/presentations/slide-decks",
      "presentationCount": 9
    },
    {
      "name": "solo-panels",
      "path": "/presentations/solo-panels",
      "presentationCount": 4
    }
  ],
  "currentRoute": "slide-decks"
}
```

### GET /api/query/routes/:route

Get details for a specific route including its presentations.

**Response:**
```json
{
  "name": "slide-decks",
  "path": "/presentations/slide-decks",
  "presentations": [
    {
      "id": "claude-code-intro",
      "name": "Claude Code Intro",
      "assetCount": 12,
      "lastModified": "2025-12-21T10:30:00Z"
    },
    {
      "id": "bmad-overview",
      "name": "BMAD Overview",
      "assetCount": 8,
      "lastModified": "2025-12-20T15:45:00Z"
    }
  ]
}
```

### GET /api/query/presentations/:id

Get details for a specific presentation including its slides/assets.

**Response:**
```json
{
  "id": "claude-code-intro",
  "name": "Claude Code Intro",
  "route": "slide-decks",
  "assets": [
    {
      "id": "index.html",
      "name": "index.html",
      "order": 1,
      "size": 4523,
      "lastModified": "2025-12-21T10:30:00Z"
    },
    {
      "id": "setup.html",
      "name": "setup.html",
      "order": 2,
      "size": 3201,
      "lastModified": "2025-12-21T09:15:00Z"
    }
  ],
  "totalAssets": 12
}
```

## Acceptance Criteria

- [ ] `GET /api/query/routes` returns all configured presentation routes
- [ ] `GET /api/query/routes/:route` returns presentations for that route
- [ ] `GET /api/query/presentations/:id` returns assets for that presentation
- [ ] All endpoints return proper JSON with consistent structure
- [ ] 404 returned for non-existent routes or presentations
- [ ] Endpoints are read-only (no side effects)

## Technical Notes

- Follow existing API patterns in `server/src/routes/`
- Use PresentationService for data (already has discovery logic)
- Consider caching headers for external consumers
- No authentication required (local-first app)

## Future Enhancements

- `?format=text` for ASCII reports (like FliHub)
- Write endpoints for creating/modifying presentations
- WebSocket subscription for real-time updates

---

## Completion Notes

**What was done:**
- Created `/api/query/routes` endpoint - lists available presentation routes
- Created `/api/query/routes/:route` endpoint - returns presentations for a route
- Created `/api/query/presentations/:id` endpoint - returns detailed asset info with file sizes
- All endpoints return proper JSON with consistent structure
- 404 errors for non-existent routes or presentations
- Adapted "routes" concept to work with current single-root architecture

**Files changed:**
- `server/src/routes/query.ts` (new) - Query route handlers
- `server/src/routes/index.ts` (modified) - Register query routes

**Testing notes:**
```bash
# List routes
curl http://localhost:5201/api/query/routes

# Get presentations in a route
curl http://localhost:5201/api/query/routes/presentation-assets

# Get presentation details
curl http://localhost:5201/api/query/presentations/zero-to-app
```

**Status:** Complete

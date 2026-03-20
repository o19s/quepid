# Angular Services: Responsibilities and Server vs Client Placement

This document maps each Angular service used by the core workspace (`/case/:id/try/:try_number`) to its responsibilities and where that responsibility lives under the **committed** port plan on `main`.

**Plan:** [angularjs_elimination_plan.md](./angularjs_elimination_plan.md) (scope and parity). **Stimulus/Turbo detail:** [rails_stimulus_migration_alternative.md](./rails_stimulus_migration_alternative.md).

**Legend**

- **Planned (post-Angular)** = placement needed to match **current** behavior after Angular is removed.
- **Consider (optional)** = not required for parity; only if you explicitly adopt it (see intentional design doc).

---

**Current runtime (bootstrap, flash, websockets, export UX):** [workspace_behavior.md](./workspace_behavior.md). **What is still Angular vs already migrated:** [angularjs_elimination_plan.md](./angularjs_elimination_plan.md) *Current state*.

---

## Summary: Server vs Client

| Service | Primary responsibility | This branch | Planned (post-Angular) |
|--------|------------------------|-------------|-------------------------|
| `caseSvc` | Case CRUD, selection, archive | Angular + APIs | **Server:** persistence APIs. **Client:** route/selection state; URL is source of truth |
| `queriesSvc` | Query CRUD, search, scoring, ordering | CRUD via API; **search + scoring in browser** (splainer + `ScorerFactory`); `proxy/fetch` when configured | **Server:** CRUD/order/ratings API. **Client:** live search + per-query scoring — **same as today** (P0 parity) |
| `settingsSvc` | Try settings | Angular + tries API | **Server:** try API. **Client:** current try from URL + editors (vanilla ACE per plan) |
| `scorerSvc` / `ScorerFactory` | Scorer metadata + scoring | CRUD via API; **interactive scoring in browser**; server for jobs | **Server:** CRUD + existing job paths. **Client:** extracted `ScorerFactory` / helpers for immediate feedback |
| `docCacheSvc` | Doc cache by id | `docCacheSvc.js` + `docResolverSvc` | **Client:** plain JS singleton (Phase 4) |
| `diffResultsSvc` | Diff state & comparison | Angular | **Client:** build diff like today (parity) |
| `querySnapshotSvc` / `snapshotSearcherSvc` | Snapshots; snapshot-as-searcher | Angular + snapshot APIs | **Server:** snapshot API. **Client:** searcher-shaped wrapper for UI reuse |
| `caseTryNavSvc` | URLs, case/try from route | `caseTryNavSvc.js` | **Client:** [api_client.md](./api_client.md) conventions |
| `queryViewSvc` | Diff toggles, expand/collapse | Angular | **Client:** Stimulus or React state |
| `paneSvc` | East pane drag/width | Angular | **Client:** Stimulus / layout (Phase 2) |
| `importRatingsSvc` | Import ratings | Angular + import API | **Server:** import API. **Client:** form + upload UX |
| `annotationsSvc` | Annotations CRUD | Angular + API | **Server:** API. **Client:** list/editor wired to same endpoints |
| `rateElementSvc` | Rating scale UI | Angular | **Client:** Stimulus or React control |
| `ratingsStoreSvc` | In-memory ratings + API sync | Angular | **Hybrid:** persist via API; **Client:** in-memory map + optimistic updates (parity with today) |
| `qscoreSvc` | Score→color for query list | Angular | **Client:** shared helpers |
| `searchEndpointSvc` | Endpoints for case | Angular + API | **Server:** API. **Client:** selection UX |
| `caseCSVSvc` | Export / download | Angular + export APIs | **Hybrid:** same APIs; **Client:** trigger download from Stimulus/React |
| `rateBulkSvc` | Bulk rating UI | Angular | **Client** |
| `varExtractorSvc` | Curator vars from params | Angular | **Client** |
| `searchErrorTranslatorSvc` | Search error strings | Angular | **Client** |
| `bootstrapSvc` | Current user on init | Angular + API | **Server:** API. **Client:** layout bootstrap or fetch |
| `teamSvc` | Teams, share case | Angular + API | **Server:** API. **Client:** dropdowns/modals |
| `userSvc` | User get/update | Angular + API | **Server:** API |

### Consider (optional) — not parity requirements

| Area | Idea | When to use |
|------|------|-------------|
| Doc bodies | Server endpoint for lookup-by-id instead of splainer-only | Only if product/engineering explicitly adds it |
| Diff UI | Server-rendered diff partials / Turbo | Only if a slice replaces client-built diff |
| Annotations / lists | Turbo Streams to push list updates | Only if you adopt stream-driven HTML for that pane |
| Query list / scores | Turbo Streams for row/header updates instead of client events | Optional pattern from [turbo_streams_guide.md](./turbo_streams_guide.md); parity can stay client-driven like Angular |

**Phase-level tasks** (when to extract `ScorerFactory`, replace `broadcastSvc`, Phase 4 vs 6 scoring, etc.): [angularjs_elimination_plan.md](./angularjs_elimination_plan.md). **Turbo vs client-owned UI:** [intentional_design_changes.md](./intentional_design_changes.md) §2.

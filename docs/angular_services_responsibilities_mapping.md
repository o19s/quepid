# Angular Services: Responsibilities and Server vs Client Placement

This document maps each Angular service used by the core workspace (`/case/:id/try/:try_number`) to its responsibilities and recommends where each should live after migration: **server-side (Rails)** or **client-side (Stimulus/JS)**.

**See also:** [angular_to_stimulus_hotwire_viewcomponents_checklist.md](angular_to_stimulus_hotwire_viewcomponents_checklist.md), [workspace_api_usage.md](workspace_api_usage.md), [workspace_state_design.md](workspace_state_design.md), [per_component_migration_checklist.md](per_component_migration_checklist.md).

---

## Current State

- **All routes** now use the **modern stack**: ViewComponents + Stimulus + Turbo. Angular has been **completely removed** from the codebase — `app/assets/javascripts/services/`, `app/assets/javascripts/factories/`, and `app/assets/javascripts/components/` directories no longer exist.
- **Core workspace** (`/case/:id/try/:try_number`): Uses `core_modern` layout, `application_modern.js`, 36 ViewComponents, and 50 Stimulus controllers.
- **Cases, Teams, Scorers pages**: Migrated to Rails views + Stimulus in the `deangularjs` branch (see [deangularjs_branch_comparison.md](deangularjs_branch_comparison.md)).
- **Key replacements**: `docCacheSvc` → `app/javascript/modules/doc_cache.js` (DocCache); `caseTryNavSvc.getQuepidRootUrl()` → `utils/quepid_root.js` (`getQuepidRootUrl`). Export uses `app/javascript/controllers/export_case_controller.js` and `Api::V1::Export::CasesController` (server-side). All API calls use `app/javascript/api/fetch.js` (`apiFetch`) for CSRF handling.

---

## Summary: Server vs Client

| Service | Primary responsibility | Recommendation |
|--------|------------------------|----------------|
| `caseSvc` | Case CRUD, selection, archive | **Server** (API + Turbo); selection/UI state **Client** |
| `queriesSvc` | Query CRUD, scoring, search, ordering | **Hybrid**: CRUD/ordering **Server**; search execution + scoring **Client** (or move scoring to server) |
| `settingsSvc` | Try (search config) settings | **Server** (API); current try selection **Client** |
| `scorerSvc` / `ScorerFactory` | Scorer metadata + scoring logic | **Server** for CRUD; **Client** for runCode/score (or reimplement server-side) |
| `docCacheSvc` | Document caching (by id) | **Client** (or replace with server doc lookup). *Replaced by `modules/doc_cache.js` in Stimulus.* |
| `diffResultsSvc` | Diff (snapshot comparison) state & fetching | **Client** (or server-rendered diff views) |
| `querySnapshotSvc` / `snapshotSearcherSvc` | Snapshots list/CRUD; snapshot-as-searcher | **Server** API; snapshot “searcher” **Client** |
| `caseTryNavSvc` | Navigation URLs, case/try from route | **Client** (Stimulus + URL/route). *Replaced by `utils/quepid_root.js` in Stimulus.* |
| `queryViewSvc` | Diff toggles, query expand/collapse | **Client** (view state) |
| `paneSvc` | East pane width / drag | **Client** (UI only) |
| `importRatingsSvc` | Import ratings (hash/rre/ltr) and info needs | **Server** (existing API) |
| `annotationsSvc` | Annotations CRUD | **Server** (existing API) |
| `rateElementSvc` | Rating scale UI (open/close/rate/reset) | **Client** (Stimulus) |
| `ratingsStoreSvc` | Per-query ratings in memory + API calls | **Hybrid**: persistence **Server**; in-memory + UI **Client** |
| `qscoreSvc` | Score-to-color mapping for query list | **Client** (pure UI utility) |
| `searchEndpointSvc` | Search endpoint list, fetch for case | **Server** (API); list/selection **Client** |
| `caseCSVSvc` | Export CSV/JSON stringify, format download | **Hybrid**: export API **Server**; Stimulus uses `Api::V1::Export::CasesController` |
| `rateBulkSvc` | Bulk rating scale UI (like rateElementSvc) | **Client** (Stimulus) |
| `varExtractorSvc` | Extract curator vars from query params | **Client** (pure utility) |
| `searchErrorTranslatorSvc` | HTTP code→string, format search errors | **Client** (pure utility) |
| `bootstrapSvc` | Fetch current user on app init | **Server** (API); bootstrap flow **Client** |
| `teamSvc` | Teams list, share/unshare case | **Server** (API) |
| `userSvc` | Current user get/update | **Server** (API) |

---

## 1. caseSvc

**Responsibilities**

- Case list: fetch all cases, archived, dropdown; bootstrap/refetch.
- Case CRUD: create, delete, delete case queries, rename, update nightly, associate book.
- Case selection: `selectCase` / `selectTheCase`, `getSelectedCase`, `isCaseSelected`.
- Archive/unarchive; track last viewed, last score; run evaluation; clone case; save default scorer.
- Wraps API: `api/cases`, `api/cases/:id`, `api/cases/:id/scores`, `api/clone/cases`, etc.

**Server vs client**

- **Server (Rails):** All case CRUD and persistence (existing API). Case list can be server-rendered (e.g. Turbo Frames).
- **Client (Stimulus/JS):** “Selected case” and “selected try” for the current page are view/route state; URL (e.g. `/case/123/try/2`) is the source of truth. Navigation and “current case/try” can live in Stimulus + route.

---

## 2. queriesSvc

**Responsibilities**

- Query CRUD: bootstrap queries, create, persist, persist bulk, delete, move; notes and options (fetch/save); display order and position.
- Per-query: search (via searchSvc/searcher), score (via scorerSvc), rated docs, pagination, “show only rated”, sync to book.
- Builds `Query` objects with ratingsStore, doc list, scoring, search-from-settings and search-from-snapshot.
- Coordinates scoring across queries (`scoreAll`), diff creation, and book sync.

**Server vs client**

- **Server:** Query and rating persistence (API already used). Display order, notes, options can stay as API; optionally move “score all” to a background job (already have run_evaluation).
- **Client:** Executing live search against the user’s search endpoint must stay client (or go through a proxy). Per-query scoring (runCode) is currently client; can remain so or be reimplemented server-side for consistency. Query list UI state (which query is selected, expanded) is client.

---

## 3. settingsSvc

**Responsibilities**

- Try (search configuration) list and current try: `setCaseTries`, `setCurrentTry`, `bootstrap` (GET `api/cases/:id/tries`).
- Default/template settings per search engine (solr, es, os, vectara, algolia, static, searchapi); TMDB demo settings.
- Editable/applicable settings copy; save (POST new try) and update (PUT existing try); delete/duplicate/rename try.
- Helpers: `supportLookupById`, `demoSettingsChosen`, `pickSettingsToUse`.

**Server vs client**

- **Server:** Try CRUD and persistence (existing API). Default/template config could move to server (e.g. endpoint or config).
- **Client:** “Current try” for the page comes from URL (case/try number). Settings form and validation can be server-rendered + Stimulus for interactivity.

---

## 4. scorerSvc and ScorerFactory

**Responsibilities**

- **scorerSvc:** Scorer CRUD (create, edit, delete), list, get, bootstrap for case; default scorer; scale parsing (`scaleToArray`), `scalesAreEqual`.
- **ScorerFactory:** Scorer instance (scale, code, colors, displayName); `score()`, `runCode()`, `maxScore()`, `getColors()`, `scaleToArray`, etc. Runs scorer code in browser (shared logic with `lib/scorer_logic.js` on server).

**Server vs client**

- **Server:** Scorer CRUD and storage (existing API). Running scorer logic for “run evaluation” already exists server-side; could be used for all scoring if desired.
- **Client:** Current workspace runs scorer code in the client for immediate feedback. Migration can keep scoring in JS (Stimulus/JS module) or call server for score calculation.

---

## 5. docCacheSvc

**Responsibilities**

- In-memory cache of documents by id: `addIds`, `getDoc`, `hasDoc`, `knowsDoc`, `empty`, `invalidate`.
- `update(settings)`: fetches missing docs via `docResolverSvc` (e.g. when engine doesn’t support lookup by id or for snapshot doc lookup).

**Server vs client**

- **Client:** Pure UI-side cache for doc bodies. Doc resolution can stay client (docResolver + proxy) or be replaced by a server endpoint that returns doc by id (e.g. from snapshot or search endpoint).

**Migration**

- **DocCache** (`app/javascript/modules/doc_cache.js`): Plain JS module replacing docCacheSvc for the Stimulus stack. Import via `modules/doc_cache`. Requires a doc resolver (same interface as splainer's `docResolverSvc.createResolver`) passed to `update(settings, docResolver, proxyUrl)`. Legacy Angular continues to use docCacheSvc for legacy paths.

---

## 6. diffResultsSvc

**Responsibilities**

- Builds “diff” for a query: second (or multiple) result sets from snapshots for comparison.
- Uses `queryViewSvc.getAllDiffSettings()` (snapshot ids), `settingsSvc`, `snapshotSearcherSvc`; creates `query.diffs` / `query.diff` with fetch, getSearchers, docs, name, version, score.

**Server vs client**

- **Client:** Diff is view/comparison state; snapshot data is already loaded. Can stay as client-side construction of diff views, or be replaced by server-rendered “diff” views (e.g. Turbo Frames) that receive snapshot ids and return HTML.

---

## 7. querySnapshotSvc and snapshotSearcherSvc

**Responsibilities**

- **querySnapshotSvc:** List/get snapshots (GET), add (POST), delete, import; maintains `snapshots` map; feeds doc ids to `docCacheSvc`; builds settings for snapshot search URL when engine doesn’t support lookup by id.
- **snapshotSearcherSvc:** Creates a searcher-like object from a snapshot (same interface as live searcher): docs, numFound, search(), name(), version(); used for “search from snapshot” and for diff.

**Server vs client**

- **Server:** Snapshot CRUD and import (existing API). Snapshot “search” for doc lookup is already an API (`api/cases/:id/snapshots/:sid/search`).
- **Client:** Snapshot-as-searcher abstraction (wrapping snapshot data in a searcher interface) is a client convenience for reuse with same UI as live search; can stay in JS or be replaced by server-rendered snapshot result views.

---

## 8. caseTryNavSvc

**Responsibilities**

- Current case/try from route; URL helpers (`getQuepidRootUrl`, etc.); protocol/redirect helpers for mixed content.

**Server vs client**

- **Client:** Routing and URL construction. Use Stimulus + Turbo for navigation.

**Migration**

- Replaced by `utils/quepid_root.js` (Stimulus). See [api_client.md](api_client.md) for URL building rules and helpers (`getQuepidRootUrl`, `buildApiUrl`, `buildPageUrl`, etc.).

---

## 9. queryViewSvc

**Responsibilities**

- View state: which snapshot(s) are used for diff (`diffSettings`), comparisons disabled, per-query toggles (expand/collapse); `getAllDiffSettings`, `getMaxSnapshots`, `isAnyDiffEnabled`, `reset`.

**Server vs client**

- **Client:** Pure UI state. No persistence. Implement in Stimulus (e.g. a controller that keeps diff selection and query toggles in memory or in URL params).

---

## 10. paneSvc

**Responsibilities**

- East pane layout: slider drag, show/hide east pane, resize; uses DOM classes `pane_container`, `pane_east`, `pane_main`, `east-slider` and `eastPaneWidth` value.

**Server vs client**

- **Client:** Entirely presentational. Implement in Stimulus (resize/drag) or CSS + minimal JS.

---

## 11. importRatingsSvc

**Responsibilities**

- POST to import API: CSV (hash), RRE JSON, LTR text, and information-needs CSV; passes case_id, clear_queries, create_queries as needed.

**Server vs client**

- **Server:** Import is already server API. Frontend only needs a form (server-rendered or Turbo) that submits to the same endpoints; optional Stimulus for file picker and feedback.

---

## 12. annotationsSvc

**Responsibilities**

- Annotations CRUD: create, fetchAll, update, deleteAnnotation; uses `api/cases/:caseId/annotations`; broadcasts `updatedCaseScore` and `annotationDeleted`.

**Server vs client**

- **Server:** All persistence (existing API). UI can be server-rendered + Turbo Frames; broadcast can be replaced by Turbo Streams or a refresh.

---

## 13. rateElementSvc

**Responsibilities**

- Binds rating scale UI to scorer: `setScale(src, dst)` copies scorer colors to UI; `handleRatingScale(src, rateCallback, resetCallback, extra)` wires open/close/rate/reset.

**Server vs client**

- **Client:** Pure UI binding. Reimplement in Stimulus: one controller for the rating control that gets scale from data attributes or a small API and calls a rate/reset callback (e.g. to ratingsStore or a server action).

---

## 14. ratingsStoreSvc

**Responsibilities**

- Per-query ratings: in-memory map (doc id → rating); `rateDocument`, `rateBulkDocuments`, `resetRating`, `resetBulkRatings` (call API and update local dict); `hasRating`, `getRating`, `bestDocs`, `version`; `createRateableDoc` to attach rate/reset to a doc for UI.

**Server vs client**

- **Server:** Persistence is already via API (PUT/DELETE ratings). No change.
- **Client:** In-memory store and “rateable doc” wrapper are UI concerns. After migration, keep a minimal client store for optimistic updates and form state, or drive everything from server (Turbo) and avoid a duplicate store.

---

## Other services referenced

- **broadcastSvc:** Event bus; replace with Turbo Streams (see [turbo_streams_guide.md](turbo_streams_guide.md)), custom events, or Stimulus values/callbacks.
- **docResolverSvc:** (splainer-search) Fetches docs by id; used by docCacheSvc; can stay client or become a server doc-lookup endpoint.
- **searchSvc:** (splainer-search) Creates searchers and runs live search; must stay client (or proxy) for hitting user’s search endpoint.
- **bookSvc:** Books dropdown, populate, refresh; API is server; UI is client.
- **configurationSvc:** App config; can be server-rendered (e.g. in a script tag or data attributes) and read by Stimulus.
- **qscoreSvc:** Score-to-color mapping (`scoreToColor`) for query list badges; pure client utility.
- **searchEndpointSvc:** Search endpoint list (GET `api/search_endpoints`), fetch for case; API is server.
- **caseCSVSvc:** Export CSV/JSON stringify, format download filenames; used by legacy export modal. Modern export uses `Api::V1::Export::CasesController` and `export_case_controller.js`.
- **rateBulkSvc:** Bulk rating scale UI (setScale, handleRatingScale); like rateElementSvc for bulk context.
- **varExtractorSvc:** Extracts curator variable names from query params (e.g. `##var##`); pure client utility.
- **searchErrorTranslatorSvc:** HTTP status code to string, format search error messages; pure client utility.
- **bootstrapSvc:** Fetches current user via userSvc on app init; assigns to `$rootScope.currentUser`.
- **teamSvc:** Teams list, share/unshare case; API is server.
- **userSvc:** Current user get/update; API is server.

---

## Current architecture (post-migration)

The migration is complete. All Angular services have been replaced:

1. **Server-first:** All mutations and canonical data go through Rails controllers/API. Turbo Frames handle list/detail and modals.
2. **Client minimal:** Stimulus/JS handles: route/URL state (case/try), pane layout, rating control bindings, diff/snapshot selection, and live search execution (via server-side proxy `QuerySearchService`).
3. **Scoring:** Server-side scoring via `RunCaseEvaluationJob` + `QueryScoreService` for lightweight per-query scores. Client receives score updates via Turbo Streams and custom events (`qscore:update`).
4. **URLs:** See [api_client.md](api_client.md) for URL building rules (never hardcode `/`; use `getQuepidRootUrl()` or Rails helpers).

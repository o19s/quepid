# Angular Services: Responsibilities and Server vs Client Placement

This document maps each Angular service used by the core workspace (`/case/:id/try/:try_number`) to its responsibilities and recommends where each should live after migration: **server-side (Rails)** or **client-side (Stimulus/JS)**.

**See also:** [workspace_behavior.md](workspace_behavior.md) (core workspace behavior on this branch), [workspace_api_usage.md](from-deangularjs-experimental/workspace_api_usage.md), [workspace_state_design.md](from-deangularjs-experimental/workspace_state_design.md), [angularjs_elimination_plan.md](../../angularjs_elimination_plan.md), [deangularjs_experimental_review.md](../../deangularjs_experimental_review.md).

---

## Current state (this branch)

- **Core workspace** is still **AngularJS**: `app/views/layouts/core.html.erb` (`ng-app="QuepidApp"`), `app/views/core/index.html.erb`, `app/assets/javascripts/routes.js` → `MainCtrl` + `queriesLayout.html`, plus `app/assets/javascripts/quepid_angular_app.js` and related bundles.
- **Angular sources still present:** `app/assets/javascripts/services/` (e.g. `caseSvc.js`, `queriesSvc.js`, `docCacheSvc.js`, …), `app/assets/javascripts/components/`, `app/assets/javascripts/factories/`, `app/assets/javascripts/controllers/`.
- **Stimulus** (`app/javascript/controllers/`): used on other surfaces (share case, mapper wizard, books helpers, etc.); it does **not** replace the core case/try workspace.
- **No** `app/components/` ViewComponent tree for the workspace; no `core_modern` layout. Non-Angular pages use `layouts/application.html.erb` with **`app/javascript/application_modern.js`** (importmap + Stimulus + Turbo config); **`layouts/core.html.erb` does not**—it loads `angular_app` / `quepid_angular_app` instead.
- **Server:** `RunCaseEvaluationJob` exists and broadcasts Turbo Streams to `notifications` / `notifications-case-*` (see `app/jobs/run_case_evaluation_job.rb`); the Angular core layout does not subscribe. **`Api::V1::Export::CasesController`** exists under `app/controllers/api/v1/export/` for API export; the workspace UI still uses Angular export flows + `caseCSVSvc` for typical user export.
- **Not present on this branch:** `QuerySearchService`, `QueryScoreService`, `app/javascript/api/fetch.js`, `app/javascript/modules/doc_cache.js`, `app/javascript/utils/quepid_root.js`, or a workspace `export_case_controller.js`. `app/javascript/modules/` currently holds other modules (e.g. `editor.js`).

---

## Summary: Server vs Client

The **“Target (after port)”** column describes a sensible split for a future Hotwire/Stimulus core; **“This branch”** is what actually implements the workspace today.

| Service | Primary responsibility | This branch | Target (after port) |
|--------|------------------------|-------------|---------------------|
| `caseSvc` | Case CRUD, selection, archive | Angular service + APIs | **Server** (API + Turbo); selection/UI state **Client** |
| `queriesSvc` | Query CRUD, scoring, search, ordering | Angular: CRUD via API; **search + scoring in the browser** (splainer + `ScorerFactory`); optional `proxy/fetch` | **Server:** CRUD/order/ratings API; optional server search proxy & scoring (see experimental migration docs—not all types exist on `main`) |
| `settingsSvc` | Try (search config) settings | Angular + tries API | **Server** (API); current try **Client** |
| `scorerSvc` / `ScorerFactory` | Scorer metadata + scoring logic | Scorer CRUD via API; **interactive scoring in browser**; server shares logic where jobs use it | **Server:** CRUD + more scoring in jobs/services if desired |
| `docCacheSvc` | Document caching (by id) | `docCacheSvc.js` + `docResolverSvc` | **Client** cache or server doc lookup |
| `diffResultsSvc` | Diff (snapshot comparison) state & fetching | Angular | **Client** or server-rendered diff |
| `querySnapshotSvc` / `snapshotSearcherSvc` | Snapshots; snapshot-as-searcher | Angular + snapshot APIs | **Server** API; snapshot “searcher” **Client** |
| `caseTryNavSvc` | Navigation URLs, case/try from route | `app/assets/javascripts/services/caseTryNavSvc.js` | **Client** (URL/route); shared conventions per [api_client.md](from-deangularjs-experimental/api_client.md) when ported |
| `queryViewSvc` | Diff toggles, query expand/collapse | Angular | **Client** |
| `paneSvc` | East pane width / drag | Angular | **Client** |
| `importRatingsSvc` | Import ratings (hash/rre/ltr) and info needs | Angular + import API | **Server** (API); form **Client** |
| `annotationsSvc` | Annotations CRUD | Angular + API | **Server** (API) |
| `rateElementSvc` | Rating scale UI | Angular | **Client** (Stimulus) |
| `ratingsStoreSvc` | Per-query ratings in memory + API | Angular | **Hybrid** |
| `qscoreSvc` | Score-to-color mapping for query list | Angular | **Client** |
| `searchEndpointSvc` | Search endpoint list, fetch for case | Angular + API | **Server** (API); selection **Client** |
| `caseCSVSvc` | Export CSV/JSON, download | Angular `caseCSVSvc` + modal; **also** `Api::V1::Export::CasesController` for API consumers | **Hybrid:** server export API; workspace UI could move to Stimulus + same API |
| `rateBulkSvc` | Bulk rating scale UI | Angular | **Client** (Stimulus) |
| `varExtractorSvc` | Extract curator vars from query params | Angular | **Client** |
| `searchErrorTranslatorSvc` | HTTP code→string, format search errors | Angular | **Client** |
| `bootstrapSvc` | Fetch current user on app init | Angular + API | **Server** (API); bootstrap **Client** |
| `teamSvc` | Teams list, share/unshare case | Angular + API | **Server** (API) |
| `userSvc` | Current user get/update | Angular + API | **Server** (API) |

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

- **Server:** Query and rating persistence (API already used). Display order, notes, options can stay as API; full-case refresh can enqueue `RunCaseEvaluationJob` (exists on this branch).
- **Client (this branch):** Live search hits the user’s search engine from the browser (splainer stack), with optional `proxy/fetch` when enabled in settings (`queriesSvc` / `caseTryNavSvc`). Per-query scoring uses `ScorerFactory` / `runCode` in the browser. Query list UI state (selected query, expanded rows) stays in Angular scope.
- **Target migration:** Optionally move search execution and more scoring server-side; see [turbo_streams_guide.md](../turbo_streams_guide.md) and related experimental docs for intended patterns (not all are implemented on `main`).

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

- **Server:** Scorer CRUD and storage (existing API). Background / batch scoring uses server-side code paths where jobs run (shared concepts with `lib/scorer_logic.js`).
- **Client (this branch):** The try workspace runs scorer code in the browser for immediate feedback (`ScorerFactory`, `runCode`).
- **Target migration:** Optionally shift more scoring to the server for a single source of truth; see experimental migration docs.

---

## 5. docCacheSvc

**Responsibilities**

- In-memory cache of documents by id: `addIds`, `getDoc`, `hasDoc`, `knowsDoc`, `empty`, `invalidate`.
- `update(settings)`: fetches missing docs via `docResolverSvc` (e.g. when engine doesn’t support lookup by id or for snapshot doc lookup).

**Server vs client**

- **Client:** Pure UI-side cache for doc bodies. Doc resolution can stay client (docResolver + proxy) or be replaced by a server endpoint that returns doc by id (e.g. from snapshot or search endpoint).

**Migration (not on `main` yet)**

- A future Stimulus stack might introduce a plain JS `DocCache` module (or rely on server-rendered doc cards only). It would need a doc resolver with the same role as splainer’s `docResolverSvc.createResolver`, passed into something like `update(settings, docResolver, proxyUrl)`. **This branch** continues to use `docCacheSvc.js` for the Angular workspace.

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

- **This branch:** `app/assets/javascripts/services/caseTryNavSvc.js` implements `getQuepidRootUrl()`, proxy URL helpers, and case/try route reads.
- **Target:** Centralize URL construction for Stimulus/Turbo; [api_client.md](from-deangularjs-experimental/api_client.md) documents relative URLs, CSRF, and fetch conventions for the ported stack (implementation is up to the port).

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

Services not covered in detail above but referenced in the codebase:

- **broadcastSvc:** Event bus; replace with Turbo Streams (see [turbo_streams_guide.md](../turbo_streams_guide.md)), custom events, or Stimulus values/callbacks.
- **docResolverSvc:** (splainer-search) Fetches docs by id; used by docCacheSvc (see section 5); can stay client or become a server doc-lookup endpoint.
- **searchSvc:** (splainer-search) Creates searchers and runs live search; must stay client (or proxy) for hitting user’s search endpoint.
- **bookSvc:** Books dropdown, populate, refresh; API is server; UI is client.
- **configurationSvc:** App config; can be server-rendered (e.g. in a script tag or data attributes) and read by Stimulus.

---

## Architecture on this branch vs experimental target

**This branch (core workspace)**

1. **Angular-first for `/case/:id/try/:try_number`:** Services under `app/assets/javascripts/services/` own workspace behavior; Rails serves the shell layout and JSON/HTML APIs.
2. **Search and interactive scoring:** Driven in the browser (splainer + `ScorerFactory`); mixed-content / proxy concerns still surface in Angular bootstrap and settings.
3. **Background jobs:** `RunCaseEvaluationJob` runs server-side case evaluation and broadcasts Turbo Stream updates to notification targets consumed by pages that call `turbo_stream_from(:notifications)` (e.g. home, books)—**not** the Angular core layout.
4. **URLs in Angular code:** Prefer `caseTryNavSvc.getQuepidRootUrl()` (and project rules against hardcoding `/` root); see `caseTryNavSvc.js`.

**Experimental / target-state docs (may describe another branch or future work)**

- Hotwire-first workspace, Turbo Frames/Streams, server-side search proxy types, and broad Stimulus coverage are documented in [turbo_frame_boundaries.md](from-deangularjs-experimental/turbo_frame_boundaries.md), [turbo_streams_guide.md](from-deangularjs-experimental/turbo_streams_guide.md), [ui_consistency_patterns.md](from-deangularjs-experimental/ui_consistency_patterns.md), and [api_client.md](from-deangularjs-experimental/api_client.md). Treat those as **design references** unless a doc explicitly states it matches the current `main` tree.

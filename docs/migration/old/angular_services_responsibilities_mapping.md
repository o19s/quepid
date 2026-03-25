# Angular Services: Responsibilities and Server vs Client Placement

This document maps each **legacy AngularJS service** (and closely related **factories**) that powered the core workspace (`/case/:id/try/:try_number`) to its responsibilities, **Legacy Angular** placement, and **Current** (post-migration) placement. Service/factory counts align with [angularjs_inventory.md](./angularjs_inventory.md): **26** first-party services under `app/assets/javascripts/services/`, **7** factories under `app/assets/javascripts/factories/`, plus **splainer-search**–provided injectables documented below.

**Elimination plan (scope and parity):** [angularjs_elimination_plan.md](./angularjs_elimination_plan.md). **Stimulus/Turbo detail:** [rails_stimulus_migration_alternative.md](./rails_stimulus_migration_alternative.md).

**Legend**

- **Legacy Angular** = where the responsibility lived while the case workspace still used AngularJS (and related legacy assets).
- **Current** = where that responsibility lives in the shipped implementation after Angular removal.
- **Consider (optional)** = not required for parity; only if you explicitly adopt it (see intentional design doc).

---

**Case workspace today (vs legacy):** [workspace_behavior.md](./workspace_behavior.md). **Archived elimination plan:** [old/angularjs_elimination_plan.md](./old/angularjs_elimination_plan.md).

---

## Summary: Server vs Client

| Service | Primary responsibility | Legacy Angular | Current |
|--------|------------------------|------------------|-------------------------|
| `caseSvc` | Case CRUD, selection, archive | Angular + APIs | **Server:** persistence APIs. **Client:** Rails routes + Turbo; case/try context on `<body>` (`data-case-id`, `data-try-number` in `layouts/core.html.erb`) |
| `queriesSvc` | Query CRUD, search, scoring, ordering | CRUD via API; **search + scoring in browser** (splainer + `ScorerFactory`); `proxy/fetch` when configured | **Server:** CRUD/order/ratings API. **Client:** `query_list_controller.js`, `query_row_controller.js`, `modules/search_executor.js`, `modules/scorer_executor.js`, `modules/json_fetch.js` / `modules/api_url.js` |
| `settingsSvc` | Try settings | Angular + tries API | **Server:** tries API. **Client:** `settings_panel_controller.js`, `modules/wizard_settings.js`, CodeMirror in `modules/editor.js` (not ACE) |
| `scorerSvc` / `ScorerFactory` | Scorer metadata + scoring | CRUD via API; **interactive scoring in browser**; server for jobs | **Server:** CRUD + scorer job paths. **Client:** `modules/scorer_executor.js` (run scorer code), `modules/scorer.js` (scales / score badge colors); Stimulus e.g. `scorer_scale_controller.js`, `case_score_controller.js` |
| `docCacheSvc` | Doc cache by id | `docCacheSvc.js` + **`docResolverSvc`** (from **splainer-search**) | **Client:** normalized docs on each search (`query_row_controller.js` `lastSearchDocs`); document modal via `show-doc-detail` + `doc_detail_modal_controller.js` (no Angular global doc cache) |
| `diffResultsSvc` | Diff state & comparison | Angular | **Client:** `query_row_controller.js` `renderDiffResults()` with `snapshot_comparison_controller.js` events |
| `querySnapshotSvc` / `snapshotSearcherSvc` | Snapshots; snapshot-as-searcher | Angular + snapshot APIs | **Server:** snapshot API. **Client:** `snapshot_controller.js`, `snapshot_comparison_controller.js`; query rows reuse live search UI with snapshot-backed data |
| `caseTryNavSvc` | URLs, case/try from route | `caseTryNavSvc.js` | **Client:** [api_client.md](./api_client.md) (`apiUrl`, CSRF); try/case ids from URL and `document.body.dataset` |
| `queryViewSvc` | Diff toggles, expand/collapse | Angular | **Client:** Stimulus (`query_row_controller.js` and related targets) |
| `paneSvc` | East pane drag/width | Angular | **Client:** `resizable_pane_controller.js`; `toggleEast` on `document` |
| `importRatingsSvc` | Import ratings | Angular + import API | **Server:** import API. **Client:** `import_ratings_controller.js` |
| `annotationsSvc` | Annotations CRUD | Angular + API | **Server:** `api/cases/:id/annotations` JSON API. **Client:** `settings_panel_controller.js` (list/create/delete in settings panel); `case_score_controller.js` loads annotations for `sparkline_controller.js` |
| `rateElementSvc` | Rating scale UI | Angular | **Client:** `scorer_scale_controller.js` + rating controls in `query_row_controller.js` |
| `ratingsStoreSvc` | In-memory ratings + API sync | Angular | **Hybrid:** persist via API. **Client:** `modules/ratings_store.js` (class used from `query_row_controller.js`) |
| `qscoreSvc` | Score→color for query list | `qscore_service.js` | **Client:** `modules/scorer.js` (`scoreToColor`, etc.) |
| `searchEndpointSvc` | Endpoints for case | Angular + API | **Server:** API. **Client:** e.g. `share_search_endpoint_controller.js`, wizard/settings flows |
| `caseCSVSvc` | Export / download | Angular + export APIs | **Hybrid:** same export APIs. **Client:** `export_case_controller.js` |
| `rateBulkSvc` | Bulk rating UI | Angular | **Client:** bulk actions in `query_row_controller.js`; judgements flow in `bulk_judgement_controller.js` |
| `varExtractorSvc` | Curator vars from params | Angular | **Client:** `settings_panel_controller.js` (curator var extraction from query params) |
| `searchErrorTranslatorSvc` | Search error strings | Angular | **Client:** engine errors surfaced as messages in `search_executor.js` / callers (e.g. `query_row_controller.js`); no separate translator module |
| `bootstrapSvc` | Current user on init | Angular + API (`UtilitiesModule`) | **Server:** session + ERB (`layouts/_header.html.erb`, etc.). **Client:** no Angular bootstrap; authenticated chrome from full-page HTML |
| `configurationSvc` | Feature flags (communal scorers only, query list sortable) | Seeded from `core.html.erb` inline script + `configurationSvc.js` (`UtilitiesModule`) | **Server:** Rails config → `data-communal-scorers-only` / `data-query-list-sortable` on `<body>` (`layouts/core.html.erb`). **Client:** `dataset` and Stimulus values (e.g. `core/_query_list_shell.html.erb` `data-query-list-sortable-value`) |
| `teamSvc` | Teams, share case | Angular + API | **Server:** API. **Client:** `share_case_controller.js`, `invite_controller.js`, team member autocomplete, etc. |
| `userSvc` | User get/update | Angular + API (`UtilitiesModule`) | **Server:** user/account APIs and server-rendered pages |
| `bookSvc` | Team books list, dropdown, judgements-related book ops | Angular + `api/teams/:id/books` etc.; uses `broadcastSvc` | **Server:** book APIs unchanged. **Client:** `judgements_controller.js`, `share_book_controller.js`, `json_fetch` / `api_url` |
| `broadcastSvc` | App-wide events (`$rootScope.$broadcast` wrapper) | `factories/broadcastSvc.js` | **Client:** targeted `CustomEvent` on `document` (e.g. `query_row_controller.js`, `flash_helper.js`, `move_query_modal_controller.js`, `snapshot_comparison_controller.js`) — no global Angular bus |

## Factories (QuepidApp, `app/assets/javascripts/factories/`)

These are not `$http` “services” but own important client behavior; the **Current** column maps them to `app/javascript` modules and Stimulus controllers.

| Factory | Primary responsibility | Legacy Angular | Current |
|--------|------------------------|------------------|-------------------------|
| `ScorerFactory` | Client-side scorer evaluation (user JS), display helpers | Used by query list / ratings flow | **Client:** `modules/scorer_executor.js`, `modules/scorer.js`; wired from `query_row_controller.js` |
| `SettingsFactory` | Settings aggregate over tries; try list sync | Wraps tries from API | **Client:** `settings_panel_controller.js`, `modules/wizard_settings.js` (+ **Server:** tries API) |
| `TryFactory` | Try model: API shape, field spec, curator vars | Uses `fieldSpecSvc` (splainer) | **Client:** try JSON from APIs + `parseFieldSpec` in `modules/search_executor.js`; wizard/build in `settings_panel_controller.js` / `wizard_controller.js` |
| `SnapshotFactory` | Snapshot model, doc IDs, results access | `docCacheSvc`, `normalDocsSvc` | **Client:** `snapshot_controller.js`, `snapshot_comparison_controller.js`; docs normalized like live search |
| `DocListFactory` | Build doc lists, missing/duplicate ID handling | `normalDocsSvc` | **Client:** result rows in `query_row_controller.js`; finder in `doc_finder_controller.js` |
| `AnnotationFactory` | Annotation data objects | Annotations UI | **Client:** server-driven annotation records in views/API responses (no dedicated factory module) |

`broadcastSvc` is also registered as a **factory**; responsibilities are covered in the services table above.

## Legacy splainer-search injectables (Angular era)

The **splainer-search** package registered these for Angular injection. See [angularjs_inventory.md](./angularjs_inventory.md) *Services from splainer-search*. Shipped code replaces them with ES modules under `app/javascript/modules/` (no Angular injector).

| Injectable | Role in core workspace | Current |
|------------|------------------------|-------------------------|
| `normalDocsSvc` | Normalize engine docs (`createNormalDoc`, `explainDoc`) — queries, snapshots, doc lists | **Client:** `normalizeDoc()` in `modules/search_executor.js` |
| `docResolverSvc` | Batch-resolve doc bodies for cache — `createResolver()` | **Client:** docs come from each `executeSearch` result; detail UI uses that payload (`doc_detail_modal_controller.js`) — no separate resolver service |
| `fieldSpecSvc` | Field spec construction — tries, snapshots | **Client:** `parseFieldSpec()` in `modules/search_executor.js` (exported for callers) |
| `searchSvc` | `createSearcher()` — live search in `queriesSvc` | **Client:** `executeSearch()` in `modules/search_executor.js` |
| `esUrlSvc` | Template URL checks — `QueryParamsCtrl` | **Client:** `validateEndpoint()` in `modules/settings_validator.js` |

## Consider (optional) — not parity requirements

| Area | Idea | When to use |
|------|------|-------------|
| Doc bodies | Server endpoint for lookup-by-id instead of splainer-only | Only if product/engineering explicitly adds it |
| Diff UI | Server-rendered diff partials / Turbo | Only if a slice replaces client-built diff |
| Annotations / lists | Turbo Streams to push list updates | Only if you adopt stream-driven HTML for that pane |
| Query list / scores | Turbo Streams for row/header updates instead of client events | Optional pattern from [turbo_streams_guide.md](./turbo_streams_guide.md); shipped UI remains largely client-driven (Stimulus + fetches) |

**Elimination plan** (historical phase breakdown, including scoring and event-bus work): [angularjs_elimination_plan.md](./angularjs_elimination_plan.md). **Turbo vs client-owned UI:** [intentional_design_changes.md](./intentional_design_changes.md), section 2.

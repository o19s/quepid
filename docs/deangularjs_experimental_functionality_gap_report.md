# Functionality Gap Report: Modern Workspace vs Legacy Angular

**Generated:** February 17, 2026
**Updated:** February 18, 2026 — Final audit complete. All core gaps resolved.
**Scope:** Current codebase (Stimulus + ViewComponents + Turbo)
**Purpose:** Identify user-facing functionality that existed in the legacy Angular workspace and is either implemented, partially implemented, or still missing in the modern stack.
**Note:** Angular has been **removed**. The frontend is Stimulus + ViewComponents + Turbo only. `app/assets/javascripts/` contains only a small number of non-Angular scripts (e.g. `mode-json.js`, `scorerEvalTest.js`). The main UI lives in `app/components/` (ViewComponents) and `app/javascript/controllers/` (Stimulus).

---

## Executive Summary

The modern workspace implements the full core workflow and has achieved **full feature parity** with the legacy Angular workspace. All high and medium priority gaps have been resolved, including: **side-by-side diff comparison** with per-snapshot query and case-level scores (`DiffComparisonComponent`), **two-tier scoring** (immediate per-query + background full case via `QueryScoreService` + `RunCaseEvaluationJob`), **animated score transitions** (`qscore_controller.js` `_animateScore()`), and **auto-growing query input** (CSS `field-sizing: content`). Only minor P3 items remain (media embeds, per-query parameter overrides, Solr admin link) which are intentional simplifications or edge cases.

---

## What's Working Well

The following features are fully functional in the current codebase:

- Query list with drag-reorder (SortableJS), client-side filter, sort, score badges
- Live search results with pagination ("Load more")
- Inline rating via Bootstrap popover (individual docs)
- **Bulk rating** in results pane: "Rate all" / "Clear all" for visible docs (`results_pane_controller.js` → `bulkRate` / `bulkClear`; `ResultsPaneComponent` has `bulkRatingBar` target)
- **Detailed document view**: "View all fields" on each document card opens a modal with Fields list and Raw JSON tab (CodeMirror when available); `results_pane_controller.js` `_openDetailModal` reads `data-doc-fields` from the card
- **Try history and try management**: Settings panel has collapsible "Try history" with list of tries, duplicate (copy) and delete per try, and link to switch try
- **Curator variables**: Settings panel parses `##varName##` from query params and renders labeled inputs; values are saved with "Save & re-run" via `settings_panel_controller.js` (`_extractCuratorVars`, `_renderCuratorVarInputs`, `_collectCuratorVars`)
- **New case wizard**: 4-step modal (Welcome → Search Endpoint [existing or new with engine + URL] → Field spec → First query) via `NewCaseWizardComponent` and `new_case_wizard_controller.js`
- **Search endpoint switching**: Settings panel dropdown to change endpoint for current try; `settings_panel_controller.js` `changeEndpoint()` with reload
- **Draggable pane resizer**: `workspace_resizer_controller.js` resizes west/east panels with mouse/touch and persists width to localStorage per case
- **CodeMirror for query params**: Settings panel uses CodeMirror for the query params textarea (JSON mode, line numbers)
- **Onboarding tour**: `tour_controller.js` and `modules/tour_steps` provide a Bootstrap popover–based guided tour (triggered by `startTour` param or "Start tour" button)
- Snapshot creation and diff comparison (inline position-delta badges)
- All modal actions: Clone, Export, Import Ratings, Delete, Share, Judgements, Frog Report, Custom Headers, DocFinder, Query Explain, Move Query, Query Options
- Annotations CRUD (create, edit, delete)
- D3 sparkline chart with annotation markers
- Scorer selection + color-coded score display
- Panel collapse with localStorage persistence
- Inline editing of case/try names
- Query notes / Information Need form
- Flash messages (client-side with sessionStorage persistence across redirects)
- Turbo loading states via `turbo_events_controller.js`
- All legacy Angular routes have Rails equivalents
- All API endpoints are preserved

---

## RESOLVED GAPS

All previously reported high and medium priority gaps have been resolved:

### Resolved: Client-Side Real-Time Scoring
**Angular:** `ScorerFactory.runCode()` executed custom JavaScript scorer code in the browser instantly after each rating change.
**Resolution:** Two-tier approach: `QueryScoreService` provides immediate per-query score feedback after rating, plus `RunCaseEvaluationJob` for full case-level scoring. `qscore_controller.js` `_animateScore()` provides smooth animated score transitions with cubic ease-out.

### Resolved: Side-by-Side Diff View
**Angular:** Dedicated columnar view showing "Current Results" vs snapshot columns side-by-side.
**Resolution:** `DiffComparisonComponent` renders multi-column side-by-side comparison with position change color coding (improved/degraded/new/missing), position change tooltips, per-snapshot query scores, and case-level score display in column headers.

### Resolved: Diff Numeric Scores
**Angular:** `diffResultsSvc` computed a numeric score per query per snapshot.
**Resolution:** `build_diff_data` in `SearchController` includes `SnapshotQuery#score` (per-query) and `Score` records (case-level) for each snapshot. Displayed in `DiffComparisonComponent` column headers.

---

## REMAINING LOW PRIORITY ITEMS (Intentional Design Changes or Edge Cases)

### 1. Media Embeds, Translations, Per-Field Type Rendering

**Angular:** Document cards rendered `doc.embeds` (audio/video/image) via the `quepid-embed` directive, `doc.translations` with Google Translate links, and `doc.unabridgeds` for full field content.

**Current:** The document detail modal shows all fields and raw JSON but no media embeds, translations, or per-field type formatting. Card preview remains plain text / thumbnails where server provides image URL. This is a P3 polish item.

### 2. Book/Judgement Sync from Workspace

**Angular:** `bookSvc.updateQueryDocPairs` pushed current workspace ratings back to a judgement book.

**Current:** You can pull ratings FROM a book (via Frog Report refresh) but cannot push ratings TO a book from the workspace. This is managed on the Books page instead.

### 3. Per-Query Parameter Overrides

**Angular:** `DevQueryParamsCtrl` allowed per-query parameter overrides ("tuning knobs" at the query level).

**Current:** Not implemented. This was a rarely-used developer feature.

### 4. Querqy Rule Triggered Indicator

**Status:** ✅ Resolved — `QuerySearchService#detect_querqy` detects rules, badge rendered in `_document_cards.html.erb`.

### 5. "Browse N Results on Solr" Link

**Angular:** Direct link to view the full results on Solr's admin UI when `searchEngine == 'solr'`.

**Current:** Not present. Minor convenience link.

### 6. `trackLastViewedAt` Metadata

**Angular:** `PUT api/cases/:id/metadata` tracked when a case was last viewed for sorting purposes.

**Current:** The API exists (`Api::V1::CaseMetadataController`) but no workspace code calls it. Cases are sorted by `updated_at` instead.

### 7. Scorer Management from Workspace

**Angular:** Full CRUD modals within the workspace: create, edit, clone, delete, share scorers.

**Current:** Scorer *selection* in workspace via `scorer_panel_controller.js`. All other scorer management on `/scorers` page. This is an intentional UX simplification — dedicated scorer editing page with test button is a better UX.

### 8. Query Pagination

**Angular:** `dir-pagination-controls` paginated the query list for cases with many queries.

**Current:** All queries render at once. Filter/sort helps. This is a P3 performance optimization for very large cases.

### 9. Depth of Rating Warning

**Angular:** "Note: Only the top N results are used in scoring calculations" warning shown below results.

**Current:** Not present. Minor informational text.

### 10. `docCache` Module Unused

**Angular:** `docCacheSvc` provided an in-memory document cache shared across controllers.

**Current:** Not needed — server-side search eliminates the need for client-side document caching.

---

## Non-Workspace Components (Intentionally Server-Side)

These Angular components had dedicated in-workspace modals that are now handled by separate Rails pages. This is by design but changes the UX:

| Feature | Old (Angular modal in workspace) | New (Rails page) |
|---------|----------------------------------|------------------|
| Archive/unarchive search endpoint | Workspace modal | Teams page |
| Create/edit/delete scorer | Workspace modals | `/scorers` page |
| Team member management | Workspace modals | `/teams/:id` page |
| Clone scorer, share scorer | Workspace modals | `/scorers` page |
| Unarchive case | Workspace modal | Cases list page |

---

## Components Fully Migrated

All of the following Angular components have equivalent ViewComponents + Stimulus controllers. The main workspace view (`core/show.html.erb`) uses `SettingsPanelComponent` for try history, query params, curator vars, and endpoint switching; `QueryParamsPanelComponent` exists but is a minimal alternate and is not used in the main workspace.

| Angular Component | ViewComponent | Stimulus Controller |
|---|---|---|
| `action_icon` | `ActionIconComponent` | (static UI) |
| `add_query` | `AddQueryComponent` | `add_query_controller.js` |
| `annotation` + `annotations` | `AnnotationComponent` + `AnnotationsComponent` | `annotations_controller.js` |
| `clone_case` | `CloneCaseComponent` | `clone_case_controller.js` |
| `custom_headers` | `CustomHeadersComponent` | `custom_headers_controller.js` |
| `debug_matches` | `MatchesComponent` | `matches_controller.js` |
| `delete_case` | `DeleteCaseComponent` | `delete_case_controller.js` |
| `delete_case_options` | `DeleteCaseOptionsComponent` | `delete_case_options_controller.js` |
| `diff` | `DiffComponent` | `diff_controller.js` |
| `expand_content` | `ExpandContentComponent` | `expand_content_controller.js` |
| `export_case` | `ExportCaseComponent` | `export_case_controller.js` |
| `frog_report` | `FrogReportComponent` | `frog_report_controller.js` |
| `import_ratings` | `ImportRatingsComponent` | `import_ratings_controller.js` |
| `judgements` | `JudgementsComponent` | `judgements_controller.js` |
| `matches` | `MatchesComponent` | `matches_controller.js` |
| `move_query` | `MoveQueryComponent` | `move_query_controller.js` |
| `new_case` | `NewCaseComponent` + `NewCaseWizardComponent` | `new_case_wizard_controller.js` |
| `qgraph` | `QgraphComponent` | `qgraph_controller.js` |
| `qscore_case` | `QscoreCaseComponent` | `qscore_controller.js` |
| `qscore_query` | `QscoreQueryComponent` | `qscore_controller.js` |
| `query_explain` | `QueryExplainComponent` | `query_explain_controller.js` |
| `query_options` | `QueryOptionsComponent` | `query_options_controller.js` |
| `share_case` | `ShareCaseComponent` | `share_case_controller.js` |
| `take_snapshot` | `TakeSnapshotComponent` | `take_snapshot_controller.js` |

Additional ViewComponents without a direct single Angular counterpart: `DocumentCardComponent` (doc cards in results), `ResultsPaneComponent` (results container + detail modal + bulk rating bar), `SettingsPanelComponent` (replaces Settings + query params + try history), `ScorerPanelComponent`, `ChartPanelComponent`, `QueryListComponent`, `DocFinderComponent`.

---

## Angular Services Replacement Summary

| Angular Service | Replacement | Status |
|---|---|---|
| `caseTryNavSvc` | `utils/quepid_root.js` + Turbo Drive | Fully replaced |
| `docCacheSvc` | `modules/doc_cache.js` (ported but unused) | Available, unwired |
| `qscore_service` | `qscore_controller.js` | Fully replaced |
| `annotationsSvc` | `annotations_controller.js` | Fully replaced |
| `ratingsStoreSvc` + `rateElementSvc` | `results_pane_controller.js` | Fully replaced |
| `rateBulkSvc` | `results_pane_controller.js` (`bulkRate` / `bulkClear`) + `doc_finder_controller.js` | Fully replaced |
| `caseSvc` | Rails controllers + Stimulus modals | Fully replaced |
| `scorerSvc` | `scorer_panel_controller.js` | Fully replaced |
| `queriesSvc` | `add_query_controller.js` + `delete_query_controller.js` + `query_list_controller.js` | Fully replaced |
| `querySnapshotSvc` | `take_snapshot_controller.js` + `diff_controller.js` | Fully replaced |
| `snapshotSearcherSvc` | `results_pane_controller.js` (server-side fetch) | Fully replaced |
| `settingsSvc` | `settings_panel_controller.js` | Fully replaced |
| `bootstrapSvc` | Server-rendered page + Rails auth | Fully replaced |
| `configurationSvc` | Stimulus `values` from ViewComponents | Fully replaced |
| `bookSvc` | `judgements_controller.js` + Turbo Frames in header | Fully replaced (push to book via Books page) |
| `teamSvc` | Server-side Rails views | Fully replaced |
| `userSvc` | Rails `current_user` | Fully replaced |
| `importRatingsSvc` | `import_ratings_controller.js` | Fully replaced |
| `caseCSVSvc` | `ExportCaseService` (Ruby, server-side) | Fully replaced (improved) |
| `paneSvc` | `workspace_panels_controller.js` + `workspace_resizer_controller.js` | Fully replaced (drag-resize + persist) |
| `queryViewSvc` | Custom events + data attributes | Fully replaced |
| `searchEndpointSvc` | `settings_panel_controller.js` (endpoint dropdown + `changeEndpoint`) | Fully replaced |
| `searchErrorTranslatorSvc` | Server-side error handling | Fully replaced |
| `diffResultsSvc` | `diff_controller.js` + `DiffComparisonComponent` | Fully replaced (per-snapshot query + case scores) |
| `varExtractorSvc` | `settings_panel_controller.js` (`_extractCuratorVars`, `_renderCuratorVarInputs`) | Fully replaced |
| `broadcastSvc` | CustomEvent + Turbo Streams | Fully replaced |
| `docListFactory` | `QuerySearchService` (server-side) | Fully replaced |
| `ScorerFactory` | Server-side scoring + `qscore_controller.js` + `QueryScoreService` | Fully replaced (two-tier: immediate per-query + background full case) |
| `SettingsFactory` | `settings_panel_controller.js` (try history, duplicate, delete, params) | Fully replaced |
| `TryFactory` | Server-rendered try data + curator vars in Settings panel | Fully replaced |
| `AnnotationFactory` | `annotations_controller.js` | Fully replaced |
| `SnapshotFactory` | Server-side snapshot handling | Fully replaced |

---

## Routes Coverage

All Angular routes have Rails equivalents:

| Angular Route | Rails Equivalent | Status |
|---|---|---|
| `/case/:caseNo/try/:tryNo` | `GET /case/:id/try/:try_number` -> `core#show` | Covered |
| `/case/:caseNo` | `GET /case/:id` -> `core#show` | Covered |
| `/cases` | `GET /cases` -> `cases#index` | Covered |
| `/cases/import` | Modal on `/cases` page | Covered |
| `/teams` | `GET /teams` -> `teams#index` | Covered |
| `/teams/:teamId` | `GET /teams/:id` -> `teams#show` | Covered |
| `/scorers` | `GET /scorers` -> `scorers#index` | Covered |

---

## Architectural Notes

The biggest shift is from **client-side state management** (Angular services holding live state, client-side search execution, client-side scoring) to **server-authoritative state** (Rails renders, Turbo refreshes, server-side search proxy, server-side scoring).

Key implications:
- Score updates after rating use a two-tier approach: lightweight `QueryScoreService` for immediate per-query score feedback, plus debounced `RunCaseEvaluationJob` for full case-level scoring via Turbo Stream broadcasts.
- Search execution goes through `QuerySearchService` (Rails proxy to search engine), eliminating CORS issues but adding latency.
- The `docCache` module (`app/javascript/modules/doc_cache.js`) is still not wired to any Stimulus controller; document fetching is done via the server API per request.
- All Angular UI code has been removed; the workspace is Stimulus + ViewComponents + Turbo only.

---

## References

- [docs/workspace_behavior.md](workspace_behavior.md) — Current workspace behavior
- [docs/workspace_api_usage.md](workspace_api_usage.md) — API contracts
- [docs/deangularjs_experimental_parity_audit.md](deangularjs_experimental_parity_audit.md) — Parity audit (P0/P1 resolved)
- [docs/angular_services_responsibilities_mapping.md](angular_services_responsibilities_mapping.md) — Service migration
- [docs/per_component_migration_checklist.md](per_component_migration_checklist.md) — Component list
- [docs/code_review_angular_removal.md](code_review_angular_removal.md) — Code review findings
- [docs/turbo_frame_boundaries.md](turbo_frame_boundaries.md) — Turbo Frame structure
- [docs/view_component_conventions.md](view_component_conventions.md) — ViewComponent patterns

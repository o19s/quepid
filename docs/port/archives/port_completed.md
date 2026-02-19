
---

> **Archive note:** Completed items from the deangularjs parity audit were moved here on 2026-02-19; this file holds the full resolution record for resolved gaps and recommendations.

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
- **Browse on search engine:** Link in results header to open results directly on Solr/ES/OpenSearch (`build_browse_url`, `_document_cards.html.erb`)
- **Depth-of-rating indicator:** "Only the top N results above are used in scoring" below the Nth doc when results exceed scoring depth (`_document_cards.html.erb`)
- **Media embeds in document cards:** `DocumentCardComponent#media_embeds` renders audio/video/image from document field URLs
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

## RESOLVED GAPS

All previously reported high and medium priority gaps have been resolved:

### Completed Items Moved from `gap_implementation_review.md` (2026-02-19)

The following items were verified in current code and moved into this archive:

1. **Gap 1: Large document-fields payload guard** - `DocumentCardComponent#fields_json` now enforces `MAX_FIELDS_JSON_BYTES = 10_000` and omits oversized payloads.
2. **Gap 1: Detail modal ID collision** - `ResultsPaneComponent` now generates unique modal/tab IDs via `modal_dom_suffix`.
3. **Gap 1: Detailed Document View Implementation** - Document cards are server-rendered by `DocumentCardComponent` (`app/components/document_card_component.html.erb`). The `data-doc-fields` attribute is set with ERB `h(fields_json)`. The results pane fetches HTML from the query search API and injects it; the detail modal in `results_pane_controller.js` reads `data-doc-fields` from the card and builds the fields list in JS.
4. **Gap 2: Delete-last-try protection** - client-side guard in `settings_panel_controller.js` (`triesCountValue <= 1`) and server-side guard in `Api::V1::TriesController#destroy`.
5. **Gap 2: Try history truncation** - `SettingsPanelComponent` shows the first 20 tries and reveals extras via "Show all N tries".
6. **Gap 2: Try History Browser + Try Management** - `settings_panel_controller.js` implements `deleteTry()`. When the deleted try is the current try, it navigates to `buildPageUrl(root, "case", caseId)` (case root, which loads the latest try) instead of reloading, avoiding a 404.
7. **Gap 3: Duplicate try copies curator vars** - `Api::V1::TriesController#create` copies parent `curator_vars_map` when duplicating from `parent_try_number`.
8. **Gap 3: Server-side curator var name validation** - `CuratorVariable` now validates `name` with `/\A[A-Za-z0-9_]+\z/`.
9. **Gap 3: Curator Variables Implementation** - `Api::V1::TriesController#update` wraps `curator_variables.destroy_all` and `add_curator_vars` in `ActiveRecord::Base.transaction` when `params[:curator_vars].present?` (lines 103–107). Curator inputs are rendered in `settings_panel_controller.js` via `_renderCuratorVarInputs()`.
10. **Gap 4: Wizard step validation** - `new_case_wizard_controller.js` blocks step progression unless required endpoint URL/field spec inputs are present.
11. **Gap 4: Engine options no longer hardcoded** - `NewCaseWizardComponent` now uses `SearchEndpoint::SEARCH_ENGINES`.
12. **Gap 4: `_addFirstQuery` uses `apiFetch`** - wizard first-query POST now uses `apiFetch` with form-encoded body.
13. **Gap 4: New Case Setup Wizard Implementation** - `new_case_wizard_controller.js` uses `buildCaseQueriesUrl(root, this.caseIdValue)` for the first-query POST (`_addFirstQuery`), so the URL is correct. `Api::V1::TriesController#update` supports inline endpoint creation: it accepts `params[:search_endpoint]`, finds or creates a `SearchEndpoint` (including `SearchEndpoint.new(...).save!` when not found), and assigns it to `@try` (lines 86–100).
14. **Gap 5: Lightweight scoring includes position data** - `QueryScoreService` builds docs from latest snapshot ordering with `position`.
15. **Gap 5: Client-Side Real-Time Scoring Implementation** - `QueryScoreService` provides lightweight per-query scoring using persisted ratings (no search re-fetch). The score endpoint (`Api::V1::Queries::ScoresController`) uses `QueryScoreService` to compute scores server-side. `query_list_controller.js` listens for `query-score:refresh` events and updates score badges. Scorer testing has been enhanced: `ScorersController#test` (POST `/scorers/:id/test`) runs scorer code server-side with sample docs, and `scorer_test_controller.js` provides the UI integration.

---

## Completed Gap Implementations (2026-02-19)

The following 5 high-priority gaps from the gap implementation review have been fully implemented and are now complete:

### Gap 1: Detailed Document View / Full Field Explorer

**Status:** ✅ **COMPLETE**

**Implementation:** Document cards are server-rendered by `DocumentCardComponent` (`app/components/document_card_component.html.erb`). The `data-doc-fields` attribute is set with ERB `h(fields_json)`. The results pane fetches HTML from the query search API and injects it; the detail modal in `results_pane_controller.js` reads `data-doc-fields` from the card and builds the fields list in JS.

**Key Features:**
- Large document-fields payload guard: `DocumentCardComponent#fields_json` enforces `MAX_FIELDS_JSON_BYTES = 10_000` and omits oversized payloads
- Unique detail modal IDs: `ResultsPaneComponent` generates unique modal/tab IDs via `modal_dom_suffix` to prevent ID collisions

### Gap 2: Try History Browser + Try Management

**Status:** ✅ **COMPLETE**

**Implementation:** `settings_panel_controller.js` implements `deleteTry()` for try deletion. When the deleted try is the current try, it navigates to `buildPageUrl(root, "case", caseId)` (case root, which loads the latest try) instead of reloading, avoiding a 404.

**Key Features:**
- Delete-last-try protection: client-side guard in `settings_panel_controller.js` (`triesCountValue <= 1`) and server-side guard in `Api::V1::TriesController#destroy`
- Try history truncation: `SettingsPanelComponent` shows the first 20 tries and reveals extras via "Show all N tries"

### Gap 3: Curator Variables / Tuning Knobs

**Status:** ✅ **COMPLETE**

**Implementation:** `Api::V1::TriesController#update` wraps `curator_variables.destroy_all` and `add_curator_vars` in `ActiveRecord::Base.transaction` when `params[:curator_vars].present?` (lines 103–107). Curator inputs are rendered in `settings_panel_controller.js` via `_renderCuratorVarInputs()`.

**Key Features:**
- Duplicate try copies curator vars: `Api::V1::TriesController#create` copies parent `curator_vars_map` when duplicating from `parent_try_number`
- Server-side curator var name validation: `CuratorVariable` validates `name` with `/\A[A-Za-z0-9_]+\z/`
- Transaction-wrapped updates ensure atomicity

### Gap 4: New Case Setup Wizard (Enhanced)

**Status:** ✅ **COMPLETE**

**Implementation:** `new_case_wizard_controller.js` uses `buildCaseQueriesUrl(root, this.caseIdValue)` for the first-query POST (`_addFirstQuery`), so the URL is correct. `Api::V1::TriesController#update` supports inline endpoint creation: it accepts `params[:search_endpoint]`, finds or creates a `SearchEndpoint` (including `SearchEndpoint.new(...).save!` when not found), and assigns it to `@try` (lines 86–100).

**Key Features:**
- Wizard step validation: `new_case_wizard_controller.js` blocks step progression unless required endpoint URL/field spec inputs are present
- Engine options no longer hardcoded: `NewCaseWizardComponent` uses `SearchEndpoint::SEARCH_ENGINES`
- `_addFirstQuery` uses `apiFetch`: wizard first-query POST uses `apiFetch` with form-encoded body

### Gap 5: Client-Side Real-Time Scoring

**Status:** ✅ **COMPLETE**

**Implementation:** `QueryScoreService` provides lightweight per-query scoring using persisted ratings (no search re-fetch). The score endpoint (`Api::V1::Queries::ScoresController`) uses `QueryScoreService` to compute scores server-side. `query_list_controller.js` listens for `query-score:refresh` events and updates score badges. Scorer testing has been enhanced: `ScorersController#test` (POST `/scorers/:id/test`) runs scorer code server-side with sample docs, and `scorer_test_controller.js` provides the UI integration.

**Key Features:**
- Lightweight scoring includes position data: `QueryScoreService` builds docs from latest snapshot ordering with `position`
- Server-side scoring execution for security and consistency
- Real-time score badge updates via custom events

### Resolved: Client-Side Real-Time Scoring
**Angular:** `ScorerFactory.runCode()` executed custom JavaScript scorer code in the browser instantly after each rating change.
**Resolution:** Two-tier approach: `QueryScoreService` provides immediate per-query score feedback after rating, plus `RunCaseEvaluationJob` for full case-level scoring. `qscore_controller.js` `_animateScore()` provides smooth animated score transitions with cubic ease-out.

### Resolved: Side-by-Side Diff View
**Angular:** Dedicated columnar view showing "Current Results" vs snapshot columns side-by-side.
**Resolution:** `DiffComparisonComponent` renders multi-column side-by-side comparison with position change color coding (improved/degraded/new/missing), position change tooltips, per-snapshot query scores, and case-level score display in column headers.

### Resolved: Diff Numeric Scores
**Angular:** `diffResultsSvc` computed a numeric score per query per snapshot.
**Resolution:** `build_diff_data` in `SearchController` includes `SnapshotQuery#score` (per-query) and `Score` records (case-level) for each snapshot. Displayed in `DiffComparisonComponent` column headers.

### 1. Media Embeds, Translations, Per-Field Type Rendering

**Angular:** Document cards rendered `doc.embeds` (audio/video/image) via the `quepid-embed` directive, `doc.translations` with Google Translate links, and `doc.unabridgeds` for full field content.

**Current:** **Media embeds:** ✅ Resolved — `DocumentCardComponent#media_embeds` detects audio/video/image URLs from document fields and renders HTML5 `<audio>`, `<video>`, and `<img>` in the card. **Translations and per-field type formatting:** Not implemented. The document detail modal shows all fields and raw JSON but no Google Translate links or per-field type formatting. Remaining work is P3 polish.

Other resolved gaps (Querqy indicator, Browse on Solr link, Depth of rating warning, and the rest) are listed in **Parity Audit Completed Items** below.

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
| `delete_query` | `DeleteQueryComponent` | `delete_query_controller.js` |
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
| `unarchive_case` | `UnarchiveCaseComponent` | `unarchive_case_controller.js` |

Additional ViewComponents without a direct single Angular counterpart: `DocumentCardComponent` (doc cards in results, including media embeds), `ResultsPaneComponent` (results container + detail modal + bulk rating bar), `SettingsPanelComponent` (replaces Settings + query params + try history), `ScorerPanelComponent`, `ChartPanelComponent`, `QueryListComponent`, `DocFinderComponent`. The codebase has **60 Stimulus controllers** and **37 ViewComponents** (workspace and supporting pages).

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

## Parity Audit Completed Items

The following 22 items were originally unique to the Angular branch (`deangularjs`) and have been resolved in the experimental branch.

1. **Media embeds** (`quepidEmbed` directive) — audio/video/image URL detection and HTML5 player rendering. ✅ Resolved: `DocumentCardComponent#media_embeds` with HTML5 `<audio>`, `<video>`, `<img>`.
2. **Query sort by modified date** — `'-modifiedAt'` sort option. ✅ Resolved: `modified`, `modified_desc` in `query_list_controller.js`.
3. **Query sort by error state** — `['-errorText', 'allRated']` sort option. ✅ Resolved: `error` sort mode in `query_list_controller.js`.
4. **Query pagination** — `dir-paginate` with 15 queries per page. ✅ Resolved: Client-side pagination in `query_list_controller.js` with 15 per page, Bootstrap controls, URL persistence.
5. **Batch scoring progress** — "N of M queries scored" display. ✅ Resolved: "Scoring query N of M" in Turbo Stream notification.
6. **Animated count-up** — `angular-countup` for result count. ✅ Resolved: `count_up_controller.js` animates from 0 to target over 500ms.
7. **URL color bucketing** — visual grouping of tries by URL in history. ✅ Resolved: `SettingsPanelComponent#url_color_for_try` with 6-color palette.
8. **Solr param typo detection** — warns about case-sensitive Solr parameters. ✅ Resolved: `_checkSolrParamTypos()` in `settings_panel_controller.js`.
9. **ES template call warning** — detects and warns about template queries. ✅ Resolved: `_checkTemplateCall()` in `settings_panel_controller.js` for `_search/template`.
10. **Rating scale labels** — custom labels on rating buttons from scorer config. ✅ Resolved: `scale_with_labels` in rating popovers and bulk rating bar.
11. **Browse on Solr link** — direct link to browse results on the search engine. ✅ Resolved: `SearchController#build_browse_url` for Solr and ES/OS.
12. **Depth of rating indicator** — "Results above are counted in scoring" visual marker. ✅ Resolved: depth-indicator in `_document_cards.html.erb`.
13. **Field autocomplete with modifiers** — `media:`, `thumb:`, `image:` prefix support. ✅ Resolved: `field_autocomplete_controller.js` + `/api/v1/search_endpoints/:id/fields`.
14. **TMDB demo defaults** — pre-configured settings for demo search engines. ✅ Resolved: `TMDB_DEFAULTS` in `new_case_wizard_controller.js` (Solr/ES/OS).
15. **Static data upload in wizard** — CSV upload for static search engine type. ✅ Resolved: CSV upload in wizard step 2, static endpoint + snapshot creation.
16. **SearchAPI mapper wizard link** — redirect to mapper creation. ✅ Resolved: Link in wizard step 2 based on engine selection.
17. **Multiple queries in wizard** — add multiple queries with deduplication. ✅ Resolved: Semicolon-separated input with case-insensitive dedup.
18. **Unarchive case from workspace** — modal to restore archived cases. ✅ Resolved: `UnarchiveCaseComponent` + `unarchive_case_controller.js` with team filter.
19. **Debug matches modal** — dedicated JSON explorer for explain data. ✅ Resolved: `json_tree_controller.js` collapsible tree, color-coded primitives.
20. **Vega chart in frog report** — distribution bar chart. ✅ Resolved: D3 v7 bar chart in `frog_report_controller.js` (hover, tooltips, labels).
21. **ng-json-explorer** — interactive JSON tree view. ✅ Resolved: `json_tree_controller.js` with collapsible tree, toggle arrows.
22. **Auto-grow input** — dynamic input width for curator variables. ✅ Resolved: `autoGrowInput()` in `settings_panel_controller.js` (50–200px).

---

## Parity Audit Recommendations Completed

All recommendations from the parity audit have been completed.

### High Priority (Functional Gaps)

1. **Add query sort by modified date and error state** — `modified`, `modified_desc`, `error` in `query_list_controller.js`.
2. **Implement media embeds** — `DocumentCardComponent#media_embeds` with HTML5 audio/video/image.
3. **Add batch scoring progress indicator** — "Scoring query N of M" in Turbo Stream.

### Medium Priority (UX Polish)

4. **Add query pagination** — 15 per page, Bootstrap controls, URL persistence.
5. **Implement rating scale labels** — `scale_with_labels` in popovers and bulk bar.
6. **Add depth indicator** — Below Nth document card in `_document_cards.html.erb`.
7. **Enrich the new case wizard** — TMDB defaults, field autocomplete, multiple queries, CSV upload, SearchAPI mapper link.
8. **Add Solr param typo detection** — `_checkSolrParamTypos()` in `settings_panel_controller.js`.
9. **Add URL color bucketing in try history** — `url_color_for_try` in `SettingsPanelComponent`.

### Low Priority (Nice to Have)

10. **Add Browse on Solr link** — `build_browse_url` in `SearchController`.
11. **Enhance debug matches modal** — `json_tree_controller.js` collapsible JSON tree.
12. **Add count-up animation** — `count_up_controller.js` (0 to target, 500ms).
13. **Restore auto-grow behavior** — `autoGrowInput()` in `settings_panel_controller.js`.
14. **Add Vega chart to frog report** — D3 v7 bar chart in `frog_report_controller.js`.
15. **Port unarchive case modal** — `UnarchiveCaseComponent` + `unarchive_case_controller.js`.
16. **Add ES template call warning** — `_checkTemplateCall()` in `settings_panel_controller.js`.


---

## Feature-by-Feature Parity Matrix

### 1. Core Workspace Layout & Navigation

| Feature | Angular Reference | Stimulus/VC Reference | Status | Notes |
|---------|------------------|----------------------|--------|-------|
| Case workspace page | `MainCtrl` + `queriesLayout.html` | `workspace_controller.js` + `core/show.html.erb` | ✅ COMPLETE | Server-side rendering vs client-side SPA |
| Loading state | `LoadingCtrl` + `loading.js` | Loading indicators in `results_pane_controller.js` | ✅ COMPLETE | Different mechanism (CSS vs ng-show) |
| Flash messages | `angular-flash` + `common/flash.html` | `shared/_flash_alert.html.erb` + Turbo Stream | ✅ COMPLETE | Turbo streams flash vs Angular flash service |
| TLS mismatch warning | `MainCtrl` checks `needToRedirectQuepidProtocol()` | Server-side redirect in `CoreController` | ✅ COMPLETE | Server-side is more reliable |
| East/West panel layout | `paneSvc` with jQuery dragging + `toggleEast` event | `workspace_panels_controller.js` + `workspace_resizer_controller.js` | ✅ COMPLETE | CSS-based collapsible panels vs jQuery |
| Header navigation | `HeaderCtrl` + `_header_core_app.html.erb` | `_header.html.erb` with `NewCaseComponent` | ✅ COMPLETE | Server-rendered header vs Angular header |
| Case dropdown (recent) | `HeaderCtrl` `$on('fetchedDropdownCasesList')` | Server-rendered in `_header.html.erb` | ✅ COMPLETE | No client-side polling needed |
| Book dropdown (recent) | `HeaderCtrl` `$on('fetchedDropdownBooksList')` | Server-rendered in `_header.html.erb` | ✅ COMPLETE | |
| URL-based root path | `caseTryNavSvc.getQuepidRootUrl()` | `getQuepidRootUrl()` from `utils/quepid_root` | ✅ COMPLETE | Both respect `RAILS_RELATIVE_URL_ROOT` |
| Proxy URL construction | `caseTryNavSvc.getQuepidProxyUrl()` | Server-side in `FetchService` | ✅ COMPLETE | Server handles proxy directly |
| Dev settings toggle | `$scope.toggleDevSettings()` + jQuery `toggleEast` | `settings_panel_controller.js#toggle()` | ✅ COMPLETE | Bootstrap Collapse vs jQuery toggle |
| Footer management | `footer.js` MutationObserver clone | CSS-based footer in layouts | ✅ COMPLETE | Simpler approach |

### 2. Query Management

| Feature | Angular Reference | Stimulus/VC Reference | Status | Notes |
|---------|------------------|----------------------|--------|-------|
| Add single query | `add_query` component | `add_query_controller.js` + `AddQueryComponent` | ✅ COMPLETE | Turbo Stream append vs Angular push |
| Add multiple queries (semicolon) | `add_query` ctrl.submit() splits on `;` | `add_query_controller.js` | ✅ COMPLETE | |
| Paste handling (newlines to semicolons) | `textPaste` directive + `handlePaste()` | Handled in `add_query_controller.js` | ✅ COMPLETE | |
| Delete query | `SearchResultsCtrl.removeQuery()` + `$window.confirm` | `delete_query_controller.js` + `DeleteQueryComponent` | ✅ COMPLETE | Turbo Stream remove vs Angular delete |
| Move query to another case | `move_query` component + `MoveQueryModalInstanceCtrl` | `move_query_controller.js` + `MoveQueryComponent` | ✅ COMPLETE | |
| Query reordering (drag-and-drop) | `ui-sortable` + `queriesSvc.updateQueryDisplayPosition()` | `query_list_controller.js` + SortableJS | ✅ COMPLETE | SortableJS vs jQuery UI Sortable |
| Query filter (text search) | `$scope.matchQueryFilter()` in `QueriesCtrl` | `query_list_controller.js#filter()` | ✅ COMPLETE | Client-side filtering in both |
| Query sort (default/name/score/modified/error) | `$scope.sortBy()` in `QueriesCtrl` | `query_list_controller.js#sort()` | ✅ COMPLETE | All 5 sort modes: default, name, score, modified, error. Added `data-query-modified` and `data-query-error` attributes to query rows |
| Sort order persistence in URL | `$location.search()` with sort/reverse | `_persistSortToUrl()` / `_restoreSortFromUrl()` | ✅ COMPLETE | |
| Query pagination | `dir-paginate` with pageSize 15 | `query_list_controller.js` client-side pagination | ✅ COMPLETE | 15 queries per page with Bootstrap pagination controls, URL persistence, filter/sort integration |
| Show only rated docs | `queriesSvc.toggleShowOnlyRated()` + checkbox | `results_pane_controller.js#toggleShowOnlyRated()` | ✅ COMPLETE | |
| Collapse all queries | `queryViewSvc.collapseAll()` | `query_list_controller.js#collapseAll()` | ✅ COMPLETE | |
| Expand all queries | Not in Angular (only collapse) | `query_list_controller.js#expandAll()` | 🚀 ENHANCED | Experimental adds expand-all |
| Query notes (info need + notes) | `QueryNotesCtrl` + `query.saveNotes()` | `core/queries/notes_controller.rb` + Turbo Frame | ✅ COMPLETE | Server-side save vs client-side |
| Query options (JSON editor) | `query_options` component + ACE editor | `query_options_controller.js` + `QueryOptionsComponent` | ✅ COMPLETE | CodeMirror vs ACE |
| Query explain (parsed query) | `query_explain` component + `<json-explorer>` | `query_explain_controller.js` + `QueryExplainComponent` | ✅ COMPLETE | JSON display in modal |
| Batch position / scoring progress | `$scope.batchPosition` / `$scope.batchSize` in `QueriesCtrl` | `RunCaseEvaluationJob` Turbo Stream broadcasts | ✅ COMPLETE | Shows "Scoring query N of M" via Turbo Streams |

### 3. Search Execution & Results Display

| Feature | Angular Reference | Stimulus/VC Reference | Status | Notes |
|---------|------------------|----------------------|--------|-------|
| Execute search (single query) | `query.search()` via splainer-search (client-side) | `results_pane_controller.js#fetchResults()` -> `QuerySearchService` (server-side) | ✅ COMPLETE | Fundamental architecture change: server-side execution |
| Execute all searches | `queriesSvc.searchAll()` (client-side parallel) | `RunCaseEvaluationJob` (server-side background) | ✅ COMPLETE | Background job vs client-side parallel |
| Search result rendering | `searchResult` directive + `searchResult.html` | `DocumentCardComponent` (server-rendered) | ✅ COMPLETE | ViewComponent vs Angular directive |
| Result pagination (load more) | `query.paginate()` via splainer-search pager | `results_pane_controller.js#_loadMore()` with `start` param | ✅ COMPLETE | Server-side pagination |
| Rating popover (single doc) | `rateElementSvc.handleRatingScale()` + `ratings/popover.html` | `results_pane_controller.js#_toggleRatingPopover()` | ✅ COMPLETE | Bootstrap 5 Popover vs Angular uib-popover |
| Rating display (badge) | `$scope.displayRating()` in `SearchResultCtrl` | Turbo Stream `_rating_badge.html.erb` | ✅ COMPLETE | Live update via Turbo Stream |
| Bulk rating (Score All) | `rateBulkSvc.handleRatingScale()` in `SearchResultsCtrl` | `results_pane_controller.js#bulkRate()` / `bulkClear()` | ✅ COMPLETE | |
| Thumbnail/image display | `doc.hasThumb()` / `doc.hasImage()` + `formatImageUrl()` | `DocumentCardComponent` with `image_prefix_from_field_spec` | ✅ COMPLETE | Server-side image URL construction |
| Media embeds (audio/video/image) | `quepidEmbed` directive | `DocumentCardComponent#media_embeds` | ✅ COMPLETE | Server-side URL detection for audio/video/image extensions; renders HTML5 `<audio>`, `<video>`, `<img>` elements |
| Snippet highlighting | `doc.subSnippets('<strong>', '</strong>')` | Server-side highlights in `QuerySearchService` | ✅ COMPLETE | |
| Explain/matches chart | `stackedChart` directive + D3 bar chart | `matches_controller.js` + `MatchesComponent` | ✅ COMPLETE | |
| Hot matches display | `HotMatchesCtrl` with show/hide more | `MatchesComponent` | ✅ COMPLETE | |
| Document detail modal | `DetailedDocCtrl` + `detailedDoc.html` | `results_pane_controller.js#_openDetailModal()` | ✅ COMPLETE | All fields, JSON view, copy |
| Detailed explain modal | `DocExplainCtrl` + `detailedExplain.html` with `<json-explorer>` | Part of detail modal | ✅ COMPLETE | Combined into single modal |
| Debug matches modal | `debug_matches` component + `<json-explorer>` | `MatchesComponent` + `json_tree_controller.js` | ✅ COMPLETE | Interactive collapsible JSON tree view with color-coded primitives |
| View document source (raw) | `$scope.openDocument()` in `DetailedDocCtrl` | `results_pane_controller.js#viewSource()` | ✅ COMPLETE | Server-side raw endpoint |
| Link to document (with auth) | `$scope.linkToDoc()` with credential injection | Server-side URL construction | ✅ COMPLETE | |
| Number found display | `query.getNumFound()` with `<count-up>` animation | `count_up_controller.js` + `_document_cards.html.erb` | ✅ COMPLETE | Animated count-up from 0 to target over 500ms |
| Querqy rule detection | `$scope.querqyRuleTriggered()` in `SearchResultsCtrl` | `QuerySearchService#detect_querqy` | ✅ COMPLETE | Server-side detection |
| Browse on search engine link | Browse URL in `searchResults.html` | `SearchController#build_browse_url` + `_document_cards.html.erb` | ✅ COMPLETE | Server-side URL construction for Solr (query URL) and ES/OS (_search endpoint) |
| Error state display | `flash.to('search-error')` + `query.errorText` | Error messages in results pane | ✅ COMPLETE | |
| Depth indicator | "Results above are counted in scoring" | `_document_cards.html.erb` depth-indicator div | ✅ COMPLETE | Shows "Only the top N results above are used in scoring" below the Nth document card |
| Result difference classes (diff) | `getResultDifference()` / `getResultClass()` in `QueryDiffResultsCtrl` | Server-rendered diff badges in `_document_cards.html.erb` | ✅ COMPLETE | |

### 4. Document Rating

| Feature | Angular Reference | Stimulus/VC Reference | Status | Notes |
|---------|------------------|----------------------|--------|-------|
| Rate single document | `rateElementSvc` + `doc.rate(rating)` | `results_pane_controller.js#_applyRating()` | ✅ COMPLETE | Turbo Stream badge update |
| Reset single rating | `doc.resetRating()` | `_applyRating()` with NaN/clear | ✅ COMPLETE | |
| Bulk rate (all docs in query) | `rateBulkSvc` + `doc.rateBulk()` | `results_pane_controller.js#bulkRate()` | ✅ COMPLETE | |
| Bulk reset ratings | `doc.resetBulkRatings()` | `results_pane_controller.js#bulkClear()` | ✅ COMPLETE | |
| Rating scale display | `scorer.getColors()` -> colored buttons | Scale from `scorer.scale` rendered as buttons | ✅ COMPLETE | |
| Rating scale labels | `scorer.showScaleLabel()` | `ResultsPaneComponent` + `results_pane_controller.js` | ✅ COMPLETE | Labels from `scorer.scale_with_labels` shown alongside numeric values in rating popovers and bulk rating bar |

### 5. Scoring & Evaluation

| Feature | Angular Reference | Stimulus/VC Reference | Status | Notes |
|---------|------------------|----------------------|--------|-------|
| Case-level score display | `qscore_case` component + `qscoreSvc.scoreToColor()` | `QscoreCaseComponent` + `QscoreColorable` | ✅ COMPLETE | |
| Query-level score display | `qscore_query` component | `QscoreQueryComponent` | ✅ COMPLETE | |
| Score sparkline graph | `qgraph` directive (D3) | `qgraph_controller.js` + `QgraphComponent` (D3 v7) | ✅ COMPLETE | |
| Annotation markers on graph | Vertical lines with tooltip in `qgraph` | `qgraph_controller.js` annotation rendering | ✅ COMPLETE | |
| Score-to-color mapping | `qscoreSvc.scoreToColor()` (HSL buckets) | `QscoreColorable` module (Ruby + CSS) | ✅ COMPLETE | Same bucket math |
| Scorer picker modal | `ScorerCtrl` + `pick_scorer.html` | `scorer_panel_controller.js#openPicker()` | ✅ COMPLETE | |
| Scorer assignment to case | `caseSvc.saveDefaultScorer()` | `scorer_panel_controller.js#selectScorer()` | ✅ COMPLETE | |
| Scorer code execution | Client-side `eval()` in `ScorerFactory.runCode()` | Server-side `JavascriptScorer` in `QueryScoreService` | ✅ COMPLETE | More secure server-side execution |
| Scorer testing | Client-side eval in browser | Server-side `ScorerController#test` | 🚀 ENHANCED | Server-side testing with sample docs |
| Per-query lightweight score refresh | `queriesSvc.scoreAll()` client-side | `query_list_controller.js#_handleScoreRefresh()` -> `QueryScoreService` | ✅ COMPLETE | Server-side scoring |
| Case-level score saving | `caseSvc.trackLastScore()` | `RunCaseEvaluationJob#broadcast_score_update` | ✅ COMPLETE | Background job + Turbo broadcast |
| Run evaluation in background | `caseSvc.runEvaluation()` -> redirect | `RunCaseEvaluationJob` + Turbo Streams | 🚀 ENHANCED | Live progress updates via Turbo |
| Nightly evaluation toggle | `$scope.updateNightly()` in `CaseCtrl` | `nightly_toggle_controller.js` | ✅ COMPLETE | |
| Diff score calculation | `diffs.calculateCaseScores()` in `QueriesCtrl` | Server-rendered diff badges | ✅ COMPLETE | Server-side calculation |

### 6. Settings & Configuration

| Feature | Angular Reference | Stimulus/VC Reference | Status | Notes |
|---------|------------------|----------------------|--------|-------|
| Settings panel (query sandbox) | `QueryParamsCtrl` + `queryParams` directive | `settings_panel_controller.js` + `SettingsPanelComponent` | ✅ COMPLETE | |
| Query params editor (Solr) | `textarea` in `devQueryParams.html` | CodeMirror textarea in settings | ✅ COMPLETE | |
| Query params editor (ES/OS JSON) | ACE editor (JSON mode) | CodeMirror (JSON mode) | ✅ COMPLETE | CodeMirror replaces ACE |
| Curator variables (tuning knobs) | `curatorVars` in TryFactory + `autoGrow` directive | `settings_panel_controller.js#_renderCuratorVarInputs()` | ✅ COMPLETE | |
| Curator variables persistence | `settingsSvc.save()` creates new try | `settings_panel_controller.js#saveParams()` updates existing try | ✅ COMPLETE | Different approach: update vs create new |
| Search endpoint selection | `searchEndpointSvc.fetchForCase()` + typeahead | `endpointSelect` target in settings panel | ✅ COMPLETE | Select dropdown vs typeahead |
| Custom headers config | `CustomHeadersCtrl` + `customHeaders` directive | `custom_headers_controller.js` + `CustomHeadersComponent` | ✅ COMPLETE | |
| Field spec editing | Text input in settings tab | Text input in settings panel | ✅ COMPLETE | |
| Number of rows config | Number input (max 100) | Number input | ✅ COMPLETE | |
| Escape queries checkbox | Checkbox in settings | Checkbox in settings | ✅ COMPLETE | |
| Try rename | `CurrSettingsCtrl` / `QueryParamsDetailsCtrl` | `inline_edit_controller.js` | ✅ COMPLETE | Inline edit vs modal |
| Try duplicate | `Settings.duplicateTry()` | `settings_panel_controller.js#duplicateTry()` | ✅ COMPLETE | |
| Try delete | `QueryParamsDetailsCtrl.deleteTry()` | `settings_panel_controller.js#deleteTry()` | ✅ COMPLETE | |
| Try history list | `queryParamsHistory` directive | `QueryParamsPanelComponent` | ✅ COMPLETE | |
| URL color bucketing in history | `$scope.urlBucket()` in `queryParamsHistoryCtrl` | `SettingsPanelComponent#url_color_for_try` | ✅ COMPLETE | 6-color palette assigned by unique endpoint URL; displayed as 4px left border on each try row |
| Search URL validation | Client-side via `SettingsValidatorFactory` | Server-side `SearchEndpoints::ValidationsController` | 🚀 ENHANCED | SSRF protection added |
| Solr query param typo detection | `$scope.validateQueryParams()` in `QueryParamsCtrl` | `settings_panel_controller.js#validateQueryParams()` + `_checkSolrParamTypos()` | ✅ COMPLETE | Checks for common Solr case-sensitivity typos (defType, echoParams, etc.) and validates JSON for ES/OS |
| ES template call warning | `esUrlSvc.isTemplateCall()` check | `settings_panel_controller.js#_checkTemplateCall()` | ✅ COMPLETE | Detects `_search/template` in URL and shows warning |

### 7. Snapshots & Diff Comparison

| Feature | Angular Reference | Stimulus/VC Reference | Status | Notes |
|---------|------------------|----------------------|--------|-------|
| Take snapshot | `TakeSnapshotCtrl` + `PromptSnapshotCtrl` | `take_snapshot_controller.js` + `TakeSnapshotComponent` | ✅ COMPLETE | |
| Snapshot name + options | Name input, record doc fields checkbox | Same options in modal | ✅ COMPLETE | |
| Server-side snapshot creation | Not available (client sends full payload) | `CreateSnapshotFromSearchJob` | 🚀 ENHANCED | Server fetches results directly |
| Snapshot delete | In diff modal | In diff modal | ✅ COMPLETE | |
| Compare snapshots (1-3) | `diff` component + `DiffModalInstanceCtrl` | `diff_controller.js` + `DiffComponent` | ✅ COMPLETE | |
| Diff results display | `queryDiffResults` directive + `QueryDiffResultsCtrl` | Server-rendered diff badges + `DiffComparisonComponent` | ✅ COMPLETE | |
| Diff score at case level | `diffs.calculateCaseScores()` in `QueriesCtrl` | Server-side in evaluation job | ✅ COMPLETE | |
| Snapshot import (CSV) | `querySnapshotSvc.importSnapshots()` | `import_snapshot_controller.js` | ✅ COMPLETE | |
| Snapshot serialization | `Marshal.dump` (insecure) | `JSON` serialization (secure) | 🚀 ENHANCED | Security improvement |

### 8. Case Operations (Clone, Delete, Export, Import)

| Feature | Angular Reference | Stimulus/VC Reference | Status | Notes |
|---------|------------------|----------------------|--------|-------|
| Clone case | `clone_case` component + `CloneCaseModalInstanceCtrl` | `clone_case_controller.js` + `CloneCaseComponent` | ✅ COMPLETE | |
| Clone options (queries, ratings, history, try) | All options in modal | All options in modal | ✅ COMPLETE | |
| Delete case | `delete_case` component + `DeleteCaseModalInstanceCtrl` | `delete_case_controller.js` + `DeleteCaseComponent` | ✅ COMPLETE | |
| Delete case options (archive/delete/clear queries) | `delete_case_options` component | `delete_case_options_controller.js` + `DeleteCaseOptionsComponent` | ✅ COMPLETE | |
| Archive case | `caseSvc.archiveCase()` | Via delete options | ✅ COMPLETE | |
| Unarchive case | `UnarchiveCaseCtrl` + `unarchiveCaseModal.html` | `unarchive_case_controller.js` + `UnarchiveCaseComponent` | ✅ COMPLETE | Modal with team filter and case list, available from workspace toolbar |
| Case rename | `CaseCtrl` + double-click toggle | `inline_edit_controller.js` | ✅ COMPLETE | |
| Export case (10 formats) | `export_case` component + `ExportCaseModalInstanceCtrl` | `export_case_controller.js` + `ExportCaseComponent` | ✅ COMPLETE | All formats: info need, general, detailed, snapshot, basic, TREC, RRE, LTR, Quepid, API links |
| Export general/detailed/snapshot CSV | Client-side via `caseCSVSvc` | Server-side via `ExportCaseService` + `ExportCaseJob` | 🚀 ENHANCED | Async background export |
| Import ratings (CSV) | `import_ratings` component + `importRatingsSvc.importCSVFormat()` | `import_ratings_controller.js` + `ImportRatingsComponent` | ✅ COMPLETE | |
| Import ratings (RRE JSON) | `importRatingsSvc.importRREFormat()` | `import_ratings_controller.js` with RRE file picker | ✅ COMPLETE | |
| Import ratings (LTR) | `importRatingsSvc.importLTRFormat()` | `import_ratings_controller.js` with LTR file picker | ✅ COMPLETE | |
| Import information needs | `importRatingsSvc.importInformationNeeds()` | `import_ratings_controller.js` info needs tab | ✅ COMPLETE | |
| Async import (large files) | Not available (sync only) | `ImportCaseRatingsJob` + `CaseImport` model | 🚀 ENHANCED | Background processing for >50 ratings |

### 9. Annotations

| Feature | Angular Reference | Stimulus/VC Reference | Status | Notes |
|---------|------------------|----------------------|--------|-------|
| Annotations list | `annotations` component + `annotationsSvc.fetchAll()` | `annotations_controller.js` + `AnnotationsComponent` | ✅ COMPLETE | |
| Create annotation | `annotationsSvc.create()` | `annotations_controller.js` + Turbo Stream prepend | ✅ COMPLETE | |
| Edit annotation | `annotation` component modal | `annotations_controller.js` inline edit | ✅ COMPLETE | |
| Delete annotation | `annotationsSvc.delete()` | `annotations_controller.js` | ✅ COMPLETE | |
| Annotation on graph | Vertical markers in `qgraph` | `qgraph_controller.js` annotation markers | ✅ COMPLETE | |

### 10. Sharing & Teams

| Feature | Angular Reference | Stimulus/VC Reference | Status | Notes |
|---------|------------------|----------------------|--------|-------|
| Share case with team | `share_case` component + `ShareCaseModalInstanceCtrl` | `share_case_controller.js` + `ShareCaseComponent` | ✅ COMPLETE | |
| Unshare case from team | In share modal | In share modal | ✅ COMPLETE | |
| Judgements / Book of Judgements | `judgements` component + `JudgementsModalInstanceCtrl` | `judgements_controller.js` + `JudgementsComponent` | ✅ COMPLETE | |
| Associate book with case | `caseSvc.associateBook()` | In judgements modal | ✅ COMPLETE | |
| Refresh ratings from book | `bookSvc.refreshCaseRatingsFromBook()` | In judgements modal | ✅ COMPLETE | |
| Populate book from case | `bookSvc.updateQueryDocPairs()` | In judgements modal | ✅ COMPLETE | |

### 11. Wizard & Onboarding

| Feature | Angular Reference | Stimulus/VC Reference | Status | Notes |
|---------|------------------|----------------------|--------|-------|
| New case wizard | `WizardModalCtrl` + `wizardModal.html` (6 steps) | `new_case_wizard_controller.js` + `NewCaseWizardComponent` (4 steps) | ✅ COMPLETE | 4-step wizard with TMDB demo defaults, CSV upload, field autocomplete, SearchAPI mapper link, multiple queries |
| Wizard auto-show for new users | `WizardCtrl` checks user state + case count | `showValue` on wizard component | ✅ COMPLETE | |
| URL-param wizard trigger | `$location.search().showWizard` | `showWizard` URL param | ✅ COMPLETE | |
| First-time welcome step | Step 1 with Doug greeting | Step 1 welcome | ✅ COMPLETE | |
| Search engine selection | Radio buttons (Solr/ES/OS/Vectara/Static/SearchAPI/Algolia) | Existing endpoint select + new endpoint form + TMDB demo | ✅ COMPLETE | Endpoint selection with TMDB demo defaults for Solr/ES/OS |
| URL validation in wizard | `SettingsValidatorFactory.validateUrl()` client-side | Not in wizard (handled in settings panel) | ⚠️ PARTIAL | URL validation available in settings panel but not inline during wizard |
| Field autocomplete (typeahead) | `$scope.loadFields()` with modifier support (media:, thumb:, image:) | `field_autocomplete_controller.js` + API endpoint | ✅ COMPLETE | Autocomplete with modifier prefix support (media:, thumb:, image:, id:, title:) in wizard and settings |
| Add queries step | Dynamic query list with dedup | Semicolon-separated input with dedup | ✅ COMPLETE | Supports multiple queries separated by semicolons with case-insensitive deduplication |
| Static data upload | CSV upload + `querySnapshotSvc.importSnapshotsToSpecificCase()` | CSV upload in wizard step 2 | ✅ COMPLETE | Client-side CSV parsing with preview, creates static endpoint + snapshot on finish |
| SearchAPI mapper wizard link | `$scope.goToMapperWizard()` | Link shown when SearchAPI selected | ✅ COMPLETE | Mapper wizard link shown/hidden based on engine selection |
| TMDB demo defaults | `settingsSvc.tmdbSettings` per engine | `TMDB_DEFAULTS` in `new_case_wizard_controller.js` | ✅ COMPLETE | Auto-fills URL, query params, and field spec for Solr/ES/OS TMDB demo |
| Guided tour (Shepherd.js) | `tour.js` with Shepherd.js (9 steps) | `tour_controller.js` with Bootstrap popovers (9 steps) | ✅ COMPLETE | 9-step tour with highlight overlay, back/next navigation; Bootstrap popovers replace Shepherd.js |
| Tour auto-start after wizard | `setupAndStartTour` after 1500ms | `startTour` URL param after reload | ✅ COMPLETE | |

### 12. UI Utilities & Micro-features

| Feature | Angular Reference | Stimulus/VC Reference | Status | Notes |
|---------|------------------|----------------------|--------|-------|
| Clipboard copy | `ngclipboard` directive | `clipboard_controller.js` | ✅ COMPLETE | |
| Expand content modal | `expand_content` directive + full-screen modal | `expand_content_controller.js` + `ExpandContentComponent` | ✅ COMPLETE | |
| Auto-grow input | `autoGrow` directive (jQuery plugin) | `settings_panel_controller.js#autoGrowInput()` | ✅ COMPLETE | Dynamic width (50-200px) based on input length for curator variable inputs |
| Timeago display | `yaru22.angular-timeago` | Rails `time_ago_in_words` helper | ✅ COMPLETE | Server-side rendering |
| Score display formatting | `scoreDisplay` filter (2 decimal places) | Ruby formatting in components | ✅ COMPLETE | |
| Search engine name mapping | `searchEngineName` filter | Ruby helper | ✅ COMPLETE | |
| Query state CSS class | `queryStateClass` filter | CSS classes on query rows | ✅ COMPLETE | |
| Count-up animation | `angular-countup` directive | `count_up_controller.js` | ✅ COMPLETE | Animated count from 0 to target over 500ms in 5 steps |
| Vega charts (frog report) | `ngVega` + Vega v5 specification | `frog_report_controller.js` + D3 v7 bar chart | ✅ COMPLETE | D3 equivalent with full interactivity (hover, tooltips, labels) |
| JSON explorer | `ng-json-explorer` | `json_tree_controller.js` | ✅ COMPLETE | Collapsible JSON tree with color-coded primitives, toggle arrows, nested expand/collapse |
| Confetti celebration | Not in Angular | `confetti_controller.js` | 🚀 ENHANCED | Added celebration effect |

---

## Detailed Behavioral Differences

### Query Sort Options — RESOLVED

**Angular**: Supports 5 sort modes -- default (manual), modified (by last modification date), query (alphabetical), score (by last score), error (by error state then all-rated). Each has a toggle for ascending/descending via `switchSortOrder()`.

**Stimulus**: Now supports 7 sort modes -- default, name, name_desc, score_asc, score_desc, modified, modified_desc, error. Query rows carry `data-query-modified` (unix timestamp) and `data-query-error` (boolean) attributes for client-side sorting.

**Status**: Parity achieved.

### Query Pagination — RESOLVED

**Angular**: Uses `dir-paginate` with a page size of 15 queries per page, with pagination controls at the bottom.

**Stimulus**: Client-side pagination in `query_list_controller.js` with a default page size of 15. Uses two-layer visibility: `data-filter-hidden` for text/rated filtering, `display:none` for page-based visibility. Bootstrap `pagination-sm` controls with prev/next and page numbers. Page state persisted in URL via `?page=N`.

**Status**: Parity achieved.

### New Case Wizard Steps — RESOLVED

**Angular** (6 steps): Welcome -> Name -> Endpoint (with engine radio buttons, URL validation, static data upload, proxy/TLS config, mapper wizard link) -> Fields (with autocomplete, modifier support) -> Queries (add multiple, dedup) -> Finish

**Stimulus** (4 steps): Welcome -> Search Endpoint (select existing or create new, TMDB demo defaults, CSV upload, SearchAPI mapper link) -> Field Display (with autocomplete and modifier support) -> First Queries (semicolon-separated with dedup)

**Status**: Parity achieved. The experimental wizard consolidates Angular's 6 steps into 4 while including all key features: TMDB demo defaults for Solr/ES/OS, CSV static data upload, SearchAPI mapper wizard link, field autocomplete with modifier prefixes, and multiple query support with deduplication. Only inline URL validation during the wizard is missing (available in settings panel instead).

### Rating Scale Labels — RESOLVED

**Angular**: `ScorerFactory` supports `scaleWithLabels` that maps scale values to display labels (e.g., "Relevant", "Not Relevant"). These labels appear in the rating popover.

**Stimulus**: Now passes `scale_with_labels` from the scorer through `ResultsPaneComponent` to both the server-rendered bulk rating bar and the client-side rating popovers. Labels appear as small text alongside numeric values and as tooltips.

**Status**: Parity achieved.

### URL Color Bucketing in Try History — RESOLVED

**Angular**: `queryParamsHistoryCtrl` assigns a color bucket to each unique URL using `urlBucket(url, 3)`, cycling through 3 colors. This provides visual grouping of tries by their search endpoint.

**Stimulus**: `SettingsPanelComponent#url_color_for_try` assigns a 6-color palette to unique endpoint URLs. Each try row in the history list has a 4px colored left border for visual grouping.

**Status**: Parity achieved (with an expanded 6-color palette vs Angular's 3).

### Solr Query Parameter Typo Detection — RESOLVED

**Angular**: `QueryParamsCtrl.validateQueryParams()` checks for common case-sensitivity typos in Solr parameters (e.g., `deftype` should be `defType`, `echoparams` should be `echoParams`, etc.) and shows a warning with the correct parameter name.

**Stimulus**: `settings_panel_controller.js#validateQueryParams()` now checks for Solr parameter case-sensitivity typos via `_checkSolrParamTypos()` and validates JSON syntax for ES/OS engines.

**Status**: Parity achieved.

### Media Embeds — RESOLVED

**Angular**: The `quepidEmbed` directive detects audio (mp3, wav, ogg), image (jpg, png, gif, svg, webp), and video (mp4, webm, avi) URLs by file extension and renders appropriate HTML5 `<audio>`, `<img>`, or `<video>` elements inline in search results.

**Stimulus**: `DocumentCardComponent#media_embeds` detects audio, video, and image URLs by file extension and renders HTML5 `<audio>`, `<video>`, and `<img>` elements. Supports a broader set of extensions than Angular (adds flac, aac, mkv, ogv, bmp, tiff).

**Status**: Parity achieved (with expanded format support).

---

## Backend Differences

### Route Differences

| Route | deangularjs | experimental |
|-------|-------------|--------------|
| Case workspace | `GET /case/:id(/try/:try_number) => core#index` | `GET /case/:id(/try/:try_number) => core#show` |
| Query search execution | Not available | `GET /api/v1/cases/:case_id/tries/:try_number/queries/:query_id/search` |
| Query search raw | Not available | `GET /api/v1/cases/:case_id/tries/:try_number/queries/:query_id/search/raw` |
| Query score | Not available | `POST /api/v1/cases/:case_id/queries/:query_id/score` |
| URL validation | Not available | `POST /api/v1/search_endpoints/validation` |
| Scorer test | Not available | `POST /scorers/:id/test` |
| Export general CSV | Not available | `GET /api/v1/export/cases/:id/general` |
| Export detailed CSV | Not available | `GET /api/v1/export/cases/:id/detailed` |
| Export snapshot CSV | Not available | `GET /api/v1/export/cases/:id/snapshot` |
| Async export | Not available | `POST /case/:id/export` |
| Export download | Not available | `GET /case/:id/export/download` |
| Async import ratings | Not available | `POST /case/:id/import/ratings` |
| Import info needs | Not available | `POST /case/:id/import/information_needs` |
| Query create (Turbo) | Not available | `POST /case/:id/queries` |
| Query destroy (Turbo) | Not available | `DELETE /case/:id/queries/:query_id` |
| Query notes update | Not available | `PUT /case/:id/queries/:query_id/notes` |
| Search endpoint fields | Not available | `GET /api/v1/search_endpoints/:id/fields` |

### Parameter Handling Differences

- **Clone cases controller**: Experimental uses `deserialize_bool_param()` for `preserve_history`, `clone_queries`, `clone_ratings`; deangularjs passes raw string values
- **Clone cases controller**: Experimental validates try/history combination (returns 400 if invalid); deangularjs does not
- **Import ratings controller**: Experimental maps `'csv'` format to `'hash'`; deangularjs does not
- **Import ratings controller**: Experimental uses safe navigation (`&.dig`, `&.each`) for RRE parsing; deangularjs uses direct access (crashes on nil)
- **Import ratings controller**: Experimental uses `filter_map` for LTR parsing to skip malformed lines; deangularjs crashes
- **Import ratings controller**: Experimental catches `StandardError`; deangularjs catches `Exception` (dangerous)
- **Snapshots controller**: Experimental validates `params[:snapshot][:name]` presence (returns 400); deangularjs does not
- **Snapshots controller**: Experimental supports `try_number` parameter for try selection; deangularjs always uses first try
- **Tries controller**: Experimental supports `curator_vars` update in PUT (destroys and recreates); deangularjs does not

### Error Handling Differences

- **Clone cases**: Experimental returns `{ error: "Clone failed" }` with 400; deangularjs returns empty 400
- **Ratings destroy**: Experimental uses `@rating&.delete` (nil-safe); deangularjs calls `.delete` directly (crashes if nil)
- **Ratings destroy**: Experimental conditionally tracks analytics `if @rating`; deangularjs always tracks (crashes if nil)
- **FetchService ES docs**: Experimental sets both `doc[:id]` and `doc[:_id]`; deangularjs only sets `doc[:_id]`
- **Users update**: Experimental checks `@user == current_user` (returns 403 if not); deangularjs has no authorization

### Security Improvements (Experimental Only)

- **Snapshot serialization**: JSON instead of `Marshal.load` (prevents arbitrary code execution)
- **URL validation**: SSRF protection blocking private IP ranges (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
- **User update authorization**: Prevents users from modifying other users' profiles
- **CSV injection protection**: `csv_cell` prepends space to values starting with `=`, `@`, `+`, `-`
- **Error handling**: `StandardError` instead of `Exception` in import controller

### Turbo Stream Additions (Experimental Only)

- **Annotations create**: Turbo Stream prepend to `annotations_list`
- **Ratings update/destroy**: Turbo Stream update targeting `rating_badge_id`
- **Run evaluation job**: Broadcasts Turbo Stream replace for `qscore-case-{id}` and `query_list_{id}`
- **Export job**: Broadcasts progress/complete/error notifications
- **Import job**: Broadcasts progress/complete/error notifications
- **Query create**: Turbo Stream append to query list
- **Query destroy**: Turbo Stream remove from query list

### New Services/Jobs (Experimental Only)

| File | Purpose |
|------|---------|
| `app/services/query_search_service.rb` | Server-side search execution (Solr/ES/OS/Vectara/Algolia/SearchAPI) |
| `app/services/query_score_service.rb` | Lightweight per-query scoring without full re-evaluation |
| `app/services/export_case_service.rb` | CSV generation for general/detailed/snapshot exports |
| `app/jobs/create_snapshot_from_search_job.rb` | Server-side snapshot creation (fetches from search engine) |
| `app/jobs/export_case_job.rb` | Async case export with ActiveStorage attachment |
| `app/jobs/import_case_ratings_job.rb` | Async rating import for large files |
| `app/models/case_import.rb` | Tracks async import status |
| `app/controllers/api/v1/queries/scores_controller.rb` | Lightweight scoring endpoint |
| `app/controllers/api/v1/search_endpoints/validations_controller.rb` | URL validation with SSRF protection |
| `app/controllers/api/v1/tries/queries/search_controller.rb` | Server-side search execution endpoint |
| `app/controllers/core/exports_controller.rb` | Async export trigger + download |
| `app/controllers/core/imports_controller.rb` | Async import for ratings and information needs |
| `app/controllers/core/queries_controller.rb` | Turbo Stream query CRUD |
| `app/controllers/core/queries/notes_controller.rb` | Turbo Frame notes update |
| `app/controllers/api/v1/search_endpoints/fields_controller.rb` | Field name autocomplete from search engine schema |
| `app/components/unarchive_case_component.rb` | Unarchive case modal for workspace |

### Model Differences

- **Case model**: Experimental adds `has_many :case_imports`, `has_one_attached :export_file`, `after_destroy :purge_export_file`, and `last_score` method using explicit `order().first` query. Deangularjs uses `scores.last_one` scope which may return an `AssociationRelation` instead of a single record.
- **Try model**: Experimental adds `image_prefix_from_field_spec` method that parses field_spec JSON for image/thumb/media type prefixes.
- **Case schema**: Experimental includes `export_job` column.

---

## CSS & Styling Differences

### Bootstrap Version

- **deangularjs**: Bootstrap 3.3.6 (`bootstrap3.css`, 6,722 lines)
- **experimental**: Bootstrap 5 via npm (`node_modules/bootstrap/dist/css/bootstrap.css`)

### Custom Stylesheet

- **deangularjs**: `bootstrap3-add.css` (1,159 lines)
- **experimental**: `bootstrap5-add.css` + `core-add.css` (combined similar line count)

### Key CSS Differences

| Area | deangularjs | experimental |
|------|-------------|--------------|
| Button default | Bootstrap 3 `.btn-default` | `.btn-default` polyfill mapped to BS5 styling |
| Navbar | `.navbar-inverse .navbar-secondary` (BS3 gradient) | Bootstrap 5 navbar classes |
| Grid | BS3 `col-md-*` classes | BS5 `col-*` classes |
| Icons | `.glyphicon-left` / `.glyphicon-right` | `.bi-left` / `.bi-right` (Bootstrap Icons) |
| Modals | BS3 `$uibModal` | BS5 `bootstrap.Modal` |
| Dropdowns | BS3 `uib-dropdown` | BS5 dropdown |
| Popovers | BS3 `uib-popover` | BS5 `bootstrap.Popover` |
| Cursor grab | Not available | `.cursor-grab` / `.cursor-grab:active` |
| Turbo loading | Not available | `.turbo-loading` opacity/pointer-events rules |
| Panel system | jQuery-based `paneSvc` | CSS collapsible `.workspace-east-panel` / `.workspace-west-panel` |
| Resizer | jQuery drag handlers | `workspace_resizer_controller.js` |
| Qscore selectors | `qscore-case` (element) | Both `qscore-case` (element) and `.qscore-case` (class) |
| Qgraph selectors | `qgraph` (element) | Both `qgraph` (element) and `.qgraph-wrapper` (class) |
| ACE editor styles | `.ace_editor` height rules | Not needed (uses CodeMirror) |
| Shepherd tour | `tether-shepherd` CSS included | Not included (uses Bootstrap popovers) |
| Diff layout | Via Angular directive CSS | `.diff-comparison` section in `core-add.css` |

---

## Items Unique to deangularjs-experimental (Enhancements)

1. **Server-side search execution** (`QuerySearchService`) -- eliminates CORS/mixed-content issues
2. **Server-side snapshot creation** (`CreateSnapshotFromSearchJob`) -- no client payload needed
3. **Async export** (`ExportCaseJob` + `ExportCaseService`) -- background CSV generation
4. **Async import** (`ImportCaseRatingsJob` + `CaseImport`) -- background processing for large files
5. **SSRF protection** (`ValidationsController`) -- blocks private IP ranges in URL validation
6. **Marshal.load elimination** -- JSON serialization for snapshots (security fix)
7. **User update authorization** -- prevents unauthorized profile modification
8. **Scorer testing endpoint** (`ScorerController#test`) -- server-side scorer validation
9. **Lightweight per-query scoring** (`QueryScoreService`) -- fast score refresh without full re-eval
10. **Turbo Stream live updates** -- real-time UI updates from background jobs
11. **CSV injection protection** -- prepends space to formula-like cell values
12. **Pagination support in FetchService** -- `rows`/`start`/`from` parameters
13. **Query text override in search** -- enables DocFinder server-side search
14. **Expand all queries** -- new feature not in Angular
15. **Confetti controller** -- celebration effect
16. **`has_one_attached :export_file`** -- ActiveStorage for async exports
17. **View raw document source** -- dedicated endpoint for raw search engine response
18. **Defensive error handling** -- nil-safe operations, `StandardError` instead of `Exception`
19. **Lazy-loading turbo-frames** -- for book summaries on home page

---

## Items Unique to deangularjs (Potential Gaps)

All 22 items that were originally unique to the Angular branch have been resolved in the experimental branch. For the full list and resolution notes, see [archives/deangularjs_experimental_functionality_gaps_complete.md](archives/deangularjs_experimental_functionality_gaps_complete.md#parity-audit-completed-items).

---

## Recommendations

All high-, medium-, and low-priority recommendations from the parity audit have been completed. Resolution details are in [archives/deangularjs_experimental_functionality_gaps_complete.md](archives/deangularjs_experimental_functionality_gaps_complete.md#parity-audit-recommendations-completed).


## Executive Summary

This document provides an exhaustive parity comparison between the `deangularjs` branch (Angular 1 SPA) and the `deangularjs-experimental` branch (Stimulus/ViewComponents/Turbo). The audit covers every feature, behavioral difference, and backend change between the two branches.

**Overall finding**: The experimental branch achieves functional parity with the Angular branch for all core workspace features. It goes beyond parity in several areas (server-side search execution, async export/import, SSRF protection, Turbo Stream live updates, scorer testing). A small number of Angular micro-features have behavioral differences in their Stimulus equivalents, detailed below.

**Update (2026-02-19)**: Parity audit refreshed for current codebase. All 22 parity gaps are resolved. Completed items and resolution details are recorded in [archives/deangularjs_experimental_functionality_gaps_complete.md](archives/deangularjs_experimental_functionality_gaps_complete.md).

**Status Legend**: ✅ = 100% parity | 🚀 = enhanced beyond Angular | ⚠️ = general parity (functional but different) | ❌ = lacking in experimental branch

The experimental branch contains **60 Stimulus controllers**, **37 ViewComponents**, and **14 new backend files** (controllers, services, jobs, models) that have no equivalent in the Angular branch. The Angular branch contains **28 controllers**, **26+ services/factories**, **23 components/directives**, and relies on client-side search execution via the splainer-search library.

---

## Branch Architecture

### deangularjs (Angular 1 SPA)

- **Layout**: `core.html.erb` loads Angular via `ng-app="QuepidApp"` with four JS bundles (jquery_bundle, angular_app, angular_templates, quepid_angular_app)
- **Routing**: Angular's `ngRoute` handles client-side routing between `/case/:caseNo/try/:tryNo` and `/404`
- **State management**: Angular services (`caseSvc`, `queriesSvc`, `settingsSvc`, etc.) maintain client-side state with `$watch`, `$broadcast`, and `$on` event patterns
- **Search execution**: Client-side via the `splainer-search` library (Solr, ES, OS, Vectara, Algolia, SearchAPI, Static). The browser directly queries the search engine
- **UI components**: 23+ Angular components/directives with `$uibModal` for modals, `ui-sortable` for drag-and-drop, ACE editor for code/JSON editing
- **CSS**: Bootstrap 3.3.6 with `bootstrap3-add.css` (1,159 lines of custom styles)
- **Dependencies**: D3, Vega, ACE, Shepherd.js (tours), angular-wizard, angular-ui-bootstrap, splainer-search, FileSaver.js, ngclipboard

### deangularjs-experimental (Stimulus + ViewComponents + Turbo)

- **Layout**: `core_modern.html.erb` with `data-controller="workspace"`, `data-quepid-root-url`, and `javascript_importmap_tags`
- **Routing**: Server-side via `CoreController#show` rendering the workspace; Rails routes handle navigation
- **State management**: Stimulus controllers with `values` and `targets`; Turbo Streams for live updates from background jobs
- **Search execution**: Server-side via `QuerySearchService` and `FetchService`. The server queries the search engine and returns rendered HTML (DocumentCardComponent) or JSON
- **UI components**: 36 ViewComponents with Bootstrap 5 modals, SortableJS for drag-and-drop, CodeMirror for code editing
- **CSS**: Bootstrap 5 via npm with `bootstrap5-add.css` + `core-add.css`
- **Dependencies**: D3 (importmap), SortableJS, Bootstrap 5, no Angular, no splainer-search, no ACE, no Vega (replaced by D3 charts), no Shepherd (replaced by Bootstrap popovers)

# Per-Component Migration Checklist

Apply the template from [angular_to_stimulus_hotwire_viewcomponents_checklist.md](angular_to_stimulus_hotwire_viewcomponents_checklist.md) (Phase 4.2) to each component below.

**Status:** All components have been migrated to ViewComponents + Stimulus controllers as of the `deangularjs-experimental` branch. Angular is fully removed from the codebase.

## 1. action_icon — [x] Migrated
**ViewComponent:** `ActionIconComponent` | **Stimulus:** (static UI, no controller needed)

## 2. add_query — [x] Migrated
**ViewComponent:** `AddQueryComponent` | **Stimulus:** `add_query_controller.js`

## 3. clone_case — [x] Migrated
**ViewComponent:** `CloneCaseComponent` | **Stimulus:** `clone_case_controller.js`

## 4. export_case — [x] Migrated
**ViewComponent:** `ExportCaseComponent` | **Stimulus:** `export_case_controller.js`

## 5. delete_case — [x] Migrated
**ViewComponent:** `DeleteCaseComponent` | **Stimulus:** `delete_case_controller.js`

## 6. delete_case_options — [x] Migrated
**ViewComponent:** `DeleteCaseOptionsComponent` | **Stimulus:** `delete_case_options_controller.js`

## 7. share_case — [x] Migrated
**ViewComponent:** `ShareCaseComponent` | **Stimulus:** `share_case_controller.js`

## 8. new_case — [x] Migrated
**ViewComponent:** `NewCaseComponent` | **Stimulus:** (static form, no controller needed)

## 9. move_query — [x] Migrated
**ViewComponent:** `MoveQueryComponent` | **Stimulus:** `move_query_controller.js`

## 10. query_options — [x] Migrated
**ViewComponent:** `QueryOptionsComponent` | **Stimulus:** `query_options_controller.js`

## 10a. delete_query — [x] Migrated
**ViewComponent:** `DeleteQueryComponent` | **Stimulus:** `delete_query_controller.js`

## 11. import_ratings — [x] Migrated
**ViewComponent:** `ImportRatingsComponent` | **Stimulus:** `import_ratings_controller.js`

## 12. judgements — [x] Migrated
**ViewComponent:** `JudgementsComponent` | **Stimulus:** `judgements_controller.js`

## 13. diff — [x] Migrated
**ViewComponent:** `DiffComponent` | **Stimulus:** `diff_controller.js`

## 13a. take_snapshot — [x] Migrated
**ViewComponent:** `TakeSnapshotComponent` | **Stimulus:** `take_snapshot_controller.js`

## 13b. custom_headers — [x] Migrated
**ViewComponent:** `CustomHeadersComponent` | **Stimulus:** `custom_headers_controller.js`

## 14. expand_content — [x] Migrated
**ViewComponent:** `ExpandContentComponent` | **Stimulus:** `expand_content_controller.js`

## 15. query_explain — [x] Migrated
**ViewComponent:** `QueryExplainComponent` | **Stimulus:** `query_explain_controller.js`

## 16. debug_matches — [x] Migrated
**ViewComponent:** `MatchesComponent` (renamed from `debug_matches`) | **Stimulus:** `matches_controller.js`

## 17. frog_report — [x] Migrated
**ViewComponent:** `FrogReportComponent` | **Stimulus:** `frog_report_controller.js`

## 18. annotation — [x] Migrated
**ViewComponent:** `AnnotationComponent` | **Stimulus:** `annotations_controller.js` (shared)

## 19. annotations — [x] Migrated
**ViewComponent:** `AnnotationsComponent` | **Stimulus:** `annotations_controller.js`

## 20. qscore_case — [x] Migrated
**ViewComponent:** `QscoreCaseComponent` | **Stimulus:** `qscore_controller.js` (shared)

## 21. qscore_query — [x] Migrated
**ViewComponent:** `QscoreQueryComponent` | **Stimulus:** `qscore_controller.js` (shared)

## 22. qgraph — [x] Migrated
**ViewComponent:** `QgraphComponent` | **Stimulus:** `qgraph_controller.js`

## 23. matches — [x] Migrated
**ViewComponent:** `MatchesComponent` | **Stimulus:** `matches_controller.js`

## 24. query_list (composite) — [x] Migrated
**ViewComponent:** `QueryListComponent` | **Stimulus:** `query_list_controller.js`

## 25. results_pane (composite) — [x] Migrated
**ViewComponent:** `ResultsPaneComponent` | **Stimulus:** `results_pane_controller.js`

---

## Additional Components (not in original Angular)

These ViewComponents were added during migration and don't have Angular equivalents:

- **ChartPanelComponent** + `chart_panel_controller.js` — D3 score chart panel
- **ScorerPanelComponent** + `scorer_panel_controller.js` — Scorer selection panel
- **SettingsPanelComponent** + `settings_panel_controller.js` — Settings/try configuration panel
- **QueryParamsPanelComponent** + `query_params_panel_controller.js` — Query params display
- **DocumentCardComponent** — Individual document card rendering
- **DocFinderComponent** + `doc_finder_controller.js` — Find and rate missing documents
- **NewCaseWizardComponent** + `new_case_wizard_controller.js` — Guided case creation flow
- **QscoreColorable** — Shared module for score-to-color mapping

# Code Review: Angular Removal

**Date:** Feb 17, 2026
**Updated:** Feb 19, 2026 — Angular is now fully removed from the codebase. Tour and New Case Wizard have been migrated.

---

## Completed: Admin Scorer Editing (2026-02-19)

All functionality for managing communal scorers has been completed and moved from `admin_scorer_editing.md`:

- ✅ View all communal scorers - All users can view communal scorers in the scorers list at `/scorers` with "Communal" filter button
- ✅ Edit communal scorers (admin only) - Administrators can edit name, code, scale, and scale labels of communal scorers
- ✅ Delete communal scorers (admin only) - Administrators can delete communal scorers from the edit page
- ✅ Clone communal scorers (all users) - All users can clone communal scorers to create custom versions
- ✅ Test communal scorers (admin only) - Administrators can test communal scorers using `POST /scorers/:id/test`
- ✅ Search/filter communal scorers - Filter functionality available in scorers list
- ✅ Warning messages when editing communal scorers - Alert displayed when editing communal scorers

**Implementation details:**
- `ScorersController` uses `set_scorer` method to control access (admins can access all scorers, regular users only custom scorers)
- Authorization checks in `update`, `destroy`, and `test` methods prevent non-admins from modifying communal scorers
- Warning alert displayed in edit view when administrator edits a communal scorer
- Previous separate admin interface (`/admin/communal_scorers`) was removed and unified into main scorers UI

**Related files:**
- `app/controllers/scorers_controller.rb` - Controller with admin checks
- `app/views/scorers/edit.html.erb` - Edit view with warning alert
- `app/views/scorers/_list.html.erb` - List view with conditional admin actions
- `test/controllers/scorers_controller_test.rb` - Comprehensive test coverage

---

## Completed: Angular to Stimulus Migration Checklist (2026-02-19)

Migration is complete. All Angular code has been removed. 37 ViewComponents and 60 Stimulus controllers are in production.

### Phase 3: ViewComponent Patterns — ✅ Complete

The following components are wired into the core try page:
- QueryListComponent — renders per query row with QscoreQuery, MoveQuery, QueryOptions, QueryExplain, DeleteQuery
- ResultsPaneComponent — shows selected query context, query notes, and search results
- AnnotationsComponent — case-level annotations panel
- FrogReportComponent — rating stats
- DiffComponent — snapshot diff
- MatchesComponent — document cards in results pane
- AnnotationComponent — single-annotation edit within annotations list

### Phase 4: Component-by-Component Migration — ✅ Complete

All 25 original Angular components plus 12 new components have been migrated (37 ViewComponents total). See the "Components Fully Migrated" section above for the complete list.

**Migration pattern applied:**
- Angular Component → ViewComponent + Stimulus Controller
- Template (.html) → ViewComponent template (.html.erb)
- Service ($http) → Rails controller action or apiFetch()
- $scope / bindings → data-* attributes, Turbo Frame
- ng-click → data-action="click->controller#method"
- ng-if / ng-show → Server-rendered or Stimulus toggle

---

## 1. ✅ Migrated: Tour Functionality

**Files:** `app/javascript/modules/tour_steps.js`, `app/javascript/controllers/tour_controller.js`, `app/assets/stylesheets/tour.css` (in use)

**Status:** The Shepherd tour has been fully migrated to Stimulus using Bootstrap popovers. The tour controller (`tour_controller.js`) implements a 9-step guided tour matching the original Angular/Shepherd.js structure. The tour is triggered via `?startTour=true` URL param (set by the wizard after completion) or manually.

**Implementation:** 
- `tour_controller.js`: Stimulus controller managing tour state, navigation, and Bootstrap popover display
- `tour_steps.js`: Step definitions targeting modern workspace DOM elements
- `tour.css`: Styles for overlay and highlight effects (actively used)

**Usage:** The tour is attached to the workspace via `data-controller="tour"` in `app/views/core/show.html.erb`.

---

## 2. ✅ Migrated: New Case Wizard

**Files:** `app/components/new_case_wizard_component.rb`, `app/javascript/controllers/new_case_wizard_controller.js`, `app/views/core/show.html.erb`

**Status:** The Angular `WizardModalCtrl` / `WizardCtrl` has been fully replaced with a Stimulus-based wizard modal. The wizard guides users through a 4-step setup: welcome, search endpoint selection, field spec configuration, and first query.

**Implementation:**
- `NewCaseWizardComponent`: ViewComponent rendering the wizard modal
- `new_case_wizard_controller.js`: Stimulus controller managing wizard state and step navigation
- Rendered in `app/views/core/show.html.erb` when `showWizard=true` or for first-time users

**Usage:** `CoreController#new` redirects with `showWizard=true`, and the wizard is automatically displayed. The wizard can also auto-show for users who haven't completed it (`!current_user.completed_case_wizard && current_user.cases_involved_with.count <= 1`).

---

## 3. Low: Orphaned Files

**Files:** `app/assets/javascripts/mode-json.js`

Only one orphaned file remains in `app/assets/javascripts/` — all Angular services, factories, components, controllers, and templates have been deleted. `scorerEvalTest.js` has been removed.

| File | Purpose | Referenced by | Modern equivalent | Recommendation |
|------|---------|---------------|-------------------|----------------|
| **mode-json.js** | ACE editor JSON syntax highlighting mode | `lib/jshint/lint.rb` (line 72, skip list only) | **CodeMirror 6** (`app/javascript/modules/editor.js`) is actively used throughout the modern stack. CodeMirror is initialized globally in `application_modern.js` and used via `data-codemirror-mode` attributes in views (e.g., `mapper_wizards/show.html.erb`, `settings_panel_component.html.erb`, `results_pane_component.html.erb`). | **Remove.** ACE editor is completely unused — no ACE initialization or `ace.require()` calls exist. The lint skip reference at line 72 of `lib/jshint/lint.rb` should also be removed. |
| ~~**scorerEvalTest.js**~~ | ~~Scorer evaluation test utility~~ | ~~N/A~~ | `scorer_test_controller.js` + server-side `JavascriptScorer` | ✅ **Removed.** File deleted; comment in `scorer_test_controller.js` updated. |

---

## 4. Functionality from Deleted Angular Code — Migration Status

| Functionality | Deleted Source | Modern Status | Notes |
|---------------|----------------|---------------|-------|
| **Tour (onboarding)** | `tour.js` | ✅ Migrated | Stimulus `tour_controller.js` + Bootstrap popovers. 9-step tour matching original structure. `tour.css` actively used. |
| **New Case Wizard** | Angular `WizardModalCtrl` / `WizardCtrl` | ✅ Migrated | `NewCaseWizardComponent` + `new_case_wizard_controller.js`. 4-step guided setup flow. |
| **Full Angular app** | `app/assets/javascripts/` | ✅ Fully removed | Only `mode-json.js` remains as an orphaned file (safe to delete). |
| **Case listing** | Angular `casesCtrl.js` + components | ✅ Migrated | `cases_controller.rb` + `app/views/cases/index.html.erb` |
| **Teams** | Angular `teamsCtrl.js` + components | ✅ Migrated | `teams_controller.rb` + `app/views/teams/` |
| **Scorers** | Angular `scorersCtrl.js` + components | ✅ Migrated | `scorers_controller.rb` + `app/views/scorers/` |
| **Core workspace** | Angular directives + controllers | ✅ Migrated | 36+ ViewComponents + 50+ Stimulus controllers |

## 4. Regressions / Lost Functionality

### 4.2 TODOs / Incomplete Behavior

| Location | Note |
|----------|------|
| `app/services/query_search_service.rb` (line 76) | `# TODO: add extraction when supported` — **FIXED**: Implemented Vectara and Algolia doc extraction in FetchService and wired into QuerySearchService. |

---

## 5. Inconsistencies

### 5.2 Navigation After Background Job

| Location | Issue |
|----------|--------|
| `app/javascript/controllers/judgements_controller.js` (line 260) | After "refresh ratings" in background: `window.location.href = buildPageUrl(root)` navigates to root URL. **Verified as intended behavior** — navigation to root after background job completion is correct. |

---

## 6. Documentation and Comments

| Location | Recommendation |
|----------|----------------|
| `app/controllers/core_controller.rb` (lines 62–78) | Add a short comment on `populate_from_params` and the search endpoint / try update logic (params like `searchEngine`, `searchUrl`, `apiMethod`, `basicAuthCredential`, `fieldSpec`) and where they are used. |
| `app/controllers/concerns/authentication/current_case_manager.rb` (lines 21–31) | Add a one-line comment on the fallback: e.g. "try public case if not found in involved_with." |

---

## 7. Test Coverage (Critical Paths) — FIXED

- **Cases (API):** Archive/unarchive and team-member permissions are tested in `test/controllers/api/v1/cases_controller_test.rb`.
- **Rails `CasesController` (HTML archive/unarchive):** **FIXED** — Tests exist in `test/controllers/cases_controller_test.rb` that verify authorization for archive/unarchive actions, preventing access to cases the user doesn't have access to.
- **TeamsController:** **FIXED** — Tests exist in `test/controllers/teams_controller_test.rb` that assert non-members cannot access teams they're not part of.
- **QueryDocPairsController:** **FIXED** — Tests exist in `test/controllers/query_doc_pairs_controller_test.rb` that assert users cannot access query_doc_pairs from different books via URL manipulation.

---

## 9. Recommendations (Priority)

### Low — MOSTLY DONE

8. **Resolve or document TODOs** — QuerySearchService Vectara/Algolia extraction **FIXED**. FetchService (line 285) and import ratings controller (line 78) TODOs remain open.

---

## Gap 1: Detailed Document View / Full Field Explorer

**Status:** ✅ **COMPLETE** — See [archives/port_completed.md](archives/port_completed.md#completed-gap-implementations-2026-02-19).

### Recommendations

- Add an integration test that clicks the Details button and verifies modal content renders.

---

## Gap 2: Try History Browser + Try Management

**Status:** ✅ **COMPLETE** — See [archives/port_completed.md](archives/port_completed.md#completed-gap-implementations-2026-02-19).

### Recommendations

- Keep existing guard and truncation behavior covered by tests.

---

## Gap 3: Curator Variables / Tuning Knobs

**Status:** ✅ **COMPLETE** — See [archives/port_completed.md](archives/port_completed.md#completed-gap-implementations-2026-02-19).

### Concerns

1. **`innerHTML` with user-controlled content** — `_renderCuratorVarInputs()` in `settings_panel_controller.js` builds HTML via string interpolation with `_escapeHtmlAttr(name)` and `_escapeHtmlAttr(value)`. Values go into `value="..."` attributes; ensure `_escapeHtmlAttr` covers all necessary characters (e.g. `"`, `<`, `&`). Prefer DOM API or a shared safe-builder for defense-in-depth.

### Recommendations

- Switch `_renderCuratorVarInputs()` to DOM API (`document.createElement`) instead of innerHTML where practical.

---

## Gap 4: New Case Setup Wizard (Enhanced)

**Status:** ✅ **COMPLETE** — See [archives/port_completed.md](archives/port_completed.md#completed-gap-implementations-2026-02-19).

### Concerns

- **`_markWizardComplete` updates user profile** — Sends `{ user: { completed_case_wizard: true } }` to the users API. This is a per-user flag; once set, the wizard does not show again for new cases. Consider per-case or conditional display based on try configuration.

### Recommendations

- Reconsider the per-user `completed_case_wizard` flag — e.g. per-case or show wizard when try has no configured endpoint.


# Angular to Stimulus, Hotwire, and ViewComponents Migration Checklist

**Status:** Migration is **complete**. All Angular code has been removed. 37 ViewComponents and 60 Stimulus controllers are in production. See [../archives/deangularjs_experimental_functionality_gaps_complete.md](../archives/deangularjs_experimental_functionality_gaps_complete.md) for the full component inventory and parity record.

## Phase 3: ViewComponent Patterns — ✅ Complete

> **Note:** Completed implementation details have been moved to [archives/port_completed.md](archives/port_completed.md#completed-angular-to-stimulus-migration-checklist-2026-02-19).

### 3.3 Components wired into workspace

The following components are **wired** into the core try page:

- **QueryListComponent** — renders per query row: QscoreQuery, MoveQuery, QueryOptions, QueryExplain, DeleteQuery. Selection via `?query_id=`; sortable when `Rails.application.config.query_list_sortable` is true.
- **ResultsPaneComponent** — shows selected query context, query notes (information need), and placeholder for search results.
- **AnnotationsComponent** — case-level annotations panel; rendered in core/show.
- **FrogReportComponent** — rating stats; rendered in core/show toolbar.
- **DiffComponent** — snapshot diff; rendered in core/show toolbar.

- **MatchesComponent** — document cards in results pane; wired via DocumentCardComponent and search API HTML format.
- **AnnotationComponent** — single-annotation edit within annotations list; wired in AnnotationsComponent; create returns Turbo Stream with AnnotationComponent.

---

## Phase 4: Component-by-Component Migration — ✅ Complete

> **Note:** Completed implementation details have been moved to [archives/port_completed.md](archives/port_completed.md#completed-angular-to-stimulus-migration-checklist-2026-02-19).

All 25 original Angular components plus 12 new components have been migrated (37 ViewComponents total). See [../archives/deangularjs_experimental_functionality_gaps_complete.md](../archives/deangularjs_experimental_functionality_gaps_complete.md) for the full list with ViewComponent and Stimulus controller mappings.

### 4.2 Per-Component Checklist Template (reference)

**Template (apply per component):**

- [ ] **Analyze Angular implementation**
  - [ ] Read directive, controller, templates
  - [ ] List all service dependencies
  - [ ] List all API calls
  - [ ] List all DOM events and user interactions

- [ ] **Design replacement** (Option A: server-centric)
  - [ ] ViewComponent: what markup? what props?
  - [ ] Stimulus: what actions? what minimal UI state? (prefer server over client)
  - [ ] Turbo Frame: is this region dynamically updated? (prefer yes for Option A)
  - [ ] Server: new controller action? or use existing API? (prefer server-rendered responses)

- [ ] **Implement**
  - [ ] Create ViewComponent
  - [ ] Create Stimulus controller (if needed)
  - [ ] Create/update Rails view or partial
  - [ ] Wire up `data-controller` and `data-action`
  - [ ] Ensure URLs use `getQuepidRootUrl()` or Rails helpers — see [api_client.md](api_client.md)

- [ ] **Test**
  - [ ] Manual verification
  - [ ] E2E test if critical path
  - [ ] Unit test for ViewComponent (optional)

## Phase 9: Quality & Polish — In Progress

### 9.1 Accessibility

- [ ] **Keyboard navigation** — ensure modals, lists, buttons are keyboard-accessible
- [ ] **ARIA attributes** — modals, live regions for score updates (see [gap_implementation_review.md](gap_implementation_review.md) for specific gaps)
- [ ] **Focus management** — modal open/close, Turbo Frame updates
- [ ] **Screen reader announcements** — step navigation, score changes, rating updates

### 9.2 Performance

- [x] **Minimize JS** — Stimulus controllers are small and focused
- [x] **Asset size** — verified no duplicate libraries (Bootstrap 5 once, Angular removed)
- [ ] **Scorer instantiation optimization** — consider caching `JavascriptScorer` instances per-request (see [gap_implementation_review.md](gap_implementation_review.md))

### 9.3 Security

- [ ] **XSS prevention** — review `innerHTML` usage patterns, prefer DOM API or templates (see [gap_implementation_review.md](gap_implementation_review.md))
- [x] **CSRF protection** — `apiFetch` wrapper adds CSRF token automatically
- [x] **URL generation** — all URLs use `getQuepidRootUrl()` or Rails helpers (see [api_client.md](api_client.md))

### 9.4 Testing

- [ ] **JavaScript tests** — add Vitest tests for Stimulus controllers (see [gap_implementation_review.md](gap_implementation_review.md))
- [x] **Rails controller tests** — comprehensive coverage for scorers, teams, cases
- [ ] **Integration tests** — add system tests for wizard flows, detail modals

---

## Quick Reference: Migration Pattern

```
Angular Component          →    Rails Replacement
─────────────────────────────────────────────────────────
Directive + Controller     →    ViewComponent + Stimulus
Template (.html)           →    ViewComponent template (.html.erb)
Modal template             →    Shared partial or ModalComponent
Service ($http)            →    Rails controller action or apiFetch()
$scope / bindings          →    data-* attributes, Turbo Frame
ng-click                   →    data-action="click->controller#method"
ng-if / ng-show            →    Server-rendered or Stimulus toggle
```

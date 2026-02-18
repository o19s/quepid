# Deangularjs Branch Parity Audit

## Executive Summary

This document provides an exhaustive parity comparison between the `deangularjs` branch (Angular 1 SPA) and the `deangularjs-experimental` branch (Stimulus/ViewComponents/Turbo). The audit covers every feature, behavioral difference, and backend change between the two branches.

**Overall finding**: The experimental branch achieves functional parity with the Angular branch for all core workspace features. It goes beyond parity in several areas (server-side search execution, async export/import, SSRF protection, Turbo Stream live updates, scorer testing). A small number of Angular micro-features have behavioral differences in their Stimulus equivalents, detailed below.

**Update (2026-02-18)**: Eight parity gaps have been resolved (✅): query sort by modified date/error state, media embeds, Solr param typo detection, rating scale labels, depth indicator, browse on search engine link, URL color bucketing in try history, and Vega chart (D3 equivalent). Five items have general/partial parity (⚠️): batch scoring progress, debug matches modal, JSON explorer, SearchAPI mapper link, multiple wizard queries. Eight items remain unimplemented (❌): query pagination, animated count-up, ES template call warning, field autocomplete, TMDB demo defaults, static data upload, unarchive from workspace, auto-grow input.

**Status Legend**: ✅ = 100% parity | 🚀 = enhanced beyond Angular | ⚠️ = general parity (functional but different) | ❌ = lacking in experimental branch

The experimental branch contains **58 Stimulus controllers**, **36 ViewComponents**, and **14 new backend files** (controllers, services, jobs, models) that have no equivalent in the Angular branch. The Angular branch contains **28 controllers**, **26+ services/factories**, **23 components/directives**, and relies on client-side search execution via the splainer-search library.

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
| Query pagination | `dir-paginate` with pageSize 15 | No pagination (all queries rendered) | ❌ PARTIAL | Experimental shows all queries; Angular paginates at 15. For large query sets this is a UX difference |
| Show only rated docs | `queriesSvc.toggleShowOnlyRated()` + checkbox | `results_pane_controller.js#toggleShowOnlyRated()` | ✅ COMPLETE | |
| Collapse all queries | `queryViewSvc.collapseAll()` | `query_list_controller.js#collapseAll()` | ✅ COMPLETE | |
| Expand all queries | Not in Angular (only collapse) | `query_list_controller.js#expandAll()` | 🚀 ENHANCED | Experimental adds expand-all |
| Query notes (info need + notes) | `QueryNotesCtrl` + `query.saveNotes()` | `core/queries/notes_controller.rb` + Turbo Frame | ✅ COMPLETE | Server-side save vs client-side |
| Query options (JSON editor) | `query_options` component + ACE editor | `query_options_controller.js` + `QueryOptionsComponent` | ✅ COMPLETE | CodeMirror vs ACE |
| Query explain (parsed query) | `query_explain` component + `<json-explorer>` | `query_explain_controller.js` + `QueryExplainComponent` | ✅ COMPLETE | JSON display in modal |
| Batch position / scoring progress | `$scope.batchPosition` / `$scope.batchSize` in `QueriesCtrl` | `RunCaseEvaluationJob` Turbo Stream broadcasts | ⚠️ PARTIAL | Shows "Queries Remaining: X" via Turbo Streams (countdown) instead of "N of M queries scored" (count-up) |

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
| Debug matches modal | `debug_matches` component + `<json-explorer>` | `MatchesComponent` debug modal with `<pre>` | ⚠️ PARTIAL | Debug modal exists but uses static `<pre>` instead of interactive JSON tree view |
| View document source (raw) | `$scope.openDocument()` in `DetailedDocCtrl` | `results_pane_controller.js#viewSource()` | ✅ COMPLETE | Server-side raw endpoint |
| Link to document (with auth) | `$scope.linkToDoc()` with credential injection | Server-side URL construction | ✅ COMPLETE | |
| Number found display | `query.getNumFound()` with `<count-up>` animation | `_document_cards.html.erb` header | ❌ PARTIAL | No animated counter in experimental; static text display only |
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
| ES template call warning | `esUrlSvc.isTemplateCall()` check | Not implemented | ❌ MISSING | No `_search/template` detection or warning |

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
| Unarchive case | `UnarchiveCaseCtrl` + `unarchiveCaseModal.html` | Not in workspace (available from cases list) | ❌ PARTIAL | Unarchive not available from workspace modal; only on cases list page |
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
| New case wizard | `WizardModalCtrl` + `wizardModal.html` (6 steps) | `new_case_wizard_controller.js` + `NewCaseWizardComponent` (4 steps) | ⚠️ PARTIAL | Experimental has fewer steps (4 vs 6). Missing: search engine radio buttons with demo URLs, static data upload, SearchAPI mapper wizard, field autocomplete |
| Wizard auto-show for new users | `WizardCtrl` checks user state + case count | `showValue` on wizard component | ✅ COMPLETE | |
| URL-param wizard trigger | `$location.search().showWizard` | `showWizard` URL param | ✅ COMPLETE | |
| First-time welcome step | Step 1 with Doug greeting | Step 1 welcome | ✅ COMPLETE | |
| Search engine selection | Radio buttons (Solr/ES/OS/Vectara/Static/SearchAPI/Algolia) | Existing endpoint select + new endpoint form | ⚠️ PARTIAL | Simplified to endpoint selection; no per-engine demo URLs |
| URL validation in wizard | `SettingsValidatorFactory.validateUrl()` client-side | Not in wizard (handled in settings panel) | ❌ MISSING | No inline URL validation during wizard |
| Field autocomplete (typeahead) | `$scope.loadFields()` with modifier support (media:, thumb:, image:) | Not implemented in wizard | ❌ MISSING | No field autocomplete with modifier prefixes |
| Add queries step | Dynamic query list with dedup | Single "first query" text input | ⚠️ PARTIAL | Experimental allows one query; Angular allows multiple with dedup |
| Static data upload | CSV upload + `querySnapshotSvc.importSnapshotsToSpecificCase()` | Not in wizard | ❌ MISSING | Static search engine data upload step |
| SearchAPI mapper wizard link | `$scope.goToMapperWizard()` | Not in wizard | ⚠️ PARTIAL | Mapper wizard exists standalone but not linked from new case wizard |
| TMDB demo defaults | `settingsSvc.tmdbSettings` per engine | Not implemented | ❌ MISSING | No auto-populated demo settings |
| Guided tour (Shepherd.js) | `tour.js` with Shepherd.js (9 steps) | `tour_controller.js` with Bootstrap popovers | ⚠️ PARTIAL | Fewer steps, different UI (popovers vs Shepherd theme) |
| Tour auto-start after wizard | `setupAndStartTour` after 1500ms | `startTour` URL param after reload | ✅ COMPLETE | |

### 12. UI Utilities & Micro-features

| Feature | Angular Reference | Stimulus/VC Reference | Status | Notes |
|---------|------------------|----------------------|--------|-------|
| Clipboard copy | `ngclipboard` directive | `clipboard_controller.js` | ✅ COMPLETE | |
| Expand content modal | `expand_content` directive + full-screen modal | `expand_content_controller.js` + `ExpandContentComponent` | ✅ COMPLETE | |
| Auto-grow input | `autoGrow` directive (jQuery plugin) | CSS/standard inputs | ❌ MISSING | No auto-growing inputs for curator variables; uses fixed-height `<input>` |
| Timeago display | `yaru22.angular-timeago` | Rails `time_ago_in_words` helper | ✅ COMPLETE | Server-side rendering |
| Score display formatting | `scoreDisplay` filter (2 decimal places) | Ruby formatting in components | ✅ COMPLETE | |
| Search engine name mapping | `searchEngineName` filter | Ruby helper | ✅ COMPLETE | |
| Query state CSS class | `queryStateClass` filter | CSS classes on query rows | ✅ COMPLETE | |
| Count-up animation | `angular-countup` directive | Not implemented | ❌ MISSING | Animated number counter for results count |
| Vega charts (frog report) | `ngVega` + Vega v5 specification | `frog_report_controller.js` + D3 v7 bar chart | ✅ COMPLETE | D3 equivalent with full interactivity (hover, tooltips, labels) |
| JSON explorer | `ng-json-explorer` | `<pre>` with JSON.stringify | ⚠️ PARTIAL | Static `<pre>` tags only; no collapsible tree navigation |
| Confetti celebration | Not in Angular | `confetti_controller.js` | 🚀 ENHANCED | Added celebration effect |

---

## Detailed Behavioral Differences

### Query Sort Options — RESOLVED

**Angular**: Supports 5 sort modes -- default (manual), modified (by last modification date), query (alphabetical), score (by last score), error (by error state then all-rated). Each has a toggle for ascending/descending via `switchSortOrder()`.

**Stimulus**: Now supports 7 sort modes -- default, name, name_desc, score_asc, score_desc, modified, modified_desc, error. Query rows carry `data-query-modified` (unix timestamp) and `data-query-error` (boolean) attributes for client-side sorting.

**Status**: Parity achieved.

### Query Pagination

**Angular**: Uses `dir-paginate` with a page size of 15 queries per page, with pagination controls at the bottom.

**Stimulus**: Renders all queries in a single list with no pagination.

**Impact**: Cases with many queries (100+) may have slower initial render in experimental. However, the server-rendered approach means less client-side memory usage.

### New Case Wizard Steps

**Angular** (6 steps): Welcome -> Name -> Endpoint (with engine radio buttons, URL validation, static data upload, proxy/TLS config, mapper wizard link) -> Fields (with autocomplete, modifier support) -> Queries (add multiple, dedup) -> Finish

**Stimulus** (4 steps): Welcome -> Search Endpoint (select existing or create new) -> Field Display (text input) -> First Query (single query)

**Impact**: The experimental wizard is significantly simpler. Users setting up non-standard search engines (SearchAPI with mapper code, static file upload, Vectara/Algolia with custom headers) will need to configure these in the settings panel after case creation rather than during the wizard.

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

1. ~~**Media embeds** (`quepidEmbed` directive) -- audio/video/image URL detection and HTML5 player rendering~~ ✅ RESOLVED
2. ~~**Query sort by modified date** -- `'-modifiedAt'` sort option~~ ✅ RESOLVED
3. ~~**Query sort by error state** -- `['-errorText', 'allRated']` sort option~~ ✅ RESOLVED
4. **Query pagination** -- `dir-paginate` with 15 queries per page ❌ NOT IMPLEMENTED
5. **Batch scoring progress** -- "N of M queries scored" display ⚠️ PARTIAL — Experimental shows "Queries Remaining: X" via Turbo Streams (countdown format) instead of "N of M scored"
6. **Animated count-up** -- `angular-countup` for result count animation ❌ NOT IMPLEMENTED
7. ~~**URL color bucketing** -- visual grouping of tries by URL in history~~ ✅ RESOLVED
8. ~~**Solr param typo detection** -- warns about case-sensitive Solr parameters~~ ✅ RESOLVED
9. **ES template call warning** -- detects and warns about template queries ❌ NOT IMPLEMENTED
10. ~~**Rating scale labels** -- custom labels on rating buttons from scorer config~~ ✅ RESOLVED
11. ~~**Browse on Solr link** -- direct link to browse results on the search engine~~ ✅ RESOLVED
12. ~~**Depth of rating indicator** -- "Results above are counted in scoring" visual marker~~ ✅ RESOLVED
13. **Field autocomplete with modifiers** -- `media:`, `thumb:`, `image:` prefix support in wizard ❌ NOT IMPLEMENTED
14. **TMDB demo defaults** -- pre-configured settings for demo search engines ❌ NOT IMPLEMENTED
15. **Static data upload in wizard** -- CSV upload for static search engine type ❌ NOT IMPLEMENTED
16. **SearchAPI mapper wizard link** -- redirect to mapper creation ⚠️ PARTIAL — Mapper wizard exists as standalone (`mapper_wizard_controller.js`) but not linked from new case wizard
17. **Multiple queries in wizard** -- add multiple queries with deduplication ⚠️ PARTIAL — Wizard allows only one query; no semicolon parsing or deduplication
18. **Unarchive case from workspace** -- modal to restore archived cases ❌ NOT IMPLEMENTED — Only available from cases list page, not workspace
19. **Debug matches modal** -- dedicated JSON explorer for explain data ⚠️ PARTIAL — Debug modal exists in `MatchesComponent` but shows raw JSON in `<pre>` tag, no interactive tree view
20. ~~**Vega chart in frog report** -- distribution bar chart using Vega specification~~ ✅ RESOLVED — D3 v7 bar chart implemented in `frog_report_controller.js` with full interactivity (hover, tooltips, labels)
21. **ng-json-explorer** -- interactive JSON tree view (vs static `<pre>`) ⚠️ PARTIAL — All JSON display uses static `<pre>` tags; no collapsible tree navigation
22. **Auto-grow input** -- dynamic input width for curator variables ❌ NOT IMPLEMENTED — Uses standard fixed-height `<input>` elements

---

## Recommendations

### High Priority (Functional Gaps)

1. ~~**Add query sort by modified date and error state**~~ ✅ RESOLVED — Added `modified`, `modified_desc`, and `error` sort modes to `query_list_controller.js`.

2. ~~**Implement media embeds**~~ ✅ RESOLVED — Added `media_embeds` method to `DocumentCardComponent` with HTML5 audio/video/image rendering.

3. ⚠️ **Add batch scoring progress indicator** -- Show "Searching X of Y queries..." during initial load or evaluation. Currently shows "Queries Remaining: X" via Turbo Streams (countdown format) but not the Angular-style "N of M scored" (count-up format).

### Medium Priority (UX Polish)

4. ❌ **Add query pagination** -- For cases with 100+ queries, consider adding virtual scrolling or pagination to the query list to maintain performance.

5. ~~**Implement rating scale labels**~~ ✅ RESOLVED — Labels from `scale_with_labels` displayed in rating popovers and bulk rating bar.

6. ~~**Add depth indicator**~~ ✅ RESOLVED — Depth indicator shown below the Nth document card in `_document_cards.html.erb`.

7. ❌ **Enrich the new case wizard** -- Add search engine radio buttons with demo URLs (TMDB), URL validation within the wizard, field autocomplete with modifiers, and support for multiple queries in the final step.

8. ~~**Add Solr param typo detection**~~ ✅ RESOLVED — Added `_checkSolrParamTypos()` to `settings_panel_controller.js`.

9. ~~**Add URL color bucketing in try history**~~ ✅ RESOLVED — Added `url_color_for_try` to `SettingsPanelComponent` with 6-color palette.

### Low Priority (Nice to Have)

10. ~~**Add Browse on Solr link**~~ ✅ RESOLVED — Added `build_browse_url` to `SearchController` for Solr and ES/OS.

11. ⚠️ **Enhance debug matches modal** -- Debug modal exists in `MatchesComponent` with `<pre>` display. Upgrade to interactive JSON tree viewer for parity with Angular's `ng-json-explorer`.

12. ❌ **Add count-up animation** -- Use CSS counter animation or a lightweight library for the results count.

13. ❌ **Restore auto-grow behavior** -- Use CSS `ch` units or a resize observer for curator variable inputs.

14. ~~**Add Vega chart to frog report**~~ ✅ RESOLVED — D3 v7 bar chart implemented in `frog_report_controller.js` with full interactivity (hover, tooltips, labels).

15. ❌ **Port unarchive case modal** -- Add ability to unarchive cases from the workspace (currently only available from cases list page).

16. ❌ **Add ES template call warning** -- Detect `_search/template` in Elasticsearch URLs and warn users, matching Angular's `esUrlSvc.isTemplateCall()` behavior.

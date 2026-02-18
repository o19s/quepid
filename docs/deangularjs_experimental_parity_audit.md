# deangularjs-experimental vs deangularjs: Functional Parity Audit

> Generated: 2026-02-18
> Updated: 2026-02-18 — All P0 gaps resolved.
> Comparing `deangularjs-experimental` against `deangularjs` base branch.

## Executive Summary

The `deangularjs-experimental` branch replaces AngularJS with a server-rendered ViewComponent + Stimulus + Turbo architecture. It successfully ports the **structural scaffold** and **all core interactive features** of the workspace. All **P0 (critical) gaps have been resolved**. The most significant architectural change is the removal of `splainer-search` (the client-side search library) in favor of a server-side `QuerySearchService`, which simplifies the architecture while retaining feature parity for the core workflow. Remaining gaps are P1/P2 polish items.

---

## 1. Architecture Shift Overview

| Layer | `deangularjs` (Angular) | `deangularjs-experimental` (Modern) |
|---|---|---|
| **Search execution** | Client-side via `splainer-search` JS library (ES/Solr/OS/Vectara/Algolia) | Server-side via `QuerySearchService` → `FetchService` |
| **Routing** | Angular `ngRoute` (client-side SPA) | Rails routes → `core#show` (server-rendered) |
| **State management** | Angular services (`queriesSvc`, `caseSvc`, `settingsSvc`) as singletons | Server renders state; Stimulus for interaction |
| **Components** | Angular directives + templates | ViewComponents (`app/components/`) |
| **Interactivity** | Angular controllers + `$scope` | Stimulus controllers (`app/javascript/controllers/`) |
| **Real-time updates** | Angular `$rootScope.$broadcast` | Turbo Streams + CustomEvent dispatch |

---

## 2. Angular Components → ViewComponent Mapping

### Fully Ported (structural equivalent exists)

| Angular Component | ViewComponent | Notes |
|---|---|---|
| `add_query/` | `AddQueryComponent` | ✅ Stimulus `add_query_controller.js` |
| `annotation/` | `AnnotationComponent` | ✅ Stimulus `annotations_controller.js` |
| `annotations/` | `AnnotationsComponent` | ✅ |
| `clone_case/` | `CloneCaseComponent` | ✅ Stimulus `clone_case_controller.js` |
| `delete_case/` | `DeleteCaseComponent` | ✅ Stimulus `delete_case_controller.js` |
| `delete_case_options/` | `DeleteCaseOptionsComponent` | ✅ Stimulus `delete_case_options_controller.js` |
| `diff/` | `DiffComponent` | ✅ Stimulus `diff_controller.js` |
| `expand_content/` | `ExpandContentComponent` | ✅ Stimulus `expand_content_controller.js` |
| `export_case/` | `ExportCaseComponent` | ✅ Stimulus `export_case_controller.js` |
| `frog_report/` | `FrogReportComponent` | ✅ Stimulus `frog_report_controller.js` |
| `import_ratings/` | `ImportRatingsComponent` | ✅ Stimulus `import_ratings_controller.js` |
| `judgements/` | `JudgementsComponent` | ✅ Stimulus `judgements_controller.js` |
| `matches/` | `MatchesComponent` | ✅ Stimulus `matches_controller.js` |
| `move_query/` | `MoveQueryComponent` | ✅ Stimulus `move_query_controller.js` |
| `new_case/` | `NewCaseComponent` + `NewCaseWizardComponent` | ✅ Stimulus `new_case_wizard_controller.js` |
| `qgraph/` | `QgraphComponent` | ✅ Stimulus `qgraph_controller.js` |
| `qscore_case/` | `QscoreCaseComponent` | ✅ Stimulus `qscore_controller.js` |
| `qscore_query/` | `QscoreQueryComponent` | ✅ Stimulus `qscore_controller.js` |
| `query_explain/` | `QueryExplainComponent` | ✅ Stimulus `query_explain_controller.js` |
| `query_options/` | `QueryOptionsComponent` | ✅ Stimulus `query_options_controller.js` |
| `share_case/` | `ShareCaseComponent` | ✅ Stimulus `share_case_controller.js` |
| `action_icon/` | `ActionIconComponent` | ✅ Ruby-only (no JS needed) |

### New Components (no Angular equivalent)

| ViewComponent | Purpose |
|---|---|
| `ChartPanelComponent` | Sparkline/chart panel (extracted from Angular inline code) |
| `CustomHeadersComponent` | Custom headers UI (extracted from `CustomHeadersCtrl`) |
| `DeleteQueryComponent` | Per-query delete (was inline in `SearchResultsCtrl`) |
| `DocFinderComponent` | Document finder / targeted search |
| `DocumentCardComponent` | Server-rendered doc card (replaces client-side `searchResult` template) |
| `QueryListComponent` | Query list with filter/sort (replaces Angular `queriesCtrl` template) |
| `QueryParamsPanelComponent` | Try params editor (replaces `queryParams` + `currSettings` controllers) |
| `ResultsPaneComponent` | Results container (replaces Angular `searchResults` template area) |
| `ScorerPanelComponent` | Scorer picker/display (replaces `ScorerCtrl`) |
| `SettingsPanelComponent` | Settings panel (replaces `SettingsCtrl`) |
| `TakeSnapshotComponent` | Snapshot creation (replaces `PromptSnapshotCtrl`) |

---

## 3. Angular Controllers → Stimulus Controller Mapping

| Angular Controller | Stimulus Controller | Status |
|---|---|---|
| `MainCtrl` | `workspace_controller.js` | ⚠️ **Minimal** — only provides root URL. Missing: case bootstrapping, error handling, search engine change detection, pane management |
| `QueriesCtrl` | `query_list_controller.js` + `query_expand_controller.js` | ⚠️ **Partial** — has filter/sort/sortable, inline expand/collapse with 5-result preview. Missing: `scoring-complete` full recalc, `rating-changed` debounced diff refresh |
| `SearchResultsCtrl` | `results_pane_controller.js` | ⚠️ **Partial** — has rating, pagination, detail modal, diff integration, bulk rating, rated-only filter. Missing: `querqyRuleTriggered` indicator |
| `SearchResultCtrl` | _(inline in results pane)_ | ⚠️ **Partial** — has rating. Missing: image URL formatting with prefix option, snippet highlighting (`subSnippets`), `hotMatchesOutOf` display |
| `SettingsCtrl` | `settings_panel_controller.js` | ⚠️ **Partial** — has save/duplicate/delete try, search URL validation (connection test + SSRF protection), JSON syntax validation for ES/OS query params, TLS warning. Missing: ES template detection, search engine URL change flow |
| `CurrSettingsCtrl` | `inline_edit_controller.js` | ✅ Try rename works via inline edit |
| `CaseCtrl` | `inline_edit_controller.js` | ⚠️ **Partial** — case rename works. Missing: `updateNightly` toggle, case `scores` watch |
| `HeaderCtrl` | _(server-rendered `_header.html.erb`)_ | ⚠️ **Partial** — header is shared partial. Missing: dynamic dropdown of recent cases/books (fetched via `caseSvc.fetchDropdownCases` / `bookSvc.fetchDropdownBooks`), `goToCase` SPA navigation |
| `ScorerCtrl` | `scorer_panel_controller.js` | ✅ Fetches and displays scorer list, allows selection, page reload |
| `QueryParamsCtrl` | `settings_panel_controller.js` + `query_params_panel_controller.js` | ⚠️ **Partial** — has save, curator vars. Missing: `runCaseInBackground` evaluation, search endpoint listing, search URL validation |
| `CustomHeadersCtrl` | `custom_headers_controller.js` | ✅ |
| `QueryNotesCtrl` | `Core::Queries::NotesController` (server-side) | ✅ Notes form via Turbo Frame |
| `WizardCtrl` + `WizardModalCtrl` | `new_case_wizard_controller.js` | ⚠️ **Partial** — wizard UI exists. Missing: auto-trigger for new users based on `completedCaseWizard` + `casesInvolvedWithCount`, tour trigger (`setupAndStartTour`) |
| `PromptSnapshotCtrl` | `take_snapshot_controller.js` | ✅ |
| `DetailedDocCtrl` | _(inline in `results_pane_controller.js`)_ | ⚠️ **Partial** — has detail modal. Missing: link-to-doc with basic auth credential injection, proxy URL support, `$window.open` behavior |
| `DocExplainCtrl` | `query_explain_controller.js` | ✅ |
| `TargetedSearchCtrl/Modal` | `doc_finder_controller.js` | ✅ |
| `QueryDiffResultsCtrl` | `diff_controller.js` + `DiffComparisonComponent` | ✅ **Ported** — server renders side-by-side multi-column comparison with position change color coding (improved/degraded/new/missing). See §5 for details |
| `HotMatchesCtrl` | _(server-rendered in MatchesComponent)_ | ⚠️ **Partial** — server renders matches but `hotMatchesOutOf(maxDocScore)` scoring comparison is not implemented |
| `UnarchiveCaseCtrl` | ❌ **Missing** | No unarchive modal in experimental |
| `404Ctrl` | ❌ **Missing** | No explicit 404 handling (Rails handles it) |
| `LoadingCtrl` | _(N/A)_ | ✅ Not needed — no SPA bootstrap loading screen |

---

## 4. Angular Services → Server/Stimulus Replacement Mapping

### Fully Replaced by Server-Side or Not Needed

| Angular Service | Replacement | Notes |
|---|---|---|
| `bootstrapSvc` | `CoreController#show` + layout | Server renders initial state |
| `caseTryNavSvc` | Rails routing (`case_core_path`) | Navigation is full page loads / Turbo |
| `configurationSvc` | Server passes data via `data-*` attributes | `communalScorersOnly`, `queryListSortable` from controller |
| `annotationsSvc` | `Api::V1::AnnotationsController` (unchanged) | API still used by Stimulus |
| `importRatingsSvc` | `Core::ImportsController` (new) | Server handles import with Turbo Stream notifications |
| `caseCSVSvc` | `Core::ExportsController` (new) | Server handles CSV export |
| `userSvc` | _(not needed)_ | Auth handled server-side |
| `searchErrorTranslatorSvc` | _(inline error messages)_ | HTTP status codes shown directly |
| `varExtractorSvc` | `settings_panel_controller.js` `_extractCuratorVars()` | ✅ Regex extraction in Stimulus |

### Partially Replaced

| Angular Service | Replacement | Gap |
|---|---|---|
| `queriesSvc` (1,356 lines) | `query_list_controller.js` + `query_expand_controller.js` + server-side | ⚠️ Partial: `toggleShowOnlyRated` ported (server-side filter), inline query expand with rating. Missing: `createSearcherFromSettings`, `createSearcherFromSnapshot`, `normalizeDocExplains`, `updateScores` (full case rescore), query `scoreOthers()` |
| `settingsSvc` | `settings_panel_controller.js` | ❌ Missing: `editableSettings()` state management, try history/selection, `isTrySelected` validation |
| `caseSvc` | Server-rendered + `inline_edit_controller.js` | ❌ Missing: `fetchDropdownCases`, `selectTheCase`, `unarchiveCase`, `updateNightly` |
| `scorerSvc` | `scorer_panel_controller.js` | ⚠️ Simplified: Fetches list, selects. Missing: scorer code testing from workspace (but `scorer_test_controller.js` exists for scorer edit page) |
| `diffResultsSvc` | `diff_controller.js` + `DiffComparisonComponent` (server-side) | ✅ **Architecture change** — server renders side-by-side multi-column comparison via `DiffComparisonComponent`. See §5 |
| `queryViewSvc` | `query_expand_controller.js` + `query_list_controller.js` | ⚠️ Partial: `toggleQuery` ported (inline expand/collapse with 5-result preview + rating). Missing: `collapseAll` |
| `paneSvc` | `workspace_resizer_controller.js` | ✅ Draggable divider between query list and results pane, persists to localStorage, hidden when panels collapse |
| `querySnapshotSvc` | `take_snapshot_controller.js` | ⚠️ Simplified — create snapshot works. Missing: `listSnapshotsForCase` in workspace context, snapshot comparison history |
| `snapshotSearcherSvc` | Server-side diff badge rendering | ❌ **Architecture change** — no client-side SnapshotSearcher |
| `bookSvc` | _(not in workspace scope)_ | Header's `fetchDropdownBooks` not ported |
| `teamSvc` | _(not in workspace scope)_ | Team operations are on other pages |
| `docCacheSvc` | _(not needed)_ | Server-side search; no client doc cache |

### Not Replaced (removed entirely)

| Angular Service | Purpose | Impact |
|---|---|---|
| `rateBulkSvc` | Bulk rate all visible docs at once | ✅ Ported — `results_pane_controller.js` `bulkRate()` / `bulkClear()` calls existing bulk API endpoints |
| `rateElementSvc` | Rating scale per-doc (colors + click handlers) | ✅ Replaced by popover in `results_pane_controller.js` |
| `ratingsStoreSvc` | Client-side ratings cache per query | ✅ Not needed — server provides ratings |
| `broadcastSvc` | Angular `$rootScope.$broadcast` | ✅ Replaced by `CustomEvent` dispatch |
| `searchEndpointSvc` | Fetch/manage search endpoints | ⚠️ Only partially used — settings panel doesn't list endpoints |
| `qscoreSvc` | Score calculation on client | ⚠️ Server computes scores; `qscore_controller.js` displays |
| `normalDocsSvc` | Normalize doc fields from different engines | ✅ Done server-side in `QuerySearchService` |

---

## 5. Diff/Comparison Architecture Change (Major)

The **most significant architectural difference** between the branches:

### Angular approach (`deangularjs`)
- `queryViewSvc` stores selected snapshot IDs
- `diffResultsSvc.createQueryDiffs()` creates `SnapshotSearcher` objects per query
- Client fetches snapshot data, creates doc arrays, computes diff scores
- Side-by-side column display: current results | snapshot 1 results | snapshot 2 results
- Client-side diff score calculation per query per snapshot
- `QueryDiffResultsCtrl` builds `docTuples` = `[{ doc, diffDocs: [snap1doc, snap2doc] }]`

### Modern approach (`deangularjs-experimental`)
- `diff_controller.js` sends `diff_snapshot_ids[]` to search API
- Server builds both `diff_entries_map` (for badge overlay) and `diff_columns` (for side-by-side) via `build_diff_data` in `SearchController`
- `DiffComparisonComponent` renders multi-column side-by-side layout: Current Results | Snapshot A | Snapshot B | …
- Color coding: green border = improved position, red = degraded, blue = new in current, gray = missing from current
- Position change tooltips on each card ("Now at #1 (was #3)")
- Falls back to normal document cards with diff badges when no snapshots selected

### Remaining Gaps
- ❌ No per-snapshot diff score calculation
- ❌ No case-level diff score aggregation

---

## 6. Missing Functionality Inventory (Priority Order)

### P0 — Core Workspace Functionality Gaps

| # | Feature | Angular Location | Status in Experimental |
|---|---|---|---|
| 1 | **Resizable query/results pane** (draggable slider) | `paneSvc` + CSS `.pane_container` / `.pane_east` / `.east-slider` | ✅ Resolved — `workspace_resizer_controller.js` with drag, touch, localStorage persistence |
| 2 | **Bulk rating** (rate all visible docs at once) | `rateBulkSvc` + `SearchResultsCtrl` | ✅ Resolved — `results_pane_controller.js` `bulkRate()` / `bulkClear()` using existing bulk API |
| 3 | **Show only rated docs** toggle | `queriesSvc.toggleShowOnlyRated()` + `SearchResultsCtrl` | ✅ Resolved — checkbox in results pane header + server-side filtering via `show_only_rated` param |
| 4 | **Query expand/collapse** (toggle individual query results inline) | `queryViewSvc.toggleQuery()` + `SearchResultsCtrl.$scope.query.toggle()` | ✅ Resolved — `query_expand_controller.js` with 5-result inline preview + inline rating |
| 5 | **Side-by-side diff comparison view** | `QueryDiffResultsCtrl` + `diffResultsSvc` | ✅ Resolved — `DiffComparisonComponent` renders multi-column comparison with position change color coding |
| 6 | **Dynamic header case/book dropdowns** | `HeaderCtrl` + `caseSvc.fetchDropdownCases()` + `bookSvc.fetchDropdownBooks()` | ✅ Resolved — `DropdownController` + lazy Turbo Frames (pre-existing) |
| 7 | **Search URL/endpoint validation** | `SettingsCtrl.validateSearchEngineUrl()`, ES template warning, TLS protocol warning | ✅ Resolved — `ValidationsController` (SSRF-protected) + JSON syntax validation + TLS warning in `settings_panel_controller.js` |
| 8 | **Unarchive case modal** | `UnarchiveCaseCtrl` | ✅ Resolved — route + controller action exist; ARCHIVED badge in workspace (pre-existing) |

### P1 — Important Feature Gaps

| # | Feature | Angular Location | Status in Experimental |
|---|---|---|---|
| 9 | **Ace code editor** in workspace query params | `ui.ace` / `angular-ui-ace` | ❌ Missing — query param editing uses plain textarea |
| 10 | **JSON tree viewer** for document detail | `ngJsonExplorer` | ❌ Missing — replaced by flat `<pre>` JSON dump |
| 11 | **Importmap pins** (43 → 1) | `config/importmap.rb` | ⚠️ May break CodeMirror 6, Vega charts, and other importmap-dependent features on non-workspace pages |
| 12 | **Case nightly update toggle** | `CaseCtrl.$scope.updateNightly()` | ❌ Missing |
| 13 | **Run evaluation in background** | `QueryParamsCtrl.runCaseInBackground()` | ❌ Missing |
| 14 | **Search endpoint picker in settings** | `QueryParamsCtrl` + `searchEndpointSvc.fetchForCase()` | ❌ Missing — no endpoint list |
| 15 | **New user auto-wizard trigger** | `WizardCtrl` (auto-shows for new users with no cases/teams) | ❌ Missing — wizard component exists but no auto-trigger |
| 16 | **Doc detail link with auth credentials** | `DetailedDocCtrl.linkToDoc()` — injects basicAuth into URL | ❌ Missing |
| 17 | **Clipboard copy support** | `ngclipboard` | ❌ Missing — no copy buttons |
| 18 | **Relative time display** ("3 hours ago") | `angular-timeago` | ❌ Missing — timestamps show absolute dates |
| 19 | **Querqy rule triggered indicator** | `SearchResultsCtrl.querqyRuleTriggered()` | ❌ Missing |
| 20 | **Hot matches scoring display** | `HotMatchesCtrl.$scope.hots` with `hotMatchesOutOf(maxDocScore)` | ❌ Missing — matches component exists but without scoring comparison |
| 21 | **Image URL prefix formatting** | `SearchResultCtrl.formatImageUrl(url, options)` with prefix support | ❌ Missing |
| 22 | **Tour system integration** | `setupAndStartTour` triggered after wizard | ❌ Missing |

### P2 — Minor / Low-Impact Gaps

| # | Feature | Angular Location | Status in Experimental |
|---|---|---|---|
| 23 | **Snippet highlighting** | `$scope.snippets = doc.subSnippets('<strong>', '</strong>')` | ⚠️ Server may provide; needs verification |
| 24 | **Query params history** (try history sidebar) | `queryParamsHistory.js` | ⚠️ Settings panel shows tries but history browsing is limited |
| 25 | **Collapse all queries** | `queryViewSvc.collapseAll()` | ❌ Not applicable — different query list model |
| 26 | **Sort queries by reverse** | `queriesSvc` sort with `$location.search().reverse` | ⚠️ Sort exists but `reverse` URL param not persisted |
| 27 | **Not all rated indicator** | `query.isNotAllRated()` display | ⚠️ Server could include this |
| 28 | **Animated score numbers** | `countUp` / `angular-countup` | ❌ Minor — cosmetic only |

---

## 7. New Capabilities in Experimental (Not in Angular)

| Feature | Location | Benefit |
|---|---|---|
| **Scorer test button** on edit page | `scorer_test_controller.js` + `scorers#test` route | Test scorer code without leaving edit |
| **Turbo Stream export/import notifications** | `core/exports/`, `core/imports/` | Real-time progress without polling |
| **Server-side search execution** | `QuerySearchService` + `SearchController` | No CORS issues, no client JS bundle for splainer-search |
| **Inline case/try rename** | `inline_edit_controller.js` | Double-click edit, optimistic updates |
| **SortableJS drag-drop queries** | `query_list_controller.js` | Modern drag-drop (replaces jQuery UI sortable) |
| **Lightweight per-query scoring** | `api/v1/queries/scores_controller.rb` | Fast score refresh after rating without full evaluation |
| **Export granularity** (general/detailed/snapshot) | `export/cases#general`, `#detailed`, `#snapshot` | More export options |
| **D3 via importmap** | `vendor/javascript/d3*` | Modern ES module loading |
| **Vitest for JS testing** | `vitest.config.js` | Modern JS test runner |

---

## 8. splainer-search Library Impact

The Angular branch depends heavily on `splainer-search` (imported as `o19s.splainer-search` in `app.js`). This library:

- Executes searches against Solr, ES, OS, Vectara, Algolia **from the browser**
- Parses explain JSON for scoring analysis
- Normalizes documents across search engines
- Provides `Searcher`, `RateableDoc`, `FieldSpec` abstractions
- Handles query template expansion

In the experimental branch, this is replaced by `QuerySearchService` (server-side). This is a **correct architectural decision** but means:

1. ✅ No CORS configuration needed
2. ✅ Smaller JS bundle
3. ✅ Auth credentials never exposed to browser
4. ❌ No client-side explain parsing (must be returned by server)
5. ❌ No client-side field spec interpretation for doc display
6. ❌ Vectara and Algolia doc extraction marked as `# TODO`

---

## 9. CSS/Style & Asset Infrastructure Changes

### CSS
- **`bootstrap3.css` removed** (6,722 lines) — experimental is Bootstrap 5 only
- Angular-specific CSS removed: `angular-json-explorer.css`, `angular-wizard.min.css`, `ng-tags-input.min.css`
- **`qgraph.css` added** (46 lines) — sparkline/SVG styling for the QgraphComponent
- **`qscore.css` updated** — div-based class selectors (`.qscore-case`) replace Angular element selectors
- **`application.css`** — added Turbo loading state styles (opacity + pointer-events during frame loads)

### JS Module System
- `deangularjs` importmap: **43 pins** (Stimulus, Turbo, D3, Vega, CodeMirror 6, Bootstrap, etc.)
- `deangularjs-experimental` importmap: **1 pin** (`application`) — suggests esbuild bundling instead
- ⚠️ This may affect CodeMirror 6, Vega chart rendering, and other importmap-pinned libraries

### Removed JS Libraries (no replacement)
| Library | Angular Usage | Impact |
|---|---|---|
| `ace-builds` / `angular-ui-ace` | Code editor in scorer edit and query params | ❌ **No code editor** — `ui.ace` was used for editing scorer JS code and complex query params |
| `ngVega` / Vega-Lite | Vega chart rendering in workspace | ⚠️ Vega pinned in old importmap but not in new — chart rendering may be affected |
| `ng-json-explorer` | JSON tree viewer for document details | ❌ **No JSON tree view** — replaced by flat `<pre>` JSON dump |
| `angular-countup` / `countUp` | Animated number display | ❌ Minor — score numbers don't animate |
| `ngclipboard` | Copy to clipboard buttons | ❌ Missing — no clipboard copy support |
| `tether-shepherd` | Guided tour system | ❌ Missing — no product tours |
| `angular-csv-import` / `ngCsvImport` | CSV file import in browser | ⚠️ Server-side import replaces this |
| `angular-timeago` | Relative time display ("3 hours ago") | ❌ Missing — timestamps may show absolute dates |
| `jquery-autogrowinput` | Auto-growing text inputs | ❌ Minor UI polish |

### Build Pipeline
| Aspect | `deangularjs` | `deangularjs-experimental` |
|---|---|---|
| Build steps | 7 (css + jquery + admin + analytics + angular-vendor + angular-app + angular-templates) | 4 (clean + css + jquery + admin + analytics) |
| Test runner | Karma + Jasmine + Puppeteer | Vitest |
| Test command | `rake karma:run` | `vitest` |
| New vendor JS | None | D3 v7 (~30 subpackages) + SortableJS (3,363 lines) |

---

## 10. Test Coverage Comparison

The experimental branch adds:
- `vitest.config.js` for JavaScript unit tests
- ViewComponent test files in `test/components/`
- New controller tests for `Core::QueriesController`, `Core::ExportsController`, etc.

Angular test infrastructure (`karma`, `jasmine`, `puppeteer`) is removed.

---

## 11. Recommendations

### Before Merging (P0 — All Resolved ✅)

1. ~~**Decide on diff strategy**~~ — ✅ Resolved: `DiffComparisonComponent` renders server-side multi-column side-by-side comparison with position change color coding.
2. ~~**Add bulk rating**~~ — ✅ Resolved: Bulk rate/clear all visible docs via `results_pane_controller.js` using existing API endpoints.
3. ~~**Port the resizable pane**~~ — ✅ Resolved: `workspace_resizer_controller.js` with drag/touch support, localStorage persistence, auto-hide on panel collapse.
4. ~~**Dynamic header dropdowns**~~ — ✅ Resolved: `DropdownController` + lazy Turbo Frames (pre-existing).
5. ~~**Search endpoint validation**~~ — ✅ Resolved: `ValidationsController` with SSRF protection, TLS warnings, JSON syntax validation for ES/OS.

### P1 — Consider Before or Shortly After Merge

- Ace/CodeMirror code editor for query params (plain textarea is functional but less ergonomic for complex JSON)
- JSON tree viewer for document detail modal (flat `<pre>` works but tree is more navigable)
- Case nightly update toggle
- Run evaluation in background
- Search endpoint picker in settings panel
- New user auto-wizard trigger

### Can Defer (P2)

- Querqy rule indicator (niche feature)
- Tour system (can re-add later)
- Image URL prefix formatting (uncommon use case)
- Hot matches scoring comparison (visual nice-to-have)
- Animated score numbers (cosmetic)
- Clipboard copy support (browser API is straightforward to add later)

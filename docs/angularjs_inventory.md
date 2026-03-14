# AngularJS Inventory

Complete inventory of the AngularJS frontend in Quepid, created to guide the React migration.

## Overview

The AngularJS app powers the **core case evaluation interface** at `/case/:caseNo/try/:tryNo`. It is bootstrapped via the `core.html.erb` layout with `ng-app="QuepidApp"` and uses ngRoute with HTML5 mode. The module name is `QuepidApp` with 25+ third-party AngularJS dependencies.

Everything outside this core (homepage, cases listing, teams, books, scorers, judgements, admin) has already been migrated to standard Rails views with Stimulus controllers.

## Architecture

```
core.html.erb (ng-app="QuepidApp")
  -> _header_core_app.html.erb (HeaderCtrl)
  -> yield → core/index.html.erb (flash, LoadingCtrl, ng-view)
      -> routes.js (ngRoute)
          -> /case/:caseNo/try/:tryNo -> queriesLayout.html (MainCtrl)
          -> /case/:caseNo            -> queriesLayout.html (MainCtrl)
          -> otherwise                -> 404.html (404Ctrl)
```

**Bootstrap flow:**
1. `core.html.erb` loads jQuery, Angular vendors, templates, app bundles
2. Inline `<script>` run block calls `bootstrapSvc.run()` (fetches current user) and `configurationSvc` (sets feature flags from Rails config)
3. ngRoute resolves to `MainCtrl` which orchestrates `caseSvc`, `settingsSvc`, `queriesSvc`, `querySnapshotSvc`, `scorerSvc`
4. `QueriesCtrl` manages the primary query list — the heart of the UI

## Build System

- **Bundler:** esbuild (not Sprockets, not Webpack)
- **Entry points:**
  - `app/javascript/angular_app.js` -> vendor bundle (`angular_app.js`)
  - `app/javascript/quepid_app.js` -> app bundle (`quepid_angular_app.js`)
  - `build_templates.js` -> template cache (`angular_templates.js`)
  - `app/javascript/jquery_bundle.js` -> jQuery bundle
- **Output:** `app/assets/builds/*.js`
- **Build commands:** `yarn build:angular-vendor`, `yarn build:angular-app`, `yarn build:angular-templates`
- **Tests:** Karma + Jasmine 6.0.1, run via `bin/docker r yarn test`

## Third-Party AngularJS Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| angular | ~1.8.3 | Core framework |
| angular-resource | ~1.8.3 | Resource (used by vendor bundle) |
| angular-route | ~1.8.3 | Client-side routing |
| angular-cookies | ~1.8.3 | Cookie handling |
| angular-sanitize | ~1.8.3 | HTML sanitization |
| angular-animate | ^1.8.3 | Animations |
| angular-ui-bootstrap | ~2.5.0 | Bootstrap UI (modals, dropdowns, popovers) |
| angular-wizard | 0.4.2 | Multi-step wizard |
| angular-ui-sortable | ~0.19.0 | jQuery UI sortable |
| angular-ui-ace | master | ACE editor integration |
| angular-utils-pagination | ~0.11.1 | Pagination |
| angular-csv-import | master | CSV import |
| angular-flash | master | Flash messages |
| angular-timeago | ~0.4.6 | Time ago display |
| ng-tags-input | 3.2.0 | Tags input |
| ng-json-explorer | master | JSON tree viewer |
| ngclipboard | ^2.0.0 | Clipboard operations |
| angular-countup | ^0.0.1 | Number animation |
| splainer-search | ^2.35.1 | Search engine abstraction (Solr, ES, OS, etc.) |

**Non-Angular JS dependencies also used in the Angular app:**
- jQuery ^3.7.1 + jQuery UI
- D3 ~7.9.0 (charts)
- Vega ^6.0.0 / Vega-Lite / Vega-Embed (visualizations)
- ACE editor (ace-builds)
- file-saver (download exports)
- urijs (URL manipulation)
- tether-shepherd (in-app product tour in `tour.js`)

---

## Controllers (28)

### Core Application Controllers

| Controller | File | Lines | Description |
|-----------|------|-------|-------------|
| **MainCtrl** | `controllers/mainCtrl.js` | 184 | Bootstrap controller. Initializes case, settings, queries, snapshots, scorers. Orchestrates the entire case view. |
| **QueriesCtrl** | `controllers/queriesCtrl.js` | 606 | Heart of the UI. Manages query list, scoring, sorting, bulk operations, search execution, query add/delete/reorder. |
| **HeaderCtrl** | `controllers/headerCtrl.js` | 83 | App header with case/book dropdown navigation, recent items. |
| **LoadingCtrl** | `controllers/loading.js` | 14 | Shows loading spinner while case data loads. |
| **CaseCtrl** | `controllers/case.js` | 62 | Case name display and rename. |
| **CurrSettingsCtrl** | `controllers/currSettings.js` | 41 | Current try selection and rename. |

### Search & Results Controllers

| Controller | File | Lines | Description |
|-----------|------|-------|-------------|
| **SearchResultsCtrl** | `controllers/searchResults.js` | 157 | Results list container. Bulk rating, filtering, result count. |
| **SearchResultCtrl** | `controllers/searchResult.js` | 117 | Individual result with rating controls, explain toggle, document details. |
| **DocFinderCtrl** | `controllers/docFinder.js` | 233 | Advanced document search with explain extraction and pagination. |
| **DetailedDocCtrl** | `controllers/detailedDoc.js` | 50 | Modal: detailed document view with all fields. |
| **DocExplainCtrl** | `controllers/detailedExplain.js` | 13 | Modal: explain output for a document. |
| **HotMatchesCtrl** | `controllers/hotMatchesCtrl.js` | 13 | Hot matches display in results. |

### Settings & Configuration Controllers

| Controller | File | Lines | Description |
|-----------|------|-------|-------------|
| **QueryParamsCtrl** | `controllers/queryParams.js` | 164 | Try settings: search endpoint URL, query template, field spec validation. |
| **SettingsCtrl** | `controllers/settings.js` | 91 | Try settings with JSON validation for search engine configs. |
| **CustomHeadersCtrl** | `controllers/customHeaders.js` | 16 | Custom HTTP headers (API keys, etc.) for search endpoints. |
| **QueryParamsDetailsCtrl** | `controllers/queryParamsDetails.js` | 60 | Modal: try details, rename, delete, clone. |
| **queryParamsHistoryCtrl** | `controllers/queryParamsHistory.js` | 67 | Timeline view of try history. |

### Wizard Controllers

| Controller | File | Lines | Description |
|-----------|------|-------|-------------|
| **WizardCtrl** | `controllers/wizardCtrl.js` | 52 | Triggers initial case setup wizard. |
| **WizardModalCtrl** | `controllers/wizardModal.js` | 828 | **Largest controller.** Multi-step wizard: select search engine, configure endpoint, add queries, validate, create case. |

### Scoring & Comparison Controllers

| Controller | File | Lines | Description |
|-----------|------|-------|-------------|
| **ScorerCtrl** | `controllers/scorer.js` | 111 | Modal: select/change case scorer. |
| **QueryDiffResultsCtrl** | `controllers/queryDiffResults.js` | 104 | Side-by-side query result diff with snapshot comparison. |
| **TakeSnapshotCtrl** | `controllers/takeSnapshot.js` | 23 | Button that triggers snapshot creation modal. |
| **PromptSnapshotCtrl** | `controllers/promptSnapshot.js` | 45 | Modal: name and create a snapshot. |

### Utility Controllers

| Controller | File | Lines | Description |
|-----------|------|-------|-------------|
| **QueryNotesCtrl** | `controllers/queryNotes.js` | 32 | Modal: edit query notes/information needs. |
| **TargetedSearchCtrl** | `controllers/targetedSearchCtrl.js` | 26 | Triggers advanced search modal. |
| **TargetedSearchModalCtrl** | `controllers/targetedSearchModal.js` | 30 | Modal: Lucene/query DSL search. |
| **UnarchiveCaseCtrl** | `controllers/unarchiveCase.js` | 59 | Modal: browse and unarchive cases. |
| **404Ctrl** | `controllers/404Ctrl.js` | 4 | 404 page (empty). |

**Total: ~3,285 lines across 28 controllers**

---

## Services (26)

### Core Data Services

| Service | File | Size | Key API Endpoints |
|---------|------|------|-------------------|
| **queriesSvc** | `services/queriesSvc.js` | 44KB | `api/cases/:id/queries` — query CRUD, search execution, rating, scoring |
| **caseSvc** | `services/caseSvc.js` | 17KB | `api/cases` — case CRUD, archive, clone, scoring, evaluation |
| **settingsSvc** | `services/settingsSvc.js` | 22KB | `api/cases/:id/tries` — try CRUD, settings management |
| **scorerSvc** | `services/scorerSvc.js` | 8.5KB | `api/scorers` — scorer CRUD, default assignment |
| **ratingsStoreSvc** | `services/ratingsStoreSvc.js` | 5.6KB | `api/cases/:id/queries/:id/ratings` — rating CRUD, bulk operations |
| **querySnapshotSvc** | `services/querySnapshotSvc.js` | 9.4KB | `api/cases/:id/snapshots` — snapshot CRUD, import |
| **bookSvc** | `services/bookSvc.js` | 5KB | `api/books`, `api/dropdown/books` — book operations |
| **searchEndpointSvc** | `services/searchEndpointSvc.js` | — | `api/search_endpoints` — endpoint listing |
| **annotationsSvc** | `services/annotationsSvc.js` | — | `api/cases/:id/annotations` — annotation CRUD |
| **teamSvc** | `services/teamSvc.js` | — | `api/teams` — team management, case sharing |
| **userSvc** | `services/userSvc.js` | — | `api/users/current` — current user |
| **importRatingsSvc** | `services/importRatingsSvc.js` | — | `api/import/ratings` — CSV/RRE/LTR import |
| **caseCSVSvc** | `services/caseCSVSvc.js` | 17KB | `api/export/ratings`, `api/export/cases` — multi-format export |

### Infrastructure Services

| Service | File | Description |
|---------|------|-------------|
| **caseTryNavSvc** | `services/caseTryNavSvc.js` | Navigation: `getQuepidRootUrl()`, case/try URL management, protocol handling |
| **configurationSvc** | `services/configurationSvc.js` | Feature flags: communal scorers only, query list sortable |
| **bootstrapSvc** | `services/bootstrapSvc.js` | App init: fetches current user on startup |
| **docCacheSvc** | `services/docCacheSvc.js` | Document caching for resolved docs |
| **diffResultsSvc** | `services/diffResultsSvc.js` | Snapshot diff computation |
| **snapshotSearcherSvc** | `services/snapshotSearcherSvc.js` | Creates searcher interface from snapshot data |
| **queryViewSvc** | `services/queryViewSvc.js` | View state: diff toggles, query collapse state |
| **paneSvc** | `services/paneSvc.js` | UI: resizable east pane layout |
| **qscoreSvc** | `services/qscore_service.js` | Score-to-color conversion |
| **searchErrorTranslatorSvc** | `services/searchErrorTranslatorSvc.js` | HTTP error code to friendly messages |
| **varExtractorSvc** | `services/varExtractorSvc.js` | Extracts `##varName##` curator variables |
| **rateBulkSvc** | `services/rateBulkSvc.js` | Bulk rating UI helper |
| **rateElementSvc** | `services/rateElementSvc.js` | Individual rating UI helper |

---

## Factories (7)

| Factory | File | Description |
|---------|------|-------------|
| **ScorerFactory** | `factories/ScorerFactory.js` (18KB) | Scorer objects with client-side evaluation logic (runs user-defined JS scoring code) |
| **SettingsFactory** | `factories/SettingsFactory.js` | Settings objects managing a collection of tries |
| **TryFactory** | `factories/TryFactory.js` | Try objects with field spec, curator vars, API format conversion |
| **SnapshotFactory** | `factories/snapshotFactory.js` | Snapshot objects with doc ID extraction and query result access |
| **DocListFactory** | `factories/docListFactory.js` | Document list with error handling for missing/duplicate IDs |
| **AnnotationFactory** | `factories/AnnotationFactory.js` | Simple data objects for annotations |
| **broadcastSvc** | `factories/broadcastSvc.js` | Event bus wrapping `$rootScope.$broadcast` |

---

## Directives (11)

| Directive | File | Template | Description |
|-----------|------|----------|-------------|
| `queries` | `directives/queries.js` | `views/queries.html` | Main queries container (transclude) |
| `queryParams` | `directives/queryParams.js` | `views/devQueryParams.html` | Query parameter editor |
| `queryParamsHistory` | `directives/queryParamsHistory.js` | `views/queryParamsHistory.html` | Try history timeline |
| `searchResults` | `directives/searchResults.js` | `views/searchResults.html` | Results list container |
| `searchResult` | `directives/searchResult.js` | `views/searchResult.html` | Individual result with rating, explain, media |
| `queryDiffResults` | `directives/queryDiffResults.js` | `views/queryDiffResults.html` | Diff results display |
| `customHeaders` | `directives/customHeaders.js` | `views/customHeaders.html` | HTTP header editor |
| `stackedChart` | `directives/stackedChart.js` | `views/stackedChart.html` | D3 stacked chart for explain breakdown |
| `vega` | `directives/angular-vega.js` | (inline) | Vega chart embed |
| `autoGrow` | `directives/autoGrow.js` | (none) | Auto-growing input |
| `textPaste` | `directives/textPaste.js` | (none) | Paste event handler |

Also defined inline: `quepidEmbed` (media type detection for audio/image/video) and `plusOrMinus` filter (in `searchResults.js`).

---

## Components (23)

Each component lives in `app/assets/javascripts/components/<name>/` with `_directive.js`, `_controller.js`, `.html`, and optionally `_modal.html` and `_modal_instance_controller.js`.

### Action Components (trigger modals/operations)

| Component | Type | Has Modal | Description |
|-----------|------|-----------|-------------|
| `actionIcon` | Directive | No | Reusable icon button with callback |
| `addQuery` | Directive | No | Add query form |
| `newCase` | Directive | Yes (wizard) | New case creation button |
| `cloneCase` | Component | Yes | Clone a case |
| `deleteCase` | Directive | Yes | Delete a case |
| `deleteCaseOptions` | Component | Yes | Advanced delete options |
| `exportCase` | Directive | Yes | Export case (CSV, TREC, RRE, LTR formats) |
| `importRatings` | Component | Yes | Import ratings from file |
| `shareCase` | Component | Yes | Share case with teams |
| `moveQuery` | Directive | Yes | Move query to another case |

### Display Components

| Component | Type | Has Modal | Description |
|-----------|------|-----------|-------------|
| `qscoreCase` | Component | No | Case-level score display with color buckets |
| `qscoreQuery` | Component | No | Query-level score display |
| `qgraph` | Directive | No | D3 sparkline/line graph of score history + annotations |
| `annotation` | Component | Yes | Single annotation display/edit |
| `annotations` | Component | No | Annotations list |
| `diff` | Component | Yes | Snapshot diff viewer |
| `expandContent` | Directive | Yes | Expandable content panel |

### Analysis Components

| Component | Type | Has Modal | Description |
|-----------|------|-----------|-------------|
| `queryExplain` | Directive | Yes | Search query explanation |
| `queryOptions` | Directive | Yes | Query parameter options |
| `debugMatches` | Component | Yes | Debug match details |
| `frogReport` | Directive | Yes | FROG report (Focusing on Retrieval Optimization Goals) |
| `judgements` | Component | Yes | Relevance judgements display |
| `matches` | (template only) | No | Search result matches |

---

## Templates

### Route Templates (`app/assets/templates/views/`)

- `queriesLayout.html` — Main case/query interface layout (the "hub")
- `404.html` — 404 error page

### View Templates (`app/assets/templates/views/`)

- `queries.html`, `searchResults.html`, `searchResult.html` — Core list/result views
- `devQueryParams.html`, `queryParamsHistory.html`, `customHeaders.html` — Settings/config
- `queryDiffResults.html`, `stackedChart.html` — Analysis/visualization
- `embed.html` — Media embed (audio/image/video)
- `ratings/popover.html` — Rating popover
- `common/flash.html`, `common/search_flash.html` — Flash messages
- `_dev_settings.html` — Developer settings panel

### Modal Templates (`app/assets/templates/views/`)

- `wizardModal.html` — Case creation wizard
- `snapshotModal.html` — Snapshot creation
- `detailedDoc.html` — Document detail view
- `detailedExplain.html` — Explain detail view
- `queryParamsDetails.html` — Try details
- `pick_scorer.html` — Scorer selection
- `targetedSearchModal.html` — Advanced search
- `searchEndpoint_popup.html` — Endpoint config
- `unarchiveCaseModal.html` — Unarchive confirmation

### Component Templates (co-located)

Each component in `app/assets/javascripts/components/<name>/` has its own `.html` and optionally `_modal.html` files. With `app/assets/templates/`, there are ~62 HTML templates total (24 in templates/views, 38 in components).

---

## Filters (5)

| Filter | File | Description |
|--------|------|-------------|
| `caseType` | `filters/caseType.js` | Filters cases by 'owned' or 'shared' |
| `queryStateClass` | `filters/queryStateClass.js` | Maps query state to CSS class |
| `ratingBgStyle` | `filters/ratingBgStyle.js` | Rating value to background color style |
| `scoreDisplay` | `filters/scoreDisplay.js` | Formats scores to 2 decimal places |
| `searchEngineName` | `filters/searchEngineName.js` | Engine code to display name |

Also defined inline: `plusOrMinus` (in searchResults directive), `stackChartColor`, `stackChartHeight`, `stackChartLeftover` (in stackedChart directive).

---

## Values & Interceptors

**Values:**
- `eastPaneWidth` — 450 (pixels, for pane layout)
- `settingsIdValue` — `{ id: 0 }` (mutable settings reference)

**Interceptors:**
- `ng-rails-csrf` — Adds `X-CSRF-TOKEN` and `X-Requested-With` headers to all `api/` requests

---

## Event System

Inter-component communication uses `broadcastSvc` wrapping `$rootScope.$broadcast`. Key events:

- `settings-changed`, `settings-updated` — Try/settings updated
- `updatedCasesList` — Cases list refreshed
- `caseSelected` — Case selection changed
- `fetchedDropdownCasesList`, `fetchedDropdownBooksList` — Cases/books loaded for dropdowns
- `bootstrapped` — Initial cases loaded on startup
- `updatedCaseScore` — Case or annotation score changed
- `updatedScorersList` — Scorers list refreshed
- `caseRenamed`, `caseUpdate` — Case metadata changed
- `associateBook` — Book associated with case
- `caseTeamAdded`, `caseTeamRemoved` — Team sharing changed
- `annotationDeleted` — Annotation removed

---

## Tests

- **Framework:** Karma + Jasmine 6.0.1
- **Location:** `spec/javascripts/**/*_spec.js` (28 test files)
- **Mocks:** `spec/karma/mockBackend.js` + `spec/javascripts/mock/`
- **Config:** `spec/karma/config/unit.js`
- **Run:** `bin/docker r yarn test`

---

## Migration Status

### Already Rails + Stimulus (NOT in Angular)

- Homepage/dashboard (`/`)
- Cases listing (`/cases`)
- Teams management
- Scorers listing
- Books interface
- Judgements interface
- Admin section
- Auth/profile pages

### Still AngularJS (to migrate)

**Everything under `/case/:caseNo/try/:tryNo`:**
- Query list management
- Search result display and rating
- Score visualization (qscore, qgraph)
- Try/settings configuration
- Snapshot management and diffs
- Case creation wizard
- Export/import operations
- Header navigation (within core app)

---

## Gaps and Additions (from code scan)

Items that were missed in the initial inventory or need clarification:

### Additional Angular modules

- **UtilitiesModule** — Separate module (required by QuepidApp). Hosts `bootstrapSvc`, `configurationSvc`, `userSvc`. Defined in `utilitiesModule.js`.
- **ngVega** — Separate module for the Vega directive (`angular-vega.js`). QuepidApp depends on it.
- **ng-rails-csrf** — Standalone module for the CSRF HTTP interceptor.

### Third-party dependency (added to table)

- **angular-resource** — In `package.json` and imported in `app/javascript/angular_app.js`; now included in the "Third-Party AngularJS Dependencies" table above.

### Services from splainer-search (o19s.splainer-search)

The app injects these services; they are **not** defined in Quepid — they come from the `splainer-search` package:

| Service           | Used by |
|-------------------|---------|
| **normalDocsSvc** | docListFactory, snapshotFactory, snapshotSearcherSvc, queriesSvc — `createNormalDoc()`, `explainDoc()` |
| **docResolverSvc** | docCacheSvc — `createResolver()` |
| **fieldSpecSvc**  | TryFactory, querySnapshotSvc (and specs) — `createFieldSpec()` |
| **searchSvc**     | queriesSvc — `createSearcher()` |
| **esUrlSvc**      | QueryParamsCtrl — `isTemplateCall()` |

Migration must either reimplement these or keep a compatibility layer with splainer-search.

### Tour and supporting entry points

- **Shepherd / tether-shepherd** — In `package.json` and `angular_app.js`. Used by `tour.js` for the in-app product tour (steps for case header, score, add query, etc.). Now listed under Non-Angular JS dependencies above.
- **tour.js** — Run via `quepid_app.js`; sets up `Shepherd.Tour` and triggers on `[data-trigger-tour]`.
- **footer.js** — Mutates footer into `.pane_main` when present (MutationObserver). Loaded by `quepid_app.js`.
- **ace_config.js** — Sets ACE worker/theme paths. Loaded by `quepid_app.js`.

### Controller count clarification

The "28 controllers" count refers to **main** controllers in `controllers/`. There are **additional** controllers in components (e.g. `NewCaseCtrl`, `CloneCaseModalInstanceCtrl`, `ShareCaseModalInstanceCtrl`, `EditAnnotationModalInstanceCtrl`, etc.). Total is roughly **28 + ~40 component/modal controllers**. The inventory’s component table describes the 23 components but does not sum their controllers.

### flashProvider in config

`routes.js` configures `flashProvider.errorClassnames.push('alert-danger')` (angular-flash). The inventory mentions angular-flash but not this config.

### Template path note

Component templates reference paths like `'import_ratings/import_ratings.html'` and `'views/wizardModal.html'`; the template cache (build_templates.js) serves both `views/` and component paths.

---

## File Statistics

| Category | Count | Total Size (approx.) |
|----------|-------|---------------------|
| Controllers | 28 | ~3,285 lines |
| Services | 26 | ~175KB |
| Factories | 7 | ~40KB |
| Directives | 11 | ~15KB |
| Components | 23 | ~70KB |
| Filters | 5 | ~3KB |
| Templates | ~62 | ~50KB |
| Tests | 28 | ~25KB |
| **Total** | **~147 JS files** | **~380KB of AngularJS code** |

# Rails-Stimulus Migration Plan

Replacing the AngularJS core UI with Rails views, Turbo, and Stimulus—using the stack Quepid already uses everywhere else.

> **Canonical plan:** [angularjs_elimination_plan.md](./angularjs_elimination_plan.md) — scope, P0 parity, and browser search/scoring model. This doc is **only** Stimulus + Turbo implementation detail for that plan.
>
> **React alternative:** [old/react_migration_plan.md](./old/react_migration_plan.md). **`deangularjs-experimental`:** [deangularjs_experimental_review.md](./deangularjs_experimental_review.md).

## Guiding Principles

1. **Incremental migration** — Angular and Stimulus core coexist during migration. Replace one pane or area at a time; no big-bang rewrite.
2. **API stays the same** — The Rails JSON API (`/api/v1/`) is stable and well-tested. Stimulus controllers and Rails views call the same endpoints.
3. **Rails remains the host** — No client-side router. Rails routes, Turbo Drive for navigation, Turbo Frames for partial updates. Rails handles auth, CSRF, and serves the page.
4. **No feature regression** — Every migrated piece must match existing functionality before we remove the Angular version.
5. **Prefer the stack you already have** — The rest of Quepid is ERB + Stimulus + Turbo. The core becomes “more of the same” instead of a second frontend paradigm (e.g. React).

## Technology Choices

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Framework | Stimulus 3 + Turbo 8 | Already in use app-wide; no new paradigm |
| Routing | Rails routes + Turbo Drive | Single source of truth; deep links and back/forward work naturally |
| Partial updates | Turbo Frames (+ Streams) | In-place frame replacement; optional WebSocket streams for live updates |
| State | Server + DOM + minimal Stimulus values | Server-rendered HTML and frame content; transient UI state in controllers |
| HTTP client | fetch (native) | Same as React plan; use shared API client with CSRF |
| Build | esbuild (existing) | Same Stimulus/JS bundle as rest of app; no JSX, no React |
| CSS | Existing CSS + Bootstrap 5 | No change |
| Charts | D3 (existing) | Already bundled; use from Stimulus controllers |
| Modals | Bootstrap 5 modals + Stimulus | Match existing app patterns |
| Testing | System tests (Capybara) + optional Vitest/Jest for Stimulus | End-to-end guarantee; unit tests for non-trivial controllers |
| Heavy deps | splainer-search, ScorerFactory | Framework-agnostic; wrap/port once for use by Stimulus |

## Rails Integration Approach

### Layout

Use a single core layout. During migration, use a **feature flag** to choose between:

- **Angular core:** existing `core.html.erb` (loads Angular bundles).
- **Stimulus core:** same or renamed layout (e.g. `core_stimulus.html.erb` or refactored `core.html.erb`) that loads the **Stimulus** application and core-specific controllers. No React bundle.

Bootstrap data (current user, configuration, CSRF token) continues to be passed via meta tags or data attributes as today.

### Routes

Rails routes stay the single source of truth. No React Router.

- Full-page navigations (case list → case core → try N): **Turbo Drive** (or normal navigation). Same URLs: e.g. `/case/:id/try/:try_no`.
- In-place updates (query list, results, settings panel): **Turbo Frames**. Each frame has a `src` or is targeted by a form/link; the server returns full page or frame-only HTML.

Optional: dedicated controller actions that return only a Turbo Frame (e.g. `Case::QueriesController#index` for the query list frame) for clearer boundaries.

### Controller and View Structure

The core is currently one Angular view. Split by area:

- **Case::CoreController** (or equivalent): renders the core shell (layout, header, three-panel layout with frame placeholders).
- **Nested or sibling controllers** (or namespaced actions) for frame content: e.g. query list, search results, settings panel. Each can render a partial that is a Turbo Frame, or return HTML that Turbo replaces.

Stimulus controllers attach to the DOM inside the layout and inside frames (e.g. `data-controller="query-list"` on the query list frame).

### Entry Points and Directory Structure

**JavaScript (Stimulus + shared modules):**

```
app/javascript/
  controllers/
    application.js              # Stimulus application (existing)
    # Core-specific controllers (add during migration):
    query_workspace_controller.js
    query_list_controller.js
    add_query_form_controller.js
    search_results_controller.js
    rating_control_controller.js
    bulk_rating_controller.js
    settings_panel_controller.js
    try_selector_controller.js
    query_params_editor_controller.js
    scorer_picker_controller.js
    score_display_controller.js
    snapshot_manager_controller.js
    case_header_controller.js
    case_wizard_controller.js
    document_inspector_controller.js
    frog_report_controller.js
    # … (see Feature Modules below)
  api/
    client.js                   # fetch + CSRF + error handling (shared)
    cases.js
    queries.js
    ratings.js
    scorers.js
    snapshots.js
    tries.js
    search_endpoints.js
    # … (same API modules as React plan, used by Stimulus)
  lib/
    score_to_color.js           # Port qscoreSvc
    error_messages.js           # Port searchErrorTranslatorSvc
    curator_vars.js             # Port varExtractorSvc
    scorer_runner.js            # Port ScorerFactory (framework-agnostic)
```

**Rails views (core):**

```
app/views/case/core/
  show.html.erb                 # Shell: header + three-panel layout with frame placeholders
  _header.html.erb
  _query_list_frame.html.erb    # Turbo Frame: query list
  _search_results_frame.html.erb
  _settings_panel_frame.html.erb
  # Or under nested resources, e.g.:
  # app/views/case/queries/index.html.erb (frame only)
  # app/views/case/results/index.html.erb
  # app/views/case/settings/show.html.erb
```

Shared partials (modals, dropdowns, etc.) can live under `app/views/shared/` or case-specific folders. Structure to mirror the feature modules below.

### Coexistence Strategy

- **Feature flag:** e.g. `Rails.application.config.use_stimulus_core` or `use_react_core` vs Angular. `CoreController#index` (or equivalent) chooses which layout or which content to render.
- **Same URLs.** Angular and Stimulus cores never run on the same page; the flag selects one or the other. Safe rollback by flipping the flag.

## Feature Modules

Each Angular controller/component maps to Rails views/partials plus one or more Stimulus controllers. Same domain breakdown as the React plan; implementation is ERB + Stimulus (+ Turbo Frames).

### Feature: Query Workspace (main view)

**Replaces:** `MainCtrl`, `QueriesCtrl`, `queries` directive, `queriesLayout.html`

- **Rails:** Core shell view with three panels; Turbo Frames for query list, results, settings.
- **Stimulus:** `query_workspace_controller.js` (pane layout, resize if needed); `query_list_controller.js` (list behavior, expand/collapse); `add_query_form_controller.js` (add, submit).
- **Views/partials:** `_query_list_frame.html.erb`, query list item partials (query text, score badge, delete, reorder).

**Artifacts:**

| Rails | Stimulus | Notes |
|-------|----------|--------|
| `Case::CoreController#show`, core layout | `query_workspace_controller.js` | Shell, frame targets |
| Query list frame partial(s) | `query_list_controller.js` | List, expand/collapse, reorder (e.g. Sortable.js or native) |
| Add query form partial | `add_query_form_controller.js` | Submit via API or form; refresh frame or update DOM |
| — | `api/queries.js` + `api/client.js` | CRUD, search execution (splainer-search) |

### Feature: Search Results

**Replaces:** `SearchResultsCtrl`, `SearchResultCtrl`, `searchResults`/`searchResult` directives

- **Rails:** Partial(s) for results list; optional frame for “results for query N.”
- **Stimulus:** `search_results_controller.js` (fetch results, render or inject HTML); `rating_control_controller.js` (click to rate); `bulk_rating_controller.js` (rate all visible).
- **Shared:** `media_embed` partial or Stimulus for audio/image/video; explain view partial.

**Artifacts:**

| Rails | Stimulus | Notes |
|-------|----------|--------|
| Results frame partial(s) | `search_results_controller.js` | Run search (splainer-search), display list |
| Result item partial | `rating_control_controller.js` | Star/number rating, call ratings API |
| — | `bulk_rating_controller.js` | Bulk rate, refresh or update frame |
| Media partial | (optional) `media_embed_controller.js` | Replace quepidEmbed |
| Explain partial | — | Explain output, stacked chart (D3 from Stimulus) |
| — | `api/ratings.js` | Rating CRUD |

### Feature: Settings & Tries

**Replaces:** `QueryParamsCtrl`, `SettingsCtrl`, `CurrSettingsCtrl`, `CustomHeadersCtrl`, `queryParamsHistoryCtrl`, `QueryParamsDetailsCtrl`, settings directives

- **Rails:** Settings panel frame; partials for try selector, try history, query params editor (ACE/CodeMirror in a partial), custom headers, field spec, curator vars.
- **Stimulus:** `settings_panel_controller.js`; `try_selector_controller.js`; `query_params_editor_controller.js` (wire ACE); `custom_headers_controller.js`; `try_details_controller.js` (rename, delete, clone modals).

**Artifacts:**

| Rails | Stimulus | Notes |
|-------|----------|--------|
| Settings frame + partials | `settings_panel_controller.js` | Panel state, try id |
| Try selector partial | `try_selector_controller.js` | Dropdown, history; navigate or refresh frame |
| Query params partial | `query_params_editor_controller.js` | ACE/CodeMirror, save via API |
| Try details modal | `try_details_controller.js` | Rename, delete, clone |
| — | `api/tries.js` | Try CRUD, settings |

### Feature: Scoring

**Replaces:** `ScorerCtrl`, `ScorerFactory`, `qscoreSvc`, `scorerSvc`

- **Rails:** Partials for score display, score graph (container for D3), annotations list, scorer picker modal.
- **Stimulus:** `score_display_controller.js` (color bucket, port qscoreSvc to `lib/score_to_color.js`); `score_graph_controller.js` (D3 sparkline); `scorer_picker_controller.js`; `scorer_runner.js` (port ScorerFactory, framework-agnostic).

**Artifacts:**

| Rails | Stimulus | Notes |
|-------|----------|--------|
| Score display partial | `score_display_controller.js` | Score + color |
| Score graph partial | `score_graph_controller.js` | D3 sparkline |
| Annotations partial | (optional) `annotations_controller.js` | List of annotations |
| Scorer picker modal | `scorer_picker_controller.js` | Select scorer, save |
| — | `lib/scorer_runner.js` | Client-side scorer execution |
| — | `api/scorers.js` | Scorer CRUD |

### Feature: Snapshots & Diffs

**Replaces:** `TakeSnapshotCtrl`, `PromptSnapshotCtrl`, `QueryDiffResultsCtrl`, `diffResultsSvc`, `querySnapshotSvc`, `snapshotSearcherSvc`, `diff` component

- **Rails:** Partials for snapshot list, create snapshot modal, diff viewer (side-by-side), diff controls.
- **Stimulus:** `snapshot_manager_controller.js` (list, create, delete); `diff_viewer_controller.js` (load snapshots, show diff).

**Artifacts:**

| Rails | Stimulus | Notes |
|-------|----------|--------|
| Snapshot list + modals | `snapshot_manager_controller.js` | List, create, delete |
| Diff viewer partial | `diff_viewer_controller.js` | Side-by-side, snapshot picker |
| — | `api/snapshots.js` | Snapshot CRUD, diff |

### Feature: Case Management

**Replaces:** `CaseCtrl`, `WizardCtrl`, `WizardModalCtrl`, `UnarchiveCaseCtrl`, case-related components

- **Rails:** Case header partial; wizard steps as partials (select search engine, configure endpoint, add queries, review); modals: clone, delete, export, import ratings, share, unarchive.
- **Stimulus:** `case_header_controller.js` (rename, actions); `case_wizard_controller.js` (multi-step); modal controllers or reuse existing pattern for clone, delete, export, import, share, unarchive.

**Artifacts:**

| Rails | Stimulus | Notes |
|-------|----------|--------|
| Case header partial | `case_header_controller.js` | Name, rename, toolbar |
| Wizard partials (steps) | `case_wizard_controller.js` | Steps, submit |
| Clone/Delete/Export/Import/Share/Unarchive modals | Modal controllers or existing | Same API as React plan |
| — | `api/cases.js`, `api/exports.js`, `api/imports.js` | Case CRUD, export, import |

### Feature: Header Navigation

**Replaces:** `HeaderCtrl`, `_header_core_app.html.erb`

- **Rails:** Header partial (reuse or adapt `_header_core_app`); dropdowns for cases, books, user menu.
- **Stimulus:** `case_dropdown_controller.js`, `book_dropdown_controller.js`, `user_menu_controller.js` (or one `header_controller.js`). Load data via API or server-rendered.

**Artifacts:**

| Rails | Stimulus | Notes |
|-------|----------|--------|
| Header partial | `header_controller.js` or dropdown controllers | Case/book dropdowns, user menu |
| — | `api/cases.js`, `api/books.js` | Recent cases, books |

### Feature: Document Inspector

**Replaces:** `DetailedDocCtrl`, `DocExplainCtrl`, `DocFinderCtrl`, `docCacheSvc`, `debugMatches`, `expandContent`

- **Rails:** Modals/partials for detailed doc, doc explain, doc finder, debug matches; expandable content partial.
- **Stimulus:** `document_inspector_controller.js` (open modals, fetch doc, render); optional `doc_cache` in JS or server round-trips.

**Artifacts:**

| Rails | Stimulus | Notes |
|-------|----------|--------|
| Detailed doc / explain / finder / debug modals | `document_inspector_controller.js` | Open, fetch, display |
| — | `api/` + optional doc cache | Document fetch |

### Feature: FROG Report

**Replaces:** `frogReport` component

- **Rails:** FROG report modal partial.
- **Stimulus:** `frog_report_controller.js` (fetch report, display in modal).

**Artifacts:**

| Rails | Stimulus | Notes |
|-------|----------|--------|
| FROG modal partial | `frog_report_controller.js` | Fetch, display |

## Phases, risks, and timeline

**Do not maintain a second phasing checklist in this file.** What to ship, in what order, P0 acceptance, API dependencies, and technical risks (`splainer-search`, `ScorerFactory`, CSRF, URLs/proxy, JSONP) all live in [angularjs_elimination_plan.md](./angularjs_elimination_plan.md) (Phase 0 + Phases 1–10 workstreams, *Expectations* for calendar).

Use the **Feature modules**, **Rails integration**, and **directory structure** sections above to translate those plan phases into concrete Stimulus controllers, Turbo Frames, and `app/javascript/api/*` modules.

## Angular Service to Stimulus/Rails Mapping

| Angular Service | Stimulus/Rails Replacement | Notes |
|-----------------|----------------------------|--------|
| `queriesSvc` | `api/queries.js` + `query_list_controller.js`, `add_query_form_controller.js` | State in DOM/frame; CRUD via API |
| `caseSvc` | `api/cases.js` + `case_header_controller.js`, dropdowns | |
| `settingsSvc` | `api/tries.js` + `settings_panel_controller.js`, try controllers | |
| `scorerSvc` | `api/scorers.js` + `lib/scorer_runner.js` + `score_display_controller.js` | |
| `ratingsStoreSvc` | `api/ratings.js` + `rating_control_controller.js`, `bulk_rating_controller.js` | |
| `querySnapshotSvc` | `api/snapshots.js` + `snapshot_manager_controller.js`, `diff_viewer_controller.js` | |
| `caseTryNavSvc` | Rails routes + Turbo Drive; optional `lib/navigation.js` for protocol | |
| `configurationSvc` | Bootstrap data in layout; read in Stimulus via values | |
| `bootstrapSvc` | Same; current user in data attributes/meta | |
| `docCacheSvc` | Optional small cache in JS or server round-trips; `document_inspector_controller.js` | |
| `broadcastSvc` | Turbo Streams or custom events; Stimulus actions | |
| `caseCSVSvc` / `importRatingsSvc` | `api/exports.js`, `api/imports.js` | |
| `paneSvc` | CSS + optional resize in `query_workspace_controller.js` | |
| `qscoreSvc` | `lib/score_to_color.js` | Pure function |
| `searchErrorTranslatorSvc` | `lib/error_messages.js` | Pure function |
| `varExtractorSvc` | `lib/curator_vars.js` | Pure function |
| `ScorerFactory` | `lib/scorer_runner.js` | Framework-agnostic |
| `TryFactory` / `SettingsFactory` / `SnapshotFactory` | Plain objects + API responses | |

## Summary: Where This Diverges from the React Plan

| React plan | Rails-Stimulus plan |
|------------|---------------------|
| React 19 + React Router | Stimulus + Turbo (Frames, Streams, Drive); Rails routes |
| Zustand / TanStack Query | Server + DOM + minimal Stimulus state; Turbo Streams for live |
| New React bundle + `core_react.html.erb` | Single core layout + existing Stimulus app + core controllers |
| Vitest + React Testing Library | System tests + optional Stimulus unit tests (Jest/Vitest) |
| Feature modules as React components/hooks | Same domains; ERB + Stimulus (+ Turbo Frames) |
| API, CSRF, URLs, risks | Same approach; no divergence |

The React plan is a valid path. This doc keeps the core on Rails + Stimulus + Turbo; **shared** scope, phases, and risks are defined once in [angularjs_elimination_plan.md](./angularjs_elimination_plan.md).

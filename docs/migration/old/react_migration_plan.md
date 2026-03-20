# React Migration Plan

Replacing the AngularJS core UI with React.

> **Alternative approach:** For a Rails-native perspective using Stimulus and Turbo instead of React, see [Rails-Native Migration: Where to Diverge](../rails_stimulus_migration_alternative.md).

## Guiding Principles

1. **Incremental migration** — Angular and React coexist during migration. We don't rewrite everything at once.
2. **API stays the same** — The Rails JSON API (`/api/v1/`) is stable and well-tested. React components call the same endpoints.
3. **Rails remains the host** — React runs inside a Rails layout, not as a separate SPA. Rails handles auth, CSRF, and serves the page.
4. **No feature regression** — Every migrated piece must match existing functionality before we remove the Angular version.
5. **Improve where it makes sense** — Fix UX pain points during migration, but don't redesign everything simultaneously.

## Technology Choices

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Framework | React 19 | Modern, well-supported, large ecosystem |
| Build | esbuild (existing) | Already in use for Angular bundles; fast; no new toolchain needed |
| Routing | React Router v7 | Standard React routing; replaces ngRoute |
| State management | Zustand or React Query (TanStack Query) | Lightweight; TanStack Query for server state caching/sync, Zustand for UI state |
| HTTP client | fetch (native) | No need for axios; Rails API is simple REST |
| CSS | Existing CSS + Bootstrap 5 | Already in use app-wide; no change needed |
| Charts | D3 (existing) or Recharts | D3 already bundled; Recharts for simpler chart components |
| Modals | Bootstrap 5 modals via React | Match existing Bootstrap modal patterns |
| Testing | Vitest + React Testing Library | Fast, modern, replaces Karma+Jasmine |
| TypeScript | Optional/progressive | Start with JS, add TS to new files over time |

## Rails Integration Approach

### Layout

Create a new layout `core_react.html.erb` (alongside existing `core.html.erb`) that:
- Loads the React bundle instead of Angular bundles
- Passes bootstrap data via `<script>` tags (current user, configuration, CSRF token)
- Mounts React at a root div: `<div id="react-root"></div>`

### Entry Point

```
app/javascript/react/
  index.jsx            # React root, router setup
  App.jsx              # Top-level layout component
  routes.jsx           # Route definitions
  api/                 # API client functions
  components/          # Shared/reusable components
  features/            # Feature-based modules (see below)
  hooks/               # Custom React hooks
  stores/              # Zustand stores (or TanStack Query config)
  utils/               # Utility functions
```

### Build Integration

Add to `package.json`:
```json
"build:react": "esbuild app/javascript/react/index.jsx --bundle --sourcemap --format=iife --outdir=app/assets/builds --loader:.jsx=jsx",
"build:react:watch": "esbuild app/javascript/react/index.jsx --bundle --sourcemap --format=iife --outdir=app/assets/builds --loader:.jsx=jsx --watch"
```

### Coexistence Strategy

During migration, Angular and React run on **different routes**:
- Angular: `/case/:id/try/:tryNo` (existing `core.html.erb` layout)
- React: `/case/:id/try/:tryNo` (new `core_react.html.erb` layout)

Use a **feature flag** (e.g., `Rails.application.config.use_react_core`) to switch which layout `CoreController#index` renders. This allows safe rollback.

## Feature Modules

Each Angular controller/component maps to a React feature module. Organized by domain, not by Angular artifact type.

### Feature: Query Workspace (the main view)

**Replaces:** `MainCtrl`, `QueriesCtrl`, `queries` directive, `queriesLayout.html`

This is the primary view users interact with. It contains:
- Query list (left panel)
- Search results per query (center)
- Settings/try pane (right)

```
features/query-workspace/
  QueryWorkspace.jsx         # Main layout (replaces queriesLayout.html)
  QueryList.jsx              # Query list with add/delete/reorder
  QueryItem.jsx              # Single query row with score, expand/collapse
  AddQueryForm.jsx           # Add query input (replaces add_query component)
  QueryNotes.jsx             # Query notes modal
  useQueries.js              # Hook: query CRUD, search execution, scoring
  useQueryWorkspace.js       # Hook: workspace-level UI state
```

### Feature: Search Results

**Replaces:** `SearchResultsCtrl`, `SearchResultCtrl`, `searchResults`/`searchResult` directives

```
features/search-results/
  SearchResults.jsx          # Results list container
  SearchResultItem.jsx       # Individual result with rating, fields, media
  RatingControl.jsx          # Star/number rating widget
  BulkRatingBar.jsx          # Bulk rating controls
  MediaEmbed.jsx             # Audio/image/video embed (replaces quepidEmbed)
  ExplainView.jsx            # Explain output display
  StackedChart.jsx           # D3 stacked chart for explain breakdown
  useRatings.js              # Hook: rating CRUD, bulk operations
```

### Feature: Settings & Tries

**Replaces:** `QueryParamsCtrl`, `SettingsCtrl`, `CurrSettingsCtrl`, `CustomHeadersCtrl`, `queryParamsHistoryCtrl`, `QueryParamsDetailsCtrl`, settings directives

```
features/settings/
  SettingsPanel.jsx          # Right pane: current try, settings editor
  TrySelector.jsx            # Try dropdown with history
  TryHistory.jsx             # Try timeline (replaces queryParamsHistory)
  TryDetails.jsx             # Try detail modal (rename, delete, clone)
  QueryParamsEditor.jsx      # Query template editor (ACE/CodeMirror)
  CustomHeadersEditor.jsx    # API key / custom JSON headers
  FieldSpecEditor.jsx        # Field specification input
  CuratorVars.jsx            # ##variable## management
  useSettings.js             # Hook: try CRUD, settings state
```

### Feature: Scoring

**Replaces:** `ScorerCtrl`, `ScorerFactory`, `qscoreSvc`, `scorerSvc`

```
features/scoring/
  ScorerPicker.jsx           # Scorer selection modal
  ScoreDisplay.jsx           # Score with color bucket (replaces qscoreQuery/qscoreCase)
  ScoreGraph.jsx             # D3 sparkline chart (replaces qgraph)
  AnnotationsList.jsx        # Score annotations (replaces annotations component)
  AnnotationItem.jsx         # Single annotation
  ScorerRunner.js            # Client-side scorer execution (port ScorerFactory logic)
  useScoring.js              # Hook: scorer CRUD, score calculation
```

### Feature: Snapshots & Diffs

**Replaces:** `TakeSnapshotCtrl`, `PromptSnapshotCtrl`, `QueryDiffResultsCtrl`, `diffResultsSvc`, `querySnapshotSvc`, `snapshotSearcherSvc`, `diff` component

```
features/snapshots/
  SnapshotManager.jsx        # Snapshot list and actions
  CreateSnapshotModal.jsx    # Snapshot creation dialog
  DiffViewer.jsx             # Side-by-side diff display
  DiffControls.jsx           # Snapshot selection for comparison
  useSnapshots.js            # Hook: snapshot CRUD, diff computation
```

### Feature: Case Management

**Replaces:** `CaseCtrl`, `WizardCtrl`, `WizardModalCtrl`, `UnarchiveCaseCtrl`, case-related components

```
features/case-management/
  CaseHeader.jsx             # Case name, rename, actions toolbar
  CaseWizard.jsx             # Multi-step case creation (replaces 828-line WizardModalCtrl)
  CaseWizardSteps/
    SelectSearchEngine.jsx
    ConfigureEndpoint.jsx
    AddQueries.jsx
    ReviewAndCreate.jsx
  CaseActions.jsx            # Clone, delete, export, import, share buttons
  CloneCaseModal.jsx
  DeleteCaseModal.jsx
  ExportCaseModal.jsx
  ImportRatingsModal.jsx
  ShareCaseModal.jsx
  UnarchiveModal.jsx
  useCase.js                 # Hook: case CRUD, metadata
```

### Feature: Header Navigation

**Replaces:** `HeaderCtrl`, `_header_core_app.html.erb`

```
features/header/
  AppHeader.jsx              # Main header bar
  CaseDropdown.jsx           # Recent cases dropdown
  BookDropdown.jsx           # Recent books dropdown
  UserMenu.jsx               # User avatar, logout
```

### Feature: Document Inspector

**Replaces:** `DetailedDocCtrl`, `DocExplainCtrl`, `DocFinderCtrl`, `docCacheSvc`, `debugMatches`, `expandContent`

```
features/document-inspector/
  DetailedDocModal.jsx       # Full document view
  DocExplainModal.jsx        # Query explanation detail
  DocFinder.jsx              # Advanced document search
  DebugMatchesModal.jsx      # Match debugging
  ExpandableContent.jsx      # Generic expandable content
  useDocCache.js             # Hook: document caching
```

### Feature: FROG Report

**Replaces:** `frogReport` component

```
features/frog-report/
  FrogReportModal.jsx        # FROG analysis report
  useFrogReport.js
```

### Shared Components & Hooks

```
components/
  Modal.jsx                  # Bootstrap 5 modal wrapper
  Dropdown.jsx               # Bootstrap dropdown
  Flash.jsx                  # Flash message display
  Pagination.jsx             # Pagination controls
  AceEditor.jsx              # ACE editor wrapper (or CodeMirror)
  JsonExplorer.jsx           # JSON tree viewer (replace ng-json-explorer)
  LoadingSpinner.jsx
  ConfirmDialog.jsx

hooks/
  useApi.js                  # Base fetch wrapper with CSRF, error handling
  useCurrentUser.js          # Current user context
  useConfig.js               # App configuration (feature flags)
  useDebounce.js
  useLocalStorage.js

api/
  client.js                  # Base API client (fetch + CSRF + error handling)
  cases.js                   # Case API calls
  queries.js                 # Query API calls
  ratings.js                 # Rating API calls
  scorers.js                 # Scorer API calls
  snapshots.js               # Snapshot API calls
  tries.js                   # Try/settings API calls
  searchEndpoints.js         # Search endpoint API calls
  books.js                   # Book API calls
  teams.js                   # Team API calls
  users.js                   # User API calls
  exports.js                 # Export API calls
  imports.js                 # Import API calls

stores/
  workspaceStore.js          # UI state: pane sizes, view toggles, collapsed queries
  configStore.js             # App config from Rails (communal scorers, sortable queries)
```

## Migration Phases

### Phase 0: Infrastructure (1-2 weeks)

**Goal:** React runs alongside Angular with zero user impact.

- [ ] Add React 19, React DOM, React Router to `package.json`
- [ ] Create esbuild config for React bundle (`build:react`)
- [ ] Create `core_react.html.erb` layout
- [ ] Create React entry point with router skeleton
- [ ] Add feature flag `use_react_core` to `CoreController`
- [ ] Set up API client module with CSRF handling (port `ng-rails-csrf` interceptor)
- [ ] Set up Vitest + React Testing Library
- [ ] Verify: React app mounts, routes work, API calls succeed

### Phase 1: Header + Case Shell (1-2 weeks)

**Goal:** React renders the page chrome around an empty workspace.

- [ ] `AppHeader` component with case/book dropdowns
- [ ] `CaseHeader` with name display and rename
- [ ] `LoadingSpinner` for initial data fetch
- [ ] `useCurrentUser` hook (port `bootstrapSvc`)
- [ ] `useCase` hook (port `caseSvc.selectCase`)
- [ ] `useConfig` hook (port `configurationSvc`)
- [ ] Basic routing: `/case/:caseNo/try/:tryNo`

### Phase 2: Query List (2-3 weeks)

**Goal:** Users can see their queries and scores — the most visible part of the UI.

- [ ] `QueryWorkspace` layout (three-panel: queries / results / settings)
- [ ] `QueryList` with query items showing query text + score badge
- [ ] `AddQueryForm` for adding new queries
- [ ] Query delete, reorder (drag-and-drop)
- [ ] `ScoreDisplay` component with color buckets
- [ ] `useQueries` hook (port `queriesSvc` core methods)
- [ ] `useScoring` hook (port `scorerSvc.bootstrap`, `ScorerFactory.score`)
- [ ] Query expand/collapse state

### Phase 3: Search Results + Rating (2-3 weeks)

**Goal:** The core feedback loop works — search, view results, rate documents.

- [ ] `SearchResults` container per query
- [ ] `SearchResultItem` with fields, title, ID
- [ ] `RatingControl` — click to rate
- [ ] `BulkRatingBar` — rate all visible
- [ ] `MediaEmbed` for audio/image/video fields
- [ ] `useRatings` hook (port `ratingsStoreSvc`)
- [ ] Integration with `splainer-search` library for search execution
- [ ] Error handling (port `searchErrorTranslatorSvc`)

### Phase 4: Settings Panel (2 weeks)

**Goal:** Users can modify tries and see their search configuration.

- [ ] `SettingsPanel` right pane
- [ ] `TrySelector` dropdown
- [ ] `TryHistory` timeline
- [ ] `QueryParamsEditor` with code editor
- [ ] `CustomHeadersEditor`
- [ ] `FieldSpecEditor`
- [ ] `CuratorVars` management
- [ ] `useSettings` hook (port `settingsSvc`)
- [ ] `TryDetails` modal (rename, delete, clone)

### Phase 5: Scoring Visualization (1-2 weeks)

**Goal:** Score history graphs and annotations work.

- [ ] `ScoreGraph` (D3 sparkline, port `qgraph`)
- [ ] `AnnotationsList` and `AnnotationItem`
- [ ] `ScorerPicker` modal
- [ ] `ScorerRunner` — client-side scorer evaluation (port `ScorerFactory` logic)
- [ ] Case-level score display with graph

### Phase 6: Snapshots & Diffs (1-2 weeks)

**Goal:** Users can snapshot results and compare across tries.

- [ ] `SnapshotManager` (list, create, delete)
- [ ] `CreateSnapshotModal`
- [ ] `DiffViewer` side-by-side comparison
- [ ] `DiffControls` snapshot picker
- [ ] `useSnapshots` hook

### Phase 7: Case Wizard + Actions (2 weeks)

**Goal:** Users can create new cases and perform case operations.

- [ ] `CaseWizard` multi-step flow (replace 828-line `WizardModalCtrl`)
- [ ] `CloneCaseModal`, `DeleteCaseModal`, `ExportCaseModal`
- [ ] `ImportRatingsModal` (CSV, RRE, LTR formats)
- [ ] `ShareCaseModal`
- [ ] `UnarchiveModal`

### Phase 8: Document Inspector + Analysis (1-2 weeks)

**Goal:** Advanced analysis features work.

- [ ] `DetailedDocModal` — full document field view
- [ ] `DocExplainModal` — explain output
- [ ] `DocFinder` — advanced search with explain extraction
- [ ] `DebugMatchesModal`
- [ ] `FrogReportModal`
- [ ] `ExplainView` and `StackedChart`
- [ ] `JsonExplorer` component (replace ng-json-explorer)

### Phase 9: Polish + Parity Testing (1-2 weeks)

**Goal:** React version matches Angular feature-for-feature.

- [ ] End-to-end testing of all workflows
- [ ] Keyboard shortcuts / accessibility
- [ ] URL handling (deep links, back/forward)
- [ ] HTTPS/HTTP protocol handling (Solr JSONP edge case)
- [ ] Error states and edge cases
- [ ] Performance comparison
- [ ] Mobile/responsive behavior

### Phase 10: Cutover (1 week)

**Goal:** Angular code removed.

- [ ] Flip feature flag to React as default
- [ ] Monitor for regressions
- [ ] Remove Angular bundles, templates, controllers, services, factories, directives, components
- [ ] Remove Angular npm dependencies (angular, angular-*, ng-*, etc.)
- [ ] Remove `build:angular-*` scripts
- [ ] Remove Karma/Jasmine test infrastructure
- [ ] Remove `core.html.erb` Angular layout
- [ ] Update `app_structure.md` documentation

## Key Migration Risks & Mitigations

### 1. `splainer-search` Library

The `splainer-search` npm package is a core dependency that abstracts search engine communication (Solr, ES, OpenSearch, Vectara, Algolia, SearchAPI). It is an AngularJS module (`o19s.splainer-search`).

**Risk:** It depends on AngularJS `$http` and `$q`.

**Mitigation:** Fork or wrap `splainer-search` to work with native `fetch` and `Promise`. This is the single biggest technical risk and should be investigated in Phase 0.

### 2. Client-Side Scorer Execution

`ScorerFactory` (18KB) evaluates user-written JavaScript scoring code using `eval()`. This is complex and security-sensitive.

**Mitigation:** Port carefully. Consider running scorer code in a Web Worker for isolation. Keep the same API contract.

### 3. CSRF Token Handling

Angular uses an interceptor to inject CSRF tokens. React needs equivalent behavior.

**Mitigation:** Simple — read meta tag, add to fetch headers. Solve in Phase 0.

### 4. URL Compatibility

Users have bookmarked `/case/123/try/5` URLs. React Router must handle the same URL patterns.

**Mitigation:** Use the same route patterns. React Router v7 supports this naturally.

### 5. HTTP/HTTPS Mixed Content

Quepid has special protocol handling for Solr JSONP over HTTP.

**Mitigation:** Port `caseTryNavSvc` protocol logic to React. Test with real Solr instances.

## Angular Service to React Hook/API Mapping

| Angular Service | React Replacement | Notes |
|----------------|-------------------|-------|
| `queriesSvc` | `useQueries` hook + `api/queries.js` | Largest service; split into hook (state) and API (calls) |
| `caseSvc` | `useCase` hook + `api/cases.js` | |
| `settingsSvc` | `useSettings` hook + `api/tries.js` | |
| `scorerSvc` | `useScoring` hook + `api/scorers.js` | |
| `ratingsStoreSvc` | `useRatings` hook + `api/ratings.js` | |
| `querySnapshotSvc` | `useSnapshots` hook + `api/snapshots.js` | |
| `caseTryNavSvc` | React Router + `utils/navigation.js` | |
| `configurationSvc` | `useConfig` hook + `configStore` | |
| `bootstrapSvc` | `useCurrentUser` hook | |
| `docCacheSvc` | `useDocCache` hook (or TanStack Query cache) | |
| `broadcastSvc` | React context / Zustand store / event emitter | No more `$rootScope.$broadcast` |
| `caseCSVSvc` | `api/exports.js` | Server-side export already exists |
| `importRatingsSvc` | `api/imports.js` | |
| `paneSvc` | CSS + `workspaceStore` | |
| `qscoreSvc` | `utils/scoreToColor.js` | Pure function |
| `searchErrorTranslatorSvc` | `utils/errorMessages.js` | Pure function |
| `varExtractorSvc` | `utils/curatorVars.js` | Pure function |
| `ScorerFactory` | `ScorerRunner.js` class | Complex; port carefully |
| `TryFactory` | Plain objects + utility functions | |
| `SettingsFactory` | `useSettings` hook state | |
| `SnapshotFactory` | Plain objects + utility functions | |

## Estimated Timeline

| Phase | Duration | Cumulative |
|-------|----------|-----------|
| 0: Infrastructure | 1-2 weeks | 2 weeks |
| 1: Header + Shell | 1-2 weeks | 4 weeks |
| 2: Query List | 2-3 weeks | 7 weeks |
| 3: Search Results + Rating | 2-3 weeks | 10 weeks |
| 4: Settings Panel | 2 weeks | 12 weeks |
| 5: Scoring Visualization | 1-2 weeks | 14 weeks |
| 6: Snapshots & Diffs | 1-2 weeks | 16 weeks |
| 7: Case Wizard + Actions | 2 weeks | 18 weeks |
| 8: Document Inspector | 1-2 weeks | 20 weeks |
| 9: Polish + Parity | 1-2 weeks | 22 weeks |
| 10: Cutover | 1 week | 23 weeks |

**Realistic estimate: 5-6 months** for a complete migration with one developer working consistently. Phases can overlap and parallelize with multiple developers.

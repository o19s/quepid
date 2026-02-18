# Functionality Gap Report: deangularjs-experimental vs main

**Generated:** February 17, 2026
**Updated:** February 17, 2026
**Branch:** `deangularjs-experimental`
**Compared against:** `main` (AngularJS workspace)
**Purpose:** Identify every piece of user-facing functionality present on `main` that is missing or incomplete in `deangularjs-experimental`.
**Note:** Angular has been **completely removed** from this branch. All `app/assets/javascripts/services/`, `factories/`, and `components/` directories are gone. The modern stack (36 ViewComponents, 50 Stimulus controllers, Turbo Frames/Streams) is the sole frontend implementation.

---

## Executive Summary

The `deangularjs-experimental` branch migrates the core case/try workspace from AngularJS to Stimulus + ViewComponents + Turbo. The core workflow loop (query list, search results, rating, snapshots, exports) is solid. However, several power-user features remain unimplemented, most notably the detailed document viewer, try history browser, curator variable tuning knobs, and the guided new-case wizard.

---

## What's Working Well

The following features are fully functional in the new branch:

- Query list with drag-reorder (SortableJS), client-side filter, sort, score badges
- Live search results with pagination ("Load more")
- Inline rating via Bootstrap popover (individual docs)
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
- All Angular routes have Rails equivalents
- All API endpoints are preserved

---

## HIGH PRIORITY GAPS (Core Workspace Features)

### 1. Detailed Document View / Full Field Explorer

**Angular:** Clicking a document title opened a modal showing ALL document fields, translations, media embeds (audio/video/image), raw JSON via ACE editor, and a "View Document" link.

**New:** Only a brief 3-field preview string (`fields_preview`) is shown on each document card. No way to browse full document data from the workspace.

**Files:** `app/components/document_card_component.html.erb` (limited preview only)

### 2. Try History Browser + Try Management

**Angular:** The Settings panel had a "History" tab showing all previous tries with the ability to view details, rename, duplicate, or delete tries. Clicking "..." on a try opened a modal with full query params, field spec, search endpoint, and curator variables.

**New:** Only the current try's params are shown. No history browser, no try rename/duplicate/delete from the workspace. The `QueryParamsPanelComponent` explicitly states: *"Query sandbox, tuning knobs, and history are available in the legacy Angular workspace."*

**Files:** `app/components/query_params_panel_component.html.erb` (line 12-13), `app/javascript/controllers/query_params_panel_controller.js` (toggle only)

### 3. Curator Variables / Tuning Knobs (`##varName##`)

**Angular:** `varExtractorSvc` parsed `##variableName##` placeholders from query params and displayed editable input fields ("Tuning Knobs" tab) so users could adjust boost values without editing raw JSON. The `TryFactory` managed curator vars (`curatorVarsDict()`, `hasVar`, `getVar`, `addVar`, `updateVars`).

**New:** Not implemented. `query_params_panel_controller.js` only toggles panel visibility.

### 4. New Case Setup Wizard

**Angular:** A 6-step guided wizard (Welcome -> Name -> Endpoint selection with Solr/ES/OS/Vectara/Algolia -> Field spec setup -> First query -> Finish). Included URL ping/validation, CORS/proxy options, basic auth, custom headers, field spec typeahead, static file CSV upload.

**New:** `NewCaseWizardComponent` is a simple 3-bullet instruction card. None of the guided endpoint setup steps are present.

**Files:** `app/components/new_case_wizard_component.html.erb`

### 5. Client-Side Real-Time Scoring

**Angular:** `ScorerFactory.runCode()` executed custom JavaScript scorer code in the browser instantly after each rating change, providing immediate feedback.

**New:** Scoring requires a server round-trip (`POST /run_evaluation` -> `RunCaseEvaluationJob`). Score updates are not instantaneous after rating changes. The `qscore:update` custom event mechanism exists but the full pipeline (job -> broadcast -> DOM update) may not be complete for all cases.

---

## MEDIUM PRIORITY GAPS

### 6. Bulk Rating (Rate All Docs in Query)

**Angular:** "Score All" buttons in the results pane applied a single rating to all visible docs in a query. `rateBulkSvc` handled this.

**New:** Only DocFinder has bulk rating buttons. The main results pane only supports individual doc rating via popover.

### 7. Search Endpoint Switching from Workspace

**Angular:** Typeahead popup (`searchEndpoint_popup.html`) to search and select endpoints from within the Settings panel.

**New:** Links to a separate page for editing search endpoints. No in-workspace endpoint switcher or typeahead.

**Files:** `app/components/settings_panel_component.html.erb`

### 8. Side-by-Side Diff View

**Angular:** Dedicated columnar view (`queryDiffResults.html`) showing "Current Results" vs snapshot columns side-by-side, each with full search result rows and ratings.

**New:** Inline position-delta badges only ("was #5 in Snapshot X", "new in current"). Functional but less visual for deep analysis. Also, Angular supported up to 5 snapshot comparisons; the new default is 3 (configurable).

### 9. Media Embeds, Translations, Per-Field Type Rendering

**Angular:** Document cards rendered `doc.embeds` (audio/video/image) via the `quepid-embed` directive, `doc.translations` with Google Translate links, and `doc.unabridgeds` for full field content.

**New:** Plain text `fields_preview` only. No media rendering, no translations, no per-field type formatting.

### 10. Book/Judgement Sync from Workspace

**Angular:** `bookSvc.updateQueryDocPairs` pushed current workspace ratings back to a judgement book. Also `associateBook` for linking a book to a case.

**New:** You can pull ratings FROM a book (via Frog Report refresh) but cannot push ratings TO a book from the workspace. No Stimulus controller found for this.

### 11. Diff Numeric Scores

**Angular:** `diffResultsSvc` computed a numeric score for how results changed vs. the snapshot (NDCG-style comparison). Per-query `diffScore` was attached to each query.

**New:** Only positional comparison badges, no numeric diff score.

### 12. Draggable Pane Splitter

**Angular:** `paneSvc` provided a mouse-drag slider to resize the east/west panels to any pixel width. `eastPaneWidth` value was tracked.

**New:** Binary collapse/expand only via `workspace_panels_controller.js`. No fine-grained resizing.

---

## LOW PRIORITY GAPS (Intentional Design Changes or Edge Cases)

### 13. ACE Editor for Query Params

**Angular:** Syntax-highlighted ACE editor (`ace_config.js`) for editing query params JSON with bracket matching and auto-formatting.

**New:** Plain `<textarea>` in `SettingsPanelComponent`.

### 14. Per-Query Parameter Overrides

**Angular:** `DevQueryParamsCtrl` allowed per-query parameter overrides ("tuning knobs" at the query level).

**New:** Not implemented.

### 15. Querqy Rule Triggered Indicator

**Angular:** A Querqy icon appeared in search results when a Querqy rewrite rule was triggered.

**New:** Not present.

### 16. "Browse N Results on Solr" Link

**Angular:** Direct link to view the full results on Solr's admin UI when `searchEngine == 'solr'`.

**New:** Not present.

### 17. `trackLastViewedAt` Metadata

**Angular:** `PUT api/cases/:id/metadata` tracked when a case was last viewed for sorting purposes.

**New:** No equivalent call found in Stimulus controllers.

### 18. Scorer Management from Workspace

**Angular:** Full CRUD modals within the workspace: create, edit, clone, delete, share scorers.

**New:** Only scorer *selection* (via `scorer_panel_controller.js`) is available. All other scorer management requires navigating to `/scorers`.

### 19. Query Pagination

**Angular:** `dir-pagination-controls` paginated the query list for cases with many queries.

**New:** All queries render at once (no pagination). Filter/sort helps but large cases may be slow.

### 20. Shepherd Onboarding Tour

**Angular:** `tour.js` with guided Shepherd tour for new users.

**New:** Deleted; no replacement.

### 21. Depth of Rating Warning

**Angular:** "Note: Only the top N results are used in scoring calculations" warning shown below results.

**New:** Not present.

### 22. `docCache` Module Unused

**Angular:** `docCacheSvc` provided an in-memory document cache shared across controllers.

**New:** `app/javascript/modules/doc_cache.js` was ported as a clean `DocCache` class but is not wired to any Stimulus controller. Snapshot doc fetching goes directly to the server API.

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

All of the following Angular components have equivalent ViewComponents + Stimulus controllers:

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
| `new_case` | `NewCaseComponent` | (static form) |
| `qgraph` | `QgraphComponent` | `qgraph_controller.js` |
| `qscore_case` | `QscoreCaseComponent` | `qscore_controller.js` |
| `qscore_query` | `QscoreQueryComponent` | `qscore_controller.js` |
| `query_explain` | `QueryExplainComponent` | `query_explain_controller.js` |
| `query_options` | `QueryOptionsComponent` | `query_options_controller.js` |
| `share_case` | `ShareCaseComponent` | `share_case_controller.js` |
| `take_snapshot` | `TakeSnapshotComponent` | `take_snapshot_controller.js` |

---

## Angular Services Replacement Summary

| Angular Service | Replacement | Status |
|---|---|---|
| `caseTryNavSvc` | `utils/quepid_root.js` + Turbo Drive | Fully replaced |
| `docCacheSvc` | `modules/doc_cache.js` (ported but unused) | Available, unwired |
| `qscore_service` | `qscore_controller.js` | Fully replaced |
| `annotationsSvc` | `annotations_controller.js` | Fully replaced |
| `ratingsStoreSvc` + `rateElementSvc` | `results_pane_controller.js` | Fully replaced |
| `rateBulkSvc` | `doc_finder_controller.js` (partial) | Gap: main results pane lacks bulk rating |
| `caseSvc` | Rails controllers + Stimulus modals | Fully replaced |
| `scorerSvc` | `scorer_panel_controller.js` | Fully replaced |
| `queriesSvc` | `add_query_controller.js` + `delete_query_controller.js` + `query_list_controller.js` | Fully replaced |
| `querySnapshotSvc` | `take_snapshot_controller.js` + `diff_controller.js` | Fully replaced |
| `snapshotSearcherSvc` | `results_pane_controller.js` (server-side fetch) | Fully replaced |
| `settingsSvc` | `settings_panel_controller.js` | Fully replaced |
| `bootstrapSvc` | Server-rendered page + Rails auth | Fully replaced |
| `configurationSvc` | Stimulus `values` from ViewComponents | Fully replaced |
| `bookSvc` | `judgements_controller.js` (partial) | Gap: `updateQueryDocPairs` missing |
| `teamSvc` | Server-side Rails views | Fully replaced |
| `userSvc` | Rails `current_user` | Fully replaced |
| `importRatingsSvc` | `import_ratings_controller.js` | Fully replaced |
| `caseCSVSvc` | `ExportCaseService` (Ruby, server-side) | Fully replaced (improved) |
| `paneSvc` | `workspace_panels_controller.js` | Gap: no drag-resize |
| `queryViewSvc` | Custom events + data attributes | Fully replaced |
| `searchEndpointSvc` | Rails views | Gap: no workspace switcher |
| `searchErrorTranslatorSvc` | Server-side error handling | Fully replaced |
| `diffResultsSvc` | `diff_controller.js` + `results_pane_controller.js` | Gap: no numeric diff score |
| `varExtractorSvc` | Not implemented | Gap |
| `broadcastSvc` | CustomEvent + Turbo Streams | Fully replaced |
| `docListFactory` | `QuerySearchService` (server-side) | Fully replaced |
| `ScorerFactory` | Server-side scoring + `qscore_controller.js` | Gap: no client-side real-time scoring |
| `SettingsFactory` | `settings_panel_controller.js` | Gap: no try management |
| `TryFactory` | Server-rendered try data | Gap: no curator vars |
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
- Score updates after rating use a two-tier approach: lightweight `QueryScoreService` for immediate per-query score feedback, plus debounced `RunCaseEvaluationJob` for full case-level scoring via Turbo Stream broadcasts
- Search execution goes through `QuerySearchService` (Rails proxy to search engine), eliminating CORS issues but adding latency
- The `docCache` module (`app/javascript/modules/doc_cache.js`) was ported as a clean JS class but is not currently wired to any Stimulus controller — docs come fresh from the server per request
- All Angular code is removed; there is no fallback to the legacy stack

---

## References

- [docs/workspace_behavior.md](workspace_behavior.md) -- Current workspace behavior
- [docs/workspace_api_usage.md](workspace_api_usage.md) -- API contracts
- [docs/angular_services_responsibilities_mapping.md](angular_services_responsibilities_mapping.md) -- Service migration
- [docs/per_component_migration_checklist.md](per_component_migration_checklist.md) -- Component list
- [docs/code_review_angular_removal.md](code_review_angular_removal.md) -- Code review findings
- [docs/turbo_frame_boundaries.md](turbo_frame_boundaries.md) -- Turbo Frame structure
- [docs/view_component_conventions.md](view_component_conventions.md) -- ViewComponent patterns

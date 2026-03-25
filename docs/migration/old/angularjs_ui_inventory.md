# AngularJS UI Inventory

A comprehensive catalog of everything the Angular UI displays in Quepid, organized by functional area. Each item references the screenshot(s) where it is visible, using images from `docs/images/core_case_evaluation_manual/`.

**Screenshot legend:** `SS-01` = `01_full_layout.png`, `W4b` = `wizard_04b_engine_selection.png`, etc.

**Source legend** — each screenshot description is tagged with how it was produced:
- No tag = **captured from the running app** via Playwright
- **🟡 mockup: real template** = rendered from the actual Angular template HTML with dummy data substituted for `{{ }}` bindings. Faithful to the real component layout.
- **🟠 mockup: approximation** = hand-built HTML that represents the component's visual appearance but was not derived from the actual template. May differ from the real rendering in styling details.

**Current codebase column (below):** Where the same behavior is implemented today on the **Rails + Stimulus** core case UI—mainly `app/views/core/*.html.erb`, `app/views/layouts/core.html.erb`, `app/views/layouts/_header.html.erb`, and `app/javascript/controllers/` plus shared modules under `app/javascript/modules/`. The **File(s)** / Angular paths in other columns remain as historical references to the old frontend; core pages load `application_modern` only (no Angular bundle).

---

## Table of Contents

- [Page Layout & Navigation](#page-layout--navigation)
- [Case Header & Score Display](#case-header--score-display)
- [Case Action Bar](#case-action-bar)
- [Query List](#query-list)
- [Search Results](#search-results)
- [Query Parameters / Tune Relevance Panel](#query-parameters--tune-relevance-panel)
- [Modals & Dialogs](#modals--dialogs)
- [Custom Element Directives](#custom-element-directives)
- [Attribute Directives](#attribute-directives)
- [Filters](#filters)
- [Controllers](#controllers)
- [Services](#services)
- [Factories](#factories)
- [Third-Party Angular Libraries](#third-party-angular-libraries)
- [Additional Screenshots (Gap Captures)](#additional-screenshots-gap-captures)

---

## Page Layout & Navigation

### Main Application Shell

| What | File(s) | Current codebase | Screenshot | Where in Screenshot |
|------|---------|------------------|------------|---------------------|
| App bootstrap | `app/views/layouts/core.html.erb` | Same file; `data-*` on `<body>`, `javascript_importmap_tags 'application_modern'` | SS-01 | Full page — the entire shell |
| Header navbar | `app/views/layouts/_header_core_app.html.erb` | `app/views/layouts/_header.html.erb` — Bootstrap 5 nav, Turbo frames for recent cases/books | SS-01, SS-02 | Top blue bar with logo and nav links |
| Footer | `app/views/layouts/_footer_core_app.html.erb` | `app/views/layouts/_footer_core_app.html.erb` | SS-01, SS-38 | Bottom of page — copyright, Slack link |
| Main content | `app/views/core/index.html.erb` | Same; composes `case_header`, `action_bar`, `query_list_shell`, `settings_panel`, `resizable-pane` + `tour` Stimulus | SS-01 | White content area below header |
| Flash messages | `app/assets/templates/views/common/flash.html` | `#main-content` with `flash_controller.js`; `showFlash()` in `modules/flash_helper.js` for client messages | SS-70 | Success and error alert banners with close button (🟡 mockup: real template) |
| Search flash | `app/assets/templates/views/common/search_flash.html` | Search failures: inline alerts in query results + `showFlash` from `query_row_controller.js` / search pipeline (no separate Angular template) | SS-70 | Error alert — "Could not connect to search endpoint" (🟡 mockup: real template) |
| 404 page | `app/assets/templates/views/404.html` | Missing case: `core/not_found.html.erb` via `CoreController#index`; other 404s: standard Rails | SS-69 | "Not found :(" with bullet list of possible causes (🟡 mockup: real template) |
| Loading/bootstrapping | `LoadingCtrl` | Server-rendered case page; no full-page Angular bootstrap spinner | SS-16 | Center of page — spinner with "Bootstrapping Queries" text |

### Header Navigation Elements (HeaderCtrl)

| Element | Current codebase | Screenshot | Where in Screenshot |
|---------|------------------|------------|---------------------|
| Relevancy Cases dropdown | `_header.html.erb` + lazy `turbo-frame` `dropdown_cases_path` | SS-02 | Top-left — dropdown open showing "RECENT CASES", case list, "View all cases", "+ Create a case" |
| Books dropdown | Same header; Turbo frame for recent books | SS-37 | Top-left — dropdown open showing "RECENT BOOKS", "View all books", "Create a book" |
| Teams link | Rails `link_to` in `_header.html.erb` | SS-01 | Header bar, 4th nav item |
| Scorers link | Rails `link_to` in `_header.html.erb` | SS-01 | Header bar, 5th nav item |
| Notebooks link | Rails `link_to` in `_header.html.erb` | SS-01 | Header bar, 6th nav item |
| User menu dropdown | Bootstrap dropdown in `_header.html.erb` | SS-36 | Top-right — avatar + name, dropdown: My profile, Log out, API Docs, Admin Home, Users, Announcements, Job Manager |
| User Manual / Wiki links | Static links in `_header.html.erb` | SS-36 | Top-right, to the left of the avatar |
| `<new-case>` button | `button_to case_new_path` in cases dropdown (`_header.html.erb`) → `CoreController#new` creates case and opens wizard | SS-02 | Inside Cases dropdown — green "+ Create a case" button at bottom |

---

## Case Header & Score Display

**Template:** `app/assets/templates/views/queriesLayout.html`
**Controller:** `CaseCtrl`, `CurrSettingsCtrl`

| What | Component/Element | Current codebase | Screenshot | Where in Screenshot |
|------|-------------------|------------------|------------|---------------------|
| Current case score (no graph) | `<qscore-case>` | `case_score_controller.js` + `_case_header.html.erb` badge (sparkline SVG present but may be empty) | SS-01 | Upper-left — red "0.00" box (no history, no sparkline) |
| Current case score (with sparkline) | `<qscore-case>` + `<qgraph>` | `sparkline_controller.js` + `case_score_controller.js` in `_case_header.html.erb` | SS-03 | Upper-left — green "0.66" box with line graph and "AP@10" label |
| Snapshot diff scores | `<qscore-case>` (repeated) | `query_row_controller.js` (`snapshotScores` target) when `snapshot-comparison:activate` fires; `snapshot_comparison_controller.js` | SS-74 | Current score (green 0.66) alongside snapshot score (blue 0.52) side by side (🟠 mockup: approximation) |
| Case name (display) | Inline text | `_case_header.html.erb` + `inline_edit_controller.js` (double-click to edit) | SS-03 | "10s of Queries" in large text, right of score |
| Case name (edit mode) | Inline form | `inline_edit_controller.js` form targets in `_case_header.html.erb` | SS-48 | Yellow-highlighted input with "10s of Queries", Rename/Cancel buttons |
| PUBLIC badge | `<span>` | ERB conditional `@case.public?` in `_case_header.html.erb` | SS-73 | Blue "PUBLIC" label badge in case header (🟠 mockup: approximation) |
| ARCHIVED badge | `<span>` | `@case.archived?` + badge + `unarchive_controller.js` | SS-73 | Orange "ARCHIVED" label badge in case header (🟠 mockup: approximation) |
| Nightly indicator | `<i class="bi bi-repeat">` | `@case.nightly?` in `_case_header.html.erb` | SS-73 | Blue repeat icon next to "Current case" text (🟠 mockup: approximation) |
| Current try name | Inline text | ERB in `_case_header.html.erb` from `@try` | SS-03 | "— Try 31 —" to the right of case name |
| Scorer name | `<small>` | ERB `@case.scorer&.name` in `_case_header.html.erb` | SS-03 | "— AP@10" at the end of the header line |

### Score Display Components

| Component | File | Current codebase | Screenshot | Where in Screenshot |
|-----------|------|------------------|------------|---------------------|
| `<qscore-case>` (simple) | `components/qscore_case/` | `case_score_controller.js` + `_case_header.html.erb` | SS-01 | Upper-left — red score boxes (0.00) with no sparkline |
| `<qscore-case>` (with graph) | `components/qscore_case/` | Same + `sparkline_controller.js` | SS-03 | Upper-left — score box with embedded line chart |
| `<qscore-query>` | `components/qscore_query/` | `query_row_controller.js` (`.query-score-badge` / `scoreDisplay` target) + `modules/scorer.js` for colors | SS-01, SS-04 | Left edge of each query row — color-coded score badges (red 0.00, green 0.73, etc.) |
| `<qgraph>` | `components/qgraph/` | `sparkline_controller.js` (SVG in `_case_header.html.erb`) | SS-03 | Embedded in the case score box — small SVG sparkline chart |

---

## Case Action Bar

**Template:** `app/assets/templates/views/queriesLayout.html` (lines 78–136)
**Controller:** `CaseCtrl`

A horizontal toolbar of actions for the current case.

**Visible in:** SS-01 (small), SS-03 (zoomed, full bar)

| Action | Component | Current codebase | Screenshot | Where in Screenshot |
|--------|-----------|------------------|------------|---------------------|
| Select scorer | `ng-click="pickCaseScorer()"` | Placeholder `<a href="#">` in `_action_bar.html.erb` (not wired to a modal yet) | SS-03 | Action bar — "Select scorer" with tasks icon |
| Judgements | `<judgements>` | `judgements_controller.js`; modal markup in `_action_bar_modals.html.erb` | SS-03 | Action bar — "Judgements" with book icon |
| Create snapshot | `TakeSnapshotCtrl` | `snapshot_controller.js` + snapshot modal in `_action_bar_modals.html.erb` | SS-03 | Action bar — "Create snapshot" with camera icon |
| Compare snapshots | `<diff>` | `snapshot_comparison_controller.js` + compare modal in `_action_bar_modals.html.erb` | SS-03 | Action bar — "Compare snapshots" with bar chart icon |
| Import | `<import-ratings>` | `import_ratings_controller.js` + modal in `_action_bar_modals.html.erb` | SS-03 | Action bar — "Import" |
| Share case | `<share-case>` | `share_case_controller.js` + `#shareCaseModal` (Bootstrap 5) | SS-03 | Action bar — "Share case" with arrow icon |
| Clone | `<clone-case>` | `clone_case_controller.js` + modal in `_action_bar_modals.html.erb` | SS-03 | Action bar — "Clone" with copy icon |
| Delete case | `<delete-case-options>` | `delete_case_options_controller.js` + modal in `_action_bar_modals.html.erb` | SS-03 | Action bar — "Delete" with X icon |
| Export | `<export-case>` | `export_case_controller.js` + modal in `_action_bar_modals.html.erb` | SS-03 | Action bar — "Export" with document icon |
| Tune Relevance | `ng-click="toggleDevSettings()"` | `resizable-pane` Stimulus on `core/index.html.erb` (`toggle` action); east pane `_settings_panel.html.erb` | SS-03 | Action bar — "Tune Relevance" with wrench icon |

---

## Query List

**Directive:** `<queries>`
**Template:** `app/assets/templates/views/queries.html`
**Controller:** `QueriesCtrl`

**Visible in:** SS-01 (full), SS-04 (zoomed)

| What | Current codebase | Screenshot | Where in Screenshot |
|------|------------------|------------|---------------------|
| Add query input | `_query_list_shell.html.erb` + `add_query_controller.js` | SS-04 | Top-left — "Add a query to this case" text input + green "Add query" button |
| "Show only rated" checkbox | `query_list_controller.js` (`showOnlyRatedCheckbox` target) | SS-04 | Top-right row — checkbox |
| "Collapse all" link | `query_list_controller.js#collapseAll` | SS-04 | Top-right row — link |
| Sort controls | `query_list_controller.js#sortBy` + `data-sort` links in `_query_list_shell.html.erb` | SS-04 | Top-right row — "Sort Manual ↓ Name Modified Score Errors" |
| Filter queries input | `query_list_controller.js#filter` | SS-04 | Second right row — "Filter Queries" text input |
| "Number of Queries" count | `query_list_controller.js` updates `queryCount` target (seeded from ERB) | SS-04 | Far right — "Number of Queries: 3" |
| Frog report link | `frog_report_controller.js` (opens modal from `_action_bar_modals.html.erb`) | SS-04 | Second right row — frog emoji "Report" link |
| Collapsed query rows | `_query_list_shell.html.erb` + `query_row_controller.js` | SS-04 | Main area — rows with score badge, query text, result count, chevron |
| Pagination controls | `query_list_controller.js` renders pagination into `paginationContainer` (client-side paging) | SS-62 | Page 1/2 navigation at bottom of query list |
| Drag-drop reorder handle | `query_list_controller.js` + dynamic `import("sortablejs")` when `data-query-list-sortable-value` is true | SS-80 | Hamburger grip icon on query rows, second row shown mid-drag with dashed border (🟠 mockup: approximation) |

---

## Search Results

### Per-Query Results Block

**Directive:** `<search-results>`
**Template:** `app/assets/templates/views/searchResults.html`
**Controller:** `SearchResultsCtrl`

**Visible in:** SS-05 (expanded query)

| What | Component | Current codebase | Screenshot | Where in Screenshot |
|------|-----------|------------------|------------|---------------------|
| Query score | `<qscore-query>` | `query_row_controller.js` score badge + `modules/scorer_executor.js` | SS-05 | Left edge — red "0.00" badge |
| Query text | Editable inline | Static ERB text in `_query_list_shell.html.erb` (editing not yet parity with Angular inline edit) | SS-05 | "star wars" text next to score |
| Result count | Badge | `query_row_controller.js` `totalResults` target | SS-05 | Right side — "2477" |
| Expand/collapse chevron | Icon | `query_row_controller.js#toggle` + chevron target | SS-04 | Right edge of each row — blue down chevron |
| Score All button + popover | `rateBulkSvc` | Bootstrap dropdown in `_query_list_shell.html.erb`; `query_row_controller.js#bulkRate` + scale from `body[data-scorer-scale]` | SS-06, SS-49 | Top of expanded query — "Score All" with dropdown showing scale buttons |
| Query toolbar | Various | `_query_list_shell.html.erb` `.query-row-expanded-toolbar`; actions on `query_row_controller.js` | SS-05 | Row of buttons: Toggle Notes, Explain Query, Missing Documents, Query Options, Move, Delete (and Copy, green/red result buttons) |
| `<query-explain>` button | `<query-explain>` | `query_row_controller.js#explainQuery` → `#query-explain-modal` + `query_explain_modal_controller.js` | SS-05 | Toolbar — "Explain Query" button |
| `<query-options>` button | `<query-options>` | `query_row_controller.js#openQueryOptionsModal` → `query_options_modal_controller.js` | SS-05 | Toolbar — "Query Options" (labeled "Set Options") button |
| `<move-query>` button | `<move-query>` | `move_query_modal_controller.js` + `#move-query-modal` in `_query_list_shell.html.erb` | SS-05 | Toolbar — move icon |
| Delete query button | Action button | `query_row_controller.js#deleteQuery` | SS-05 | Toolbar — red "Delete Query" button (labeled "Delete Query") |
| Missing Documents button | `TargetedSearchCtrl` | `doc_finder_controller.js` + `#doc-finder-modal` | SS-05 | Toolbar — "Missing Documents" button |
| Toggle Notes button | `QueryNotesCtrl` | `query_row_controller.js#toggleNotes` + notes panel in `_query_list_shell.html.erb` | SS-05 | Toolbar — "Toggle Notes" button |
| Notes/Information Need | `QueryNotesCtrl` | Same notes panel; `query_row_controller.js#saveNotes` | SS-29 | Below query header — "Information Need" text input, "Notes on this Query" textarea, Save button |
| Diff results columns | `<query-diff-results>` | `query_row_controller.js` builds `.diff-container` when snapshot comparison is active (replaces per-query results) | SS-66 | "Current Results" vs "Snapshot 3/10/26" side-by-side with doc titles, ranks, and "No result at position 3" alert (🟠 mockup: approximation) |
| Threshold indicator | Color bar | Not implemented in the Stimulus results row (no equivalent UI yet) | SS-76 | Green bar (above threshold) and red bar (below threshold) with check/X icons (🟠 mockup: approximation) |

### Individual Document Result

**Directive:** `<search-result>`
**Template:** `app/assets/templates/views/searchResult.html`
**Controller:** `SearchResultCtrl`

**Visible in:** SS-05 (list), SS-28 (zoomed single doc)

| What | Current codebase | Screenshot | Where in Screenshot |
|------|------------------|------------|---------------------|
| Rating dropdown (unrated) | `query_row_controller.js` renders rating `<select>` per hit; `modules/ratings_store.js` persists | SS-05 | Left edge of each doc — gray "-- ▼" dropdown |
| Rating popover (open) | Native `<select>` options (scale from scorer config), not ui-bootstrap popover | SS-06 | Popover with scale buttons (0 Irrelevant, 1 Relevant, RESET) |
| Rating dropdown (rated) | Same select; styling via `modules/scorer.js` | SS-49 | Left edge — green "1 ▼" dropdown showing current rating |
| Document title (linked) | `query_row_controller.js` `_buildDocCell` / field rendering | SS-05, SS-28 | Blue linked text — "Star Wars Uncut: Director's Cut" |
| Document thumbnail | `modules/field_renderer.js` (`thumb:` / image fields) | SS-05 | Small poster image to left of title |
| Document fields | `modules/field_renderer.js` | SS-05, SS-28 | Below title — "overview:", "cast:", "Rank: #1", etc. |
| Matches / stacked chart | `query_row_controller.js` + `modules/explain_parser.js` (`hotMatchesOutOf`); enable with **Match breakdown** (`toggleDocExplain`, debug search) | SS-28 | Right side — "Matches" heading with colored bars (float(vote_average), weight(title:...), etc.) and "Show 1 More" link |
| "Peek at next page" | Pagination / “load more” paths in `query_row_controller.js` (search result paging) | SS-30 | Below last result — "Peek at the next page of results" link |
| "Browse on Solr" button | Built when `result.linkUrl` present (`query_row_controller.js`) | SS-30 | Green button — "Browse 1771 Results on Solr" |
| "Results above are counted" | Divider markup in `query_row_controller.js` when mixing rated/unrated sections | SS-30 | Green text divider between scored and unscored results |
| Detailed doc link | Opens `#doc-detail-modal` via `doc_detail_modal_controller.js` | SS-05 | Doc title is clickable to open detailed view |
| Media embed `[quepid-embed]` | `modules/field_renderer.js` (`<audio>`, `<video>`, image URLs) | SS-78 | Audio player, image placeholder, video player for media fields (🟠 mockup: approximation) |
| `<expand-content>` button | Full relevancy explain text shown via match-breakdown / explain paths (no separate “Expand” modal matching Angular) | SS-79 | "Expand" button with arrows icon (🟡 mockup: real template) |
| `<debug-matches>` button | **Match breakdown** toggles debug explain on hits; JSON tree modal not a separate Angular `debug-matches` component | SS-79 | "Debug" button (🟡 mockup: real template) |

### Stacked Chart & Matches

| Component | Current codebase | Screenshot | Where in Screenshot |
|-----------|------------------|------------|---------------------|
| `<stacked-chart>` | `.explain-stacked-chart` HTML from `query_row_controller.js` when debug explain is on | SS-28 | Right side of document result — colored horizontal progress bars |
| Matches popover | Inline “Matches” block next to result row (same as stacked chart path) | SS-28 | "Matches" section with factor names and bars |

---

## Query Parameters / Tune Relevance Panel

**Directive:** `<query-params>`
**Template:** `app/assets/templates/views/devQueryParams.html`
**Controller:** `QueryParamsCtrl`

The east pane (toggled by "Tune Relevance") contains a tabbed interface. All tabs share the same dark background style.

| Tab | Current codebase | Screenshot | What's Visible |
|-----|------------------|------------|----------------|
| **Query Sandbox** | `_settings_panel.html.erb` tab `query`; `settings_panel_controller.js`; textarea (Solr vs ES-style class) | SS-07, SS-54 | Tab bar at top, "Query Sandbox:" heading, text editor with query params (`q=#$query##&magicBoost=31`), "Rerun My Searches!" blue button |
| **Tuning Knobs** | Same file tab `tuning`; curator vars rendered into `curatorVarsContainer` | SS-08 | Explanatory text about `##variable##` syntax, "Tuning Knobs" heading, empty state ("Add and remove knobs from here by editing your query"), "Rerun My Searches!" button |
| **Settings** | Tab `settings`; collapsible `.setting-div` sections; endpoint `<select>` + `settings_panel_controller.js` (not Angular accordion) | SS-09, SS-53, SS-55, SS-56 | Accordion sections: Search Endpoints, Endpoint Details (with Solr icon + URL), Displayed Fields (text input), Number of Results to Show (input), Evaluate Nightly?, Escape Queries, "Rerun My Searches!" button |
| **History** | Tab `history`; ERB try list + link to `analytics/tries_visualization/:case_id` (Vega on separate analytics page, not embedded ngVega) | SS-10, SS-31 | "Visualize your tries \| Check Scores \| Check Ratings" links, instruction text, list of tries with try name, query snippet, endpoint label; "..." action button on hover |
| **Annotations** | Tab `annotations`; create form + list hydrated by `settings_panel_controller.js` | SS-11 | Explanatory text about annotations, "Why?" section, "Scroll down to view list" link, Message textarea, green "Create" button, "Existing Annotations" heading |

### Sub-Components in East Pane

| Component | Current codebase | Screenshot | Where in Screenshot |
|-----------|------------------|------------|---------------------|
| `<query-params-history>` (try list) | ERB `@case.tries` list in `_settings_panel.html.erb` + `settings_panel_controller.js` (rename/duplicate/delete) | SS-10 | History tab — rows showing Try 31, Try 30, etc. with query snippets and endpoint URLs |
| `<annotations>` (create form) | Annotations tab markup + `settings_panel_controller.js#createAnnotation` | SS-11 | Annotations tab — Message textarea + Create button |
| `<annotation>` (single item) | List HTML built in `settings_panel_controller.js` (items + edit/delete actions) | SS-61 | Annotation items with timestamp, author, try/score, message, hamburger menu (🟡 mockup: real template) |
| `<custom-headers>` | Loaded/edited via `settings_panel_controller.js` when endpoint allows (custom headers in try/settings API payload) | SS-53 | Settings tab — custom headers editor area |
| Query params details (try "..." menu) | `toggleTryActions` / try-details block in `_settings_panel.html.erb` | SS-31 | History tab — single try with "..." button visible, showing Try 1 details |
| Search endpoint typeahead popup | Endpoint picker is a `<select>` populated by `settings_panel_controller.js` (no Angular typeahead) | SS-77 | Dropdown showing Solr icon + highlighted endpoint URLs matching typed text (🟠 mockup: approximation) |

---

## Modals & Dialogs

### Case Wizard

**Template:** `app/assets/templates/views/wizardModal.html`
**Controller:** `WizardCtrl` / `WizardModalCtrl`

| Step | Current codebase | Screenshot | What's Visible |
|------|------------------|------------|----------------|
| Welcome (Rails page) | No separate marketing landing page in core flow; `case_new_path` creates a case and redirects to core with `showWizard=true` | W1 | "Create Your First Relevancy Case" landing page |
| Doug's welcome | First step content inside wizard modal (`wizard_controller.js` + markup in `_action_bar_modals.html.erb`) | W2 | Introductory text |
| Name your case | Wizard step: `caseNameInput` targets | W3 | Name input form |
| Search endpoint (accordion) | Wizard step containers (`data-wizard-target="step"`) — Bootstrap layout, not angular-wizard accordion | W4 | Accordion showing step titles |
| Engine selection | `searchEngineRadio`, engine-specific panels, `modules/wizard_settings.js` + `modules/settings_validator.js` | W4b | Radio buttons for Solr, Elasticsearch, OpenSearch, Vectara, CSV Static File, Custom Search API, Algolia; URL input, "ping it" link, Solr Configuration accordion, Continue button; step tabs at bottom (WELCOME, NAME, ENDPOINT, FIELDS, QUERY, FINISH) |
| Endpoint result | `validationMessage` / validate flow in `wizard_controller.js` | W4b2 | Validation display after testing endpoint |
| Display fields | Title/ID/additional field inputs + datalists in wizard modal | W5 | Title, ID, and additional fields selection |
| Add queries | `queryInput`, tags container, query pattern section | W6 | Query input form |
| Finish | Final wizard step + `finishButton` | W7 | Confirmation screen |

### Component Modals

| Modal | Component | Current codebase | Screenshot | What's Visible |
|-------|-----------|------------------|------------|----------------|
| Snapshot | `TakeSnapshotCtrl` | `snapshot_controller.js` + modal in `_action_bar_modals.html.erb` (name + progress; “include document fields” may differ from Angular) | SS-12 | "Take a Snapshot of all your queries?" — name input, Include Document Fields checkbox, Take Snapshot / Cancel buttons |
| Compare snapshots | `<diff>` | `snapshot_comparison_controller.js` + modal in `_action_bar_modals.html.erb` | SS-13, SS-60 | "Compare Your Search Results" — Snapshot 1 dropdown, "+ Add Snapshot" button, Update Comparison Settings / Clear Comparison View / Cancel buttons |
| Select scorer | `ScorerCtrl` | Not migrated to a core modal; change scorer via case/settings flows outside this inventory or future work | SS-14 | "How would you like to score this case?" — list of scorers (nDCG@10, DCG@10, CG@10, P@10, AP@10 highlighted, RR@10), + Create New Scorer / Select Scorer / Cancel buttons |
| Delete options | `<delete-case-options>` | `delete_case_options_controller.js` | SS-15 | "Delete Options for Case" — three toggle buttons (Delete All Queries, Archive Case, Delete Case), Cancel / red Delete button |
| Clone case | `<clone-case>` | `clone_case_controller.js` | SS-17 | "Clone case: TMDB Movie Search" — new case name input, history toggle (Only specific try / Entire history), try selector dropdown, content checkboxes (Include Queries, Include Ratings), Cancel / Clone buttons |
| Share case | `<share-case>` | `share_case_controller.js` + `#shareCaseModal` | SS-18 | "Share Case" — empty state "No teams to share with?", "+ Create a team" button (appears twice), Cancel button |
| Export case | `<export-case>` | `export_case_controller.js` | SS-19 | "Export Case: TMDB Movie Search" — radio buttons for formats: Information Need, General, Detailed, Snapshot (with dropdown), Basic, TREC, Rated Ranking Evaluator/RankQuest, Learning to Rank; each with CSV column descriptions |
| Import ratings | `<import-ratings>` | `import_ratings_controller.js` + import modal tabs in `_action_bar_modals.html.erb` (ratings, information needs, snapshots file inputs) | SS-20 | "Import into Case" — tabs (Ratings, Information Needs, Snapshots), format radio buttons (CSV, Rated Ranking Evaluator, Learning to Rank), file chooser, example CSV text, Clear existing queries checkbox, Cancel / Import buttons |
| Judgements | `<judgements>` | `judgements_controller.js` | SS-21 | "Judgements" — explanatory text about Books, blue info banner about sharing with team, Populate Book checkbox, Populate missing Queries checkbox, + Create a book / Refresh ratings from book / Cancel buttons |
| Frog report | `<frog-report>` | `frog_report_controller.js` (Vega via global `vegaEmbed` when available) | SS-22 | "The Frog Pond Report" — summary stats (queries, results, ratings needed), distribution chart (red bar chart of queries by missing rating count), Close button |
| Query explain | `<query-explain>` | `query_explain_modal_controller.js` + `#query-explain-modal` in `_query_list_shell.html.erb` | SS-23 | "Explain Query Parsing" — tabs (Params, Parsing, Query Template), JSON display of processed query parameters, Copy / Close buttons |
| Targeted search | `TargetedSearchModalCtrl` | `doc_finder_controller.js` + `#doc-finder-modal` | SS-24 | "Find and Rate Missing Documents" — search input, explanatory text about Lucene query syntax, Search / Reset to All Rated Docs buttons, Close button |
| Query options | `<query-options>` | `query_options_modal_controller.js` + plain `<textarea>` (not ui.ace) | SS-25 | "Query Options" — explanatory text about JSON key-value objects, ACE editor with `{}`, Set Options / Cancel buttons |
| Move query | `<move-query>` | `move_query_modal_controller.js` | SS-26 | "Move Query to Another Case" — empty state "Please create another case to move this query to first", Cancel button |
| Detailed document | `DetailedDocCtrl` | `doc_detail_modal_controller.js` + `#doc-detail-modal` | SS-27 | "Detailed Document View of doc: 578870" — document title, field table (overview, Thumb URL), View Document / View All Fields / Close buttons |
| Archive case confirm | — | `confirm_delete_controller.js` (generic confirm pattern) on cases list / archive flows | SS-52 | Simple "Confirm" dialog — "Archive SOLR CASE?", Cancel / red Confirm buttons (shown over cases list page) |

### Additional Modals (Static Mockups)

| Modal | Component | Current codebase | Screenshot | What's Visible |
|-------|-----------|------------------|------------|----------------|
| Unarchive case | `UnarchiveCaseCtrl` | `unarchive_controller.js` on case header badge + any list flows using same pattern | SS-72 | "Archived Cases" — list of archived cases with selection highlight, "Add Back" button (🟡 mockup: real template) |
| Delete case (simple) | `<delete-case>` | `confirm_delete_controller.js` or delete-case options flow (simple confirm may be consolidated) | SS-71 | "Delete This Case" — warning text about permanent deletion, Delete / Cancel buttons (🟡 mockup: real template) |
| Detailed explain | `DetailedExplainCtrl` | Inline / toggled explain via `query_row_controller.js` match-breakdown (no separate Angular JSON explorer component) | SS-64 | Debug explain with collapsible JSON tree of Lucene scoring — idf, tf, field weights (🟡 mockup: real template) |
| Debug matches | `<debug-matches>` | Same match-breakdown path; raw explain text rendered in result row | SS-64 | Same template as detailed explain (🟡 mockup: real template) |
| Expand content | `<expand-content>` | Long explain strings in stacked chart / explain output (no dedicated “Expanded View” modal) | SS-65 | "Expanded View" — full relevancy score as preformatted text (🟡 mockup: real template) |
| Annotation update | `annotation/_update.html` | `settings_panel_controller.js` annotation edit UI in east pane | SS-61b | "Edit Annotation" — textarea with message, Update / Cancel buttons (🟡 mockup: real template) |

---

## Custom Element Directives

Complete list of custom HTML elements, with screenshot references:

| Element | Directory | Current codebase | Screenshot | Where Visible |
|---------|-----------|------------------|------------|---------------|
| `<qscore-case>` | `components/qscore_case/` | `case_score_controller.js` + `sparkline_controller.js` + `_case_header.html.erb` | SS-01, SS-03 | Case header, upper-left — score box |
| `<qscore-query>` | `components/qscore_query/` | `query_row_controller.js` + `modules/scorer.js` | SS-01, SS-04, SS-05 | Left edge of each query row — colored score badge |
| `<qgraph>` | `components/qgraph/` | `sparkline_controller.js` | SS-03 | Inside case score box — sparkline SVG |
| `<queries>` | `directives/queries.js` | `query_list_controller.js` + `_query_list_shell.html.erb` | SS-01, SS-04 | Main content pane — entire query list area |
| `<search-results>` | `directives/searchResults.js` | `query_row_controller.js` `resultsContainer` (HTML injected after search) | SS-05 | Each query row (expanded shows documents) |
| `<search-result>` | `directives/searchResult.js` | `_buildDocCell` / result row markup in `query_row_controller.js` + `field_renderer.js` | SS-05, SS-28 | Each document within an expanded query |
| `<query-params>` | `directives/queryParams.js` | `settings_panel_controller.js` + `_settings_panel.html.erb` | SS-07–SS-11 | East pane — tabbed interface |
| `<query-params-history>` | `directives/queryParamsHistory.js` | History tab ERB + `settings_panel_controller.js` | SS-10, SS-31 | East pane History tab — try list |
| `<custom-headers>` | `directives/customHeaders.js` | `settings_panel_controller.js` (endpoint/try save payload) | SS-53 | East pane Settings tab — headers editor |
| `<query-diff-results>` | `directives/queryDiffResults.js` | `query_row_controller.js` diff layout + `snapshot_comparison_controller.js` | SS-66 | Side-by-side "Current Results" vs "Snapshot" with doc comparisons (🟠 mockup: approximation) |
| `<stacked-chart>` | `directives/stackedChart.js` | `query_row_controller.js` `.explain-stacked-chart` + `explain_parser.js` | SS-28 | Right side of document — colored bars |
| `<add-query>` | `components/add_query/` | `add_query_controller.js` | SS-04 | Top of query list — input + green button |
| `<query-explain>` | `components/query_explain/` | `query_explain_modal_controller.js` | SS-05 (button), SS-23 (modal) | Toolbar button; modal content |
| `<query-options>` | `components/query_options/` | `query_options_modal_controller.js` | SS-05 (button), SS-25 (modal) | Toolbar button; modal content |
| `<move-query>` | `components/move_query/` | `move_query_modal_controller.js` | SS-05 (button), SS-26 (modal) | Toolbar button; modal content |
| `<new-case>` | `components/new_case/` | `button_to case_new_path` in `_header.html.erb` | SS-02 | Inside Cases dropdown — "+ Create a case" |
| `<delete-case>` | `components/delete_case/` | `confirm_delete_controller.js` / delete flows | SS-71 | Simple "Delete This Case" confirmation modal (🟡 mockup: real template) |
| `<delete-case-options>` | `components/delete_case_options/` | `delete_case_options_controller.js` | SS-03 (button), SS-15 (modal) | Action bar "Delete"; modal |
| `<clone-case>` | `components/clone_case/` | `clone_case_controller.js` | SS-03 (button), SS-17 (modal) | Action bar "Clone"; modal |
| `<share-case>` | `components/share_case/` | `share_case_controller.js` | SS-03 (button), SS-18 (modal) | Action bar "Share case"; modal |
| `<export-case>` | `components/export_case/` | `export_case_controller.js` | SS-03 (button), SS-19 (modal) | Action bar "Export"; modal |
| `<import-ratings>` | `components/import_ratings/` | `import_ratings_controller.js` (handles snapshot CSV tab in same modal) | SS-03 (button), SS-20 (modal) | Action bar "Import"; modal |
| `<judgements>` | `components/judgements/` | `judgements_controller.js` | SS-03 (button), SS-21 (modal) | Action bar "Judgements"; modal |
| `<annotation>` | `components/annotation/` | Annotation rows from `settings_panel_controller.js` | SS-61 | Annotation items with timestamp, author, try number, score, message, and hamburger menu (🟡 mockup: real template) |
| `<annotations>` | `components/annotations/` | Annotations tab in `_settings_panel.html.erb` | SS-11 | East pane Annotations tab — create form + list |
| `<diff>` | `components/diff/` | `snapshot_comparison_controller.js` | SS-03 (button), SS-13/SS-60 (modal) | Action bar "Compare snapshots"; modal |
| `<frog-report>` | `components/frog_report/` | `frog_report_controller.js` | SS-04 (link), SS-22 (modal) | Query list controls — frog "Report" link; modal |
| `<debug-matches>` | `components/debug_matches/` | Match-breakdown / explain in `query_row_controller.js` | SS-64 | Debug explain modal with JSON tree of Lucene scoring (🟡 mockup: real template) |
| `<action-icon>` | `components/action_icon/` | Bootstrap icon buttons in `_query_list_shell.html.erb` | SS-05 | Various toolbar icon-buttons in expanded query |
| `<expand-content>` | `components/expand_content/` | Explain output in result row (no dedicated modal) | SS-65 | Expanded view modal with full relevancy score explain text (🟡 mockup: real template) |

---

## Attribute Directives

| Attribute | File | Current codebase | Screenshot | Where Visible |
|-----------|------|------------------|------------|---------------|
| `[quepid-embed]` | `directives/searchResult.js` | `modules/field_renderer.js` media branches | SS-78 | Audio player, image placeholder, and video player for media-type fields (🟠 mockup: approximation) |
| `[auto-grow]` | `directives/autoGrow.js` | Default textarea/input behavior or CSS; no dedicated directive | — | Invisible behavior — auto-widening input (no screenshot needed) |
| `[text-paste]` | `directives/textPaste.js` | Native paste / no Stimulus equivalent tracked here | — | Invisible behavior — paste handler (no screenshot needed) |
| `[vega]` | `directives/angular-vega.js` | `app/views/analytics/tries_visualization/show.html.erb` fetches Vega spec (separate page from embedded pane) | SS-68 | Tries visualization tree/cluster graph (Playwright capture) |

---

## Filters

Filters are data transformations applied in templates. Their effect is visible but the filter itself is invisible code.

| Filter | File | Current codebase | Visual Effect Visible In |
|--------|------|------------------|--------------------------|
| `scoreDisplay` | `filters/scoreDisplay.js` | `query_row_controller.js` / `case_score_controller.js` format scores (typically 2 decimals) | SS-01, SS-04 — score values formatted to 2 decimal places (e.g., "0.00", "0.73") |
| `ratingBgStyle` | `filters/ratingBgStyle.js` | `modules/scorer.js` (`scoreToColor`, `ratingColor`, `scaleToColors`) | SS-01, SS-04 — color-coded score badges (red=low, green=high) |
| `queryStateClass` | `filters/queryStateClass.js` | Errors: alert markup in results container; dedicated pink ERR row styling not guaranteed | SS-75 | Red "ERR" badge with orange error warning text on pink background row (🟠 mockup: approximation) |
| `searchEngineName` | `filters/searchEngineName.js` | Try history shows endpoint label from ERB / API (`_settings_panel.html.erb`) | SS-10 — "using Solr" text in try history items |
| `caseType` | `filters/caseType.js` | Server-side scopes / Rails queries (no client filter) | — (used for filtering, no visual output) |
| `plusOrMinus` | `directives/searchResults.js` | Bootstrap `bi-chevron-*` on `query_row_controller.js` toggle | SS-04 — chevron icons on query rows |
| `stackChartColor` | `directives/stackedChart.js` | Inline styles / classes in `query_row_controller.js` stacked chart HTML | SS-28 — colored progress bar segments |
| `stackChartHeight` | `directives/stackedChart.js` | Computed widths in `_buildStackedChart` | SS-28 — bar height proportions |
| `stackChartLeftover` | `directives/stackedChart.js` | Same stacked chart builder | SS-28 — remaining space calculation |

---

## Controllers

All in `app/assets/javascripts/controllers/`:

| Controller | File | Current codebase | Screenshot | Purpose |
|------------|------|------------------|------------|---------|
| `MainCtrl` | `mainCtrl.js` | `core/index.html.erb` composition + Stimulus controllers on shell/partials | SS-01 | Root controller, initializes app state |
| `HeaderCtrl` | `headerCtrl.js` | `layouts/_header.html.erb` + Turbo frames | SS-02, SS-37 | Navigation header: case/book dropdowns |
| `LoadingCtrl` | `loading.js` | Server-rendered page (no client bootstrap controller) | SS-16 | Loading spinner while app bootstraps |
| `CaseCtrl` | `case.js` | `inline_edit_controller.js` + `_case_header.html.erb` + `_action_bar.html.erb` | SS-03, SS-48 | Case header: rename, actions, scorer selection |
| `CurrSettingsCtrl` | `currSettings.js` | Try name shown from ERB; rename/duplicate try via `settings_panel_controller.js` | SS-03 | Current try display and rename |
| `SettingsCtrl` | `settings.js` | `settings_panel_controller.js` | SS-09 | Settings management |
| `QueriesCtrl` | `queriesCtrl.js` | `query_list_controller.js` | SS-04 | Query list: sorting, filtering, pagination |
| `SearchResultsCtrl` | `searchResults.js` | `query_row_controller.js` (expand, bulk rate, results container) | SS-05 | Per-query result block: expand/collapse |
| `SearchResultCtrl` | `searchResult.js` | `query_row_controller.js` + `field_renderer.js` + `ratings_store.js` | SS-05, SS-28 | Individual document: rating, fields, explain |
| `QueryParamsCtrl` | `queryParams.js` | `settings_panel_controller.js` | SS-07 | Query parameter editor tabs |
| `QueryParamsHistoryCtrl` | `queryParamsHistory.js` | History tab ERB + `settings_panel_controller.js` | SS-10 | Try history list |
| `QueryParamsDetailsCtrl` | `queryParamsDetails.js` | Try actions + details panel in `settings_panel_controller.js` | SS-31 | Try detail view and rename |
| `CustomHeadersCtrl` | `customHeaders.js` | `settings_panel_controller.js` | SS-53 | Custom HTTP headers editor |
| `QueryNotesCtrl` | `queryNotes.js` | `query_row_controller.js` notes panel | SS-29 | Per-query notes/information needs |
| `QueryDiffResultsCtrl` | `queryDiffResults.js` | `query_row_controller.js` diff rendering + `snapshot_comparison_controller.js` | SS-66 | Diff comparison side-by-side columns (🟠 mockup: approximation) |
| `WizardCtrl` | `wizardCtrl.js` | `CoreController#new` redirect + `wizard_controller.js` (`showWizard` param) | W1–W7 | New case wizard launcher |
| `WizardModalCtrl` | `wizardModal.js` | `wizard_controller.js` + wizard modal in `_action_bar_modals.html.erb` | W2–W7 | New case wizard modal steps |
| `TakeSnapshotCtrl` | `takeSnapshot.js` | `snapshot_controller.js` | SS-12 | Snapshot creation |
| `PromptSnapshotCtrl` | `promptSnapshot.js` | Same snapshot modal/controller | SS-12 | Snapshot creation modal |
| `ScorerCtrl` | `scorer.js` | Not migrated on core action bar (placeholder link) | SS-14 | Scorer picker modal |
| `DetailedDocCtrl` | `detailedDoc.js` | `doc_detail_modal_controller.js` | SS-27 | Full document viewer modal |
| `DetailedExplainCtrl` | `detailedExplain.js` | Explain / match-breakdown inside `query_row_controller.js` | SS-64 | Debug explain modal (🟡 mockup: real template) |
| `DocFinderCtrl` | `docFinder.js` | `doc_finder_controller.js` | SS-24 | Document search/finder |
| `TargetedSearchCtrl` | `targetedSearchCtrl.js` | Same as doc finder modal | SS-24 | Targeted search interface |
| `TargetedSearchModalCtrl` | `targetedSearchModal.js` | `#doc-finder-modal` + `doc_finder_controller.js` | SS-24 | Targeted search modal |
| `HotMatchesCtrl` | `hotMatchesCtrl.js` | `explain_parser.js` + stacked chart in `query_row_controller.js` | SS-28 | Relevancy match highlighting |
| `UnarchiveCaseCtrl` | `unarchiveCase.js` | `unarchive_controller.js` | SS-72 | Unarchive case modal (🟡 mockup: real template) |
| `404Ctrl` | `404Ctrl.js` | `core/not_found.html.erb` / app-wide 404 views | SS-69 | 404 page (🟡 mockup: real template) |

---

## Services

All in `app/assets/javascripts/services/`. Services have no direct visual representation — they are backend logic for the UI components listed above.

| Service | File | Purpose | Current codebase |
|---------|------|---------|------------------|
| `bootstrapSvc` | `bootstrapSvc.js` | App initialization and bootstrap | Rails renders case data into ERB; `application_modern` Stimulus `connect()` |
| `configurationSvc` | `configurationSvc.js` | App configuration (communal scorers, query sortable) | `data-*` attributes on `<body>` in `layouts/core.html.erb` |
| `caseSvc` | `caseSvc.js` | Case CRUD operations | Rails `CoreController` + JSON under `app/controllers/api/`; `inline_edit`, `fetch` in Stimulus |
| `caseTryNavSvc` | `caseTryNavSvc.js` | Navigation between cases and tries; provides `getQuepidRootUrl()` | Rails paths + `modules/api_url.js` (`apiUrl`, `csrfToken`) |
| `queriesSvc` | `queriesSvc.js` | Query CRUD and execution | `query_list_controller.js`, `add_query_controller.js`, `query_row_controller.js` + API endpoints |
| `qscoreSvc` | `qscore_service.js` | Score calculation and display | `modules/scorer_executor.js`, `case_score_controller.js`, `query_row_controller.js` |
| `settingsSvc` | `settingsSvc.js` | User/case settings persistence | `settings_panel_controller.js` + try/case API |
| `ratingsStoreSvc` | `ratingsStoreSvc.js` | Rating persistence to backend | `modules/ratings_store.js` |
| `rateElementSvc` | `rateElementSvc.js` | Rating UI interaction logic | Rating `<select>` change handlers in `query_row_controller.js` |
| `rateBulkSvc` | `rateBulkSvc.js` | Bulk rating operations | `query_row_controller.js#bulkRate` |
| `scorerSvc` | `scorerSvc.js` | Scorer management | Fetch `api/scorers/:id` in `query_row_controller.js`; full picker UI not on core bar yet |
| `querySnapshotSvc` | `querySnapshotSvc.js` | Snapshot creation and retrieval | `snapshot_controller.js` + API |
| `snapshotSearcherSvc` | `snapshotSearcherSvc.js` | Search within snapshots | Snapshot doc fetch inside `query_row_controller.js` diff path |
| `diffResultsSvc` | `diffResultsSvc.js` | Snapshot comparison logic | `snapshot_comparison_controller.js` + diff rendering in `query_row_controller.js` |
| `annotationsSvc` | `annotationsSvc.js` | Annotation CRUD | `settings_panel_controller.js` annotation API calls |
| `importRatingsSvc` | `importRatingsSvc.js` | Rating import from files | `import_ratings_controller.js` |
| `caseCSVSvc` | `caseCSVSvc.js` | CSV export generation | `export_case_controller.js` (download via fetch/blob) |
| `paneSvc` | `paneSvc.js` | East/west pane layout management | `resizable_pane_controller.js` |
| `queryViewSvc` | `queryViewSvc.js` | Query view state (expanded/collapsed) | `query_row_controller.js` expand/collapse state |
| `searchEndpointSvc` | `searchEndpointSvc.js` | Search endpoint configuration | `settings_panel_controller.js` + `modules/search_executor.js` |
| `searchErrorTranslatorSvc` | `searchErrorTranslatorSvc.js` | Translates search errors to user-friendly messages | Errors surfaced in `query_row_controller.js` / `modules/search_executor.js` |
| `docCacheSvc` | `docCacheSvc.js` | Document caching | In-memory caches in `query_row_controller.js` (try/scorer config) |
| `varExtractorSvc` | `varExtractorSvc.js` | Extract variables from query templates | Curator var extraction in `settings_panel_controller.js` |
| `userSvc` | `userSvc.js` | User data management | Rails session + header account menu (non-core pages may vary) |
| `teamSvc` | `teamSvc.js` | Team management | `share_case_controller.js`, team Rails resources |
| `bookSvc` | `bookSvc.js` | Book/collection management | `judgements_controller.js` + books API |

---

## Factories

All in `app/assets/javascripts/factories/`. Factories have no direct visual representation.

| Factory | Purpose | Current codebase |
|---------|---------|------------------|
| `AnnotationFactory` | Creates annotation objects | JSON from annotations API; plain objects in `settings_panel_controller.js` |
| `ScorerFactory` | Creates scorer objects with scale and scoring logic | `modules/scorer.js`, `modules/scorer_executor.js`; API returns scorer JSON |
| `SettingsFactory` | Creates settings objects for cases/tries | ActiveRecord `Try` / serializer JSON consumed by `settings_panel_controller.js` |
| `SnapshotFactory` | Creates snapshot objects | API snapshot objects; `snapshot_comparison_controller.js` |
| `TryFactory` | Creates try/version objects | Rails `Try` model + ERB in history tab |
| `DocListFactory` | Creates document list objects with search result management | Search hits array built in `query_row_controller.js` after `executeSearch` |

---

## Third-Party Angular Libraries

Used in the `QuepidApp` module:

| Library | Purpose | Current codebase | Visible In |
|---------|---------|------------------|------------|
| `ngRoute` | Client-side routing | Rails routes + full page loads / Turbo; no client router on core | — (routing infrastructure) |
| `ngCookies` | Cookie management | Rails session cookies | — (invisible) |
| `ngSanitize` | HTML sanitization for `ng-bind-html` | Prefer text escaping in `field_renderer.js`; structured HTML only where trusted | — (invisible) |
| `ngAnimate` | Animation support | CSS transitions only where used | — (transitions) |
| `ui.bootstrap` | Modals, dropdowns, tabs, popovers, tooltips, typeahead, accordion, progressbar, collapse | Bootstrap 5 components + `Modal` in Stimulus; `dropdown-menu`, `nav-tabs` in ERB | SS-02 (dropdown), SS-06 (popover), SS-07 (tabs), SS-09 (accordion), SS-12 (modal), SS-28 (progressbar) |
| `ui.sortable` | Drag-drop query reordering | `sortablejs` dynamic import in `query_list_controller.js` | SS-80 (drag handle + mid-drag state, 🟠 mockup: approximation) |
| `ui.ace` | ACE code editor | Plain `<textarea>` in query sandbox and query options modal (ACE not wired on core) | SS-07, SS-25, SS-54 (code editors in query sandbox, query options) |
| `ngJsonExplorer` | `<json-explorer>` for structured JSON viewing | `JSON.stringify` / `<pre>` blocks in `query_explain_modal_controller.js` | SS-23 (query explain JSON display) |
| `ngVega` | Vega visualization embedding | Vega on `analytics/tries_visualization` + `frog_report_controller.js` (`vegaEmbed`) | SS-68 (tries tree visualization) |
| `ngTagsInput` | Tag input components | Wizard/query tags UI in `wizard_controller.js` (custom DOM, not ngTagsInput) | — (not clearly visible in any screenshot) |
| `countUp` | Animated number counting | Static or updated counts in DOM | — (used for result count animation) |
| `ng-rails-csrf` | Rails CSRF token handling | `csrfToken()` in `modules/api_url.js` | — (invisible) |
| `ngCsvImport` | `<ng-csv-import>` for CSV file upload | Native `<input type="file">` in import modal | SS-20 (import ratings modal file chooser) |
| `ngclipboard` | Copy to clipboard | `navigator.clipboard` / `query_explain_modal_controller.js#copyActive` | SS-23 (Copy button in explain modal) |
| `dir-paginate` | Pagination directive and controls | `query_list_controller.js` renders pagination controls | SS-62 (page 1/2 controls) |

---

## Visual Layout Summary

```
+------------------------------------------------------------------+
|  HEADER NAVBAR  (SS-01 top, SS-02, SS-36, SS-37)                  |
|  [Quepid Logo] [Cases ▼] [Books ▼] [Teams] [Scorers] [Notebooks] |
|                                    [Manual] [Wiki] [Avatar ▼]     |
+------------------------------------------------------------------+
|                                                                    |
|  CASE HEADER  (SS-03, SS-48)                                       |
|  [Score + Sparkline]  Current case: {name} — {try} — {scorer}     |
|                       [Diff scores when comparing]                 |
|                                                                    |
|  CASE ACTIONS BAR  (SS-03)                                         |
|  [Scorer] [Judgements] [Snapshot] [Compare] [Import] [Share]       |
|  [Clone] [Delete] [Export] [Tune Relevance]                        |
|                                                                    |
+----------------------------------+-------------------------------+
|  QUERY LIST  (SS-04)             |  TUNE RELEVANCE  (SS-07–11)  |
|                                  |                               |
|  [Add Query input]               |  [Query Sandbox tab] (SS-07)  |
|  [Sort] [Filter] [Frog Report]   |    Query params textarea      |
|                                  |  [Tuning Knobs tab] (SS-08)   |
|  Query 1: [score] query text     |    Variable controls          |
|   (SS-05 expanded)               |  [Settings tab] (SS-09)       |
|    Doc 1: [rating] title fields  |    Endpoint, fields config    |
|      [stacked chart] (SS-28)     |  [History tab] (SS-10)        |
|    Doc 2: [rating] title fields  |    List of tries              |
|    ...                           |  [Annotations tab] (SS-11)    |
|  [Peek / Browse] (SS-30)        |    Create/list annotations    |
|                                  |                               |
|  Query 2: [score] query text     |                               |
|    ...                           |                               |
|                                  |                               |
|  [Pagination controls] (SS-62)   |                               |
+----------------------------------+-------------------------------+
|  FOOTER  (SS-38)                                                   |
+------------------------------------------------------------------+
```

---

## Additional Screenshots (Gap Captures)

These screenshots were created during the inventory gap analysis to cover components not visible in the original SS-01 through SS-60 set. Each entry notes whether it was captured from the live app or rendered as a mockup.

| Screenshot | Component | Current codebase | What's Visible |
|------------|-----------|------------------|----------------|
| SS-61 `61_annotation_list_with_items.png` | `<annotation>` | `settings_panel_controller.js` annotation list HTML | Three annotation items showing timestamp, author, try number, score, message, and hamburger dropdown menu |
| SS-61b `61b_annotation_update_modal.png` | `annotation/_update.html` | Annotation edit flow in `settings_panel_controller.js` | Edit Annotation modal with textarea and Update/Cancel buttons |
| SS-62 `62_pagination_controls.png` | `dir-paginate` | `query_list_controller.js` pagination markup | Page 1/2 navigation controls (prev, 1, 2, next) |
| SS-64 `64_debug_matches_modal.png` | `<debug-matches>`, `DetailedExplainCtrl` | Match-breakdown / explain output in `query_row_controller.js` (not a separate modal) | Debug Explain modal with collapsible JSON tree — idf, tf, field weights |
| SS-65 `65_expand_content_modal.png` | `<expand-content>` | Long explain text in stacked chart / explain path | Expanded View modal with full relevancy score explain text |
| SS-66 `66_query_diff_results.png` | `<query-diff-results>` | `query_row_controller.js` diff columns + `snapshot_comparison_controller.js` | Side-by-side "Current Results" vs "Snapshot" with ranked documents and "No result" alerts |
| SS-68 `68_vega_visualization.png` | `[vega]`, `ngVega` | `analytics/tries_visualization` Rails view + Vega spec fetch | "Visualize your tries" tree/cluster graph (Playwright capture from live app) |
| SS-69 `69_404_page.png` | `404Ctrl` | `core/not_found.html.erb` / app 404 handling | "Not found :(" page with mistyped address / out-of-date link explanation |
| SS-70 `70_flash_messages.png` | `flash.html`, `search_flash.html` | `flash_controller.js`, `showFlash` helper | Success (green) and error (red) alert banners with close buttons |
| SS-71 `71_delete_case_simple_modal.png` | `<delete-case>` | `confirm_delete_controller.js` / delete options | "Delete This Case" confirmation with warning text, Delete / Cancel buttons |
| SS-72 `72_unarchive_case_modal.png` | `UnarchiveCaseCtrl` | `unarchive_controller.js` | "Archived Cases" list with selection highlight, "Add Back" button |
| SS-73 `73_case_header_badges.png` | Case header badges | `_case_header.html.erb` ERB + `unarchive_controller.js` | PUBLIC (blue) and ARCHIVED (orange) label badges, nightly repeat icon |
| SS-74 `74_diff_scores_header.png` | `<qscore-case>` repeated | `query_row_controller.js` snapshot score badges + `case_score_controller.js` | Current score (green 0.66) alongside snapshot score (blue 0.52) in case header |
| SS-75 `75_query_error_state.png` | `queryStateClass` filter | Inline error alerts in results; row chrome may differ | Red "ERR" badge with orange error warning on pink row, between normal query rows |
| SS-76 `76_threshold_indicator.png` | Threshold color bar | Not implemented in Stimulus results UI | Green bar (above threshold) and red bar (below threshold) with check/X icons |
| SS-77 `77_search_endpoint_typeahead.png` | `searchEndpoint_popup.html` | `<select>` + `settings_panel_controller.js` endpoint loading | Typeahead dropdown showing Solr icon + highlighted endpoint URLs |
| SS-78 `78_media_embed.png` | `[quepid-embed]` | `modules/field_renderer.js` | Audio player, image placeholder, and video player for media-type fields |
| SS-79 `79_debug_expand_buttons.png` | `<debug-matches>`, `<expand-content>` | **Match breakdown** toggle + explain in `query_row_controller.js` | "Debug" and "Expand" inline action buttons |
| SS-80 `80_drag_drop_reorder.png` | `ui.sortable` | `sortablejs` in `query_list_controller.js` | Hamburger grip handles on query rows, mid-drag state with dashed border |

Screenshots marked 🟡 or 🟠 were rendered from a static HTML harness at `docs/scripts/render_isolated_components.html`, not from the running Angular app:
- **🟡 mockup: real template** — uses the actual Angular template HTML (`annotation.html`, `_modal.html`, `404.html`, etc.) with `{{ }}` bindings replaced by literal dummy data. Layout and structure match the real component.
- **🟠 mockup: approximation** — hand-built HTML representing the component's visual appearance. Uses the same Bootstrap 3 CSS as the app but may differ from the real rendering in details.

SS-62 (pagination) and SS-68 (Vega) were captured via Playwright from the live running app.

### Summary Counts

| Status | Count |
|--------|-------|
| **Captured** (component visible in at least one screenshot) | **All visual elements** |
| **Behavior-only** (invisible: `[auto-grow]`, `[text-paste]`) | 2 — no screenshot needed |
| **Non-visual** (services, factories, filters as code) | ~40 — no screenshot needed |

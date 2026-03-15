# AngularJS UI Inventory

A comprehensive catalog of everything the Angular UI displays in Quepid, organized by functional area. Each item references the screenshot(s) where it is visible, using images from `docs/images/core_case_evaluation_manual/`.

**Screenshot legend:** `SS-01` = `01_full_layout.png`, `W4b` = `wizard_04b_engine_selection.png`, etc.

**Source legend** — each screenshot description is tagged with how it was produced:
- No tag = **captured from the running app** via Playwright
- **🟡 mockup: real template** = rendered from the actual Angular template HTML with dummy data substituted for `{{ }}` bindings. Faithful to the real component layout.
- **🟠 mockup: approximation** = hand-built HTML that represents the component's visual appearance but was not derived from the actual template. May differ from the real rendering in styling details.

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

| What | File(s) | Screenshot | Where in Screenshot |
|------|---------|------------|---------------------|
| App bootstrap | `app/views/layouts/core.html.erb` | SS-01 | Full page — the entire shell |
| Header navbar | `app/views/layouts/_header_core_app.html.erb` | SS-01, SS-02 | Top blue bar with logo and nav links |
| Footer | `app/views/layouts/_footer_core_app.html.erb` | SS-01, SS-38 | Bottom of page — copyright, Slack link |
| Main content | `app/views/core/index.html.erb` | SS-01 | White content area below header |
| Flash messages | `app/assets/templates/views/common/flash.html` | SS-70 | Success and error alert banners with close button (🟡 mockup: real template) |
| Search flash | `app/assets/templates/views/common/search_flash.html` | SS-70 | Error alert — "Could not connect to search endpoint" (🟡 mockup: real template) |
| 404 page | `app/assets/templates/views/404.html` | SS-69 | "Not found :(" with bullet list of possible causes (🟡 mockup: real template) |
| Loading/bootstrapping | `LoadingCtrl` | SS-16 | Center of page — spinner with "Bootstrapping Queries" text |

### Header Navigation Elements (HeaderCtrl)

| Element | Screenshot | Where in Screenshot |
|---------|------------|---------------------|
| Relevancy Cases dropdown | SS-02 | Top-left — dropdown open showing "RECENT CASES", case list, "View all cases", "+ Create a case" |
| Books dropdown | SS-37 | Top-left — dropdown open showing "RECENT BOOKS", "View all books", "Create a book" |
| Teams link | SS-01 | Header bar, 4th nav item |
| Scorers link | SS-01 | Header bar, 5th nav item |
| Notebooks link | SS-01 | Header bar, 6th nav item |
| User menu dropdown | SS-36 | Top-right — avatar + name, dropdown: My profile, Log out, API Docs, Admin Home, Users, Announcements, Job Manager |
| User Manual / Wiki links | SS-36 | Top-right, to the left of the avatar |
| `<new-case>` button | SS-02 | Inside Cases dropdown — green "+ Create a case" button at bottom |

---

## Case Header & Score Display

**Template:** `app/assets/templates/views/queriesLayout.html`
**Controller:** `CaseCtrl`, `CurrSettingsCtrl`

| What | Component/Element | Screenshot | Where in Screenshot |
|------|-------------------|------------|---------------------|
| Current case score (no graph) | `<qscore-case>` | SS-01 | Upper-left — red "0.00" box (no history, no sparkline) |
| Current case score (with sparkline) | `<qscore-case>` + `<qgraph>` | SS-03 | Upper-left — green "0.66" box with line graph and "AP@10" label |
| Snapshot diff scores | `<qscore-case>` (repeated) | SS-74 | Current score (green 0.66) alongside snapshot score (blue 0.52) side by side (🟠 mockup: approximation) |
| Case name (display) | Inline text | SS-03 | "10s of Queries" in large text, right of score |
| Case name (edit mode) | Inline form | SS-48 | Yellow-highlighted input with "10s of Queries", Rename/Cancel buttons |
| PUBLIC badge | `<span>` | SS-73 | Blue "PUBLIC" label badge in case header (🟠 mockup: approximation) |
| ARCHIVED badge | `<span>` | SS-73 | Orange "ARCHIVED" label badge in case header (🟠 mockup: approximation) |
| Nightly indicator | `<i class="bi bi-repeat">` | SS-73 | Blue repeat icon next to "Current case" text (🟠 mockup: approximation) |
| Current try name | Inline text | SS-03 | "— Try 31 —" to the right of case name |
| Scorer name | `<small>` | SS-03 | "— AP@10" at the end of the header line |

### Score Display Components

| Component | File | Screenshot | Where in Screenshot |
|-----------|------|------------|---------------------|
| `<qscore-case>` (simple) | `components/qscore_case/` | SS-01 | Upper-left — red score boxes (0.00) with no sparkline |
| `<qscore-case>` (with graph) | `components/qscore_case/` | SS-03 | Upper-left — score box with embedded line chart |
| `<qscore-query>` | `components/qscore_query/` | SS-01, SS-04 | Left edge of each query row — color-coded score badges (red 0.00, green 0.73, etc.) |
| `<qgraph>` | `components/qgraph/` | SS-03 | Embedded in the case score box — small SVG sparkline chart |

---

## Case Action Bar

**Template:** `app/assets/templates/views/queriesLayout.html` (lines 78–136)
**Controller:** `CaseCtrl`

A horizontal toolbar of actions for the current case.

**Visible in:** SS-01 (small), SS-03 (zoomed, full bar)

| Action | Component | Screenshot | Where in Screenshot |
|--------|-----------|------------|---------------------|
| Select scorer | `ng-click="pickCaseScorer()"` | SS-03 | Action bar — "Select scorer" with tasks icon |
| Judgements | `<judgements>` | SS-03 | Action bar — "Judgements" with book icon |
| Create snapshot | `TakeSnapshotCtrl` | SS-03 | Action bar — "Create snapshot" with camera icon |
| Compare snapshots | `<diff>` | SS-03 | Action bar — "Compare snapshots" with bar chart icon |
| Import ratings | `<import-ratings>` | SS-03 | Action bar — "Import" |
| Share case | `<share-case>` | SS-03 | Action bar — "Share case" with arrow icon |
| Clone case | `<clone-case>` | SS-03 | Action bar — "Clone" with copy icon |
| Delete case | `<delete-case-options>` | SS-03 | Action bar — "Delete" with X icon |
| Export case | `<export-case>` | SS-03 | Action bar — "Export" with document icon |
| Tune Relevance | `ng-click="toggleDevSettings()"` | SS-03 | Action bar — "Tune Relevance" with wrench icon |

---

## Query List

**Directive:** `<queries>`
**Template:** `app/assets/templates/views/queries.html`
**Controller:** `QueriesCtrl`

**Visible in:** SS-01 (full), SS-04 (zoomed)

| What | Screenshot | Where in Screenshot |
|------|------------|---------------------|
| Add query input | SS-04 | Top-left — "Add a query to this case" text input + green "Add query" button |
| "Show only rated" checkbox | SS-04 | Top-right row — checkbox |
| "Collapse all" link | SS-04 | Top-right row — link |
| Sort controls | SS-04 | Top-right row — "Sort Manual ↓ Name Modified Score Errors" |
| Filter queries input | SS-04 | Second right row — "Filter Queries" text input |
| "Number of Queries" count | SS-04 | Far right — "Number of Queries: 3" |
| Frog report link | SS-04 | Second right row — frog emoji "Report" link |
| Collapsed query rows | SS-04 | Main area — rows with score badge, query text, result count, chevron |
| Pagination controls | SS-62 | Page 1/2 navigation at bottom of query list |
| Drag-drop reorder handle | SS-80 | Hamburger grip icon on query rows, second row shown mid-drag with dashed border (🟠 mockup: approximation) |

---

## Search Results

### Per-Query Results Block

**Directive:** `<search-results>`
**Template:** `app/assets/templates/views/searchResults.html`
**Controller:** `SearchResultsCtrl`

**Visible in:** SS-05 (expanded query)

| What | Component | Screenshot | Where in Screenshot |
|------|-----------|------------|---------------------|
| Query score | `<qscore-query>` | SS-05 | Left edge — red "0.00" badge |
| Query text | Editable inline | SS-05 | "star wars" text next to score |
| Result count | Badge | SS-05 | Right side — "2477" |
| Expand/collapse chevron | Icon | SS-04 | Right edge of each row — blue down chevron |
| Score All button + popover | `rateBulkSvc` | SS-06, SS-49 | Top of expanded query — "Score All" with dropdown showing scale buttons |
| Query toolbar | Various | SS-05 | Row of buttons: Toggle Notes, Explain Query, Missing Documents, Query Options, Move, Delete (and Copy, green/red result buttons) |
| `<query-explain>` button | `<query-explain>` | SS-05 | Toolbar — "Explain Query" button |
| `<query-options>` button | `<query-options>` | SS-05 | Toolbar — "Query Options" (labeled "Set Options") button |
| `<move-query>` button | `<move-query>` | SS-05 | Toolbar — move icon |
| Delete query button | Action button | SS-05 | Toolbar — red "Delete Query" button (labeled "Delete Query") |
| Missing Documents button | `TargetedSearchCtrl` | SS-05 | Toolbar — "Missing Documents" button |
| Toggle Notes button | `QueryNotesCtrl` | SS-05 | Toolbar — "Toggle Notes" button |
| Notes/Information Need | `QueryNotesCtrl` | SS-29 | Below query header — "Information Need" text input, "Notes on this Query" textarea, Save button |
| Diff results columns | `<query-diff-results>` | SS-66 | "Current Results" vs "Snapshot 3/10/26" side-by-side with doc titles, ranks, and "No result at position 3" alert (🟠 mockup: approximation) |
| Threshold indicator | Color bar | SS-76 | Green bar (above threshold) and red bar (below threshold) with check/X icons (🟠 mockup: approximation) |

### Individual Document Result

**Directive:** `<search-result>`
**Template:** `app/assets/templates/views/searchResult.html`
**Controller:** `SearchResultCtrl`

**Visible in:** SS-05 (list), SS-28 (zoomed single doc)

| What | Screenshot | Where in Screenshot |
|------|------------|---------------------|
| Rating dropdown (unrated) | SS-05 | Left edge of each doc — gray "-- ▼" dropdown |
| Rating popover (open) | SS-06 | Popover with scale buttons (0 Irrelevant, 1 Relevant, RESET) |
| Rating dropdown (rated) | SS-49 | Left edge — green "1 ▼" dropdown showing current rating |
| Document title (linked) | SS-05, SS-28 | Blue linked text — "Star Wars Uncut: Director's Cut" |
| Document thumbnail | SS-05 | Small poster image to left of title |
| Document fields | SS-05, SS-28 | Below title — "overview:", "cast:", "Rank: #1", etc. |
| Matches / stacked chart | SS-28 | Right side — "Matches" heading with colored bars (float(vote_average), weight(title:...), etc.) and "Show 1 More" link |
| "Peek at next page" | — | SS-30 | Below last result — "Peek at the next page of results" link |
| "Browse on Solr" button | — | SS-30 | Green button — "Browse 1771 Results on Solr" |
| "Results above are counted" | — | SS-30 | Green text divider between scored and unscored results |
| Detailed doc link | SS-05 | Doc title is clickable to open detailed view |
| Media embed `[quepid-embed]` | SS-78 | Audio player, image placeholder, video player for media fields (🟠 mockup: approximation) |
| `<expand-content>` button | SS-79 | "Expand" button with arrows icon (🟡 mockup: real template) |
| `<debug-matches>` button | SS-79 | "Debug" button (🟡 mockup: real template) |

### Stacked Chart & Matches

| Component | Screenshot | Where in Screenshot |
|-----------|------------|---------------------|
| `<stacked-chart>` | SS-28 | Right side of document result — colored horizontal progress bars |
| Matches popover | SS-28 | "Matches" section with factor names and bars |

---

## Query Parameters / Tune Relevance Panel

**Directive:** `<query-params>`
**Template:** `app/assets/templates/views/devQueryParams.html`
**Controller:** `QueryParamsCtrl`

The east pane (toggled by "Tune Relevance") contains a tabbed interface. All tabs share the same dark background style.

| Tab | Screenshot | What's Visible |
|-----|------------|----------------|
| **Query Sandbox** | SS-07, SS-54 | Tab bar at top, "Query Sandbox:" heading, text editor with query params (`q=#$query##&magicBoost=31`), "Rerun My Searches!" blue button |
| **Tuning Knobs** | SS-08 | Explanatory text about `##variable##` syntax, "Tuning Knobs" heading, empty state ("Add and remove knobs from here by editing your query"), "Rerun My Searches!" button |
| **Settings** | SS-09, SS-53, SS-55, SS-56 | Accordion sections: Search Endpoints, Endpoint Details (with Solr icon + URL), Displayed Fields (text input), Number of Results to Show (input), Evaluate Nightly?, Escape Queries, "Rerun My Searches!" button |
| **History** | SS-10, SS-31 | "Visualize your tries \| Check Scores \| Check Ratings" links, instruction text, list of tries with try name, query snippet, endpoint label; "..." action button on hover |
| **Annotations** | SS-11 | Explanatory text about annotations, "Why?" section, "Scroll down to view list" link, Message textarea, green "Create" button, "Existing Annotations" heading |

### Sub-Components in East Pane

| Component | Screenshot | Where in Screenshot |
|-----------|------------|---------------------|
| `<query-params-history>` (try list) | SS-10 | History tab — rows showing Try 31, Try 30, etc. with query snippets and endpoint URLs |
| `<annotations>` (create form) | SS-11 | Annotations tab — Message textarea + Create button |
| `<annotation>` (single item) | SS-61 | Annotation items with timestamp, author, try/score, message, hamburger menu (🟡 mockup: real template) |
| `<custom-headers>` | SS-53 | Settings tab — custom headers editor area |
| Query params details (try "..." menu) | SS-31 | History tab — single try with "..." button visible, showing Try 1 details |
| Search endpoint typeahead popup | SS-77 | Dropdown showing Solr icon + highlighted endpoint URLs matching typed text (🟠 mockup: approximation) |

---

## Modals & Dialogs

### Case Wizard

**Template:** `app/assets/templates/views/wizardModal.html`
**Controller:** `WizardCtrl` / `WizardModalCtrl`

| Step | Screenshot | What's Visible |
|------|------------|----------------|
| Welcome (Rails page) | W1 | "Create Your First Relevancy Case" landing page |
| Doug's welcome | W2 | Introductory text |
| Name your case | W3 | Name input form |
| Search endpoint (accordion) | W4 | Accordion showing step titles |
| Engine selection | W4b | Radio buttons for Solr, Elasticsearch, OpenSearch, Vectara, CSV Static File, Custom Search API, Algolia; URL input, "ping it" link, Solr Configuration accordion, Continue button; step tabs at bottom (WELCOME, NAME, ENDPOINT, FIELDS, QUERY, FINISH) |
| Endpoint result | W4b2 | Validation display after testing endpoint |
| Display fields | W5 | Title, ID, and additional fields selection |
| Add queries | W6 | Query input form |
| Finish | W7 | Confirmation screen |

### Component Modals

| Modal | Component | Screenshot | What's Visible |
|-------|-----------|------------|----------------|
| Snapshot | `TakeSnapshotCtrl` | SS-12 | "Take a Snapshot of all your queries?" — name input, Include Document Fields checkbox, Take Snapshot / Cancel buttons |
| Compare snapshots (diff) | `<diff>` | SS-13, SS-60 | "Compare Your Search Results" — Snapshot 1 dropdown, "+ Add Snapshot" button, Update Comparison Settings / Clear Comparison View / Cancel buttons |
| Select scorer | `ScorerCtrl` | SS-14 | "How would you like to score this case?" — list of scorers (nDCG@10, DCG@10, CG@10, P@10, AP@10 highlighted, RR@10), + Create New Scorer / Select Scorer / Cancel buttons |
| Delete options | `<delete-case-options>` | SS-15 | "Delete Options for Case" — three toggle buttons (Delete All Queries, Archive Case, Delete Case), Cancel / red Delete button |
| Clone case | `<clone-case>` | SS-17 | "Clone case: TMDB Movie Search" — new case name input, history toggle (Only specific try / Entire history), try selector dropdown, content checkboxes (Include Queries, Include Ratings), Cancel / Clone buttons |
| Share case | `<share-case>` | SS-18 | "Share Case" — empty state "No teams to share with?", "+ Create a team" button (appears twice), Cancel button |
| Export case | `<export-case>` | SS-19 | "Export Case: TMDB Movie Search" — radio buttons for formats: Information Need, General, Detailed, Snapshot (with dropdown), Basic, TREC, Rated Ranking Evaluator/RankQuest, Learning to Rank; each with CSV column descriptions |
| Import ratings | `<import-ratings>` | SS-20 | "Import into Case" — tabs (Ratings, Information Needs, Snapshots), format radio buttons (CSV, Rated Ranking Evaluator, Learning to Rank), file chooser, example CSV text, Clear existing queries checkbox, Cancel / Import buttons |
| Judgements | `<judgements>` | SS-21 | "Judgements" — explanatory text about Books, blue info banner about sharing with team, Populate Book checkbox, Populate missing Queries checkbox, + Create a book / Refresh ratings from book / Cancel buttons |
| Frog report | `<frog-report>` | SS-22 | "The Frog Pond Report" — summary stats (queries, results, ratings needed), distribution chart (red bar chart of queries by missing rating count), Close button |
| Query explain | `<query-explain>` | SS-23 | "Explain Query Parsing" — tabs (Params, Parsing, Query Template), JSON display of processed query parameters, Copy / Close buttons |
| Targeted search | `TargetedSearchModalCtrl` | SS-24 | "Find and Rate Missing Documents" — search input, explanatory text about Lucene query syntax, Search / Reset to All Rated Docs buttons, Close button |
| Query options | `<query-options>` | SS-25 | "Query Options" — explanatory text about JSON key-value objects, ACE editor with `{}`, Set Options / Cancel buttons |
| Move query | `<move-query>` | SS-26 | "Move Query to Another Case" — empty state "Please create another case to move this query to first", Cancel button |
| Detailed document | `DetailedDocCtrl` | SS-27 | "Detailed Document View of doc: 578870" — document title, field table (overview, Thumb URL), View Document / View All Fields / Close buttons |
| Archive case confirm | — | SS-52 | Simple "Confirm" dialog — "Archive SOLR CASE?", Cancel / red Confirm buttons (shown over cases list page) |

### Additional Modals (Static Mockups)

| Modal | Component | Screenshot | What's Visible |
|-------|-----------|------------|----------------|
| Unarchive case | `UnarchiveCaseCtrl` | SS-72 | "Archived Cases" — list of archived cases with selection highlight, "Add Back" button (🟡 mockup: real template) |
| Delete case (simple) | `<delete-case>` | SS-71 | "Delete This Case" — warning text about permanent deletion, Delete / Cancel buttons (🟡 mockup: real template) |
| Detailed explain | `DetailedExplainCtrl` | SS-64 | Debug explain with collapsible JSON tree of Lucene scoring — idf, tf, field weights (🟡 mockup: real template) |
| Debug matches | `<debug-matches>` | SS-64 | Same template as detailed explain (🟡 mockup: real template) |
| Expand content | `<expand-content>` | SS-65 | "Expanded View" — full relevancy score as preformatted text (🟡 mockup: real template) |
| Annotation update | `annotation/_update.html` | SS-61b | "Edit Annotation" — textarea with message, Update / Cancel buttons (🟡 mockup: real template) |

---

## Custom Element Directives

Complete list of custom HTML elements, with screenshot references:

| Element | Directory | Screenshot | Where Visible |
|---------|-----------|------------|---------------|
| `<qscore-case>` | `components/qscore_case/` | SS-01, SS-03 | Case header, upper-left — score box |
| `<qscore-query>` | `components/qscore_query/` | SS-01, SS-04, SS-05 | Left edge of each query row — colored score badge |
| `<qgraph>` | `components/qgraph/` | SS-03 | Inside case score box — sparkline SVG |
| `<queries>` | `directives/queries.js` | SS-01, SS-04 | Main content pane — entire query list area |
| `<search-results>` | `directives/searchResults.js` | SS-05 | Each query row (expanded shows documents) |
| `<search-result>` | `directives/searchResult.js` | SS-05, SS-28 | Each document within an expanded query |
| `<query-params>` | `directives/queryParams.js` | SS-07–SS-11 | East pane — tabbed interface |
| `<query-params-history>` | `directives/queryParamsHistory.js` | SS-10, SS-31 | East pane History tab — try list |
| `<custom-headers>` | `directives/customHeaders.js` | SS-53 | East pane Settings tab — headers editor |
| `<query-diff-results>` | `directives/queryDiffResults.js` | SS-66 | Side-by-side "Current Results" vs "Snapshot" with doc comparisons (🟠 mockup: approximation) |
| `<stacked-chart>` | `directives/stackedChart.js` | SS-28 | Right side of document — colored bars |
| `<add-query>` | `components/add_query/` | SS-04 | Top of query list — input + green button |
| `<query-explain>` | `components/query_explain/` | SS-05 (button), SS-23 (modal) | Toolbar button; modal content |
| `<query-options>` | `components/query_options/` | SS-05 (button), SS-25 (modal) | Toolbar button; modal content |
| `<move-query>` | `components/move_query/` | SS-05 (button), SS-26 (modal) | Toolbar button; modal content |
| `<new-case>` | `components/new_case/` | SS-02 | Inside Cases dropdown — "+ Create a case" |
| `<delete-case>` | `components/delete_case/` | SS-71 | Simple "Delete This Case" confirmation modal (🟡 mockup: real template) |
| `<delete-case-options>` | `components/delete_case_options/` | SS-03 (button), SS-15 (modal) | Action bar "Delete"; modal |
| `<clone-case>` | `components/clone_case/` | SS-03 (button), SS-17 (modal) | Action bar "Clone"; modal |
| `<share-case>` | `components/share_case/` | SS-03 (button), SS-18 (modal) | Action bar "Share case"; modal |
| `<export-case>` | `components/export_case/` | SS-03 (button), SS-19 (modal) | Action bar "Export"; modal |
| `<import-ratings>` | `components/import_ratings/` | SS-03 (button), SS-20 (modal) | Action bar "Import"; modal |
| `<judgements>` | `components/judgements/` | SS-03 (button), SS-21 (modal) | Action bar "Judgements"; modal |
| `<annotation>` | `components/annotation/` | SS-61 | Annotation items with timestamp, author, try number, score, message, and hamburger menu (🟡 mockup: real template) |
| `<annotations>` | `components/annotations/` | SS-11 | East pane Annotations tab — create form + list |
| `<diff>` | `components/diff/` | SS-03 (button), SS-13/SS-60 (modal) | Action bar "Compare snapshots"; modal |
| `<frog-report>` | `components/frog_report/` | SS-04 (link), SS-22 (modal) | Query list controls — frog "Report" link; modal |
| `<debug-matches>` | `components/debug_matches/` | SS-64 | Debug explain modal with JSON tree of Lucene scoring (🟡 mockup: real template) |
| `<action-icon>` | `components/action_icon/` | SS-05 | Various toolbar icon-buttons in expanded query |
| `<expand-content>` | `components/expand_content/` | SS-65 | Expanded view modal with full relevancy score explain text (🟡 mockup: real template) |

---

## Attribute Directives

| Attribute | File | Screenshot | Where Visible |
|-----------|------|------------|---------------|
| `[quepid-embed]` | `directives/searchResult.js` | SS-78 | Audio player, image placeholder, and video player for media-type fields (🟠 mockup: approximation) |
| `[auto-grow]` | `directives/autoGrow.js` | — | Invisible behavior — auto-widening input (no screenshot needed) |
| `[text-paste]` | `directives/textPaste.js` | — | Invisible behavior — paste handler (no screenshot needed) |
| `[vega]` | `directives/angular-vega.js` | SS-68 | Tries visualization tree/cluster graph (Playwright capture) |

---

## Filters

Filters are data transformations applied in templates. Their effect is visible but the filter itself is invisible code.

| Filter | File | Visual Effect Visible In |
|--------|------|--------------------------|
| `scoreDisplay` | `filters/scoreDisplay.js` | SS-01, SS-04 — score values formatted to 2 decimal places (e.g., "0.00", "0.73") |
| `ratingBgStyle` | `filters/ratingBgStyle.js` | SS-01, SS-04 — color-coded score badges (red=low, green=high) |
| `queryStateClass` | `filters/queryStateClass.js` | SS-75 | Red "ERR" badge with orange error warning text on pink background row (🟠 mockup: approximation) |
| `searchEngineName` | `filters/searchEngineName.js` | SS-10 — "using Solr" text in try history items |
| `caseType` | `filters/caseType.js` | — (used for filtering, no visual output) |
| `plusOrMinus` | `directives/searchResults.js` | SS-04 — chevron icons on query rows |
| `stackChartColor` | `directives/stackedChart.js` | SS-28 — colored progress bar segments |
| `stackChartHeight` | `directives/stackedChart.js` | SS-28 — bar height proportions |
| `stackChartLeftover` | `directives/stackedChart.js` | SS-28 — remaining space calculation |

---

## Controllers

All in `app/assets/javascripts/controllers/`:

| Controller | File | Screenshot | Purpose |
|------------|------|------------|---------|
| `MainCtrl` | `mainCtrl.js` | SS-01 | Root controller, initializes app state |
| `HeaderCtrl` | `headerCtrl.js` | SS-02, SS-37 | Navigation header: case/book dropdowns |
| `LoadingCtrl` | `loading.js` | SS-16 | Loading spinner while app bootstraps |
| `CaseCtrl` | `case.js` | SS-03, SS-48 | Case header: rename, actions, scorer selection |
| `CurrSettingsCtrl` | `currSettings.js` | SS-03 | Current try display and rename |
| `SettingsCtrl` | `settings.js` | SS-09 | Settings management |
| `QueriesCtrl` | `queriesCtrl.js` | SS-04 | Query list: sorting, filtering, pagination |
| `SearchResultsCtrl` | `searchResults.js` | SS-05 | Per-query result block: expand/collapse |
| `SearchResultCtrl` | `searchResult.js` | SS-05, SS-28 | Individual document: rating, fields, explain |
| `QueryParamsCtrl` | `queryParams.js` | SS-07 | Query parameter editor tabs |
| `QueryParamsHistoryCtrl` | `queryParamsHistory.js` | SS-10 | Try history list |
| `QueryParamsDetailsCtrl` | `queryParamsDetails.js` | SS-31 | Try detail view and rename |
| `CustomHeadersCtrl` | `customHeaders.js` | SS-53 | Custom HTTP headers editor |
| `QueryNotesCtrl` | `queryNotes.js` | SS-29 | Per-query notes/information needs |
| `QueryDiffResultsCtrl` | `queryDiffResults.js` | SS-66 | Diff comparison side-by-side columns (🟠 mockup: approximation) |
| `WizardCtrl` | `wizardCtrl.js` | W1–W7 | New case wizard launcher |
| `WizardModalCtrl` | `wizardModal.js` | W2–W7 | New case wizard modal steps |
| `TakeSnapshotCtrl` | `takeSnapshot.js` | SS-12 | Snapshot creation |
| `PromptSnapshotCtrl` | `promptSnapshot.js` | SS-12 | Snapshot creation modal |
| `ScorerCtrl` | `scorer.js` | SS-14 | Scorer picker modal |
| `DetailedDocCtrl` | `detailedDoc.js` | SS-27 | Full document viewer modal |
| `DetailedExplainCtrl` | `detailedExplain.js` | SS-64 | Debug explain modal (🟡 mockup: real template) |
| `DocFinderCtrl` | `docFinder.js` | SS-24 | Document search/finder |
| `TargetedSearchCtrl` | `targetedSearchCtrl.js` | SS-24 | Targeted search interface |
| `TargetedSearchModalCtrl` | `targetedSearchModal.js` | SS-24 | Targeted search modal |
| `HotMatchesCtrl` | `hotMatchesCtrl.js` | SS-28 | Relevancy match highlighting |
| `UnarchiveCaseCtrl` | `unarchiveCase.js` | SS-72 | Unarchive case modal (🟡 mockup: real template) |
| `404Ctrl` | `404Ctrl.js` | SS-69 | 404 page (🟡 mockup: real template) |

---

## Services

All in `app/assets/javascripts/services/`. Services have no direct visual representation — they are backend logic for the UI components listed above.

| Service | File | Purpose |
|---------|------|---------|
| `bootstrapSvc` | `bootstrapSvc.js` | App initialization and bootstrap |
| `configurationSvc` | `configurationSvc.js` | App configuration (communal scorers, query sortable) |
| `caseSvc` | `caseSvc.js` | Case CRUD operations |
| `caseTryNavSvc` | `caseTryNavSvc.js` | Navigation between cases and tries; provides `getQuepidRootUrl()` |
| `queriesSvc` | `queriesSvc.js` | Query CRUD and execution |
| `qscoreSvc` | `qscore_service.js` | Score calculation and display |
| `settingsSvc` | `settingsSvc.js` | User/case settings persistence |
| `ratingsStoreSvc` | `ratingsStoreSvc.js` | Rating persistence to backend |
| `rateElementSvc` | `rateElementSvc.js` | Rating UI interaction logic |
| `rateBulkSvc` | `rateBulkSvc.js` | Bulk rating operations |
| `scorerSvc` | `scorerSvc.js` | Scorer management |
| `querySnapshotSvc` | `querySnapshotSvc.js` | Snapshot creation and retrieval |
| `snapshotSearcherSvc` | `snapshotSearcherSvc.js` | Search within snapshots |
| `diffResultsSvc` | `diffResultsSvc.js` | Snapshot comparison logic |
| `annotationsSvc` | `annotationsSvc.js` | Annotation CRUD |
| `importRatingsSvc` | `importRatingsSvc.js` | Rating import from files |
| `caseCSVSvc` | `caseCSVSvc.js` | CSV export generation |
| `paneSvc` | `paneSvc.js` | East/west pane layout management |
| `queryViewSvc` | `queryViewSvc.js` | Query view state (expanded/collapsed) |
| `searchEndpointSvc` | `searchEndpointSvc.js` | Search endpoint configuration |
| `searchErrorTranslatorSvc` | `searchErrorTranslatorSvc.js` | Translates search errors to user-friendly messages |
| `docCacheSvc` | `docCacheSvc.js` | Document caching |
| `varExtractorSvc` | `varExtractorSvc.js` | Extract variables from query templates |
| `userSvc` | `userSvc.js` | User data management |
| `teamSvc` | `teamSvc.js` | Team management |
| `bookSvc` | `bookSvc.js` | Book/collection management |

---

## Factories

All in `app/assets/javascripts/factories/`. Factories have no direct visual representation.

| Factory | Purpose |
|---------|---------|
| `AnnotationFactory` | Creates annotation objects |
| `ScorerFactory` | Creates scorer objects with scale and scoring logic |
| `SettingsFactory` | Creates settings objects for cases/tries |
| `SnapshotFactory` | Creates snapshot objects |
| `TryFactory` | Creates try/version objects |
| `DocListFactory` | Creates document list objects with search result management |

---

## Third-Party Angular Libraries

Used in the `QuepidApp` module:

| Library | Purpose | Visible In |
|---------|---------|------------|
| `ngRoute` | Client-side routing | — (routing infrastructure) |
| `ngCookies` | Cookie management | — (invisible) |
| `ngSanitize` | HTML sanitization for `ng-bind-html` | — (invisible) |
| `ngAnimate` | Animation support | — (transitions) |
| `ui.bootstrap` | Modals, dropdowns, tabs, popovers, tooltips, typeahead, accordion, progressbar, collapse | SS-02 (dropdown), SS-06 (popover), SS-07 (tabs), SS-09 (accordion), SS-12 (modal), SS-28 (progressbar) |
| `ui.sortable` | Drag-drop query reordering | SS-80 (drag handle + mid-drag state, 🟠 mockup: approximation) |
| `ui.ace` | ACE code editor | SS-07, SS-25, SS-54 (code editors in query sandbox, query options) |
| `ngJsonExplorer` | `<json-explorer>` for structured JSON viewing | SS-23 (query explain JSON display) |
| `ngVega` | Vega visualization embedding | SS-68 (tries tree visualization) |
| `ngTagsInput` | Tag input components | — (not clearly visible in any screenshot) |
| `countUp` | Animated number counting | — (used for result count animation) |
| `ng-rails-csrf` | Rails CSRF token handling | — (invisible) |
| `ngCsvImport` | `<ng-csv-import>` for CSV file upload | SS-20 (import ratings modal file chooser) |
| `ngclipboard` | Copy to clipboard | SS-23 (Copy button in explain modal) |
| `dir-paginate` | Pagination directive and controls | SS-62 (page 1/2 controls) |

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
|  [Sort] [Filter] [Frog Report]   |    ACE editor                 |
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

| Screenshot | Component | What's Visible |
|------------|-----------|----------------|
| SS-61 `61_annotation_list_with_items.png` | `<annotation>` | Three annotation items showing timestamp, author, try number, score, message, and hamburger dropdown menu |
| SS-61b `61b_annotation_update_modal.png` | `annotation/_update.html` | Edit Annotation modal with textarea and Update/Cancel buttons |
| SS-62 `62_pagination_controls.png` | `dir-paginate` | Page 1/2 navigation controls (prev, 1, 2, next) |
| SS-64 `64_debug_matches_modal.png` | `<debug-matches>`, `DetailedExplainCtrl` | Debug Explain modal with collapsible JSON tree — idf, tf, field weights |
| SS-65 `65_expand_content_modal.png` | `<expand-content>` | Expanded View modal with full relevancy score explain text |
| SS-66 `66_query_diff_results.png` | `<query-diff-results>` | Side-by-side "Current Results" vs "Snapshot" with ranked documents and "No result" alerts |
| SS-68 `68_vega_visualization.png` | `[vega]`, `ngVega` | "Visualize your tries" tree/cluster graph (Playwright capture from live app) |
| SS-69 `69_404_page.png` | `404Ctrl` | "Not found :(" page with mistyped address / out-of-date link explanation |
| SS-70 `70_flash_messages.png` | `flash.html`, `search_flash.html` | Success (green) and error (red) alert banners with close buttons |
| SS-71 `71_delete_case_simple_modal.png` | `<delete-case>` | "Delete This Case" confirmation with warning text, Delete / Cancel buttons |
| SS-72 `72_unarchive_case_modal.png` | `UnarchiveCaseCtrl` | "Archived Cases" list with selection highlight, "Add Back" button |
| SS-73 `73_case_header_badges.png` | Case header badges | PUBLIC (blue) and ARCHIVED (orange) label badges, nightly repeat icon |
| SS-74 `74_diff_scores_header.png` | `<qscore-case>` repeated | Current score (green 0.66) alongside snapshot score (blue 0.52) in case header |
| SS-75 `75_query_error_state.png` | `queryStateClass` filter | Red "ERR" badge with orange error warning on pink row, between normal query rows |
| SS-76 `76_threshold_indicator.png` | Threshold color bar | Green bar (above threshold) and red bar (below threshold) with check/X icons |
| SS-77 `77_search_endpoint_typeahead.png` | `searchEndpoint_popup.html` | Typeahead dropdown showing Solr icon + highlighted endpoint URLs |
| SS-78 `78_media_embed.png` | `[quepid-embed]` | Audio player, image placeholder, and video player for media-type fields |
| SS-79 `79_debug_expand_buttons.png` | `<debug-matches>`, `<expand-content>` | "Debug" and "Expand" inline action buttons |
| SS-80 `80_drag_drop_reorder.png` | `ui.sortable` | Hamburger grip handles on query rows, mid-drag state with dashed border |

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

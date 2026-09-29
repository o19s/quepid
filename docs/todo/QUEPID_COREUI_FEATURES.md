# Quepid Core UI: Query Evaluation Page

> **Role:** Deep dive on `/case/...` only (~50% of rewrite difficulty). App-wide inventory: [`QUEPID_FEATURES.md`](./QUEPID_FEATURES.md). Schema / HTML routes / business rules: [`complete_application_specification.md`](../complete_application_specification.md). Frontend cleanup: [`todo.md`](./todo.md#frontend-cleanup-after-angular-removal).
>
> The query evaluation page is the heart of Quepid. It accounts for ~50% of the rewrite difficulty and is where search engineers spend 90% of their time. This document exhaustively enumerates its functionality, interaction model, and technical complexity.

---

## Table of Contents

1. [Page Layout](#1-page-layout)
2. [Query List Panel](#2-query-list-panel)
3. [Individual Query Row](#3-individual-query-row)
4. [Search Results Display](#4-search-results-display)
5. [Document Rating System](#5-document-rating-system)
6. [Scoring Engine](#6-scoring-engine)
7. [Scorer Runtime API](#7-scorer-runtime-api)
8. [Dev Settings Panel](#8-dev-settings-panel)
9. [Snapshot & Diff System](#9-snapshot--diff-system)
10. [Document Finder](#10-document-finder)
11. [Search Engine Abstraction](#11-search-engine-abstraction)
12. [Real-Time Score Propagation](#12-real-time-score-propagation)
13. [Case Header & Actions](#13-case-header--actions)
14. [Wizard & Onboarding](#14-wizard--onboarding)
15. [Keyboard & Interaction Patterns](#15-keyboard--interaction-patterns)
16. [State Management Architecture](#16-state-management-architecture)
17. [API Surface](#17-api-surface)
18. [Known Technical Debt](#18-known-technical-debt)
19. [Visual Design & Styling](#19-visual-design--styling)
20. [Error Handling](#20-error-handling)
21. [Book Sync Integration](#21-book-sync-integration)
22. [Doc ID Validation & Edge Cases](#22-doc-id-validation--edge-cases)
23. [Implementation reference (Angular & file inventory)](#23-implementation-reference-angular--file-inventory)

---

## 1. Page Layout

The query evaluation page is a **two-pane resizable layout** with a draggable slider between them.

```
┌────────────────────────────────────────────────────────────────────────┐
│ CASE HEADER (case name, try name, scorer, action bar)                 │
├──────────────────────────────────────────┬─┬───────────────────────────┤
│                                          │↔│                           │
│  QUERY LIST PANEL (left, flexible)       │ │  DEV SETTINGS (right)     │
│                                          │ │  (450px default)          │
│  ┌────────────────────────────────────┐  │ │  ┌───────────────────┐   │
│  │ Controls: Add, Filter, Sort, etc.  │  │ │  │ Tabbed Interface  │   │
│  ├────────────────────────────────────┤  │ │  │                   │   │
│  │ Query 1 (expandable)              │  │ │  │ - Query Sandbox   │   │
│  │   └── Search Results + Ratings    │  │ │  │ - Tuning Knobs    │   │
│  ├────────────────────────────────────┤  │ │  │ - Settings        │   │
│  │ Query 2 (collapsed)              │  │ │  │ - History         │   │
│  ├────────────────────────────────────┤  │ │  │ - Annotations     │   │
│  │ Query 3 (expanded)               │  │ │  │                   │   │
│  │   └── Search Results + Ratings    │  │ │  └───────────────────┘   │
│  ├────────────────────────────────────┤  │ │                           │
│  │ ... (paginated, 15 per page)      │  │ │  [Rerun My Searches!]     │
│  └────────────────────────────────────┘  │ │                           │
│  [Pagination Controls]                   │ │                           │
└──────────────────────────────────────────┴─┴───────────────────────────┘
```

### Pane Resizing
- **Slider** between panes supports mouse drag to resize
- Right pane (dev settings) defaults to **450px** (`eastPaneWidth` value constant)
- Slider can toggle the right pane open/closed
- Responds to window resize events via `$(window).on('resize', ...)`
- Managed by `paneSvc` — mixed jQuery + raw DOM API:
  - **Lazy initialization**: `refreshElements()` resolves 4 DOM elements via `getElementsByClassName`. If container width is 0 (DOM not yet laid out), retries via `$timeout(refreshElements, 200)` — polling until Angular's digest renders the view
  - **Drag handling**: `slider.onmousedown = grabSlider` → `document.onmousemove = dragElement` → `document.onmouseup = releaseSlider`. Uses raw DOM events, not jQuery for drag
  - **Toggle**: `$(document).on('toggleEast', toggleEast)` custom jQuery event. External code triggers pane toggle via `$(document).trigger('toggleEast')` rather than calling the service directly
  - **Show/hide**: `$(slider).show()` / `$(east).hide()` — jQuery for visibility, raw DOM for positioning (`east.style.left`, `main.style.width`)
  - Only public API is `this.refreshElements` — all other methods are private closure variables

### Visibility
- The "Tune Relevance" toggle in the header controls whether the dev settings pane is visible
- Persisted via `$rootScope.devSettings` (survives route changes)

---

## 2. Query List Panel

### Controls Bar

| Control | Behavior |
|---------|----------|
| **Add Query** button | Opens text input. Semicolons (`;`) delimit multiple queries — button label dynamically switches between "Add query" / "Add queries" based on presence of `;`. Paste handler (`quepidDom.textPaste` on the add-query directive) auto-converts newline-separated text to semicolons. Single query: `queriesSvc.persistQuery()` → search → score. Multiple: `queriesSvc.persistQueries()` → bulk POST to `api/bulk/cases/{caseNo}/queries` → `searchAll()` |
| **Show Only Rated** checkbox | Toggles `queriesSvc.showOnlyRated`; when on, each query's search uses a filter query (Solr: `{!terms f=id}doc1,doc2,...`, ES/OS: `terms` filter in `bool` query) to show only rated documents |
| **Collapse All** button | Collapses all expanded query rows via the query collection/document stores |
| **Sort dropdown** | Options: Default (manual), Name, Modified, Score, Errors |
| **Sort direction** | Arrow toggle for ascending/descending |
| **Query filter** | Text input that filters visible queries by query text (client-side filter) |
| **Query count** | Displays "N queries" with live count |
| **Frog report** indicator | Shows when unrated documents exist across queries |

### Sorting

| Sort Mode | Key | Behavior |
|-----------|-----|----------|
| Default | `default` → sort key `defaultCaseOrder` | Manual order (drag-and-drop position), enables reordering |
| Query | `query` → sort key `queryText` | Alphabetical by query text |
| Modified | `modified` → sort key `-modifiedAt` | Last-modified timestamp (descending, from `touchModifiedAt()`) |
| Score | `score` → sort key `-lastScore` | Numeric score from current scorer (descending) |
| Errors | `error` → sort keys `['-errorText', 'allRated']` | Groups queries by error state (multi-key sort) |

- **Drag-and-drop reordering** is only enabled when sort mode is "Default"
- Uses SortableJS via the Stimulus `queries-list` controller (replaced angular-ui-sortable / jQuery UI): `cancel: '.unsortable'`
- On `start`: captures `$scope.originalList = angular.copy(queriesList)` (accounts for reverse sort)
- On `stop`: calculates from/to indices accounting for **pagination offset** (`(currentPage - 1) * pageSize`)
- Sends `PUT /api/cases/{caseNo}/queries/{queryId}/position` with `{after: oldQueryId, reverse: boolean}`
- Feature-flagged: `configurationSvc.isQueryListSortable()` controls whether drag-and-drop is available at all

### Pagination
- **15 queries per page** (hardcoded)
- Standard previous/next/page-number controls
- Pagination interacts with drag-and-drop (position calculation includes page offset)

### Status Indicators
- **Bootstrapping**: "Booting up queries..." shown while `queriesSvc.isBootstrapping` is true
- **Updating**: "Updating X/Y queries..." progress indicator during `searchAll()`
- **Flash messages**: Success/error messages for operations (delete, move, etc.)

---

## 3. Individual Query Row

Each query row is a **collapsible panel** with a header and expandable content area.

### Header (Always Visible)

```
┌─────────────────────────────────────────────────────────────────┐
│ [Score Badge] [Diff Score Badges...] │ Loading... │ query text │
│                                      │ 10 Results │ [frog 3]   │
│                                      │            │     [▼]    │
└─────────────────────────────────────────────────────────────────┘
```

| Element | Detail |
|---------|--------|
| **Score badge** | Color-coded (HSL gradient, red→green) via `qscoreSvc.scoreToColor()`. Shows numeric score to 2 decimal places. Special values: `?` (pending), `--` (unrated), `zsr` (zero search results) |
| **Diff score badges** | One per enabled snapshot comparison (up to 5). Each has its own color and `allRated` indicator |
| **Loading indicator** | Spinner while search is executing |
| **Query text** | The search query (`h2.results-title`). Tooltip shows "Info Need: {informationNeed}" with 1-second delay, right placement |
| **Result count** | "N results" (switches to rated count when "Show Only Rated" is on) |
| **Unrated frog** | Grayscale frog emoji (`🐸`, `filter: grayscale(100%)`) with red notification bubble badge showing `countMissingRatings`. Title: "Hop to it! There are unrated results!" |
| **Querqy indicator** | Shows when `parsedQueryDetails.querqy?.rewrite !== undefined` (optional chaining) or `'querqy.infoLog' in parsedQueryDetails`. Custom PNG icon (`querqy-icon.png`, 24×24px) |
| **Collapse toggle** | Chevron up/down, managed by the query collection/document stores |

### State Classes
Query header gets CSS class `queryHeader_<state>` where state is one of:
- `error` — search failed
- `loading` — search in progress
- `noResults` — zero results returned
- `loaded` — results available

### Click Behavior
- Click header to toggle expand/collapse
- Double-click query text to edit (inline rename)

---

## 4. Search Results Display

When a query row is expanded, it shows search results in one of three view modes:

| Mode | Value | Trigger |
|------|-------|---------|
| **Finder** | 1 | DocFinder is active |
| **Results** | 2 | Default — shows search results |
| **Diffs** | 3 | Snapshot comparison enabled |

### Toolbar (Inside Expanded Query)

| Tool | Action |
|------|--------|
| **Score All** | Opens bulk rating popover for all visible documents |
| **Copy** | Copies query text to clipboard via `ngclipboard` directive |
| **Toggle Notes** | Shows/hides query notes section (slides in `notes-box` div) |
| **Explain** | Opens query-explain modal (Stimulus `query-explain` + `dynamic_modal`; size `lg`) with **3 tabs**: (1) **Params** — raw query parameters sorted alphabetically, displayed via vanilla `json_explorer`; (2) **Parsing** — `parsedQueryDetails` from searcher, also via `json_explorer` (uncollapsed); (3) **Query Template** — for ES template calls, renders template output in a `<pre>`. Each tab has a clipboard copy button. Only Solr returns query parameters; ES shows "not returned" message |
| **Missing Documents** (targeted search) | Opens DocFinder modal. Button gets `active` CSS class when Finder view is shown |
| **Query Options** | Per-query option key-value pairs via `<query-options>` component. Opens modal with ACE editor (JSON mode). Values accessible as `qOption('key')` in scorer code or `#$qOption.key##` in Query Sandbox template syntax. Saving triggers full rescore via `queriesSvc.updateScores()` |
| **Move Query** | Opens `<move-query>` modal showing all user's cases (excluding current). Case list fetched from `caseSvc.allCases`, filtered to exclude source case. Listens for 6 events to keep list current. Selection triggers `queriesSvc.moveQuery()` → `PUT /api/cases/{caseNo}/queries/{queryId}` with `{other_case_id: targetCaseNo}`. Query removed from local map on success |
| **Delete Query** | Delete with confirmation dialog |

### Query Notes Section
When toggled visible, shows a `form-horizontal` with:
- **Information Need**: Text input (`ng-model="informationNeed"`) — describes what the query should find. Also shown as a tooltip on the query text in the header (`tooltip-popup-delay="1000"`, `tooltip-placement="right"`)
- **Query Notes**: Textarea (`ng-model="queryNotes"`) — freeform notes about the query
- **Save button**: Persists via `query.saveNotes(queryNotes, informationNeed)` → `PUT /api/cases/{caseNo}/queries/{queryId}/notes`
- **Lazy loading**: Notes are fetched from the server only when the notes section is first opened (`$watch` on `displayed.notes`), not during initial query load

### Individual Search Result

Each result is a **3-column layout**:

```
┌──────┬─────────────────────────────────────────┬─────────────┐
│ [4]  │ Title (clickable → detailed doc modal)   │ ▓▓▓▓░░░░░░ │
│      │ Field1: snippet text...                  │ (explain    │
│      │ Field2: snippet text...                  │  stacked    │
│      │ [thumbnail] [media embed]                │  chart)     │
│      │ [translation] Rank: #1                   │             │
└──────┴─────────────────────────────────────────┴─────────────┘
  2col          8col                                  2col
```

| Column | Content |
|--------|---------|
| **Left (2 col)** | Rating button — large number badge with background color from rating scale. Click opens rating popover |
| **Center (8 col)** | Document content: title, field snippets, thumbnail/image, media embeds (audio/video), translations, rank number |
| **Right (2 col)** | Stacked chart explain visualization — only shown when `explainView='full'` |

### Field Display
- Fields are extracted based on the **Field Spec** (e.g., `id:id title:name url:url`)
- Field spec parsed by `fieldSpecSvc.createFieldSpec()` from splainer-search
- Each field snippet is rendered with three-way type detection:
  1. **Object/Array values** (`isObjectOrArray()`): Rendered with Stimulus `json-explorer` (`utils/json_explorer.js` — expandable JSON tree, starts uncollapsed)
  2. **URL values** (`isUrl()`): Rendered as clickable `<a>` link opening in new tab
  3. **Text values** (default): Rendered via `ng-bind-html` (HTML-sanitized)
- **Title**: Clickable — opens Detailed Document modal. Shows `{{ doc.title }}`
- **Translations**: Rendered with `ng-bind-html` plus a Google Translate link (`https://translate.google.com/?sl=auto&tl=en&text=...`)
- **Unabridged fields**: Full content rendered via `ng-bind-html`
- Doc ID field is validated by `DocListFactory` with two-tier error detection (see Section 22)

### Image/Thumbnail Prefix Wrapping
The `SearchResultCtrl` handles image URLs with optional prefix:
```javascript
formatImageUrl(imgUrl, options) {
  if (options?.prefix) imgUrl = options.prefix + imgUrl
  return imgUrl
}
```
This allows search engines that return relative image paths to be prefixed with a base URL configured per field spec.

### Snippet Extraction
Each result calls `doc.subSnippets('<strong>', '</strong>')` to extract highlighted snippets from search engine responses, wrapping matches in `<strong>` tags.

### Column Layout Adaptation
`summaryColumnStyle()` returns different CSS classes based on document media:
- `col-summary-thumb` — when `doc.hasThumb()` (thumbnail present)
- `col-summary-image` — when `doc.hasImage()` (full image present)
- empty string — text-only layout

### Expand Content Component
The `<expand-content>` component allows expanding any field value into a **full-screen modal** (`windowClass: 'full-screen-modal'`). Content and title are passed through `$sce.trustAsHtml()` for safe HTML rendering.

### Media Embedding (`quepidEmbed` directive)
Attribute directive (`restrict: 'A'`) with isolated scope `{src: '='}`. Uses `views/embed.html` template. Detects file extension via regex and sets one of `audioSrc`, `imageSrc`, or `videoSrc`:
- `.mp3`, `.wav`, `.ogg` → `<audio>` player
- `.jpg`, `.jpeg`, `.gif`, `.png` → `<img>` element
- `.mp4`, `.webm` → `<video>` player

### Pagination
- "Peek at the next page" link loads additional results via `query.paginate()`
- Results append to existing list (not replace)
- Separate pagination for rated docs (`query.ratedPaginate()`)

### Explain Visualization (Stacked Chart)
- **`stackedChart` directive** renders scoring breakdown per document
- Trigger: "Matches" text with info icon, opens popover on click (`popover-trigger="outsideClick"`, `popover-placement="left"`)
- Popover title: "Relevancy Score: {doc.score()}"
- Shows "No Match" when `hots.length === 0`
- **3 or fewer matches**: Shows all as `<uib-progressbar>` bars with description labels, clickable to open detailed explain
- **More than 3 matches**: Shows first 3, remainder in `<uib-collapse>` behind "Show N More" / "Show Less" toggle link
- Match colors cycle: red, orange, green, blue (via `stackChartColor` filter)
- Match height proportional to percentage (via `stackChartHeight` filter)
- Remaining percentage calculated by `stackChartLeftover` filter (100% - sum of matches)
- Click on any match opens **Detailed Explain modal** with vanilla `json_explorer` showing `doc.explain().rawStr()`
- Controller: `HotMatchesCtrl` — watches `doc.hotMatchesOutOf(maxDocScore)` for changes

### Detailed Document Modal
- Opens when clicking document title (vanilla modal via `window.quepidDom.modal.open`)
- Structure/text sub-fields; **View All Fields** toggles a formatted JSON `<pre>` of the full raw doc (not ACE)
- Object/array field values use Stimulus `json-explorer` / `utils/json_explorer.js`
- "View Document" button opens original document URL (with basic auth injection if configured, proxy wrapping if enabled)
- "Show All Fields" / "Hide All Fields" toggle

### Detailed Explain Modal
- Debug view of raw scoring explain JSON
- Full JSON tree explorer
- Shows document title and ID in header

---

## 5. Document Rating System

### Rating Scale
- Defined per scorer as an array of integer values (e.g., `[0, 1, 2, 3]` or `[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]`)
- Colors generated via HSL gradient: `hsl((value - min) * 120 / range, 100%, 50%)`
  - Min value → red (hue 0)
  - Max value → green (hue 120)
- Optional custom labels per value (e.g., `{0: "Irrelevant", 1: "Marginal", 2: "Good", 3: "Perfect"}`)
- `showScaleLabels` flag controls whether labels are displayed

### Rating Interaction
1. Click the rating badge on a document
2. **Popover** appears with rating scale buttons (each color-coded)
3. Click a value → `doc.rate(newRating)` → `PUT /api/cases/{caseNo}/queries/{queryId}/ratings`
4. "Reset" button → `doc.resetRating()` → `DELETE /api/cases/{caseNo}/queries/{queryId}/ratings`
5. After rating, `query.touchModifiedAt()` updates the query's modified timestamp
6. `rating-changed` event broadcasts to trigger score recalculation

### Bulk Rating ("Score All")
1. Click "Score All" in query toolbar
2. Popover appears with same scale
3. Click a value → all visible documents rated at once
4. Respects "Show Only Rated" filter — only rates currently visible docs
5. Uses `doc.rateBulk(ids, rating)` → `PUT /api/cases/{caseNo}/queries/{queryId}/bulk/ratings`
6. Bulk unrate: `doc.resetBulkRatings(ids)` → `POST /api/cases/{caseNo}/queries/{queryId}/bulk/ratings/delete`

### Ratings Storage (`ratingsStoreSvc`)
- Each query gets a `RatingsStore` instance keyed by `(caseNo, queryId)`
- Internal dictionary maps `docId → rating` (integer)
- Supports URL-containing and dot-containing doc IDs (with escaping)
- `bestDocs()` returns all rated docs sorted by rating value (descending) — used by scorer
- `version()` counter increments on every change (for dirty-checking)
- `createRateableDoc(normalDoc)` injects `rate()`, `rateBulk()`, `resetRating()`, `hasRating()`, `getRating()` methods onto document objects

---

## 6. Scoring Engine

### Dual Execution Model

Scorers run in **two environments** with known behavioral drift:

| Environment | Engine | Trigger | Location |
|-------------|--------|---------|----------|
| **Client-side** | Browser `eval()` inside `$timeout` | Rating change, search complete | `ScorerFactory.js` → `runCode()` |
| **Server-side** | MiniRacer V8 sandbox | Background evaluation, nightly runs | `lib/scorer_logic.js` |

### Key Differences Between Client and Server

| Feature | Client (`ScorerFactory.js`) | Server (`scorer_logic.js`) |
|---------|---------------------------|--------------------------|
| `docAt(posn)` | Returns `docs[posn].doc` (unwrapped) | Returns `docs[posn]` (raw) |
| `docRating(posn)` | Calls `docs[posn].getRating()` method | Accesses `docs[posn]["rating"]` property |
| `hasDocRating(posn)` | Uses `docs[posn].hasRating()` method | Uses `hasRating(doc)` → `doc.hasOwnProperty('rating')` |
| `avgRating100()` | Available | **Not available** |
| `editDistanceFromBest()` | Available | **Not available** |
| `pass()` / `fail()` | Available | **Not available** |
| `assert()` / `assertOrScore()` | Available | **Not available** |
| `setScore()` | Resolves a `$q` deferred | Sets a `theScore` variable |
| Loop prohibition | Checked via `hasLoop()` promise | Not enforced on server |
| Score return | Via Angular `$q.defer()` promise resolution | Via `getScore()` after `eval()` |

### Score Capping
After scorer execution, the client-side score is clamped:
1. If `null` and no docs → `'zsr'` (zero search results)
2. If `null` and no bestDocs → `'--'` (unrated)
3. If negative and equals maxScore → `null`
4. If negative → `0`
5. If exceeds maxScore → `maxScore`
6. If maxScore is 0 → `0`

### Loop Prohibition
- Regex check: `/(while|for)\s*\(/g`
- If matched, scorer code is rejected with error message: "Loops are currently not supported, use `eachDoc` to loop over documents."
- Users must use `eachDoc()`, `eachRatedDoc()`, `eachDocWithRating()` etc. instead

### Depth of Rating Tracking
After scorer code executes, the system appends code to detect and extract the `k` parameter:
```javascript
if (typeof k !== 'undefined') {
  recordDepthOfRanking(k);
}
```
This records how many documents the scorer inspected (stored on `query.depthOfRating`).

### Execution Timeout (Prototype, Not Active)
There is a `checkCodeExecutionTime()` method using Web Workers with a 1-second timeout, but it's commented out (`// var timePromise = self.checkCodeExecutionTime()`). The code is preserved but not functional.

---

## 7. Scorer Runtime API

These functions are available inside custom scorer code. The default `count` parameter is **10** (`DEFAULT_NUM_DOCS`).

### Document Access

| Function | Signature | Description |
|----------|-----------|-------------|
| `eachDoc` | `eachDoc(fn, count?)` | Iterates top `count` result documents. Callback receives `(doc, index)`. The primary iteration method — loops are banned |
| `eachRatedDoc` | `eachRatedDoc(fn, count?)` | Iterates top `count` rated documents (from `query.ratedDocs`) |
| `eachDocWithRating` | `eachDocWithRating(fn)` | Iterates ALL documents with ANY rating (from `bestDocs`), not limited to top 10. Callback receives `(doc)` |
| `eachDocWithRatingEqualTo` | `eachDocWithRatingEqualTo(score, fn)` | Iterates all docs with rating exactly equal to `score` (client-only) |
| `docAt` | `docAt(posn)` | Returns document object at position `posn` (0-indexed). Returns `{}` if out of bounds |
| `docExistsAt` | `docExistsAt(posn)` | Returns boolean — does a document exist at position `posn`? |

### Rating Access

| Function | Signature | Description |
|----------|-----------|-------------|
| `hasDocRating` | `hasDocRating(posn)` | Returns boolean — does the document at `posn` have a rating? |
| `docRating` | `docRating(posn)` | Returns the integer rating of the document at `posn`, or `undefined` |
| `topRatings` | `topRatings(count)` | Returns array of top `count` ratings from `bestDocs` (globally rated, not just current results) |
| `avgRating` | `avgRating(count?)` | Average rating of top `count` documents that have ratings. Returns `null` if none rated |
| `avgRating100` | `avgRating100(count?)` | `avgRating` normalized to 0-100 scale based on scorer's max scale value (client-only) |

### Result Metadata

| Function | Signature | Description |
|----------|-----------|-------------|
| `numFound` | `numFound()` | Total number of matching documents (from search engine's total count) |
| `numReturned` | `numReturned()` | Number of documents actually returned in this result page |

### Scoring Control

| Function | Signature | Description |
|----------|-----------|-------------|
| `setScore` | `setScore(score)` | Explicitly set the final score value. Resolves the scorer promise (client) or sets `theScore` (server) |
| `pass` | `pass()` | Shortcut: `setScore(100)` (client-only) |
| `fail` | `fail()` | Shortcut: rejects with `0` (client-only) |
| `assert` | `assert(condition)` | If condition is false, calls `fail()` (client-only) |
| `assertOrScore` | `assertOrScore(condition, score)` | If condition is false, calls `setScore(score)` (client-only) |

### Utility Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `editDistanceFromBest` | `editDistanceFromBest(count?)` | Levenshtein edit distance between current ranking and ideal ranking (from bestDocs). Returns integer (client-only) |
| `qOption` | `qOption(key)` | Access per-query option value by key. Returns `null` if not set |

### Built-in Scorers (9 total)
These use the runtime API above:
1. **nDCG@10** — Normalized Discounted Cumulative Gain
2. **DCG@10** — Discounted Cumulative Gain
3. **CG@10** — Cumulative Gain
4. **P@10** — Precision at 10
5. **AP@10** — Average Precision at 10
6. **RR@10** — Reciprocal Rank at 10
7. **ERR@10** — Expected Reciprocal Rank at 10
8. **nDCG_CUT@10** — nDCG with explicit cutoff
9. **Legacy v1** — Original Quepid scoring algorithm

---

## 8. Dev Settings Panel

The right pane contains a **5-tab interface** for configuring the current search try.

### Tab 1: Query Sandbox

Engine-specific editor for query parameters:

| Engine | Editor | Format |
|--------|--------|--------|
| **Solr** | Textarea | Key-value query parameters (e.g., `q=#$query##&defType=edismax&qf=title^2 body`) |
| **ES/OpenSearch** | ACE JSON editor | JSON DSL query body |
| **Vectara** | ACE JSON editor | JSON query body |
| **Algolia** | ACE JSON editor | JSON search parameters |
| **SearchAPI** | ACE JSON editor | JSON with mapper code |
| **Static** | Info message | No editable params (snapshot-backed) |

**ACE Editor Configuration**: All JSON editors use ACE with Chrome theme, JSON mode. SearchAPI editor has conditional gutter display. Each engine has its own editor element ID (`es-query-params-editor`, `os-query-params-editor`, etc.)

**Validation**:
- JSON syntax validation for ES/OS/Vectara/Algolia (try/catch on `JSON.parse`)
- **Solr typo detection**: Regex-based dictionary checking for 7 common misspellings:
  - `deftype` → `defType`, `echoparams` → `echoParams`, `explainother` → `explainOther`
  - `logparamslist` → `logParamsList`, `omitheader` → `omitHeader`
  - `segmentterminateearly` → `segmentTerminateEarly`, `timeallowed` → `timeAllowed`
  - Shows warning: "Your query params contain `<key>`, you probably meant `<correct>`."
- **ES template call detection**: `esUrlSvc.isTemplateCall()` detects template syntax and shows warning about limitations (can't use `explainOther`)
- Pretty-printing: JSON auto-formatted with 2-space indentation on save

### Tab 2: Tuning Knobs (Curator Variables)

Curator variables use `##varName##` syntax in query parameters. The `varExtractorSvc` uses regex `/##[^#]*?##/g` to extract three tiers of variables:

**Three-Tier Variable System**:
1. **Magic variables** (stripped during parsing, not shown as knobs):
   - `#$query##` — replaced with user's search query text
   - `#$keyword1##`, `#$keyword2##` — positional keyword extraction (legacy feature that "never really got traction")
2. **Curator variables**: Any `##varName##` not in the magic set. Each gets a **numeric input** (min 0, max 10,000,000,000)
3. **Derived state**: Each variable tracks `inQueryParams` boolean — whether it's actually referenced in the current query params string. Warning shown if a variable exists but isn't referenced

- Empty state: when no variables exist, shows help text explaining `##variable##` syntax
- Variables sorted alphabetically via `sortVars()`
- When curator variables change, `toggleTab()` creates a temporary `TryFactory` copy, calls `updateVars()` to re-extract variables, validates the search URL, then commits back to `settings.selectedTry`
- Changes create a new "try" (version) to preserve history

### Tab 3: Settings

All subsections have **collapsible headers** (click to toggle visibility):

| Setting | Control | Detail |
|---------|---------|--------|
| **Search Endpoint** | Typeahead selector (`uib-typeahead`) with custom popup template | Picks from configured endpoints; shows name, URL, archived status. "OR" option to select existing endpoints. Archived endpoint warning. Link to edit endpoint |
| **Displayed Fields** | Text input | Field spec string (e.g., `id:id title:name thumb:poster_path`). ES/OS template warning shown when applicable |
| **Number of Results** | Number input (max 100) | Results per page from search engine |
| **Nightly Evaluation** | Checkbox | Enable/disable nightly background evaluation. Adjacent "Run Evaluation" button queues immediate background job. Button text changes to "Running..." with disabled state during execution |
| **Escape Queries** | Checkbox | Whether to URL-encode query text before sending to engine |

**TLS Protocol Warning**: If Quepid is served via HTTPS but the search engine URL is HTTP (or vice versa), a warning appears with a link to switch protocols. The link preserves all current UI state as URL parameters.

**Search Endpoint Switching**: When selecting a new endpoint, all settings are remapped:
- `endpointUrl` → `searchUrl`
- `searchEngine`, `apiMethod`, `customHeaders`, `basicAuthCredential`, `queryParams`, `mapperCode`
- Creates a new try to preserve history

### Tab 4: History

- Lists all tries (search configuration versions) for the current case
- Each try shows:
  - Formatted name (or auto-generated "Try N")
  - First 200 characters of query params
  - Endpoint name
- **Color-coded by search URL**: 3-color cycling with hardcoded background colors (`#666`, `#64647D`, `#667A66`). Bucket assigned by `urlBucket(searchUrl, 3)` — deterministic based on sorted unique URL index
- Each entry shows: formatted name, first 200 characters of query params, endpoint name
- Click navigates to that try (changes active search configuration)
- "..." button (with `$event.stopPropagation()` to prevent navigation) opens **Try Details Modal**:
  - Try name (editable inline with rename form)
  - Full query arguments in `<pre><code>` block
  - Search endpoint with engine icon (`solr-icon.png` etc., 16px wide) and browse link
  - Displayed fields spec
  - Variables section: `#$query##` (always shown) plus all curator variables with values
  - Duplicate button (closes modal, returns action for parent to handle via `settingsSvc.duplicateTry()`)
  - Delete button (disabled for active try, disabled if only one try remains)
  - Dismiss button

### Tab 5: Annotations

- Case-level text annotations (notes about results/performance)
- Create, edit, delete via `annotationsSvc`
- Each annotation is a structured object: `{id, caseId, message, score, source, user, createdAt, updatedAt}`
- The `score` field is a nested reference to the associated case score at the time of annotation
- `PUT /api/cases/{caseId}/annotations/{id}` for persistence

### Custom Headers Component

Embedded in the Settings tab (and the Wizard) via `<custom-headers>` directive:
- **Dropdown selector**: "None", "API Key", "Custom"
- **ACE editor** (JSON mode, Chrome theme) for editing header JSON
- When type changes, auto-populates template:
  - None → clears to empty
  - API Key → `{"Authorization": "ApiKey XXX"}`
  - Custom → `{"KEY": "VALUE"}`
- Editor is read-only when type is "None"

### Action Button: "Rerun My Searches!"

At the bottom of the dev settings panel (visible only on Developer, Settings, and Curator tabs):
- Saves current settings as a new try (`settingsSvc.save()`)
- Triggers `queriesSvc.searchAll()` to re-execute all queries
- If TLS mismatch detected, shows protocol switch link instead
- Settings changes automatically broadcast `settings-changed` event

---

## 9. Snapshot & Diff System

### Taking Snapshots
1. User clicks "Snapshot" in the action bar
2. **Snapshot Modal** opens:
   - Snapshot name input (required)
   - "Include document fields" checkbox — shown only when `supportLookupById` is true. For engines without ID-based lookup (Algolia, Vectara), field recording is **forced on** automatically with an explanatory message
   - Shows current field spec
   - In-progress state: "Snapshot Being Created (this can take a minute or so)"
   - Error display for failures
3. `querySnapshotSvc.addSnapshot(name, recordDocumentFields, queries)` → `POST /api/cases/{caseNo}/snapshots`
4. Snapshot payload per query includes:
   - **Query metadata**: `score`, `all_rated`, `number_of_results`
   - **All docs**: Each with `id`, `explain` (raw string), `rated_only: false`
   - **Rated docs**: Same format with `rated_only: true`
   - **Optional field values**: When `recordDocumentFields=true`, extracts all field values from `doc.subsList` into `docPayload.fields`
5. **Field spec transformation**: `mapFieldSpecToSolrFormat()` normalizes ES-style field specs (removes leading underscore from `_id`, `_source.name` → `name`)

### Snapshot Lookup Fallback
For engines without ID-based lookup, snapshots with stored fields create a **fake Solr endpoint**:
- URL: `/api/cases/{caseNo}/snapshots/{snapshotId}/search`
- This endpoint returns snapshot docs from stored fields, not from a live search engine
- Allows snapshot viewing and diff comparison even for engines that can't look up individual docs

### Comparing Snapshots (Diff View)
1. User clicks "Diff" in action bar
2. Selects up to **5 snapshots** to compare against current results
3. `diffStateStore.enable(snapshotIds)` activates comparison mode
4. Each query switches from Results view to **Diff view** (mode 3)
5. `diffResultsSvc.createQueryDiff(query)` creates diff objects

### Diff Display Layout

```
┌──────────────────┬──────────────────┬──────────────────┐
│ Current Results   │ Snapshot A        │ Snapshot B        │
├──────────────────┼──────────────────┼──────────────────┤
│ [doc1] Score: 0.8│ [doc1] Score: 0.7│ [doc3] Score: 0.5│
│ [doc2] Score: 0.6│ [doc2] Score: 0.6│ [doc1] Score: 0.4│
│ [doc3] Score: 0.4│ [missing]        │ [doc2] Score: 0.3│
│ ...              │ ...              │ ...              │
└──────────────────┴──────────────────┴──────────────────┘
```

### Difference Detection Algorithm
For each position, compares current result with snapshot result:
- `same` — same doc ID at same position
- `missing-current` — doc exists in snapshot but not in current results
- `missing-snapshot` — doc exists in current but not in snapshot
- `different` — different doc IDs at same position

CSS classes: `different`, `missing`, `new`

### Diff Scoring
- Each snapshot's results are scored using the **same scorer** as the current query
- Diff scores shown as additional badges in query headers
- Per-searcher max scores tracked for color normalization
- Case-level diff averaging: sums valid diff scores across all queries, computes average

### Snapshot Searcher Interface
`snapshotSearcherSvc` wraps snapshot data in the same interface as live searchers:
- `search()` — resolves immediately (data pre-loaded)
- `pager()` — returns null (no pagination)
- `explainOther()` — rejects (not supported for snapshots)
- `docs` — pre-loaded document array with explain data attached
- `numFound` — document count from snapshot
- `type: 'snapshot'`

This allows the diff system to treat snapshots identically to live search results throughout the scoring and display pipeline.

---

## 10. Document Finder

The Doc Finder is an alternate view (mode 1) within each query that lets users **search for specific documents** to rate, even if they don't appear in the main search results.

### Modal Layout
The Doc Finder opens as a **modal** ("Find and Rate Missing Documents") with:
- ACE editor for query input (Lucene mode, Chrome theme, single line, no gutter)
- Help text explains per-engine syntax: "Solr: Use simple Lucene query syntax..." / "Elasticsearch/OpenSearch: Keywords replace #$query##..."
- **Enter key warning**: Detects enter keypress and shows red alert "Please click the 'Search' button instead of enter key..." (prevents accidental form submission in ACE editor)
- "Search" button and "Reset to All Rated Docs" button (disabled when already showing rated)
- "Score All" bulk rating widget with warning: "Changing ratings will affect the query score"
- Search result list using same `<search-result>` components as main view
- "Peek at the next page of results" pagination link
- Result count with pluralized text ("one matching document" / "N matching documents")

### Modes
1. **Default (Rated Docs)**: Shows all documents with existing ratings for this query
   - Fetches rated doc IDs from `query.ratings`, filters out empty strings (bug workaround: "empty ID's that sneak in")
   - For ES/OS: Uses `filterToRatings()` with `terms` filter in `bool` query
   - For Solr: Uses `explainOther()` with ratings filter, or `{!terms f=id}` syntax
   - For Vectara: SQL-like filter: `doc.id = 'doc1' OR doc.id = 'doc2'`
   - Template calls (ES) can't use `explainOther`, falls back to regular search
   - Shows "There are N ratings for your original query 'X'"
2. **Custom Search**: User enters arbitrary search query to find documents
   - Creates new searcher via `queriesSvc.createSearcherFromSettings()`
   - Calls `searcher.explainOther(queryText, fieldSpec)` for Solr
   - Normalizes results based on engine type via `normalDocsSvc.normalizeDocExplains()`
   - Creates rateable docs via `ratingsStore.createRateableDoc()`
   - Shows "Your query 'X' returned N matching documents"
   - Separate pagination functions for each mode (appends, not replaces)

---

## 11. Search Engine Abstraction

The search execution pipeline abstracts 7 search engines behind a unified interface via splainer-search.

### Searcher Creation Flow

```
Settings (TryFactory)
    ↓
queriesSvc.createSearcherFromSettings()
    ↓
searchSvc.createSearcher(fieldSpec, searchUrl, args, queryText, options, searchEngine)
    ↓
Engine-specific Searcher (Solr, ES, OS, Vectara, Algolia, SearchAPI, Static)
    ↓
Returns: { docs[], numFound, linkUrl, inError, search(), pager(), explainOther() }
```

### Searcher Options

| Option | Purpose |
|--------|---------|
| `customHeaders` | Authentication headers (API keys, tokens) |
| `escapeQuery` | URL-encode query text |
| `numberOfRows` | Results per page |
| `basicAuthCredential` | HTTP Basic Auth string |
| `apiMethod` | HTTP method (GET, POST, JSONP) |
| `proxyUrl` | Quepid proxy endpoint for CORS bypass |
| `docsMapper` | Custom JS function to extract docs from response (SearchAPI) |
| `numberOfResultsMapper` | Custom JS function to extract total count (SearchAPI) |
| `qOption` | Per-query option values |

### Engine-Specific Behaviors

| Engine | Query Format | Explain Support | Doc Lookup | Special |
|--------|-------------|-----------------|------------|---------|
| **Solr** | URL query params | Full (human-readable text) | Yes (by ID) | JSONP support, `echoParams=all` |
| **Elasticsearch** | JSON POST body | Full (nested JSON) | Yes (by ID) | Template calls supported |
| **OpenSearch** | JSON POST body | Full (nested JSON) | Yes (by ID) | Same as ES with OS-specific parsing |
| **Vectara** | JSON POST body | Limited | No | Requires custom headers |
| **Algolia** | JSON POST body | Limited | No | Requires API key header |
| **SearchAPI** | Custom (mapper code) | None | No | User-provided JS mappers via `new Function()` |
| **Static** | N/A (snapshot-backed) | None | No | Uses fake Solr endpoint serving snapshot data |

### SearchAPI Mapper System

For custom search APIs, users provide JavaScript mapper code:
1. **Validation**: Code evaluated via `new Function()` constructor in non-strict mode
2. **Required functions**:
   - `numberOfResultsMapper(response)` — extracts total result count from response
   - `docsMapper(response)` — extracts document array from response
3. **Test query substitution**: `#$query##` placeholder replaced with test query text
4. **Error handling**: Validates both functions exist, reports specific missing function errors

### Explain Parsing
- **Solr**: `solrExplainExtractorSvc` parses human-readable explain text into structured match components (score breakdowns, field contributions)
- **ES/OS**: `esExplainExtractorSvc` parses nested JSON explain output into match components
- Other engines: `normalDocsSvc.createNormalDoc()` without explain data

### Document Normalization
All search engine responses are normalized to a common format via `normalDocsSvc`:
- `id` — extracted from field spec ID field
- `title` — extracted from field spec title field
- Additional fields — based on field spec
- `explain()` — method returning parsed explain details
- `score()` — document relevance score

### Search Execution Pattern

```javascript
// In queriesSvc — Two-Phase Architecture
searchAll():
  // Phase 1: Build lazy search functions (NOT promises)
  promises = queries.map(q => () => q.search().then(() => scorePromises.push(q.score())))

  // Execute via pAll() with optional rate limiting
  pAll(promises, requestsPerMinute)

  // Phase 2: After all searches, wait for per-query scores
  $q.all(scorePromises).then(() => {
    scoreAll()    // aggregate case-level score
    syncToBook()  // sync query-doc pairs to book
  })

// query.search() internals:
query.search()
  → hasBeenScored = false
  → createSearcherFromSettings(settings, query)       // primary searcher
  → createSearcherFromSettings(settings, query, {filterToRated:true})  // rated searcher (constructed but NOT searched yet)
  → searcher.search()                                  // HTTP call to search engine
  → query.setDocs(searcher.docs, searcher.numFound)    // DocListFactory with ratingsStore
  → resolve()

// query.setDocs() internals:
setDocs(newDocs, numFound)
  → docs.length = 0           // truncate in-place (preserves Angular bindings)
  → setDirty()                // version++, svcVersion++ — invalidates score cache
  → DocListFactory(newDocs, fieldSpec, ratingsStore)  // ratingsStore is 3rd arg
  → docList.list()            // returns docs with ratings attached via createRateableDoc()
  → docList.hasErrors()       // checks for missing/duplicate ID errors
```

### `normalizeDocExplains()` — Three-Path Pipeline

```javascript
normalizeDocExplains(query, searcher, fieldSpec):
  // Path 1: ES/OpenSearch
  if (type === 'es' || type === 'os')
    → esExplainExtractorSvc.docsWithExplainOther(docs, fieldSpec)

  // Path 2: Solr
  else if (type === 'solr')
    → solrExplainExtractorSvc.docsWithExplainOther(docs, fieldSpec, searcher.othersExplained)

  // Path 3: Everything else (searchapi, vectara, algolia, static)
  else
    → docs.map(doc → normalDocsSvc.createNormalDoc(fieldSpec, doc))  // no explain data

  // All paths: wrap each doc with rating methods
  → normed.forEach(doc → query.ratingsStore.createRateableDoc(doc))
```

### Rate-Limiting & Concurrency
`queriesSvc.pAll(queue, requestsPerMinute)` is an `async` function managing concurrent search execution. The queue contains **functions** (not promises) — lazy evaluation ensures searches don't all start immediately.

**No rate limit mode** (10 concurrent workers):
```javascript
// 10 async workers share a shared index variable (safe — JS single-threaded)
const worker = async () => {
  while (index < queue.length) {
    const curIndex = index++    // atomic grab
    await queue[curIndex]()     // execute and wait
    results[curIndex] = promise // preserve original order
  }
}
workers = Array(10).fill().map(() => worker())
await Promise.all(workers)
```

**Rate-limited mode** (sequential with delays):
```javascript
minDelayMs = 60000 / requestsPerMinute  // e.g., 30 RPM → 2000ms delay
for each item:
  await delay(minDelayMs)  // between END of one and START of next
  await queue[i]()
```
Actual throughput is lower than the limit if requests take longer than `minDelayMs` (delay is inter-request, not start-to-start).

- `requestsPerMinute` is configurable per try via `settings.selectedTry.requestsPerMinute`
- Progress tracking during `searchAll()`: `batchPosition` / `batchSize` shown in UI status bar
- Warning text displayed: "This process runs in the background but please avoid doing a hard refresh"

---

## 12. Real-Time Score Propagation

Rating changes trigger a cascade of score updates through the system.

### Event Flow

```
User clicks rating
    ↓
doc.rate(newRating)  →  PUT /api/cases/{caseNo}/queries/{queryId}/ratings
    ↓
query.touchModifiedAt()
    ↓
$rootScope.$broadcast('rating-changed')
    ↓  (debounced 100ms)
├── query.diffs.fetch() → refresh diff scoring for this query
├── query.score() → re-run scorer for this query
│       ↓
│   queriesSvc.scoreAll() → recalculate aggregate case score
│       ↓
│   caseSvc.trackLastScore() → PUT /api/cases/{caseId}/scores
│       ↓
│   $rootScope.$broadcast('updatedCaseScore')
│       ↓
│   UI updates: case score badge, query score badge, diff score badges
└── case-level diff score averaging (iterates all queries)
```

### `scoreAll()` Aggregation Algorithm

```javascript
scoreAll(scorables):
  avg = null     // null + number coerces to number in JS (acts as 0)
  tot = 0
  allRated = true

  for each scorable:
    score()  // uses version cache — if version unchanged, returns cached score immediately
    .then(scoreInfo =>
      // Skip 1: null scores → completely excluded (no contribution, no queryScores entry)
      // Skip 2: 'zsr' (zero results) → excluded from avg but recorded in queryScores
      // Skip 3: '--' (unrated) → excluded from avg but recorded in queryScores
      // Include: numeric scores → avg += score; tot++
    )

  // Final:
  if (tot > 0) avg = avg / tot     // simple arithmetic mean
  else avg = '--'                   // all queries were zsr/-- → case score is '--'

  emit('scoring-complete')
```

**Version cache deduplication in `score()`**: Each query tracks `lastScoreVersion` (initialized to `-5` sentinel). `version()` returns `localVersion + ratingsStore.version()`. If unchanged since last scoring, `score()` short-circuits and returns the cached `currentScore` via an immediately-resolved deferred — no scorer re-execution.

### Score Color Mapping (`qscoreSvc`)
- Converts numeric score to HSL color
- Special handling:
  - `'?'` (pending) → specific gray
  - `'--'` (unrated) → gray background
  - `'zsr'` (zero results) → gray
- Normal scores: linear HSL interpolation from red (0%) to green (100%)

### Score Deduplication (Server-Side)
The `CaseScoreManager` uses 3-tier dedup logic when persisting scores:
1. Score within last 5 minutes → update existing record
2. Same score exists for same day → ignore (don't duplicate)
3. Otherwise → create new score record

---

## 13. Case Header & Actions

### Header Bar

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [Case Score] Case Name (double-click to edit) │ Try Name │ Scorer Name │
│             [NIGHTLY badge] [PUBLIC badge] [ARCHIVED badge]             │
│                                                                         │
│ [Select Scorer] [Judgements] [Snapshot] [Diff] [Import Ratings]        │
│ [Share Case] [Clone Case] [Delete Case] [Export Case]                  │
│ [Tune Relevance ←→]                                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Inline Editing
- **Case name**: Double-click to enter edit mode (yellow highlight `#FFFF99`). Submit to rename, Escape to cancel
- **Try name**: Double-click to enter edit mode, same pattern
- **Conditional badges** appear next to case name:
  - Recurring icon — when `caseModel.selectedCase().nightly` is true
  - "PUBLIC" badge — when `caseModel.selectedCase().public` is true
  - "ARCHIVED" badge — when `caseModel.selectedCase().archived` is true

### Action Bar Items

| Action | Behavior |
|--------|----------|
| **Select Scorer** | Opens modal with user's scorers and communal scorers. Selecting triggers rescore of all queries |
| **Judgements** | Links to associated Book (if any) for bulk judging workflow |
| **Snapshot** | Opens snapshot creation modal |
| **Diff** | Opens snapshot selection for comparison mode |
| **Import Ratings** | Import ratings from external file |
| **Share Case** | Share case with a team |
| **Clone Case** | Duplicate case with all queries and ratings |
| **Delete Case** | Delete with confirmation |
| **Export Case** | Export case data (multiple formats) |
| **Tune Relevance** | Toggle dev settings pane visibility |

### Case Score Display
- Current case score (aggregate of all query scores)
- Up to 5 diff score badges when snapshots are compared
- Each badge shows:
  - Numeric score (2 decimal places)
  - Background color from score-to-color mapping
  - "All rated" indicator when every query has fully rated results

### Case Score Calculation
1. For each query, collect the numeric score (skip `'zsr'`, `'--'`, `null`, `undefined`)
2. Sum all valid scores
3. Divide by count of valid scores
4. Apply color mapping
5. `allRated` is true only if every query's score indicates full rating coverage

### Scorer Selection Modal
- Two lists: **Communal (Default) Scorers** and **User's Custom Scorers** (scrollable, max-height 300px)
- Active scorer highlighted with Bootstrap `active` class
- Inaccessible scorer warning: if the case's current scorer is not in either list, shows warning "The scorer X used by this case is NOT shared..."
- "Create New Scorer" button links to scorers management page (hidden when `communalScorersOnly`)
- Selecting a scorer:
  1. `caseSvc.saveDefaultScorer(caseId, scorerId)`
  2. `scorerSvc.setDefault(scorer)`
  3. `queriesSvc.updateScores()` — triggers full rescore of all queries

---

## 14. Wizard & Onboarding

### Wizard Trigger Conditions
The wizard modal opens automatically when:
1. `showWizard=true` URL parameter is present, OR
2. ALL of: user hasn't completed case wizard, has exactly 1 case, is in 0 teams, hasn't seen intro wizard, and user object is defined

### Wizard Steps (6-Step `<wizard>` Component)

1. **Welcome**: Splash screen with Doug mascot image (`doug.jpg`, 100px wide, float left). "Hi, I'm Doug, creator of Quepid..."
2. **Case Name**: Text input for naming the case (default width 250px)
3. **Search Endpoint**: Accordion with two options:
   - **"Create a new Search Endpoint"**: Radio buttons with engine logos (`solr.png`, etc.) for Solr, ES, OpenSearch, Vectara, Static, SearchAPI, Algolia. URL input with "ping it" validation button. Engine-specific config:
     - Solr: API method dropdown (JSONP/GET)
     - SearchAPI: "Custom Mapper Required" alert with "Use Mapper Wizard" button
     - Static: CSV file upload via `ng-csv-import` directive
   - **"Use an existing Search Endpoint"**: Dropdown selector from configured endpoints. SearchAPI gets additional "Test Query" input
   - Custom headers component (API Key / Custom / None)
   - TLS mismatch, invalid headers, and proxy API method validation alerts
   - "Validating..." spinner state on Continue button
4. **Display Fields**: Title field, ID field (both with typeahead from discovered fields), additional fields via `tags-input` with auto-complete. Required field validation with red error text
5. **Queries**: Query text input with "Add Query" button. List of added queries with individual "X" delete buttons. SearchAPI shows query pattern input (textarea for POST, text input for GET). Static engine shows message about auto-creating queries from CSV
6. **Finish**: "That's It!" confirmation with large green "Finish" button

### Special: Static CSV Import
For the Static engine type, the wizard includes:
1. CSV file upload
2. Header validation (`Query Text`, `Doc ID`, `Doc Position` required)
3. Whitespace detection in field names
4. Creates snapshot from CSV data via `querySnapshotSvc.importSnapshotsToSpecificCase()`
5. Generates magic URL: `/api/cases/{caseNo}/snapshots/{snapshotId}/search`
6. Sets this as the search URL, continuing the wizard flow

### Post-Wizard Tour
After wizard completion, if user hasn't completed the case wizard tour, `setupAndStartTour()` launches an interactive guided tour of the evaluation UI using **Shepherd.js** — see [`core_ui_implementation_reference.md` §1](./core_ui_implementation_reference.md#1-shepherd-post-wizard-tour-tourjs) (`tour.js`).

---

## 15. Keyboard & Interaction Patterns

### Drag-and-Drop
- Query rows are **draggable** when sort mode is "Default" (manual order)
- Uses SortableJS via the Stimulus `queries-list` controller with a handle element
- On drop: calculates new position accounting for pagination offset
- Sends position update to backend
- Disabled when any sort mode other than "Default" is active

### Text Paste
- `quepidDom.textPaste` (via add-query directive link) captures paste events on the add-query input
- Used for bulk query input (paste multiple queries separated by newlines)
- Passes `$pastedText` to expression handler

### Auto-Grow Inputs
- Measures text width with a hidden span
- Expands input width to fit content

### Modal Patterns
All modals use `$uibModal.open()` with:
- Template URL
- Controller
- Resolve (data injection)
- Result handling via `.then()` promise

| Modal | Purpose |
|-------|---------|
| Snapshot Creation | Name input, field recording toggle |
| Scorer Selection | Pick from user/communal scorers |
| Try Details | View/edit/duplicate/delete a try |
| Detailed Document | Full document fields view |
| Detailed Explain | Raw explain JSON explorer |
| Wizard | Multi-step onboarding flow |
| Query Options | Per-query option editor |

### Popover Patterns
- Rating popovers (individual and bulk): `quepid-popover-template` with `popover-trigger="outsideClick"` and `popover-placement="auto right"`
- Stacked chart match details: `quepid-popover-template` with `popover-placement="left"`
- Score badge tooltips: `quepid-tooltip` with configurable delay and placement

### Third-Party Angular Components Used
| Component | Source | Usage |
|-----------|--------|-------|
| `ui-ace` | angular-ui-ace | JSON/Lucene code editors (query sandbox, headers, doc finder) |
| `$quepidModal` | first-party (BS5 Modal) | All modal dialogs (replaced `uib-modal`) |
| `quepid-popover` / `quepid-popover-template` | first-party (BS5 Popover) | Rating popovers, explain popover (replaced `uib-popover*`) |
| `bs-static-popover` | first-party (BS5 Popover) | Fixed `?` help icons (`data-bs-content`; see `directives/bsStaticPopover.js`) |
| `quepid-tooltip` | first-party (BS5 Tooltip) | Query text tooltips (replaced `uib-tooltip`) |
| `quepid-typeahead` | first-party (autocompleter) | Search endpoint selector, field mapping (replaced `uib-typeahead`) |
| `uib-progressbar` | angular-ui-bootstrap | Explain match percentage bars |
| `uib-collapse` | angular-ui-bootstrap | Collapsible sections (stacked chart "more", settings subsections) |
| BS5 accordion (`data-bs-toggle`) | Bootstrap 5 | Wizard endpoint selection (new vs existing) |
| `dir-paginate` | angular-utils-pagination | Query list pagination (15/page) |
| `ngclipboard` | ngclipboard | Copy query text to clipboard |
| `ng-csv-import` | ng-csv-import | Static CSV file upload in wizard |
| `tags-input` + `auto-complete` | ng-tags-input | Additional display fields in wizard |
| `flash-alert` | angular-flash | Flash success/error messages |
| `<wizard>` / `<wz-step>` | angular-wizard | Multi-step wizard flow |
| `angular-vega` | custom | Vega chart rendering directive |
| `timeAgo` filter | first-party (`filters/timeAgo.js`) | Relative timestamps on annotations (`Intl.RelativeTimeFormat`; replaced `yaru22.angular-timeago`) |

**Migrated off Angular:** JSON tree display is Stimulus `json-explorer` + `utils/json_explorer.js` (styles: `json-explorer.css`). Used for detailed doc fields, query/match explain, and object/array field values.

---

## 16. State Management Architecture

### Service-as-State Pattern
AngularJS services act as singleton state stores. Key services and their state:

| Service | Primary State | Persistence |
|---------|--------------|-------------|
| `queriesSvc` | Query objects dictionary, display order, scoring data | API-backed |
| `caseSvc` | Selected case, case lists, case metadata | API-backed |
| `settingsSvc` | Current try/settings, try list | API-backed |
| Query collection/document stores + `diffStateStore` | Query toggle state and diff settings | In-memory (session) |
| `scorerSvc` | Default scorer, scorer lists | API-backed |
| `docCacheSvc` | Cached document details | In-memory |
| `configurationSvc` | Feature flags (communal-only, sortable) | In-memory |
| `querySnapshotSvc` | Snapshot list for current case | API-backed |

### Change Detection
- **Version counters**: `queriesSvc.svcVersion`, `ratingsStore.version()`, `settingsSvc.settingsId()` increment on changes
- **Angular `$watch`**: Controllers watch service properties for UI updates
- **`$watchCollection`**: Used for array/dictionary changes (query list, snapshot list)
- **Broadcast events**: Cross-service communication via `$rootScope.$broadcast()`

### Key Events

| Event | Trigger | Consumers |
|-------|---------|-----------|
| `rating-changed` | Any document rating changes | QueriesCtrl (debounced rescore), SearchResultsCtrl (refresh counts) |
| `scoring-complete` | All queries scored | QueriesCtrl (update case score display) |
| `updatedCaseScore` | Case score persisted | Annotations, case header |
| `settings-changed` | Try created/selected | MainCtrl (reload queries) |
| `settings-updated` | Try updated in-place | Settings watchers |
| `annotationDeleted` | Annotation removed | Annotations list |

Scorer selection (`pick-scorer-core` Stimulus modal) loads lists via `api/scorers` and saves via `PUT api/cases/:id/scorers/:id`, then dispatches `pick-scorer:selected` so Angular `scorerSvc` / `queriesSvc` can rescore live queries — no event-bus notification for the list load itself.

### Bootstrapping Sequence

```
URL navigation to /case/{caseNo}/try/{tryNo}/
    ↓
MainCtrl → bootstrapCase(caseNo)
    ↓
caseSvc.get(caseNo) → fetch case data
    ↓
settingsSvc.setCaseTries(tries) → set up try history
settingsSvc.setCurrentTry(tryNo) → select active try
    ↓
scorerSvc.bootstrap(caseNo) → load scorers
    ↓
queriesSvc.bootstrapQueries(caseNo) → GET /api/cases/{caseNo}/queries?bootstrap=true
    ↓
docCacheSvc.update(settings) → pre-fetch cached docs
    ↓
queriesSvc.changeSettings(caseNo, settings)
    ↓
queriesSvc.searchAll() → execute all queries against search engine
    ↓
querySnapshotSvc.bootstrap(caseNo) → load snapshots
    ↓
caseSvc.trackLastViewedAt(caseNo) → update metadata
```

If the case changes (navigation to different case):
- Reset `queriesSvc`, query collection/document stores, `diffStateStore`, `docCacheSvc`, `scorerSvc`
- Re-bootstrap with new case data

### Document Cache (`docCacheSvc`)
- Caches document details fetched from search engines (for snapshot viewing and rated doc display)
- `addIds(moreIds)` — register doc IDs to fetch
- `update(settings)` — batch fetch all missing docs via `docResolverSvc` (15-doc batches)
- `invalidate()` — mark all as unfetched (but keep IDs)
- `empty()` — clear entire cache
- Used by `SnapshotFactory` to look up doc details for snapshot results

### Synced Pairs Cache
- `queriesSvc.syncedPairsCache` — tracks which query-doc pairs have been synced to a Book
- Prevents duplicate sync operations
- Cleared when case changes

---

## 17. API Surface

The query evaluation page communicates with these backend endpoints:

### Query Operations
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/cases/{caseNo}/queries?bootstrap=true` | Load all queries for case |
| POST | `/api/cases/{caseNo}/queries` | Create single query |
| POST | `/api/bulk/cases/{caseNo}/queries` | Bulk create queries |
| PUT | `/api/cases/{caseNo}/queries/{queryId}` | Update query properties |
| DELETE | `/api/cases/{caseNo}/queries/{queryId}` | Delete query |
| PUT | `/api/cases/{caseNo}/queries/{queryId}/position` | Reorder query |
| GET | `/api/cases/{caseNo}/queries/{queryId}/notes` | Fetch query notes |
| PUT | `/api/cases/{caseNo}/queries/{queryId}/notes` | Save query notes |
| GET | `/api/cases/{caseNo}/queries/{queryId}/options` | Fetch query options |
| PUT | `/api/cases/{caseNo}/queries/{queryId}/options` | Save query options |

### Rating Operations
| Method | Endpoint | Purpose |
|--------|----------|---------|
| PUT | `/api/cases/{caseNo}/queries/{queryId}/ratings` | Rate single document |
| DELETE | `/api/cases/{caseNo}/queries/{queryId}/ratings` | Reset single rating |
| PUT | `/api/cases/{caseNo}/queries/{queryId}/bulk/ratings` | Bulk rate documents |
| POST | `/api/cases/{caseNo}/queries/{queryId}/bulk/ratings/delete` | Bulk reset ratings |

### Scoring & Case Operations
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/cases/{caseId}/scores` | Get latest score |
| GET | `/api/cases/{caseId}/scores/all` | Get score history |
| PUT | `/api/cases/{caseId}/scores` | Save case scores |
| PUT | `/api/cases/{caseId}/metadata` | Update case metadata (lastViewedAt) |
| POST | `/api/cases/{caseId}/run_evaluation` | Queue background evaluation |

### Try/Settings Operations
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/cases/{caseNo}/tries` | Load tries for case |
| POST | `/api/cases/{caseNo}/tries` | Create new try |
| PUT | `/api/cases/{caseNo}/tries/{tryNo}` | Update try settings |
| POST | `/api/clone/cases/{caseNo}/tries/{tryNo}` | Duplicate a try |

### Snapshot Operations
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/cases/{caseNo}/snapshots?shallow=true` | List snapshots |
| POST | `/api/cases/{caseNo}/snapshots` | Create snapshot |
| DELETE | `/api/cases/{caseNo}/snapshots/{snapshotId}` | Delete snapshot |
| GET | `/api/cases/{caseNo}/snapshots/{snapshotId}?shallow=true` | Get snapshot details |
| POST | `/api/cases/{caseNo}/snapshots/imports` | Bulk import snapshots |

### Scorer Operations
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/cases/{caseNo}/scorers` | Load case scorers |
| GET | `/api/scorers` | List all scorers |
| GET | `/api/scorers/{scorerId}` | Get specific scorer |

### Annotation Operations
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/cases/{caseId}/annotations` | List annotations |
| POST | `/api/cases/{caseId}/annotations` | Create annotation |
| PUT | `/api/cases/{caseId}/annotations/{id}` | Update annotation |
| DELETE | `/api/cases/{caseId}/annotations/{id}` | Delete annotation |

### Book Sync
| Method | Endpoint | Purpose |
|--------|----------|---------|
| PUT | `/api/books/{bookId}/populate` | Sync query-doc pairs to book |

### CSRF
All requests include `X-CSRF-Token` header via `rails-csrf` interceptor.

---

## 18. Known Technical Debt

### Scorer Dual-Execution Drift
The client-side `ScorerFactory.js` and server-side `scorer_logic.js` have diverged:
- 6+ functions exist only on client (`avgRating100`, `editDistanceFromBest`, `pass`, `fail`, `assert`, `assertOrScore`)
- Document access differs (`docs[posn].doc` vs `docs[posn]`, `.getRating()` vs `["rating"]`)
- Score resolution differs (Angular `$q.defer()` vs variable assignment)
- Custom scorers authored in the browser may behave differently in server-side batch evaluation

### `eval()` for Scorer Execution
Client-side scorers run via `eval()` inside `$timeout()`. This:
- Has no sandboxing — scorer code has full access to Angular scope and DOM
- Is a significant security concern (XSS vector if scorers are shared)
- Can't be killed if it runs too long (the Web Worker timeout is commented out)

### `new Function()` for Mapper Code
SearchAPI mapper code evaluated via `new Function()` constructor in non-strict mode:
- Sets functions on `window` object globally
- No sandboxing or isolation
- Error handling is try/catch around eval

### jQuery Dependencies
- Pane resizing uses jQuery event binding and DOM manipulation
- Various directives still use jQuery selectors
- Query drag-and-drop is owned by the Stimulus `queries-list` controller and uses SortableJS

### Hardcoded Constants
- 15 queries per page (hardcoded in QueriesCtrl)
- 10 default documents per scorer iteration (DEFAULT_NUM_DOCS)
- 450px east pane width
- 5 maximum snapshot comparisons
- 100ms debounce for score recalculation
- 200-character preview for try query params

### Missing Features (in Code but Incomplete)
- `checkCodeExecutionTime()` — Web Worker-based timeout for scorer code, commented out with TODO note
- `recordDepthOfRanking` — depth tracking is appended to scorer code but not surfaced in all UI contexts

---

## 19. Visual Design & Styling

### Color Systems

**Rating Scale Colors** (hardcoded hex values in `ratingBgStyle` filter):

| Rating | Color | Hex |
|--------|-------|-----|
| 1 | Dark Red | `#c51800` |
| 2 | Bright Red | `#e61f00` |
| 3 | Orange-Red | `#fe2400` |
| 4 | Orange | `#fe5b00` |
| 5 | Amber | `#ffad00` |
| 6 | Yellow | `#ffd600` |
| 7 | Yellow-Green | `#bfd200` |
| 8 | Green | `#00c700` |
| 9 | Darker Green | `#00af00` |
| 10 | Dark Green | `#008900` |
| Unrated | Gray | `#777` |

**Query Score Colors** (`qscoreSvc`, HSL gradient):
- Uses a 10-step HSL table from `hsl(0, 100%, 40%)` (red) to `hsl(100, 90%, 35%)` (dark green)
- Pending (`--` or `zsr`): `hsl(0, 0%, 91%)` (light gray)
- Unrated: `hsl(0, 0%, 0%, 0.5)` (semi-transparent black)

**Scorer-Generated Colors** (HSL computed per scale):
- Formula: `hsl((value - min) * 120 / range, 100%, 50%)`
- Min value → hue 0 (red), Max value → hue 120 (green)
- Linear interpolation between

### Typography
- **Custom font**: Aller family (woff2 format) — `allerregular`, `alleritalic`, `allerbold`, `allerbold_italic`
- Score badges use `allerbold_italic`, 22px, white text
- Navigation uses `allerregular`

### Score Badge Styling
- Block float left, 90px wide, full height
- Color: white text on colored background
- Border-radius: 5px (top-left, bottom-left)
- Margin: negative margins for flush alignment (-10px top/bottom, -20px left)
- Header badges: min-height 80px, padding 15px, font-size 22px

### Rating Button Styling
- **Single rating buttons**: 60px wide, inset box-shadow (`inset 0 0 25px rgba(0,0,0,0.25)`), white text with text-shadow
- **Selected rating** (`.btn-preselected`): Bold, 2px solid black border, `box-shadow: 0 0 0 0.25rem rgba(0, 0, 0, 0.3)`, `transform: scale(1.05)`
- **Rating container buttons**: Transition `0.2s cubic-bezier(0.4, 0, 0.2, 1)`, min-width 45px, border-radius 0.375rem

### Layout Styling
- **Result list items**: 1px solid #eee border, 5px border-radius, 5px bottom margin
- **Sub-results background**: `url('sub-results-bg.png')` with `#F7F7F7` fallback, padding 75px 15px 15px 15px
- **Result header hover**: Background #eee
- **Body background**: `blue_bg.jpg`

### Diff View Styling
- Flexbox layout: `display: flex` for header and rows
- Column borders: 1px solid #eee right border
- Min-height per row: 200px
- Header bottom border: 2px solid #eee
- **Diff highlight borders** (4px left border):
  - Different: `#ffc107` (yellow)
  - Missing: `#dc3545` (red)
  - New: `#28a745` (green)
- Responsive: at max-width 768px, columns stack vertically (`flex-direction: column`)

### Frog Icon Styling
- Frog emoji: `🐸` with `filter: grayscale(100%)` (always grayscale)
- Notification bubble: absolute positioned, -10px top, -12px right, red background (70% opacity), 20px circle, white text, 12px font

### Animations
- **Froggy animation**: `flipInX` / `flipOutX` on ng-hide transitions (2s duration)
- **Spinner**: `spin 1s linear infinite` rotation for loading indicators (class: `spintime`)

### Chart Styling (`qgraph.css`)
- Height: 100px, white background
- Path stroke: `#587`, width 2, round linecap, no fill
- X-axis lines: lightgrey
- Y-axis lines/path: black, no fill

### Icon Systems
- **Bootstrap Icons**: `bi bi-*` classes (replaced Glyphicons)
- **Querqy icon**: Custom PNG image (`querqy-icon.png`), 24x24px, background-image
- **Engine icons**: Per-engine PNGs (`solr.png`, `solr-icon.png`, etc.)
- **Doug mascot**: `doug.jpg` (wizard welcome step, 100px wide)

### CSS Custom Properties
```css
:root {
  --qscore-spacing-sm: 5px;
  --qscore-spacing-md: 10px;
  --qscore-spacing-lg: 15px;
  --qscore-spacing-xl: 20px;
  --qscore-border-radius: 5px;
  --qscore-border-width: 1px;
  --qscore-border-width-thick: 2px;
  --qscore-highlight-width: 4px;
}
```

### Key CSS Files
1. **qscore.css** (218 lines) — score display, diff layout, responsive breakpoints
2. **bootstrap5-compat.css** (~709 lines) — BS5 shims for case UI (navbar, modals, popovers, etc.)
3. **animation.css** (152 lines) — frog animation, spinner, notification bubble
4. **judgements.css** (86 lines) — rating button transitions and selected states
5. **qgraph.css** (105 lines) — SVG chart/graph styling
6. **style.css** (105 lines) — main layout, results list
7. **fonts.css** — Aller font family declarations

### No Dark Mode / No Print Styles
- No dark mode support exists
- Limited print styles (no dedicated print stylesheet)

---

## 20. Error Handling

### Search Error Translation (`app/javascript/utils/search_error.js`)

Comprehensive HTTP status code mapping (100+ codes mapped to human-readable names). The framework-free utility is exposed to the legacy case runtime through `window.quepidSearch.searchErrors`. Error responses are parsed in this priority:

1. `response.data.error` (object: extract message; string: use directly)
2. `response.statusText`
3. `response.reason`
4. Mapped status code name

**Special Cases**:
- **CORS failure** (`response.status === -1`): Suggests URL typo checking, CORS enablement, and ad blocker detection
- **Solr-specific**: Custom error message with link to direct Solr instance inspection and troubleshooting wiki for Solr 8.4.1+ `X-Content-Type-Options: nosniff` compatibility issues
- Error text rendered via `ng-bind-html` in a red `alert alert-danger` div within each query row

### Search Engine Change Detection
`MainCtrl` compares search URLs between old and new try to detect when the user switches between endpoints. Differentiates between:
- TLS errors (protocol mismatch)
- Case not found errors (invalid caseNo)
- Generic search errors

---

## 21. Book Sync Integration

The query evaluation page integrates with the Book (judgment collection) system:

### Sync Flow (`queriesSvc.syncToBook()`)
1. Fetches `case.book_id` from case data
2. Builds query-doc pairs from current query results, each containing:
   - `query_text`, `doc_id`, `position` (1-based counter)
   - `document_fields`: extracted title, thumb, image, and other field values
3. Checks `syncedPairsCache` to filter to **only unsynced pairs** (keyed by `"queryText:docId"`)
4. **Batches by 100 pairs** per API call
5. For each batch: `bookSvc.updateQueryDocPairs(bookId, caseNo, batch)` → `PUT /api/books/{bookId}/populate`
6. **Optimistic caching**: Marks pairs in cache *before* API confirmation
7. On error: removes failed pairs from cache (allowing retry)
8. Cache methods: `clearSyncCache(bookId)`, `getSyncCacheStats(bookId)`
9. Cache cleared entirely when case changes

### Field Mapping in `bookSvc.updateQueryDocPairs()`

The `bookSvc` performs detailed field extraction when building document payloads:

| Field | Source | Logic |
|-------|--------|-------|
| **General fields** | `doc.subsList` | Iterates `{field, value}` entries into flat `fields` map |
| **Title** | `doc.title` | Always written. If `doc.doc.title` differs from `doc.title` (raw title vs display title), saves raw as `fields['title_field']` to prevent overwrite |
| **Thumbnail** | `doc.thumb` | If `doc.thumb_options?.prefix` exists, prepends: `${prefix}${thumb}`. Otherwise raw thumb URL |
| **Image** | `doc.image` | Same prefix-wrapping pattern as thumbnail: `${prefix}${image}` |

The prefix-wrapping uses optional chaining (`?.`) with `// jshint ignore:line` since JSHint doesn't support the syntax.

### Refresh from Book (`bookSvc.refreshCaseRatingsFromBook()`)
- PUTs to `api/books/{bookId}/cases/{caseId}/refresh`
- If case has ≥50 queries, runs in background mode (`process_in_background=true`) and redirects to Quepid root after 500ms delay
- On modal close success, the frog report controller resets and re-bootstraps: `queriesSvc.reset()` → `bootstrapQueries()` → `searchAll()`

---

## 22. Doc ID Validation & Edge Cases

### Two-Tier Document ID Validation (`DocListFactory`)

When creating rateable docs from search results, the factory validates document IDs:

**Error 1: Missing ID Field**
- Triggered when the configured ID field doesn't exist on one or more results
- Sets `doc.error = 'ID Field Missing'` and assigns a fake ID
- User-facing message: *"Your selected id field `id` is missing on one or more results. Quepid requires a unique identifier for each document to work correctly. Open the 'Tune Relevance' pane, and under 'Settings' in the 'Displayed Fields' field change `id:id` to specify your unique ID field."*

**Error 2: Duplicate IDs**
- Triggered when two or more documents share the same ID value
- Sets `doc.error = 'ID "docId" Shared With Another Doc'`
- User-facing message: *"Your selected id field `id` doesn't uniquely identify individual documents..."*

Both errors display as red `alert alert-danger` within the individual search result row.

### Doc ID Edge Cases in Ratings Store
- Doc IDs containing URLs are handled via escaping
- Doc IDs containing dots are handled via escaping
- String ratings are coerced to integers via `parseInt()`
- Empty string IDs are filtered out during rated docs initialization (workaround for "empty ID's that sneak in")

### Async Rated Docs Pattern
Before scoring, queries can optionally wait for rated documents to finish loading:
```
query.awaitRatedDocs() → Promise
  .then(() → query.score())
```
This ensures the scorer has access to `bestDocs` (all rated documents) even if they haven't finished loading from the search engine's `filterToRatings()` query. The `ratingsReady` boolean flag tracks this state.

---

## 23. Implementation reference (Angular & file inventory)

Sections 23–31 previously duplicated file-level inventories, `queriesSvc` internals, routing tables, and component catalogs. That material is **living migration documentation** — it changes as Angular is removed and goes stale quickly in a behavior-focused doc.

**Canonical source for remaining work:** [`todo.md`](./todo.md#frontend-cleanup-after-angular-removal)

Completed migration inventories are intentionally not duplicated here.

**Read source for deep internals:** `queriesSvc.js`, `queriesCtrl.js`, `routes.js`, `core_controller.rb`, `TryFactory.js`, `diffResultsSvc.js`, `tour.js`.

**Hybrid Stimulus on case pages:** Book bulk judging uses `bulk_judgement_controller.js`; see [`core_ui_implementation_reference.md` §4](./core_ui_implementation_reference.md#4-bulk_judgement_controller-stimulus) and [`DEVELOPER_GUIDE.md` § Stimulus HTTP conventions](../../DEVELOPER_GUIDE.md#stimulus-http-conventions).

**Deep internals** (tour steps, `queriesSvc` quirks, TryFactory map, bulk judgement states, Rails controller edge cases): [`core_ui_implementation_reference.md`](./core_ui_implementation_reference.md).

# Quepid Core UI: Query Evaluation Page

> **Role:** Deep dive on `/case/...` only (~50% of rewrite difficulty). App-wide inventory: [`QUEPID_FEATURES.md`](./QUEPID_FEATURES.md). Schema / HTML routes / business rules: [`complete_application_specification.md`](../complete_application_specification.md). Frontend cleanup: [`todo.md`](./todo.md#frontend-cleanup-after-angular-removal).
>
> The query evaluation page is the heart of Quepid and is where search engineers spend most of their time. This document enumerates its functionality, interaction model, and technical complexity.
>
> **Implementation:** AngularJS has been removed. The page is server-rendered by `core.html.erb` and driven by Stimulus controllers (registered in [`core_stimulus.js`](../../app/javascript/core_stimulus.js), 50 of them) on top of plain ES modules in `app/javascript/utils/`, `stores/` and `api/`. `core-bootstrap` loads the case and starts the searches; the `live_query_*` modules own query state, search execution and scoring; `scorer_runtime.js` runs scorer code.

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
- Right pane (dev settings) defaults to **450px** (`DEFAULT_EAST_PANE_WIDTH` in `pane_controller.js`)
- Slider can toggle the right pane open/closed
- Responds to window resize events (`window` `resize` listener)
- Managed by the Stimulus `pane` controller ([`pane_controller.js`](../../app/javascript/controllers/pane_controller.js)), which positions the slider, east pane and main pane with inline styles:
  - **Lazy initialization**: `refreshElements()` resolves the `.pane_east`, `.pane_main` and `.east-slider` elements. If the container width is 0 (not yet laid out), it retries after 200ms
  - **Drag handling**: `mousedown` on the slider registers a document `mousemove` listener; `mouseup` releases it. The dragged width is remembered for the session only (no localStorage)
  - **Toggle**: the controller listens for a `toggleEast` event on `document`; the Tune Relevance link dispatches it
  - The pane starts closed on each page load

### Visibility
- The "Tune Relevance" toggle in the header controls whether the dev settings pane is visible
- The state lives in the `pane` controller and is not persisted across page loads

---

## 2. Query List Panel

### Controls Bar

| Control | Behavior |
|---------|----------|
| **Add Query** button | Opens text input. Semicolons (`;`) delimit multiple queries — button label dynamically switches between "Add query" / "Add queries" based on presence of `;`. Paste handler (`attachTextPaste` in the `add-query` Stimulus controller) auto-converts newline-separated text to semicolons. The controller dispatches `add-query:submit` with the parsed query texts; the live-query runtime persists a single query (POST) or many (bulk POST to `api/bulk/cases/{caseNo}/queries`), then searches and scores them. The submit button is disabled while empty or loading |
| **Show Only Rated** checkbox | Toggles the live-query runtime's show-only-rated flag; when on, each query's search uses a filter query (Solr: `{!terms f=id}doc1,doc2,...`, ES/OS: `terms` filter in `bool` query) to show only rated documents |
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
- On drop: calculates from/to indices accounting for the reverse sort and the **pagination offset** (`(currentPage - 1) * pageSize`)
- Sends `PUT /api/cases/{caseNo}/queries/{queryId}/position` with `{after: oldQueryId, reverse: boolean}`
- Feature-flagged: the `queryListSortable` value (server-rendered onto the `core-bootstrap` element, stored by `configuration_runtime.js`) controls whether drag-and-drop is available at all

### Pagination
- **15 queries per page** (hardcoded)
- Standard previous/next/page-number controls
- Pagination interacts with drag-and-drop (position calculation includes page offset)

### Status Indicators
- **Bootstrapping**: "Booting up queries..." shown while the live-query runtime is bootstrapping
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
| **Score badge** | Color-coded (HSL gradient, red→green) via `scoreToColor()` in `utils/scoring.js`, rendered by the `qscore-query` controller. Shows numeric score to 2 decimal places. Special values: `?` (pending), `--` (unrated), `zsr` (zero search results) |
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
| **Copy** | Copies query text to clipboard (`utils/clipboard.js`) |
| **Toggle Notes** | Shows/hides query notes section (slides in `notes-box` div) |
| **Explain** | Opens query-explain modal (Stimulus `query-explain` + `dynamic_modal`; size `lg`) with **3 tabs**: (1) **Params** — raw query parameters sorted alphabetically, displayed via vanilla `json_explorer`; (2) **Parsing** — `parsedQueryDetails` from searcher, also via `json_explorer` (uncollapsed); (3) **Query Template** — for ES template calls, renders template output in a `<pre>`. Each tab has a clipboard copy button. Only Solr returns query parameters; ES shows "not returned" message |
| **Missing Documents** (targeted search) | Opens DocFinder modal. Button gets `active` CSS class when Finder view is shown |
| **Query Options** | Per-query option key-value pairs via `<query-options>` component. Stimulus `query-options-core` opens a modal with a CodeMirror editor (JSON mode). Values accessible as `qOption('key')` in scorer code or `#$qOption.key##` in Query Sandbox template syntax. Saving dispatches `query-options:saved`, which triggers a full rescore |
| **Move Query** | Stimulus `move-query-core` opens a modal showing all the user's cases (excluding the current one). Selection sends `PUT /api/cases/{caseNo}/queries/{queryId}` with `{other_case_id: targetCaseNo}`; the query is removed from the local list on success |
| **Delete Query** | Delete with confirmation dialog |

### Query Notes Section
When toggled visible, shows a `form-horizontal` with:
- **Information Need**: Text input — describes what the query should find. Also shown as a tooltip on the query text in the header (1-second delay, right placement)
- **Query Notes**: Textarea — freeform notes about the query
- **Save button**: Persists via `PUT /api/cases/{caseNo}/queries/{queryId}/notes` (Stimulus `query-notes` controller)
- **Lazy loading**: Notes are fetched from the server only when the notes section is first opened, not during initial query load

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
- Each result is rendered by the Stimulus `search-result` controller ([`search_result_controller.js`](../../app/javascript/controllers/search_result_controller.js)); the parent `search-results` controller owns search, rating and detail commands. Snippet fields are rendered with three-way type detection:
  1. **Object/Array values**: Rendered with Stimulus `json-explorer` (`utils/json_explorer.js` — expandable JSON tree, starts uncollapsed)
  2. **URL values** (`http(s):` prefix): Rendered as clickable `<a>` link opening in new tab
  3. **Text values** (default): Rendered as sanitized HTML (`sanitizeHtml`), so `<strong>` highlights survive
- **Title**: Clickable — dispatches `search-result:show-document`, which opens the Detailed Document modal
- **Translations**: Sanitized HTML plus a Google Translate link (`https://translate.google.com/?sl=auto&tl=en&text=...`)
- **Unabridged fields**: Full content rendered as sanitized HTML
- **Rank** and, at the scoring depth, a "Results above are counted in scoring." footer
- Doc ID field is validated with two-tier error detection (see Section 22)

### Image/Thumbnail Prefix Wrapping
Thumbnail and image URLs are rendered as `${options.prefix}${value}` when the field spec supplies a prefix, so search engines that return relative image paths can be prefixed with a base URL.

### Snippet Extraction
Highlighted snippets come from splainer-search (`doc.subSnippets('<strong>', '</strong>')`), which wraps matches in `<strong>` tags.

### Column Layout Adaptation
The summary column shows a thumbnail column when `doc.hasThumb`, a full-image column when `doc.hasImage`, and text only otherwise.

### Media Embedding
`embedField()` in `search_result_controller.js` detects the file extension (ignoring any query string) and renders:
- `.mp3`, `.wav`, `.ogg` → `<audio controls>`
- `.jpg`, `.jpeg`, `.gif`, `.png` → `<img>`
- `.mp4`, `.webm` → `<video controls>`
- anything else → plain text

### Pagination
- "Peek at the next page" link loads additional results via `query.paginate()`
- Results append to existing list (not replace)
- Separate pagination for rated docs (`query.ratedPaginate()`)

### Explain Visualization (Stacked Chart)
- The Stimulus `match-explain` controller ([`match_explain_controller.js`](../../app/javascript/controllers/match_explain_controller.js)) renders the scoring breakdown per document. It replaced the `stackedChart` directive and `HotMatchesCtrl`
- Only rendered when `explainView` is `full` and the doc has `matchExplain` data
- Trigger: "Matches" text with info icon, opens a Bootstrap popover on click (outside click closes, placed left)
- Popover title: "Relevancy Score: {doc score}"
- Shows "No Match" when there are no hot matches, and "no per-term score breakdown for doc" when the explain has no children
- **3 or fewer matches**: Shows all as Bootstrap progress bars (width = clamped match percentage) with description labels
- **More than 3 matches**: Shows first 3, remainder in a Bootstrap collapse behind a "Show N More" / "Show Less" toggle link
- Popover body: the explain as text (or JSON when there is no breakdown) with **Debug** and **Expand** buttons. Expand opens a full-screen modal with the score and explanation text
- Click on any bar, or the Debug button, opens the **Detailed Explain modal** with `json_explorer` showing the raw explain string (collapsed)

### Detailed Document Modal
- Opens when clicking document title (vanilla modal via `utils/detailed_document_modal.js`)
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
3. Click a value → the `rating-popover` controller triggers the live-query `rateDocument` command (`live_query_commands.js`) → `query.ratingsStore.rateDocument()` → `PUT /api/cases/{caseNo}/queries/{queryId}/ratings`
4. "Reset" button → `ratingsStore.resetRating()` → `DELETE /api/cases/{caseNo}/queries/{queryId}/ratings`
5. After rating, `query.touchModifiedAt()` updates the query's modified timestamp
6. A `rating-changed` event is dispatched (on the scoring store, or `ratings:changed` on `document`) to trigger score recalculation

### Bulk Rating ("Score All")
1. Click "Score All" in query toolbar
2. Popover appears with same scale
3. Click a value → all visible documents rated at once
4. Respects "Show Only Rated" filter — only rates currently visible docs
5. Uses `ratingsStore.rateBulkDocuments(ids, rating)` → `PUT /api/cases/{caseNo}/queries/{queryId}/bulk/ratings`
6. Bulk unrate: `ratingsStore.resetBulkRatings(ids)` → `POST /api/cases/{caseNo}/queries/{queryId}/bulk/ratings/delete`

### Ratings Storage (`ratingsStore`)
- Each query has a `ratingsStore` instance keyed by `(caseNo, queryId)`
- Internal dictionary maps `docId → rating` (integer)
- Supports URL-containing and dot-containing doc IDs (with escaping)
- `bestDocs()` returns all rated docs sorted by rating value (descending) — used by scorer
- `version()` counter increments on every change (for dirty-checking)
- Rateable document objects expose `hasRating()` and `getRating()`, which the scorer runtime calls

---

## 6. Scoring Engine

### Dual Execution Model

Scorers run in **two environments** that share one runtime:

| Environment | Engine | Trigger | Location |
|-------------|--------|---------|----------|
| **Client-side** | Browser `new Function`, scheduled with `queueMicrotask` | Rating change, search complete | [`scorer_runtime.js`](../../app/javascript/utils/scorer_runtime.js) → `runCode()` |
| **Server-side** | MiniRacer V8 sandbox | Background evaluation, nightly runs | [`javascript_scorer.rb`](../../lib/javascript_scorer.rb) loads the same `scorer_runtime.js` |

### Scorer Contract

Two modules own scorers; nothing else builds or loads them.

- [`scorer_runtime.js`](../../app/javascript/utils/scorer_runtime.js) — `createScorer(apiJson, options)` is the only scorer implementation. Its header comment lists the fields and methods callers may rely on (`score()`, `checkCode()`, `getColors()`, `scorerId`, `scale`, ...). It must stay a dependency-free module with a single export because the server evaluates it too.
- [`scorer_catalog.js`](../../app/javascript/utils/scorer_catalog.js) — the case's default scorer: `getDefault()`, `select(apiJson)` and `bootstrap(caseNo)`. It builds every scorer with one set of `createScorer` options.

The live-query runtime reaches the catalog as `domain.scorer` and exposes it as `queryCapabilities.setScorer(apiJson)` / `getDefaultScorer()`. `changeSettings()` bootstraps the scorer when the case changes; `core-bootstrap` does not.

Migration from the older shape:

| Before | Now |
|--------|-----|
| `catalog.constructFromData(data)` then `catalog.setDefault(scorer)` | `catalog.select(data)` |
| `createScorerCatalog({ constructFromData, initialDefault })` | `createScorerCatalog({ request, promiseApi, scorerOptions })` |
| `capabilities.core.scoring.bootstrap(caseNo)` in `core-bootstrap` | removed: `changeSettings()` already bootstraps, so the case's scorers were fetched twice |
| `domain.scorer` wrapper object re-exposing the catalog | `domain.scorer` is the catalog |

### Server-Side Differences

The server evaluates `scorer_runtime.js` itself, so every helper (`avgRating100`, `pass`, `assert`, `max`, ...) behaves the same in both places. `JavascriptScorer` adapts the stored snapshot to the runtime's inputs:

- `docs` are snapshot docs wrapped with `hasRating()`/`getRating()`; `docAt()` returns the stored doc fields plus `id` and `rating`.
- `bestDocs` are the query's ratings, highest first.
- `numFound()` is the snapshot query's `number_of_results`; `qOption()` reads the query's options.
- `ratedDocAt()`/`eachRatedDoc()` see no rated-doc lookup results, and `refreshRatedDocs()` does nothing.
- A scorer that errors, fails, or never sets a score leaves the snapshot query unscored.

### Score Capping
After scorer execution, the client-side score is adjusted:
1. If `null` and no docs → `'zsr'` (zero search results)
2. If `null` and no bestDocs → `'--'` (unrated)
3. If negative → `0`

There is no upper bound. Scores are not capped at the rating scale max: CG@10, DCG@10, and v1 routinely exceed it. `scorer.maxScore()` always returns `undefined` (unchanged from the Angular era), so `scoreQuery()` in `query_scoring.js` falls back to a max of 1 for score colors.

### Loop Prohibition
- Regex check: `/(while|for)\s*\(/g`, run by `hasLoop()` inside `checkCode()`
- If matched, the check rejects with: "Loops are currently not supported, use `eachDoc` to loop over documents."
- The check is a save/test-time validation only; it is not applied each time a scorer runs, so seeded scorers such as ERR@10 that contain `for` loops still score
- Users are told to use `eachDoc()`, `eachRatedDoc()`, `eachDocWithRating()` etc. instead

### Depth of Rating Tracking
After scorer code executes, the system appends code to detect and extract the `k` parameter:
```javascript
if (typeof k !== 'undefined') {
  recordDepthOfRanking(k);
}
```
This records how many documents the scorer inspected (stored on `query.depthOfRating`).

### Execution Timeout
There is no execution timeout. The Angular-era `checkCodeExecutionTime()` Web Worker prototype was never functional and is not part of `scorer_runtime.js`, so a scorer that loops forever blocks the tab.

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
| `max` | variable | The largest value of the scorer's rating scale (a value, not a function) |
| `ratedDocAt` / `ratedDocExistsAt` | `ratedDocAt(posn)` / `ratedDocExistsAt(posn)` | Access `query.ratedDocs` by position, mirroring `docAt` / `docExistsAt` |
| `refreshRatedDocs` | `refreshRatedDocs(count?)` | Reloads the query's rated documents from the search engine (client-only) |

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

The right pane (`#dev-settings`, [`_tune_relevance.html.erb`](../../app/views/core/_tune_relevance.html.erb)) contains a **5-tab interface** for configuring the current search try: **Query**, **Tuning Knobs**, **Settings**, **History** and **Annotations**. It is driven by the Stimulus `tune-relevance` controller ([`tune_relevance_controller.js`](../../app/javascript/controllers/tune_relevance_controller.js)) with helpers in `utils/tune_relevance.js`.

### Tab 1: Query Sandbox

A single CodeMirror 6 editor (`modules/editor.js`) whose mode follows the query params (`queryParamsMode`):

| Engine | Mode | Format |
|--------|------|--------|
| **Solr** | Plain text | Key-value query parameters (e.g., `q=#$query##&defType=edismax&qf=title^2 body`) |
| **ES/OpenSearch, Vectara, Algolia** | JSON | JSON DSL query body / search parameters |
| **SearchAPI** | JSON when the params start with `{` | JSON with mapper code |
| **Static** | Info message | No editable params (snapshot-backed); the editor is hidden |

**Validation** (on "Rerun My Searches!"):
- JSON syntax validation for engines that use JSON query params, and for SearchAPI when the params start with `{` (shows "Please provide a valid formatted JSON object for the query DSL.")
- **Solr typo detection**: Regex-based dictionary checking for 7 common misspellings:
  - `deftype` → `defType`, `echoparams` → `echoParams`, `explainother` → `explainOther`
  - `logparamslist` → `logParamsList`, `omitheader` → `omitHeader`
  - `segmentterminateearly` → `segmentTerminateEarly`, `timeallowed` → `timeAllowed`
  - Shows warning: "Your query params contain `<key>`, you probably meant `<correct>`."
- **ES template call detection**: `isTemplateCall()` (splainer-search) detects template syntax and shows a warning about limitations (can't use `explainOther`; the `_source` field filter must include the displayed fields)
- Pretty-printing: JSON auto-formatted with 2-space indentation on save
- The Solr typo warnings above appear live as you type (`queryParamsWarning`)

### Tab 2: Tuning Knobs (Curator Variables)

Curator variables use `##varName##` syntax in query parameters. `utils/curator_vars.js` uses regex `/##[^#]*?##/g` to extract three tiers of variables:

**Three-Tier Variable System**:
1. **Magic variables** (stripped during parsing, not shown as knobs):
   - `#$query##` — replaced with user's search query text
   - `#$keyword1##`, `#$keyword2##` — positional keyword extraction (legacy feature that "never really got traction")
2. **Curator variables**: Any `##varName##` not in the magic set. Each gets a **numeric input** (min 0, max 10,000,000,000)
3. **Derived state**: Each variable tracks `inQueryParams` boolean — whether it's actually referenced in the current query params string. Warning shown if a variable exists but isn't referenced

- Empty state: when no variables exist, shows help text explaining `##variable##` syntax
- Variables sorted alphabetically via `sortVars()`
- Editing the query params re-extracts the variables (`updateVars()` on the selected try), so knobs appear and disappear as you type
- Saving ("Rerun My Searches!") creates a new "try" (version) to preserve history

### Tab 3: Settings

All subsections have **collapsible headers** (click to toggle visibility):

| Setting | Control | Detail |
|---------|---------|--------|
| **Endpoint Details** | Read-only block | Endpoint name, engine icon, URL, archived warning, and a "Troubleshooting and Quepid" wiki link chosen per engine (`troubleshootingWikiUrl`) |
| **Search Endpoint** | `<select>` plus a type-to-search box (up to 8 suggestions) | Picks from configured endpoints (the "OR" divider separates the two controls). Shows "No search endpoints found" or "No matching search endpoints found" as needed |
| **Displayed Fields** | Text input | Field spec string (e.g., `id:id title:name thumb:poster_path`). ES/OS template warning shown when applicable |
| **Number of Results** | Number input (1–100) | Results per page from search engine; other values are rejected on save |
| **Nightly Evaluation** | Checkbox | Enable/disable nightly background evaluation. The adjacent "Rerun My Searches in the Background!" button queues an immediate background job (button reads "Queuing evaluation job..." and is disabled while it runs), then returns to the Quepid root |
| **Escape Queries** | Checkbox | Whether to URL-encode query text before sending to engine. Hidden for engines that don't support it |

**TLS Protocol Warning**: If Quepid is served via HTTPS but the search engine URL is HTTP (or vice versa), a warning appears with a link to switch protocols. The link preserves all current UI state as URL parameters.

**Search Endpoint Switching**: When selecting a new endpoint, all settings are remapped:
- `endpointUrl` → `searchUrl`
- `searchEndpointId`, `searchEngine`, `apiMethod`, `customHeaders`, `proxyRequests`, `basicAuthCredential`, `mapperCode`, `mapperBasedSearchEngineId`
- Saving creates a new try to preserve history

### Tab 4: History

- Links to "Visualize your tries" (tries visualization analytics page), "Check Scores" (`cases/:id/scores`) and "Check Ratings" (`cases/:id/ratings`)
- Lists all non-deleted tries (search configuration versions) for the current case
- Each try shows:
  - Formatted name (or auto-generated "Try N")
  - First 200 characters of query params
  - "using {endpoint name}"
- **Color-coded by search URL**: each row gets a `bucket-N` class from `urlBucket(searchUrl, urls)`, deterministic on the unique search URLs, so tries against the same endpoint share a color
- Click navigates to that try (changes active search configuration)
- "..." button (click propagation stopped so it doesn't navigate) opens the **Try Details Modal**:
  - Try name with a Rename action
  - Full query arguments in a `<pre><code>` block
  - Search endpoint link plus a "Browse Search Endpoint" link
  - Displayed fields spec
  - Variables section listing the curator variables and their values
  - Duplicate button
  - Delete button
  - Dismiss button

### Tab 5: Annotations

- Case-level text annotations (notes about results/performance)
- Create, edit, delete via the Stimulus `annotations` controller (message textarea, list, edit modal)
- Each annotation is a structured object: `{id, caseId, message, score, source, user, createdAt, updatedAt}`
- The `score` field is a nested reference to the associated case score at the time of annotation
- `PUT /api/cases/{caseId}/annotations/{id}` for persistence

### Custom Headers

There is no custom-headers component in the Settings tab. Headers belong to the search endpoint: they are edited on the endpoint page (`search_endpoints/_form.html.erb`, CodeMirror JSON editor) and in the wizard's endpoint form (raw JSON textarea). Selecting an endpoint in Settings copies its headers onto the try.

### Action Button: "Rerun My Searches!"

At the bottom of the dev settings panel (`#query-sandbox-action`, visible only on the Query, Tuning Knobs and Settings tabs):
- Copies the editor, field spec, number of rows and escape flag onto the settings, validates them, and saves them as a new try (`settings.save()`)
- The saved try triggers a re-run of all queries
- If a TLS mismatch is detected, the button is replaced by a "Reload Quepid in {protocol} Protocol" link

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
3. The Stimulus `take-snapshot-core` controller builds the payload and sends `POST /api/cases/{caseNo}/snapshots`
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
3. The comparison store (`stores.diff`, driven by the Stimulus `diff-core` controller) activates comparison mode
4. Each query switches from Results view to **Diff view** (mode 3)
5. `createQueryDiff()` (`utils/diff_results.js`) creates diff objects for each query

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
The snapshot searcher (`createSearcherFromSnapshot`) wraps snapshot data in the same interface as live searchers:
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
The Doc Finder (Stimulus `missing-documents` controller) opens as a **modal** ("Find and Rate Missing Documents") with:
- ACE editor for query input (Lucene mode, single line, no gutter). This is the one place ACE is still used on the case page; everything else uses CodeMirror 6
- Help text explains per-engine syntax: "Solr: Use simple Lucene query syntax..." / "Elasticsearch/OpenSearch: Keywords replace #$query##..."
- **Enter key warning**: Detects enter keypress and shows red alert "Please click the 'Search' button instead of enter key..." (prevents accidental form submission in the editor)
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
   - Creates new searcher via `createSearcherFromSettings()` (`utils/live_query_runtime_owner.js`)
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
Settings (selected try)
    ↓
createSearcherFromSettings() (utils/live_query_runtime_owner.js → query_service.js)
    ↓
searchSvc.createSearcher(fieldSpec, searchUrl, args, queryText, options, searchEngine)   [splainer-search]
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
1. **Validation**: Code evaluated via `new Function()` constructor in non-strict mode (results cached by the mapper code string in `live_query_runtime_owner.js`)
2. **Required functions**:
   - `numberOfResultsMapper(response)` — extracts total result count from response
   - `docsMapper(response)` — extracts document array from response
3. **Test query substitution**: `#$query##` placeholder replaced with test query text
4. **Error handling**: Validates both functions exist, reports specific missing function errors

### Explain Parsing
- **Solr**: `solrExplainExtractorSvc` (splainer-search) parses human-readable explain text into structured match components (score breakdowns, field contributions)
- **ES/OS**: `esExplainExtractorSvc` (splainer-search) parses nested JSON explain output into match components
- Other engines: `normalDocsSvc.createNormalDoc()` without explain data

### Document Normalization
All search engine responses are normalized to a common format via `normalDocsSvc` (splainer-search, wired up in `core_runtime.js` by `createSplainerSearchRuntime()`):
- `id` — extracted from field spec ID field
- `title` — extracted from field spec title field
- Additional fields — based on field spec
- `explain()` — method returning parsed explain details
- `score()` — document relevance score

### Search Execution Pattern

```javascript
// utils/live_query_transport.js → createSearchAllRuntime() in utils/query_runtime.js — Two-Phase Architecture
searchAll():
  // Phase 1: Build lazy search functions (NOT promises)
  promises = queries.map(q => () => q.search().then(() => scorePromises.push(q.score())))

  // Execute via pAll() with optional rate limiting
  pAll(promises, requestsPerMinute)

  // Phase 2: After all searches, wait for per-query scores
  Promise.all(scorePromises).then(() => {
    scoreAll()    // aggregate case-level score
    syncToBook()  // sync query-doc pairs to book
  })

// query.search() internals:
query.search()
  → hasBeenScored = false
  → createSearcherFromSettings(settings, query)       // primary searcher (proxied when the try uses the proxy)
  → createSearcherFromSettings(settings, query, {filterToRated:true})  // rated searcher (constructed but NOT searched yet)
  → searcher.search()                                  // HTTP call to search engine
  → query.setDocs(searcher.docs, searcher.numFound)    // DocListFactory with ratingsStore
  → resolve()

// query.setDocs() internals:
setDocs(newDocs, numFound)
  → docs.length = 0           // truncate in-place
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
`pAll(queue, requestsPerMinute)` in [`utils/query_service.js`](../../app/javascript/utils/query_service.js) is an `async` function managing concurrent search execution (called by `runSearchAll()` via `createSearchAllRuntime()`, with `requestsPerMinute` taken from the selected try). The queue contains **functions** (not promises) — lazy evaluation ensures searches don't all start immediately.

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
ratingsStore.rateDocument(id, rating)  →  PUT /api/cases/{caseNo}/queries/{queryId}/ratings
    ↓
query.touchModifiedAt()
    ↓
store.scoring.markRatingChanged(queryId)   (fires 'rating-changed'; falls back to a 'ratings:changed' event on document)
    ↓  (live_query_events.js → ratingChanged)
├── invalidate the query's rated-docs cache and republish the query to the document store
└── schedule(scoreAll)
        ↓
    query.score() for every query → re-run scorer (cached when the version is unchanged)
        ↓
    scoreAll aggregation → store.scoring.setLatestScoreInfo(...) → 'scoring-complete' on the scoring store
        ↓
    qscore-case controller (onScoringComplete):
        ├── persistScore() → PUT api/cases/{caseId}/scores  { case_score: { score, all_rated, try_number, queries } }
        │       (URL and try number are server-rendered onto the element; skipped for non-numeric/-1 scores,
        │        empty query scores, or a missing try number; then dispatches 'case-score:persisted')
        └── refreshCaseDiffScores()
        ↓
    'queries-state:changed' dispatched on document
        ↓
    UI updates: case score badge, query score badges, diff score badges (qscore-query / qscore-case / diff-case-scores controllers)

    Separately, qscore-case also listens for the store's 'rating-changed' and refreshes the case diff scores
    (including per-query diffs) whenever a rating changes.
```

### `scoreAll()` Aggregation Algorithm

`scoreAllQueries()` in [`utils/query_scoring.js`](../../app/javascript/utils/query_scoring.js):

```javascript
scoreAllQueries(scorables):
  scores = []; queryScores = {}; allRated = true

  for each scorable:
    score()  // uses version cache — if version unchanged, returns cached score immediately
    .then(scoreInfo =>
      // any query with !allRated → allRated = false
      // null score → skipped (logged; no queryScores entry)
      // otherwise → push to scores and record in queryScores
      //   (this includes 'zsr' and '--'; averageScore() decides how they count)
    )

  // Final: { allRated, score: averageScore(scores), queries: queryScores }
```

`averageScore()` (`utils/scoring.js`) computes the case score: the arithmetic mean of the numeric scores, or `'--'` when every query is `zsr`/`--`. `createCaseScoringRuntime` then calls `onComplete`, which stores the result in `store.scoring` (only for a full scoreAll) and publishes `queries-state:changed`.

**Version cache deduplication in `score()`**: Each query tracks `lastScoreVersion` (initialized to `-5` sentinel). `version()` returns `localVersion + ratingsStore.version()`. If unchanged since last scoring, `score()` short-circuits and returns the cached `currentScore` via an immediately-resolved deferred — no scorer re-execution.

### Score Color Mapping (`scoreToColor` in `utils/scoring.js`)
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
The header is a server-rendered Turbo Frame (`GET /case/:id/header`) with the Stimulus `case-rename` and `case-toolbar` controllers on top.

- **Case name**: Double-click to enter edit mode (yellow highlight `#FFFF99`). Submit to rename (`PATCH /case/:id/header/case_name`), Escape to cancel
- **Try name**: Double-click to enter edit mode, same pattern (`PATCH /case/:id/header/try_name/:try_number`)
- **Conditional badges** appear next to case name:
  - Recurring icon — when the case is `nightly`
  - "PUBLIC" badge — when the case is `public`
  - "ARCHIVED" badge — when the case is `archived`

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
  1. `pick-scorer-core` saves via `PUT api/cases/:id/scorers/:id`
  2. It dispatches `pick-scorer:selected`
  3. `live_query_events.js` handles the event: `setScorer(...)` then `updateScores()` — triggers full rescore of all queries

---

## 14. Wizard & Onboarding

### Wizard Trigger Conditions
The wizard modal opens automatically when:
1. `showWizard=true` URL parameter is present, OR
2. ALL of: user hasn't completed case wizard, has exactly 1 case, is in 0 teams, hasn't seen intro wizard, and user object is defined

### Wizard Steps (6-step Stimulus modal)

The current case wizard is intentionally a compact, Rails-rendered/Stimulus-owned
flow. A numbered step tracker along the top shows progress and lets users jump back to earlier steps (not ahead, and not while an endpoint is being validated). It does not reproduce every Angular-era presentation control.

1. **Welcome**: Short introduction with Doug's photo.
2. **Case Name**: Text input for naming the case.
3. **Search Endpoint**: Existing endpoint selector followed by a create-new form. The form uses a plain engine select (no logo tiles), URL and API method fields, query/test-query fields, a raw JSON custom-headers textarea, basic auth, proxy toggle, and static CSV file input. Continue validates the endpoint; there is no separate "ping it" button, Solr curl/config help block, inline Mapper Wizard link, or engine-specific troubleshooting panel.
   - SearchAPI mapper setup remains available through the standalone Mapper Wizard under Search Endpoints; the case wizard does not provide the former shortcut and does not block a mapper-less draft.
   - TLS mismatch, invalid headers, and proxy/API-method validation alerts remain supported.
   - Static CSV files import on file selection; the wizard creates the snapshot-backed search URL and queries from the CSV.
4. **Display Fields**: Plain Title, ID, and comma-separated additional-field inputs. Required validation remains, but there are no discovered-field suggestions or tag/autocomplete controls.
5. **Queries**: Query text input with "Add Query" and removable query rows. SearchAPI query patterns and static CSV-derived queries remain supported.
6. **Finish**: "That's It!" confirmation with a Finish button.

### Special: Static CSV Import
For the Static engine type, the wizard includes:
1. CSV file upload
2. Header validation (`Query Text`, `Doc ID`, `Doc Position` required)
3. Whitespace detection in field names
4. Creates a snapshot from the CSV data through the snapshot import endpoint (`POST /api/cases/{caseNo}/snapshots/imports`)
5. Generates magic URL: `/api/cases/{caseNo}/snapshots/{snapshotId}/search`
6. Sets this as the search URL, continuing the wizard flow

### Post-Wizard Tour
After wizard completion, if user hasn't completed the case wizard tour, `setupAndStartTour()` launches an interactive guided tour of the evaluation UI using **Shepherd.js** — see [`core_ui_implementation_reference.md` §1](../core_ui_implementation_reference.md#1-shepherd-post-wizard-tour-tourjs) (`tour.js`).

---

## 15. Keyboard & Interaction Patterns

### Drag-and-Drop
- Query rows are **draggable** when sort mode is "Default" (manual order)
- Uses SortableJS via the Stimulus `queries-list` controller with a handle element
- On drop: calculates new position accounting for pagination offset
- Sends position update to backend
- Disabled when any sort mode other than "Default" is active

### Text Paste
- `attachTextPaste` (`utils/text_paste`) captures paste events on the add-query input
- Used for bulk query input (paste multiple queries separated by newlines; they are converted to `;`-separated text)

### Modal Patterns
Modals are Bootstrap 5 modals opened by Stimulus controllers through `utils/bs_modal.js` / `utils/dynamic_modal.js` (`openDynamicModal({ templateId, size, windowClass })`), which clone a `<template>` and return the modal element. `showStackedModal` handles a modal opened over another.

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
- Rating popovers (individual and bulk): the `rating-popover` controller, built on `createBsPopover` (`utils/bs_popover.js`), closing on outside click
- Match explain details: `match-explain` controller, popover placed left
- Tooltips: `bs-tooltip` controller / `utils/bs_tooltip.js` with configurable delay and placement

### Libraries and UI Building Blocks
| Component | Source | Usage |
|-----------|--------|-------|
| CodeMirror 6 | `modules/editor.js` | Query Sandbox, query options, missing-documents finder, JSON editors |
| Bootstrap 5 Modal | `utils/bs_modal.js`, `utils/dynamic_modal.js` | All modal dialogs |
| Bootstrap 5 Popover / Tooltip | `utils/bs_popover.js`, `utils/bs_tooltip.js`; `bs-popover`, `bs-tooltip`, `rating-popover` controllers | Rating popovers, match explain, help icons, tooltips |
| Bootstrap 5 Collapse / progress | Bootstrap | Match explain bars and "show more", Settings subsections |
| SortableJS | `queries-list` controller | Query drag-and-drop reordering |
| Clipboard helper | `utils/clipboard.js` | Copy query text |
| Flash messages | `flash` controller, `utils/core_flash.js` | Success/error messages |
| Wizard | `wizard`, `wizard-launcher` controllers, `utils/wizard_contracts` | Multi-step onboarding wizard |
| Shepherd.js | `tour.js` | Post-wizard guided tour |
| Vega-Lite | `utils/qgraph.js`, frog report | QGraph and reports |
| JSON explorer | `json-explorer` controller, `utils/json_explorer.js` | Detailed doc fields, query/match explain, object/array field values |
| Relative timestamps | `Intl.RelativeTimeFormat` | Annotation timestamps |

---

## 16. State Management Architecture

### Stores and Runtime Modules
State lives in plain-JS stores (`app/javascript/stores/`, reached through `getCoreStores()` in `utils/core_store_access.js`) and in module runtimes reached through `getCoreCapabilities()` (`utils/core_capability_access.js`). Stimulus controllers render from these and dispatch commands; they do not own case state. Key pieces:

| Piece | Primary State | Persistence |
|-------|--------------|-------------|
| Live-query runtime (`live_query_*.js`, owner: `live_query_runtime_owner.js`) | Live Query objects (search, ratings, scoring), display order | API-backed |
| `stores.queries` (query collection store) | Query membership, order, expanded/collapsed state, search generations | In-memory (session) |
| `stores.documents` | Read model of each query's documents for the results renderer | In-memory |
| `stores.scoring` | Latest case score info and per-query scores | In-memory |
| `stores.diff` | Selected snapshot comparisons | In-memory (session) |
| Case / settings / navigation capabilities | Selected case, tries, current try (`settings.editable()`), URLs | API-backed |
| Scorer runtime (`scorer_runtime.js`) | Default scorer, scale, colors | API-backed |
| `doc_cache.js` | Cached document details | In-memory |
| `configuration_runtime.js` | Feature flags (communal-only, sortable) | In-memory |
| Book sync (`book_sync.js`) | Synced query-doc pairs cache | In-memory |

### Change Detection
- **Version counters**: `ratingsStore.version()` and each query's local version feed `query.version()`, which `score()` compares against `lastScoreVersion`
- **Publish/subscribe**: the runtime publishes plain read models into the stores; controllers subscribe to store changes and re-render
- **DOM events**: cross-module communication uses `CustomEvent`s on `document`

### Key Events

| Event | Trigger | Consumers |
|-------|---------|-----------|
| `rating-changed` (scoring store) / `ratings:changed` (document) | Any document rating changes | Live-query events runtime (invalidate rated docs, republish, rescore) |
| `scoring-complete` (scoring store) | All queries scored | `qscore-case` (persists the case score, refreshes diff scores) |
| `case-score:persisted` | Case score saved via `PUT api/cases/{caseId}/scores` | Listeners such as the score-history graph (`qgraph`) |
| `queries-state:changed` | Query list/score state published | `add-query` (and other query list state consumers) |
| `query-options:saved` | Query options saved | Live-query events runtime (set options, rescore) |
| `pick-scorer:selected` | Scorer chosen in the modal | Live-query events runtime (set scorer, rescore) |
| `judgements:queries-need-reload`, `imports:queries-need-reload` | Judgements or ratings imports finished | Live-query events runtime (reset, re-bootstrap, `searchAll`) |
| `judgements:book-settings-saved` | Book settings saved in the judgements modal | Live-query events runtime (reconfigure book sync); `core_runtime.js` (update `caseState` book) |
| `query-diffs:refreshed` | Diff scoring recomputed | `qscore-case` |
| `core-bootstrap:ready` / `core-bootstrap:failed` | Case bootstrap finished / failed | `case-toolbar` (ready); tests read `window.quepidCoreBootstrap` |
| `quepid:case-selected` | Case selected | `core_runtime.js` (updates `caseState`) |
| `toggleEast` | Tune Relevance link | `pane` controller |

Scorer selection (`pick-scorer-core` Stimulus modal) loads lists via `api/scorers` and saves via `PUT api/cases/:id/scorers/:id`, then dispatches `pick-scorer:selected` so the live-query runtime can rescore.

### Bootstrapping Sequence

```
core.html.erb renders /case/{caseNo}/try/{tryNo} with a core-bootstrap element
    ↓
core-bootstrap controller → bootstrap()
    ↓
create the live-query runtime; configuration.setCommunalScorersOnly / setQueryListSortable / setCaseNo / setTryNo
    ↓
user.loadCurrent()
    ↓
if the case changed → reset query state
    ↓
case.load(caseNo) → fetch case data; case.select(acase)
settings.setCaseTries(tries); settings.setCurrentTry(tryNo)   (tryNo defaults to the case's last try)
    ↓
mixed-content check (search URL protocol vs Quepid's, unless proxied) → "Blocked Request" error
    ↓
if the case changed → reset the diff store, empty docCache, scoring.bootstrap(caseNo)
if the case or search endpoint changed → disable diffs, docCache.invalidate()
    ↓
docCache.update(settings) → pre-fetch cached docs
    ↓
queryCapabilities.changeSettings(caseNo, settings)
    ↓
case.trackLastViewedAt(caseNo); dispatch core-bootstrap:ready
    ↓
queryCommands.searchAll() → execute all queries against search engine
    ↓
flash "All queries finished successfully!" or "Some queries failed to resolve!"
```

If there is no case (`caseNo === 0`) the page shows "You don't have any Cases created in Quepid..." and dispatches `core-bootstrap:failed`. Other failures show flash errors for blocked requests, an unreachable case, or a missing try number.

### Document Cache (`doc_cache.js`)
- Caches document details fetched from search engines (for snapshot viewing and rated doc display)
- `addIds(moreIds)` — register doc IDs to fetch
- `update(settings)` — batch fetch all missing docs via the splainer-search `docResolverSvc` (15-doc batches)
- `invalidate()` — mark all as unfetched (but keep IDs)
- `empty()` — clear entire cache
- Used when hydrating snapshot results

### Synced Pairs Cache
- `createBookSyncRuntime()` (`utils/book_sync.js`) keeps a per-book cache of query-doc pairs already synced to a Book
- Prevents duplicate sync operations
- Reset when the case or book changes

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
Requests made through `apiFetch` ([`api/fetch.js`](../../app/javascript/api/fetch.js)) include the `X-CSRF-Token` header.

---

## 18. Known Technical Debt

### `new Function` for Scorer Execution
Client-side scorers run via `new Function(...)` scheduled with `queueMicrotask`. This:
- Has no sandboxing — scorer code has full access to the page and DOM
- Is a significant security concern (XSS vector if scorers are shared)
- Can't be killed if it runs too long (there is no timeout)

### `new Function()` for Mapper Code
SearchAPI mapper code evaluated via `new Function()` constructor in non-strict mode:
- Sets functions on `window` object globally
- No sandboxing or isolation
- Error handling is try/catch around eval

### jQuery Dependencies
- The `pane` controller uses plain DOM APIs (no jQuery)
- Query drag-and-drop is owned by the Stimulus `queries-list` controller and uses SortableJS

### Hardcoded Constants
- 15 queries per page (hardcoded)
- 10 default documents per scorer iteration (DEFAULT_NUM_DOCS)
- 450px east pane width
- 5 maximum snapshot comparisons
- 200-character preview for try query params

### Missing Features (in Code but Incomplete)
- No scorer execution timeout (the old Web Worker prototype was dropped)
- `recordDepthOfRanking` — depth tracking is appended to scorer code but not surfaced in all UI contexts

---

## 19. Visual Design & Styling

### Color Systems

**Rating Scale Colors** (default scale, hardcoded hex values in `ratingBackgroundColor()` in `utils/scoring.js`):

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

**Query Score Colors** (`scoreToColor()` in `utils/scoring.js`, HSL gradient):
- Uses an 11-step HSL table (keyed -1 to 10) from `hsl(0, 100%, 40%)` (red) to `hsl(100, 90%, 35%)` (dark green)
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
- **Froggy animation**: `flipInX` / `flipOutX` transitions (2s duration)
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

Comprehensive HTTP status code mapping (100+ codes mapped to human-readable names). The framework-free utility is exposed to the case runtime through `quepidSearch.searchErrors`. Error responses are parsed in this priority:

1. `response.data.error` (object: extract message; string: use directly)
2. `response.statusText`
3. `response.reason`
4. Mapped status code name

**Special Cases**:
- **CORS failure** (`response.status === -1`): Suggests URL typo checking, CORS enablement, and ad blocker detection
- **Solr-specific**: Custom error message with link to direct Solr instance inspection and troubleshooting wiki for Solr 8.4.1+ `X-Content-Type-Options: nosniff` compatibility issues
- Error text rendered as HTML in a red `alert alert-danger` div within each query row

### Bootstrap Error Handling and Search Engine Change Detection
`core-bootstrap` compares the search URL of the old and new try (`searchEngineChanged`) to decide whether to reset diffs and invalidate the doc cache. Bootstrap failures are surfaced as flash messages that differentiate:
- Mixed-content / TLS errors ("Blocked Request", with a link to the endpoint edit page)
- Case not found or not shared errors ("Could not retrieve case ...")
- Missing try number
- Generic load errors

---

## 21. Book Sync Integration

The query evaluation page integrates with the Book (judgment collection) system:

### Sync Flow (`createBookSyncRuntime().sync()` in `utils/book_sync.js`)
1. On case load, `GET api/cases/{caseNo}` supplies `book_id` and `auto_populate_book_pairs`; saving book settings in the judgements modal (`judgements:book-settings-saved`) updates them in place; syncing only happens when `auto_populate_book_pairs` is true
2. Builds query-doc pairs from current query results, each containing:
   - `query_text`, `doc_id`, `position` (1-based counter)
   - `document_fields`: extracted title, thumb, image, and other field values
3. Checks the synced-pairs cache to filter to **only unsynced pairs** (keyed by `"queryText:docId"`)
4. **Batches by 100 queries** per API call, sent concurrently
5. For each batch: `populateBook()` → `PUT /api/books/{bookId}/populate` with `{case_id, query_doc_pairs}`
6. **Optimistic caching**: Marks pairs in cache *before* API confirmation
7. On error: removes failed pairs from cache (allowing retry) and logs
8. Cache methods: `clearSyncCache(bookId)`, `getSyncCacheStats(bookId)`
9. Cache cleared entirely when the case or book changes

### Field Mapping in `buildQueryDocPairsPayload()`

`utils/book_sync.js` performs detailed field extraction when building document payloads:

| Field | Source | Logic |
|-------|--------|-------|
| **General fields** | `doc.subsList` | Iterates `{field, value}` entries into flat `fields` map |
| **Title** | `doc.title` | Always written. If `doc.doc.title` differs from `doc.title` (raw title vs display title), saves raw as `fields['title_field']` to prevent overwrite |
| **Thumbnail** | `doc.thumb` | If `doc.thumb_options?.prefix` exists, prepends: `${prefix}${thumb}`. Otherwise raw thumb URL |
| **Image** | `doc.image` | Same prefix-wrapping pattern as thumbnail: `${prefix}${image}` |

### Refresh from Book (frog report controller)
- PUTs to `api/books/{bookId}/cases/{caseId}/refresh`
- The URL comes from the `data-frog-report-refresh-url-template` body attribute (`__BOOK_ID__`, `__CASE_ID__`, `__BACKGROUND__` placeholders)
- If the case has ≥50 queries, runs in background mode (`process_in_background=true`), shows "Ratings are being refreshed in the background." and redirects to the Quepid root
- Otherwise it calls `queryLifecycle.refreshQueries(caseNo)` to reload the queries and shows "Ratings have been refreshed."
- Failures show "An error (...) occurred, please try again." in the modal; the button is only shown when the case has a book

---

## 22. Doc ID Validation & Edge Cases

### Two-Tier Document ID Validation (`createDocList` in `live_query_runtime_owner.js`)

When creating rateable docs from search results, the doc-list builder validates document IDs:

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
There is no `awaitRatedDocs()`. Rated documents are loaded by `refreshRatedDocs(pageSize)` in `utils/query_runtime.js`:
- `query.ratingsReady` is set to `true` once the rated-docs lookup finishes (and reset to `false` when ratings change)
- `query.ratingsPromise` de-duplicates concurrent calls; a `ratingsGeneration` counter makes a stale response re-run the lookup if ratings changed while it was in flight
- SearchAPI (mapper-based) engines use `searchApiRatedDocs`, and end up with no rated docs when the endpoint doesn't support rated-docs lookup (`ratedDocsUnsupported`)
- Turning on "Show Only Rated" triggers `refreshRatedDocs` for every query whose `ratingsReady` is false
- The scorer's `bestDocs` come from the `ratingsStore` (see §5), so scoring does not wait on this lookup; only `eachRatedDoc` and the rated view depend on `ratedDocs`

---

## 23. Implementation reference (file inventory)

File-level inventories and internals change quickly, so they are not duplicated in this behavior-focused doc.

**Canonical source for remaining work:** [`todo.md`](./todo.md#frontend-cleanup-after-angular-removal)

**Read source for deep internals:** [`core_stimulus.js`](../../app/javascript/core_stimulus.js) (registered controllers), `core_bootstrap_controller.js`, `live_query_runtime_owner.js`, `query_service.js`, `query_scoring.js`, `scorer_runtime.js`, `diff_results.js`, `core_controller.rb`, `tour.js`.

**Hybrid Stimulus on case pages:** Book bulk judging uses `bulk_judgement_controller.js`; see [`core_ui_implementation_reference.md` §4](../core_ui_implementation_reference.md#4-bulk_judgement_controller-stimulus) and [`DEVELOPER_GUIDE.md` § Stimulus HTTP conventions](../../DEVELOPER_GUIDE.md#stimulus-http-conventions).

**Deep internals** (tour steps, `queriesSvc` quirks, TryFactory map, bulk judgement states, Rails controller edge cases): [`core_ui_implementation_reference.md`](../core_ui_implementation_reference.md).

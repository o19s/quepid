# Turbo Frame Boundaries

> **Related documentation:** See [Workspace State Design](workspace_state_design.md) for server/client state boundaries and [Turbo Streams Guide](turbo_streams_guide.md) for stream action patterns.

---

## 1. Workspace Content (Query List + Results Pane)

| Attribute | Value |
|-----------|-------|
| **Frame ID** | `workspace_content` |
| **Location** | `app/views/core/show.html.erb` |
| **Layout** | Wraps the row containing query list and results pane |
| **Status** | Implemented |

**Details:**
- Wraps both query list and results pane so query selection uses Turbo Frame navigation instead of full-page reload.
- Query links target this frame; Turbo replaces only the workspace content, keeping header/sidebar intact.
- See [ViewComponent Conventions](view_component_conventions.md) for component structure.

---

## 2. Query List (Left Pane)

| Attribute | Value |
|-----------|-------|
| **Frame ID** | `query_list_<case_id>` |
| **Location** | `app/components/query_list_component.html.erb` |
| **Layout** | `core/show` → `col-md-4 col-lg-3` (inside `workspace_content`) |
| **Status** | Implemented |

**Details:**
- Wrapped in `turbo_frame_tag "query_list_#{case_id}"` (case-specific for Turbo Stream targeting).
- Renders list of queries with QscoreQuery, MoveQuery, QueryOptions, QueryExplain, DeleteQuery per row.
- See [ViewComponent Conventions](view_component_conventions.md) for component structure.
- Selection via link to same page with `?query_id=`; uses `data-turbo-frame="workspace_content"` so only the workspace content updates (no full-page reload).
- **Turbo Streams:** Add/remove queries via Turbo Streams (`append` to `query_list_items`, `remove` `query_row_<id>`). Real-time score updates via `RunCaseEvaluationJob` broadcasts `replace` for entire frame. See section 7 for detailed implementation patterns.
- **Client-side features** (via `query_list_controller.js`):
  - **Pagination:** Client-side pagination (default 15 per page) with URL state (`?page=`).
  - **Filtering:** Text filter + "Rated only" toggle; filters client-side DOM visibility.
  - **Sorting:** Multiple sort options (name A-Z/Z-A, score ↑↓, modified ↑↓, errors first) with URL state (`?sort=`).
  - **Drag-and-drop reorder:** SortableJS integration; persists order via `PUT api/cases/:caseId/queries/:queryId/position`.
  - **Expand/collapse all:** Buttons to expand or collapse all query rows at once.
  - **Score refresh:** Listens for `query-score:refresh` events; fetches lightweight score updates per query without full re-evaluation.
- **MutationObserver:** Watches for Turbo Stream additions/removals to maintain pagination and original order snapshot.

---

## 3. Results List (Main Pane)

| Attribute | Value |
|-----------|-------|
| **Frame ID** | `results_pane` |
| **Location** | `app/components/results_pane_component.html.erb` |
| **Layout** | `core/show` → `col-md-8 col-lg-9` |
| **Status** | Implemented |

**Details:**
- Wrapped in `turbo_frame_tag "results_pane"`.
- Shows selected query context, notes/information need form, and placeholder for search results.
- See [ViewComponent Conventions](view_component_conventions.md) for component structure.
- **Query notes form** (`query_notes_<query_id>`): submits via Turbo Frame; server returns HTML to replace the form region without full-page reload. See section 7 for detailed implementation.
- When no query selected: prompt "Select a query from the list".
- **Results fetching:** Via `results_pane_controller.js` using `fetch()` with `Accept: text/html`. Server renders DocumentCardComponent + MatchesComponent. Results are not lazy-loaded via frame `src`; controller manages fetch lifecycle.
- **Rating updates:** Individual ratings can return Turbo Streams (`update` action for `rating-badge-<doc_id>`) when requested with `Accept: text/vnd.turbo-stream.html`. See section 7 for detailed implementation patterns.
- **Bulk rating:** Bulk rate/clear operations via `PUT api/cases/:caseId/queries/:queryId/bulk/ratings` and `POST .../bulk/ratings/delete`. Triggers score refresh and re-fetches results.
- **Diff mode:** Supports `diff_snapshot_ids[]` query params; server renders diff badges on document cards. Listens for `diff-snapshots-changed` events.
- **Show only rated filter:** Toggle to filter results to show only documents with ratings.
- **Pagination:** "Load more" button appends next page of results (default 10 per page).
- **Detail modal:** Bootstrap modal showing document fields and raw JSON (with CodeMirror viewer when available).

---

## 4. Side Panels (Query List West, Results East)

| Attribute | Value |
|-----------|-------|
| **Controller** | `workspace_panels_controller.js` |
| **Location** | `app/views/core/show.html.erb` |
| **Status** | Implemented |

**Details:**
- **West panel:** Query list (QueryListComponent). Collapsible via chevron button; state persisted in localStorage per case.
- **East panel:** Results pane (ResultsPaneComponent). Collapsible via chevron button; state persisted in localStorage per case.
- **Legacy Angular:** Had "Tune Relevance" / dev settings (`devQueryParams`, `_dev_settings.html`) and scorer picker (`pick_scorer.html`) as side panels.
- **Current modern stack:** Scorer, Settings, Chart panels are in the toolbar (Bootstrap collapse). Query list and results are collapsible east/west side panels. Annotations panel is a Bootstrap collapse below the workspace (collapsed by default for visual parity with Angular).
- **Future:** For additional panels (e.g. snapshot list), wrap each in its own Turbo Frame with `loading="lazy"` and `src` pointing to a dedicated endpoint.

---

## 5. Modals

| Modal | Component | Frame Strategy | Status |
|-------|-----------|----------------|--------|
| Clone Case | CloneCaseComponent | In-page Bootstrap modal | Implemented |
| Export Case | ExportCaseComponent | In-page Bootstrap modal | Implemented |
| Import Ratings | ImportRatingsComponent | In-page Bootstrap modal | Implemented |
| Delete Case Options | DeleteCaseOptionsComponent | In-page Bootstrap modal | Implemented |
| Share Case | ShareCaseComponent / shared partial | In-page Bootstrap modal | Implemented |
| Judgements | JudgementsComponent | In-page Bootstrap modal | Implemented |
| Frog Report | FrogReportComponent | In-page Bootstrap modal | Implemented |
| Diff | DiffComponent | In-page Bootstrap modal | Implemented |
| Delete Query | DeleteQueryComponent | In-page Bootstrap modal | Implemented |
| Move Query | MoveQueryComponent | In-page Bootstrap modal | Implemented |
| Query Options | QueryOptionsComponent | In-page Bootstrap modal | Implemented |
| Query Explain | QueryExplainComponent | In-page Bootstrap modal | Implemented |
| Delete Case | DeleteCaseComponent | In-page Bootstrap modal | Implemented |
| Edit Annotation | AnnotationsComponent | In-page Bootstrap modal | Implemented |
| Expand Content | ExpandContentComponent | In-page Bootstrap modal | Implemented |
| Matches (debug) | MatchesComponent | In-page Bootstrap modal | Implemented |
| Books modal | `books/show` | `turbo_frame_tag "modal"` | Lazy-loaded |

**Details:**
- Most modals are **in-page Bootstrap modals** rendered with the page; Stimulus controllers handle open/close.
- **Turbo Frame modals:** Use `target="_top"` for links/forms that should affect the whole page (e.g. redirect after submit). For lazy-loaded modals, use `turbo_frame_tag "modal"` with `src` (see `app/views/books/show.html.erb`).
- **Recommendation:** For heavy modals (e.g. Judgements with large content), consider lazy-loading via `src` on a Turbo Frame. Form submits can return Turbo Streams to close modal and update parent frames.
- See [UI Consistency Patterns](ui_consistency_patterns.md) for modal patterns and Bootstrap 5 conventions.

---

## 6. Other Frames (Outside Core Workspace)

| Frame ID | Location | Purpose |
|----------|----------|---------|
| `dropdown_cases` | `layouts/_header.html.erb` | Lazy-loaded recent cases in navbar dropdown |
| `dropdown_books` | `layouts/_header.html.erb` | Lazy-loaded recent books in navbar dropdown |
| `modal` | `books/show.html.erb` | Lazy-loaded modal content for judgements |
| `book_frame_<id>` | `home/_book_summary.html.erb` | Per-book summary on dashboard |
| `case_frame_<id>` | `home/_case_summary.html.erb` | Per-case prophet on dashboard |
| `sparklines_tray` | `home/sparklines.html.erb` | Sparklines region |
| `query_doc_pair_card` | `judgements/edit.html.erb`, `new.html.erb` | Judgement card in book flow |

### 6.1 Lazy Loading (`loading="lazy"`)

All Turbo Frames that use `src` to fetch content include `loading="lazy"` so content is deferred until the frame is near the viewport. This improves initial page load and reduces server load for non-critical regions.

| Frame | Location | Notes |
|-------|----------|-------|
| `dropdown_cases` | `layouts/_header.html.erb` | Navbar dropdown; loads when user opens menu |
| `dropdown_books` | `layouts/_header.html.erb` | Navbar dropdown; loads when user opens menu |
| `book_frame_<id>` | `home/_book_summary.html.erb` | Per-book summary on dashboard |
| `case_frame_<id>` | `home/_case_summary.html.erb` | Per-case prophet on dashboard |

**When adding new lazy-loaded frames:** Use `src="<%= some_path %>" loading="lazy"` (or `turbo_frame_tag "id", src: path, loading: :lazy`). The server response must return HTML containing a matching `<turbo-frame id="...">`.

---

## 7. Turbo Streams & Server Responses

See [turbo_streams_guide.md](turbo_streams_guide.md) for actions, client/server patterns, and use cases. Server responses: frame navigation returns HTML with matching `<turbo-frame id>`; Turbo Streams return `Content-Type: text/vnd.turbo-stream.html`.

**For detailed implementation patterns and code examples**, see [Turbo Streams Guide - Primary Use Cases](turbo_streams_guide.md#2-primary-use-cases-in-the-core-workspace).

### Implemented Turbo Stream Flows (workspace-specific)

> **Note:** This section provides workspace-specific context (which frames are updated). For general Turbo Stream patterns and code examples, see [turbo_streams_guide.md](turbo_streams_guide.md).

- **Add query** (single): `Core::QueriesController#create` → `append` to `query_list_items`, `remove` `query_list_empty_placeholder` when adding first query. Add query Stimulus controller POSTs with `Accept: text/vnd.turbo-stream.html` and applies response via `Turbo.renderStreamMessage`.
- **Delete query**: `Core::QueriesController#destroy` → `remove` `query_row_<id>`; when deleted query was selected (`?selected_query_id=`), also `replace` `results_pane` with empty state. Delete query Stimulus controller DELETEs with Turbo Stream accept header and applies response.
- **Query notes form**: `Core::Queries::NotesController#update` → form submits via Turbo Frame (`query_notes_<query_id>`); server returns HTML with matching frame to replace form region (no full-page reload).
- **Rating update**: `Api::V1::Queries::RatingsController#update` → `update` action for `rating-badge-<doc_id>` when requested with `Accept: text/vnd.turbo-stream.html`. Results pane controller requests Turbo Stream format and applies via `Turbo.renderStreamMessage`. Falls back to JSON + manual DOM update. Triggers `query-score:refresh` event for lightweight score update.
- **Rating delete**: `Api::V1::Queries::RatingsController#destroy` → similar to update; can return Turbo Stream to update badge or flash error.

### Real-Time Updates (Implemented)

The core workspace subscribes to `turbo_stream_from(:notifications)` in `core/show.html.erb`. `RunCaseEvaluationJob` broadcasts Turbo Stream `replace` actions for `qscore-case-#{case_id}` and `query_list_#{case_id}` when scoring completes. See [turbo_streams_guide.md](turbo_streams_guide.md) for the full pattern.

**Score refresh mechanism:**
- **Lightweight per-query refresh:** After rating updates, `triggerScoreRefresh()` dispatches `query-score:refresh` event. Query list controller listens and fetches `POST api/cases/:caseId/queries/:queryId/score` to update individual query score badges without full case re-evaluation (see section 2 for client-side implementation).
- **Full case evaluation:** Debounced (3s) trigger to `POST api/cases/:caseId/run_evaluation?try_number=...` which queues `RunCaseEvaluationJob`. Job broadcasts Turbo Stream updates when complete.

---

## 8. Turbo Events + Stimulus

The `turbo_events_controller` (attached to `<body>` in both `application` and `core_modern` layouts) listens for Turbo lifecycle events:

| Event | Purpose |
|-------|---------|
| `turbo:before-fetch-request` | Add `turbo-loading` class to frame/form for loading state |
| `turbo:before-fetch-response` | Clear loading when response arrives |
| `turbo:frame-render` | Clear loading after frame content renders |
| `turbo:submit-end` | Clear form loading; show flash error if `success: false` |
| `turbo:fetch-request-error` | Clear loading and show error on network failure |

`turbo.css` (included in both application and core bundles) styles `turbo-frame.turbo-loading` and `form.turbo-loading button[type="submit"]` for visual feedback.

---

## When to Use `data: { turbo: false }`

Use `data: { turbo: false }` **only when necessary**:

- **File downloads** — Export buttons that trigger a download (e.g. `books/export.html.erb`)
- **OAuth / external redirects** — Login, signup, OAuth callbacks (e.g. `sessions/new.html.erb`)
- **Legacy forms** — Some forms may require full POST (e.g. mixed HTTP/HTTPS; see `application_helper.rb`)

**Do not use** for normal navigation links (navbar brand, "View all cases", create case). Let Turbo Drive handle them when enabled.

For URL building rules (never hardcode `/`; use `getQuepidRootUrl()` or Rails helpers), see [API Client Guide](api_client.md).

---

## Summary

| Boundary | Frame ID | Implemented | Notes |
|----------|----------|-------------|-------|
| Workspace content | `workspace_content` | Yes | Query selection; wraps query list + results pane |
| Query list | `query_list_<case_id>` | Yes | Turbo Streams for add/remove/reorder; pagination, filtering, sorting, drag-and-drop; per-row id `query_row_<id>` |
| Results pane | `results_pane` | Yes | JavaScript fetch (not `src`); Turbo Streams for rating updates; bulk rating, diff mode, show only rated filter, load more pagination |
| Side panels | TBD | No | Deferred; use lazy `src` when added |
| Modals | Various | Yes (Bootstrap) | Consider Turbo Frame + lazy `src` for heavy modals |

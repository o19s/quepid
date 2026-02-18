# Turbo Frame Boundaries

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
- Selection via link to same page with `?query_id=`; uses `data-turbo-frame="workspace_content"` so only the workspace content updates (no full-page reload).
- **Future:** Turbo Streams for add/remove/reorder without full reload.

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
- **Query notes form** (`query_notes_<query_id>`): submits via Turbo Frame; `Core::Queries::NotesController#update` returns HTML to replace the form region without full-page reload.
- When no query selected: prompt "Select a query from the list".
- Document cards with ratings, pagination (Load more), and Debug/Expand explain buttons are implemented via DocumentCardComponent + MatchesComponent (server-rendered when Accept: text/html) or results_pane Stimulus controller (JSON fallback, e.g. diff mode).

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
- **Current modern stack:** Scorer, Settings, Chart panels are in the toolbar (Bootstrap collapse). Query list and results are collapsible east/west side panels.
- **Future:** For additional panels (e.g. annotations drawer, snapshot list), wrap each in its own Turbo Frame with `loading="lazy"` and `src` pointing to a dedicated endpoint.

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

### Implemented Turbo Stream Flows (workspace-specific)

- **Add query** (single): `Core::QueriesController#create` → append to `query_list_items`, remove `query_list_empty_placeholder` when adding first query. Add query Stimulus controller POSTs with `Accept: text/vnd.turbo-stream.html` and applies response via `Turbo.renderStreamMessage`.
- **Delete query**: `Core::QueriesController#destroy` → remove `query_row_<id>`; when deleted query was selected (`?selected_query_id=`), also replace `results_pane` with empty state. Delete query Stimulus controller DELETEs with Turbo Stream accept header and applies response.
- **Query notes form**: `Core::Queries::NotesController#update` → form submits via Turbo Frame (`query_notes_<query_id>`); server returns HTML with matching frame to replace form region (no full-page reload).

### Real-Time Updates (Implemented)

The core workspace subscribes to `turbo_stream_from(:notifications)` in `core/show.html.erb`. `RunCaseEvaluationJob` broadcasts Turbo Stream `replace` actions for `qscore-case-#{case_id}` and `query_list_#{case_id}` when scoring completes. See [turbo_streams_guide.md](turbo_streams_guide.md) for the full pattern.

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

CSS in `application.css` and `core-add.css` styles `turbo-frame.turbo-loading` and `form.turbo-loading button[type="submit"]` for visual feedback.

---

## When to Use `data: { turbo: false }`

Use `data: { turbo: false }` **only when necessary**:

- **File downloads** — Export buttons that trigger a download (e.g. `books/export.html.erb`)
- **OAuth / external redirects** — Login, signup, OAuth callbacks (e.g. `sessions/new.html.erb`)
- **Legacy forms** — Some forms may require full POST (e.g. mixed HTTP/HTTPS; see `application_helper.rb`)

**Do not use** for normal navigation links (navbar brand, "View all cases", create case). Let Turbo Drive handle them when enabled.

---

## Summary

| Boundary | Frame ID | Implemented | Notes |
|----------|----------|-------------|-------|
| Workspace content | `workspace_content` | Yes | Query selection; wraps query list + results pane |
| Query list | `query_list_<case_id>` | Yes | Turbo Streams for add/remove; per-row id `query_row_<id>` |
| Results pane | `results_pane` | Yes | Add `src` + Turbo Streams when API wired |
| Side panels | TBD | No | Deferred; use lazy `src` when added |
| Modals | Various | Yes (Bootstrap) | Consider Turbo Frame + lazy `src` for heavy modals |

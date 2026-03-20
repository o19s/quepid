# Turbo frame boundaries

> **Scope:** Map of Turbo Frame IDs, where they live in the app, and how they interact with Stimulus and Turbo Streams when building the Rails core workspace. Align names with your actual partials and layouts. This is a **design reference** for [angularjs_elimination_plan.md](./angularjs_elimination_plan.md) slices—not a description of the Angular workspace on `main` today.
>
> **Related:** [Workspace state design](./workspace_state_design.md), [Turbo streams guide](turbo_streams_guide.md). App layout overview: [docs/app_structure.md](../app_structure.md).

---

## 1. Workspace Content (Query List + Results Pane)

| Attribute | Value |
|-----------|-------|
| **Frame ID** | `workspace_content` |
| **Location** | Core workspace template (e.g. `app/views/core/show.html.erb`) |
| **Layout** | Wraps the row containing query list and results pane |

**Details:**
- Wraps both query list and results pane so query selection can use Turbo Frame navigation instead of full-page reload.
- Query links target this frame; Turbo replaces only the workspace content, keeping header/sidebar intact.
- Use Rails partials (or optional ViewComponents if the team adopts them per elimination plan) consistently within each slice.

---

## 2. Query List (Left Pane)

| Attribute | Value |
|-----------|-------|
| **Frame ID** | `query_list_<case_id>` |
| **Location** | Query list template (partial or component under `app/views` / `app/components`) |
| **Layout** | Narrow column inside `workspace_content` (e.g. `col-md-4 col-lg-3`) |

**Details:**
- Wrapped in `turbo_frame_tag "query_list_#{case_id}"` (case-specific for Turbo Stream targeting).
- Renders the list of queries with per-row actions (move, options, explain, delete, etc.) as your markup allows.
- Selection via link to the same page with `?query_id=`; use `data-turbo-frame="workspace_content"` so only the workspace content updates (no full-page reload).
- **Turbo Streams:** Add/remove queries via Turbo Streams (`append` to `query_list_items`, `remove` `query_row_<id>`). Real-time score updates may `replace` the whole frame when a job completes. See [turbo_streams_guide.md](turbo_streams_guide.md) and §7 below.
- **Typical client-side behavior** (often a Stimulus controller such as `query_list_controller.js`) — **mirror Angular parity first**, then evolve:
  - **Pagination / filtering / sorting:** Match today’s query list UX (Angular uses client pagination in places; elimination plan also allows server-driven Pagy for large cases). Do not assume `?page=` on the URL unless your slice intentionally matches that model.
  - **Drag-and-drop reorder:** e.g. SortableJS; persist order via your cases/queries position API.
  - **Expand/collapse all:** Controls to expand or collapse all query rows.
  - **Score refresh:** Listen for custom events (e.g. `query-score:refresh`); fetch lightweight score updates per query without full re-evaluation when that fits your API.
- **MutationObserver:** Useful to watch Turbo Stream DOM changes so pagination and ordering state stay consistent.

---

## 3. Results List (Main Pane)

| Attribute | Value |
|-----------|-------|
| **Frame ID** | `results_pane` |
| **Location** | Results pane template (partial or component) |
| **Layout** | Wider column (e.g. `col-md-8 col-lg-9`) inside `workspace_content` |

**Details:**
- Wrapped in `turbo_frame_tag "results_pane"`.
- Shows selected query context, notes / information-need form, and placeholder or live search results.
- **Query notes form** (`query_notes_<query_id>`): may submit via Turbo Frame; server returns HTML with a matching frame to replace the form region without full-page reload. See §7.
- When no query is selected: show a prompt such as “Select a query from the list”.
- **Results fetching (parity):** Same browser search model as [angularjs_elimination_plan.md](./angularjs_elimination_plan.md); optional server-rendered cards only with explicit scope ([intentional_design_changes.md](./intentional_design_changes.md) §2).
- **Rating updates:** Responses can use Turbo Streams (`update` for `rating-badge-<doc_id>`) when `Accept: text/vnd.turbo-stream.html`. See [turbo_streams_guide.md](turbo_streams_guide.md).
- **Bulk rating:** Bulk rate/clear via your bulk ratings endpoints; trigger score refresh and re-fetch results as needed.
- **Diff mode:** May use query params (e.g. `diff_snapshot_ids[]`); server renders diff UI on cards; listen for `diff-snapshots-changed` or equivalent events if you use them.
- **Show only rated:** Optional filter to limit results to rated documents.
- **Pagination:** “Load more” or similar to append the next page of results.
- **Detail modal:** Modal for document fields / raw JSON (e.g. with a code viewer when available).

---

## 4. Side Panels (Query List West, Results East)

| Attribute | Value |
|-----------|-------|
| **Controller** | e.g. `workspace_panels_controller.js` |
| **Location** | Core workspace template alongside the workspace row |

**Details:**
- **West panel:** Query list. Collapsible; state may persist in `localStorage` per case.
- **East panel:** Results pane. Collapsible; state may persist in `localStorage` per case.
- **Legacy Angular** used extra side regions (e.g. tune relevance, dev settings, scorer picker). In a Rails layout, scorer, settings, and chart UI often live in a toolbar (Bootstrap collapse), with query list and results as collapsible side regions. An annotations region may be a collapse below the workspace.
- **Adding panels:** For heavy or optional regions, consider a dedicated Turbo Frame with `loading="lazy"` and `src` pointing at an endpoint.

---

## 5. Modals

| Modal (examples) | Typical stack | Frame strategy | Notes |
|------------------|---------------|----------------|-------|
| Clone / export / import / share case, judgements, diff, query actions, annotations, etc. | Partial + Stimulus | In-page Bootstrap modal | Standard pattern |
| Books / judgements flows | Rails views | `turbo_frame_tag "modal"` | Lazy-loaded where the app already uses this pattern |

**Details:**
- Most modals are **in-page Bootstrap modals** rendered with the page; Stimulus handles open/close.
- **Turbo Frame modals:** Use `target="_top"` for links/forms that should affect the whole page (e.g. redirect after submit). For lazy-loaded modals, use `turbo_frame_tag "modal"` with `src` (see existing patterns such as `app/views/books/show.html.erb`).
- **Heavy modals:** Consider lazy-loading via frame `src`. Form submits can return Turbo Streams to close the modal and update parent regions.
- See [UI Consistency Patterns](ui_consistency_patterns.md) for modal patterns and Bootstrap conventions.

---

## 6. Other Frames (Outside Core Workspace)

| Frame ID | Location | Purpose |
|----------|----------|---------|
| `dropdown_cases` | `layouts/_header.html.erb` | Lazy-loaded recent cases in navbar dropdown |
| `dropdown_books` | `layouts/_header.html.erb` | Lazy-loaded recent books in navbar dropdown |
| `modal` | `books/show.html.erb` | Lazy-loaded modal content for judgements |
| `book_frame_<id>` | `home/_book_summary.html.erb` | Per-book summary on dashboard |
| `case_frame_<id>` | `home/_case_summary.html.erb` | Per-case summary on dashboard |
| `sparklines_tray` | `home/sparklines.html.erb` | Sparklines region |
| `query_doc_pair_card` | `judgements/edit.html.erb`, `new.html.erb` | Judgement card in book flow |

### 6.1 Lazy Loading (`loading="lazy"`)

Turbo Frames that use `src` to fetch content should include `loading="lazy"` so content is deferred until the frame is near the viewport. This improves initial load and reduces work for non-critical regions.

| Frame | Location | Notes |
|-------|----------|-------|
| `dropdown_cases` | `layouts/_header.html.erb` | Navbar dropdown; loads when user opens menu |
| `dropdown_books` | `layouts/_header.html.erb` | Navbar dropdown; loads when user opens menu |
| `book_frame_<id>` | `home/_book_summary.html.erb` | Per-book summary on dashboard |
| `case_frame_<id>` | `home/_case_summary.html.erb` | Per-case summary on dashboard |

**When adding new lazy-loaded frames:** Use `src="<%= some_path %>" loading="lazy"` (or `turbo_frame_tag "id", src: path, loading: :lazy`). The server response must return HTML containing a matching `<turbo-frame id="...">`.

---

## 7. Turbo Streams & Server Responses

See [turbo_streams_guide.md](turbo_streams_guide.md) for actions, client/server patterns, and use cases. Frame navigation returns HTML with a matching `<turbo-frame id>`; Turbo Streams use `Content-Type: text/vnd.turbo-stream.html`.

**Primary use cases** (workspace-oriented, names may match your controllers):

- **Add query:** `append` to `query_list_items`, `remove` `query_list_empty_placeholder` when adding the first query. Client POSTs with `Accept: text/vnd.turbo-stream.html` and applies the response via `Turbo.renderStreamMessage` when using fetch.
- **Delete query:** `remove` `query_row_<id>`; if the deleted query was selected, also `replace` `results_pane` with an empty state. Client DELETE with Turbo Stream `Accept` when applicable.
- **Query notes form:** Submit via Turbo Frame (`query_notes_<query_id>`); server returns HTML with the matching frame to replace the form region.
- **Rating update / delete:** `update` (or flash) for `rating-badge-<doc_id>` when `Accept: text/vnd.turbo-stream.html`; optional JSON fallback and manual DOM updates. May dispatch a lightweight score refresh event after rating changes.

### Real-time updates

Subscribe with `turbo_stream_from(:notifications)` (or your channel) in the layout or workspace view that should receive broadcasts. A case evaluation job may broadcast `replace` for targets such as `qscore-case-#{case_id}` and `query_list_#{case_id}`. Details: [turbo_streams_guide.md](turbo_streams_guide.md).

**Score refresh (conceptual):**
- **Lightweight per-query refresh:** After rating changes, dispatch an event the query list listens for; fetch a per-query score endpoint to update row badges without a full case run.
- **Full case evaluation:** Debounced trigger to your run-evaluation endpoint; the job broadcasts Turbo Stream updates when complete.

---

## 8. Turbo events + Stimulus

A small Stimulus controller on `<body>` (e.g. `turbo_events_controller`) can listen for Turbo lifecycle events:

| Event | Purpose |
|-------|---------|
| `turbo:before-fetch-request` | Add `turbo-loading` class to frame/form for loading state |
| `turbo:before-fetch-response` | Clear loading when response arrives |
| `turbo:frame-render` | Clear loading after frame content renders |
| `turbo:submit-end` | Clear form loading; show flash error if `success: false` |
| `turbo:fetch-request-error` | Clear loading and show error on network failure |

Style `turbo-frame.turbo-loading` and `form.turbo-loading button[type="submit"]` in app CSS (e.g. a `turbo.css` or equivalent) so loading states are visible.

---

## When to Use `data: { turbo: false }`

Use `data: { turbo: false }` **only when necessary**:

- **File downloads** — Export buttons that trigger a download (e.g. `books/export.html.erb`)
- **OAuth / external redirects** — Login, signup, OAuth callbacks (e.g. `sessions/new.html.erb`)
- **Legacy forms** — Some forms may require full POST (e.g. mixed HTTP/HTTPS; see `application_helper.rb`)

**Do not use** for normal navigation links (navbar brand, “View all cases”, create case). Let Turbo Drive handle them when enabled.

For URL building rules (never hardcode `/`; prefer server-passed URLs and a subpath-aware root), see [API client conventions](api_client.md).

---

## Summary

| Boundary | Frame ID | Notes |
|----------|----------|-------|
| Workspace content | `workspace_content` | Query selection; wraps query list + results pane |
| Query list | `query_list_<case_id>` | Turbo Streams for add/remove/reorder; client pagination/filter/sort; `query_row_<id>` |
| Results pane | `results_pane` | `fetch` + HTML (not necessarily lazy `src`); Turbo Streams for ratings; bulk rating, diff, load more |
| Side panels | (collapsible) | Stimulus + optional `localStorage` |
| Modals | Various | Mostly in-page Bootstrap; lazy `modal` frame where the app uses it |

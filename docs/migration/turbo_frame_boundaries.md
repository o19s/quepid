# Turbo frame boundaries

> **Scope:** Map of Turbo Frame IDs, where they live in the app, and how they interact with Stimulus and Turbo Streams when extending the Rails core case / try workspace. Align names with your actual partials and layouts. This is a **design reference** tied to the completed migration narrative in [old/angularjs_elimination_plan.md](./old/angularjs_elimination_plan.md)—**sections 1–5 and 7–8 are targets**, not a full description of how the workspace is wired today.
>
> **Related:** [Workspace state design](./workspace_state_design.md), [Turbo streams guide](turbo_streams_guide.md). App layout overview: [docs/app_structure.md](../app_structure.md).

**Implementation split**

- **Sections 1–5 and 7–8** describe **target** Hotwire boundaries for the core workspace. **Today:** the Stimulus case UI is `CoreController#index` → `app/views/core/index.html.erb`, which composes partials under `app/views/core/` (`_case_header`, `_action_bar`, `_query_list_shell`, `_settings_panel`, modals via `_action_bar_modals`, etc.) inside layout `app/views/layouts/core.html.erb` with `application_modern` (Turbo is loaded, but **`Turbo.session.drive` is `false`** in `app/javascript/application_modern.js`—use explicit frames, streams, or `fetch` rather than assuming full Drive navigation). That page does **not** yet wrap the workspace row in `workspace_content` / `query_list_<case_id>` / `results_pane` frames; those IDs are the **contract** when you introduce Turbo Frame navigation there.
- **Section 6** lists frames that **already exist** on `main` (navbar, home dashboard, books/judgements, sparklines route).

---

## 1. Workspace Content (Query List + Results Pane)

| Attribute | Value |
|-----------|-------|
| **Frame ID** | `workspace_content` |
| **Location** | Core workspace template (e.g. outer structure in `app/views/core/index.html.erb` once adopted) |
| **Layout** | Wraps the row containing query list and results pane |

**Details:**
- Wraps both query list and results pane so query selection can use Turbo Frame navigation instead of full-page reload.
- Query links target this frame; Turbo replaces only the workspace content, keeping header/sidebar intact.
- Use Rails partials consistently within each slice.

---

## 2. Query List (Left Pane)

| Attribute | Value |
|-----------|-------|
| **Frame ID** | `query_list_<case_id>` |
| **Location** | Query list template (today: `app/views/core/_query_list_shell.html.erb`; future framed variant under `app/views`) |
| **Layout** | Narrow column inside `workspace_content` (e.g. `col-md-4 col-lg-3`) |

**Details:**
- Wrapped in `turbo_frame_tag "query_list_#{case_id}"` (case-specific for Turbo Stream targeting).
- Renders the list of queries with per-row actions (move, options, explain, delete, etc.) as your markup allows.
- Selection via link to the same page with `?query_id=`; use `data-turbo-frame="workspace_content"` so only the workspace content updates (no full-page reload).
- **Turbo Streams:** Add/remove queries via Turbo Streams (`append` to `query_list_items`, `remove` `query_row_<id>`). Real-time score updates may `replace` the whole frame when a job completes. See [turbo_streams_guide.md](turbo_streams_guide.md) and [section 7](#7-turbo-streams--server-responses) below.
- **Typical client-side behavior** (Stimulus, e.g. `query_list_controller.js`) — **match current workspace UX**, then evolve:
  - **Pagination / filtering / sorting:** Match today’s query list UX (client-side paging in `query_list_controller.js` today; [old/angularjs_elimination_plan.md](./old/angularjs_elimination_plan.md) also discussed server-driven Pagy for large cases). Do not assume `?page=` on the URL unless your slice intentionally matches that model.
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
- **Query notes form** (`query_notes_<query_id>`): may submit via Turbo Frame; server returns HTML with a matching frame to replace the form region without full-page reload. See [section 7](#7-turbo-streams--server-responses).
- When no query is selected: show a prompt such as “Select a query from the list”.
- **Results fetching (parity):** Same browser search model as documented in [old/angularjs_elimination_plan.md](./old/angularjs_elimination_plan.md); optional server-rendered cards only with explicit scope ([intentional_design_changes.md](./intentional_design_changes.md), Section 2).
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
- **Historically** the old core UI had extra side regions (tune relevance, dev settings, scorer picker). In the current Rails layout, scorer, settings, and chart UI often live in a toolbar (Bootstrap collapse), with query list and results as collapsible side regions. An annotations region may be a collapse below the workspace.
- **Adding panels:** For heavy or optional regions, consider a dedicated Turbo Frame with `loading="lazy"` and `src` pointing at an endpoint.

---

## 5. Modals

| Modal (examples) | Typical stack | Frame strategy | Notes |
|------------------|---------------|----------------|-------|
| Clone / export / import / share case, judgements, diff, query actions, annotations, etc. | Partial + Stimulus | In-page Bootstrap modal | Standard pattern |
| Books / judgements flows | Rails views | `turbo_frame_tag "modal"` | Empty frame on `books/show` as a target for modal HTML/streams (see `app/views/books/show.html.erb`) |

**Details:**
- Most modals are **in-page Bootstrap modals** rendered with the page; Stimulus handles open/close.
- **Turbo Frame modals:** Use `target="_top"` for links/forms that should affect the whole page (e.g. redirect after submit). For modals driven by frames, use `turbo_frame_tag "modal"` as the insertion target; add `src` on the frame if you adopt lazy-loaded modal content (the books show page currently declares an empty `modal` frame).
- **Heavy modals:** Consider lazy-loading via frame `src`. Form submits can return Turbo Streams to close the modal and update parent regions.
- See [UI Consistency Patterns](ui_consistency_patterns.md) for modal patterns and Bootstrap conventions.

---

## 6. Other Frames (Outside Core Workspace)

These match **current** ERB in the repo (verify with `rg 'turbo-frame|turbo_frame_tag' app/views` after refactors).

| Frame ID | Declared in | Response template (matching `id`) | Purpose |
|----------|-------------|-----------------------------------|---------|
| `dropdown_cases` | `layouts/_header.html.erb` (`src`: `dropdown_cases_path`) | `dropdown/cases.html.erb` | Recent cases in navbar dropdown |
| `dropdown_books` | `layouts/_header.html.erb` (`src`: `dropdown_books_path`) | `dropdown/books.html.erb` | Recent books in navbar dropdown |
| `modal` | `books/show.html.erb` | (streams / responses targeting this id) | Modal host for judgements flows |
| `book_frame_<id>` | `home/_book_summary.html.erb` (`src`: `home_book_summary_detail_path`) | `home/book_summary_detail.html.erb` | Per-book summary on dashboard |
| `case_frame_<id>` | `home/_case_summary.html.erb` (`src`: `home_case_prophet_path`) | `home/case_prophet.html.erb` | Per-case summary on dashboard |
| `sparklines_tray` | `home/sparklines.html.erb` | Same file (full-page `HomeController#sparklines`) | Sparklines tray (`GET home/sparklines`) |
| `query_doc_pair_card` | `judgements/edit.html.erb`, `new.html.erb` | Same files | Judgement card in book flow |

### 6.1 Lazy vs eager `src` frames

Turbo Frames with `src` fetch their content automatically. Use **`loading="lazy"`** when deferring work until the frame is near the viewport (or until the user reveals the region). Use **`loading="eager"`** (or omit, depending on Turbo defaults) when you want the fetch to start immediately—e.g. dashboard cards where book summaries should populate without waiting for scroll.

| Frame | Location | `loading` on `main` | Notes |
|-------|----------|---------------------|-------|
| `dropdown_cases` | `layouts/_header.html.erb` | `lazy` | Fetches when the frame is in the dropdown |
| `dropdown_books` | `layouts/_header.html.erb` | `lazy` | Same |
| `book_frame_<id>` | `home/_book_summary.html.erb` | **`eager`** | Fetches book detail as soon as the dashboard renders |
| `case_frame_<id>` | `home/_case_summary.html.erb` | `lazy` | Defers case “prophet” payload until near viewport |

**When adding new lazy-loaded frames:** Use `src="<%= some_path %>" loading="lazy"` (or `turbo_frame_tag "id", src: path, loading: :lazy`). The server response must return HTML containing a matching `<turbo-frame id="...">`.

### 6.2 Turbo frame requests and `request.variant`

`ApplicationController` sets `request.variant = :turbo_frame` when `turbo_frame_request?` is true. Use `show.html+turbo_frame.erb` (or equivalent) to return a minimal layout or partial HTML for frame navigation without duplicating branching logic in every action.

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

Optional pattern: a small Stimulus controller on `<body>` (for example `turbo_events_controller`) can listen for Turbo lifecycle events. The repo may not define this yet; add it when you want global loading chrome for frames and forms.

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

**Do not use** for normal navigation links (navbar brand, “View all cases”, create case) unless you intentionally need a full document load. Where **Turbo Drive** is enabled for those links, prefer default Turbo behavior; on **`application_modern`** Drive is off globally (see implementation split), so this guideline applies mainly to layouts that enable Drive or to explicit `data-turbo="true"` links.

For URL building rules (never hardcode `/`; prefer server-passed URLs and a subpath-aware root), see [API client conventions](api_client.md).

---

## Summary

| Boundary | Frame ID | Notes |
|----------|----------|-------|
| Workspace content | `workspace_content` | Query selection; wraps query list + results pane |
| Query list | `query_list_<case_id>` | Turbo Streams for add/remove/reorder; client pagination/filter/sort; `query_row_<id>` |
| Results pane | `results_pane` | `fetch` + HTML (not necessarily lazy `src`); Turbo Streams for ratings; bulk rating, diff, load more |
| Side panels | (collapsible) | Stimulus + optional `localStorage` |
| Modals | Various | Mostly in-page Bootstrap; `modal` frame on `books/show` as stream/target host |

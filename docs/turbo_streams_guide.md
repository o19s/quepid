# Turbo Streams Guide

> When and how to use Turbo Streams for live updates in the Quepid core workspace.

---

## 1. When to Use Each Action

| Action | Use case | Target | Example |
|--------|----------|--------|---------|
| **`append`** | Add a new item to the end of a list | Parent container ID | New query row → `query_list_items` |
| **`prepend`** | Add a new item to the start of a list | Parent container ID | New notification at top |
| **`replace`** | Replace an entire element (including its tag) | Element ID | Swap modal content, replace frame |
| **`update`** | Replace only the inner HTML of an element | Element ID | Update score badge, update label text |
| **`remove`** | Remove an element from the DOM | Element ID | Delete query row → `query_row_<id>` |
| **`before`** / **`after`** | Insert sibling before/after an element | Sibling element ID | Insert between list items |

### Decision guide

- **Adding to a list** → `append` or `prepend` (target the list container).
- **Removing from a list** → `remove` (target the specific item, e.g. `query_row_123`).
- **Changing content but keeping the element** → `update` (e.g. score text, badge).
- **Swapping the whole element** → `replace` (e.g. form → success state, frame refresh).

---

## 2. Primary Use Cases in the Core Workspace

| Use case | Status | Implementation |
|----------|--------|----------------|
| **New query added** | Implemented | `Core::QueriesController#create` → `append` to `query_list_items`, `remove` `query_list_empty_placeholder` when first query |
| **Query removed** | Implemented | `Core::QueriesController#destroy` → `remove` `query_row_<id>`; when deleted query was selected, also `replace` `results_pane` with empty state |
| **Rating updated** | Implemented | `Api::V1::Queries::RatingsController` returns Turbo Stream to `update` `rating-badge-<doc_id>`; results pane requests `Accept: text/vnd.turbo-stream.html` and applies via `Turbo.renderStreamMessage` |
| **Score changed** | Implemented | `RunCaseEvaluationJob` broadcasts `replace` for `qscore-case-#{case_id}` and `query_list_#{case_id}` when job completes; core workspace subscribes via `turbo_stream_from(:notifications)`. DocFinder bulk rate/delete triggers run_evaluation so scores refresh. |

**Prefer Turbo Streams** over client-side `fetch` + manual DOM update. When the server can return `text/vnd.turbo-stream.html`, use that so Turbo handles DOM updates consistently.

---

## 3. Turbo.session.drive = false

Quepid sets `Turbo.session.drive = false` in `application_modern.js`. This disables Turbo Drive’s automatic interception of links and forms. As a result:

- **Forms and links** do not use Turbo Drive by default.
- **Turbo Streams** still work. They are independent of Drive.
- **Fetch + Turbo Stream** must be done explicitly: use `fetch()` with `Accept: text/vnd.turbo-stream.html` and pass the response to `Turbo.renderStreamMessage(html)`.

### Client-side pattern (Stimulus)

```javascript
// 1. Request Turbo Stream format
const res = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-CSRF-Token": token,
    Accept: "text/vnd.turbo-stream.html"
  },
  body: JSON.stringify(payload)
})

// 2. Apply Turbo Stream response (works regardless of Drive)
if (res.ok && res.headers.get("Content-Type")?.includes("turbo-stream")) {
  const html = await res.text()
  if (html?.trim()) window.Turbo.renderStreamMessage(html)
}
```

See `add_query_controller.js` and `delete_query_controller.js` for working examples.

### Server-side pattern (Rails)

```ruby
respond_to do |format|
  format.turbo_stream do
    render turbo_stream: [
      turbo_stream.append("query_list_items", partial: "core/queries/query_row", locals: locals),
      turbo_stream.remove("query_list_empty_placeholder")
    ], status: :created
  end
  format.html { redirect_to path }
end
```
# Turbo streams guide

> When and how to use Turbo Streams as Rails replaces legacy client-side DOM updates. **Parity constraints** (what stays in the browser vs server): [angularjs_elimination_plan.md](./angularjs_elimination_plan.md). Prefer streams for **notifications**, **server-rendered** mutation responses, and **server-owned** HTML fragments — not as the default replacement for the interactive search/score loop unless [intentional_design_changes.md](./intentional_design_changes.md) Section 2 is explicitly adopted.
>
> **Related:** [Turbo frame boundaries](./turbo_frame_boundaries.md) (DOM/frame IDs for the core workspace), [Workspace behavior](./workspace_behavior.md) (case try layout does not subscribe to notification streams).

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

## 2. Primary use cases in the core workspace

> **Parity:** The Angular workspace today updates many of these flows **in the client** (events + `fetch` + DOM updates). The table below describes **one** target shape **if** you implement server-returned Turbo Stream HTML for that action. It is **not** a requirement to use Streams for every row — match [angularjs_elimination_plan.md](./angularjs_elimination_plan.md) slices and preserve UX before adopting Stream-driven markup.

| Use case | Typical server / client pattern |
|----------|--------------------------------|
| **New query added** | `append` to `query_list_items`, `remove` `query_list_empty_placeholder` when first query. Error handling: `append` to `flash` on validation failure. |
| **Query removed** | `remove` `query_row_<id>`; when deleted query was selected, also `replace` `results_pane` with empty state. If last query deleted, `append` empty placeholder. |
| **Rating updated** | `update` `rating-badge-<doc_id>`; on delete, `update` with empty rating. Client requests `Accept: text/vnd.turbo-stream.html` and applies via `Turbo.renderStreamMessage`. Error handling: `append` to `flash` on validation failure. |
| **Rating deleted** | `update` `rating-badge-<doc_id>` with empty rating string. |
| **Annotation created** | `prepend` to `annotations_list` (HTML from component or partial). Client requests `Accept: text/vnd.turbo-stream.html` and applies via `Turbo.renderStreamMessage`. |
| **Score changed** | **On main today:** the legacy Angular try page does **not** use `turbo_stream_from`; scores update in the client. **`RunCaseEvaluationJob`** broadcasts to the `:notifications` stream using `Turbo::StreamsChannel.broadcast_render_to` and partials under `admin/run_case/` that **`replace`** elements with ids `notification` (global progress) and `notification-case-#{case_id}` (per-case progress/completion). **`RatingsManager`** uses the same channel and `notification-case-*` with `notification_case_sync` while syncing book judgements to ratings. **Target shape for the new core UI:** when server-owned score/header/query-list markup exists, you might `replace` targets such as `qscore-case-#{case_id}`, `case-header-score-#{case_id}`, and `query_list_#{case_id}` (see [turbo_frame_boundaries.md](./turbo_frame_boundaries.md)); that wiring is not the current production path for the try workspace. |

**Prefer Turbo Streams** (over ad hoc `fetch` + manual DOM surgery) for **server-owned** UI fragments: lists, badges, flash, job completion—where Rails already renders the HTML. The live search/result loop: [angularjs_elimination_plan.md](./angularjs_elimination_plan.md). When the server can return `text/vnd.turbo-stream.html`, use that so Turbo applies updates consistently.

---

## 3. Turbo.session.drive = false

Quepid sets `Turbo.session.drive = false` in `application_modern.js`. This disables Turbo Drive’s automatic interception of links and forms. As a result:

- **Forms and links** do not use Turbo Drive by default.
- **Turbo Streams** still work. They are independent of Drive.
- **Fetch + Turbo Stream** must be done explicitly: use `fetch()` with `Accept: text/vnd.turbo-stream.html` and pass the response to `Turbo.renderStreamMessage(html)`.

### Client-side pattern (Stimulus)

#### Basic pattern with Turbo Stream support

```javascript
// 1. Check if Turbo is available
const useTurboStream = !!window.Turbo
const accept = useTurboStream ? "text/vnd.turbo-stream.html" : "application/json"

// 2. Request Turbo Stream format (or JSON fallback)
const res = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-CSRF-Token": token,
    Accept: accept
  },
  body: JSON.stringify(payload)
})

// 3. Apply Turbo Stream response (works regardless of Drive)
if (useTurboStream && res.headers.get("Content-Type")?.includes("turbo-stream")) {
  const html = await res.text()
  if (html?.trim()) window.Turbo.renderStreamMessage(html)
  return true // Used Turbo Stream
}

// 4. Fallback to JSON + manual DOM update
const data = await res.json()
// ... manual DOM manipulation ...
return false // Did not use Turbo Stream
```

#### Error handling

Handle Turbo Stream errors (e.g., validation failures that return Turbo Stream flash messages):

```javascript
if (!res.ok) {
  const ct = res.headers.get("Content-Type") || ""
  if (ct.includes("turbo-stream")) {
    const html = await res.text()
    if (html?.trim()) window.Turbo.renderStreamMessage(html)
    return // Error shown via Turbo Stream flash message
  }
  // Handle JSON error response
  const data = await res.json().catch(() => ({}))
  throw new Error(data.error || data.message || res.statusText)
}
```

#### Complete example: `fetch` + `apiUrl` / `csrfToken`

Use the same URL rules as the rest of the modern stack (`modules/api_url`):

```javascript
import { apiUrl, csrfToken } from "modules/api_url"

async create() {
  const useTurboStream = !!window.Turbo
  const accept = useTurboStream ? "text/vnd.turbo-stream.html" : "application/json"
  const url = apiUrl("api/cases/…") // path without a leading slash

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken(),
      Accept: accept
    },
    body: JSON.stringify(body)
  })

  const ct = res.headers.get("Content-Type") || ""

  if (!res.ok) {
    if (ct.includes("turbo-stream")) {
      const html = await res.text()
      if (html?.trim()) window.Turbo.renderStreamMessage(html)
      return
    }
    const data = await res.json().catch(() => ({}))
    throw new Error(data.message || data.error || res.statusText)
  }

  if (useTurboStream && ct.includes("turbo-stream")) {
    const html = await res.text()
    if (html?.trim()) window.Turbo.renderStreamMessage(html)
  } else {
    const data = await res.json()
    this._prependAnnotation(data) // Manual DOM update
  }

  this.messageInputTarget.value = ""
}
```

For URL and CSRF conventions used in examples above, see [stimulus_and_modern_js_conventions.md](../stimulus_and_modern_js_conventions.md) (authoritative). Search the tree for `text/vnd.turbo-stream.html` / `renderStreamMessage` to see live call sites.

### Server-side pattern (Rails)

#### Basic example: single action

```ruby
respond_to do |format|
  format.turbo_stream do
    render turbo_stream: turbo_stream.append(
      "query_list_items",
      partial: "core/queries/query_row",
      locals: locals
    ), status: :created
  end
  format.html { redirect_to path }
end
```

#### Multiple actions (array)

```ruby
respond_to do |format|
  format.turbo_stream do
    streams = [
      turbo_stream.append("query_list_items", partial: "core/queries/query_row", locals: locals)
    ]
    streams.unshift(turbo_stream.remove("query_list_empty_placeholder")) if @case.queries.one?
    render turbo_stream: streams, status: :created
  end
  format.html { redirect_to path }
end
```

#### Rendering HTML (partial or component)

```ruby
format.turbo_stream do
  html = render_to_string(
    partial: "annotations/annotation",
    locals: { annotation: @annotation, case: @case }
  )
  render turbo_stream: turbo_stream.prepend("annotations_list", html), status: :created
end
```

#### Error handling with flash messages

```ruby
if @rating.update rating_params
  respond_to do |format|
    format.turbo_stream do
      render turbo_stream: turbo_stream.update(
        rating_badge_id(@doc_id),
        partial: "api/v1/queries/ratings/rating_badge",
        locals: { rating: @rating.rating.to_s }
      ), status: :ok
    end
    format.json { respond_with @rating }
  end
else
  respond_to do |format|
    format.turbo_stream do
      render turbo_stream: turbo_stream.append(
        "flash",
        partial: "shared/flash_alert",
        locals: { message: @rating.errors.full_messages.to_sentence }
      ), status: :unprocessable_content
    end
    format.json { render json: @rating.errors, status: :bad_request }
  end
end
```

#### Format negotiation

Controllers should check the `Accept` header to determine if Turbo Stream format is requested:

```ruby
before_action :set_response_format, only: [:create, :update]

private

def set_response_format
  request.format = :turbo_stream if request.headers['Accept']&.include?('turbo-stream')
  request.format = :json if :turbo_stream != request.format
end
```

Or use `skip_before_action :set_default_response_format` and handle format negotiation manually:

```ruby
skip_before_action :set_default_response_format, only: [:create, :update]
respond_to :json, :turbo_stream
```

---

## 4. Broadcasting (Server-Side)

For real-time updates from background jobs or other processes, use Turbo Stream broadcasting. Quepid’s recurring pattern is **`Turbo::StreamsChannel.broadcast_render_to`** with a **`.turbo_stream.erb` partial** that emits one or more `turbo_stream.*` actions (often `replace`). That matches `RunCaseEvaluationJob`, `RunJudgeJudyJob`, `ExportBookJob`, `RatingsManager`, and related code.

### Subscribing in views

```erb
<%= turbo_stream_from(:notifications) %>
```

This subscribes the page to the `:notifications` stream (ActionCable). **Note:** `layouts/core.html.erb` does **not** include this today, so the case try workspace does not receive these pushes; see [workspace_behavior.md](./workspace_behavior.md).

### Broadcasting from jobs (pattern in this repo)

See `app/jobs/run_case_evaluation_job.rb`: it calls `Turbo::StreamsChannel.broadcast_render_to(:notifications, …)` twice per progress tick (global + per-case), with partials `admin/run_case/notification` and `admin/run_case/notification_case`.

**DOM targets those partials replace** (read the `.turbo_stream.erb` files—this is what must exist in the HTML):

| Partial | Replaced element id |
|---------|---------------------|
| `admin/run_case/_notification.turbo_stream.erb` | `notification` |
| `admin/run_case/_notification_case.turbo_stream.erb` | `notification-case-#{acase.id}` |
| `admin/run_case/_notification_case_sync.turbo_stream.erb` | `notification-case-#{acase.id}` (book ↔ ratings sync) |
| `books/_notification.turbo_stream.erb` | `notification-book-#{book.id}` |

Views that should update live include `turbo_stream_from(:notifications)` and markup with those ids (e.g. `app/views/home/show.html.erb`, `app/views/books/index.html.erb` / `show`, admin websocket tester).

### Alternative: `broadcast_replace_to` with a template

You can also use `broadcast_replace_to` (or other `broadcast_*_to` helpers) when you want to target a DOM id directly without a separate `.turbo_stream.erb` wrapper. That style is useful for **future** core workspace targets (e.g. `qscore-case-#{case_id}`) once those elements exist:

```ruby
Turbo::StreamsChannel.broadcast_replace_to(
  :notifications,
  target: "qscore-case-#{case_id}",
  partial: "cases/qscore",
  locals: { case: acase }
)
```

Include `turbo_stream_from(:notifications)` (or the stream name you broadcast to) in any layout or view that should receive those updates.

---

## 5. Common Patterns

### Conditional actions

Build streams conditionally:

```ruby
streams = [turbo_stream.remove("query_row_#{deleted_id}")]
if params[:selected_query_id].to_i == deleted_id
  streams << turbo_stream.replace(
    "results_pane",
    render_to_string(partial: "core/results_pane", locals: { ... })
  )
end
streams << turbo_stream.append("query_list_items", partial: "empty_placeholder") if @case.queries.none?
render turbo_stream: streams, status: :ok
```

### Empty state handling

When adding the first item, remove the empty placeholder:

```ruby
streams = [turbo_stream.append("query_list_items", partial: "query_row", locals: locals)]
streams.unshift(turbo_stream.remove("query_list_empty_placeholder")) if @case.queries.one?
render turbo_stream: streams, status: :created
```

When removing the last item, add the empty placeholder back:

```ruby
streams = [turbo_stream.remove("query_row_#{id}")]
streams << turbo_stream.append("query_list_items", partial: "empty_placeholder") if @case.queries.reload.none?
render turbo_stream: streams, status: :ok
```

### ID sanitization

When using dynamic IDs (e.g., doc IDs), sanitize them for HTML attributes. Doc IDs from search engines can contain URLs, slashes, colons, etc., which break Bootstrap's `querySelector` and Turbo Stream targets:

```ruby
def rating_badge_id(doc_id)
  "rating-badge-#{doc_id.to_s.gsub(/[^a-zA-Z0-9_-]/, '-')}"
end
```

---

## 6. Best Practices

### When to use Turbo Streams

✅ **Use Turbo Streams for:**
- Live DOM updates after form submissions or API calls
- Real-time updates from background jobs (via broadcasting)
- In-place content updates (badges, scores, labels)
- Adding/removing items from lists
- Replacing entire sections (modals, panes, frames)

❌ **Don't use Turbo Streams for:**
- Full page navigation (use regular links/redirects)
- Complex client-side state management (use Stimulus values/controllers)
- One-time page loads (use regular HTML responses)
- API endpoints that don't need UI updates (use JSON)

### Target element requirements

- **Target elements must exist** in the DOM when the Turbo Stream action executes
- Use **stable, unique IDs** for target elements (e.g., `query_row_123`, not `query_row`)
- For lists, target the **container element** (e.g., `query_list_items`), not individual items
- Ensure IDs are **valid HTML identifiers** (no spaces, special characters)

### Error handling

- Always provide **JSON fallback** for API compatibility
- Use Turbo Streams for **error messages** (append to `flash` container)
- Check response status codes and Content-Type headers
- Handle both Turbo Stream and JSON error responses

### Performance

- **Batch multiple actions** into a single Turbo Stream response (use arrays)
- Avoid unnecessary DOM updates (check if element exists before targeting)
- Use `update` instead of `replace` when only inner content changes
- For large lists, consider pagination or virtualization instead of appending many items

### Testing

- Test both Turbo Stream and JSON response formats
- Verify target elements exist before Turbo Stream actions
- Test error handling (validation failures, network errors)
- Test conditional actions (empty states, edge cases)

---

## 7. Troubleshooting

### Turbo Stream not applying

**Problem:** Turbo Stream response received but DOM not updating.

**Solutions:**
1. Verify `window.Turbo` exists: `console.log(window.Turbo)`
2. Check Content-Type header: `res.headers.get("Content-Type")` should include `turbo-stream`
3. Ensure HTML is not empty: `if (html?.trim()) window.Turbo.renderStreamMessage(html)`
4. Check browser console for JavaScript errors
5. Verify target element ID exists in DOM

### Target element not found

**Problem:** Turbo Stream action fails because target element doesn't exist.

**Solutions:**
1. Verify element ID matches exactly (case-sensitive)
2. Check element exists before Turbo Stream executes: `document.getElementById('target-id')`
3. Use conditional rendering: only send Turbo Stream if target exists
4. Ensure element is rendered before subscribing to broadcasts

### Format negotiation issues

**Problem:** Controller not returning Turbo Stream format when requested.

**Solutions:**
1. Check `Accept` header includes `text/vnd.turbo-stream.html`
2. Verify `skip_before_action :set_default_response_format` if needed
3. Ensure `respond_to :json, :turbo_stream` is declared
4. Check `request.format` is set correctly in before_action

### Broadcasting not working

**Problem:** Broadcast Turbo Streams not received by clients.

**Solutions:**
1. Verify `turbo_stream_from(:channel)` is present in view
2. Check WebSocket connection is established (browser DevTools → Network → WS)
3. Ensure stream name matches on subscribe and broadcast (e.g. `turbo_stream_from(:notifications)` and `broadcast_render_to(:notifications, …)` or `broadcast_replace_to(:notifications, …)`)
4. Verify ActionCable is configured and running
5. Check server logs for broadcast errors

### Multiple actions not executing

**Problem:** Array of Turbo Stream actions, but only some execute.

**Solutions:**
1. Verify all target elements exist in DOM
2. Check for JavaScript errors preventing execution
3. Ensure actions are in correct order (e.g., remove before append)
4. Verify array syntax: `render turbo_stream: [action1, action2]`

### Flash messages not appearing

**Problem:** Turbo Stream appends to `flash` but message doesn't show.

**Solutions:**
1. Verify `#flash` container exists in layout
2. Check flash partial path: `partial: "shared/flash_alert"`
3. Ensure flash partial accepts correct locals (e.g., `message`, `type`)
4. Verify flash styling/CSS is applied
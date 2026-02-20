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
| **New query added** | Implemented | `Core::QueriesController#create` → `append` to `query_list_items`, `remove` `query_list_empty_placeholder` when first query. Error handling: `append` to `flash` on validation failure. |
| **Query removed** | Implemented | `Core::QueriesController#destroy` → `remove` `query_row_<id>`; when deleted query was selected, also `replace` `results_pane` with empty state. If last query deleted, `append` empty placeholder. |
| **Rating updated** | Implemented | `Api::V1::Queries::RatingsController#update` → `update` `rating-badge-<doc_id>`; `#destroy` → `update` with empty rating. Results pane requests `Accept: text/vnd.turbo-stream.html` and applies via `Turbo.renderStreamMessage`. Error handling: `append` to `flash` on validation failure. |
| **Rating deleted** | Implemented | `Api::V1::Queries::RatingsController#destroy` → `update` `rating-badge-<doc_id>` with empty rating string. |
| **Annotation created** | Implemented | `Api::V1::AnnotationsController#create` → `prepend` to `annotations_list` using `AnnotationComponent`. Client requests `Accept: text/vnd.turbo-stream.html` and applies via `Turbo.renderStreamMessage`. |
| **Score changed** | Implemented | `RunCaseEvaluationJob` broadcasts `replace` for `qscore-case-#{case_id}` and `query_list_#{case_id}` when job completes; core workspace subscribes via `turbo_stream_from(:notifications)`. DocFinder bulk rate/delete triggers run_evaluation so scores refresh. |

**Prefer Turbo Streams** over client-side `fetch` + manual DOM update. When the server can return `text/vnd.turbo-stream.html`, use that so Turbo handles DOM updates consistently.

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

#### Complete example: Using apiFetch helper

When using `apiFetch` from `app/javascript/api/fetch.js`, here's a complete example from `app/javascript/controllers/annotations_controller.js`:

```javascript
async create() {
  const useTurboStream = !!window.Turbo
  const accept = useTurboStream ? "text/vnd.turbo-stream.html" : "application/json"
  
  const res = await apiFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: accept },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.message || data.error || res.statusText)
  }

  if (useTurboStream && res.headers.get("Content-Type")?.includes("turbo-stream")) {
    const html = await res.text()
    if (html?.trim()) window.Turbo.renderStreamMessage(html)
  } else {
    const data = await res.json()
    this._prependAnnotation(data) // Manual DOM update
  }
  
  this.messageInputTarget.value = "" // Clear input
}
```

**Reference implementations:**
- `app/javascript/controllers/add_query_controller.js` - Create query with Turbo Stream
- `app/javascript/controllers/delete_query_controller.js` - Delete query with Turbo Stream
- `app/javascript/controllers/results_pane_controller.js` - Rating updates with Turbo Stream
- `app/javascript/controllers/annotations_controller.js` - Create annotation with Turbo Stream

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

#### Using ViewComponents

```ruby
format.turbo_stream do
  html = render_to_string(
    AnnotationComponent.new(annotation: @annotation, case_id: @case.id)
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

For real-time updates from background jobs or other processes, use Turbo Stream broadcasting:

### Subscribing in views

```erb
<%= turbo_stream_from(:notifications) %>
```

This creates a WebSocket subscription to the `:notifications` channel.

### Broadcasting from jobs/controllers

```ruby
# In a job or controller
Turbo::StreamsChannel.broadcast_replace_to(
  :notifications,
  target: "qscore-case-#{case_id}",
  partial: "cases/qscore",
  locals: { case: acase }
)
```

### Use case: Score updates

`RunCaseEvaluationJob` broadcasts score updates when evaluation completes:

```ruby
Turbo::StreamsChannel.broadcast_replace_to(
  :notifications,
  target: "qscore-case-#{case_id}",
  partial: "cases/qscore",
  locals: { case: acase }
)
Turbo::StreamsChannel.broadcast_replace_to(
  :notifications,
  target: "query_list_#{case_id}",
  partial: "core/queries/query_list",
  locals: { case: acase, try: try }
)
```

The core workspace subscribes in `app/views/core/show.html.erb`:

```erb
<%= turbo_stream_from(:notifications) %>
```

---

## 5. Common Patterns

### Conditional actions

Build streams conditionally:

```ruby
streams = [turbo_stream.remove("query_row_#{deleted_id}")]
if params[:selected_query_id].to_i == deleted_id
  streams << turbo_stream.replace(
    "results_pane",
    render_to_string(ResultsPaneComponent.new(...))
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
3. Ensure channel name matches: `broadcast_replace_to(:notifications, ...)`
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
# UI Consistency Patterns

> Guidelines for Bootstrap 5, modals, and flash messages in the Stimulus/Turbo/ViewComponents stack. Use these patterns consistently across migrated pages.

---

## 1. Bootstrap 5

Migrated pages use **Bootstrap 5**. Use Bootstrap 5 attributes and classes consistently.

### Use (Bootstrap 5)

- `data-bs-toggle="modal"` — open modals
- `data-bs-target="#modalId"` — target modal by ID
- `data-bs-dismiss="modal"` — close modal
- `data-bs-dismiss="alert"` — dismiss alert
- `btn-close` — close button (replaces `close` class)
- `form-select`, `form-control` — form elements
- `modal-dialog`, `modal-content`, `modal-header`, `modal-body`, `modal-footer`
- `list-group`, `list-group-item`, `list-group-item-action`

### Avoid (Bootstrap 4 legacy)

- `data-toggle` → use `data-bs-toggle`
- `data-target` → use `data-bs-target`
- `data-dismiss` → use `data-bs-dismiss`
- `close` class for close buttons → use `btn-close`

### Verification

- Grep for `data-dismiss` or `data-toggle` (without `bs-`) — should find none in `app/`.
- All modals use `btn-close` and `data-bs-dismiss="modal"`.

---

## 2. Modal Patterns

Four established patterns: **confirm_delete** (generic confirmation), **share_case** (shared content modal), **per-component** (row-specific modals), and **expand_content** (full-screen content display).

### Pattern A: confirm_delete (generic confirmation)

For simple confirm/cancel actions (archive, unarchive, remove member, delete).

**Trigger:** Any element with `data-controller="confirm-delete"` and values:

```erb
<button type="button"
        class="btn btn-outline-secondary btn-sm"
        data-controller="confirm-delete"
        data-action="click->confirm-delete#open"
        data-confirm-delete-url-value="<%= archive_case_path(kase) %>"
        data-confirm-delete-method-value="post"
        data-confirm-delete-message-value="<%= h("Archive #{kase.case_name}?") %>">
  Archive
</button>
```

**Values:**

- `data-confirm-delete-url-value` — URL to submit (required)
- `data-confirm-delete-method-value` — `delete`, `post`, `patch` (default: `delete`)
- `data-confirm-delete-message-value` — confirmation text (default: "Are you sure?")

**Behavior:** Controller creates a single shared modal (`#confirmDeleteModal`) if absent, shows it, and on confirm submits a hidden form with CSRF token. Falls back to `window.confirm()` if Bootstrap is unavailable.

**Examples:** `app/views/cases/index.html.erb`, `app/views/teams/_cases.html.erb`, `app/views/teams/show.html.erb`.

---

### Pattern B: share_case (content modal)

For modals with forms, dropdowns, or dynamic content. Modal is a shared partial; Stimulus populates it when opened.

**Trigger:** Button with `data-bs-toggle` + `data-bs-target` and Stimulus values:

```erb
<%= button_tag type: "button",
               class: "btn btn-outline-secondary btn-sm",
               data: {
                 controller: "share-case",
                 action: "click->share-case#open",
                 bs_toggle: "modal",
                 bs_target: "#shareCaseModal",
                 share_case_id_value: @case_id,
                 share_case_name_value: @case_name,
                 share_case_all_teams_json: all_teams_json,
                 share_case_shared_teams_json: shared_teams_json
               } do %>
  <i class="bi bi-share"></i> Share case
<% end %>
```

**Modal:** Shared partial (e.g. `shared/_share_case_modal.html.erb`) with `data-controller="share-case"` on the modal element. Bootstrap opens it via `data-bs-toggle`/`data-bs-target`; Stimulus `open` action runs on click to populate data.

**Structure:**

```erb
<div class="modal fade" id="shareCaseModal" tabindex="-1" aria-labelledby="shareCaseModalLabel" aria-hidden="true" data-controller="share-case">
  <div class="modal-dialog modal-lg">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="shareCaseModalLabel">Share Case</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body">...</div>
      <div class="modal-footer">...</div>
    </div>
  </div>
</div>
```

---

### Pattern C: Per-component modal (delete_query style)

For modals that are unique per row/item (e.g. delete query, query options). Wrapper holds both trigger and modal; Stimulus opens via `window.bootstrap.Modal.getOrCreateInstance`.

**Structure:**

```erb
<div data-controller="delete-query" data-delete-query-query-id-value="<%= @query_id %>" ...>
  <button data-action="click->delete-query#open">Delete</button>
  <div class="modal fade" id="deleteQueryModal-<%= @query_id %>" data-delete-query-target="modal">
    ...
  </div>
</div>
```

**Controller:** `open()` uses `window.bootstrap.Modal.getOrCreateInstance(el)` then `show()`. Always check for Bootstrap availability before instantiating. Prefer `getOrCreateInstance` over `new Modal()` to avoid creating duplicate instances.

```javascript
if (window.bootstrap && window.bootstrap.Modal) {
  // Preferred: reuses existing instance if present
  const modal = window.bootstrap.Modal.getOrCreateInstance(this.modalTarget)
  modal.show()
  
  // Alternative (if instance management is handled elsewhere):
  // const modal = new window.bootstrap.Modal(this.modalTarget)
  // modal.show()
}
```

**Examples:** `DeleteQueryComponent`, `QueryOptionsComponent`, `FrogReportComponent`, `DiffComponent`, `ImportRatingsComponent`, `JudgementsComponent`, `MatchesComponent` (debug modal).

---

### Pattern D: Expand content (full-screen modal)

For displaying large content (JSON, explain text, etc.) in a full-screen modal. Uses `ExpandContentComponent` which wraps the trigger and modal together.

**Usage:**

```erb
<%= render ExpandContentComponent.new(
      id: "explain-modal-1",
      title: "Relevancy Score: 1.5",
      body: explain_text_display,
      trigger_label: "Expand"
    ) %>
```

**Structure:** Component renders a button trigger and a `modal-fullscreen` modal. The `expand_content` controller handles opening via `window.bootstrap.Modal.getOrCreateInstance`.

**Examples:** `MatchesComponent` (explain text expansion), any component needing full-screen content display.

---

### Choosing a pattern

| Use case                         | Pattern        |
|----------------------------------|----------------|
| Simple confirm (archive, delete) | confirm_delete |
| Shared modal, many triggers     | share_case     |
| Per-row modal (query options)    | Per-component  |
| Full-screen content display      | ExpandContentComponent |

---

## 3. Flash Messages

Use Rails flash for server-side messages; use `window.flash` for client-side (Stimulus) feedback. Turbo Stream responses can append flash alerts into `#flash`.

### Server-side (Rails)

```ruby
flash[:notice] = "Case shared successfully."
flash[:alert]  = "Something went wrong."
redirect_to some_path
```

Rendered by `flash_messages` helper in `layouts/_header.html.erb` into `#flash`.

### Client-side (Stimulus)

```javascript
if (window.flash) window.flash.success = "Query deleted."
if (window.flash) window.flash.error = err.message
```

For redirects (e.g. after clone), store before navigating:

```javascript
if (window.flash?.store) window.flash.store("success", "Case cloned successfully!")
window.location.href = newCaseUrl
```

`utils/flash.js` initializes `window.flash`; messages render into `#flash` with Bootstrap alert classes.

### Turbo compatibility

- **Full-page navigation:** Rails flash works as usual.
- **Turbo Frame / fetch:** Flash is not in the response. Use `window.flash` in Stimulus for immediate feedback, or have the server return a Turbo Stream that targets `flash`:

  ```ruby
  turbo_stream.append "flash", partial: "shared/flash_alert", locals: { message: "Query deleted.", type: :success }
  ```

  The `shared/_flash_alert.html.erb` partial renders a Bootstrap alert with proper classes and dismiss button. Use `type: :success`, `:error`, `:notice`, `:info`, or `:alert`.

- **`turbo_events_controller.js`:** On `turbo:submit-end`, if the response is JSON and indicates failure, it sets `window.flash.error`. It skips flash when the response is HTML (form re-render) so the frame already shows validation errors.

### Flash types

| Type    | Bootstrap class  |
|---------|------------------|
| success | alert-success    |
| error   | alert-danger     |
| notice  | alert-info       |
| info    | alert-info       |
| alert   | alert-warning    |

**Note:** Both `notice` and `info` map to `alert-info`. Use `notice` for Rails flash (conventional), `info` for client-side when you want explicit info styling.

Defined in `application_helper#bootstrap_class_for` and `utils/flash.js`.

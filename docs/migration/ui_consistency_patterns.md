# UI consistency patterns

> Guidelines for Bootstrap 5, modals, flash messages, and styling for **Rails + Stimulus + Turbo** surfaces in Quepid when porting the core workspace per [angularjs_elimination_plan.md](./angularjs_elimination_plan.md) (or [rails_stimulus_migration_alternative.md](./rails_stimulus_migration_alternative.md)). Patterns here apply to **`main`**’s migration; **`deangularjs-experimental`** is a separate reference—see [deangularjs_experimental_review.md](./deangularjs_experimental_review.md).

**See also:** [api_client.md](./api_client.md) (fetch URLs, CSRF, `data-quepid-root-url`), [turbo_streams_guide.md](./turbo_streams_guide.md) and [turbo_frame_boundaries.md](./turbo_frame_boundaries.md) (frames/streams), [../app_structure.md](../app_structure.md) (app layout).

---

## 1. Bootstrap 5

Quepid targets **Bootstrap 5**. Use the `data-bs-*` attributes, `btn-close`, and current component classes. For full component markup and options, use the official docs: [Bootstrap 5.3](https://getbootstrap.com/docs/5.3/getting-started/introduction/).

### Avoid (Bootstrap 4 legacy)

- `data-toggle` → use `data-bs-toggle`
- `data-target` → use `data-bs-target`
- `data-dismiss` → use `data-bs-dismiss`
- `close` class for close buttons → use `btn-close`

### Verification

- Grep for `data-dismiss` or `data-toggle` (without `bs-`) — should find none in `app/`.
- All modals use `btn-close` and `data-bs-dismiss="modal"`.

---

## 2. Modal patterns

Four established patterns: **confirm_delete** (generic confirmation), **share_case** (shared content modal), **per-component** (row-specific modals), and **expand_content** (full-screen content display).

### Modals and accessibility

- Give each modal a visible title (`modal-title`) and set `aria-labelledby` on the root `.modal` to that title’s `id`.
- Use a real `<button type="button">` for dismiss, with `btn-close` / `data-bs-dismiss="modal"`, and an `aria-label` (or visible “Close”) when the control is icon-only.
- For large bodies (JSON, explain text, long forms), make **`modal-body` scroll** so keyboard and screen-reader users can reach all content without trapping focus away from dismiss actions.
- Prefer these shared patterns over ad hoc `window.confirm` except where Pattern A documents it as a **last-resort** fallback when Bootstrap is unavailable.

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

**Behavior:** Controller creates a single shared modal (`#confirmDeleteModal`) if absent, shows it, and on confirm submits a hidden form with CSRF token. Many triggers on one page share that modal; the controller stores the pending URL/method in module scope and registers **one** confirm + `hidden.bs.modal` listener on the modal so handlers do not stack per Stimulus instance. If Bootstrap is unavailable, it falls back to `window.confirm()`—do **not** rely on that for normal UX; treat it as an edge-case fallback only.

**Examples:** `app/views/teams/_cases.html.erb`, `app/views/teams/_search_endpoints.html.erb`, and other team/case views using `confirm-delete`.

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

**Modal:** Shared partial (e.g. `shared/_share_case_modal.html.erb`) with `data-controller="share-case"` on the root `.modal`. Bootstrap opens via `data-bs-toggle` / `data-bs-target`; Stimulus `open` runs on click to populate data.

**Markup:** Standard Bootstrap shell: `modal fade` → `modal-dialog` (e.g. `modal-lg`) → `modal-content` → `modal-header` (title + `btn-close` with `data-bs-dismiss="modal"`) → `modal-body` / `modal-footer`. Keep `tabindex="-1"`, `aria-labelledby` pointing at the title `id`, and `aria-hidden="true"` on the root per [Bootstrap modal accessibility](https://getbootstrap.com/docs/5.3/components/modal/).

---

### Pattern C: Per-component modal (per-row / per-item)

For modals that are unique per row or item (e.g. delete query, query options). A wrapper holds both trigger and modal; Stimulus opens via `window.bootstrap.Modal.getOrCreateInstance`.

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
}
```

**Finding usages:** Search for Stimulus controllers that open per-row modals (e.g. `getOrCreateInstance` under `app/javascript/controllers/`, or elements with `data-*-target="modal"`). Use the same Stimulus + Bootstrap structure with partials or ERB that render equivalent markup.

---

### Pattern D: Expand content (full-screen modal)

For displaying large content (JSON, explain text, etc.) in a full-screen modal. Use a **partial** with a trigger button and Bootstrap’s **`modal-fullscreen`** (or **`modal-fullscreen-lg-down`**, etc.) on `modal-dialog` per [Bootstrap fullscreen modals](https://getbootstrap.com/docs/5.3/components/modal/#fullscreen-modal). Add a small Stimulus controller. Open with the same `window.bootstrap.Modal.getOrCreateInstance` approach as Pattern C.

**Usage (conceptual ERB):**

```erb
<div data-controller="expand-content">
  <button type="button" data-action="click->expand-content#open">Expand</button>
  <div class="modal fade" data-expand-content-target="modal" tabindex="-1">
    <div class="modal-dialog modal-fullscreen">...</div>
  </div>
</div>
```

**Examples:** explain text from search results, large JSON viewers. The `document-fields-modal` controller on query doc pair listings uses `getOrCreateInstance` as well; if `window.bootstrap.Modal` is missing, it falls back to a truncated `window.alert` (query, doc id, and body prefix).

**Custom inset fullscreen:** If you need a near-full viewport with margins (e.g. debug JSON), add scoped classes under [`app/assets/stylesheets/`](../../app/assets/stylesheets/) (`.css` only) and ensure that file is concatenated in [`build_css.js`](../../build_css.js)—do not rely on a fixed filename unless the repo defines one.

---

### Choosing a pattern

| Use case                         | Pattern        |
|----------------------------------|----------------|
| Simple confirm (archive, delete) | confirm_delete |
| Shared modal, many triggers     | share_case     |
| Per-row modal (query options)    | Per-component  |
| Full-screen content display      | Expand-content Stimulus + fullscreen `modal-dialog` |

---

## 3. Flash messages

Use **Rails `flash`** for server-side messages after redirects. The `#flash` container lives in `app/views/layouts/_header.html.erb` and is filled by the `flash_messages` helper.

### Server-side (Rails)

```ruby
flash[:notice] = "Case shared successfully."
flash[:alert]  = "Something went wrong."
redirect_to some_path
```

### Angular workspace (legacy)

Components use the **angular-flash** service injected as `flash` (e.g. `flash.success = '…'`), not necessarily `window.flash`. That drives the same `#flash` region via the Angular stack.

### Stimulus / fetch / Turbo

- **Full-page navigation:** Rails flash works as usual.
- **Turbo Frame / JSON `fetch`:** The layout flash is not automatically updated. Prefer:
  - A **Turbo Stream** response that appends an alert into `#flash` (see [turbo_streams_guide.md](./turbo_streams_guide.md)); use a small partial that matches `flash_messages` markup (Bootstrap `alert`, `btn-close`, `data-bs-dismiss="alert"`), or
  - **Inline** feedback in the frame or controller target (dedicated element), or
  - **`Turbo.visit`** / full reload when a redirect+flash is simpler.

Example stream (partial name is conventional—add the partial when you implement the stream):

```ruby
turbo_stream.append "flash", partial: "shared/flash_alert", locals: { message: "Query deleted.", type: :success }
```

- **Turbo submit feedback:** A controller can listen for `turbo:submit-end`; on JSON failure, show an error in the form area or append to `#flash` via a stream—avoid double messaging when the response is HTML with inline validation errors.

### Client-side navigation after an action

Do **not** assign `window.location.href = '/'` for app root. Use **server-generated relative URLs**, **`Turbo.visit`**, or root from **`document.body.dataset.quepidRootUrl`** (set on `<body>` in core layouts). Details: [api_client.md](./api_client.md).

If you must stash a message before a client-driven navigation, keep the same URL rules; there is no separate `window.flash` helper in the Stimulus bundle today—prefer streams or Rails flash on the next full response.

### Flash types (Rails helper)

`ApplicationHelper#bootstrap_class_for` maps flash keys to Bootstrap alert classes:

| Type (`flash[:x]`) | Bootstrap class  |
|--------------------|------------------|
| `success`          | `alert-success`  |
| `error`            | `alert-danger`   |
| `notice`           | `alert-info`     |
| `alert`            | `alert-warning`  |

Other keys fall through to the string form of the type; extend `bootstrap_class_for` if you add a first-class `:info` (or use `:notice` for informational server messages).

---

## 4. Stimulus and new UI conventions

See [stimulus_and_modern_js_conventions.md](../stimulus_and_modern_js_conventions.md) (authoritative for URLs, outlets, values, testing, and CSS rules).

---

## 5. Styling (CSS)

- **Bootstrap:** Rely on Bootstrap 5 utilities and components; the main bundle is assembled in **`build_css.js`** (Bootstrap + app stylesheets).
- **App-specific:** Add or extend files under [`app/assets/stylesheets/`](../../app/assets/stylesheets/). Feature areas sometimes define **local CSS custom properties** (e.g. spacing tokens in a feature stylesheet)—reuse those patterns when adding a new surface rather than duplicating magic numbers.
- **Consistency:** Prefer shared tokens (Bootstrap or existing app variables in the same feature) for spacing, borders, and colors so new UI matches adjacent screens.

**Example (using plain CSS and optional custom properties defined nearby):**

```css
.my-component {
  padding: 0.75rem 1.25rem;
  border: 1px solid var(--bs-border-color, #dee2e6);
  border-radius: var(--bs-border-radius, 0.375rem);
  color: var(--bs-body-color);
}
```

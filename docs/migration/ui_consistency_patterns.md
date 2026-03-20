# UI consistency patterns

> Guidelines for Bootstrap 5, modals, flash messages, and styling for **Rails + Stimulus + Turbo** surfaces in Quepid.

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

## 2. Modal Patterns

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

**Behavior:** Controller creates a single shared modal (`#confirmDeleteModal`) if absent, shows it, and on confirm submits a hidden form with CSRF token. If Bootstrap is unavailable, it falls back to `window.confirm()`—do **not** rely on that for normal UX; treat it as an edge-case fallback only.

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
  
  // Alternative (if instance management is handled elsewhere):
  // const modal = new window.bootstrap.Modal(this.modalTarget)
  // modal.show()
}
```

**Finding usages:** Search for Stimulus controllers that open per-row modals (e.g. `getOrCreateInstance` under `app/javascript/controllers/`, or elements with `data-*-target="modal"`). Use the same Stimulus + Bootstrap structure with partials or ViewComponents that render equivalent markup.

---

### Pattern D: Expand content (full-screen modal)

For displaying large content (JSON, explain text, etc.) in a full-screen modal. Use a **partial** with a trigger button + `modal-fullscreen` (or `modal-fullscreen-custom`) and a small Stimulus controller. Open with the same `window.bootstrap.Modal.getOrCreateInstance` approach as Pattern C.

**Usage (conceptual ERB):**

```erb
<div data-controller="expand-content">
  <button type="button" data-action="click->expand-content#open">Expand</button>
  <div class="modal fade modal-fullscreen" data-expand-content-target="modal" tabindex="-1">
    <div class="modal-dialog">...</div>
  </div>
</div>
```

**Examples:** explain text from search results, large JSON viewers.

**Custom fullscreen variant:** For modals that need a large viewport but with margins (e.g. Debug JSON modal), use `modal-fullscreen-custom` on the `.modal` wrapper. Defined in `core-modals.css`; uses `calc(100% - 100px)` for dialog size.

---

### Choosing a pattern

| Use case                         | Pattern        |
|----------------------------------|----------------|
| Simple confirm (archive, delete) | confirm_delete |
| Shared modal, many triggers     | share_case     |
| Per-row modal (query options)    | Per-component  |
| Full-screen content display      | Expand-content Stimulus + fullscreen modal partial |

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

If `utils/flash.js` is present in the bundle, it initializes `window.flash`; messages render into `#flash` with Bootstrap alert classes. Otherwise use Rails flash and inline Stimulus feedback only.

### Turbo compatibility

- **Full-page navigation:** Rails flash works as usual.
- **Turbo Frame / fetch:** Flash is not in the response. Use `window.flash` in Stimulus for immediate feedback, or have the server return a Turbo Stream that targets `flash`:

  ```ruby
  turbo_stream.append "flash", partial: "shared/flash_alert", locals: { message: "Query deleted.", type: :success }
  ```

  The `shared/_flash_alert.html.erb` partial renders a Bootstrap alert with proper classes and dismiss button. Use `type: :success`, `:error`, `:notice`, `:info`, or `:alert`.

- **Turbo submit feedback:** A body-level Stimulus controller can listen for `turbo:submit-end`; if the response is JSON and indicates failure, set `window.flash.error`. Skip when the response is HTML so the frame can show validation errors.

### Flash types

| Type    | Bootstrap class  |
|---------|------------------|
| success | alert-success    |
| error   | alert-danger     |
| notice  | alert-info       |
| info    | alert-info       |
| alert   | alert-warning    |

**Note:** Both `notice` and `info` map to `alert-info`. Use `notice` for Rails flash (conventional), `info` for client-side when you want explicit info styling.

Defined in `application_helper#bootstrap_class_for` (and `utils/flash.js` when that module is loaded).

---

## 4. Styling (CSS Variables)

Use shared CSS custom properties for spacing, colors, and borders so UI stays consistent across components. **Source of truth:** [`app/assets/stylesheets/variables.css`](../../../app/assets/stylesheets/variables.css) — token names and values; loaded with the app CSS bundles. If you add a long-form reference doc, link it from here or from [`docs/app_structure.md`](../../app_structure.md).

**Prefer in new code:**
- `var(--quepid-spacing-*)` for padding and margins (step-based scale)
- `var(--quepid-color-*)` for text, borders, backgrounds
- `var(--quepid-border-radius-*)`, `var(--quepid-border-width)` for borders

**Example:**
```css
.my-component {
  padding: var(--quepid-spacing-5) var(--quepid-spacing-7);
  border: var(--quepid-border-width) solid var(--quepid-color-border);
  border-radius: var(--quepid-border-radius-md);
  color: var(--quepid-color-text);
}
```

# Workspace state design (core case UI)

This document describes **where state lives today** for the default case / try workspace (`GET /case/:id(/try/:try_number)` → `CoreController#index`, `layouts/core.html.erb`, `application_modern`). Behavior notes and gaps: [workspace_behavior.md](./workspace_behavior.md), [new_ui_capabilities.md](./new_ui_capabilities.md). Stack context: [rails_stimulus_migration.md](./rails_stimulus_migration.md).

---

## 1. Server state (authoritative)

Domain **persistence** lives on the server. Mutations go through **`fetch`** to the existing **`api/...`** JSON API (relative URLs via `modules/api_url` — see [api_client.md](./api_client.md)). Shared request helpers: **`modules/json_fetch`** (`railsJsonHeaders`, `jsonFetch`) for CSRF and JSON headers; ratings and other writes use the same pattern.

---

## 2. Client state (UI + interactive search/scoring)

**Stimulus** and **`app/javascript/modules/*`** implement the rows below (writes still go through §1).

| State | Examples | Handling (as shipped) |
|-------|----------|-------------------------|
| **Layout** | East settings pane width, show/hide east pane | `resizable-pane` Stimulus (`toggleEast` document event); widths/toggle are **session-only** (not persisted) |
| **Query list** | Sort order | URL query params `sort` and `reverse` (parsed in `query-list`); client-side paging and filter text in controller state |
| **Expanded “selection”** | Which query shows inline results | **Per-row expand/collapse** in `query-row` (accordion-style list), not a separate results frame or `?query_id=` deep link |
| **Toggles** | Show only rated, diff/snapshot flows, match breakdown | Stimulus + DOM |
| **Modals** | Export, clone, share, import, judgements, etc. | [ui_consistency_patterns.md](./ui_consistency_patterns.md) |
| **Focus / shortcuts** | Keyboard, focus ring | Browser + Stimulus (e.g. judgements form) |
| **Drafts** | Text before submit | Stimulus until submit commits server-side |
| **Live search & scores** | Result HTML, scorer output, explain, doc detail | **`modules/search_executor`** (+ optional **`proxy/fetch`**), **`modules/scorer_executor`**, **`modules/query_template`**, **`modules/explain_parser`**, **`modules/field_renderer`**; ratings via API + **`modules/ratings_store`** |

If it must **survive reloads or sessions** as the only copy, it belongs in **server state** or user preferences — not undocumented `localStorage`.

---

## 3. Turbo and Hotwire

- **`application_modern.js`** sets **`Turbo.session.drive = false`**. The core workspace does **not** rely on full-page Turbo Drive navigation; in-page updates use normal full loads or Stimulus-driven DOM (API traffic stays as in §1).
- The core shell is **one server-rendered page** composed from partials under `app/views/core/`. The frame IDs and stream-centric flows in [turbo_frame_boundaries.md](./turbo_frame_boundaries.md) are a **contract for optional future** frame/stream work — they are **not** the current wiring of the shipped workspace row.
- The try workspace layout does **not** subscribe to `turbo_stream_from(:notifications)`; see [workspace_behavior.md](./workspace_behavior.md) and [turbo_streams_guide.md](./turbo_streams_guide.md) for where streams already apply elsewhere.

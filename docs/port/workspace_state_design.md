# Workspace State Boundary Design (Option A)

This document defines the state boundary design for the core query-tuning workspace under **Option A** (server-centric architecture): server as source of truth, Turbo Frames for dynamic regions, Stimulus for minimal client-only UI state.

---

## 1. Server state (authoritative)

All domain and persisted state lives on the server. The client does not hold a long-lived copy as source of truth; it renders what the server sends and mutates via Rails controllers/API.

| State | Description | CRUD / flow |
|-------|-------------|-------------|
| **Case** | Case metadata, name, scorer, last try, tries list, team/book association | GET case, PUT case (rename, archive, etc.), POST/DELETE case. See [workspace_api_usage.md § Cases](workspace_api_usage.md#1-cases). |
| **Try** | Search config for a case (escape_query, field_spec, number_of_rows, query_params, search_endpoint, etc.) | GET tries, POST try, PUT try, DELETE try, clone try. See [workspace_api_usage.md § Tries](workspace_api_usage.md#2-tries-search-configuration). |
| **Queries** | Query text, display order, notes, options per case | GET queries (bootstrap), POST query / bulk queries, PUT notes/options/position, DELETE query, move. See [workspace_api_usage.md § Queries](workspace_api_usage.md#3-queries). |
| **Ratings** | Document ratings per query (query_id, doc_id, rating value) | Embedded in query bootstrap; mutate via PUT ratings, PUT/DELETE bulk ratings. See [workspace_api_usage.md § Ratings](workspace_api_usage.md#4-ratings) and [data_mapping.md](data_mapping.md). |
| **Settings** | Effective “current try” and related UI-facing config derived from Try | Set by selecting a try; changing try = new GET for that try’s data. No separate “settings” resource; try is the setting. |

**Principles:**

- All reads: server-rendered or Turbo Frame/Stream responses from Rails.
- All writes: form submissions or Turbo Streams / fetch to Rails controllers; no client-side “store” that then syncs later (except optional optimistic UI that reconciles with server response).
- URLs reflect server state: e.g. `/case/:id/try/:try_number` so the try is part of the page context.

---

## 2. Client-only state (minimal)

Only transient UI state that is not persisted and does not need to be shared across reloads or devices. Managed by **Stimulus** controllers (values in data attributes or small in-memory state).

| State | Description | Where / how |
|-------|-------------|-------------|
| **Collapsed panels** | East/west or other panels collapsed vs expanded | `workspace_panels_controller.js`; persisted in `localStorage` per case ID. |
| **Selected query** | Which query is currently selected in the list for the results pane | Stimulus (or Turbo Frame `src`/URL so the frame’s URL can reflect selection). Can be reflected in URL or frame for shareability if desired. |
| **Diff toggles** | Show/hide diff view, which snapshot to diff against | Stimulus; diff content itself comes from server (snapshot, search). |
| **Modal open/closed** | Export, clone, share, import, etc. | Stimulus (or Turbo Frame modals that open/close by toggling visibility or frame target). |
| **Keyboard / focus** | Which element has focus, shortcut state | Browser + Stimulus; no server round-trip. |
| **Transient form state** | Unsaved text in an input (e.g. “add query” before submit) | Stimulus; on submit, server state is updated and response drives the UI. |

**Principles:**

- No domain data lives only on the client (e.g. “current case” comes from the page/URL and server response).
- Client state is for UX only: what’s expanded, what’s selected, what’s open. If we need to remember it across sessions, it becomes server state (e.g. user preference) or optional `localStorage` for convenience.

---

## 3. Turbo Frame regions

The workspace page is split into **Turbo Frame** regions. See **[turbo_frame_boundaries.md](turbo_frame_boundaries.md)** for the full mapping of frame IDs and implementation status. Each region can be updated independently via Turbo Streams or frame navigation (e.g. `target` or `src`), so the server can push updates to specific areas without full page reload.

| Region | Purpose | Update mechanism |
|--------|---------|-------------------|
| **Query list** | List of queries for the case/try; add, remove, reorder, select | Turbo Frame with `id` (e.g. `query_list`). Updates: full frame replace on add/delete/reorder; or Turbo Stream `append`/`replace`/`remove`. Selection can drive results frame `src`. |
| **Results pane** | Search results and ratings for the selected query | Turbo Frame (e.g. `results_pane`) with `src` pointing to results URL for current query (and try). Reload on query select or on rating change (Turbo Stream or frame refresh). |
| **Side panels** | East/west panels (e.g. annotations, snapshot list, options) | Each panel in its own Turbo Frame; lazy load via `src` when opened; Turbo Streams to update content when server data changes. |
| **Modals** | Export, clone, share, import ratings, etc. | Modal content in a Turbo Frame (or Stimulus-revealed partial). Open: load frame `src` or show server-rendered partial. Submit: form POST; response can be Turbo Stream (e.g. close modal, flash, redirect). |

**Principles:**

- Each frame has a clear responsibility and a corresponding server action (controller + view/ViewComponent) that can render that frame’s HTML.
- Prefer **Turbo Streams** for real-time updates (e.g. after rating a doc, stream updated score into the query list and results pane) so multiple regions can update in one response. See [turbo_streams_guide.md](turbo_streams_guide.md) for actions and patterns.
- Use **frame `src`** for lazy loading and for “navigate within workspace” (e.g. select query → results frame loads new `src`). Use relative URLs — see [api_client.md](api_client.md) for URL building rules.

---

## 4. Summary diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Workspace page (Option A)                                               │
├─────────────────────────────────────────────────────────────────────────┤
│  SERVER STATE (authoritative)                                            │
│  case, try, queries, ratings, settings → Rails controllers, API          │
│  All CRUD via server; client renders server response.                    │
├─────────────────────────────────────────────────────────────────────────┤
│  TURBO FRAME REGIONS                                                     │
│  ┌──────────────┐ ┌─────────────────┐ ┌──────────────┐ ┌──────────────┐ │
│  │ query list   │ │ results pane    │ │ side panels  │ │ modals       │ │
│  │ (frame)      │ │ (frame, src=…)  │ │ (frames)     │ │ (frames)     │ │
│  └──────────────┘ └─────────────────┘ └──────────────┘ └──────────────┘ │
│  Updates: Turbo Streams / frame navigation / form POST → server response  │
├─────────────────────────────────────────────────────────────────────────┤
│  CLIENT-ONLY STATE (Stimulus)                                            │
│  collapsed panels, selected query (optional), diff toggles, modal open    │
└─────────────────────────────────────────────────────────────────────────┘
```

This design keeps the migration aligned with Option A: one stack (Rails + Stimulus + Turbo + ViewComponents), server as source of truth, and minimal client state for UI only.

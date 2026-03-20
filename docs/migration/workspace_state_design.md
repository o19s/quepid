# Workspace state design (core case UI)

**Where state lives** when the core case workspace is Rails-driven: server as source of truth, minimal client-only UI state, Turbo only where it reduces full-page churn.

**Related:** execution and phases in [angularjs_elimination_plan.md](../angularjs_elimination_plan.md) and [rails_stimulus_migration_alternative.md](../rails_stimulus_migration_alternative.md); Angular-era behavior today in [workspace_behavior.md](../workspace_behavior.md). **HTTP surface:** [workspace_api_usage.md](workspace_api_usage.md). **Frame/stream mechanics:** [turbo_frame_boundaries.md](../turbo_frame_boundaries.md), [turbo_streams_guide.md](../turbo_streams_guide.md).

---

## 1. Server state (authoritative)

Domain and persisted data live on the server. The browser shows what Rails (and JSON responses) provide; mutations go through forms, `fetch` to the existing **`api/...`** JSON API, or Turbo responses—not a long-lived client replica.

| State | Role | See |
|-------|------|-----|
| **Case** | Metadata, scorer, tries, team/book links | [workspace_api_usage §1](workspace_api_usage.md#1-cases) |
| **Try** | Search config per case | [§2 Tries](workspace_api_usage.md#2-tries-search-configuration) |
| **Queries** | Text, order, notes, options | [§3 Queries](workspace_api_usage.md#3-queries) |
| **Ratings** | Per query/doc; often embedded in query bootstrap | [§4 Ratings](workspace_api_usage.md#4-ratings), [data_mapping.md](../../data_mapping.md) |
| **Current try** | Effective try for the page | Navigation or server action loads that try—avoid a second hidden “settings” source of truth |

**Principles**

- **Reads:** Server-rendered HTML; optional Turbo Frame/Stream fragments from Rails.
- **Writes:** Forms, JSON API, or Turbo Streams—optimistic UI is fine if it **reconciles** with the response.
- **URLs** should reflect server context (e.g. case + try) so reload and sharing stay coherent.

---

## 2. Client-only state (minimal)

Transient UI only: **Stimulus** (`data-*` values, small controller state). Nothing here should be the only copy of domain data.

| State | Examples | Handling |
|-------|----------|----------|
| **Layout** | Collapsed panels, toolbar sections | Stimulus; optional `localStorage` per case |
| **Selection** | Selected query driving the results pane | URL param, frame navigation, or Stimulus—**one** strategy per slice so back/forward stays predictable |
| **Toggles** | Diff mode, “rated only,” snapshot pick | Stimulus and/or URL params; data still from server |
| **Modals** | Export, clone, share, import | [ui_consistency_patterns.md](../ui_consistency_patterns.md) |
| **Focus / shortcuts** | Keyboard, focus ring | Browser + Stimulus |
| **Drafts** | Text before submit | Stimulus until submit commits server-side |

If it must survive sessions for real, it belongs in **server state** or explicit user preferences—not ad hoc caches.

---

## 3. Turbo Frames and Streams

Use **Frames** to carve regions that can load or navigate independently (query list, results pane, lazy regions). Use **Streams** when one action should update **several** DOM targets in one response (e.g. list + header score).

- Each region should have a clear **server owner** (action + partial) that can render that fragment alone.
- Keep URLs **relative** for deploy flexibility: [api_client.md](../api_client.md).
- Concrete frame IDs, broadcast channels, and stream-heavy flows: [turbo_frame_boundaries.md](../turbo_frame_boundaries.md) and [turbo_streams_guide.md](../turbo_streams_guide.md).

---

## 4. Layer sketch

```
┌──────────────────────────────────────────────────────────────┐
│  Core workspace (Rails + Stimulus + optional Turbo)          │
├──────────────────────────────────────────────────────────────┤
│  SERVER: case, try, queries, ratings → Rails + api/...       │
├──────────────────────────────────────────────────────────────┤
│  TURBO (optional): query list │ results │ panels │ modals     │
├──────────────────────────────────────────────────────────────┤
│  CLIENT (Stimulus): collapse, selection UX, toggles, drafts  │
└──────────────────────────────────────────────────────────────┘
```

Rails hosts persisted state and APIs; Stimulus holds ephemeral UX; Turbo is optional glue where it clearly reduces churn.

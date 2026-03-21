# Workspace state design (core case UI)

**Where state lives** under the **parity plan** for a Rails-first core case workspace ([angularjs_elimination_plan.md](./angularjs_elimination_plan.md)). This page is **target architecture**, not a line-by-line map of every file on `main`.

**Implemented today (two surfaces):** [workspace_behavior.md](./workspace_behavior.md) — **Angular `case_core`** (full client loop: `docCacheSvc`, splainer-search, `ScorerFactory`, `queriesSvc` scoring events) vs **experimental `new_ui`** (smaller client: `modules/search_executor`, shared try-config fetch in `query_row_controller.js`, per-row `modules/ratings_store.js`, `modules/scorer.js` for badge colors only—no case-wide in-browser scorer pipeline yet). See [workspace_behavior.md §6](./workspace_behavior.md#6-experimental-stimulus-workspace-new_ui).

**Authoritative on the server:** persisted case, try, queries, ratings (via JSON APIs), exports/imports, snapshots metadata — same contracts Angular uses today ([workspace_api_usage.md](./workspace_api_usage.md)).

**Substantial client state (full parity target):** Ephemeral search hits, doc cache, interactive scoring, query-list UI toggles, optimistic ratings — more than “Stimulus-only micro-state,” not a full DB replica. **`new_ui` today** covers only part of this row; expand toward the same responsibilities as the Angular workspace as the port proceeds. **Why that split and when it may change:** [angularjs_elimination_plan.md](./angularjs_elimination_plan.md) (including [Browser DevTools / `/proxy/fetch`](./angularjs_elimination_plan.md#browser-devtools-visibility-and-proxyfetch)); signed-off product deltas: [intentional_design_changes.md](./intentional_design_changes.md) §2.

**Turbo Frames/Streams:** optional shell/fragment updates — see [turbo_frame_boundaries.md](./turbo_frame_boundaries.md) and [turbo_streams_guide.md](./turbo_streams_guide.md); not the default stand-in for the in-browser result loop unless scope explicitly changes ([angularjs_elimination_plan.md](./angularjs_elimination_plan.md)).

---

## 1. Server state (authoritative)

Domain **persistence** lives on the server. Mutations go through `fetch` to the existing **`api/...`** JSON API (or forms/Turbo where you introduce them). The browser still holds **ephemeral** search hits, scorer output, and UI caches for parity with the current Angular workspace — see intro above.

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

## 2. Client state (UI + parity-heavy)

**Stimulus / React / plain modules:** route-driven selection, pane layout, modals, expand/collapse, diff toggles, **and** the splainer/scorer/doc-cache layer that backs results and scores between API round-trips. Persisted ratings and case metadata still **save through the API**; the client may mirror them for responsiveness like Angular does today.

| State | Examples | Handling |
|-------|----------|----------|
| **Layout** | Collapsed panels, toolbar sections | Stimulus; optional `localStorage` per case |
| **Selection** | Selected query driving the results pane | URL param, frame navigation, or Stimulus—**one** strategy per slice so back/forward stays predictable |
| **Toggles** | Diff mode, “rated only,” snapshot pick | Stimulus and/or URL params; data still from server |
| **Modals** | Export, clone, share, import | [ui_consistency_patterns.md](./ui_consistency_patterns.md) |
| **Focus / shortcuts** | Keyboard, focus ring | Browser + Stimulus |
| **Drafts** | Text before submit | Stimulus until submit commits server-side |
| **Live search & scores** | Result lists, scorer output, doc cache | Plain JS modules + Stimulus/React glue — **parity** with Angular (`splainer-search` + `ScorerFactory` today); **`new_ui`** uses **`modules/search_executor`** and **`modules/scorer.js`** (display helpers) plus API ratings, not the full Angular scorer graph yet |

If it must **survive reloads or sessions** as the only copy, it belongs in **server state** or user preferences — not undocumented `localStorage`.

---

## 3. Turbo Frames and Streams

Use **Frames** to carve regions that can load or navigate independently (query list, results pane, lazy regions). Use **Streams** when one action should update **several** DOM targets in one response (e.g. list + header score).

- Each region should have a clear **server owner** (action + partial) that can render that fragment alone.
- Keep URLs **relative** for deploy flexibility: [api_client.md](./api_client.md).
- Concrete frame IDs, broadcast channels, and stream-heavy flows: [turbo_frame_boundaries.md](./turbo_frame_boundaries.md) and [turbo_streams_guide.md](./turbo_streams_guide.md).

---

## 4. Layer sketch (parity)

```
┌──────────────────────────────────────────────────────────────┐
│  Core workspace — Rails shell + Stimulus/React + plain JS     │
├──────────────────────────────────────────────────────────────┤
│  SERVER: persisted case / try / queries / ratings → api/...   │
├──────────────────────────────────────────────────────────────┤
│  CLIENT (plain JS): search exec + scorer/doc cache (Angular:     │
│    splainer + ScorerFactory; new_ui: search_executor + ratings)  │
├──────────────────────────────────────────────────────────────┤
│  CLIENT (Stimulus/React): layout, modals, toggles, selection   │
├──────────────────────────────────────────────────────────────┤
│  TURBO (optional): fragments, flash, notifications, some lists  │
└──────────────────────────────────────────────────────────────┘
```

Rails owns **persistence**; the **interactive** search/score loop stays **browser-side** for parity; Turbo is additive where a slice opts in.

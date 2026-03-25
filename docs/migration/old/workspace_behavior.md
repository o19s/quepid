# Workspace behavior reference

> **What this doc is:** Differences from the **removed** Angular case workspace, known **gaps**, and **architecture** choices. For the full capability matrix (what exists, parity vs intentional vs backlog), use **[new_ui_capabilities.md](./new_ui_capabilities.md)** (it still says `new_ui` in places but applies to the **default** `/case/...` workspace).
>
> **Where it lives:** `GET /case/:id(/try/:try_number)` → `CoreController#index` (`case_core`), **`layouts/core.html.erb`**, **`app/views/core/`**, Stimulus + importmap **`application_modern`**. **APIs:** [workspace_api_usage.md](./workspace_api_usage.md), [api_client.md](./api_client.md). **Archived elimination plan:** [old/angularjs_elimination_plan.md](./old/angularjs_elimination_plan.md).

---

## Intentional differences vs legacy Angular

- **Search on load:** Results are **lazy** (expand a row) unless the user runs **Run all** (`query-list#runAllSearches`). Legacy ran **`searchAll()`** for every query on entry.
- **Add query:** Success path **`window.location.reload()`** (`add-query`). Legacy refreshed the list **in place** without a full reload.

---

## Known gaps (backlog)

- **Match breakdown:** Legacy could show explain on hits without an explicit toggle in some cases; new UI uses an opt-in **Match breakdown** control unless product adds “always include breakdown.”

Treat **case-level actions** (every modal in the header bar) as **audit individually** in that doc—some rows are still **gap** vs **parity**.

---

## Architecture (not legacy parity)

- **Interactive search** runs in the **browser** (`modules/search_executor`, optional **`proxy/fetch`**). There is **no** **`QuerySearchService`** (or equivalent) under **`app/services`** for this UI—see [intentional_design_changes.md](./intentional_design_changes.md) §2.
- **`layouts/core.html.erb`** does **not** use **`turbo_stream_from(:notifications)`**; the try workspace does not consume live pushes the way home/books notification subscribers do. Background jobs still broadcast for UIs that subscribe—see [turbo_streams_guide.md](./turbo_streams_guide.md).

---

## Related docs

- [ui_consistency_patterns.md](./ui_consistency_patterns.md), [stimulus_and_modern_js_conventions.md](../stimulus_and_modern_js_conventions.md)
- [visual_parity.md](../visual_parity.md) — screenshot/API smoke (not the capability contract)
- **Judgements form** (Book flow, keyboard shortcuts): `app/views/judgements/_form.html.erb` (unchanged Rails partial)

---

## Legacy Angular workspace

The Angular case UI has been **removed**. For historical behavior (flows, services, flash tables), use **git history** or **`docs/migration/old/`** (e.g. elimination plan and archived inventories).

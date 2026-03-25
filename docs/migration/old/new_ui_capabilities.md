# Stimulus workspace — capability reference

**Purpose:** Single place to record the **user-facing capabilities** of the Stimulus-based case/try workspace. Originally tracked parity against the now-removed AngularJS UI; kept as the authoritative capability inventory. For visual-level checks see [visual parity tooling](../visual_parity.md).

**Route:** `GET /case/:id(/try/:try_number)` → `core#index` — shell partials under `app/views/core/`, behavior in Stimulus under `app/javascript/controllers/` and `app/javascript/modules/`.

---

## Query list (above rows)

| Capability | Status | Notes |
|------------|--------|--------|
| Add query (single / bulk semicolons) | **done** | Stimulus `add-query` controller. |
| Show only rated | **done** | Checkbox + text control in `_query_list_shell`; `change` event on the box + link toggles in `query-list` (see `query_workspace.css` for 14px checkbox sizing). |
| Collapse all | **done** | |
| Sort (manual, name, modified, score, errors) | **done** | URL-synced via `history.replaceState()` in `query_list` controller. Manual sort uses SortableJS with drag-revert on API failure. |
| Reverse sort | **done** | URL-synced alongside sort direction. |
| Filter query text | **done** | |
| Pagination (client) | **done** | 15 per page. |
| **Run all** searches | **done** | Explicit toolbar link; lazy-expand model means queries are only searched on expand unless Run All is clicked. |
| Frog **Report** link | **done** | Present in shell. |

---

## Expanded query row — actions

| Capability | Status | Notes |
|------------|--------|--------|
| **Score All** (bulk rate / clear) | **done** | Dropdown + same scale. |
| **Copy** query | **done** | Icon (`bi-clipboard`). |
| **Toggle Notes** | **done** | Button + icon. |
| **Explain Query** (modal: parsing / params / template) | **done** | Button → modal; may **one-off debug fetch** if payload missing. **Query Template** tab uses `search_executor`'s **`renderedTemplate`** (Solr: exact hydrated GET URL; ES/OS: pretty-printed JSON body). |
| **Per-doc match breakdown** (explain) | **done** | **Match breakdown** button (layers icon) toggles **debug** re-search. Explicit opt-in so we do not always pay debug cost on lazy search. |
| **Missing Documents** | **done** | `doc-finder` modal. |
| **Set Options** (JSON → `qOption` merge) | **done** | Modal (`query-options-modal`). Save triggers row **re-search** via `query-options-saved`. |
| **Move Query** | **done** | Modal + `PUT …/queries/:id`. **Moves** the query to **another case**. Success removes row; `query-moved-away` updates list scores. |
| **Delete Query** | **done** | **Removes** the query from **this** case only (distinct from Move). |

---

## Case-level actions (header / action bar)

| Capability | Status | Notes |
|------------|--------|--------|
| Select scorer | **done** | |
| Judgements | **done** | |
| Snapshot | **done** | |
| Diff | **done** | |
| Import | **done** | |
| Share | **done** | `share-case` controller wired in `_action_bar.html.erb`; modal rebuilds team dropdown on open. |
| Clone | **done** | |
| Delete | **done** | |
| Export | **done** | |
| Tune relevance | **done** | |
| Case score / sparkline | **done** | `case-score` controller. Layout: `_case_header.html.erb` wraps score + title in `.case-header-body` with flex (`query_workspace.css`). |

---

## Implementation notes (hardening)

- **`query-list`** normalizes `queryId` from bubbled / document events (`string` vs `number`) before updating `queryScores` or finding outlets for **`query-options-saved`**.
- **`query-options-modal`** sets `this.queryId` only **after** a successful GET so **Save** cannot PUT to the wrong query if load fails or races; **Save** rejects non-object JSON (arrays / primitives).
- **`move-query-modal`** resets the empty-state copy on each open and shows an in-modal message if the cases list **fetch** fails (in addition to flash).

---

## Tests (Vitest)

Guards for the contract live beside the code:

- `query_list_controller.test.js` — `query-options-saved` → `rerunSearch` on matching row; `query-moved-away` → same score cleanup as delete.
- `query_row_controller.test.js` — `explainQuery` dispatches `show-query-explain` (with/without extra debug fetch); `toggleDocExplain` flips `debugMode` and re-runs search.
- `query_options_modal_controller.test.js` — load options JSON, save valid/invalid.
- `move_query_modal_controller.test.js` — list cases, confirm move dispatches removal + API.

Run: `bin/docker r yarn test` (see [DEVELOPER_GUIDE.md](../../DEVELOPER_GUIDE.md)).

---

## Related docs

- [workspace_behavior.md](./workspace_behavior.md) — intentional differences, known gaps, and architecture.
- [visual_parity.md](../visual_parity.md) — screenshot/API smoke harness.
- [angularjs_elimination_plan.md](./old/angularjs_elimination_plan.md) — phased work and P0 scope (archived).

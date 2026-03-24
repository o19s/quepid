# New UI (`new_ui`) vs Angular — capability contract

**Purpose:** Single place to record whether a **user-facing capability** exists on the Stimulus workspace, how it compares to Angular, and whether any gap is **backlog** or **intentional**. This is the parity **contract** for the case/try workspace—not pixel-level screenshots (see [visual parity tooling](../visual_parity.md)).

**Route:** `GET /case/:id(/try/:try_number)/new_ui` — shell partials under `app/views/core/`, behavior in Stimulus under `app/javascript/controllers/` and `app/javascript/modules/`.

**Legend**

| Status | Meaning |
|--------|---------|
| **parity** | Same outcome for the user; implementation may differ (lazy fetch, explicit toggles). |
| **intentional** | Deliberately different UX or timing; documented here. |
| **gap** | Not yet implemented or known missing vs Angular; track or close explicitly. |

---

## Query list (above rows)

| Capability | Angular | New UI | Status | Notes |
|------------|---------|--------|--------|--------|
| Add query (single / bulk semicolons) | Yes | Yes | **parity** | Stimulus `add-query`; may reload vs in-place refresh. |
| Show only rated | Yes | Yes | **parity** | Checkbox + text control like Angular (`_query_list_shell`); `change` event on the box + link toggles in `query-list` (see `query_workspace_new_ui.css` for 14px checkbox sizing). |
| Collapse all | Yes | Yes | **parity** | |
| Sort (manual, name, modified, score, errors) | Yes | Yes | **parity** | Manual sort gated by same server flag where applicable. |
| Filter query text | Yes | Yes | **parity** | |
| Pagination (client) | Varies | Yes (15/page) | **parity** | |
| **Run all** searches | Implicit / background on many flows | Explicit toolbar link | **intentional** | Lazy expand model; **Run all** matches bulk refresh need. |
| Frog **Report** link | Often in list chrome | Present in shell | **parity** | Placement may differ slightly. |

---

## Expanded query row — actions

| Capability | Angular | New UI | Status | Notes |
|------------|---------|--------|--------|--------|
| **Score All** (bulk rate / clear) | Column + popover pattern | Dropdown + same scale | **parity** | |
| **Copy** query | Icon | Icon (`bi-clipboard`) | **parity** | |
| **Toggle Notes** | Button | Button + icon | **parity** | |
| **Explain Query** (modal: parsing / params) | Button → modal | Button → modal; may **one-off debug fetch** if payload missing | **parity** | New UI does not keep a long-lived `searcher` object. |
| **Per-doc match breakdown** (stacked “Matches” / explain) | Column when engine returns explain | **Match breakdown** button (layers icon) toggles **debug** re-search | **parity** | Explicit opt-in so we do not always pay debug cost on lazy search. |
| **Missing Documents** | Doc finder | Same concept (`doc-finder` modal) | **parity** | |
| **Set Options** (JSON → `qOption` merge) | Modal | Modal (`query-options-modal`) | **parity** | Save triggers row **re-search** via `query-options-saved`. |
| **Move Query** | Modal + `PUT …/queries/:id` | Same API | **parity** | **Moves** the query to **another case** (not the same as delete). Success removes row here; `query-moved-away` updates list scores. |
| **Delete Query** | Yes | Yes | **parity** | **Removes** the query from **this** case only (distinct from Move Query). |
| Per-row **Re-run** | Not on `searchResults.html` toolbar | Not on row toolbar | **parity** | Use **Run all** or re-expand / options-save refresh. |

---

## Case-level actions (header / action bar)

| Capability | Angular | New UI | Status | Notes |
|------------|---------|--------|--------|--------|
| Select scorer, judgements, snapshot, diff, import, share, clone, delete options, export, tune relevance | Yes | Mostly ported to Stimulus modals / panels | **parity** / **gap** | Treat each modal as its own row when auditing; see elimination plan. |
| Case score / sparkline | `qscore-case` | `case-score` controller | **parity** | Layout: `_case_header.html.erb` wraps score + title in `.case-header-body` with flex (`query_workspace_new_ui.css`) so the badge stays left of the title like Angular. Visual nuance may differ. |

---

## Known gaps (backlog)

| Item | Notes |
|------|--------|
| **Explain modal — templated Solr “render template”** | Angular `query_explain` can call `searcher.renderTemplate()` for the template tab; Stimulus modal may not fully replicate every edge case until ported. |
| **Per-doc “Matches” without toggle** | Angular sometimes has explain on docs without a labeled toggle (depends on searcher). We use an explicit **Match breakdown** control; optional future **case/user setting** “always include match breakdown” if product wants zero-click parity. |

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

- [workspace_behavior.md](./workspace_behavior.md) — narrative behavior comparison.
- [visual_parity.md](../visual_parity.md) — screenshot/API smoke harness, not the capability matrix.
- [angularjs_elimination_plan.md](./angularjs_elimination_plan.md) — phased work and P0 scope.

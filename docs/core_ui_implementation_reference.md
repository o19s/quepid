# Core UI Implementation Reference

> **Role:** Deep internals for the `/case/...` workspace — quirks, edge cases, and field maps removed from [`QUEPID_COREUI_FEATURES.md`](./todo/QUEPID_COREUI_FEATURES.md) during condensation. **Behavior/UX** stays in COREUI §1–22. **Frontend cleanup** is tracked in [`todo.md`](./todo/todo.md#frontend-cleanup-after-angular-removal).

Source of truth is always the code; update this doc when you change the listed files.

---

## 1. Shepherd post-wizard tour (`tour.js`)

After the case wizard closes, `setupAndStartTour()` runs (1.5s `setTimeout` from `wizard_controller.js`, only when `!currentUser.completedCaseWizard`). Uses **Shepherd.js** with `shepherd-theme-arrows`, `scrollTo: true`.

| Step id | Title | Attach | Advance |
|---------|-------|--------|---------|
| `case-header` | Case Header | `#case-header bottom` | Next button |
| `case-score` | Case Score | `.case-score right` | Next button |
| `add-query` | Add Query | `form[data-controller="add-query"] right` | **`advanceOn`:** `#add-query-submit click` |
| `queries` | Queries | `ul.results-list-element top` | Next button |
| `case-actions` | Case Actions | `#case-actions bottom` | Next button |
| `tune-relevance` | Tune Relevance | `#tune-relevance-link bottom` | **`advanceOn`:** `#tune-relevance-link a click` |
| `tune` | Tune Relevance | `.pane_east left` | Next button (also `advanceOn` on tune link — opens pane) |
| `rerun-search` | Rerun Search | `#query-sandbox-action top` | **`advanceOn`:** `#query-sandbox-action click` |
| `done` | TADA! | (floating) | Finish button |

**Engine-specific tune hints** (step `tune`): Solr example `q=#$query##&defType=edismax&qf=title overview`; ES/OpenSearch JSON `match` on `title`; Algolia `restrictSearchableAttributes`.

**Dead code path:** `$(document).ready()` starts the tour when `[data-trigger-tour]` exists — no template sets that attribute today.

**Wizard gating** (when the tour runs): [COREUI §14](./todo/QUEPID_COREUI_FEATURES.md#14-wizard--onboarding).

**File:** `app/javascript/tour.js`

---

## 2. Live-query runtime quirks (formerly `queriesSvc`)

The old monolithic `queriesSvc` is now split across small modules under `app/javascript/utils/`. `live_query_runtime_owner.js` wires them together.

| Concern | File |
|---------|------|
| Query object defaults (`queryId: -1`, `lastScoreVersion: -5`, `ratingsReady`, …) | `live_query_factory.js` |
| `persisted()`, `score()`, `version()` | `query_model.js` |
| Request shapes and `persist()` (create, bulk create, position, delete, move) | `query_lifecycle.js` |
| Commit persisted responses into the local collection | `live_query_lifecycle.js` |
| `search()`, `refreshRatedDocs()`, `ratedPaginate()` | `query_runtime.js`, `query_service.js` |
| Display order, drag-position math | `query_state.js` |

### Query identity & scoring cache

| Property / method | Notes |
|-------------------|--------|
| `queryId === -1` | Unpersisted query (`createQuery`) |
| `persisted()` | `queryId` is truthy and `>= 0` |
| `lastScoreVersion = -5` | Sentinel so first `score()` always runs |
| `score()` | If `lastScoreVersion === version()`, resolves the cached `currentScore` without re-running the scorer |
| `version()` | local `version` counter (bumped by `setDirty()`) + `ratingsStore.version()` |

### Persisting queries

- **Single create:** `POST api/cases/{caseNo}/queries` (`persistQuery`). `commitSingleQuery` treats **HTTP 204** as "already exists server-side" (races/retries): it skips the response body (no `display_order`, no `queryId` assignment) and goes straight to search + score. Otherwise it applies `display_order`, sets `queryId`, and registers the query.
- **Bulk create:** `POST api/bulk/cases/{caseNo}/queries` (`persistQueries`). `commitQueries` **clears** the whole local collection, then rebuilds from the response via `addQueriesFromResponse` and runs `searchAll()`. A search failure is returned as `{ searchError }`, not thrown.
- `persist()` throws the parsed error body when the response is not `ok`.

### `search()` when the searcher is `inError`

When `searcher.search()` completes but `searcher.inError` is true, `searchQuery()` (`utils/query_service.js`) clears the docs, reports `"Please click browse to see the error"` through `onError`, and **rejects** with the parsed search error (or that message). HTTP failures on the primary searcher also reject (via the framework-free search-error utility, see [COREUI §20](./todo/QUEPID_COREUI_FEATURES.md#20-error-handling)). Snapshot-backed queries (`query_runtime.js`) behave the same way, with `Snapshot not found: {id}` / `Failed to load snapshot: {id}` messages. Search architecture & `pAll`: [COREUI §11](./todo/QUEPID_COREUI_FEATURES.md#11-search-engine-abstraction).

### Rated docs: replace vs append

| Method | Behavior |
|--------|----------|
| `refreshRatedDocs(pageSize?)` | Builds a rated-docs searcher, **replaces** `ratedDocs` / `ratedDocsFound`, sets `ratingsReady = true`. SearchAPI tries use `searchApiRatedDocsLookup` instead (`ratedDocsUnsupported` when the try/mapper can't look up by id; empty rated-id list short-circuits to empty) |
| `ratedPaginate()` | `ratedSearcher.pager()` then **concat** to `ratedDocs` |

- **In-flight dedupe:** `refreshRatedDocs` returns the existing `query.ratingsPromise` while one is pending.
- **Race guard:** `invalidateRatedDocsCache()` (`query_state.js`) sets `ratingsReady = false` and bumps `ratingsGeneration`; it deliberately leaves an in-flight lookup attached. A response whose generation is stale is discarded and the lookup is re-run.
- The rated searcher is only searched by `refreshRatedDocs()`; `live_query_runtime_owner.js` triggers it when a query isn't `ratingsReady` (scoring path).

### Position updates

`PUT api/cases/{caseNo}/queries/{queryId}/position` with `{ after: previousQueryId, reverse: boolean }`. This is issued by `queries_list_controller.js#dragEnd` (SortableJS), not the runtime; `positionRequest` in `query_lifecycle.js` documents the same contract. `reverse` is flipped when dragging upward (`newIndex < oldIndex`). On success the controller applies the returned `display_order` (`setDisplayOrder`) and re-renders; on failure it restores the dragged order and flashes "Unable to reorder queries." `orderedQueries()` walks `displayOrder` and sets `defaultCaseOrder` on each query.

---

## 3. Try model & settings pipeline

**Files:** `app/javascript/utils/settings_runtime.js` (`createTry()` / `createSettingsRuntime()`), `app/javascript/utils/curator_vars.js`, `app/javascript/utils/tune_relevance.js`, `app/javascript/controllers/tune_relevance_controller.js`. The Angular `TryFactory` and `SettingsCtrl` no longer exist.

### API ↔ JS property map (`createTry()`)

Also mapped by `createTry()` and not listed below: `json_query_params` → `jsonQueryParams`, and the `mapper_based_search_engine_*` fields (`id`, `name`, `supports_pagination`, `pagination_hits_param`, `pagination_offset_param`, `supports_rated_docs_lookup`) → `mapperBasedSearchEngine*`. `rename(name)` does its own `PUT api/cases/:caseNo/tries/:tryNo`.


| API (snake_case) | JS property | Notes |
|------------------|-------------|--------|
| `try_number` | `tryNo` | |
| `name` | `name` | Shown as-is |
| `query_params` | `queryParams` | `null` → `''` (Solr) or `'{}'` (others) |
| `search_engine` | `searchEngine` | |
| `search_url` | `searchUrl` | |
| `search_endpoint_id` | `searchEndpointId` | |
| `endpoint_name` | `endpointName` | |
| `field_spec` | `fieldSpec` | |
| `number_of_rows` | `numberOfRows` | |
| `escape_query` | `escapeQuery` | |
| `api_method` | `apiMethod` | |
| `custom_headers` | `customHeaders` | |
| `basic_auth_credential` | `basicAuthCredential` | |
| `mapper_code` | `mapperCode` | SearchAPI |
| `proxy_requests` | `proxyRequests` | |
| `requests_per_minute` | `requestsPerMinute` | Rate limit for `pAll` ([COREUI §11](./todo/QUEPID_COREUI_FEATURES.md#11-search-engine-abstraction)) |
| `endpoint_archived` | `endpointArchived` | |
| `options` | `options` | |
| `curator_vars` | `curatorVars` | Dict → `[{name, value}]` array; reverse via `curatorVarsDict()` |
| `args` | `args` | |

Saving builds the request body in `payloadFor()` (`settings_runtime.js`): `{ try: { escape_query, field_spec, number_of_rows, query_params, search_endpoint_id }, parent_try_number, curator_vars }`. When the try has no `searchEndpointId`, a nested `search_endpoint` object (engine, URL, method, headers, credentials, `mapper_code`, `proxy_requests`, optional `mapper_based_search_engine_id`) is sent instead. `save()` POSTs a new try; `update()` PUTs the current one. Both dispatch `case-settings:updated` and navigate to the resulting try. New curator vars default to value **10**. `updateVars()` re-parses `##varName##` from query params on every change.

### `extractCuratorVars()`

1. Strip `#$query##` (magic — not shown as tuning knob)
2. Strip `#$keyword\d+##` (legacy keyword slots)
3. Match `/##[^#]*?##/g`
4. Extract inner name via `/##([^#]*)##/`
5. Return array of var names

### Doc-list ID validation (`createDocList`)

`createDocList` in `live_query_read_models.js`: missing ID → fake id + `ID Field Missing`. Duplicate ID → fake id + `ID "…" Shared With Another Doc`. User-facing HTML error via `hasErrors()` / `errorMsg()`.

### Settings JSON validation (`tune-relevance` controller, "Rerun My Searches!")

| Engine | Validates JSON? |
|--------|-----------------|
| Engines where `usesJsonQueryParams(engine)` is true (ES, OS, Vectara, Algolia, …) | Always `formatJson` (`JSON.parse`) |
| SearchAPI | JSON only if trimmed query params start with `{` |
| Solr | No JSON validation (URL key-value) |

Valid JSON is auto-pretty-printed with 2-space indent. Number of rows must be 1–100 (`validateNumberOfRows`). Invalid JSON shows "Please provide a valid formatted JSON object for the query DSL." and aborts the save.

---

## 4. `bulk_judgement_controller` (Stimulus)

**File:** `app/javascript/controllers/bulk_judgement_controller.js` — Books bulk judge UI. Shares visual patterns (`btn-preselected`, Bootstrap rating buttons).

| Target / value | Purpose |
|----------------|---------|
| `rating`, `explanation`, `status`, `savedIndicator` | DOM targets |
| `bookId` | String value for URL paths |

### Endpoints

- **Save rating/explanation:** `POST books/{bookId}/judge/bulk/save` — `{ query_doc_pair_id, rating, explanation }` + CSRF
- **Reset:** `DELETE books/{bookId}/judge/bulk/delete` — `{ query_doc_pair_id }`; **404 treated as success**

### Status states (`showStatus`)

| State | Display | Clears? |
|-------|---------|--------|
| `saving` | Yellow spinner + "Saving..." | No |
| `saved` | Green check + "Saved" | Auto after 2s |
| `reset` | Info + "Reset" | Auto after 2s |
| `error` | Red + "Error saving" | No |
| `typing` | Muted pencil + "Typing..." | Until debounce flush |
| `""` | Cleared | — |

**Explanation save:** 1000ms debounce on `saveExplanation`. Skips POST if both rating and explanation empty. Optimistic UI: rating click updates buttons immediately, injects Reset button if missing.

Status rendering goes through `showStatusMessage` (`utils/status_message.js`). **HTTP:** the `api/json` verb helpers, which add CSRF (see [`DEVELOPER_GUIDE.md` § Stimulus HTTP conventions](../DEVELOPER_GUIDE.md#stimulus-http-conventions)).

---

## 5. Rails controller behaviors (case page)

### `CoreController` — SPA shell

**File:** `app/controllers/core_controller.rb`

**`set_case_or_bootstrap`:**
- Explicit case: `current_user.cases_involved_with.where(id: params[:id]).first` — no exception if missing
- Fallback: `cases_involved_with.not_archived.last`
- If no case resolves either way, redirects to `case_new_path`
- Try: `params[:try_number]` → that try, else `@case.tries.latest`

**`populate_from_params`:**
- Renames case when `params[:caseName]` present
- When `params[:searchEngine]` present: `SearchEndpoint.find_or_create_by(...)` → assigns to `@try.search_endpoint`, sets `field_spec`
- **`@try.save` runs whenever `@try` is present** (even without search-engine params)

**`new`:** Creates `"Case #{current_user.cases.size}"`, redirects to `case_core_path(case, first try)` with `showWizard: true`

### `Api::V1::QueriesController`

**File:** `app/controllers/api/v1/queries_controller.rb`

**Create — duplicate handling:** Strips whitespace on `query_text`. If `exists?(query_text:)`, returns existing query via normal `respond_with` (**not** 409) — comment notes race/retry cases.

**Update — move query:** Reads `other_case_id` from params (not strong params). `remove_from_list` → assign new case → `insert_at 0` → `rearrange_queries` on source case.

**Strong params:** `params.expect(query: [:query_text, :information_need, :notes, { options: {} }])`

---

## Related docs

| Doc | Purpose |
|-----|---------|
| [QUEPID_COREUI_FEATURES.md](./todo/QUEPID_COREUI_FEATURES.md) | Case UI behavior (§1–22) — search flow, scoring, wizard, state, API |
| [todo.md](./todo/todo.md#frontend-cleanup-after-angular-removal) | Frontend cleanup after Angular removal |
| [DEVELOPER_GUIDE](../DEVELOPER_GUIDE.md#stimulus-http-conventions) | Stimulus fetch / URL conventions |
| OpenAPI at `/api/docs` | Full REST surface (broader than §5 Rails snippets) |

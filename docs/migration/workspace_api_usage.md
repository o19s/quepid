# Workspace API usage

Reference for **JSON (and related) HTTP endpoints** the **core case workspace** uses: methods, path patterns, and whether calls mutate state. Paths are **relative to the app root** (no leading `/`). URL rules: [api_client.md](./api_client.md).

**Accuracy:** Endpoint shapes below were checked against `config/routes.rb` and `bin/docker r bundle exec rails routes -g '^api'` (and top-level `proxy/fetch`). They are **Rails JSON APIs**, unchanged by Angular removal—the **Stimulus** workspace calls the same paths via `fetch` + `apiUrl()`.

**Interactive workspace search:** The **Rails+Stimulus** case workspace at `/case/:id/try/:try_number/new_ui` loads try configuration with **`GET api/cases/:caseId/tries/:tryNumber`**, then runs **Solr / Elasticsearch / OpenSearch** requests **from the browser** (template hydration in `modules/search_executor`), optionally via **`proxy/fetch`** when the try is configured to proxy—see [old/angularjs_elimination_plan.md](./old/angularjs_elimination_plan.md) and [api_client.md](./api_client.md). **Snapshot** replay uses **`GET api/cases/:caseId/snapshots/:snapshotId/search`**. This page lists **endpoints only**. Product changes to the search model: [intentional_design_changes.md](./intentional_design_changes.md) §2.

**Turbo / Stimulus:** For `Accept: text/vnd.turbo-stream.html`, frames, and broadcasts, see [turbo_streams_guide.md](./turbo_streams_guide.md) and [turbo_frame_boundaries.md](./turbo_frame_boundaries.md). Flash patterns: [ui_consistency_patterns.md](./ui_consistency_patterns.md).

---

## Summary: read-only vs mutating

| Area | Read-only endpoints | Mutating endpoints |
|------|---------------------|-------------------|
| Cases | GET cases, dropdown/cases, cases/:id, cases?archived=true, cases/:id/scores, scores/all, metadata (via GET case) | POST cases, PUT cases/:id, DELETE cases/:id, POST run_evaluation, PUT scorers, PUT metadata, PUT scores, POST clone/cases, DELETE bulk/cases/:id/queries/delete |
| Tries | GET cases/:id/tries, GET cases/:id/tries/:tryNo (single try; `new_ui` search config) | POST cases/:id/tries, PUT cases/:id/tries/:tryNo, DELETE cases/:id/tries/:tryNo, POST clone/cases/:id/tries/:tryNo |
| Queries | GET cases/:id/queries (bootstrap), GET notes, GET options; live engine search is client-side (+ `proxy/fetch`), not a JSON `queries/.../search` route in current Rails API | POST queries, PUT notes, PUT options, PUT position, DELETE queries/:id, PUT move (other_case_id), POST bulk/cases/:id/queries |
| Proxy | `GET`/`POST` `proxy/fetch?url=…` (outbound to search engine URL) | — |
| Ratings | (Often embedded in query bootstrap) | PUT ratings, PUT bulk/ratings, DELETE ratings, POST bulk/ratings/delete |
| Scorers | GET scorers, GET scorers/:id, GET cases/:id/scorers | POST scorers, PUT scorers/:id, DELETE scorers/:id |
| Snapshots | GET cases/:id/snapshots?shallow=true, GET …/snapshots/:sid?shallow=true, GET …/snapshots/:sid/search | POST cases/:id/snapshots, DELETE snapshots/:id, POST cases/:id/snapshots/imports |
| Search endpoints | GET search_endpoints, GET cases/:id/search_endpoints | (Workspace reads only; CRUD elsewhere) |
| Books | GET dropdown/books, GET teams/:id/books | PUT books/:id/populate, PUT books/:id/cases/:caseId/refresh |
| Teams | GET teams | POST teams/:id/cases, DELETE teams/:id/cases/:caseNo |
| Users | GET users/current, GET users/:id | PUT users/:id (e.g. completed_case_wizard, default_scorer_id) |
| Annotations | GET cases/:id/annotations | POST/PUT/DELETE cases/:id/annotations… |
| Import | — | POST import/ratings (hash, rre, ltr, csv), POST import/queries/information_needs |
| Export | GET export/ratings/…, export/cases/…, export/queries/information_needs/… | — |

---

## Conventions

- **CSRF** and **base URL** (no hardcoded leading `/`): follow [api_client.md](./api_client.md) and existing Rails meta tags.
- **Stimulus / ES modules:** build paths with **`apiUrl()`** and **`csrfToken()`** from **`app/javascript/modules/api_url.js`** (importmap pin **`modules/api_url`**) so URLs work under a relative app root—see [api_client.md](./api_client.md). **`proxy/fetch`** intentionally omits CSRF (per `ProxyController`).
- **JSON** for API bodies; export **GET**s return file bodies (CSV, JSON, text).
- **snake_case** in JSON from the server; **camelCase** common in legacy JS clients.
- **Turbo Streams:** mutating endpoints may support `Accept: text/vnd.turbo-stream.html` when the UI is server-rendered—[turbo_streams_guide.md](./turbo_streams_guide.md).
- **Snapshot search** (`GET …/snapshots/:id/search`): server-side search-shaped results for snapshot content.
- **PATCH vs PUT:** Where the table lists **PUT**, Rails typically also registers **PATCH** to the same path (`rails routes` shows both).

---

## Stimulus `new_ui` callers (non-exhaustive)

| Module / controller | Endpoints used |
|---------------------|----------------|
| `app/javascript/controllers/query_row_controller.js` | `GET api/cases/:caseId/tries/:tryNumber` (shared cache); `DELETE api/cases/:caseId/queries/:queryId`; ratings via `RatingsStore` |
| `app/javascript/modules/search_executor.js` | Search engine URL directly, or `GET`/`POST` **`proxy/fetch?url=…`** (via `apiUrl`) when the try proxies |
| `app/javascript/modules/ratings_store.js` | `PUT` / `DELETE` **`api/cases/:caseId/queries/:queryId/ratings`** (JSON body with `rating: { doc_id, rating }` / delete payload) |
| `app/javascript/controllers/add_query_controller.js` | `POST api/cases/:caseId/queries`, `POST api/bulk/cases/:caseId/queries` |

Other workspace Stimulus callers (non-exhaustive): `settings_panel_controller.js`, `case_score_controller.js`, `export_case_controller.js`, `move_query_modal_controller.js`, `delete_case_options_controller.js`, `snapshot_comparison_controller.js`, `import_ratings_controller.js`, `query_options_modal_controller.js`, `query_list_controller.js`, `wizard_controller.js`, `doc_finder_controller.js`. Search `app/javascript` for `apiUrl(` calls with `api/` paths to find current `fetch` targets.

---

## Proxy (search engine egress)

| Method | Path / pattern | Notes | Mutating? |
|--------|----------------|-------|-----------|
| GET, POST | `proxy/fetch?url=…` | Target URL is percent-encoded; used by **`search_executor`** when `proxy_requests` is not false. No Rails CSRF header. | No (Quepid state) |

---

## 1. Cases

| Method | Path / pattern | Request body/params | Response usage | Mutating? |
|--------|----------------|---------------------|----------------|-----------|
| GET | `api/cases` | — | `response.data.all_cases` | No |
| GET | `api/cases?archived=true` | — | `response.data.all_cases` | No |
| GET | `api/dropdown/cases` | — | `response.data.all_cases`, `cases_count` | No |
| GET | `api/cases/:caseId` | Optional `shallow` | Case + tries, etc. | No |
| POST | `api/cases` | `{ case_name?, queries?, tries? }` | New case | Yes |
| PUT | `api/cases/:caseId` | `case_name`, `archived`, `nightly`, `book_id`, … | Case / book_name | Yes |
| DELETE | `api/cases/:caseId` | — | — | Yes |
| PUT | `api/cases/:caseId/metadata` | `{ metadata: { last_viewed_at: "…" } }` | — | Yes |
| GET | `api/cases/:caseId/scores` | — | Last score | No |
| PUT | `api/cases/:caseId/scores` | `{ case_score: { queries: { queryId: score, … } } }` | Score | Yes |
| GET | `api/cases/:caseId/scores/all` | — | `{ scores: [...] }` | No |
| PUT | `api/cases/:caseId/scorers/:scorerId` | `{}` | — | Yes |
| POST | `api/cases/:caseId/run_evaluation` | `try_number` (optional) | Job queued | Yes |
| POST | `api/clone/cases` | `case_id`, clone options, `case_name?` | Cloned case | Yes |
| DELETE | `api/bulk/cases/:caseId/queries/delete` | — | — | Yes |

---

## 2. Tries (search configuration)

| Method | Path / pattern | Request body/params | Response usage | Mutating? |
|--------|----------------|---------------------|----------------|-----------|
| GET | `api/cases/:caseId/tries` | — | `response.data.tries` | No |
| GET | `api/cases/:caseId/tries/:tryNumber` | — | Single try JSON (search URL, args, `field_spec`, `proxy_requests`, …); used by **`new_ui`** | No |
| POST | `api/cases/:caseId/tries` | `try`, optional `search_endpoint`, `parent_try_number`, `curator_vars` | New try | Yes |
| PUT | `api/cases/:caseId/tries/:tryNumber` | Same as POST or `{ name }` rename | — | Yes |
| DELETE | `api/cases/:caseId/tries/:tryNumber` | — | — | Yes |
| POST | `api/clone/cases/:caseId/tries/:tryNumber` | — | New try | Yes |

---

## 3. Queries

There is **no** `api/cases/.../queries/.../search` route in Rails. **Live** try/search results are fetched **in the browser** (engine URL or `proxy/fetch`—see intro and §Proxy). **Server-side** search-shaped JSON for **snapshots** only: **`GET api/cases/:caseId/snapshots/:snapshotId/search`** (§6).

| Method | Path / pattern | Request body/params | Response usage | Mutating? |
|--------|----------------|---------------------|----------------|-----------|
| GET | `api/cases/:caseId/queries?bootstrap=true` | — | `{ queries, display_order }` | No |
| GET | `api/cases/:caseId/queries.json` | `shallow` | Same; `shallow` affects payload | No |
| POST | `api/cases/:caseId/queries` | `{ query: { query_text } }` | 204 or `{ query, display_order }` | Yes |
| POST | `api/bulk/cases/:caseId/queries` | `{ queries: [query_text, …] }` | `{ queries, display_order }` | Yes |
| GET | `api/cases/:caseId/queries/:queryId/notes` | — | `{ notes, information_need }` | No |
| PUT | `api/cases/:caseId/queries/:queryId/notes` | `{ query: { notes, information_need } }` | — | Yes |
| GET | `api/cases/:caseId/queries/:queryId/options` | — | `{ options }` | No |
| PUT | `api/cases/:caseId/queries/:queryId/options` | `{ query: { options } }` | — | Yes |
| PUT | `api/cases/:caseId/queries/:queryId/position` | `{ after, reverse }` | `{ display_order }` | Yes |
| DELETE | `api/cases/:caseId/queries/:queryId` | — | — | Yes |
| PUT | `api/cases/:caseId/queries/:queryId` | `{ other_case_id }` (move) | — | Yes |

---

## 4. Ratings

Base: `api/cases/:caseId/queries/:queryId`

| Method | Path / pattern | Request body/params | Mutating? |
|--------|----------------|---------------------|-----------|
| PUT | `.../ratings` | `{ rating: { doc_id, rating } }` | Yes |
| PUT | `.../bulk/ratings` | `{ doc_ids: [...], rating }` | Yes |
| DELETE | `.../ratings` | `{ rating: { doc_id } }` | Yes |
| POST | `.../bulk/ratings/delete` | `{ doc_ids: [...] }` | Yes |

---

## 5. Scorers

| Method | Path / pattern | Request body/params | Mutating? |
|--------|----------------|---------------------|-----------|
| GET | `api/scorers` | — | No |
| GET | `api/scorers/:scorerId` | — | No |
| GET | `api/cases/:caseId/scorers` | — | No |
| POST | `api/scorers` | `{ scorer: { name, code, scale, … } }` | Yes |
| PUT | `api/scorers/:scorerId` | `{ scorer: { … } }` | Yes |
| DELETE | `api/scorers/:scorerId` | — | Yes |

---

## 6. Snapshots

| Method | Path / pattern | Request body/params | Mutating? |
|--------|----------------|---------------------|-----------|
| GET | `api/cases/:caseId/snapshots?shallow=true` | — | No |
| GET | `api/cases/:caseId/snapshots/:snapshotId?shallow=true` | — | No |
| GET | `api/cases/:caseId/snapshots/:snapshotId/search` | Search-style query params | No |
| POST | `api/cases/:caseId/snapshots` | `snapshot` with `name`, `docs`, `queries` payload | Yes |
| DELETE | `api/cases/:caseId/snapshots/:snapshotId` | — | Yes |
| POST | `api/cases/:caseId/snapshots/imports` | `{ snapshots: [ … ] }` | Yes |

---

## 7. Search endpoints

| Method | Path | Mutating? |
|--------|------|-----------|
| GET | `api/search_endpoints` | No |
| GET | `api/cases/:caseId/search_endpoints` | No |

---

## 8. Books

Nested under `namespace :api` → `resources :books` in `config/routes.rb`.

| Method | Path / pattern | Request body/params | Mutating? |
|--------|----------------|---------------------|-----------|
| GET | `api/dropdown/books` | — | No |
| GET | `api/teams/:teamId/books` | — | No |
| PUT | `api/books/:bookId/populate` | `case_id`, `query_doc_pairs: [...]` | Yes |
| PUT | `api/books/:bookId/cases/:caseId/refresh` | Query params e.g. `create_missing_queries`, `process_in_background` | Yes |

---

## 9. Teams

| Method | Path / pattern | Request body/params | Mutating? |
|--------|----------------|---------------------|-----------|
| GET | `api/teams` | — | No |
| POST | `api/teams/:teamId/cases` | `{ id: caseNo }` | Yes |
| DELETE | `api/teams/:teamId/cases/:caseNo` | — | Yes |

---

## 10. Users

| Method | Path / pattern | Request body/params | Mutating? |
|--------|----------------|---------------------|-----------|
| GET | `api/users/current` | — | No |
| GET | `api/users/:id` | — | No |
| PUT | `api/users/:id` | `{ user: { completed_case_wizard?, default_scorer_id? } }` | Yes |

---

## 11. Annotations

Base: `api/cases/:caseId/annotations`

| Method | Path / pattern | Request body/params | Mutating? |
|--------|------------------|---------------------|-----------|
| GET | (base) | — | No |
| POST | (base) | `annotation`, `score` (shape per API) | Yes |
| PUT | `…/annotations/:id` | `annotation` | Yes |
| DELETE | `…/annotations/:id` | — | Yes |

---

## 12. Import

**Case scope:** Stimulus uses **`?case_id=…`** on `import/ratings` and `import/queries/information_needs`. **`file_format`** for ratings is supplied in the **JSON body** (`hash`, `rre`, or `ltr`; CSV uploads are parsed client-side into a `hash` payload).

| Method | Path | Notes | Mutating? |
|--------|------|--------|-----------|
| POST | `api/import/ratings?case_id=…` | Body: `file_format`, `clear_queries`, plus `ratings` (hash), `rre_json` (rre), or `ltr_text` (ltr) | Yes |
| POST | `api/import/queries/information_needs?case_id=…` | Body: `csv_text`, `create_queries` | Yes |

---

## 13. Export

All **GET**; responses are download bodies. Variants use path suffixes and `file_format` / `snapshot_id` query params—inspect routes or `api/docs` for the exact matrix.

Common patterns:

| Method | Path / pattern (examples) | Mutating? |
|--------|---------------------------|-----------|
| GET | `api/export/ratings/:caseId.csv` / `.txt` / `.json` with `file_format` (basic, trec, rre, ltr, snapshot variants) | No |
| GET | `api/export/cases/:caseId.json` | No (full case JSON; used by `export_case_controller` “quepid” format) |
| GET | `api/export/queries/information_needs/:caseId.csv` | No |

**Power-user links** in export UIs often include direct GETs such as: `api/cases/:caseId.json?shallow=false`, `api/cases/:caseId/queries.json?shallow=false`, `api/cases/:caseId/annotations.json`, `api/cases/:caseId/scores.json`, `api/export/ratings/:caseId.json`, snapshot JSON with `shallow=false`, and full `api/export/cases/:caseId.json`. Optional: `api/docs` for OpenAPI.

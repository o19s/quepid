# Workspace API Usage

This document audits all API endpoints used by the workspace and documents request/response shapes and whether each call is read-only or mutating. Originally derived from AngularJS `$http`/`$resource` calls; these same endpoints are now used by the **modern stack** (Stimulus controllers via `apiFetch` from `app/javascript/api/fetch.js`, and Rails controllers for server-rendered responses).

**Note:** All paths are relative to the app root (no leading `/`). For URL building rules, see [api_client.md](api_client.md). Search requests go through `QuerySearchService` (server-side proxy to the user's search endpoint), not directly from the client. The only client-accessible "search" API is `api/cases/:case_id/tries/:try_number/queries/:query_id/search`.

---

## Summary: Read-only vs mutating

| Area        | Read-only endpoints                                                                 | Mutating endpoints                                                                 |
|------------|--------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------|
| Cases      | GET cases, dropdown/cases, cases/:id, cases?archived=true, cases/:id/scores, scores/all, metadata (via GET case) | POST cases, PUT cases/:id, DELETE cases/:id, POST run_evaluation, PUT scorers, PUT metadata, PUT scores, POST clone/cases, DELETE bulk/cases/:id/queries/delete |
| Tries      | GET cases/:id/tries                                                                  | POST cases/:id/tries, PUT cases/:id/tries/:tryNo, DELETE cases/:id/tries/:tryNo, POST clone/cases/:id/tries/:tryNo |
| Queries    | GET cases/:id/queries (bootstrap), GET notes, GET options                            | POST queries, PUT notes, PUT options, PUT position, DELETE queries/:id, PUT move (other_case_id), POST bulk/cases/:id/queries |
| Ratings    | (Ratings come embedded in query bootstrap)                                           | PUT ratings, PUT bulk/ratings, DELETE ratings, POST bulk/ratings/delete |
| Scorers    | GET scorers, GET scorers/:id, GET cases/:id/scorers                                  | POST scorers, PUT scorers/:id, DELETE scorers/:id |
| Snapshots  | GET cases/:id/snapshots?shallow=true, GET cases/:id/snapshots/:sid?shallow=true, GET snapshot search (doc lookup) | POST cases/:id/snapshots, DELETE snapshots/:id, POST cases/:id/snapshots/imports |
| Search endpoints | GET search_endpoints, GET cases/:id/search_endpoints                              | (None from frontend; management may be elsewhere)                                  |
| Books      | GET dropdown/books, GET teams/:id/books                                              | PUT books/:id/populate, PUT books/:id/cases/:caseId/refresh                         |
| Teams      | GET teams                                                                            | POST teams/:id/cases, DELETE teams/:id/cases/:caseNo                                 |
| Users      | GET users/current, GET users/:id                                                     | PUT users/:id (completed_case_wizard, default_scorer_id)                            |
| Annotations| GET cases/:id/annotations                                                            | POST cases/:id/annotations, PUT cases/:id/annotations/:id, DELETE cases/:id/annotations/:id |
| Import     | —                                                                                    | POST import/ratings (hash, rre, ltr), POST import/queries/information_needs         |
| Export     | GET export/ratings/..., export/cases/..., export/queries/information_needs/...       | —                                                                                   |

---

## 1. Cases

**Source:** `caseSvc.js`, `queriesSvc.js` (syncToBook uses GET case).

| Method | Path / pattern | Request body/params | Response usage | Mutating? |
|--------|----------------|---------------------|----------------|-----------|
| GET    | `api/cases` | — | `response.data.all_cases` (list) | No |
| GET    | `api/cases?archived=true` | — | `response.data.all_cases` | No |
| GET    | `api/dropdown/cases` | — | `response.data.all_cases`, `response.data.cases_count` | No |
| GET    | `api/cases/:caseId` | Optional: `shallow` (e.g. `.json?shallow=false` in export modal) | Case object (case_id, case_name, last_try_number, scorer_id, tries, etc.) | No |
| POST   | `api/cases` | `{ case_name?, queries?, tries? }` | New case (case object with tries) | Yes |
| PUT    | `api/cases/:caseId` | `{ case_name? }` or `{ archived?: boolean }` or `{ nightly?: boolean }` or `{ book_id? }` | Case object or book_name | Yes |
| DELETE | `api/cases/:caseId` | — | — | Yes |
| PUT    | `api/cases/:caseId/metadata` | `{ metadata: { last_viewed_at: "yyyy-MM-dd HH:mm:ss" } }` | — | Yes |
| GET    | `api/cases/:caseId/scores` | — | Single score value (e.g. last score) | No |
| PUT    | `api/cases/:caseId/scores` | `{ case_score: { queries: { queryId: scoreValue, ... } } }` | Score value | Yes |
| GET    | `api/cases/:caseId/scores/all` | — | `{ scores: [...] }` | No |
| PUT    | `api/cases/:caseId/scorers/:scorerId` | `{}` | — | Yes |
| POST   | `api/cases/:caseId/run_evaluation` | (optional params: `try_number`) | — | Yes |
| POST   | `api/clone/cases` | `{ case_id, clone_queries?, clone_ratings?, preserve_history?, try_number?, case_name? }` | Cloned case object | Yes |
| DELETE | `api/bulk/cases/:caseId/queries/delete` | — | — | Yes |

---

## 2. Tries (search configuration)

**Source:** `settingsSvc.js`, `TryFactory.js`, `SettingsFactory.js`.

| Method | Path / pattern | Request body/params | Response usage | Mutating? |
|--------|----------------|---------------------|----------------|-----------|
| GET    | `api/cases/:caseId/tries` | — | `response.data.tries` (array of try configs) | No |
| POST   | `api/cases/:caseId/tries` | `{ try: { escape_query, field_spec, number_of_rows, query_params, search_endpoint_id? }, search_endpoint?: { search_engine, endpoint_url, ... }, parent_try_number, curator_vars }` | New try JSON | Yes |
| PUT    | `api/cases/:caseId/tries/:tryNumber` | Same shape as POST (try + optional search_endpoint) or `{ name }` for rename | — | Yes |
| DELETE | `api/cases/:caseId/tries/:tryNumber` | — | — | Yes |
| POST   | `api/clone/cases/:caseId/tries/:tryNumber` | (no body) | New try object | Yes |

---

## 3. Queries

**Source:** `queriesSvc.js`, `Api::V1::Tries::Queries::SearchController` (modern).

### Query search execution (modern stack)

| Method | Path / pattern | Request body/params | Response usage | Mutating? |
|--------|----------------|--------------------|----------------|-----------|
| GET | `api/cases/:case_id/tries/:try_number/queries/:query_id/search` | Optional: `q` (custom query text), `rows` (page size), `start` (offset) | `{ docs, num_found, ratings, response_status }`; each doc: `{ id, position, fields, explain? }` | No |

Executes the query against the try's search endpoint (server-side) and returns documents plus existing ratings. Used by the modern workspace results pane and DocFinder ("Find and rate missing documents"). When `q` is present, searches with that text instead of the query's query_text.

| Method | Path / pattern | Request body/params | Response usage | Mutating? |
|--------|----------------|---------------------|----------------|-----------|
| GET    | `api/cases/:caseId/queries?bootstrap=true` | — | `{ queries: [...], display_order: [...] }`; each query has query_id, ratings, etc. | No |
| GET    | `api/cases/:caseId/queries.json?shallow=false` | Optional: `shallow` (export modal / direct API links) | Same resource; `shallow` affects payload size | No |
| POST   | `api/cases/:caseId/queries` | `{ query: { query_text } }` | 204 or `{ query, display_order }` | Yes |
| POST   | `api/bulk/cases/:caseId/queries` | `{ queries: [query_text, ...] }` | `{ queries, display_order }` | Yes |
| GET    | `api/cases/:caseId/queries/:queryId/notes` | — | `{ notes, information_need }` | No |
| PUT    | `api/cases/:caseId/queries/:queryId/notes` | `{ query: { notes, information_need } }` | — | Yes |
| GET    | `api/cases/:caseId/queries/:queryId/options` | — | `{ options }` (JSON string) | No |
| PUT    | `api/cases/:caseId/queries/:queryId/options` | `{ query: { options } }` | — | Yes |
| PUT    | `api/cases/:caseId/queries/:queryId/position` | `{ after, reverse }` | `{ display_order }` | Yes |
| DELETE | `api/cases/:caseId/queries/:queryId` | — | — | Yes |
| PUT    | `api/cases/:caseId/queries/:queryId` | `{ other_case_id }` (move query to other case) | — | Yes |

---

## 4. Ratings

**Source:** `ratingsStoreSvc.js`. Base path: `api/cases/:caseId/queries/:queryId`.

| Method | Path / pattern | Request body/params | Response usage | Mutating? |
|--------|----------------|---------------------|----------------|-----------|
| PUT    | `.../ratings` | `{ rating: { doc_id, rating } }` | — | Yes |
| PUT    | `.../bulk/ratings` | `{ doc_ids: [...], rating }` | — | Yes |
| DELETE | `.../ratings` | Body: `{ rating: { doc_id } }` (Angular config.data) | — | Yes |
| POST   | `.../bulk/ratings/delete` | `{ doc_ids: [...] }` | — | Yes |

---

## 5. Scorers

**Source:** `scorerSvc.js`.

| Method | Path / pattern | Request body/params | Response usage | Mutating? |
|--------|----------------|---------------------|----------------|-----------|
| GET    | `api/scorers` | — | `{ user_scorers, communal_scorers }` | No |
| GET    | `api/scorers/:scorerId` | — | Scorer object | No |
| GET    | `api/cases/:caseId/scorers` | — | `{ user_scorers, communal_scorers }` | No |
| POST   | `api/scorers` | `{ scorer: { name, code, scale, show_scale_labels?, scale_with_labels? } }` | Scorer object | Yes |
| PUT    | `api/scorers/:scorerId` | `{ scorer: { name, code, scale, show_scale_labels?, scale_with_labels? } }` | Scorer object | Yes |
| DELETE | `api/scorers/:scorerId` | — | — | Yes |

---

## 6. Snapshots

**Source:** `querySnapshotSvc.js`, `wizardModal.js` (snapshot search URL). Snapshot **search** is used for doc lookup (GET) when the search engine doesn’t support lookup by id.

| Method | Path / pattern | Request body/params | Response usage | Mutating? |
|--------|----------------|---------------------|----------------|-----------|
| GET    | `api/cases/:caseId/snapshots?shallow=true` | — | `{ snapshots: [...] }` | No |
| GET    | `api/cases/:caseId/snapshots/:snapshotId?shallow=true` | — | Single snapshot object | No |
| GET    | `api/cases/:caseId/snapshots/:snapshotId/search` | (query params as per search endpoint) | Search results (doc lookup) | No |
| POST   | `api/cases/:caseId/snapshots` | `{ snapshot: { name, docs: { queryId: [ { id, explain, rated_only?, fields? } ] }, queries: { queryId: { score, all_rated, number_of_results } } } }` | Snapshot object | Yes |
| DELETE | `api/cases/:caseId/snapshots/:snapshotId` | — | — | Yes |
| POST   | `api/cases/:caseId/snapshots/imports` | `{ snapshots: [ snapshotData ] }` | `{ snapshots }` | Yes |

---

## 7. Search endpoints

**Source:** `searchEndpointSvc.js`. Frontend only reads; no create/update/delete from these assets.

| Method | Path / pattern | Request body/params | Response usage | Mutating? |
|--------|----------------|---------------------|----------------|-----------|
| GET    | `api/search_endpoints` | — | `{ search_endpoints: [...] }` | No |
| GET    | `api/cases/:caseId/search_endpoints` | — | `{ search_endpoints: [...] }` | No |

---

## 8. Books

**Source:** `bookSvc.js`. Routes reference `api/books` and `api/teams/:id/books` (see `config/routes.rb` for actual path; books refresh may be `api/books/:book_id/cases/:case_id/refresh`).

| Method | Path / pattern | Request body/params | Response usage | Mutating? |
|--------|----------------|---------------------|----------------|-----------|
| GET    | `api/dropdown/books` | — | `response.data.books`, `response.data.books_count` | No |
| GET    | `api/teams/:teamId/books` | — | `response.data.books` | No |
| PUT    | `api/books/:bookId/populate` | `{ case_id, query_doc_pairs: [ { query_text, doc_id, position, document_fields } ] }` | — | Yes |
| PUT    | `api/books/:bookId/cases/:caseId/refresh?create_missing_queries=...&process_in_background=true` | `{}` | response.data (e.g. redirect flag) | Yes |

---

## 9. Teams

**Source:** `teamSvc.js`.

| Method | Path / pattern | Request body/params | Response usage | Mutating? |
|--------|----------------|---------------------|----------------|-----------|
| GET    | `api/teams` | — | `response.data.teams` | No |
| POST   | `api/teams/:teamId/cases` | `{ id: caseNo }` | Case object (added to team) | Yes |
| DELETE | `api/teams/:teamId/cases/:caseNo` | — | — | Yes |

---

## 10. Users

**Source:** `userSvc.js`.

| Method | Path / pattern | Request body/params | Response usage | Mutating? |
|--------|----------------|---------------------|----------------|-----------|
| GET    | `api/users/current` | — | User object (bootstrapped) | No |
| GET    | `api/users/:id` | — | User object | No |
| PUT    | `api/users/:id` | `{ user: { completed_case_wizard?: true, default_scorer_id? } }` | — | Yes |

---

## 11. Annotations

**Source:** `annotationsSvc.js`, `components/annotations/annotations_controller.js`. Base path: `api/cases/:caseId/annotations`.

| Method | Path / pattern | Request body/params | Response usage | Mutating? |
|--------|----------------|---------------------|----------------|-----------|
| GET    | `api/cases/:caseId/annotations` | — | `{ annotations: [...] }` | No |
| POST   | `api/cases/:caseId/annotations` | `{ annotation: { message, source? }, score: { all_rated, score, try_id, queries } }` | Annotation object | Yes |
| PUT    | `api/cases/:caseId/annotations/:id` | `{ annotation: { message, source } }` | Annotation object | Yes |
| DELETE | `api/cases/:caseId/annotations/:id` | — | — | Yes |

---

## 12. Import

**Source:** `importRatingsSvc.js`.

| Method | Path / pattern | Request body/params | Response usage | Mutating? |
|--------|----------------|---------------------|----------------|-----------|
| POST   | `api/import/ratings?file_format=hash` | `{ ratings: [ { query_text, doc_id, rating } ], case_id, clear_queries }` | — | Yes |
| POST   | `api/import/ratings?file_format=csv` | Same as hash (client parses CSV to ratings) | — | Yes |
| POST   | `api/import/ratings?file_format=rre` | `{ rre_json, case_id, clear_queries }` | — | Yes |
| POST   | `api/import/ratings?file_format=ltr` | `{ ltr_text, case_id, clear_queries }` | — | Yes |
| POST   | `api/import/queries/information_needs` | `{ case_id, csv_text, create_queries }` | — | Yes |

---

## 13. Export

**Source:** `caseCSVSvc.js`. All are GET; response is file body (CSV, JSON, or text). Paths use `:caseId` in URL; format can be in path suffix or query. The export modal also links to several of these (see "API links in Export modal" below).

| Method | Path / pattern | Request body/params | Response usage | Mutating? |
|--------|----------------|---------------------|----------------|-----------|
| GET    | `api/export/ratings/:caseId.csv?file_format=basic` | — | CSV body | No |
| GET    | `api/export/ratings/:caseId.csv?file_format=basic_snapshot&snapshot_id=:id` | — | CSV body | No |
| GET    | `api/export/ratings/:caseId.txt?file_format=trec` | — | Text body | No |
| GET    | `api/export/ratings/:caseId.txt?file_format=trec_snapshot&snapshot_id=:id` | — | Text body | No |
| GET    | `api/export/ratings/:caseId.json` | — | JSON body (default ratings export) | No |
| GET    | `api/export/ratings/:caseId.json?file_format=rre` | — | JSON body (RRE format) | No |
| GET    | `api/export/ratings/:caseId.txt?file_format=ltr` | — | Text body | No |
| GET    | `api/export/cases/:caseId` | — | JSON body | No |
| GET    | `api/export/cases/:caseId.json` | — | JSON body (same as above; format from extension) | No |
| GET    | `api/export/cases/:caseId/general.csv` | — | CSV body (Team Name, Case Name, Case ID, Query Text, Score, Date Last Scored, Count, Information Need, Notes, Options) | No |
| GET    | `api/export/cases/:caseId/detailed.csv` | — | CSV body (Team Name, Case Name, Case ID, Query Text, Doc ID, Position, Title, Rating, [fields]) | No |
| GET    | `api/export/cases/:caseId/snapshot.csv` | `snapshot_id` | CSV body (Snapshot Name, Time, Case ID, Query Text, Doc ID, Position, [field keys]) | No |
| GET    | `api/export/queries/information_needs/:caseId.csv` | — | CSV body | No |

---

## API links in Export modal

The Export Case modal (`ExportCaseComponent` + `export_case_controller.js`) exposes the following API URLs as clickable links for direct browser download:

| Link purpose | URL pattern |
|-------------|-------------|
| API docs | `api/docs` (OAS/Rails engine mount) |
| Case JSON | `api/cases/:caseId.json?shallow=false` |
| Queries JSON | `api/cases/:caseId/queries.json?shallow=false` |
| Annotations JSON | `api/cases/:caseId/annotations.json` |
| Scores JSON | `api/cases/:caseId/scores.json` |
| Ratings JSON | `api/export/ratings/:caseId.json` |
| Snapshot JSON | `api/cases/:caseId/snapshots/:snapshotId.json?shallow=false` |
| Full case export | `api/export/cases/:caseId.json` |

---

## Source file index

### Modern stack (Stimulus controllers + Rails controllers)

| File | Endpoints covered |
|------|--------------------|
| `controllers/clone_case_controller.js` | POST clone/cases |
| `controllers/delete_case_controller.js` | DELETE cases/:id |
| `controllers/export_case_controller.js` | GET export/cases, export/ratings |
| `controllers/add_query_controller.js` | POST cases/:id/queries (Turbo Stream) |
| `controllers/delete_query_controller.js` | DELETE cases/:id/queries/:id (Turbo Stream) |
| `controllers/query_list_controller.js` | PUT queries/:id/position, POST run_evaluation |
| `controllers/results_pane_controller.js` | GET tries/:tryNo/queries/:id/search, PUT ratings |
| `controllers/import_ratings_controller.js` | POST import/ratings, import/queries/information_needs |
| `controllers/annotations_controller.js` | Annotations CRUD (GET, POST, PUT, DELETE) |
| `controllers/take_snapshot_controller.js` | POST cases/:id/snapshots |
| `controllers/diff_controller.js` | GET snapshots/:id (for diff comparison) |
| `controllers/scorer_panel_controller.js` | GET scorers, PUT cases/:id/scorers/:id |
| `controllers/settings_panel_controller.js` | GET/POST/PUT tries |
| `controllers/judgements_controller.js` | Books populate/refresh |
| `controllers/doc_finder_controller.js` | GET tries/:tryNo/queries/:id/search, PUT bulk/ratings |
| `Core::QueriesController` | POST/DELETE queries (server-side, Turbo Stream responses) |
| `Core::Queries::NotesController` | PUT query notes (Turbo Frame response) |
| `Core::ExportsController` | POST/GET exports (with Turbo Stream notifications) |
| `Core::ImportsController` | POST imports (with Turbo Stream notifications) |
| `Api::V1::*` controllers | All JSON API endpoints (unchanged from Angular era) |

### Legacy Angular source files (deleted, for historical reference)

| File | Endpoints covered |
|------|--------------------|
| `services/caseSvc.js` | Cases (CRUD, metadata, scores, scorers, run_evaluation, clone) |
| `services/settingsSvc.js` | Tries (GET, POST, PUT) |
| `services/queriesSvc.js` | Queries (bootstrap, CRUD, notes, options, position, move) |
| `services/ratingsStoreSvc.js` | Ratings (PUT, DELETE, bulk) |
| `services/scorerSvc.js` | Scorers (CRUD) |
| `services/querySnapshotSvc.js` | Snapshots (list, get, create, delete, imports) |
| `services/bookSvc.js` | Books (dropdown, populate, refresh) |
| `services/annotationsSvc.js` | Annotations (CRUD) |
| `services/importRatingsSvc.js` | Import (ratings, information_needs) |
| `services/caseCSVSvc.js` | Export (ratings, cases) |

---

## Usage notes

1. **Base URL:** See [api_client.md](api_client.md) for URL building (never hardcode `/`; use `getQuepidRootUrl()` or Rails helpers).
2. **CSRF:** All API requests use `apiFetch()` from `app/javascript/api/fetch.js` which auto-adds the CSRF token from the page's meta tag.
3. **JSON:** API uses `defaults: { format: :json }`; request/response bodies are JSON; export GETs return file contents (CSV/text/JSON).
4. **Snake vs camel:** Backend uses snake_case; frontend uses camelCase in JavaScript.
5. **Search:** Live search goes through the server-side `QuerySearchService` proxy (`api/cases/:caseId/tries/:tryNumber/queries/:queryId/search`), eliminating CORS issues. Snapshot doc lookup uses `api/cases/:caseId/snapshots/:snapshotId/search`.
6. **Export modal:** The export modal (`ExportCaseComponent` + `export_case_controller.js`) provides API links for direct download; the same endpoints are accessible when opened in the browser.
7. **Turbo Streams:** Some endpoints (queries create/destroy, ratings) support `Accept: text/vnd.turbo-stream.html` for live DOM updates. See [turbo_streams_guide.md](turbo_streams_guide.md).

# Workspace API usage

Reference for **JSON (and related) HTTP endpoints** the **core case workspace** uses: methods, path patterns, and whether calls mutate state. Paths are **relative to the app root** (no leading `/`). URL rules: [api_client.md](../api_client.md).

**Search:** The legacy Angular workspace runs live search in the **browser** (e.g. splainer + proxy). A **server-side** execution path also exists: `GET api/cases/:case_id/tries/:try_number/queries/:query_id/search` (optional `q`, `rows`, `start`). Whether the ported workspace uses that as the primary path is a **product/architecture** decision—see [angularjs_elimination_plan.md](../angularjs_elimination_plan.md) and [intentional_design_changes.md](../intentional_design_changes.md).

**Turbo / Stimulus:** For `Accept: text/vnd.turbo-stream.html`, frames, and broadcasts, see [turbo_streams_guide.md](../turbo_streams_guide.md) and [turbo_frame_boundaries.md](../turbo_frame_boundaries.md). Flash patterns: [ui_consistency_patterns.md](../ui_consistency_patterns.md).

---

## Summary: read-only vs mutating

| Area | Read-only endpoints | Mutating endpoints |
|------|---------------------|-------------------|
| Cases | GET cases, dropdown/cases, cases/:id, cases?archived=true, cases/:id/scores, scores/all, metadata (via GET case) | POST cases, PUT cases/:id, DELETE cases/:id, POST run_evaluation, PUT scorers, PUT metadata, PUT scores, POST clone/cases, DELETE bulk/cases/:id/queries/delete |
| Tries | GET cases/:id/tries | POST cases/:id/tries, PUT cases/:id/tries/:tryNo, DELETE cases/:id/tries/:tryNo, POST clone/cases/:id/tries/:tryNo |
| Queries | GET cases/:id/queries (bootstrap), GET …/search (server-side run), GET notes, GET options | POST queries, PUT notes, PUT options, PUT position, DELETE queries/:id, PUT move (other_case_id), POST bulk/cases/:id/queries |
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

- **CSRF** and **base URL** (no hardcoded leading `/`): follow [api_client.md](../api_client.md) and existing Rails meta tags.
- **JSON** for API bodies; export **GET**s return file bodies (CSV, JSON, text).
- **snake_case** in JSON from the server; **camelCase** common in legacy JS clients.
- **Turbo Streams:** mutating endpoints may support `Accept: text/vnd.turbo-stream.html` when the UI is server-rendered—[turbo_streams_guide.md](../turbo_streams_guide.md).
- **Snapshot search** (`GET …/snapshots/:id/search`): doc lookup when the engine does not support lookup-by-id (same pattern as legacy workspace).

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
| POST | `api/cases/:caseId/tries` | `try`, optional `search_endpoint`, `parent_try_number`, `curator_vars` | New try | Yes |
| PUT | `api/cases/:caseId/tries/:tryNumber` | Same as POST or `{ name }` rename | — | Yes |
| DELETE | `api/cases/:caseId/tries/:tryNumber` | — | — | Yes |
| POST | `api/clone/cases/:caseId/tries/:tryNumber` | — | New try | Yes |

---

## 3. Queries

| Method | Path / pattern | Request body/params | Response usage | Mutating? |
|--------|----------------|---------------------|----------------|-----------|
| GET | `api/cases/:case_id/tries/:try_number/queries/:query_id/search` | `q`, `rows`, `start` (optional) | `{ docs, num_found, ratings, response_status }` | No |
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

Confirm exact paths in `config/routes.rb` if adding new callers.

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

| Method | Path | Notes | Mutating? |
|--------|------|--------|-----------|
| POST | `api/import/ratings?file_format=hash` | `ratings`, `case_id`, `clear_queries` | Yes |
| POST | `api/import/ratings?file_format=csv` | Client parses CSV → same as hash | Yes |
| POST | `api/import/ratings?file_format=rre` | `rre_json`, `case_id`, `clear_queries` | Yes |
| POST | `api/import/ratings?file_format=ltr` | `ltr_text`, `case_id`, `clear_queries` | Yes |
| POST | `api/import/queries/information_needs` | `case_id`, `csv_text`, `create_queries` | Yes |

---

## 13. Export

All **GET**; responses are download bodies. Variants use path suffixes and `file_format` / `snapshot_id` query params—inspect routes or `api/docs` for the exact matrix.

Common patterns:

| Method | Path / pattern (examples) | Mutating? |
|--------|---------------------------|-----------|
| GET | `api/export/ratings/:caseId.csv` / `.txt` / `.json` with `file_format` (basic, trec, rre, ltr, snapshot variants) | No |
| GET | `api/export/cases/:caseId`, `…/general.csv`, `…/detailed.csv`, `…/snapshot.csv` | No |
| GET | `api/export/queries/information_needs/:caseId.csv` | No |

**Power-user links** in export UIs often include direct GETs such as: `api/cases/:caseId.json?shallow=false`, `api/cases/:caseId/queries.json?shallow=false`, `api/cases/:caseId/annotations.json`, `api/cases/:caseId/scores.json`, `api/export/ratings/:caseId.json`, snapshot JSON with `shallow=false`, and full `api/export/cases/:caseId.json`. Optional: `api/docs` for OpenAPI.

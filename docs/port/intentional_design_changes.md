# Intentional Design Changes from Angular

> **Purpose:** This document records behavior that intentionally differs from the legacy Angular workspace. These are not bugs or missing features — they are deliberate improvements or simplifications that we want to keep.
>
> If you notice one of these behaviors and think "that's a bug, Angular did it differently," check here first.

---

## 1. Book/Judgement Sync: Automatic Instead of Manual Push

**Angular:** `bookSvc.updateQueryDocPairs` let users explicitly push ratings from the workspace to a Book, with a "Populate Judgements" checkbox that bulk-copied Case ratings as Book judgements.

**Now:** Ratings flow to Books automatically. When a user rates a document in the workspace, `JudgementFromRatingJob` creates the corresponding judgement in the associated Book in the background. There is no manual "push" button. You can still pull aggregated judgements back to the Case via "Refresh ratings from book" (`RefreshController`).

**Why:** The old two-way sync had no mechanism to handle conflicts when a user changed a rating after pushing. The code itself acknowledged the problem (see comment in `populate_book_job.rb`). The new model establishes a clear source of truth: the Book is authoritative for judgements, the Case is authoritative for live search interaction. Per-rating sync eliminates the "forgot to push" problem entirely.

**Key commit:** `0c84089f` (Feb 14, 2025) — removed `populateJudgements` flag from populate flow.

---

## 2. Scorer Management on Dedicated Page

**Angular:** Full CRUD modals within the workspace: create, edit, clone, delete, and share scorers without leaving the case.

**Now:** Scorer *selection* is in the workspace (`scorer_panel_controller.js`). All other scorer management lives on the `/scorers` page.

**Why:** The dedicated scorer editing page with a test button, scale preview, and code editor is a better UX than cramming everything into workspace modals. Scorers are shared across cases, so editing them in the context of a single case was misleading.

---

## 3. No Per-Query Parameter Overrides

**Angular:** `DevQueryParamsCtrl` allowed per-query parameter overrides ("tuning knobs" at the query level) that let developers tweak search params for individual queries.

**Now:** Not implemented.

**Why:** This was a rarely-used developer/power-user feature. Curator variables (which apply to the whole try) cover the primary use case. Per-query overrides add significant complexity for minimal benefit.

---

## 4. Case Sorting by `updated_at` Instead of `lastViewedAt`

**Angular:** `PUT api/cases/:id/metadata` tracked when a case was last viewed, and the case list sorted by last-viewed time.

**Now:** The API exists (`Api::V1::CaseMetadataController`) but no workspace code calls it. Cases sort by `updated_at`.

**Why:** Sorting by last-viewed was confusing — merely opening a case would move it to the top, even if nothing changed. Sorting by `updated_at` better reflects actual activity.

---

## 5. Server-Side Search Instead of Client-Side `splainer-search`

**Angular:** Search execution happened entirely in the browser via the `splainer-search` JavaScript library, which spoke directly to Solr/ES/OS.

**Now:** Search goes through `QuerySearchService` → `FetchService` on the server.

**Why:** Eliminates CORS configuration headaches (the #1 support issue), enables search engine credentials to stay server-side, and simplifies the JavaScript. The tradeoff is a small amount of added latency for each search request.

---

## 6. No Client-Side Document Cache

**Angular:** `docCacheSvc` maintained an in-memory cache of documents shared across controllers, avoiding redundant search engine calls during a session.

**Now:** Not needed.

**Why:** With server-side search, caching moves to the server layer. Each results render is a fresh Turbo Frame response. The simplification is worth it — the Angular doc cache was a source of stale-data bugs.

---

## 7. Feature Management Moved to Dedicated Pages

These Angular in-workspace modals are now handled by separate Rails pages. This is by design — complex CRUD workflows get their own pages rather than being squeezed into modals.

| Feature | Angular (workspace modal) | Now (dedicated page) |
|---------|--------------------------|---------------------|
| Archive/unarchive search endpoint | Workspace modal | Teams page |
| Create/edit/delete scorer | Workspace modals | `/scorers` page |
| Team member management | Workspace modals | `/teams/:id` page |
| Clone scorer, share scorer | Workspace modals | `/scorers` page |

---

## 8. Query List Renders All Queries (No Pagination)

**Angular:** `dir-pagination-controls` paginated the query list.

**Now:** All queries render at once. Filter and sort help manage large lists.

**Why:** Simplification. Pagination added complexity with minimal benefit since filter/sort handles the common "find a specific query" case. For extremely large cases (1000+ queries), this is a known tradeoff — virtual scrolling could be added later if needed, but hasn't been requested.

---

## 9. Two-Tier Scoring Instead of Client-Side Scoring

**Angular:** Scoring happened entirely in the browser. `scorerSvc` ran the scorer JavaScript against local results, computed per-query scores, and aggregated case-level scores — all in the same synchronous pipeline.

**Now:** Scoring uses a two-tier approach:
1. **Immediate per-query score:** After a rating change, `QueryScoreService` computes the score for just that query using existing ratings (no search engine call). The result updates the UI instantly.
2. **Background full-case evaluation:** `RunCaseEvaluationJob` re-scores all queries and computes the case-level aggregate, broadcasting the result via Turbo Stream.

**Why:** Client-side scoring required the full scorer JavaScript to run in the browser with access to all search results. With server-side search, results aren't held in client memory. The two-tier approach gives users immediate feedback on the query they just rated, while the full case score updates asynchronously. This is actually faster perceived UX than Angular — the query score badge updates before you could blink.

---

## 10. API Responses Support Turbo Stream, Not Just JSON

**Angular:** All API endpoints returned JSON. The Angular app parsed JSON and updated the DOM via two-way data binding.

**Now:** Key workspace API endpoints support both JSON and Turbo Stream responses:
- `RatingsController#update/destroy` — returns a `turbo_stream.update` that replaces the rating badge in place
- `AnnotationsController#create` — returns a `turbo_stream.prepend` that inserts the new annotation into the list
- Format is negotiated via the `Accept` header (Turbo sends `text/vnd.turbo-stream.html` automatically)

**Why:** Turbo Stream responses let the server send surgical DOM updates — "replace this one element" — without any client-side JavaScript to parse JSON and manipulate the DOM. The JSON format is preserved for API consumers and backward compatibility.

---

## 11. Authorization Scoped Through User Associations (IDOR Hardening)

**Angular:** Several controllers used global `Case.find` or `Team.find` to look up records, meaning any authenticated user could potentially access any case or team by ID.

**Now:** Controllers scope lookups through user associations:
- `CasesController#set_case` uses `current_user.cases_involved_with.find_by(id:)` instead of `Case.find_by(id:)`
- `TeamsController#set_team` uses `current_user.teams.find_by(id:)` with a `check_team` guard
- `TeamsController#share_case` scopes both team and case through `current_user`
- `QueryDocPairsController` scopes through `@book.query_doc_pairs`

**Why:** Defense in depth. Even though the Angular UI only showed a user's own cases and teams, the API endpoints were directly accessible. Now the server enforces that you can only access records you're associated with, regardless of how the request arrives.

**Key commit:** `010f3043`

---

## 12. Rating Deletion Is Nil-Safe

**Angular:** `RatingsController#destroy` called `@rating.delete` directly, which would raise if the rating didn't exist (e.g., double-click on "clear rating").

**Now:** Uses `@rating&.delete` with a nil guard. If the rating is already gone, the request succeeds silently instead of returning a 500 error.

**Why:** With Turbo Stream responses and real-time UI updates, race conditions are more likely (e.g., two browser tabs, or a Turbo Stream broadcast already cleared the rating). Graceful handling is better than crashing.

---

# New Features (Not in Angular)

These features have no Angular equivalent. They are new capabilities added during the migration. Documenting them here so they aren't mistaken for unfinished migration artifacts.

---

## 13. Case Export (CSV)

`ExportCaseComponent` → `Core::ExportsController` → `ExportCaseJob` → `ExportCaseService`

Users can export case data as CSV in three formats:
- **General** — summary scores per query
- **Detailed** — individual ratings per query/doc pair
- **Snapshot** — snapshot document positions

The export runs asynchronously via `ExportCaseJob` and broadcasts progress via Turbo Stream. Angular had no export feature — case data was only accessible through the API.

---

## 14. Case Import (CSV/RRE/LTR)

`ImportRatingsComponent` → `Core::ImportsController` → `ImportCaseRatingsJob`

Users can import relevance judgements from external formats:
- CSV (hash format)
- RRE JSON
- LTR text format

Import status is tracked via the `CaseImport` model. Angular had no import capability.

---

## 15. Search Endpoint Field Introspection

`Api::V1::SearchEndpoints::FieldsController#index`

Returns available fields for a search endpoint by introspecting the search engine directly:
- Solr: schema API
- Elasticsearch/OpenSearch: mapping API
- Algolia: index settings
- Vectara: corpus metadata

Used by the new case wizard and workspace field autocomplete. Angular required users to manually type field names.

---

## 16. Search Endpoint Validation

`Api::V1::SearchEndpoints::ValidationsController`

Tests whether a search endpoint is reachable and properly configured before saving. Angular would only discover connection problems when you tried to search.

---

## 17. Snapshot Creation from Live Search

`TakeSnapshotComponent` → `CreateSnapshotFromSearchJob`

Users can take a named snapshot at any time from the workspace. The job fetches current search results for all queries and populates the snapshot asynchronously. Angular only created snapshots as a side effect of running a full case evaluation.

---

## 18. Server-Side Query Execution API

`Api::V1::Tries::Queries::SearchController#show`

Central endpoint for executing a query and returning results with ratings merged in. Supports:
- Format negotiation: HTML (renders `DocumentCardComponent` partials) or JSON
- Query text override (`q` param) for DocFinder
- Pagination (`rows`, `start`)
- Rated-only filter (`show_only_rated`)
- Snapshot diff (`diff_snapshot_ids[]`)

This is the server-side replacement for `splainer-search`. Angular executed searches entirely in the browser.

---

## 19. Lightweight Per-Query Scoring API

`Api::V1::Queries::ScoresController#create` → `QueryScoreService`

Scores a single query using its existing ratings without re-fetching from the search engine. Returns `{ score, max_score }` immediately. This powers the instant score badge update after rating a document — Angular computed scores client-side in the same thread.

---

## 20. Query Notes Endpoint

`Core::Queries::NotesController`

Dedicated endpoint for updating a query's information need / notes field. Angular handled this inline through the query update API.

---

## 21. Vectara and Algolia Document Extraction

`FetchService#extract_docs_from_response_body_for_vectara`
`FetchService#extract_docs_from_response_body_for_algolia`

Server-side document extraction for Vectara (v1 responseSet format) and Algolia (`hits` array with `objectID`). Used by `QuerySearchService`, `RunCaseEvaluationJob`, and `CreateSnapshotFromSearchJob`. Angular delegated this to `splainer-search` in the browser; the server-side jobs had TODOs for these engines.

---

# Adding to This Document

When you make a deliberate choice to differ from the Angular behavior, add an entry here with:
1. What Angular did
2. What we do now
3. Why the change is intentional
4. Key commit hash if applicable

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

## Adding to This Document

When you make a deliberate choice to differ from the Angular behavior, add an entry here with:
1. What Angular did
2. What we do now
3. Why the change is intentional
4. Key commit hash if applicable

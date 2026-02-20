# Main vs deangularjs-experimental: Deep Dive Comparison

**Date:** 2026-02-19  
**Branches:** `main` vs `deangularjs-experimental`  
**Scope:** Functionality, visual aesthetics, and behavioral changes

---

## Executive Summary

The `deangularjs-experimental` branch completes a full migration from AngularJS to Rails server-rendered views + Stimulus controllers + Turbo. **379 files were deleted**, **898 files changed** overall, with ~36,752 insertions and ~42,430 deletions.

**Key outcomes:**
- AngularJS has been **completely removed** from the codebase
- All workspace features are now implemented with **37 ViewComponents** and **60 Stimulus controllers**
- Most functionality has **parity** or **improved** equivalents
- A few features were **intentionally dropped** (documented below)
- One major feature was **removed** (Admin Communal Scorers UI)
- Visual layout is at **parity** for 23 of 26 pages; the case workspace is the expected structural difference

---

## 1. Branch Overview

### What Changed

| Category | Main | deangularjs-experimental |
|----------|------|--------------------------|
| Frontend stack | AngularJS SPA | Rails views + Stimulus + Turbo |
| Core workspace | Client-side Angular (`queriesLayout.html`, `MainCtrl`) | Server-rendered (`core/show.html.erb`, ViewComponents) |
| Search execution | Browser (`splainer-search`) | Server (`QuerySearchService`, `FetchService`) |
| Scoring | Client-side (`scorerSvc`, `ScorerFactory`) | Two-tier: server per-query + background job |
| Layout | `core.html` + Angular templates | `core_modern.html` + ERB |
| Build | Karma + JSHint + Angular build | Vitest + ESLint + Prettier |

### Deleted Files (379 total)

- **~90 Angular components** (directives, controllers, templates)
- **~30 Angular services** (caseSvc, queriesSvc, settingsSvc, etc.)
- **~20 Angular controllers** (MainCtrl, QueriesCtrl, SearchResultsCtrl, etc.)
- **~15 Angular templates** (queries.html, searchResults.html, wizardModal.html, etc.)
- **Bootstrap 3** CSS (~7,800 lines) replaced by Bootstrap 5
- **Admin Communal Scorers** (controller, views, tests)
- **JSHint** config and lib; **Karma** config and specs
- **build_angular_app.js**, **build_templates.js**

---

## 2. Functionality Lost / Removed

### 2.1 Admin Communal Scorers (Entire Feature)

**Status:** Removed and replaced.

- **Removed:** `admin/communal_scorers_controller.rb`, all views (`index`, `show`, `new`, `edit`, `_form`), route, admin nav link
- **Replacement:** Admins now edit communal scorers from the regular `/scorers` page
- **Documentation:** `docs/port/admin_scorer_editing.md`

### 2.2 Per-Query Parameter Overrides (Dev Tuning Knobs)

**Status:** Intentionally not implemented.

- **Main:** `DevQueryParamsCtrl` allowed per-query parameter overrides for developers
- **Experimental:** Not ported
- **Reason:** Rarely used; curator variables (try-level) cover the primary use case

### 2.3 Case Sorting by Last Viewed

**Status:** Behavior changed.

- **Main:** `PUT api/cases/:id/metadata` tracked `last_viewed_at`; case list sorted by last-viewed
- **Experimental:** Cases sort by `updated_at`; metadata API exists but is not called
- **Reason:** Last-viewed sorting was confusing (opening a case moved it to top with no real change)

### 2.4 Manual "Push to Book" for Judgements

**Status:** Replaced by automatic sync.

- **Main:** "Populate Judgements" checkbox and manual push from workspace to Book
- **Experimental:** Ratings flow to Books automatically via `JudgementFromRatingJob`
- **Reason:** Old two-way sync had no conflict resolution; automatic sync is the source of truth

### 2.5 Client-Side Document Cache

**Status:** Removed.

- **Main:** `docCacheSvc` cached documents in memory across controllers
- **Experimental:** Not used; server-side search returns fresh results per request
- **Reason:** Server-side search makes client cache unnecessary; Angular cache caused stale-data bugs

### 2.6 In-Workspace Scorer CRUD Modals

**Status:** Moved to dedicated page.

- **Main:** Create, edit, clone, delete, share scorers from workspace modals
- **Experimental:** Scorer *selection* only in workspace; all CRUD on `/scorers` page
- **Reason:** Dedicated page provides better UX (test button, scale preview, code editor)

### 2.7 In-Workspace Archive/Unarchive Search Endpoint

**Status:** Moved to Teams page.

- **Main:** Archive/unarchive search endpoint from workspace modal
- **Experimental:** Handled on `/teams/:id` page
- **Reason:** Feature management consolidated on dedicated pages

### 2.8 In-Workspace Team Member Management

**Status:** Moved to Teams page.

- **Main:** Add/remove members via workspace modals
- **Experimental:** Managed on `/teams/:id` page
- **Reason:** Same consolidation as above

---

## 3. Functionality Changed

### 3.1 Search Execution

| Aspect | Main | Experimental |
|--------|------|--------------|
| Where | Browser (`splainer-search`) | Server (`QuerySearchService` → `FetchService`) |
| CORS | Required search engine CORS config | Not needed; server proxies |
| Credentials | Client-side (support issue #1) | Server-side only |
| Latency | Lower (direct) | Slightly higher (server round-trip) |

### 3.2 Scoring

| Aspect | Main | Experimental |
|--------|------|--------------|
| Execution | Client-side, synchronous | Two-tier: server per-query + background job |
| Per-query update | After rating, full re-score in browser | `QueryScoreService` → immediate badge update |
| Full case score | Same pipeline | `RunCaseEvaluationJob` → Turbo Stream broadcast |
| Fallback | N/A | Uses `Case#last_score` if scorer errors |

### 3.3 Query List Pagination

| Aspect | Main | Experimental |
|--------|------|--------------|
| Mechanism | `dir-paginate` (15 per page) | Client-side, 15 per page |
| Filter/sort | Applied before pagination | Same; filter/sort then paginate |
| URL | N/A | `?page=N` persisted |

### 3.4 API Response Formats

- **Main:** JSON only
- **Experimental:** JSON + Turbo Stream (`text/vnd.turbo-stream.html`) for surgical DOM updates (rating badges, annotations, etc.)

### 3.5 Authorization (IDOR Hardening)

- **Main:** Some controllers used `Case.find`, `Team.find` (any authenticated user could access by ID)
- **Experimental:** Scoped through `current_user.cases_involved_with`, `current_user.teams`

### 3.6 Rating Deletion

- **Main:** `@rating.delete` could raise on double-click
- **Experimental:** `@rating&.delete` with nil guard; succeeds silently if already gone

---

## 4. Visual Aesthetics

### 4.1 Layout Parity (23 of 26 Pages)

The following pages have **full layout parity** with main. Differences are due to seed data, not structure:

- Login, Home, Cases index/archived
- Books (index, show, new, edit)
- Scorers (index, new)
- Search Endpoints (index, new, show)
- Teams (index, show)
- Profile, Admin Panel, Admin Users, Admin Announcements
- Query Doc Pairs, Book Judgements, Book Export, Book Judgement Stats
- Analytics/Tries

### 4.2 Pages with Notable Differences

#### Case Workspace (Expected)

- **Main:** Angular SPA — "SOLR CASE — Try 1 — AP@10" header, query list + results pane
- **Experimental:** Server-rendered workspace — different navigation pattern, same functional areas
- **Note:** This is the core migration target; structural difference is intentional

#### Book Judge

- **Main:** Judging form with rating scale
- **Experimental:** Same form; if user has judged all pairs, redirects with "You Have Judged All Available Pairs"
- **Note:** Data-dependent, not structural

#### Cases Archived

- **Main/Experimental:** Same layout; different archived case counts due to seed data

### 4.3 Stylesheet Changes

| Deleted | Added/Modified |
|---------|----------------|
| `admin.css`, `base.css`, `panes.css` | `core-diff.css`, `core-json-tree.css`, `core-layout.css`, `core-modals.css`, `core-results.css`, `core-workspace.css`, `turbo.css`, `variables.css` |
| `books.css`, `scorers.css`, `search_endpoints.css`, `teams.css`, `users.css` | Consolidated into shared styles |
| `bootstrap3.css` (~6,700 lines), `bootstrap3-add.css` | Bootstrap 5 + `bootstrap5-add.css` |

### 4.4 Bootstrap Upgrade

- **Main:** Bootstrap 3
- **Experimental:** Bootstrap 5
- **Impact:** Modal API changes (e.g., `bootstrap.Modal.getOrCreateInstance()`), utility class renames, form styling updates

---

## 5. Intentional Design Changes

These are documented in `docs/port/intentional_design_changes.md`. Summary:

1. **Book sync:** Automatic instead of manual push
2. **Scorer management:** Dedicated `/scorers` page
3. **Per-query overrides:** Not implemented
4. **Case sorting:** `updated_at` instead of `last_viewed_at`
5. **Search:** Server-side instead of client-side
6. **Document cache:** Removed
7. **Feature modals:** Moved to dedicated pages (teams, scorers, search endpoints)
8. **Query pagination:** Client-side with URL persistence
9. **Scoring:** Two-tier server-side
10. **API responses:** Turbo Stream support
11. **Authorization:** IDOR hardening
12. **Rating deletion:** Nil-safe

---

## 6. New Features (Not in Main)

| Feature | Description |
|---------|-------------|
| **Case Export (CSV)** | Export case data (General, Detailed, Snapshot formats) via `ExportCaseJob` |
| **Case Import (CSV/RRE/LTR)** | Import relevance judgements from external formats via `ImportCaseRatingsJob` |
| **Search Endpoint Field Introspection** | `/api/v1/search_endpoints/:id/fields` — Solr, ES, Algolia, Vectara |
| **Search Endpoint Validation** | Pre-save validation of endpoint reachability |
| **Snapshot from Live Search** | `CreateSnapshotFromSearchJob` — take named snapshot from workspace |
| **Server-Side Query Search API** | `Api::V1::Tries::Queries::SearchController` — central search endpoint |
| **Query Notes Endpoint** | `Core::Queries::NotesController` for info need/notes |
| **Vectara/Algolia Document Extraction** | Server-side extraction for these engines |
| **Expand All Queries** | New in experimental (Angular had collapse-only) |

---

## 7. Known Bugs / Regressions

From `docs/port/code_review_deangularjs.md` and `docs/port/todo/code_review_findings.md`:

### Critical

| # | Issue | Location |
|---|-------|----------|
| 1 | HTML ID sanitization incomplete (doc IDs with special chars break modals) | `document_card_component.rb:82` |
| 2 | CSRF token null reference (no `?.` guard) | `bulk_judgement_controller.js:281` |
| 3 | Bare `bootstrap` global (ReferenceError if Bootstrap not loaded) | `document_fields_modal_controller.js:26` |
| 4 | N+1 query in snapshot scoring | `fetch_service.rb:243-261` |
| 5 | N+1 query in book import | `book_importer.rb:99` |

### High

| # | Issue | Location |
|---|-------|----------|
| 6 | Relative URLs in fetch (break on subpath deploy) | `bulk_judgement_controller.js` |
| 7 | Missing `disconnect()` cleanup (memory leaks) | Multiple Stimulus controllers |
| 8 | Race condition in autocomplete (no AbortController) | `team_member_autocomplete_controller.js` |
| 9 | No disconnect() for export case controller | `export_case_controller.js` |

### Security (from code_review_findings)

| # | Issue | Severity |
|---|-------|----------|
| 7 | Proxy controller SSRF risk (unauthenticated, no URL validation) | P1 |
| 8 | CSRF bypass in proxy, sessions, signups | P2 |

---

## 8. File Summary

| Change Type | Count |
|-------------|-------|
| Deleted | 379 |
| Modified | ~450 |
| Added | ~170 |
| **Total changed** | **898** |

### Key Additions

- **ViewComponents:** 37 (e.g., `DocumentCardComponent`, `ResultsPaneComponent`, `SettingsPanelComponent`)
- **Stimulus controllers:** 60 (e.g., `query_list_controller.js`, `results_pane_controller.js`, `settings_panel_controller.js`)
- **Rails controllers:** `CasesController`, `ScorersController`, `TeamsController`, `Core::ExportsController`, `Core::ImportsController`
- **Services:** `ExportCaseService`, `QuerySearchService`, `QueryScoreService`, `FetchService` updates
- **Jobs:** `ExportCaseJob`, `ImportCaseRatingsJob`, `CreateSnapshotFromSearchJob`
- **Tests:** Vitest specs for Stimulus controllers; Rails component/controller tests
- **Visual parity tooling:** `test/visual_parity/` (Playwright screenshots, API comparison)

---

## 9. References

| Document | Purpose |
|----------|---------|
| `docs/port/archives/deangularjs_branch_comparison.md` | Migration summary, removed/added items |
| `docs/port/archives/port_completed.md` | Full parity audit, component mapping, resolved gaps |
| `docs/port/intentional_design_changes.md` | Deliberate behavioral differences |
| `docs/port/visual_parity.md` | Screenshot/API comparison results |
| `docs/port/code_review_deangularjs.md` | Critical/high/medium code review findings |
| `docs/port/todo/code_review_findings.md` | Security, performance, missing functionality |
| `docs/port/api_client.md` | URL/navigation rules |
| `docs/port/workspace_api_usage.md` | Workspace API endpoints |

---

## 10. How to Re-run Visual Parity

```bash
# Full automated comparison (both branches, ~20 min)
bash test/visual_parity/run_comparison.sh

# Single branch capture (app must be running)
node test/visual_parity/capture_screenshots.mjs --branch <name> --email <user> --password <pass>
node test/visual_parity/compare_apis.mjs --branch <name> --email <user> --password <pass>

# Generate report from existing captures
bash test/visual_parity/run_comparison.sh --report

# Open report
xdg-open test/visual_parity/report.html
```

# Visual & Functional Parity Report: `deangularjs` vs `deangularjs-experimental`

> Generated 2026-02-20 from visual parity screenshots, git diff analysis, and API structure comparison.

## Executive Summary

The `deangularjs-experimental` branch is a **complete rewrite** of the Angular frontend into server-rendered ViewComponents + Stimulus + Turbo Streams. API structures are **identical** (9/9 endpoints match). Most pages (22 of 26 screenshotted views) are **visually identical**. The primary parity gap is the **case workspace** (screenshot 04), which has been intentionally redesigned into a two-panel layout. Three other pages have minor differences.

The experimental branch adds significant new functionality (server-side search, Turbo Streams, expanded tour, SSRF protection, IDOR fixes) but is also **missing some fixes/improvements** that landed on `deangularjs`.

---

## Table of Contents

1. [API Parity](#1-api-parity)
2. [Visual Parity — Screenshot-by-Screenshot](#2-visual-parity--screenshot-by-screenshot)
3. [Architecture Changes](#3-architecture-changes)
4. [Functional Differences](#4-functional-differences)
5. [Features in Experimental Not in deangularjs](#5-features-in-experimental-not-in-deangularjs)
6. [Fixes/Features in deangularjs Not in Experimental](#6-fixesfeatures-in-deangularjs-not-in-experimental)
7. [Security Improvements (Experimental Only)](#7-security-improvements-experimental-only)
8. [Recommended Action Items](#8-recommended-action-items)

---

## 1. API Parity

**Status: ✅ Full parity** — All 9 API endpoints produce identical JSON key structures.

| Endpoint | Status |
|----------|--------|
| `books` | ✅ Identical |
| `book_detail` | ✅ Identical |
| `cases` | ✅ Identical |
| `case_detail` | ✅ Identical |
| `current_user` | ✅ Identical |
| `scorers` | ✅ Identical |
| `search_endpoints` | ✅ Identical |
| `teams` | ✅ Identical |
| `team_detail` | ✅ Identical |

---

## 2. Visual Parity — Screenshot-by-Screenshot

### Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Visually identical (data differences only from test timing) |
| ⚠️ | Minor visual difference |
| ❌ | Major visual difference / redesign |

### Results

| # | Page | Status | Notes |
|---|------|--------|-------|
| 00 | Login Page | ✅ | Identical |
| 01 | Home Dashboard | ✅ | Greeting word varies (randomized), score values differ from test timing |
| 02 | Cases Index | ✅ | Identical layout; data timestamps differ |
| 03 | Cases Archived | ✅ | Identical |
| 04 | **Case Workspace** | ❌ | **Major redesign** — see detailed analysis below |
| 05 | Books Index | ✅ | Identical |
| 06 | Book Show | ✅ | Identical layout; progress numbers differ from test data |
| 07 | Book New | ✅ | Identical |
| 08 | Book Edit | ✅ | Identical |
| 09 | Scorers Index | ✅ | Identical |
| 10 | Scorers New | ⚠️ | Experimental adds "Save the scorer first to see the Test button" text |
| 11 | Search Endpoints Index | ✅ | Identical |
| 12 | Search Endpoints New | ✅ | Identical |
| 13 | Search Endpoint Show | ✅ | Identical |
| 14 | Teams Index | ✅ | Identical |
| 15 | Team Show | ⚠️ | Column differences in Books/Search Endpoints tables ("Shared" column) |
| 16 | Profile | ✅ | Identical layout; query count differs from test data |
| 17 | Analytics Tries | ✅ | Identical |
| 18 | Admin Dashboard | ✅ | Identical |
| 19 | Admin Users | ✅ | Identical layout; login counts differ |
| 20 | Admin Announcements | ✅ | Identical |
| 21 | Query Doc Pairs | ✅ | Identical layout; different test data displayed |
| 22 | Book Judgements | ✅ | Identical layout; different test data displayed |
| 23 | Book Judge | ✅ | Identical layout; different query/doc shown |
| 24 | Book Export | ✅ | Identical |
| 25 | Book Judgement Stats | ✅ | Identical layout; counts differ from test data |

**Summary: 22 identical, 2 minor differences, 1 major difference, 1 trivial (randomized greeting)**

---

### Detailed Analysis: 04 — Case Workspace (❌ MAJOR)

This is the most significant difference between the two branches. The experimental branch has fundamentally redesigned the workspace.

#### deangularjs (Angular)
- **Single-column layout** with a toolbar row at the top
- Header: "Current case / SOLR CASE -- Try 1 -- AP@10"
- Toolbar buttons: "Main Issues", "Judgements", "Create Snapshot", "Compare Snapshots", "Export", "Share case", "Clone", "Delete", "Filter Reference"
- "Add a query to this case" input with green "Add query" button
- Filter controls: "Fuzzy only order", "Collapse all", "Sort: Manual"
- "Number of Queries: 0" counter
- Yellow notification bar: "All queries finished successfully!"
- Footer with copyright

#### deangularjs-experimental (ViewComponent/Stimulus)
- **Two-panel split layout** — query list sidebar on left, results panel on right
- Simpler header: "SOLR CASE" with breadcrumbs for try/scorer
- Different toolbar: "Annotations", "Create Snapshot", "Compare Snapshots" as styled links
- Action buttons: "Filter Reference", "Reorder", "Clone"
- Left panel: "Queries" section with numbered list
- Right panel: "Results" area with "Select a query from the list to view its search results and rate documents."
- Collapsible panels with draggable resizer
- Missing from toolbar: "Main Issues", "Judgements", "Export", "Share case", "Delete" (these may be in menus/modals)

#### What needs to happen for parity
The experimental workspace is an intentional redesign, so "parity" here means ensuring **all the same functionality is accessible**, not necessarily replicating the exact layout. Verify:
- [ ] All toolbar actions accessible (Export, Share, Delete, Main Issues, Judgements)
- [ ] Filter controls present (fuzzy order, collapse all, sort mode)
- [ ] Query count visible
- [ ] Success/error notification system works
- [ ] Keyboard shortcuts preserved

---

### Detailed Analysis: 10 — Scorers New (⚠️ MINOR)

**Difference:** Experimental adds helper text "Save the scorer first to see the Test button" between the code editor and the Scale options section. This is related to the new `scorers/:id/test` endpoint — the test button only appears after saving. This is additive, not a regression.

---

### Detailed Analysis: 15 — Team Show (⚠️ MINOR)

**Difference:** Table column structure differs:
- **deangularjs**: Books table has "Shared Books" column; Search Endpoints table has "Shared" column
- **experimental**: These "Shared" columns appear absent or renamed

This may reflect the filtering cleanup commits on `deangularjs` (`d31f99c2`, `c2f54d5f`) that improved team pages. Verify whether the experimental branch needs to port these column additions.

---

## 3. Architecture Changes

### Layout System

| Aspect | deangularjs | experimental |
|--------|-------------|--------------|
| Layout | `core.html.erb` (Angular SPA) | `core_modern.html.erb` (Turbo/Stimulus) |
| Workspace | `core/index.html.erb` (`ng-view`) | `core/show.html.erb` (server-rendered) |
| Header | `_header_core_app.html.erb` (`ng-controller`) | Shared `_header.html.erb` (BS5 navbar) |
| CSS framework | Bootstrap 3 (`bootstrap3.css` — 6,722 lines) | Bootstrap 5 (via gem) + CSS custom properties |
| JS framework | AngularJS (~200+ files) | Stimulus controllers (65+) + Turbo |
| JS tests | Karma + Jasmine | Vitest |
| JS linting | JSHint | ESLint + Prettier |
| Routing | `core#index` (Angular takes over client-side) | `core#show` (server-rendered + Turbo) |

### CSS Migration

| File | Change |
|------|--------|
| **Removed** `bootstrap3.css` | 6,722 lines of Bootstrap 3 |
| **Removed** `bootstrap3-add.css` | 1,159 lines of BS3 overrides |
| **Removed** `panes.css` | 34 lines |
| **Removed** `admin.css` | 16 lines |
| **Added** `variables.css` | 156 lines — CSS custom properties design tokens |
| **Added** `core-layout.css` | 263 lines — base workspace layout |
| **Added** `core-workspace.css` | 134 lines — collapsible panels, resizer |
| **Added** `core-results.css` | 77 lines — document cards, results |
| **Added** `core-modals.css` | 81 lines — modal overrides |
| **Added** `core-diff.css` | 84 lines — snapshot diff comparison |
| **Added** `core-json-tree.css` | 28 lines — collapsible JSON viewer |
| **Added** `sidebar.css` | 65 lines — extracted from inline styles |
| **Added** `turbo.css` | 12 lines — Turbo Stream animations |
| **Modified** `qscore.css` | Element selectors → class selectors; `:only-of-type` → `:only-child`; CSS variables |
| **Modified** `qgraph.css` | `qgraph` → `.qgraph-wrapper`; CSS variables |
| **Modified** `misc.css` | Removed 100+ lines of BS3 utilities; CSS variables |
| **Modified** `style.css` | Removed Angular rating styles; CSS variables |

### New Routing (experimental only)

| Route | Purpose |
|-------|---------|
| `POST scorers/:id/test` | Live scorer testing |
| `GET tries/:try_number/queries/:query_id/search` | Server-side query execution |
| `GET tries/:try_number/queries/:query_id/search/raw` | Raw search response |
| `POST queries/:query_id/score` | Single-query scoring |
| `GET search_endpoints/:id/fields` | Schema field discovery |
| `POST search_endpoints/validation` | URL validation (SSRF-safe) |
| `GET export/cases/:id/{general,detailed,snapshot}` | CSV exports |
| `GET /case/:id(/try/:try_number)` → `core#show` | Server-rendered workspace |
| `POST /case/:id/queries` | Turbo Stream query CRUD |
| `PUT /case/:id/queries/:query_id/notes` | Turbo Stream notes |
| `DELETE /case/:id/queries/:query_id` | Turbo Stream query deletion |
| `POST /case/:id/export` | Async background export |
| `POST /case/:id/import/ratings` | Web UI ratings import |
| `POST /case/:id/import/information_needs` | Web UI information needs import |

---

## 4. Functional Differences

### New Controllers (experimental only)

| Controller | Replaces |
|-----------|----------|
| `Core::QueriesController` | Angular query CRUD |
| `Core::Queries::NotesController` | Angular notes editing |
| `Core::ExportsController` | Angular export UI |
| `Core::ImportsController` | Angular import UI |
| `Api::V1::Tries::Queries::SearchController` | Client-side Angular search |
| `Api::V1::Queries::ScoresController` | Client-side Angular scoring |
| `Api::V1::SearchEndpoints::FieldsController` | Manual field spec entry |
| `Api::V1::SearchEndpoints::ValidationsController` | No equivalent |

### New Services (experimental only)

| Service | Function |
|---------|----------|
| `QuerySearchService` | Server-side query execution against search endpoints |
| `QueryScoreService` | Scores individual query from ratings |
| `ExportCaseService` | Generates CSV exports (general, detailed, snapshot) |
| `UrlParserService` | URL validation/parsing |
| `FetchService` (enhanced) | `make_request` method, better error handling |

### New Background Jobs (experimental only)

| Job | Function |
|-----|----------|
| `CreateSnapshotFromSearchJob` | Server-side snapshot creation |
| `ExportCaseJob` | Background CSV export |
| `ImportCaseRatingsJob` | Background ratings import |
| `RunCaseEvaluationJob` (enhanced) | Turbo Stream broadcasting |

### New ViewComponents (73 components)

Key components replacing Angular functionality:

| Component | Replaces Angular |
|-----------|-----------------|
| `NewCaseWizardComponent` | wizardCtrl (expanded: 5 → 9 steps) |
| `SettingsPanelComponent` | settingsCtrl |
| `ScorerPanelComponent` | scorerCtrl |
| `ChartPanelComponent` | qgraphDirective |
| `QueryListComponent` | queriesCtrl + queryListDirective |
| `ResultsPaneComponent` | searchResultsDirective |
| `DocumentCardComponent` | docDirective |
| `AnnotationsComponent` | annotationsCtrl |
| `TakeSnapshotComponent` | snapshotCtrl |
| `DiffComponent` | diffCtrl |
| `ExportCaseComponent` | exportCaseCtrl |
| `ImportRatingsComponent` | importRatingsCtrl |
| `ShareCaseComponent` | shareCaseCtrl |
| `CloneCaseComponent` | cloneCaseCtrl |
| `DeleteCaseComponent` | deleteCaseCtrl |
| `JudgementsComponent` | judgementsCtrl |
| `FrogReportComponent` | frogReportCtrl |
| `DocFinderComponent` | docFinderCtrl |

### New Stimulus Controllers (65+)

Key replacements:

| Stimulus Controller | Replaces Angular | Lines |
|----|----|----|
| `results_pane_controller.js` | queriesCtrl + searchResultsDirective | 747 |
| `query_list_controller.js` | queriesCtrl + queryListDirective | 459 |
| `settings_panel_controller.js` | settingsCtrl | 511 |
| `new_case_wizard_controller.js` | wizardCtrl | 537 |
| `import_ratings_controller.js` | importRatingsCtrl | 295 |
| `export_case_controller.js` | exportCaseCtrl | 300 |
| `annotations_controller.js` | annotationsCtrl | 232 |
| `frog_report_controller.js` | frogReportCtrl | 218 |
| `diff_controller.js` | diffCtrl | 222 |
| `doc_finder_controller.js` | docFinderCtrl | 281 |
| `judgements_controller.js` | judgementsCtrl | 316 |
| `tour_controller.js` | (new, expanded) | 163 |
| `workspace_panels_controller.js` | (new, collapsible panels) | 103 |
| `workspace_resizer_controller.js` | (new, draggable resizer) | 159 |
| `json_tree_controller.js` | (new, JSON viewer) | 127 |
| `turbo_events_controller.js` | (new, Turbo events) | 101 |

---

## 5. Features in Experimental Not in deangularjs

1. **Server-side query execution** — searches happen server-side via `QuerySearchService` / `FetchService`, not client-side
2. **Turbo Stream live updates** — query CRUD, score updates, export/import notifications broadcast in real-time
3. **Collapsible workspace panels** — east/west panels with draggable resizer
4. **Expanded guided tour** — 9 steps (was 5 in Angular)
5. **Inline editing** — double-click to rename case and try
6. **Server-side CSV exports** — general, detailed, snapshot formats via background job
7. **Server-side snapshot creation** — `CreateSnapshotFromSearchJob`
8. **URL validation with SSRF protection** — blocks private IP ranges
9. **Schema field discovery** — auto-populate field spec from Solr luke / ES mapping API
10. **Scorer testing endpoint** — live test scorer with sample documents
11. **Collapsible JSON tree viewer** — for document explain/field inspection
12. **Lightweight single-query scoring** — score individual queries without full evaluation
13. **Turbo Stream score broadcasting** — case header score updates in real-time
14. **Web UI import** — ratings and information needs import without API calls
15. **Security hardening** — IDOR fixes, XSS fixes, SSRF protection, formula injection prevention

---

## 6. Fixes/Features in deangularjs Not in Experimental

These commits exist on `deangularjs` but **not** on `deangularjs-experimental` and may need to be cherry-picked or ported:

| Commit | Description | Priority |
|--------|-------------|----------|
| `e1cd6125` | Memory leak fix | **High** — may affect experimental's Stimulus controllers |
| `a897f990` | Better error handling | **Medium** — experimental has different error approach |
| `73734c50` | Form simplification and partials cleanup | **Low** — different UI architecture |
| `318b4490` | Filtering logic cleanup | **Medium** — may affect team/case filtering |
| `d31f99c2` | Team page improvements | **Medium** — explains team show column differences |
| `c2f54d5f` | Team page improvements (continued) | **Medium** |
| `a64fe728` | Fewer cases on home page | **Low** — UX preference |
| `d83f7e41` | Handle add user with no data | **Medium** — edge case handling |
| `20d210c1` | Merge from main | **High** — experimental may be missing upstream fixes |
| Various | Dependency bumps (database_consistency, pagy, oas_rails) | **Medium** — keep deps current |

---

## 7. Security Improvements (Experimental Only)

These security fixes exist only in `deangularjs-experimental`:

1. **IDOR (Insecure Direct Object Reference) fixes** in `TeamsController` — all `Team.find(id)` calls replaced with `current_user.teams.find_by(id:)` + nil checks
2. **XSS fix** — `html_safe` replaced with `sanitize()` for rendering announcement text in the header
3. **SSRF protection** — `ValidationsController` blocks private IP ranges when validating search endpoint URLs
4. **CSV formula injection prevention** — export CSV cells starting with `=`, `@`, `+`, `-` are prefixed with a space
5. **Marshal.dump removal** — snapshot serialization uses JSON instead of `Marshal.dump` (prevents deserialization attacks)

> **Note:** These security fixes should be backported to `deangularjs` regardless of parity work.

---

## 8. Recommended Action Items

### To Achieve Visual Parity

#### P0 — Case Workspace (screenshot 04)
The workspace is intentionally redesigned, so visual parity means **functional parity**:

- [ ] Verify all toolbar actions are accessible: Export, Share case, Delete, Main Issues/Annotations
- [ ] Verify filter controls exist: fuzzy ordering, collapse all, sort mode selector
- [ ] Verify query count is displayed
- [ ] Verify success/error notification bar works
- [ ] Verify keyboard shortcuts are preserved
- [ ] Ensure "Judgements" link/button is accessible from workspace

#### P1 — Team Show (screenshot 15)
- [ ] Port team page improvements from `deangularjs` (`d31f99c2`, `c2f54d5f`)
- [ ] Add "Shared" column back to Books and Search Endpoints tables on team show page

#### P2 — Scorers New (screenshot 10)
- [ ] No action needed — the "Save first to test" text is additive and helpful

### To Achieve Functional Parity

- [ ] Cherry-pick or port memory leak fix (`e1cd6125`)
- [ ] Cherry-pick or port "handle add user with no data" (`d83f7e41`)
- [ ] Merge latest `main` into experimental (to pick up changes from `20d210c1` merge)
- [ ] Port dependency bumps (database_consistency, pagy, oas_rails)
- [ ] Port filtering logic cleanup (`318b4490`) — adapt for Stimulus architecture
- [ ] Port "fewer cases on home page" (`a64fe728`) if desired

### Security Backports (to deangularjs)
- [ ] Backport IDOR fix from `TeamsController`
- [ ] Backport XSS fix (`html_safe` → `sanitize()`)
- [ ] Backport SSRF protection for search endpoint validation
- [ ] Backport CSV formula injection prevention
- [ ] Backport `Marshal.dump` → JSON serialization for snapshots

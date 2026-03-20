# Plan: Eliminate Remaining AngularJS (Core Case UI)

This document is the **migration plan** for removing AngularJS from Quepid while **preserving the feature set available on `main`**. It builds on the existing inventories and the patterns established when teams, scorers, and the cases listing moved to Rails + Stimulus ([PR #1642](https://github.com/o19s/quepid/pull/1642)).

## Related documentation

| Document | Purpose |
|----------|---------|
| [angularjs_inventory.md](./angularjs_inventory.md) | File-level map: modules, services, controllers, build pipeline |
| [angularjs_ui_inventory.md](../angularjs_ui_inventory.md) | Feature-level map tied to screenshots and templates |
| [app_structure.md](../app_structure.md) | High-level backend / frontend layout |
| [angular_services_responsibilities_mapping.md](./angular_services_responsibilities_mapping.md) | Angular services → server vs client after the port (parity-first; not `deangularjs-experimental` stack) |
| [workspace_api_usage.md](./workspace_api_usage.md) | JSON API paths used by the core workspace |
| [workspace_behavior.md](./workspace_behavior.md) | How the Angular core workspace behaves today (flows, flash, realtime) |
| [rails_stimulus_migration_alternative.md](./rails_stimulus_migration_alternative.md) | Stimulus + Turbo port in detail (default stack alignment with this plan) |
| [old/react_migration_plan.md](./old/react_migration_plan.md) | React port alternative (same APIs; coexist behind a flag) |
| [intentional_design_changes.md](./intentional_design_changes.md) | **§1** API hardening / robustness to align with; **§2** experimental-style product ideas — **not** default parity scope |
| [deangularjs_experimental_review.md](./deangularjs_experimental_review.md) | Review of `deangularjs-experimental`: reuse (parity tooling, security ideas) vs avoid (full stack merge; server search/scoring) |

**Authority:** This file is the single source for **migration scope**, **P0 parity**, **client-side interactive search** (`splainer-search`, `/proxy/fetch`), and **client-side scoring** (`ScorerFactory`). Other docs in `docs/migration/` link here instead of restating those rules; product-only changes belong in [intentional_design_changes.md](./intentional_design_changes.md) §2 with sign-off.

## Goals

1. **Remove AngularJS** from the production bundle: no `ng-app`, no `QuepidApp`, no Angular vendor packages required for core evaluation.
2. **Preserve behavior** on `main`: every user-visible capability of `/case/:caseNo(/try/:tryNo)` and the core layout (header, case actions, queries, results, tune relevance, modals, wizard, exports/imports, etc.) remains available with acceptable UX parity.
3. **Align with established patterns** where they fit: server-rendered shells, Stimulus for focused interactions, standard forms + redirects for mutations, Pagy where lists are server-driven, `caseTryNavSvc`-style relative URLs (see project conventions).
4. **Reduce long-term cost**: smaller JS payload, fewer unmaintained Angular 1.x dependencies, clearer ownership between Rails and browser code.

## Expectations (calendar and staffing)

- **Full parity** with today’s core UI is **multi-quarter work** for a small team (on the order of **~3k+ lines** of Angular controllers alone, plus services, templates, and Karma—see inventory). This plan is a **map and checklist**, not “a few milestones and we are done.”
- Cutting calendar time requires **cutting scope** (explicit P1/P2 features) or **adding parallel capacity**—say so in writing when planning sprints.

## Non-goals (unless explicitly expanded)

- Redesigning the core UX or information architecture.
- Replacing `splainer-search` search execution with a different engine abstraction (may remain as a **non-Angular** dependency).
- Rebuilding **Rails** surfaces that are already off Angular on `main`: admin, home dashboard, `/cases`, teams, scorers, books listing, **book judging pages** (`/books/.../judge`, etc.), auth/profile.

**Clarification:** The **“Judgements” control in the core case action bar** is still the Angular `<judgements>` modal (`components/judgements/`). That modal (book sync, populate-from-book, links to books) **is in scope** for this plan—only the separate Rails judging UI is out of scope.

Similarly, **mapper wizard** (`MapperWizardsController` + Stimulus) and other non–`core.html.erb` flows are out of scope unless they share Angular bundles today (they do not).

## Current state (summary)

### Already off AngularJS on `main`

Per `angularjs_inventory.md`: homepage, `/cases`, teams, scorers, books (non-core flows), judgements, admin, auth/profile. These use Rails views, Stimulus, and Turbo where appropriate.

### Still on AngularJS

**Single major surface:** the **core case evaluation app** bootstrapped in `app/views/layouts/core.html.erb` (`ng-app="QuepidApp"`), routed by `app/assets/javascripts/routes.js` to `MainCtrl` + `queriesLayout.html` for:

- `/case/:caseNo/try/:tryNo`
- `/case/:caseNo` (default try)

Rough scale (from inventory): ~28 top-level controllers, ~26 services, 7 factories, 11 directives, 23 components, ~62 templates, Karma/Jasmine specs under `spec/javascripts/angular/`. Build: `yarn build:angular-*` producing `angular_app.js`, `quepid_angular_app.js`, `angular_templates.js` included from the core layout.

### Duplication to resolve late in the migration

Some flows exist in **both** Angular (core toolbar) and **Rails** (e.g. share case on `/cases` with Stimulus modals). After the core is migrated, **remove dead Angular components** (`share_case`, etc.) and consolidate on one implementation.

## Target architecture (directional)

The successful migrations on `main` used:

- **Rails** for HTML structure, authorization, and form posts.
- **Stimulus** for modals and client-only state (populate hidden fields, enable buttons, JSON passed via `data-*` values).
- **Full page navigation** where Turbo/complexity fought the feature (share/unshare, redirects + flash).

The core case UI is **more stateful** (live search, scoring, drag-sort, many modals). A realistic end state is a **hybrid**:

1. **Server-rendered core shell** for a case/try visit: layout, header, query list scaffold, tune-relevance panel scaffold, and result panes as ERB (or Turbo Frame sections where incremental updates help).
2. **Stimulus controllers** (and plain ES modules where needed) owning: query row interactions, result rating widgets, pane resizing, modal open/close, sortable hooks (Sortable.js or similar **without** `angular-ui-sortable`).
3. **`fetch` + JSON** continuing to use existing **JSON API routes** where they already back Angular services. **URL paths are not planned to change** for the port—same `api/...` endpoints Rails already exposes (controllers live under `Api::V1` via `scope module: :v1` in `config/routes.rb`; the browser path is still typically `api/cases/...`, not a new namespace). Today Angular’s `$http` uses those paths relative to the layout’s `<base href>`; new code should use the same relative URLs (see [api_client.md](./api_client.md)). Only the **client** mechanism changes (`fetch` vs `$http`). No requirement to delete APIs until the UI no longer needs them.
4. **Third-party JS** retained without Angular wrappers where possible: ACE (`ace-builds`), Vega/Vega-Lite, D3 for sparklines, `splainer-search` services instantiated from plain JS (adapter layer).

Avoid prescribing React/Vue unless the team explicitly chooses a SPA framework; the existing incremental pattern favors **Hotwire + Stimulus + selective vanilla JS**.

## Phased plan — how to read it

**Phases are workstreams, not serial gates.** Phases **3–6** (query list, results/ratings, tune relevance, scores/charts) are **tightly coupled**: shipping “only the list” without run/rate/score is not viable product UX. In practice, deliver **vertical slices**—thin end-to-end paths that merge to `main`—and use phase numbers to **tag** which workstream each task belongs to.

**Example slice (illustrative):** one case, one try, Solr + proxy: open case → list queries → run search → see results → rate a doc → query/case score updates → tune relevance tweak → re-run. That slice touches workstreams 3, 4, 5, and **6** (see below).

**ScorerFactory and score helpers early:** Any slice that includes **rating** needs **client-side scorer evaluation** and display helpers (`ScorerFactory`, `ratingBgStyle` / `scoreDisplay` equivalents). Extract and test that **before or alongside** Phase 4 UI, not only after “Phase 6” on paper.

Each slice should still be **mergeable** (strangler Angular island is OK). Use **feature flags** only when revert cost is unacceptable; **revert PR** is the default rollback story—see [Rollout](#rollout).

---

### Phase 0 — Baseline and parity checklist

**Objective:** Lock “what `main` must keep doing” **without endless consensus**.

**Execution rules**

| Rule | Detail |
|------|--------|
| **DRI** | Name one owner for Phase 0 deliverables (checklist + API table + smoke). |
| **Time box** | e.g. **2–5 engineering days**; exit with “good enough,” not perfection. |
| **P0 parity** | Define explicitly (e.g. open case, add query, run search with **proxy**, rate doc, see score, one snapshot flow, one engine type). P1/P2 = rest of inventory. |

| Task | Output |
|------|--------|
| Treat `angularjs_ui_inventory.md` as the **acceptance checklist**; add any missing flows discovered by QA | Updated inventory or appendix |
| Document critical API contracts used by core (at minimum: `queriesSvc`, `settingsSvc`, `caseSvc`, `ratingsStoreSvc`, `querySnapshotSvc`, `importRatingsSvc`, `caseCSVSvc`, `annotationsSvc`, `bookSvc`, `searchEndpointSvc`, `scorerSvc`, `userSvc` / `bootstrapSvc`) | Table in this doc or wiki: endpoint → UI feature |
| Ensure Karma suite green; note coverage gaps | Baseline for regression |
| **Strongly recommended:** Playwright (or existing `docs/scripts`) smoke for **P0** paths | Automated guardrail for vertical slices |
| Optional: **spike** how core will load JS (single bundle vs `core_*.js` + `application_modern.js`, Turbo defaults) | De-risks Phase 10; see **Phase 10** section below |

**Exit criteria:** P0 list agreed and written down; API contract table started; DRI sign-off that baseline is sufficient to start slices—not unanimous agreement on every inventory row.

#### P0 Parity Checklist

These are the **critical flows** that must keep working throughout the migration. Every vertical slice must pass these before merging to `main`. P1/P2 features (everything else in `angularjs_ui_inventory.md`) can regress temporarily behind a strangler boundary.

| # | Flow | Steps | Inventory refs |
|---|------|-------|----------------|
| **P0-1** | **Open a case** | Navigate to `/case/:id` → case loads, header shows case name + scorer name + try name + case score | SS-01, SS-03 |
| **P0-2** | **View query list** | Queries render with score badges, result counts, expand/collapse chevrons | SS-04 |
| **P0-3** | **Add a query** | Type query text → click "Add query" → query appears in list → search executes → results render | SS-04, SS-05 |
| **P0-4** | **Run search (Solr, via proxy)** | Expand a query → results load from search engine via `/proxy/fetch` → documents display with title, fields, thumbnails | SS-05, SS-28 |
| **P0-5** | **Rate a document** | Click rating dropdown on a result → select score → rating persists → query score badge updates | SS-06, SS-49 |
| **P0-6** | **See case score update** | After rating, case-level score recalculates and displays in header | SS-03 |
| **P0-7** | **Tune relevance (basic)** | Open east pane → edit query params in Query Sandbox tab → click "Rerun My Searches!" → results refresh | SS-07 |
| **P0-8** | **Create a snapshot** | Action bar → "Create snapshot" → name it → snapshot saves with current scores and docs | SS-12 |
| **P0-9** | **Delete a query** | Expand query → click Delete → query removed from list | SS-05 |
| **P0-10** | **Navigate between cases** | Header "Cases" dropdown → select different case → new case loads correctly | SS-02 |

**Stretch P0 (verify if time permits, required before Phase 10):**

| # | Flow | Steps | Inventory refs |
|---|------|-------|----------------|
| P0-S1 | Run search with **Elasticsearch/OpenSearch** | Same as P0-4 but with ES/OS engine | SS-09 (engine config) |
| P0-S2 | Clone a case | Action bar → Clone → options → new case created | SS-17 |
| P0-S3 | Export case (basic CSV) | Action bar → Export → select format → download file | SS-19 |

#### P0 API Contract Summary

These are the **minimum API endpoints** that P0 flows depend on. Full reference: [`workspace_api_usage.md`](./workspace_api_usage.md).

| P0 Flow | Angular Service | Endpoint | Purpose |
|---------|----------------|----------|---------|
| P0-1 | `caseSvc` | `GET api/cases/:id` | Load case (name, scorer_id, tries, last_try_number) |
| P0-1 | `bootstrapSvc` / `userSvc` | `GET api/users/current` | Current user for header + permissions |
| P0-1 | `configurationSvc` | Inline `<script>` in `core.html.erb` | Feature flags (communal_scorers_only, query_list_sortable) |
| P0-1 | `scorerSvc` | `GET api/scorers/:id` | Scorer details (name, scale, code) for case header |
| P0-2 | `queriesSvc` | `GET api/cases/:id/queries?bootstrap=true` | Load all queries with ratings + display_order |
| P0-3 | `queriesSvc` | `POST api/cases/:id/queries` | Create query; returns query + display_order |
| P0-4 | `splainer-search` (browser) | `GET proxy/fetch?url=<engine_url>` | Proxy search request to Solr/ES/OS |
| P0-4 | `settingsSvc` | `GET api/cases/:id/tries` | Try config (query_params, field_spec, search_endpoint) |
| P0-5 | `ratingsStoreSvc` | `PUT api/cases/:id/queries/:qid/ratings` | Save single doc rating |
| P0-6 | `caseSvc` | `PUT api/cases/:id/scores` | Persist recalculated case score |
| P0-6 | `ScorerFactory` | (client-side) | Evaluate scorer JS code against ratings |
| P0-7 | `settingsSvc` | `POST api/cases/:id/tries` | Create new try with edited params |
| P0-8 | `querySnapshotSvc` | `POST api/cases/:id/snapshots` | Save snapshot with docs + scores |
| P0-9 | `queriesSvc` | `DELETE api/cases/:id/queries/:qid` | Delete query |
| P0-10 | `caseSvc` | `GET api/dropdown/cases` | Cases dropdown list |
| P0-10 | `caseTryNavSvc` | (client-side) | URL construction for case/try navigation |

**Key dependency:** `splainer-search` runs in the browser and uses `$http` (Angular). The Stimulus port must either:
- Wrap splainer with native `fetch` (adapter layer), or
- Keep splainer in a thin Angular island until replaced

This is the **single highest-risk technical item** for P0 flows.

---

### Phase 1 — Extract configuration and navigation from Angular

**Objective:** Reduce boot-time coupling; reuse patterns from the rest of the app.

| Task | Notes |
|------|--------|
| Move `configurationSvc` flags (`communal_scorers_only`, `query_list_sortable`) to **data attributes** on `<body>` or a small inline JSON script; read from Stimulus `application` or page-specific controller | Removes need for `configurationSvc` inside Angular; **`bootstrapSvc` / `userSvc`** may still supply current user until Phase 2+ replaces case bootstrapping |
| Replace or mirror **`caseTryNavSvc`** behavior for header links: ensure all new code uses **relative** URLs (`caseTryNavSvc.getQuepidRootUrl()` equivalent) | Project rule |
| **Header** (`HeaderCtrl`): reimplement cases/books dropdowns as ERB + Stimulus (fetch dropdown JSON endpoints already used by Angular if needed) | Includes **`<new-case>`** entry point: it opens the wizard modal (`WizardCtrl` / `WizardModalCtrl`)—can stay Angular-backed until Phase 8 |

**Exit criteria:** Core page still Angular for queries/results, but header/navigation works without `HeaderCtrl` OR header is proven behind a partial that loads before ng-view with no duplicate logic.

---

### Phase 2 — Server-rendered core shell + Stimulus bootstrap

**Objective:** `core.html.erb` no longer depends on `ng-view` for static chrome.

| Task | Notes |
|------|--------|
| Render **queries layout chrome** (case title area, action bar slots, tune relevance toggle regions) from Rails using data from `CoreController` (or dedicated presenter) | Data: case, try, scorer name, flags (archived, public, nightly). **`CoreController`** already sets `@case` / `@try` and handles wizard-related params on `index`. |
| Introduce Stimulus **`core-case` or split controllers** mounting on `data-controller` roots | Replaces `CaseCtrl` / `CurrSettingsCtrl` for display-only first |
| Plan **east pane / Tune Relevance** layout: today **`paneSvc` + `eastPaneWidth`** (jQuery) resizes the main vs. settings pane—must be reimplemented (CSS grid/flex + Stimulus drag handle or equivalent) | Blocks removing `MainCtrl`/`paneSvc` |
| Replace **`broadcastSvc` / `$rootScope.$broadcast`** coupling incrementally: map events in `angularjs_inventory.md` (“Event System”) to explicit callbacks, custom DOM events, or a tiny pub/sub | Critical for splitting `MainCtrl` without subtle regressions |
| Keep **one** Angular island temporarily (e.g. wrap legacy `queries` directive in a single div) if strangling is faster | Strangler pattern |

**TODO (layout):** The case header and add-query form are currently rendered in `core/index.html.erb` above `ng-view`. They should eventually move inside the pane layout (inside `.pane_main`) for correct scroll behavior and visual placement within the white content box. This requires the Angular template `queriesLayout.html` to be replaced with ERB first. Track as part of Phase 3 when the queries layout is fully ported to Rails.

**Exit criteria:** HTML for shell visible with JS disabled partially (static labels); Angular only fills dynamic inner regions OR a flagged smaller root.

---

### Phase 3 — Query list without Angular (`QueriesCtrl`)

**Objective:** Query CRUD, sort, filter, pagination, collapse, “run case” orchestration.

| Task | Notes |
|------|-------|
| Map each `QueriesCtrl` feature to: server partial vs Stimulus vs API call | See inventory “Query List” |
| Replace `ui.sortable` with **SortableJS** (or HTML5 DnD) + API to persist order | Match `queriesSvc` reorder endpoints |
| Implement filter/sort/pagination: either **server-driven** (Turbo Frame + GET params) or **client-driven** fetch + DOM updates | Prefer server-driven for large cases if performance requires |
| Replace **`dir-pagination-controls`** (`angular-utils-pagination` in `queries.html`) | Server Pagy or Stimulus-controlled page links |
| Wire “Add query”, bulk actions, “show only rated”, collapse all | Stimulus actions |
| **Query notes / information needs** (`QueryNotesCtrl`, query notes endpoints in `queriesSvc`) | See `angularjs_ui_inventory.md` (SS-29) |

**Exit criteria:** Parity with query list section of UI inventory; automated test for ordering + add query + filter.

---

### Phase 4 — Search results and rating (`SearchResultsCtrl`, `SearchResultCtrl`, rating services)

**Objective:** Highest-touch UX; keep `splainer-search` execution paths.

| Task | Notes |
|------|-------|
| Build result rows as **partials or client templates** rendered from JSON returned by existing search flow | `queriesSvc` / searcher creation may stay in a thin JS module |
| **Extract `ScorerFactory` + score/rating display helpers** into plain JS **in the same vertical slice as the first rating UI** | Query/case badges depend on this; do not defer entirely to “Phase 6” on paper |
| Replace rating popovers and bulk rate with Stimulus + Bootstrap 5 popovers/modals | `rateElementSvc` / `rateBulkSvc` logic ported |
| Explain / doc detail / hot matches: port modals to **Rails partials + Stimulus** or fetch HTML | `DetailedDocCtrl`, `DocExplainCtrl`, **`HotMatchesCtrl`** |
| **Doc finder / targeted search** (`DocFinderCtrl`, `TargetedSearchCtrl`, `TargetedSearchModalCtrl`) | Same screenshot family as targeted search (SS-24); easy to miss because it sits beside result tooling |
| **Per-document stacked explain bars** | `<stacked-chart>` directive (`stackedChart.js`) — lives on result rows; port with D3 or CSS alongside result templates (not only “case charts” in Phase 6) |
| **`<json-explorer>`** on expanded results and explain views | Same component as structured JSON in doc/explain modals |
| **Media / embed handling** | `[quepid-embed]` in `searchResult.js` (audio/image/video) |
| `docCacheSvc` / `normalDocsSvc`: keep as plain JS module singleton | Adapter from Angular injectable |

**Exit criteria:** Rate/unrate, explain, open document, bulk rate match `main` behavior for Solr/ES/OS as today.

---

### Phase 5 — Tune relevance (try settings)

**Objective:** `QueryParamsCtrl`, `SettingsCtrl`, `CustomHeadersCtrl`, `queryParamsHistory`, ACE fields.

| Task | Notes |
|------|-------|
| ACE editor: mount with **vanilla ACE** from `ace-builds` (already in package.json) | Drop `angular-ui-ace` |
| JSON validation and field spec UI: Stimulus + forms; submit to existing try update APIs | |
| Try history timeline: server-rendered partial or fetch JSON + Stimulus | `queryParamsHistoryCtrl` |
| `QueryParamsDetailsCtrl` modal (rename/delete/clone try): match modals doc pattern | |
| **Annotations tab** (`<annotations>`, `<annotation>`, `annotationsSvc`) | Create/edit/list annotations in east pane (inventory SS-11, SS-61) |
| **Search endpoint typeahead** (`searchEndpointSvc`, `searchEndpoint_popup` template) | Settings tab (SS-77) |
| **Replace Angular-only UI in this panel** | **`ui-ace`** blocks in `devQueryParams.html` → vanilla ACE (Phase 5); **angular-ui-bootstrap** tooltips/typeahead on endpoint picker → BS5 + Stimulus |
| **Replace widgets used elsewhere (track to the right phase)** | **`<json-explorer>`** → result row + doc/explain modals (**Phase 4**); **`ng-csv-import`**, **`<tags-input>`**, **`angular-wizard`** → **Phase 8** (`wizardModal.html`); **countUp** / **ngclipboard** → Web Animations / Clipboard API where still needed |

**Exit criteria:** Create/edit try, headers, curator vars, history, and try details modals work end-to-end.

---

### Phase 6 — Scoring display and charts

**Objective:** Case-level visuals and remaining score/chart polish: `qscore_case`, `qgraph`, case header aggregates, Vega where not already ported, `queryStateClass` / `searchEngineName` in headers and history rows.

| Task | Notes |
|------|-------|
| Port `qgraph` D3 sparkline to **standalone function** invoked from Stimulus `connect()` with data from API or data attributes | |
| `angular-vega` → **vega-embed** in Stimulus | The **`[vega]`** directive is also used in **Frog report** modal (`frog_report/_modal.html`) — coordinate with Phase 8 so Frog keeps working when Angular goes away |
| **Extend `ScorerFactory` parity** (edge scorers, fixtures) if Phase 4 slices only landed minimal extraction | Same module; deepen tests |
| **Filters** (`scoreDisplay`, `ratingBgStyle`, `queryStateClass`, `searchEngineName`, etc.) | Whatever **remains** after Phase 4–5 slices—use JS helpers or server formatting |

**Exit criteria:** Case header scores, sparklines, and remaining chart/score UX match `main` for representative cases; **per-query badges** were already correct once slices shipped rating.

**Relationship to Phase 4:** Phase 6 is **not** when scoring starts—it finishes **header/charts** and straggler filters after vertical slices prove the rate→score loop.

---

### Phase 7 — Snapshots and diffs

**Objective:** `querySnapshotSvc`, `diffResultsSvc`, `PromptSnapshotCtrl`, `QueryDiffResultsCtrl`, `TakeSnapshotCtrl`.

| Task | Notes |
|------|-------|
| Snapshot create modal: Rails modal + POST | |
| Diff view: server-rendered comparison page **or** Stimulus-managed pane with templates | Large template `queryDiffResults.html` |
| `snapshotSearcherSvc`: non-Angular adapter | |

**Exit criteria:** Create snapshot, compare, browse URLs match `main` capabilities.

---

### Phase 8 — Case lifecycle modals and wizard

**Objective:** New case, clone, delete, export, import ratings, move query, unarchive, frog report, judgements modal (targeted search / doc finder lives in **Phase 4**).

| Task | Notes |
|------|-------|
| **WizardModalCtrl** (~800 lines): break into **steps** as separate Stimulus controllers or Turbo visits | Highest risk; consider wizard as multi-page flow |
| Export/import: reuse job patterns if already async; Stimulus for file pick + POST | |
| **Judgements modal** (`components/judgements`): complex book sync UI — port last or parallel-track with dedicated spike | Depends on **`bookSvc`** + case/book APIs |
| Frog report, debug matches, query explain/options: port modals incrementally | Frog uses **`vega`** directive for its chart — switch to `vega-embed` here too |
| **Unarchive case** (`UnarchiveCaseCtrl`) — modal over core flow | Listed in UI inventory; distinct from `/cases` archive/unarchive |
| **Simple delete case** (`<delete-case>`) vs **delete options** (`<delete-case-options>`) | Both paths must remain |

**Exit criteria:** All items in “Modals & Dialogs” / “Case Action Bar” sections of `angularjs_ui_inventory.md` work.

---

### Phase 9 — Ancillary: tour, flash, 404, loading

| Task | Notes |
|------|-------|
| **Shepherd tour** (`tour.js`): reattach to Stimulus `connect` or data attributes | No Angular dependency |
| Flash: use Rails flash + Turbo or duplicate `angular-flash` behavior with Stimulus | |
| **Loading** state: Turbo events or Stimulus loading class | |
| **404** route: Rails `CoreController` catch or static page | |
| **`footer.js`** (layout mutation / pane integration) | Either retire with new layout or re-hook after pane redesign |
| **`ace_config.js`** | Keep for vanilla ACE paths when `angular-ui-ace` is removed |

**Long-running jobs / websockets:** Other Quepid pages use jobs + cable for progress; the **core Angular app** does not appear to depend on ActionCable directly. Re-validate when porting export/import and any “run in background” UX so parity is preserved if the core triggers jobs that notify the UI.

---

### Phase 10 — Decommission Angular

**Bundle / Turbo (decide in Phase 0 or 2):** `application_modern.js` sets **`Turbo.session.drive = false`** for the rest of the app. Core may need a **dedicated `core_*.js` entry** (esbuild) with splainer + case Stimulus, **or** per-layout Turbo defaults, to avoid double-loading or conflicting globals. Document the choice in `DEVELOPER_GUIDE.md` when fixed.

| Task | Notes |
|------|-------|
| Remove `ng-app`, Angular script tags from `core.html.erb`; load the **chosen** bundle (`application_modern.js` and/or **`core_*.js`**) — see bundle/Turbo note below | Splainer + case code may live only in the core bundle |
| Delete `app/assets/javascripts/app.js` module wiring, `routes.js`, controllers, services, components, templates no longer used | Includes **`build_angular_app.js`**, **`build_templates.js`**, and Karma **`spec/karma/`** targets tied to QuepidApp |
| Remove Angular packages from `package.json`; drop `build:angular-*` scripts from default `yarn build` | Update CI/Docker build; **retain** jQuery only if still required by sortable or pane until replaced |
| **CSS:** Core today relies on **Bootstrap 3** styles for `angular-ui-bootstrap` modals alongside **Bootstrap 5** elsewhere (`bootstrap3.css` / `core` stylesheet). Plan either **BS5 modals throughout core** or a scoped compatibility layer—this is a recurring source of visual regressions | Coordinate with design review |
| Remove or rewrite **Karma/Jasmine** | **Pragmatic default:** unit-test **extracted pure modules** (scorer math, URL helpers); add **a small set of system tests** for P0 core flows. A full **Jest/Vitest migration** is optional and can be a separate initiative—do not block Angular removal on reproducing every Jasmine spec |
| Update `docs/app_structure.md`, `DEVELOPER_GUIDE.md`, CLAUDE/AI context | |
| Remove duplicate **share case** (and similar) Angular components once core uses Rails/Stimulus only | |

**Exit criteria:** Grep shows no `angular.module('QuepidApp'` in app code; core layout matches rest of stack.

---

## Feature parity matrix (high level)

Use the detailed rows in `angularjs_ui_inventory.md`; this matrix is the **milestone tracker**. The **Phase** column is a **typical workstream tag**, not the order you ship in—see [Phased plan — how to read it](#phased-plan--how-to-read-it).

| Area | Inventory section | Phase (typical) |
|------|-------------------|-----------------|
| Layout, flash, loading, 404 | Page Layout & Navigation | 0, 9 |
| Header dropdowns & user menu | Header Navigation | 1 |
| Case header, rename, try name, badges | Case Header & Score Display | 2, 4 (scores with rating), 6 (charts/header polish) |
| Action bar (scorer, judgements, snapshot, diff, import, share, clone, delete, export, tune) | Case Action Bar | 5–8 (e.g. scorer modal ↔ 8; snapshot/diff ↔ 7; tune ↔ 5) |
| Query list (add, sort, filter, paginate, frog) | Query List | 3 |
| Results, rating, explain, doc finder | Search Results | 4 |
| Tune relevance / tries / headers / history | Query Parameters Panel | 5 |
| Annotations (east pane) | Query Parameters Panel → Annotations | 5 |
| Modals (wizard, snapshots, docs, etc.) | Modals & Dialogs | 7, 8 |
| Query notes | Query List / Modals | 3 |
| Doc finder / targeted search | Search Results / Modals | 4 |
| Per-doc stacked chart + media embeds | Search Results | 4 |
| Resizable east pane | Page Layout / Tune Relevance | 2, 5 |
| Annotations list items (hamburger actions) | Custom Element Directives | 5 |
| Product tour | tour.js | 9 |

---

## Browser DevTools visibility and `/proxy/fetch`

**You do not lose Network-tab visibility merely by replacing Angular** with Stimulus or other client code. What customers see in DevTools depends on **where the HTTP call to the search engine originates**, not on the framework.

**How it works today**

- Interactive search is driven by **`splainer-search` in the browser**, configured from try settings (`queriesSvc.js` → `createSearcherFromSettings`).
- When **`proxy_requests`** is true on the try/search endpoint, the client sets `searcherOptions.proxyUrl` to **`getQuepidRootUrl() + '/proxy/fetch?url='`** (`caseTryNavSvc.js`), i.e. same-origin `GET/POST proxy/fetch` with the real engine URL in the `url` parameter (`ProxyController#fetch`). DevTools shows those proxy requests, headers, and response bodies (and `proxy_debug=true` can add server-side logging in `HttpClientService`).
- When **proxy is off**, Solr often uses **JSONP** or direct calls to the engine host—DevTools shows those instead.

**When visibility would “go away”**

- If a migration moves **interactive** search execution **entirely server-side** (browser only calls a Quepid JSON API; Rails/`FetchService` talks to Solr/ES), the Network tab will show **one opaque app request**, not the per-engine request customers inspect today. That is independent of Angular vs Stimulus; **`deangularjs-experimental` likely did this** or narrowed what the client invoked.
- **Background** `run_evaluation` already runs on the server (`RunCaseEvaluationJob`); that path was never the same as “open DevTools and watch each query hit the proxy.”

**Plan implication (explicit parity requirement)**

- For **feature parity with `main`**, keep **browser-originated** search (splainer or equivalent) and preserve **`proxyUrl` / `proxy_requests`** behavior unless the product **intentionally** changes observability.
- If server-side search is ever chosen for security or CORS reasons, add a **documented substitute** for operators (e.g. structured logs, a “copy curl” debug panel, or response echo of forwarded URL/body).

---

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| **splainer-search** tightly coupled to Angular DI | Introduce a small **bootstrap** that constructs `searchSvc`, `fieldSpecSvc`, etc., and pass into Stimulus-owned code; keep package until replaced |
| **ScorerFactory** runs user JS | Sandboxing unchanged; port as isolated module with same tests |
| **WizardModalCtrl** size | Time-box spikes; consider server-multi-step wizard |
| **Performance** on large cases | Prefer server pagination + lazy result loading; benchmark with `thor sample_data:large_data` |
| **HTTP/HTTPS** core page | Preserve existing `ssl_options` / Solr JSONP assumptions |
| **Regression volume** | Phase-by-phase merge; checklist from UI inventory; optional Playwright smoke |
| **Bootstrap 3 vs 5 in core** | Modals, dropdowns, and grid classes differ; schedule explicit UI comparison (inventory screenshots) |
| **Internal event bus** | `broadcastSvc` events span services; document each consumer before removing Angular |
| **DevTools / proxy observability** | Do not move interactive search server-only without a parity story; see [Browser DevTools visibility and `/proxy/fetch`](#browser-devtools-visibility-and-proxyfetch) |
| **Proxy abuse / header forwarding** | `ProxyController` forwards client headers; changing how the browser invokes the proxy must **preserve or deliberately harden** behavior—review with security in mind |
| **Staffing mismatch** | If only one or two ICs own core, vertical slices still need review bandwidth; adjust P0 or timeline |

## Testing strategy

1. **API / model tests** (existing Minitest): keep passing; add tests when new controller endpoints are introduced.
2. **Karma:** Keep green **while Angular remains**. Prefer **targeted** new tests on extracted pure JS; do not assume a full Karma suite will survive unchanged.
3. **After Angular removal:** **Unit tests** on extracted modules (scorer eval, splainer bootstrap) + **a small set of system tests** for **P0** flows (aligned with Phase 0). **Full Jest/Vitest port** of all legacy specs is optional—schedule separately if valuable.
4. **Manual QA:** Run **P0** after every vertical slice; full inventory pass before major releases or Phase 10.

## Rollout

1. **Default:** All changes ship to `main` as they pass tests (no long-lived mega-branch).
2. **Rollback:** Primary story is **revert the offending PR** (fast, boring, reliable). Invest in a **feature flag** or **dual layout** only if revert cost or blast radius justifies the ongoing complexity.
3. **Feature flags:** Use only when rollback via revert is insufficient; prefer **strangler** (small Angular root) over flags when possible.
4. **Bundle / Turbo:** Decide early how core loads JS (see Phase 10); avoid shipping with two conflicting Turbo or Stimulus boot paths.
5. **Communication:** Changelog entries per slice or phase; update user-facing docs if URLs or flows change.

## Maintenance

- **Owner:** assign a DRI per phase in project planning.
- **Review:** architecture review before the **first vertical slice that replaces query+search+rate**, and again before Wizard/Judgements (Phase 8 workstream).
- **This document:** Update phase status and dates in a short table below when work proceeds.

### Status log

| Date | Note |
|------|------|
| 2026-03-19 | Initial plan authored; aligns with `angularjs_inventory.md` and post–PR-1642 patterns. |
| 2026-03-19 | Second pass: clarified judgements scope, API path wording, `broadcastSvc`/`paneSvc`, query notes, doc finder, stacked chart/embeds, Frog+Vega, BS3/BS5 risk, extra services for Phase 0, `application_modern` / build cleanup, related doc link. |
| 2026-03-19 | Added DevTools/`proxy/fetch` parity note: client-side search + `proxy_requests` preserves Network visibility; server-only search would not (likely experimental branch regression). |
| 2026-03-19 | Integrated pragmatic review: vertical slices, Phase 0 DRI/time box/P0 + optional bundle spike, ScorerFactory with Phase 4, Phase 6 reframed vs Phase 4, Phase 10 Turbo/bundle note, testing/rollback/risks, matrix note for case scores, appendix folded in. |
| 2026-03-20 | Added P0 Parity Checklist (10 critical flows + 3 stretch) and P0 API Contract Summary (16 endpoint mappings). Phase 0 documentation deliverables substantially complete. |

---

## Appendix: Review summary (historical)

The **pragmatic engineer review** is now **integrated** into [Expectations](#expectations-calendar-and-staffing), [Phased plan — how to read it](#phased-plan--how-to-read-it), Phase 0 rules, Phases 4/6/10, [Testing strategy](#testing-strategy), [Rollout](#rollout), and [Risks](#risks-and-mitigations). This appendix remains as a pointer for anyone who read the older standalone “Appendix: Pragmatic engineer review” section.

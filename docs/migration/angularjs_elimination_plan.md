# Plan: Eliminate Remaining AngularJS (Core Case UI)

This document is the **migration plan** for removing AngularJS from Quepid while **preserving the feature set available on `main`**. It builds on the existing inventories and the patterns established when teams, scorers, and the cases listing moved to Rails + Stimulus ([PR #1642](https://github.com/o19s/quepid/pull/1642)).

**Authority:** Single source for **migration scope**, **P0 parity**, **client-side interactive search** (`splainer-search`, `/proxy/fetch`), and **client-side scoring** (`ScorerFactory`). Product-only deltas: [intentional_design_changes.md](./intentional_design_changes.md) (section 2) with sign-off.

### Strangler fig pattern

Follow the **[strangler fig pattern](https://martinfowler.com/bliki/StranglerFigApplication.html)**: coexistence of Angular and Rails/Stimulus during the port, phased cutovers per workspace area, ship incremental value without finishing the whole tree—same idea as **vertical slices** and optional **Angular islands** in the phase sections below. Primary strangler URL today: **`GET /case/:id(/try/:try_number)/new_ui`** (`core_new_ui`, no Angular bundle); default **`/case/...`** stays on `core.html.erb` + `QuepidApp` until cutover.

## Goals

1. **Remove AngularJS** from the production bundle for core evaluation (`ng-app`, `QuepidApp`, vendor JS).
2. **Preserve behavior** on `main` for `/case/:caseNo(/try/:tryNo)` and core chrome (actions, queries, results, tune relevance, modals, wizard, import/export, etc.).
3. **Match established patterns:** server shells, Stimulus for focused UI, forms + redirects, Pagy where lists are server-driven, relative URLs (see project rules).
4. **Reduce cost:** smaller JS payload, fewer Angular 1.x deps, clearer Rails vs browser ownership.

## Expectations (calendar and staffing)

- **Full parity** is **multi-quarter** work (~28 Angular controllers, ~20+ services, ~62 templates, Karma—see inventory). This file is a **map**, not a short milestone list. Cutting calendar time means explicit **scope cuts** (P1/P2) or more capacity.

## Non-goals (unless explicitly expanded)

- Core UX redesign.
- Replacing the **engine abstraction** behind interactive search (may stay **non-Angular**, e.g. `splainer-search` or equivalent).
- Rebuilding Rails areas already off Angular: admin, home, `/cases`, teams, scorers, books (non-core), **book judging** (`/books/.../judge`), auth/profile.

**In scope / out of scope:** Core case **Judgements** toolbar control = Angular `<judgements>` modal (book sync, etc.); separate Rails judging UI stays out of scope. **Mapper wizard** and other non–`core.html.erb` flows are out of scope (no shared Angular bundle).

## Current state (summary)

### Already off AngularJS on `main`

Homepage, `/cases`, teams, scorers, books (non-core), judgements listing, admin, auth/profile — Rails + Stimulus + Turbo per `angularjs_inventory.md`.

- **Core app header:** ~~`_header_core_app.html.erb` is ERB + BS5, not wired to `HeaderCtrl`~~ — `HeaderCtrl` still ships unused; drop from bundle when trimming Angular.
- **Default core layout** (`core.html.erb`): `data-quepid-root-url`, `data-case-id`, `data-communal-scorers-only`, `data-query-list-sortable` on `<body>`; inline script still seeds `configurationSvc` (**duplicate** — remove in Phase 1/10).
- **Hotwire:** ~~`javascript_importmap_tags 'application_modern'` loads next to Angular/jQuery on `/case/...`~~ (`Turbo.session.drive = false` globally in `application_modern.js`).

### Still on AngularJS (default `/case/...`)

`ng-app="QuepidApp"` in `core.html.erb`, `routes.js` → `MainCtrl` + `queriesLayout.html` for `/case/:caseNo/try/:tryNo` and `/case/:caseNo`. Action bar, query list, results, tune pane, modals = Angular inside `ng-view`. Build: `yarn build` → `angular_app.js`, `quepid_angular_app.js`, `angular_templates.js` + jQuery/CSS. **Vitest:** `yarn test:vitest` (and `yarn test` runs Karma + Vitest) for `app/javascript/` / `test/javascript/`.

### `new_ui` strangler slice (canonical summary)

- **URL:** `GET /case/:id(/try/:try_number)/new_ui` → `CoreController#new_ui` (`case_core_new_ui`).
- **Layout:** `core_new_ui.html.erb` — same header/footer as core; **only** `application_modern` (no jQuery/Angular). Body includes try/scorer `data-*` for Stimulus.
- **Done:** Case header — ~~rename (`inline-edit`)~~, ~~case score (`case-score`)~~. Query shell — ~~`query-list`, `add-query`, `query-row`~~ — filter, sort, collapse, show-only-rated, Run all, add/delete, expand → **`search_executor`** (Solr/ES/OS, `/proxy/fetch` when configured), **`ratings_store`**, **`scorer_executor`** / query badges. Modules: `search_executor.js`, `query_template.js`, `ratings_store.js`, `scorer_executor.js`, `scorer.js`, `api_url.js`.
- **Not yet:** Action bar = **placeholders**. Query list: pagination, DnD reorder, query notes, bulk actions. Full result-row / explain / media parity vs Angular.

Later: remove **duplicate** implementations (e.g. Angular `share_case` vs Rails/Stimulus on `/cases`) once core is migrated.

## Target architecture (directional)

Non-core migrations used **Rails** (structure, auth, forms), **Stimulus** (modals, `data-*` state), and **full-page navigation** where Turbo hurt. Core is **more stateful**; target a **hybrid**:

1. **Server-rendered shell** — ERB (and optional Turbo Frames) for layout, header, query scaffold, tune scaffold, result regions.
2. **Stimulus + plain ES modules** — query rows, ratings, pane resize, modals, **Sortable.js** (not `angular-ui-sortable`).
3. **`fetch` + existing JSON APIs** — same `api/cases/...` paths (`Api::V1`); only client transport changes (`fetch` vs `$http`); see [api_client.md](./api_client.md).
4. **Third-party JS** without Angular shims where possible — ACE, Vega/Vega-Lite, D3; splainer or **`search_executor`**-style modules for search.

Prefer **Hotwire + Stimulus + vanilla JS** over a new SPA framework unless the team chooses one explicitly.

## Phased plan — how to read it

**~~Strikethrough~~** = **done** for the named scope (usually **`…/new_ui`**, or shared layout/docs as noted). Default **`/case/...`** often still tracks the same phase until cutover.

**Phases are workstreams, not serial gates.** Phases **3–6** overlap: deliver **vertical slices** to `main`; tag tasks by phase. **Rating slices** need **client-side scorer** helpers early (not only “Phase 6” on paper). **Mergeable** PRs; **revert** is the default rollback—see [Rollout](#rollout). **Example slice:** open case → list → run search → rate → query/case scores → tune → re-run (touches 3–6).

---

### Phase 0 — Baseline and parity checklist

**Objective:** Lock “what `main` must keep doing” without endless debate.

- **DRI / time box / P0 definition** — owner, ~2–5 days, explicit P0 (open case, add query, proxy search, rate, score, snapshot, engine type); P1/P2 = rest of `angularjs_ui_inventory.md`.
- ~~**Doc deliverables**~~ — checklist + **P0 API summary** (below) + flows in this doc are **done**; keep **Karma** green; optional **Playwright** smoke; optional **bundle** spike (Phase 10).

**Exit criteria:** P0 list + API summary agreed; DRI sign-off to start slices.

#### P0 flows (must hold for merges to `main`)

P1/P2 may regress behind a strangler boundary. **~~Struck~~** = verified on **`…/new_ui`** only (inventory refs in `angularjs_ui_inventory.md`).

- ~~**P0-1–6, 9–10**~~ — open case, query list, add query, Solr+proxy search, rate doc, case score header, delete query, cases dropdown (use `…/new_ui` where marked).
- **P0-7 — Tune relevance (basic)** (SS-07) — east pane sandbox → Rerun searches.
- **P0-8 — Snapshot** (SS-12) — create from action bar.
- **Stretch before Phase 10:** ~~**P0-S1** ES/OS~~ (on `new_ui`); **P0-S2** clone (SS-17); **P0-S3** export CSV (SS-19).

#### P0 API surface (compact)

Full tables and paths: **[workspace_api_usage.md](./workspace_api_usage.md)**. **Covers P0:** `GET api/cases/:id`, `GET api/users/current`, `GET api/scorers/:id`, `GET/POST api/cases/:id/tries`, `GET/POST/DELETE api/cases/:id/queries` (+ bootstrap query list), `PUT …/ratings`, `PUT …/scores`, `POST …/snapshots`, `GET api/dropdown/cases`, browser **`proxy/fetch`** (or direct) for search, `core.html.erb` flags (`data-*` + inline script duplicate), client **`ScorerFactory`** / scorer eval, **`caseTryNavSvc`**-style URL building (`api_url` + `data-quepid-root-url` on `new_ui`).

**Search:** Default core = **splainer-search** + Angular `$http`. **`new_ui`** = **`search_executor`** + `query_template` + `api_url` (native `fetch`, preserves `proxy_requests`). **Observability / parity:** [Browser DevTools visibility and `/proxy/fetch`](#browser-devtools-visibility-and-proxyfetch). **Remaining risk:** cut default core over without regressions (reuse modules).

---

### Phase 1 — Configuration and navigation

- **`configurationSvc`:** ~~body `data-*` present~~ — **TODO:** stop duplicate inline Angular seed in `core.html.erb` (or read DOM in Angular once).
- **Relative URLs:** enforce on all new code; ~~`new_ui` + `api_url`~~ already comply.
- ~~**Header** ERB + BS5~~ — **TODO:** remove dead **`headerCtrl.js`** from bundle; create-case → Rails link; post-create wizard still Angular on default core until Phase 8.

**Exit:** Header templates ERB-only; config single-sourced when inline script removed.

---

### Phase 2 — Core shell + Stimulus bootstrap

**Objective:** Static chrome not only from `ng-view` on `core.html.erb`.

- ~~**Rails chrome + `@queries` for `new_ui`**~~ via `CoreController` (**done** for `new_ui`).
- **`new_ui` shell Stimulus** (`inline-edit`, query-row, etc.) — ~~in place~~; **default core** still needs full `CaseCtrl` / `CurrSettingsCtrl` parity (not only `new_ui`).
- **East pane / tune:** replace `paneSvc` + jQuery width — consider `resizable_pane_controller.js`.
- **`broadcastSvc`:** map to DOM events / small pub-sub before splitting `MainCtrl`.
- **Same URL vs `new_ui`:** merging new chrome above `ng-view` may need prefixed IDs; today `new_ui` uses a **separate layout** (fewer collisions).

**Exit:** `new_ui` proves shell; default core still Angular below header until later phases.

---

### Phase 3 — Query list (`QueriesCtrl`)

**Objective:** CRUD, sort, filter, pagination, collapse, run-case orchestration.

- ~~**Vertical slice on `new_ui`**~~ — see **Current state → `new_ui`**. **Open:** pagination, SortableJS + API reorder, query notes (SS-29), bulk actions.
- **Pagination** — replace `dir-pagination-controls` with Pagy or Stimulus links; **filter/sort** already client-side on `new_ui`.
- **Bulk actions** — not on `new_ui` yet.

**Exit:** UI inventory “Query List” parity + tests for order/add/filter.

---

### Phase 4 — Results and rating

**Objective:** Default core keeps splainer until cutover; **`new_ui`** uses **`search_executor`** (already).

- ~~**JSON result rows + scorer helpers**~~ on `new_ui` (`query_row_controller`, `scorer_executor`, `scorer.js`) — not full Angular row parity.
- **Open:** BS5 popovers/modals for **bulk rate** / popover UX (`rateElementSvc` / `rateBulkSvc`); explain / doc / hot matches / doc finder / stacked chart / `json-explorer` / **quepid-embed** / `docCacheSvc` patterns.

**Exit:** Rate/unrate on `new_ui`; rest matches `main` for Solr/ES/OS when default core moves.

---

### Phase 5 — Tune relevance (try settings)

`QueryParamsCtrl`, `SettingsCtrl`, `CustomHeadersCtrl`, history, ACE: vanilla **ACE**, Stimulus forms, try history, try-details modals, **annotations**, **search endpoint** typeahead, replace **ui-ace** / **angular-ui-bootstrap** in sandbox; widget routing (**json-explorer** → Phase 4; wizard/tags/csv → Phase 8; countUp/ngclipboard → web APIs).

**Exit:** Try create/edit, headers, curator vars, history, details modals end-to-end.

---

### Phase 6 — Scoring display and charts

`qgraph` sparkline as standalone + Stimulus; **`angular-vega`** → **vega-embed** (coordinate **Frog** with Phase 8); deepen **scorer** parity vs minimal Phase 4 extract; remaining **filters** (`scoreDisplay`, `queryStateClass`, etc.).

**Exit:** Header/sparkline/chart UX matches `main`; query badges already covered by rating slices. *(Phase 6 finishes charts/filters, not “when scoring starts.”)*

---

### Phase 7 — Snapshots and diffs

Rails snapshot modal + POST; diff page or Stimulus pane (`queryDiffResults.html`); **`snapshotSearcherSvc`** adapter.

---

### Phase 8 — Lifecycle modals and wizard

**WizardModalCtrl** → steps (Stimulus or Turbo); export/import; **Judgements** modal + **`bookSvc`**; Frog / debug / explain modals (**vega** → **vega-embed**); **Unarchive**; **delete-case** vs **delete-case-options**.

**Exit:** `angularjs_ui_inventory.md` “Modals” + “Case Action Bar”.

---

### Phase 9 — Ancillary

Shepherd **tour**, **flash**, **loading**, **404**, **`footer.js`**, **`ace_config.js`**. Re-check ActionCable when export/import gets job UX on core.

---

### Phase 10 — Decommission Angular

~~**`application_modern` already on `core.html.erb`**~~ — **remove** Angular/jQuery tags; choose **`core_*.js`** vs importmap-only for case code + splainer successor; document in `DEVELOPER_GUIDE.md`.

- Drop `ng-app`, old bundles, **`build_angular_*`**, Karma targets; **`package.json`** Angular deps; **BS3 vs BS5** modal strategy; **Karma** → pragmatic Vitest/system tests (full Jasmine port optional).
- Update **`docs/app_structure.md`**, **DEVELOPER_GUIDE**, AI context; remove duplicate **share_case** etc.

**Exit:** No `angular.module('QuepidApp'` in app code; core stack matches the rest of the app.

---

## Feature parity ↔ phases

Use **`angularjs_ui_inventory.md`** as the row-level tracker. **Rough mapping:** layout/flash/tour → 0, 9; header → 1; shell/pane → 2, 5; query list → 3; results/ratings/explain/finder/embeds → 4; tune/annotations/endpoint → 5; charts/sparklines/Vega → 6; snapshots/diff → 7; action bar lifecycle/judgements/wizard → 5–8. ~~**Strikethrough** in phase tasks~~ marks **`new_ui`** or shared-layout progress as in the legend above.

---

## Browser DevTools visibility and `/proxy/fetch`

Visibility depends on **where the engine request is initiated**, not the framework.

- **Today (default core):** **splainer-search** from try settings; with **`proxy_requests`**, `proxyUrl` = `getQuepidRootUrl() + '/proxy/fetch?url='` — DevTools shows proxy traffic. Proxy off → JSONP/direct to engine.
- **`new_ui`:** same **proxy / direct** idea via **`search_executor`**.
- **Would “disappear”:** if **interactive** search moves **server-only** (browser hits one Quepid API) unless you add an explicit **observability** story (logs, debug panel, etc.). **`deangularjs-experimental`** tended that way. **`run_evaluation`** is already server-side and is a different concern.

**Parity:** Keep **browser-originated** search and **`proxy_requests`** unless product deliberately changes it—see also **Risks**.

---

## Risks and mitigations

- **splainer / default core** — reuse **`search_executor`** + **`query_template`** for cutover; see **Current state** and [DevTools / proxy](#browser-devtools-visibility-and-proxyfetch).
- **ScorerFactory (user JS)** — same sandboxing; isolated module + tests.
- **WizardModalCtrl** — spike; multi-page wizard option.
- **Large cases** — server pagination, lazy loads; `thor sample_data:large_data`.
- **HTTP/Solr JSONP** — keep `ssl_options` assumptions.
- **Regressions** — slice merges + inventory checklist + optional Playwright.
- **BS3 vs BS5** — explicit visual pass vs screenshots.
- **`broadcastSvc`** — document consumers before removing Angular.
- **DevTools / proxy** — do not go server-only search without parity story.
- **Proxy abuse** — `ProxyController` headers; security review on changes.
- **Staffing** — narrow P0 or add review bandwidth.

## Testing strategy

1. **Minitest** — keep green; extend for new endpoints.
2. **Karma** — green while Angular remains; prefer **targeted** tests on extracted pure JS.
3. **Vitest** — **`yarn test:vitest`** / tests under **`test/javascript/`** (e.g. `search_executor`, `query_row`); does not replace Karma until migrated.
4. **Post-Angular** — unit tests on extracted modules + **small** system suite for P0; full Jasmine→Vitest port optional.
5. **Manual QA** — P0 per slice; full inventory before big releases / Phase 10.

## Rollout

Ship to **`main`** by PR; **revert** primary rollback; **flags** only if revert is too costly; decide **bundle/Turbo** early (Phase 10); changelog + user docs when behavior/URLs change.

## Maintenance

- **DRI** per phase; **architecture review** before first **query+search+rate** replacement and before **Wizard/Judgements** (Phase 8).
- **Status log** — update when phases move.

### Status log

- **2026-03-19** — Initial plan; judgements scope; API wording; `broadcastSvc` / `paneSvc`; query notes; doc finder; stacked charts / embeds / Frog+Vega; BS3/BS5; Phase 0 services; `application_modern`; related docs; DevTools/proxy parity; pragmatic review integrated (slices, Phase 0, ScorerFactory timing, Phase 6 vs 4, Phase 10, testing/rollback/risks, appendix).
- **2026-03-20** — P0 flow checklist + API summary in doc (Phase 0 docs substantially complete).
- **2026-03-21** — Synced `new_ui` (search_executor, ratings, case-score, Run all, layout `data-*`); strikethrough legend; tables→lists; **deduped** this file (single `new_ui` summary, compact P0/API, merged status noise, dropped duplicate feature matrix, shortened phases).

---

## Appendix: Review summary (historical)

The **pragmatic engineer review** is folded into [Expectations](#expectations-calendar-and-staffing), **Phased plan**, Phase 0 / 4 / 6 / 10, **Testing**, **Rollout**, **Risks**, and **DevTools/proxy** above.

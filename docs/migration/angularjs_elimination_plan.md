# AngularJS elimination plan (core case UI)

**What this is:** A roadmap for removing AngularJS from the **case evaluation workspace** (`/case/...`) while keeping **feature parity** with what ships on `main` today.

**What it is not:** A sprint backlog, a design spec, or a commitment to dates. It points to other docs for inventories and APIs.

---

## Start here

Read these points first; everything below expands on them.

1. **Two stacks coexist.**
    - Production case pages still use **Angular** (`QuepidApp`, `core.html.erb`).
    - A parallel URL **`…/new_ui`** exercises **Rails + Stimulus + importmap** with **no** Angular bundle—this is the main **strangler** path ([Martin Fowler](https://martinfowler.com/bliki/StranglerFigApplication.html)).

2. **`new_ui` feature parity is essentially complete** (Phases 0, 2–9 done). The remaining work is **configuration cleanup** (Phase 1) and **decommissioning Angular** (Phase 10).

3. The detailed flow list and screenshot IDs live in **`angularjs_ui_inventory.md`**. Endpoint names and paths: **`workspace_api_usage.md`**.

4. **This doc is authoritative** for migration **scope** and **decommissioning**. Product-only ideas: **`intentional_design_changes.md`** section 2, with sign-off.

---

## Contents

- [Goals & boundaries](#goals)
- [Expectations (time and staffing)](#expectations-calendar-and-staffing)
- [Where the code lives today](#where-the-code-lives-today)
- [Target architecture](#target-architecture-directional)
- [Remaining work](#remaining-work)
- [Browser DevTools and `/proxy/fetch`](#browser-devtools-visibility-and-proxyfetch)
- [Risks](#risks-and-mitigations)
- [Testing, rollout, maintenance](#testing-strategy)
- [Related documentation](#related-documentation)
- [Status log](#status-log)

---

## Goals

1. **Remove AngularJS** from the production bundle for core evaluation (`ng-app`, `QuepidApp`, vendor JS).
2. **Preserve behavior** on `main` for `/case/:caseNo(/try/:tryNo)` and core chrome (actions, queries, results, tune relevance, modals, wizard, import/export, etc.).
3. **Follow existing patterns:** server-rendered shells, Stimulus for focused UI, forms + redirects, Pagy where lists are server-driven, relative URLs (project rules).
4. **Reduce long-term cost:** smaller JS payload, fewer Angular 1.x dependencies, clearer ownership (Rails vs browser).

## Expectations (calendar and staffing)

Full parity with today's core UI is **multi-quarter** work (order of **~28** Angular controllers, **~20+** services, **~62** templates—see **`angularjs_inventory.md`**).

If you need it sooner, you must **shrink scope** (call out P1/P2) or **add people**. This document is a **map**, not a promise of a short project.

## Non-goals

Unless explicitly expanded later:

- Redesigning the core UX or information architecture.
- Replacing the **concept** of browser-driven interactive search (implementation may stay **non-Angular**—e.g. `splainer-search` or the newer **`search_executor`** modules).
- Re-implementing Rails pages that are **already** off Angular: admin, home, `/cases`, teams, scorers, books (non-core), **book judging** (`/books/.../judge`), auth/profile.

---

## Where the code lives today

### Default case workspace (Angular)

- **URLs:** `/case/:caseNo/try/:tryNo`, `/case/:caseNo`
- **Layout:** `app/views/layouts/core.html.erb` with `ng-app="QuepidApp"`
- **Routing:** `routes.js` → `MainCtrl` + `queriesLayout.html` — action bar, queries, results, tune pane, modals live in `ng-view`
- **Build output:** `yarn build` → `angular_app.js`, `quepid_angular_app.js`, `angular_templates.js` (plus jQuery, CSS, etc.)

### new_ui route (Stimulus only)

- **URL:** `GET /case/:id(/try/:try_number)/new_ui` → `CoreController#new_ui` (route name `case_core_new_ui`)
- **Layout:** `core_new_ui.html.erb` — same header/footer pattern as core, but **only** `application_modern` (importmap + Stimulus; no jQuery/Angular)
- **Body attributes:** `data-*` for case, try, scorer, and feature flags (see the layout file)

**`new_ui` feature parity is complete** for Phases 0–9. All P0 flows, query list, results/rating, tune relevance, scoring/charts, snapshots/diffs, lifecycle modals/wizard, and ancillary features (tour, flash, loading, 404) are working.

### Shared with both layouts

- **`new_ui` header** is **`layouts/_header`** (Bootstrap 5, same as `/cases` and the rest of the app). **Angular `core`** still uses **`_header_core_app.html.erb`** (legacy markup + BS3 stack in **`core.css`**). **`headerCtrl.js`** still ships in the Angular bundle—remove when you trim the bundle.
- **`application_modern`** is already loaded on **`core.html.erb`** next to Angular/jQuery, so Stimulus/Turbo are available on the default case page too (`Turbo.session.drive = false` globally).
- **`core.html.erb`** exposes `data-quepid-root-url`, `data-case-id`, feature flags on `<body>`, but an **inline script still duplicates** those values into Angular's `configurationSvc`—**Phase 1 / 10** should leave a single source of truth.

### After migration

Consolidate **duplicate** flows (e.g. Angular **share case** vs Rails/Stimulus on `/cases`) once the core toolbar is fully migrated.

---

## Target architecture (directional)

Earlier Quepid migrations (teams, cases list, etc.) used:

- **Rails** for structure, authorization, and traditional forms.
- **Stimulus** for modals and small bits of client state.
- **Full page loads** where Turbo or complexity made that simpler.

The **core case UI** is heavier (live search, scoring, many modals). The end state is a **hybrid**:

1. **Server-rendered shell** — ERB (and optionally Turbo Frames) for layout, header, scaffolds for queries, tune panel, and result regions.
2. **Stimulus + plain ES modules** — query rows, ratings, pane resizing, modals, **Sortable.js** instead of `angular-ui-sortable`.
3. **Same JSON APIs** — still `api/cases/...` (`Api::V1`); only the **client** changes from `$http` to **`fetch`**. See **`api_client.md`** for CSRF and relative URLs.
4. **Libraries without Angular wrappers** where possible — CodeMirror 6 (replaces ACE for JSON editing), Vega/Vega-Lite, D3; search via splainer-style code or **`search_executor`**.

Default stack assumption: **Hotwire + Stimulus + targeted vanilla JS**, not a new SPA framework, unless the team decides otherwise.

---

## Remaining work

### Configuration and navigation

**Purpose:** One source of truth for flags and URLs; shrink dead JS.

- Stop **duplicating** feature flags into Angular's **`configurationSvc`** once **`data-*`** on `<body>` is enough (or read DOM inside Angular temporarily).
- Enforce **relative** URLs on all new code (**`new_ui`** already uses **`api_url`**).
- Remove unused **`headerCtrl.js`** from the bundle when safe. **Create case** is already a Rails link; wizard after create stays Angular on default core until **Phase 10**.

**Done when:** Header is ERB-only in templates and config is not double-seeded.

### Phase 2 — Remaining items

- **East pane:** replace **`paneSvc`** + jQuery sizing; consider **`resizable_pane_controller.js`**.
- **`broadcastSvc`:** map to DOM events or a tiny pub-sub before splitting **`MainCtrl`**.

### Phase 10 — Decommission Angular

**Purpose:** Remove Angular and jQuery from the core layout; pick final JS entrypoints.

**Stimulus already loads on `core.html.erb`** — next step is **dropping** Angular/jQuery script tags, choosing **`core_*.js`** vs importmap-only for case code, and documenting the decision in **`DEVELOPER_GUIDE.md`**.

Also: delete unused Angular wiring, **`build_angular_*`**, trim **`package.json`**, plan **BS3 vs BS5** modals, replace Karma with a **pragmatic** mix of Vitest + system tests (full Jasmine port optional). Update **`docs/app_structure.md`**, **DEVELOPER_GUIDE**, AI context; remove duplicate **share_case**-style components.

**Done when:** `angular.module('QuepidApp'` does not appear in app code and the core layout matches the rest of the stack.

---

## Browser DevTools visibility and `/proxy/fetch`

Operators often watch **Network** to see Solr/ES traffic. What they see depends on **where the request is sent from**, not whether the UI uses Angular or Stimulus.

**Today (default core)**

- Interactive search uses **splainer-search** with try settings.
- If **`proxy_requests`** is on, the browser calls same-origin **`/proxy/fetch?url=…`**; DevTools shows those calls. If proxy is off, you often see JSONP or direct engine calls.

**`new_ui`**

- **`search_executor`** keeps the same **proxy vs direct** idea with **`fetch`**.

**Parity rule**

Keep **browser-originated** interactive search and **`proxy_requests`** behavior unless product **intentionally** changes observability. See also [Risks](#risks-and-mitigations).

---

## Risks and mitigations

- **Splainer / Angular on default core** — Reuse **`search_executor`** and **`query_template`** for cutover; see [Where the code lives](#where-the-code-lives-today) and [DevTools](#browser-devtools-visibility-and-proxyfetch).
- **ScorerFactory runs user code** — Keep sandboxing; isolate module; test thoroughly.
- **Large cases** — Prefer server pagination and lazy loading; use `thor sample_data:large_data` to stress-test.
- **HTTP / Solr JSONP** — Preserve **`ssl_options`** assumptions.
- **Regression volume** — Prefer small merges; use the UI inventory as a checklist; optional Playwright.
- **Bootstrap 3 vs 5 in core** — New UI loads **`core_new_ui.css`** (BS5 only); Angular keeps **`core.css`** (BS3). The new-ui bundle skips Angular-only sheets. Shared layers (`style.css`, `panes.css`, etc.) may still need BS5 tuning — schedule a visual pass against screenshots.
- **`broadcastSvc`** — Document every consumer before removing Angular.
- **DevTools / proxy story** — Do not move search server-only without a documented substitute for operators.
- **Proxy abuse** — **`ProxyController`** forwards headers; review security when behavior changes.
- **Staffing** — Narrow P0 or add review bandwidth.

---

## Testing strategy

1. **Minitest** — keep green; add tests when Rails APIs change.
2. **Karma** — green while Angular ships; prefer **targeted** tests on extracted pure JS.
3. **Vitest** — **`yarn test:vitest`**; tests under **`test/javascript/`** (e.g. `search_executor`, `query_row`). Does not replace Karma until you migrate specs.
4. **After Angular** — unit tests on extracted modules + a **small** system suite for P0; full Jasmine→Vitest port optional.
5. **Manual** — run P0 after each slice; full inventory pass before major releases or Phase 10.

## Rollout

Ship to **`main`** via normal PRs. **Revert** is the default rollback. Use **feature flags** only when revert is too expensive. Decide **bundle / Turbo** shape early (Phase 10). Update changelog and user-facing docs when behavior or URLs change.

## Maintenance

- Assign a **DRI** per phase where helpful.
- Hold **architecture review** before Phase 10 (decommissioning Angular).
- Append to the **status log** when meaningful progress lands.

---

## Completed phases (summary)

The following phases are **done on `new_ui`**:

- **Phase 0** — P0 baseline flows verified.
- **Phase 2** — Core shell, CaseCtrl/CurrSettingsCtrl parity, header on `new_ui`.
- **Phase 3** — Query list: CRUD, sort, filter, pagination, collapse, bulk actions, Run All.
- **Phase 4** — Results and rating: smart field rendering, media embeds, translate links, frog icon, querqy indicator, result pagination, browse link, rank display, explain, doc finder, bulk rate.
- **Phase 5** — Tune relevance: 5-tab pane (curator variables, annotations, try management, endpoint picker, CodeMirror editor, query param validation, nightly toggle).
- **Phase 6** — Scoring display: sparkline chart, score badges, Frog Pond Report (Vega), scorer edge cases.
- **Phase 7** — Snapshots and diffs: creation modal, compare modal, side-by-side diff, snapshot score badges, import.
- **Phase 8** — Lifecycle: wizard (7 engine types), import/export modals, judgements modal, unarchive, delete case options. All parity review items resolved (TLS switching, SearchAPI validation, static CSV import, post-wizard tour).
- **Phase 9** — Ancillary: flash messages, loading states, 404 handling, tour (zero-dep replacement for Shepherd.js).

---

## Status log

- **2026-03-19** — Initial plan created.
- **2026-03-21** — Synced `new_ui` status; readable rewrite with TOC and mermaid diagrams.
- **2026-03-22** — Phase 5 complete (all 6 tune relevance slices). Phase 6 sparkline done.
- **2026-03-22** — Phase 3 bulk actions complete (Run All, delete case options modal).
- **2026-03-23** — Phase 9 complete (flash, loading, 404, tour).
- **2026-03-23** — Phase 4 complete (7 result row features + field renderer).
- **2026-03-23** — Phase 8 complete (wizard, import/export, judgements, unarchive). All parity review items resolved.
- **2026-03-23** — Phase 6 complete (Frog Pond Report + Vega).
- **2026-03-23** — Phase 2 CaseCtrl/CurrSettingsCtrl parity verified.
- **2026-03-24** — Cleaned plan: removed completed phases, consolidated remaining work (Phase 1, Phase 2 leftovers, Phase 10).

---

## Appendix: Review summary (historical)

The **pragmatic engineer review** is incorporated throughout: [Expectations](#expectations-calendar-and-staffing), [Target architecture](#target-architecture-directional), Phase **10**, [Testing](#testing-strategy), [Rollout](#rollout), [Risks](#risks-and-mitigations), and [DevTools](#browser-devtools-visibility-and-proxyfetch).

# AngularJS removal: inventory & migration plan

Fresh codebase scan (24 Aug 2026). Single reference for **what** AngularJS owns in Quepid, **why** to migrate, **how** to do it incrementally (default), optional **full case-page rewrite** decisions, and **what to delete** when done.

Quepid’s frontend is split in two:

| Surface | Stack | Entry |
|---------|-------|-------|
| **Core case UI** | AngularJS 1.8 SPA (queries, ratings, Solr JSONP) | `app/views/layouts/core.html.erb`, `QuepidApp` |
| **Rails pages** | ERB + Stimulus (+ Turbo Streams in places) | teams, books, scorers, cases index, home, admin, … |

**Default path:** chip away at isolated pieces without rebuilding the whole case workspace — toolbar Stimulus twins first, defer query/search state until deliberate. **Optional fork:** full case-page rewrite (most of the effort; where search engineers spend their time). See [Full case-page rewrite fork](#full-case-page-rewrite-fork-optional).

Backend stays on any path: Rails 8.1, existing models/services, MySQL, Solid Queue/Cable, REST API (`oas_rails` — extend, don't restart). **`splainer-search` 3.x is already vanilla ESM**; keep it except on a strict no-reuse clean-slate.

See also: [App structure](../app_structure.md), [Vendor README](../../app/javascript/vendor/README.md), [DEVELOPER_GUIDE](../../DEVELOPER_GUIDE.md), [event bus inventory](./event_bus_inventory.md) (re-run before deleting `$broadcast` emitters).

---

## Executive summary

AngularJS 1.8 powers the **core case UI** at `/case/:id` and `/case/:id/try/:try_number`. Everything else already runs on Rails + Stimulus.

| Category | Count (on disk) |
|----------|-----------------|
| Angular JS source files (`app/assets/javascripts`) | 148 files, ~143 register `angular.module` |
| HTML templates (components + `app/assets/templates`) | 58 |
| Controllers | 61 (`.controller()` registrations; 27 files under `controllers/`) |
| Services | 26 (`.service()` registrations; 27 files under `services/` — `quepidModalSvc.js` registers a factory) |
| Factories | 8 |
| Filters | 7 |
| Custom directives / components | 37 (26 `.directive()` + 11 `.component()`) |
| `QuepidApp` module dependencies (excl. `UtilitiesModule`) | 17 |
| Vendored Angular libraries (`app/javascript/vendor`) | 11 packages (+ `angular` core from npm) |
| Karma unit specs (`spec/javascripts/angular`) | 34 |
| Playwright specs for the case UI | 2 spec files + helpers + baselines |

---

## Why migrate

### What actually needs to change

| Priority | Item | Notes |
|----------|------|-------|
| **P0** | AngularJS 1.8.3 EOL | ~148 JS files, 58 templates on the core case UI — no patches since Dec 2021 |
| **P0** | `queriesSvc` god object (~1,386 lines) | Query state, search, scoring, book sync, positions via `$rootScope.$broadcast` |
| **P0** | `eval()` scorers | Inside `$timeout()`, no sandbox; Web Worker timeout commented out |
| **P1** | Scorer dual-execution drift | `ScorerFactory.js` (client) vs `scorer_logic.js` (server) — client API is richer |
| **P1** | `new Function()` mappers | SearchAPI mappers; MiniRacer on server; mapper wizard already Stimulus |
| **P2** | Digest workarounds | Version counters / sentinels instead of clear data flow |
| **P2** | Copy-paste debt | e.g. identical `rateElementSvc` / `rateBulkSvc` |
| **Defer** | jQuery pane resize | Narrow scope (`toggleEast`, layout polling) — migrate with case page, not a driver |
| **Defer** | `bootstrap5-compat.css` | Largely done; tuning shims, not a rewrite gate |

### Critical complexity inventory

**App-level** (mostly keep as-is; port seams with UI work):

| Feature | Why it's hard |
|---------|--------------|
| SearchAPI mapper code | User JS via `new Function()` / MiniRacer; AI-assisted generation (mapper wizard) |
| Search engine coupling | `splainer-search` 3.x covers 7 engines; Quepid seams remain (snapshot fake-Solr, proxy/auth, TLS switching) |
| Snapshot fake-Solr hack | Engines without doc-lookup get a Solr-compatible snapshot endpoint |
| Fractional indexing | Bigint linked-list ordering with midpoint bisection + normalization |
| Try ancestry overflow | 3072-char ancestry, chain restart, `:adopt` orphans |
| Position-weighted selection | Inverse-CDF SQL for weighted reservoir sampling |
| Case ↔ Book sync | Bidirectional sync, pessimistic 3-judgement consensus |
| Score deduplication | 3-tier CaseScoreManager (5min update / same-day ignore / else create) |

**Core UI** (where rewrite effort concentrates):

| Feature | Why it's hard |
|---------|--------------|
| Two-phase search-then-score | ≤10 workers, score-promise aggregation, rate-limit delays, dual-phase progress |
| Real-time score propagation | Rating → `scoreAll()` → case average → diff refresh → badges |
| Multi-snapshot diff | ≤5 snapshots; snapshot-as-searcher; client `scoreOthers()`; case-level averages |
| Scorer runtime | 18-fn API, loop ban, score caps; drift between client and batch server paths |
| DnD + pagination | Sortable offsets across pages, fractional `PUT position`, sort-mode gating |
| Document Finder | Per-query mode; engine-specific rated-doc filters; `explainOther()` |
| Wizard + Tour | 6-step wizard, CSV Static import, field typeahead; Shepherd tour |
| Book sync | Batches of 100, optimistic cache, field mapping, background ≥50 queries |
| TLS protocol switching | Mixed-content redirect preserving UI state in URL params |

### Decision lenses

Condensed from a larger advisory panel — the questions that actually gate a rewrite:

| Lens | Question |
|------|----------|
| **Incremental shipper** | What ships without a feature freeze? (Toolbar Stimulus twins, DOM utilities, management modals.) |
| **Search/IR domain** | Does live tuning still search customer engines from the browser (proxy when needed)? Does batch eval stay on `FetchService`? |
| **UX fidelity** | Does rating still feel instant? (Today: client `scoreAll()` on every rating — not negotiable.) |
| **Security** | What replaces browser `eval()` for scorers? (Web Worker — not server-only scoring.) |
| **Performance** | Large cases (1,000+ queries): `scoreAll()` is O(n queries) today — framework change alone doesn't fix that. |
| **A11y** | Scores can't be color-only; real ARIA on badges and rating controls. |

---

## How to migrate

### Difficulty scoring

Use when sizing a PR:

- **Coupling** — Touches live query/search/rating state (`queriesSvc`, `$scope` trees)?
- **Scope** — JS size and number of templates.
- **Replacement ready?** — Stimulus / vanilla pattern already on Rails pages?
- **Infrastructure** — Safe to remove only after dependents are gone?

### Suggested PR order (start here)

Actionable incremental wins — do these before touching query/search state:

1. **DOM utilities → Stimulus or BS5 data API** — `textPaste`, `quepidTooltip`, `quepidPopover` (already wrap `window.bootstrap`; no case state).
2. **Tiny vendored UI** — `angular-countup` (one `<count-up>` in `searchResults.html`), `angular-timeago` (one use in `annotation.html`).
3. **`share-case` on the core toolbar** — Cases index and teams already use Stimulus `share-case` + `_share_case_modal.html.erb`; core still uses Angular `<share-case>`. Best duplicate to remove. Decide post-submit UX (stay on case vs redirect).
4. **`delete-case-options` / archive** — Mirror cases/teams `confirm-delete` + Rails archive/delete routes from the case context.
5. **`clone-case`** — Modal + API / form-post; preserve post-clone navigation (`caseTryNavSvc.navigateTo` today).
6. **`export-case`** — Larger modal + job polling; still a management action, not live search state.
7. **Defer** `queriesCtrl` / `queriesSvc` / `searchResults` and scoring/diff/import stacks until a deliberate case-page redesign.

Optional when touching nearby code:

- **`ngclipboard`** — Four copy buttons (search results + explain modal). Prefer `navigator.clipboard` (see Stimulus invite / mapper-wizard). Fix the Explain Query race below.
- **`debug-matches`**, **`expand-content`** — Small markup; migrate with the matches/explain popover stack.

Prefer **Rails view + route + Stimulus** for management actions over embedding new Stimulus inside the Angular bundle.

### Full case-page rewrite fork (optional)

Keep the existing Rails backend and API. The incremental PR order above is the default. If the case workspace gets a full rewrite instead:

Hotwire already covers most non-case pages (teams, books, scorers, admin). The case workspace is one route but **most of the product value**.

```
┌──────────────────────────────────────────────┐
│     Rails 8 (existing)                       │
│  Models · Services · Solid Queue · API       │
│  oas_rails (extend) · MySQL · Solid Cable    │
└──────────┬───────────────────┬─────────────┘
           │                   │
  ┌────────┴────────┐  ┌───────┴──────────────┐
  │ Hotwire pages   │  │ Case workspace       │
  │ (already live)  │  │ Stimulus *or* React  │
  └─────────────────┘  │ esbuild bundle       │
                       │ splainer-search 3.x  │
                       └──────────────────────┘
```

**UI stack:** Stimulus + vanilla (matches incremental path) *or* a React island — either way bundle with **esbuild** (same as `build:angular-vendor` today). Importmap is for Stimulus pages, not a heavy case workspace.

**Search:** Live `searchAll()` stays **client → customer engine** (Quepid proxy for CORS/auth). Server-side fetch is already the **batch** path (`FetchService` / `RunCaseEvaluationJob`) — don't conflate the two.

**Scoring:** **Client-side** on the case page (rating/search/diff). MiniRacer for batch only. Consolidate drift via a **shared npm scorer package** (one helper implementation, browser + `lib/scorer_logic.js`) — not server-only scoring.

**API:** Extend existing REST endpoints and `oas_rails` docs; the Angular app is already an API client.

**Not in scope for a UI rewrite:** domain model redesign, OpenAPI-from-scratch, moving live search or live scoring server-side.

### Core toolbar duplicates (highest leverage)

From `app/assets/templates/views/queriesLayout.html`:

| Angular on core | Stimulus / Rails already on cases index & teams |
|-----------------|-------------------------------------------------|
| `<share-case>` | `share_case_controller.js` + `_share_case_modal.html.erb` |
| `<delete-case-options>` | `confirm_delete_controller.js` + archive/delete/unarchive routes |
| `<clone-case>` | No Stimulus twin yet — `fetch` to clone API via `caseSvc.cloneCase` |
| `<export-case>` | No twin — export + background job |
| `<diff>`, `<import-ratings>` | Defer (heavy case state) |

### Stimulus twins already on Rails pages

Reuse these instead of reimplementing modals/flows:

| Stimulus controller | Typical usage |
|---------------------|---------------|
| `share-case` | Cases index + teams + `_share_case_modal.html.erb` |
| `share-book`, `share-scorer`, `share-search-endpoint` | Shared modals under `app/views/shared/` |
| `import-case`, `import-snapshot` | Shared modals |
| `confirm-delete` | Archive / delete / unarchive (cases, teams, books, search endpoints, members) |
| `invite`, `team-member-autocomplete` | Team invite / membership |
| `bulk-judgement`, `mapper-wizard` | Book LLM judge; mapper wizard |
| `document-fields-modal`, `scoring-guidelines`, `scorer-scale` | Books / scorers forms |
| `confetti`, `prompt-form`, `user-activity` | Judgement celebration; prompts; admin charts |

Controllers: `app/javascript/controllers/` · entry: `app/javascript/application_modern.js`

### Full removal order (after incremental PRs)

When replacing the case SPA (not just toolbar actions), work in dependency order:

1. Shared primitives — `$quepidModal`, popovers, tooltips, typeahead, flash, CSRF fetch wrapper
2. Shell — drop `ngRoute`; `MainCtrl` bootstrap → Stimulus + fetch
3. Services layer — `caseSvc`, `settingsSvc`, `queriesSvc`, `scorerSvc`, `ratingsStoreSvc`
4. Splainer — drop `$q` shim; use `splainer-search/wired.js` directly
5. Query list + results — `queries`, `search-results`, rating UI
6. Case action modals — share, clone, export, import, judgements, diff, delete, snapshot, pick scorer
7. Wizard — largest template; ACE, CSV, tags, tour
8. Tune Relevance pane — ACE, json explorer, try management
9. Header — `HeaderCtrl` dropdowns
10. Cleanup — removal checklist below

### Hardest — do not start here

#### By file (LOC)

| Name | LOC | Why |
|------|-----|-----|
| **queriesSvc** | 1,386 | Central case state — search, docs, scores, persistence |
| **wizardModal** | 909 | Onboarding wizard (ACE, CSV, tags, tour) |
| **queriesCtrl** | 606 | Query list UX (sort, filter, paginate, keyboard) |
| **settingsSvc** / **caseSvc** | 638 / 511 | Try / case domain model |
| **$quepidModal** | 275 | BS5 modals + `$compile` — ~21 `.open()` call sites (~40 consumer files) |
| **ScorerFactory** | 666 | Scoring model + judgement math |
| **routes.js** + **ngRoute** | — | Entire SPA |
| **angular core** | — | Remove last |

**Component LOC** (easiest → hardest, after toolbar duplicates): matches (0 JS) → debug_matches (59) → new_case (66) → expand_content (69) → qscore_* (79–82) → annotation/annotations (87–94) → query_options (98) → clone_case (105) → query_explain (116) → add_query/move_query (146–152) → delete_case_options (153) → share_case (177) → export_case (257) → qgraph (250) → diff (285) → judgements (302) → frog_report (360) → import_ratings (462).

**Defer on the case workspace** (Solr JSONP, live state, or large modals): `searchResults` / `searchResult` / `queries`, `qgraph` / qscore\*, `diff`, `import-ratings`, `add-query`, `query-options`, `query-explain`, `new-case` / wizard, `frog-report`, `judgements`, annotations, `quepidTypeahead`, `queryParams`, `stackedChart`, `quepidCollapse`. Moving these implies rebuilding the case SPA, not a framework swap.

#### App-level (port seams; don't rebuild)

**Scoring runtime** — Custom JS scorers expose an ~18-function API. `ScorerFactory.js` and `scorer_logic.js` already drift (client has helpers the server lacks). **Direction:** shared npm package with an explicit canonical API and a scorer migration guide — not server-only scoring; every rating triggers client `scoreAll()` today.

**Search engine coupling** — **Already shipped:** `splainer-search` 3.x ESM — seven engines, explain parsing, field-spec normalization. Stimulus can import `createWiredServices` directly; Angular uses the same package via `splainer_search_adapter.js`. **Still hard:** Quepid-specific seams — snapshot fake-Solr, proxy/basic auth, TLS protocol switching, SearchAPI mapper code — must port with any case UI work.

#### UI-level (reimplement on any framework)

1. **Concurrent search pool** — Client `pAll()` with ≤10 workers, dual-phase progress (search then score), rate-limit delays. **Reimplement on the client.** Batch evaluation already has a separate server path — moving live search server-side adds latency and routes customer traffic through Quepid workers without fixing Solr JSONP → HTTP case-page constraints.

2. **Scorer sandboxing** — Replace `eval()`. **Direction:** Web Worker (docs + scorer code in, score out). Budget for `scoreAll()` calling the worker per query per rating unless the flow is redesigned. MiniRacer stays for batch paths only.

3. **Multi-snapshot diff + scoring** — ≤5 snapshots, snapshot-as-searcher, client `scoreOthers()`, per-position diff, case averages. `diffResultsSvc.js` is ~225 lines but sits on fake-Solr snapshots and rating-driven refetch — line count understates the work.

4. **Angular templates → target syntax** — 58 templates (`ng-repeat`, `ng-if`, `ng-model`, `dir-paginate`, `quepid-sortable`, `ui-ace`, …). Stimulus partials or React JSX depending on chosen stack.

5. **Field spec parsing and display** — `id:id title:name …` — type detection (JSON / URL / text), thumb prefixes, media by extension, snippet `<strong>` wrapping. Domain logic in splainer-search + Quepid display code, not framework glue.

### Open bugs & UX (address during migration)

Playwright MCP–verified issues on the core case UI. **Do not patch in AngularJS** — fix when migrating the owning surface (see [todo.md § Obviated](./todo.md#obviated-by-angular-removal-do-not-fix-in-angular)).

#### Try delete bricks case on reload

**Observed:** After deleting the latest try, reload shows *"Cannot read properties of null (reading 'tryNo')"* until DB repair.

**Frontend cause:** `settingsSvc.editableSettings()` assumes `selectedTry` is non-null. Try delete has no confirm; delete produces unhandled rejection noise in the console.

**Fix during migration:** Fall back to the newest try when `selectedTry` is null; confirm before try delete; handle delete promise rejections cleanly.

**Backend still required:** `Api::V1::TriesController#destroy` must recompute `cases.last_try_number` — tracked in [todo.md § P0 backend](./todo.md#deleting-the-latest-try-bricks-the-case-backend).

#### First-run Shepherd tour: `Shepherd is not defined`

**Observed:** After a new user's first wizard Finish, tour never starts; console `ReferenceError: Shepherd is not defined`.

**Cause:** `tour.js` expects global `Shepherd`; `angular_app.js` side-effect-imports tether-shepherd but does not pin `window.Shepherd` (unlike `window.bootstrap`).

**Fix during migration:** Pin `window.Shepherd` (and confirm Tether) in the post-Angular entry bundle, or load Shepherd only from the new wizard/tour Stimulus (or server) flow. See [core_ui_implementation_reference § Shepherd](./core_ui_implementation_reference.md#1-shepherd-post-wizard-tour-tourjs).

**Touches:** wizard finish (`wizardCtrl.js` / `new_case_controller.js`), [Feature area § New-case wizard](#4-new-case-wizard), full removal order step 7 (wizard).

#### Wizard Esc orphans empty cases

**Observed:** Wizard **X** prompts and deletes the empty case; **Esc** closes with no confirm and leaves the case.

**Fix during migration:** Disable keyboard dismiss on the wizard modal, or route Esc through the same abandon handler as X (`caseSvc.deleteCase` cleanup).

**Touches:** `wizardModal.html`, `angular-wizard`, [Feature area § New-case wizard](#4-new-case-wizard).

#### Static CSV missing required headers

**Observed:** Static CSV missing `Doc ID` header is accepted (help text says required).

**Cause:** `caseCSVSvc.arrayContains` always returns `true` because `return false` inside `forEach` only exits the callback, so required-header checks (including `Doc ID`) never fail.

**Fix during migration:** Reimplement header validation in the new CSV import path (wizard + `<import-ratings>`). Product decision still needed on how strict to be.

**Touches:** `caseCSVSvc`, wizard CSV step, `<ng-csv-import>`, [Feature area § New-case wizard](#4-new-case-wizard).

#### Icon-only controls lack accessible names

**Observed:** Icon-only controls (copy-query; snapshot delete/clear in Compare) lack accessible names on the button.

**Fix during migration:** Add `aria-label` (or visible text) on the replacement controls. Align with [decision lens § A11y](#decision-lenses) — scores and rating controls need real ARIA, not color-only state.

**Touches:** `searchResults.html`, diff/snapshot Compare UI, [Feature area § Search results](#6-search-results-and-rating-ui).

#### Known bug (copy / explain migration)

**Explain Query “Copy” buttons** (`query_explain/_modal.html`): each button has both `ng-click="ctrl.cancel()"` and `ngclipboard`. Cancel dismisses the modal before ClipboardJS commits — copy silently fails. The standalone copy on `searchResults.html` works.

**Fix:** drop `cancel()` from Copy buttons, or defer cancel until after copy success. Prefer `navigator.clipboard` when replacing ngclipboard.

---

## Where Angular is mounted

### Rails routes (`config/routes.rb`)

- `GET /case/:id(/try/:try_number)` → `core#index` (`case_core`)
- `GET /cases/new` → `core#new` (`case_new`)
- `GET /case` → `core#index`

The Rails cases index at `/cases` is **not** Angular.

### Layout and bootstrap (`app/views/layouts/core.html.erb`)

- `<body ng-app="QuepidApp">`
- JS: `angular_app`, `angular_templates`, `quepid_angular_app`
- CSS: `angular-json-explorer`, `angular-wizard`, `ng-tags-input`
- Inline script: `bootstrapSvc.run()`, `configurationSvc` seeded from Rails config

### Case shell (`app/views/core/index.html.erb`)

Flash include, `LoadingCtrl`, `ng-view`

### Header (`app/views/layouts/_header_core_app.html.erb`)

`HeaderCtrl`, `ng-repeat` case/book dropdowns

### Client routing (`app/assets/javascripts/routes.js`)

- `$locationProvider.html5Mode(true)`
- `/case/:caseNo(/try/:tryNo)` → `MainCtrl` + `views/queriesLayout.html`
- Fallback → `404Ctrl` + `views/404.html`

---

## Root module and dependencies

### `QuepidApp` (`app/assets/javascripts/app.js`)

| Module | Source | Used for | Replace with |
|--------|--------|----------|--------------|
| `ngRoute` | `angular-route` | Case/try routing | History API / Rails URLs (last with SPA) |
| `ngSanitize` | `angular-sanitize` | `ng-bind-html` | DOMPurify or server sanitize |
| `yaru22.angular-timeago` | `angular-timeago` | Relative timestamps | `Intl.RelativeTimeFormat` |
| `mgo-angular-wizard` | `angular-wizard` | New-case wizard | Multi-step Stimulus or server wizard |
| `ngJsonExplorer` | `ng-json-explorer` | JSON panes | Vanilla tree component |
| `o19s.splainer-search` | `splainer_search_adapter.js` | Search HTTP | `splainer-search/wired.js` directly |
| `ui.ace` | `angular-ui-ace` | Query editors | Stimulus + `window.ace` |
| `angularUtils.directives.dirPagination` | `angular-utils-pagination` | Query paging | Stimulus pager |
| `ngCsvImport` | `angular-csv-import` | CSV upload | Papa Parse + file input |
| `angular-flash.*` | `angular-flash` | Flash messages | BS5 toast / Rails flash |
| `ngTagsInput` | `ng-tags-input` | Wizard fields | Tom Select / tags Stimulus |
| `ng-rails-csrf` | `interceptors/rails-csrf.js` | CSRF on `$http` | Fetch wrapper with CSRF meta tag |
| `templates` | `build_templates.js` | `$templateCache` | ERB partials / Stimulus templates |
| `countUp` | `angular-countup` | Hit count animation | Plain count-up / CSS |
| `ngclipboard` | `ngclipboard` + `clipboard` | Copy buttons | `navigator.clipboard` |
| `ngVega` | `directives/angular-vega.js` | Frog report chart | `vegaEmbed` on `window` (keep until frog report migrates) |

Non-Angular libs that **stay**: Bootstrap 5, D3, Vega, ACE, autocompleter, clipboard, URI.js, Shepherd, SortableJS.

### `UtilitiesModule` (`app/assets/javascripts/utilitiesModule.js`)

| Registration | File |
|--------------|------|
| `bootstrapSvc` | `services/bootstrapSvc.js` |
| `userSvc` | `services/userSvc.js` |
| `configurationSvc` | `services/configurationSvc.js` |

---

## Feature areas to migrate

Work is grouped by user-visible capability. Each area spans templates, controllers, directives/components, and backing services.

### 1. Application shell

| Item | Type | Key files |
|------|------|-----------|
| App bootstrap & loading gate | controller | `LoadingCtrl` — `controllers/loading.js` |
| Case/try bootstrapping | controller | `MainCtrl` — `controllers/mainCtrl.js` |
| 404 handling | controller + template | `404Ctrl`, `templates/views/404.html` |
| Global flash | template + directive | `templates/views/common/flash.html`, `search_flash.html`, `flash-alert` |
| Current user on `$rootScope` | service | `bootstrapSvc`, `userSvc` |
| App config flags | service | `configurationSvc` |
| CSRF on API requests | interceptor | `interceptors/rails-csrf.js` |
| Case/try URL helpers | service | `caseTryNavSvc` |
| Pane layout (east slider) | service + value | `paneSvc`, `eastPaneWidth` |

### 2. Header navigation (core layout)

| Item | Type | Key files |
|------|------|-----------|
| Recent cases dropdown | controller | `HeaderCtrl` — `controllers/headerCtrl.js` |
| Recent books dropdown | controller | same |
| New case link | component | `<new-case>` — `components/new_case/` |

Templates: `layouts/_header_core_app.html.erb`, `components/new_case/new_case.html`

### 3. Case header, scoring, and case actions

| Item | Type | Key files |
|------|------|-----------|
| Case layout shell | template | `templates/views/queriesLayout.html` |
| Case score display | component | `<qscore-case>` — `components/qscore_case/` |
| Per-query score | component | `<qscore-query>` — `components/qscore_query/` |
| Case rename, nightly/public badges | controller | `CaseCtrl` — `controllers/case.js` |
| Try rename in header | controller | `CurrSettingsCtrl` — `controllers/currSettings.js` |
| Select scorer modal | controller + template | `ScorerCtrl`, `templates/views/pick_scorer.html` |
| Create snapshot | controller + template | `TakeSnapshotCtrl`, `PromptSnapshotCtrl`, `templates/views/snapshotModal.html` |
| Share case | component | `<share-case>` — `components/share_case/` |
| Clone case | component | `<clone-case>` — `components/clone_case/` |
| Delete case / delete queries | component | `<delete-case-options>` — `components/delete_case_options/` |
| Export case | component | `<export-case>` — `components/export_case/` |
| Import ratings | component | `<import-ratings>` — `components/import_ratings/` |
| Diff against snapshot | component | `<diff>` — `components/diff/` |
| Judgements / books | component | `<judgements>` — `components/judgements/` |
| New-case wizard launcher | controller | `WizardCtrl` — `controllers/wizardCtrl.js` |

Backing services: `caseSvc`, `scorerSvc`, `ScorerFactory`, `querySnapshotSvc`, `snapshotSearcherSvc`, `SnapshotFactory`, `importRatingsSvc`, `caseCSVSvc`, `bookSvc`, `teamSvc`, `diffResultsSvc`, `qscoreSvc`

### 4. New-case wizard

| Item | Type | Key files |
|------|------|-----------|
| Wizard modal | controller + template | `WizardModalCtrl`, `templates/views/wizardModal.html` |
| Custom headers step | directive + controller | `<custom-headers>`, `CustomHeadersCtrl`, `templates/views/customHeaders.html` |
| CSV import (queries/ratings) | third-party | `<ng-csv-import>` in wizard and import-ratings modals |
| Tags for additional fields | third-party | `<tags-input>` in wizard |
| ACE editors in wizard | third-party | `ui-ace` attributes |
| Wizard cancel cleanup | service call | `caseSvc.deleteCase` from `wizardModal.js` |

### 5. Query list

| Item | Type | Key files |
|------|------|-----------|
| Query list container | directive + controller | `<queries>`, `QueriesCtrl` — `directives/queries.js`, `controllers/queriesCtrl.js` |
| Query list template | template | `templates/views/queries.html` |
| Add query | component | `<add-query>` — `components/add_query/` |
| Sort / filter / collapse | controller logic | `QueriesCtrl` |
| Drag reorder | directive | `quepidSortable` — `directives/quepidSortable.js` (uses SortableJS via `window.Sortable`) |
| Pagination | third-party | `dir-paginate`, `<dir-pagination-controls>` |
| Queries-without-results report | component | `<frog-report>` — `components/frog_report/` (includes Vega chart) |
| Score-over-time graph | component | `<qgraph>` — `components/qgraph/` |

Backing services: `queriesSvc`, `queryViewSvc`, `searchErrorTranslatorSvc`, `varExtractorSvc`

Filters: `queryStateClass`, `scoreDisplay`, `caseType`, `searchEngineName`

### 6. Search results and rating UI

| Item | Type | Key files |
|------|------|-----------|
| Results panel | directive + controller | `<search-results>`, `SearchResultsCtrl` |
| Single result row | directive + controller | `<search-result>`, `SearchResultCtrl` |
| Results template | template | `templates/views/searchResults.html`, `searchResult.html` |
| Rating popover | template | `templates/views/ratings/popover.html` |
| Rate elements | services | `rateElementSvc`, `ratingsStoreSvc`, `rateBulkSvc` |
| Rating background styling | filter | `ratingBgStyle` |
| Query notes | controller | `QueryNotesCtrl` |
| Annotations list | component | `<annotations>` — `components/annotations/` |
| Single annotation | component | `<annotation>` — `components/annotation/` |
| Explain modal | component | `<query-explain>` — `components/query_explain/` |
| Query options modal | component | `<query-options>` — `components/query_options/` |
| Move query modal | component | `<move-query>` — `components/move_query/` |
| Missing documents search | controllers + template | `TargetedSearchCtrl`, `DocFinderCtrl`, `TargetedSearchModalCtrl`, `templates/views/targetedSearchModal.html` |
| Diff results view | directive + controller | `<query-diff-results>`, `QueryDiffResultsCtrl`, `templates/views/queryDiffResults.html` |
| Hot matches chart | directive + controller | `<stackedChart>`, `HotMatchesCtrl`, `templates/views/stackedChart.html` |
| Matches popover content | template (no JS) | `components/matches/matches.html` (loaded via `quepid-popover-template`) |
| Debug matches | component | `<debug-matches>` — `components/debug_matches/` |
| Expand content modal | component | `<expand-content>` — `components/expand_content/` |
| Embed helper | directive | `quepidEmbed` on `searchResult.js` |
| Hit count animation | third-party | `<count-up>` |
| Copy query text | third-party | `ngclipboard` |

Backing services/factories: `docCacheSvc`, `docListFactory`, `annotationsSvc`, `AnnotationFactory`, `searchEndpointSvc`

Filters: `isImageUrl`, `quepidTypeaheadHighlight` (used by typeahead directive)

### 7. Tune Relevance (east pane / dev settings)

| Item | Type | Key files |
|------|------|-----------|
| Dev settings shell | controller + template | `SettingsCtrl`, `templates/views/_dev_settings.html` |
| Query params editor | directive + controller | `<query-params>`, `QueryParamsCtrl`, `templates/views/devQueryParams.html` |
| Try details popover/modal | controller + template | `QueryParamsDetailsCtrl`, `templates/views/queryParamsDetails.html` |
| Try history | directive + controller | `<query-params-history>`, `queryParamsHistoryCtrl`, `templates/views/queryParamsHistory.html` |
| Settings persistence | service + factories | `settingsSvc`, `SettingsFactory`, `TryFactory` |
| Search endpoint popup | template | `templates/views/searchEndpoint_popup.html` |
| Detailed doc modal | controller + template | `DetailedDocCtrl`, `templates/views/detailedDoc.html` |
| Explain detail modal | controller + template | `DocExplainCtrl`, `templates/views/detailedExplain.html` |

Uses heavily: `ui-ace`, `json-explorer`, `settingsIdValue`

### 8. Shared UI primitives (migrate before or alongside features)

These Angular-specific wrappers are used across many templates:

| Primitive | File | Replaces |
|-----------|------|----------|
| `$quepidModal` | `services/quepidModalSvc.js` | Bootstrap 5 modals (already BS5-backed shim; ~21 `.open()` sites) |
| `quepidPopover` / `quepidPopoverTemplate` | `directives/quepidPopover.js` | Bootstrap 5 popovers |
| `quepidTooltip` | `directives/quepidTooltip.js` | Bootstrap 5 tooltips |
| `quepidCollapse` | `directives/quepidCollapse.js` | Bootstrap collapse |
| `quepidTypeahead` | `directives/quepidTypeahead.js` | `autocompleter` (already vanilla; wired via Angular directive) |
| `textPaste` | `directives/textPaste.js` | Paste handling |
| `vega` | `directives/angular-vega.js` | Vega embed (Vega loaded via importmap `vega_globals`) |

---

## Component inventory (21 folders)

| Folder | Element | Purpose |
|--------|---------|---------|
| `add_query` | `<add-query>` | Add query |
| `annotation` | `<annotation>` | Single annotation CRUD |
| `annotations` | `<annotations>` | Annotation list |
| `clone_case` | `<clone-case>` | Clone case modal |
| `debug_matches` | `<debug-matches>` | Debug relevancy matches |
| `delete_case_options` | `<delete-case-options>` | Delete case or all queries |
| `diff` | `<diff>` | Snapshot diff picker |
| `expand_content` | `<expand-content>` | Expand HTML in modal |
| `export_case` | `<export-case>` | Export case data |
| `frog_report` | `<frog-report>` | Zero-results report + Vega |
| `import_ratings` | `<import-ratings>` | CSV import |
| `judgements` | `<judgements>` | Link to judgement book |
| `matches` | *(template only)* | Hot-matches popover body |
| `move_query` | `<move-query>` | Move query to another case |
| `new_case` | `<new-case>` | Header new-case entry |
| `qgraph` | `<qgraph>` | Score timeline |
| `qscore_case` | `<qscore-case>` | Case score display |
| `qscore_query` | `<qscore-query>` | Per-query score |
| `query_explain` | `<query-explain>` | Explain JSON modal |
| `query_options` | `<query-options>` | Per-query options |
| `share_case` | `<share-case>` | Share with teams |

---

## Page-level directives

| Directive | Element | Template | Controller |
|-----------|---------|----------|------------|
| `queries` | `<queries>` | `queries.html` | `QueriesCtrl` |
| `searchResults` | `<search-results>` | nested | `SearchResultsCtrl` |
| `searchResult` | `<search-result>` | `searchResult.html` | `SearchResultCtrl` |
| `queryParams` | `<query-params>` | `devQueryParams.html` | `QueryParamsCtrl` |
| `queryParamsHistory` | `<query-params-history>` | `queryParamsHistory.html` | `queryParamsHistoryCtrl` |
| `queryDiffResults` | `<query-diff-results>` | `queryDiffResults.html` | `QueryDiffResultsCtrl` |
| `customHeaders` | `<custom-headers>` | `customHeaders.html` | `CustomHeadersCtrl` |
| `stackedChart` | `<stackedChart>` | `stackedChart.html` | `HotMatchesCtrl` |

Attribute directives: `quepidSortable`, `quepidPopover`, `quepidPopoverTemplate`, `quepidTooltip`, `quepidCollapse`, `quepidTypeahead`, `quepidEmbed`, `textPaste`, `vega`

Thin shells (~14–16 LOC): `queries`, `queryParams`, `customHeaders`, `queryParamsHistory`, `queryDiffResults`. Heavy: `quepidTypeahead` (299), `quepidPopover` (250), `searchResult` (79).

---

## Services, factories, and filters

**Services (26):** `annotationsSvc`, `bookSvc`, `bootstrapSvc`*, `caseCSVSvc`, `caseSvc`, `caseTryNavSvc`, `configurationSvc`*, `diffResultsSvc`, `docCacheSvc`, `importRatingsSvc`, `paneSvc`, `qscoreSvc`, `queriesSvc`, `querySnapshotSvc`, `queryViewSvc`, `rateBulkSvc`, `rateElementSvc`, `ratingsStoreSvc`, `scorerSvc`, `searchEndpointSvc`, `searchErrorTranslatorSvc`, `settingsSvc`, `snapshotSearcherSvc`, `teamSvc`, `userSvc`*, `varExtractorSvc` (* = `UtilitiesModule`)

**Factories (8):** `$quepidModal` (`services/quepidModalSvc.js`), `AnnotationFactory`, `broadcastSvc`, `docListFactory`, `ScorerFactory`, `SettingsFactory`, `SnapshotFactory`, `TryFactory`

`broadcastSvc` wraps `$rootScope.$broadcast` — used by `caseSvc`, `settingsSvc`, `queriesSvc`, `annotationsSvc`, `bookSvc`, `teamSvc`. See [event bus inventory](./event_bus_inventory.md).

**Filters (7):** `caseType`, `isImageUrl`, `quepidTypeaheadHighlight`, `queryStateClass`, `ratingBgStyle`, `scoreDisplay`, `searchEngineName`

**Values (2):** `eastPaneWidth`, `settingsIdValue`

---

## Templates (58 HTML files)

**Shell:** `queriesLayout.html`, `queries.html`, `404.html`, `embed.html`

**Search/results:** `searchResults.html`, `searchResult.html`, `queryDiffResults.html`, `stackedChart.html`, `targetedSearchModal.html`, `ratings/popover.html`

**Case-action modals:** `pick_scorer.html`, `snapshotModal.html`, `searchEndpoint_popup.html`

**Dev pane:** `_dev_settings.html`, `devQueryParams.html`, `queryParamsDetails.html`, `queryParamsHistory.html`, `customHeaders.html`, `detailedDoc.html`, `detailedExplain.html`

**Wizard:** `wizardModal.html` · **Flash:** `common/flash.html`, `common/search_flash.html`

**Components:** 35 HTML files under `app/assets/javascripts/components/`

Compiled by `build_templates.js` → `app/assets/builds/angular_templates.js`.

---

## Other inventory

### Splainer-search shim

`app/javascript/splainer_search_adapter.js` — wraps fetch in Angular `$q` for digest cycles. Drop when off Angular.

### Non-Angular JS in the Angular bundle

`footer.js`, `tour.js`, `ace_config.js`, `scorerEvalTest.js`, `mode-json.js` — relocate when bundle goes away.

### Stylesheets

Core layout loads vendor CSS: `angular-json-explorer`, `angular-wizard`, `ng-tags-input`. `core.css` + `bootstrap5-compat.css` style the case UI.

### Build toolchain

| Artifact | Path |
|----------|------|
| npm `angular`, `angular-mocks` | `package.json` |
| Vendor bundle | `app/javascript/angular_app.js` → `app/assets/builds/angular_app.js` |
| App bundle | `build_angular_app.js` → `quepid_angular_app.js` |
| Templates | `build_templates.js` → `angular_templates.js` |
| yarn scripts | `build:angular*` included in `yarn build` |
| Vendor CSS | `build_css.js` · audit: `audit_css.js` |

Vendored libs: `app/javascript/vendor/angular-*`, `ng-*` (11 packages; see [vendor README](../../app/javascript/vendor/README.md))

### Tests

- **Karma:** 34 specs in `spec/javascripts/angular/`; loads all three Angular bundles + `angular-mocks`
- **Playwright:** `angular_pages*.spec.ts`, `angular_case_helpers.ts`, baselines; also `core_smoke`, `popover_visibility`, `modal_a11y`, `case_header_typography`
- **Rails:** `core_controller_test.rb`, `tls_flow_test.rb`, `user_invite_flow_test.rb`

### Stray Angular markup

`app/views/users/invitations/edit.html.erb` — `ng-href="{{ termsAndConditionsUrl }}"` on non-core layout (inert today). Replace with ERB URL.

### Angular core HTTP patterns (legacy)

The core case UI at `/case/...` still uses AngularJS `$http`. **Do not copy these patterns on new Rails pages** — see [DEVELOPER_GUIDE § Stimulus HTTP conventions](../../DEVELOPER_GUIDE.md#stimulus-http-conventions).

| Concern | Pattern |
|---------|---------|
| API paths | Relative `api/...` (no leading slash), e.g. `$http.get('api/cases/' + caseNo)` |
| CSRF | Automatic via `ng-rails-csrf` (`interceptors/rails-csrf.js`) for URLs containing `api/` |
| Navigation / subpaths | `caseTryNavSvc.getQuepidRootUrl()` — never `$window.location.href = '/'` |
| Route param | Cases use `:case_id` in `config/routes.rb` |

```javascript
$http.delete('api/cases/' + caseNumber)
$http.post('api/import/ratings?file_format=hash', data)
$window.location.href = caseTryNavSvc.getQuepidRootUrl() + '/cases'
```

**Endpoint catalog:** OpenAPI at `/api/docs` (not a hand-maintained list). Domains hit from Angular: cases, tries, queries, ratings, snapshots, scorers, teams, books, judgements, search endpoints, annotations, export/import. `CoreController` syncs wizard params server-side.

**Migration targets** (promote from `deangularjs-experimental`):

- [ ] Adopt `app/javascript/api/fetch.js` (`apiFetch`, `getCsrfToken`) and `app/javascript/utils/quepid_root.js`
- [ ] Add `quepid_root_url`, `data-quepid-root-url`, Turbo query routes, server-side import page URLs
- [ ] Prefer server-passed URLs over client-built paths (e.g. bulk judge builds `books/{id}/judge/bulk/...` in JS today)

---

## Removal checklist

### JavaScript

- [ ] `app/assets/javascripts/` (entire tree)
- [ ] `app/javascript/angular_app.js`, `quepid_app.js`, `splainer_search_adapter.js`
- [ ] `app/javascript/vendor/angular-*`, `ng-*`
- [ ] `app/assets/templates/`

### Built artifacts

- [ ] `app/assets/builds/angular_app.js`, `quepid_angular_app.js`, `angular_templates.js`
- [ ] Vendor CSS builds: `angular-json-explorer.css`, `angular-wizard.css`, `ng-tags-input*.css`

### Rails views

- [ ] `ng-app` and inline bootstrap from `core.html.erb`
- [ ] Angular attrs from `core/index.html.erb`, `_header_core_app.html.erb`
- [ ] Angular vendor CSS from core layout

### Build & deps

- [ ] `build_angular_app.js`, `build_templates.js`, angular yarn scripts
- [ ] `angular`, `angular-mocks` from `package.json`
- [ ] Angular steps in `build_css.js`, `audit_css.js`, `renovate.json`

### Tests

- [ ] `spec/javascripts/angular/`, Karma bundle entries
- [ ] `test/playwright/angular_pages*`, baselines
- [ ] Rewrite Playwright specs that assume Angular DOM

### Misc

- [ ] Stray `ng-href` in invitations edit view
- [ ] `bootstrap5-compat.css` Angular-only shims
- [ ] Shared `apiFetch` / `quepid_root.js` promoted from `deangularjs-experimental` (see [Angular core HTTP patterns](#angular-core-http-patterns-legacy))

---

## Definition of done

1. No `angular`, `angular.module`, or `ng-*` / `ui-*` template directives in the repo
2. No `angular` / `angular-mocks` in `package.json`
3. `core.html.erb` loads no Angular bundles
4. `/case/*` works on Stimulus/Hotwire (or equivalent) with same functionality
5. Karma and Playwright pass without Angular bundles or mocks
6. `yarn build` succeeds with Angular steps removed

---

## Related docs

| Doc | Purpose |
|-----|---------|
| [docs/README.md](../README.md) | Documentation index and dedup rules |
| [event_bus_inventory.md](./event_bus_inventory.md) | `$broadcast` / `$emit` map |
| [QUEPID_FEATURES.md](./QUEPID_FEATURES.md) | App-wide feature inventory |
| [QUEPID_COREUI_FEATURES.md](./QUEPID_COREUI_FEATURES.md) | Case UI feature deep dive |
| [core_ui_implementation_reference.md](./core_ui_implementation_reference.md) | Case UI deep internals (quirks, edge cases) |
| [todo.md](./todo.md) | Open bugs on `main` (backend/hardening); obviated Angular items cross-link here |
| [DEVELOPER_GUIDE](../../DEVELOPER_GUIDE.md#stimulus-http-conventions) | Stimulus fetch / URL conventions |

# AngularJS removal: inventory & migration plan

Single reference for **what** AngularJS owns in Quepid, **why** to migrate, **how** to do it incrementally (the path in progress today), how the **live query/search/score state** — the case workspace's core and the largest remaining piece — gets replaced as the committed final phase, and **what to delete** when done.


Quepid’s frontend is split in two:

| Surface | Stack | Entry |
|---------|-------|-------|
| **Core case UI** | AngularJS 1.8 SPA (queries, ratings, Solr JSONP) | `app/views/layouts/core.html.erb`, `QuepidApp` |
| **Rails pages** | ERB + Stimulus (+ Turbo Streams in places) | teams, books, scorers, cases index, home, admin, … |

- **Removal is complete, not partial** — every Angular file is scheduled to go, including `queriesSvc` and live search/scoring. - **Sequencing, not scope:** chip away at isolated, lower-risk pieces first (toolbar Stimulus twins, management modals, heavy widgets); live query/search/score state is sequenced **last** because it's the highest-coupling, highest-regression-risk code.

Backend stays on any path: Rails 8.1, existing models/services, MySQL, Solid Queue/Cable, REST API (`oas_rails` — extend, don't restart). **`splainer-search` 3.x is already vanilla ESM**.

See also: [App structure](../app_structure.md), [Vendor README](../../app/javascript/vendor/README.md), [DEVELOPER_GUIDE](../../DEVELOPER_GUIDE.md), [event bus inventory](./event_bus_inventory.md) (re-run before deleting `$broadcast` emitters).

---

## Executive summary

AngularJS 1.8 powers the **core case UI** at `/case/:id` and `/case/:id/try/:try_number`. Everything else already runs on Rails + Stimulus.

| Category | Count (on disk) |
|----------|-----------------|
| Angular JS source files (`app/assets/javascripts`) | 118 files, 113 register `angular.module` |
| HTML templates (components + `app/assets/templates`) | 34 (21 component + 13 under `app/assets/templates`) |
| Controllers | 39 (`.controller()` registrations; 18 files under `controllers/`) |
| Services | 26 (`.service()` registrations; 27 files under `services/` — `quepidModalSvc.js` registers a factory) |
| Factories | 8 |
| Filters | 8 under `filters/` (+ 1 directive-local: `plusOrMinus`) |
| Custom directives / components | 27 (21 `.directive()` + 6 `.component()`) |
| `QuepidApp` module dependencies (excl. `UtilitiesModule`) | 10 |
| Vendored Angular libraries (`app/javascript/vendor`) | 6 packages (+ `angular` core from npm) |
| Karma unit specs (`spec/javascripts/angular`) | 38 |
| Vitest unit specs (`test/javascript/**/*.test.js`) | 51 |
| Playwright specs (`test/playwright/*.spec.ts`) | 24 |

---

## What actually needs to change

| Priority | Item | Notes |
|----------|------|-------|
| **P0** | AngularJS 1.8.3 EOL | 118 JS files, 34 templates on the core case UI (see [Executive summary](#executive-summary)) — no patches since Dec 2021 |
| **P0** | `queriesSvc` god object (1,690 lines) | Query state, search, scoring, book sync, positions via `$rootScope.$broadcast` |
| **P0** | `eval()` scorers | Inside `$timeout()`, no sandbox; Web Worker timeout commented out |
| **P1** | Scorer dual-execution drift | `ScorerFactory.js` (client) vs `scorer_logic.js` (server) — client API is richer |
| **P1** | `new Function()` mappers | SearchAPI mappers; MiniRacer on server; mapper wizard already Stimulus |
| **P2** | Digest workarounds | Version counters / sentinels instead of clear data flow |
| **P2** | Copy-paste debt | e.g. `ctrl.cancel = function () { $quepidModalInstance.dismiss('cancel'); }` repeated 12x across modal-instance controllers |
| **Defer** | jQuery pane resize | Narrow scope (`toggleEast`, layout polling) — migrate with case page, not a driver |
| **Defer** | `bootstrap5-compat.css` | Largely done; tuning shims, not a rewrite gate |

## Critical complexity inventory

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

## Decision lenses

The questions that must be answered before the [live query-state phase](#live-query-state-phase-committed-final-phase) starts, not whether it happens. **Signed off 2026-09-19:**

| Lens | Question | Decision |
|------|----------|----------|
| **Search/IR domain** | Does live tuning still search customer engines from the browser (proxy when needed)? Does batch eval stay on `FetchService`? | **Confirmed.** Live search stays browser → customer engine; batch stays server-side on `FetchService`. |
| **UX fidelity** | Does rating still feel instant? (Today: client `scoreAll()` on every rating — not negotiable.) | **Confirmed.** Client `scoreAll()` on every rating stays non-negotiable. |
| **Security** | What replaces browser `eval()` for scorers? (Web Worker — not server-only scoring.) | **Deferred.** Keep `eval()` as-is for the live-query-state phase; do not block the rewrite on building the Web Worker sandbox. Revisit as a follow-up once the rewrite ships — this is a known open risk, not a closed one. |
| **Performance** | Large cases (1,000+ queries): `scoreAll()` is O(n queries) today — framework change alone doesn't fix that. | Not separately decided — no perf target set; carry current behavior forward, don't regress it. |
| **A11y** | Scores can't be color-only; real ARIA on badges and rating controls. | Do it. |
| **Re-render** | Angular's digest repaints `queriesCtrl` / `searchResults` / `qscore-*` on a rating. What replaces it? | **Confirmed 2026-09-22.** A plain-JS observable store (`EventTarget`) owns query/score/rating state; Stimulus controllers subscribe and write to the DOM directly. No reactive framework; no Turbo Streams for score or document state. See [Re-render mechanism](#re-render-mechanism). |

---

## How to migrate

### Port checklist (mandatory)

Removing Angular on **core** means **equivalent** behavior and appearance to what Angular shipped on `/case/:id` — using Hotwire/Stimulus/vanilla/Rails as appropriate. It does **not** mean:

- Replacing Rails page UX with Angular UX (cases index, teams, …).
- Collapsing core and Rails into one partial when they differed.

Before markup or controller work:

1. **Name the surface** (core case page vs cases index vs teams vs …).
2. Read that surface’s **actual** pre-migration sources:
   - Core: Angular template + controller (`git show …:app/assets/javascripts/components/<name>/…`).
   - Rails pages: HEAD partial + Stimulus controller (`git show HEAD:app/views/shared/…`, `git show HEAD:app/javascript/controllers/…`).
3. Fill a **parity table per surface** (interaction, visibility, footer, transport, events).
4. If surfaces differ, use **separate controllers/partials** (e.g. `share-case` vs `share-case-core`) — surface locals alone are not enough when UI differs; split markup when appearance differs.

**Done requires:** per-surface parity · tests · matched screenshots **on that surface** · inventory updated.

**Collapse anti-pattern (share-case):** one list-group `_share_case_modal` everywhere — Angular-equivalent on core but **changed** cases index/teams away from `<select>` + always-visible disabled footers. Conversely, putting the old `<select>` partial on core **changed** the case toolbar away from Angular.

Agents: `angular-case-migration` skill (`.claude/skills/angular-case-migration/SKILL.md`).

### Category playbooks

Use the class that matches the work. Details and phase checklist live in the skill; this section is the human/agent map.

| Class | Examples | Do | Don't |
|-------|----------|----|--------|
| **Management modals** | share, clone, export, delete/archive | **Per surface:** core matches Angular; Rails pages match their prior partial; split UI when they differ | One modal UX everywhere; Angular UX on index/teams; Rails `<select>` on core toolbar |
| **Heavy widgets** | diff, import-ratings, export+job, wizard | Inventory jobs/Cable/multi-step UI; esbuild or large Stimulus; step screenshots | Block on rewriting `queriesSvc` |
| **Live query state** | `queriesSvc`, search results, ratings, live score | Explicit state plan; dual-run read path first; keep client `scoreAll()` + browser→engine search | Start casually; move live search/score server-side as a “migration” |
| **App-level seams** | scorers, splainer-search, TLS/JSONP, mappers | Port with the UI that needs them; reuse `splainer-search` 3.x ESM | Rebuild search/scoring stacks from scratch without a fork decision |

### Difficulty scoring

Use when sizing a PR:

- **Coupling** — Touches live query/search/rating state (`queriesSvc`, `$scope` trees)?
- **Scope** — JS size and number of templates.
- **Replacement ready?** — Stimulus / vanilla pattern already on Rails pages? (**Ready ≠ identical UX** — still port Angular.)
- **Infrastructure** — Safe to remove only after dependents are gone?

### Remaining PR order

Everything left routes through the [live query-state phase](#live-query-state-phase-committed-final-phase): `queriesCtrl` / `queriesSvc` / `searchResults` and the scoring/diff/import stacks — not skipped, but gated on that phase's state plan being signed off before any code starts.

Prefer **Rails view + route + Hotwire/Stimulus** for management actions over embedding new Stimulus inside the Angular bundle.

### Live query-state phase (committed, final)

Keep the existing Rails backend and API — this phase replaces the Angular case-workspace **frontend** only, not the domain model or API. It starts once the [decision lenses](#decision-lenses) above are answered and its state plan is signed off.

Hotwire already covers most non-case pages (teams, books, scorers, admin). The case workspace is one route but **most of the product value**, which is why it's sequenced last.

```
┌──────────────────────────────────────────────┐
│     Rails 8 (existing)                       │
│  Models · Services · Solid Queue · API       │
│  oas_rails (extend) · MySQL · Solid Cable    │
└──────────┬───────────────────┬─────────────┘
           │                   │
  ┌────────┴────────┐  ┌───────┴──────────────┐
  │ Hotwire pages   │  │ Case workspace       │
  │ (already live)  │  │ Stimulus + vanilla   │
  └─────────────────┘  │ esbuild bundle       │
                       │ splainer-search 3.x  │
                       └──────────────────────┘
```

**UI stack: Hotwire/Stimulus + vanilla JS**. Bundle with **esbuild** (same as `build:angular-vendor` today) — importmap is for Stimulus pages, not a heavy case workspace.

See [Re-render mechanism](#re-render-mechanism) for the client/server state boundary.

**Search:** Live `searchAll()` stays **client → customer engine** (Quepid proxy for CORS/auth). Server-side fetch is already the **batch** path (`FetchService` / `RunCaseEvaluationJob`) — don't conflate the two.

**Scoring:** **Client-side** on the case page (rating/search/diff). MiniRacer for batch only. Consolidate drift via a **shared npm scorer package** (one helper implementation, browser + `lib/scorer_logic.js`) — not server-only scoring.

**API:** Extend existing REST endpoints and `oas_rails` docs; the Angular app is already an API client.

**Not in scope for a UI rewrite:** domain model redesign, OpenAPI-from-scratch, moving live search or live scoring server-side.

### Core toolbar

The toolbar is server-rendered from `@case`/`@try` (`app/views/core/_case_toolbar.html.erb`). Still Angular *inside* it: `<diff>` and `<import-ratings>` — both deferred with the rest of the heavy case state.

**The toolbar keeps `ng-if="caseModel.caseLoaded()"`, and it is load-bearing.** Its attributes no longer need Angular, but several of its actions do: "Create snapshot" clicked before `queriesSvc` has bootstrapped posts an empty snapshot that never resolves, leaving the modal stuck on "Snapshot Being Created". Server-rendering made the toolbar clickable from first paint, roughly 1.5s earlier than Angular exposed it, which is long enough to hit. Drop the gate only when `<diff>`, `<import-ratings>` and the snapshot/export flows no longer depend on live query state.

### Stimulus twins already on Rails pages

Reuse these instead of reimplementing modals/flows:

| Stimulus controller | Typical usage |
|---------------------|---------------|
| `share-case` / `share-case-core` | Index/teams: `share_case_controller` + `_share_case_modal`. Core toolbar: `share_case_core_controller` + `_share_case_core_modal` via `core_stimulus.js`. **Core deltas vs Angular:** stays open after share/unshare with an inline alert (multi-team work; Angular closed + global flash); "Create a team" goes to `new_team_path` (Angular used `/teams`). Rails index/teams unchanged. |
| `delete-case-options-core` | Core toolbar only (no Rails-page twin — cases/teams archive/delete already use `confirm-delete`). `delete_case_options_core_controller.js` + `_delete_case_options_core_modal.html.erb` via `core_stimulus.js`; three-way choice (archive / delete case / delete all queries) via `submitDestructiveForm`. |
| `clone-case-core` | Core toolbar only (no Rails-page twin). `clone_case_core_controller.js` + `_clone_case_core_modal.html.erb` via `core_stimulus.js`. **Delta vs Angular:** stays open with an inline alert on failure (same delta as `share-case-core`). |
| `export-case-core` | Core toolbar only (no Rails-page twin). `export_case_core_controller.js` + `_export_case_core_modal.html.erb` via `core_stimulus.js`. **Matches Angular:** modal always closes on Export before the download starts (no inline alert, unlike the stay-open pattern above). **Intentional delta vs Angular:** Export stays disabled for the `snapshot` format until a snapshot is actually chosen from its dropdown — Angular let you click Export with nothing chosen, which then failed inside `querySnapshotSvc.get(undefined)` with no user feedback; the new guard prevents that dead-end instead of reproducing it. **Bridge, not final:** the `detailed` format needs live search results still held in Angular `queriesSvc`, so it dispatches a `document` CustomEvent (`export-case:detailed`) that `caseCSVSvc.js` still listens for — resolves when `queriesSvc` migrates (see [live query-state phase](#live-query-state-phase-committed-final-phase)). |
| `pick-scorer-core` | Core toolbar only. `pick_scorer_core_controller.js` + `_pick_scorer_core_modal.html.erb`. Lists scorers from `api/scorers`, saves via `PUT api/cases/:id/scorers/:id`, then dispatches `pick-scorer:selected` so Angular `scorerSvc`/`queriesSvc` can rescore live queries. |
| `take-snapshot-core` | Core toolbar only. `take_snapshot_core_controller.js` + `_take_snapshot_core_modal.html.erb`. Collects name/options; dispatches `take-snapshot:create` so Angular `querySnapshotSvc.addSnapshot` can build the live-query payload. |
| `judgements-core` | Core toolbar only. `judgements_core_controller.js` + `_judgements_core_modal.html.erb`. Book link + sync settings via case/books APIs; `judgements:populate-book` / `judgements:queries-need-reload` / `judgements:book-settings-saved` bridges for live query state. |
| `case-rename` | Core case header only. `case_rename_controller.js` + `app/views/core/_case_header.html.erb`, inside a `case_header` Turbo Frame served by `Core::CaseHeaderController`. Double-click to edit, Rename posts to Rails and re-renders the frame, Cancel restores. **Matches Angular**, with one deliberate addition: the field takes focus on open (it did not before), which the A11y decision lens asks for. It focuses without selecting, so the first keystroke still extends the name rather than replacing it. |
| `case-toolbar` | Core case toolbar only. `case_toolbar_controller.js` + `app/views/core/_case_toolbar.html.erb`. Not a modal — it only bridges the header to the Angular services that still run the page: `case-header:renamed` → `caseSvc` and `case-header:try-renamed` → `settingsSvc` on a frame render, and inbound `quepid:case-renamed` so a rename made *by* Angular (the wizard) reaches the server-rendered header. Mounted on the always-present `#case-actions` wrapper, not the `ng-if` gated div, so it is never torn down mid-rename. It deliberately does **not** copy the case name onto the modal triggers — see `utils/case_header` below. |
| `utils/case_header` (helper, not a controller) | `caseNameFromHeader()` reads the name out of the `case_header` frame. The five core modals (share, clone, delete, export, judgements) call it when they open instead of carrying a `data-*-name-value` copy. One source of truth means nothing to resynchronise after a rename, and an `ng-if` rebuild of the toolbar cannot reinstate a stale name. |
| `rating-popover` | Per-result and score-all rating UI. Shell is Stimulus; `doc.rate()` / `resetRating()` / `scoreAll()` still run in Angular via `rating-popover:rate` / `:reset`. |
| `share-book`, `share-scorer`, `share-search-endpoint` | Shared modals under `app/views/shared/` |
| `import-case`, `import-snapshot` | Shared modals |
| `confirm-delete` | Archive / delete / unarchive (cases, teams, books, search endpoints, members) |
| `invite`, `team-member-autocomplete` | Team invite / membership |
| `bulk-judgement`, `mapper-wizard` | Book LLM judge; mapper wizard |
| `document-fields-modal`, `scoring-guidelines`, `scorer-scale` | Books / scorers forms |
| `bs-tooltip`, `text-paste` | BS5 tooltips on Rails pages; paste-to-textarea (shared util with Angular add-query) |
| `confetti`, `prompt-form`, `user-activity` | Judgement celebration; prompts; admin charts |

Controllers: `app/javascript/controllers/` · entry: `app/javascript/application_modern.js`

**Shared migration primitives (Rails pages today; reuse on case workspace):**

| Module | Path | Notes |
|--------|------|-------|
| `apiFetch` / `getCsrfToken` | `app/javascript/api/fetch.js` | CSRF-aware JSON fetch (Vitest-covered) |
| `getQuepidRootUrl` | `app/javascript/utils/quepid_root.js` | Subpath-safe root from `data-quepid-root-url` |
| CodeMirror 6 editor | `app/javascript/modules/editor.js` | Candidate `ui-ace` replacement for wizard / dev pane |
| BS5 tooltip / popover / paste | `utils/bs_tooltip.js`, `utils/bs_popover.js`, `utils/text_paste.js` | Static icons use the `bs-popover` Stimulus controller; Angular call sites use shared DOM helpers through `window.quepidDom` |
| Core Stimulus entry | `app/javascript/core_stimulus.js` | Controllers without Turbo; loaded from `core.html.erb` |

New Stimulus logic in `app/javascript/api/` or `utils/` needs a `*.test.js` under `test/javascript/` (Vitest, mirroring the source path — not colocated). See [`js_tooling.md`](../js_tooling.md).

### Full removal order (after incremental PRs)

When replacing the case SPA (not just toolbar actions), work in dependency order:

`MainCtrl` stays Angular-authored — it still calls `caseSvc`/`settingsSvc`/`queriesSvc` (next up below) — but is no longer route-triggered; see [Application shell](#1-application-shell). `CaseCtrl` is reduced to what the still-Angular drawer and `<import-ratings>` need.

**Turbo is loaded on `core`** (`core_stimulus.js`), for Frames and Streams only. `Turbo.session.drive = false` is set there for the same reason it is set in `application_modern.js`, and it matters more here: Angular runs `$locationProvider.html5Mode(true)`, so letting Drive intercept navigation would put two routers on one URL. Frames still work with Drive off, because Turbo treats anything inside a `<turbo-frame>` as navigatable regardless.

1. Shared primitives — `$quepidModal`, `quepidTypeahead`, `quepidCollapse`, CSRF fetch wrapper (tooltip/popover/paste utils already extracted; flash done via the Stimulus `flash` controller + `utils/flash.js`). **Not separable (checked 2026-09-19):** every remaining call site of all three lives inside a component already on the defer list (`$quepidModal`: `browse_query`, `query_options`, `new_case`, `annotation`, `diff`, `frog_report`, `import_ratings`, `move_query`, `wizardModal`/`wizardCtrl`, `queryParamsDetails`/`queryParamsHistory`, `targetedSearchModal`, `searchResult`, `case.js`; `quepidTypeahead`/`quepidCollapse`: `wizardModal.html`, `devQueryParams.html`, `searchEndpoint_popup.html`). They fall out as each of those components migrates in steps 4–7 below — don't plan a standalone PR for this step.
2. Services layer — `caseSvc`, `settingsSvc`, `queriesSvc`, `scorerSvc`, `ratingsStoreSvc`
3. Splainer — drop `$q` shim; use `splainer-search/wired.js` directly
4. Query list + results — `queries`, `search-results`, rating UI
5. Case action modals — import ratings, diff
6. Wizard — largest template; ACE, CSV, tags, tour
7. Tune Relevance pane — ACE, json explorer, try management
8. Cleanup — removal checklist below

### Hardest — sequence last, needs the state plan first

#### By file (LOC)

| Name | LOC | Why |
|------|-----|-----|
| **queriesSvc** | 1,690 | Central case state — search, docs, scores, persistence |
| **wizardModal** | 1,066 | Onboarding wizard (ACE, CSV, tags, tour) |
| **queriesCtrl** | 609 | Query list UX (sort, filter, paginate, keyboard) |
| **settingsSvc** / **caseSvc** | 754 / 552 | Try / case domain model |
| **$quepidModal** | 272 | BS5 modals + `$compile` — 11 `.open()` call sites (23 files reference `$quepidModal`) |
| **ScorerFactory** | 666 | Scoring model + judgement math |
| **angular core** | — | Remove last |

**Component LOC** (all JS and HTML files in each component folder, easiest → hardest): new_case (74) → qscore_query (86) → qscore_case (101) → query_explain (117) → annotations (129) → query_options (137) → annotation (152) → add_query (180) → move_query (184) → browse_query (189) → qgraph (251) → frog_report (422) → diff (423) → import_ratings (674).

**Defer on the case workspace** (Solr JSONP, live state, or large modals): `searchResults` / `searchResult` / `queries`, `qgraph` / qscore\*, `diff`, `import-ratings`, `add-query`, `query-options`, `new-case` / wizard, `frog-report`, annotations, `quepidTypeahead`, `queryParams`, `quepidCollapse`. Moving these implies rebuilding the case SPA, not a framework swap.

#### `queriesSvc` seam inventory (phase 1)

22 Angular files reach into `queriesSvc`; the four `*_core_controller.js` Stimulus controllers reach it only through `document` CustomEvents (already bridged). Grouped by what a caller actually needs:

| Surface | Members | Callers |
|---------|---------|---------|
| **Read / display** | `queryArray`, `latestScoreInfo`, `version`, `hasUnscoredQueries`, `scoredQueryCount`, `queryCount`, `isBootstrapping`, `queries`, `showOnlyRated` | `queriesCtrl`, `frog_report`, `caseCSVSvc` / `utils/case_csv.js`, `querySnapshotSvc`, `queryDiffResults` |
| **Mutation / lifecycle** | `bootstrapQueries`, `changeSettings`, `searchAll`, `createQuery`, `persistQuery(ies)`, `deleteQuery`, `moveQuery`, `updateQueryDisplayPosition`, `reset`, `updateScores`, `scoreAll`, `refreshAllDiffs`, `syncToBook` | `mainCtrl`, `wizardModal`, `add_query`, `move_query`, `searchResults`, `diff`, `import_ratings`, `query_options`, `caseSvc` |
| **Search / score engine** (`Query`) | `search`, `searchFromSnapshot`, `paginate`, `ratedPaginate`, `score` / `scoreOthers`, `refreshRatedDocs`, `setDocs`, `filterToRatings`, plus svc-level `createSearcherFromSettings`, `normalizeDocExplains`, `searchApiRatedDocs`, `pAll`, mapper `eval` | `docFinder`; otherwise internal |

**Framework-free today (extract ahead of any UI decision):** `pAll`, `evaluateMapperFunctions` + cache, `matchFeaturesExplain`, `settingsWithTryOverrides`. These keep the same signatures under any target stack, so extracting them to tested ESM under `app/javascript/` is not a bet on the UI framework. Wiring already exists — `utils/*.js` → `quepid_dom.js` → `window.quepidDom`, with `build:angular-vendor` passing `--alias:utils=./app/javascript/utils`.

**`static` is normalized to `solr` by mutation.** `createSearcherFromSettings()` assigns `passedInSettings.searchEngine = 'solr'` for a static engine, and `Query.search()` passes `currSettings` uncopied — so the rewrite persists on the service until the next `changeSettings()`. It is load-bearing: `Query.search()` builds `ratedSearcher` with `filterToRated: true` on every search, and `filterToRatings()` has no `static` branch, so without the rewrite a static case pushes `undefined` into `fq`. The rewrite reaches only the settings-level copy — `selectedTry.searchEngine` stays `static`, which is why `trySupportsRatedDocsLookup()` (read off the try) correctly leaves "Show only rated" disabled for static cases. Extractions must normalize `static` → `solr` at the searcher/filter seam **only**, never in the capability predicates, or the toggle silently turns on. No Karma or Vitest example covers a static engine.

**Contract to port from:** `spec/javascripts/angular/services/queriesSvc_spec.js` (1,258 lines) — notably `createSearcherFromSettings` (Solr `echoParams`, `jsonQueryDsl`, `fq` vs `filter` ratings filter), the query factory scoring/doc-state examples, and bootstrap/add/delete/move versioning. Port per skill phase 3 before deleting Angular sources.

#### Re-render mechanism

Angular's digest is what repaints `queriesCtrl` / `searchResults` / `qscore-*` when a rating changes. Stimulus supplies no reactivity, so the replacement is explicit. **Decided 2026-09-22** (see [decision lenses](#decision-lenses)).

**Ownership decides the mechanism.** Server-owned state re-renders through **Turbo Frames**; client-owned state re-renders through a **client store + Stimulus**. The case header is a Frame because Rails owns the case name. Scores and documents fail that test: live search is browser → customer engine and the server never sees the documents, so it has nothing to render from. **Turbo Streams are not available for score or document state** — this is a data-ownership fact, not a preference, and it does not reopen the search/IR or UX-fidelity lenses.

**Mechanism:** a plain-JS observable store built on `EventTarget` owns query/score/rating state. Stimulus controllers subscribe and write to the DOM directly. No reactive framework (React/Vue/Alpine/signals) and no bespoke reactivity layer — if the store grows a template syntax or a dependency graph, it has failed. Use the **Stimulus Values API + `xValueChanged()`** for display scalars (score, rating, max), as `rating_popover_controller.js` already does; keep data out of `data-*` attributes — never serialize a doc list into one.

**The reactive surface is small and enumerable.** `ratingsStoreSvc.markDirty()` → `rating-changed` → the rated doc's badge (`ratingBgStyle`), the per-query score (`qscore_query.html`, 7 lines), the case score and label (`qscore_case.html`, 19 lines), `isNotAllRated` / `getNumFound()`, and diff scores when enabled. Four numbers and a background colour — the digest re-evaluates the world, the actual delta does not justify a framework.

**This removes digest workarounds rather than porting them.** The version counters (`svcVersion`) and the 100 ms debounce in `queriesCtrl` exist because the digest offers no change notification. An explicit store with real change events deletes them — one reason to prefer it over any mechanism that reintroduces implicit invalidation.

**Do not scope `scoreAll()` in the same change.** One rating rescores every query today; the performance lens says carry that forward. An explicit store makes per-query scoping possible later, but taking it here ships an unapproved behaviour change and makes any score discrepancy unattributable.

**Remaining, in slice order (2026-09-22).** Score rendering (qscore badges, case score) shipped dual-run, and the canonical score publication path is now covered end-to-end. `queriesSvc.scoreAll()` publishes the complete score map for ratings and scorer changes; a newly added query reaches it the same way, via the `updateScores()` call that already follows `searchAndScore()` in `add_query_controller.js` — `searchAndScore()` itself does not call `scoreAll()` directly, since that caller always triggers a full rescore of its own moments later and calling `scoreAll()` from both places only coupled a new query's success/failure to every other query's scoring outcome. The Playwright contract covers rate → per-query score → case score → badge. The score-adjacent `rating-changed` and `scoring-complete` events now publish through `CaseScoreStore`, with Angular compatibility listeners retained while the old consumers remain. The query-list toolbar controls (rated-only, collapse-all, filtering, and sort state/actions) and SortableJS drag lifecycle now render or run through `queries-list` Stimulus and bridge semantic events back to `QueriesCtrl`; the existing Angular pagination control remains in place for behavior parity. Next:

1. **Extract remaining framework-free query-state helpers** ahead of the UI they feed — `querqyRuleTriggered()`, hit-count/state helpers, rated-doc cache invalidation, query display-position calculation, pagination/filter predicates. The first set now lives in `app/javascript/utils/query_state.js`, is exposed through `window.quepidSearch.queryState`, and is covered by Vitest while Angular consumes it.
2. **Finish query-row rendering and query-list controls.** The read-only header rendering now lives in `query-row-controller.js`, including state/diff classes, result count/label, Querqy marker, toggle caret, and image-vs-text query display. The toolbar and drag lifecycle now live in `queries-list-controller.js`; pagination remains on the proven Angular directive until a parity-focused replacement is worthwhile.
3. **Migrate search-results rendering**, preserving the client-owned search/rating state and the Angular bridge for mutations not yet moved.
4. **Migrate query mutations last** — add, move, delete, and persist — matching the [decision lenses](#decision-lenses) ordering (search/score stay client-owned throughout; nothing here moves them server-side).

The diff/snapshot score badges stay Angular until `diffResultsSvc` migrates — out of this sequence.

**The `window.quepidStore` bridge is temporary.** It exists so `queriesSvc` (still Angular) can push into a store that Stimulus (not yet the page owner) can read, during dual-run. Once the case workspace has its own entry bundle, the global goes away in favor of a module import — don't grow further ad hoc bridges on `window.quepidStore` as if it were the permanent integration point.

**`setLatestScoreInfo()` replaces the whole score map, on purpose — for now.** It mirrors `scoreAll()` rescoring every query on every rating (see "Do not scope `scoreAll()`" above). If a later slice adds a partial-update path (e.g. scoping to one query), give it its own method name rather than overloading `setLatestScoreInfo()` with a partial payload — subscribers currently assume a full replace on every `change` event, and a silent partial write would reproduce the class of staleness bug this store exists to avoid.

**Test obligations.** Testability without a browser is a condition of this choice, not a bonus: a digest is untestable in Vitest, an `EventTarget` store is not. Every rating-driven update needs a Vitest example asserting the subscriber fired, plus Playwright coverage of the composite (rate a doc → badge, per-query score **and** case score all move). The failure mode to design against is silent staleness from a missed subscription — the "Show only rated" stale-list bug above is that class of bug in the current code. `core_smoke.spec.ts`'s "rating updates the query score, case score, and rating badge" test satisfies the Playwright half of this for the qscore slice.

#### App-level (port seams; don't rebuild)

**Scoring runtime** — Custom JS scorers expose an ~18-function API. `ScorerFactory.js` and `scorer_logic.js` already drift (client has helpers the server lacks). **Direction:** shared npm package with an explicit canonical API and a scorer migration guide — not server-only scoring; every rating triggers client `scoreAll()` today.

**Search engine coupling** — **Still hard:** Quepid-specific seams — snapshot fake-Solr, proxy/basic auth, TLS protocol switching, SearchAPI mapper code — must port with any case UI work.

#### UI-level (reimplement on any framework)

1. **Concurrent search pool** — Client `pAll()` with ≤10 workers, dual-phase progress (search then score), rate-limit delays. **Reimplement on the client.** Batch evaluation already has a separate server path — moving live search server-side adds latency and routes customer traffic through Quepid workers without fixing Solr JSONP → HTTP case-page constraints.

2. **Scorer sandboxing** — Replace `eval()`. **Direction:** Web Worker (docs + scorer code in, score out). Budget for `scoreAll()` calling the worker per query per rating unless the flow is redesigned. MiniRacer stays for batch paths only.

3. **Multi-snapshot diff + scoring** — ≤5 snapshots, snapshot-as-searcher, client `scoreOthers()`, per-position diff, case averages. `diffResultsSvc.js` is ~225 lines but sits on fake-Solr snapshots and rating-driven refetch — line count understates the work.

4. **Angular templates → target syntax** — 34 templates (`ng-repeat`, `ng-if`, `ng-model`, `dir-paginate`, `quepid-sortable`, `ui-ace`, …) become ERB partials plus Stimulus targets, with store subscriptions doing the updates Angular's bindings did (see [Re-render mechanism](#re-render-mechanism)).

5. **Field spec parsing and display** — `id:id title:name …` — type detection (JSON / URL / text), thumb prefixes, media by extension, snippet `<strong>` wrapping. Domain logic in splainer-search + Quepid display code, not framework glue.

### Open bugs & UX (address during migration)

Playwright MCP–verified issues on the core case UI. **Do not patch in AngularJS** — fix when migrating the owning surface (see [todo.md § Obviated](./todo.md#obviated-by-angular-removal-do-not-fix-in-angular)).

#### Try delete bricks case on reload

**Observed:** After deleting the latest try, reload shows *"Cannot read properties of null (reading 'tryNo')"* until DB repair.

**Frontend cause:** `settingsSvc.editableSettings()` still assumes `selectedTry` is non-null (`settingsSvc.js:513-519`, `tryToUse.tryNo` with no guard, even though the file has a working `isTrySelected()` at `:440` it doesn't reuse). Try delete still has no confirm.

**Fix during migration:** Fall back to the newest try when `selectedTry` is null; confirm before try delete.

**Backend still required:** `Api::V1::TriesController#destroy` must recompute `cases.last_try_number` — tracked in [todo.md § P0 backend](./todo.md#deleting-the-latest-try-bricks-the-case-backend).

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

#### "Show only rated" serves a stale list after a new rating

**Observed:** Toggle "Show only rated" on and off, rate a document, then toggle it on again — the rated list is whatever it was on the first toggle, so a just-rated doc is missing. A reload fixes it.

**Cause:** `toggleShowOnlyRated()` only calls `query.refreshRatedDocs()` when `!query.ratingsReady`, and `refreshRatedDocs()` sets `ratingsReady = true` permanently — nothing clears it when a rating changes, so the rated-doc fetch never re-runs.

**Fix during migration:** Invalidate the rated-docs cache on rating change (the `rating-changed` path that already triggers `scoreAll()`), rather than gating the refetch on a one-shot flag.

**Touches:** `queriesSvc` `toggleShowOnlyRated` / `refreshRatedDocs` / `ratingsReady`, [live query-state phase](#live-query-state-phase-committed-final-phase).

---

## Traps found while server-rendering the case header

These cost real debugging time and will recur as more of the page moves to Rails.

**Duplicating server state onto DOM attributes buys you a synchronisation problem.**
The first cut stamped the case name onto five modal triggers as `data-*-name-value` and kept them
in step with a frame-render handler and a capture-phase click repair. All of that existed so five
modal titles and one download filename showed the current name. Reading the name from the header
when the modal opens deletes the copies, the sync, and the repair. Prefer one live source over
several copies with a reconciler, especially when the copies are only read at a single moment.

**A `$scope` function returning a fresh object literal is an infinite digest waiting to happen.**
`CaseCtrl.caseModel.selectedCase()` returned `{ caseNo: -1, caseName: '' }` on every call before the
case loaded. `<import-ratings>` binds it with `=`, so a new object identity each digest is a change
each digest. Angular's template had hidden this behind `ng-if="caseModel.caseLoaded()"`; rendering
the toolbar unconditionally exposed it as `$rootScope:infdig`. Return a single stable instance.

**A scope whose body ends in `.first` returns the relation when there is no record.**
`Try.latest` was `scope :latest, -> { order(id: :desc).first }`. Rails returns the record when there
is one and falls back to the *relation* when the body is nil, so a case with no tries yielded an
`AssociationRelation` and `@try.try_number` raised `NoMethodError`. Nothing noticed until a view
actually read `@try`. It is a class method now.

**A fire-and-forget request before a navigation gets aborted.**
The wizard issued the case-rename `PUT` after `settingsSvc.update()`, which ends in a real
`$window.location.assign`. The browser cancelled the rename often enough that the case kept its
scratch name — visible in a Playwright trace as a request with status `-1`. The rename runs first
and is awaited now. Worth remembering generally: anything Angular fires near `caseTryNavSvc`
navigation needs to be awaited, not just started.

## Where Angular is mounted

### Rails routes (`config/routes.rb`)

- `GET /case/:id(/try/:try_number)` → `core#index` (`case_core`)
- `GET /cases/new` → `core#new` (`case_new`)
- `GET /case` → `core#index`

The Rails cases index at `/cases` is **not** Angular.

### Layout and bootstrap (`app/views/layouts/core.html.erb`)

- `<body ng-app="QuepidApp">`
- JS: `angular_app`, `angular_templates`, `quepid_angular_app`
- CSS: `json-explorer` (Quepid-owned), `angular-wizard`, `ng-tags-input`
- Inline script: `bootstrapSvc.run()`, `configurationSvc` seeded from Rails config — including `caseNo`/`tryNo` from `params[:id]`/`params[:try_number]`/`@case`. Interpolate as bare integers/`"null"`, never `.to_json` — Rails' default HTML-escaping of `<%= %>` mangles `"`/`&` inside a `<script>` tag (`"1"` → `&quot;1&quot;`), silently breaking the whole inline script.

### Case shell (`app/views/core/index.html.erb`)

Flash include, `LoadingCtrl`, `ng-controller="MainCtrl"` wrapping the case layout **rendered as ERB**.

The layout lives in ERB, not an Angular template, because the header and toolbar read `@case`/`@try`: templates under `app/assets/templates` are compiled into the `angular_templates` bundle and cannot contain ERB.

Angular still compiles what is left, because custom elements inside `ng-app` are compiled at bootstrap like any other markup. What remains Angular in the shell:

| Element | Why it stays |
|---------|--------------|
| `<qgraph>` | Score history chart; reads live off `MainCtrl`'s scope |
| `<qscore-case>` (diff/snapshot usage only) | Snapshot scores come from `diffResultsSvc`; the primary badge is Stimulus |
| `<queries>` | The query list / search results island |
| `<diff>`, `<import-ratings>` | Not yet migrated |
| `ng-include 'views/_dev_settings.html'` | Tune Relevance drawer, still Angular |
| `ng-click="toggleDevSettings()"` | Drawer toggle, on `MainCtrl` scope |

**Keep `<qgraph>` and the diff `<qscore-case>` tags siblings of `<queries>` under the same `ng-controller`.** `<queries>` declares no isolate scope, so `QueriesCtrl` publishes `queries`, `maxScore`, `scores`, `annotations` and `getScorer()` onto `MainCtrl`'s scope — which is the only reason those bindings resolve. The primary case-score badge (`app/javascript/controllers/qscore_case_controller.js`) is a plain Stimulus-controlled `div` now, not an Angular element, but still lives at the same DOM position for `qscore.css`'s `:last-child`-based badge-spacing rules to apply correctly.

### `app/assets/javascripts/routes.js`

`$locationProvider.html5Mode(true)` + `$httpProvider` cache/header config only — no `$routeProvider`.

---

## Root module and dependencies

### `QuepidApp` (`app/assets/javascripts/app.js`)

| Module | Source | Used for | Replace with |
|--------|--------|----------|--------------|
| `ngSanitize` | `angular-sanitize` | `ng-bind-html` | DOMPurify or server sanitize |
| `mgo-angular-wizard` | `angular-wizard` | New-case wizard | Multi-step Stimulus or server wizard |
| `o19s.splainer-search` | `splainer_search_adapter.js` | Search HTTP | `splainer-search/wired.js` directly |
| `ui.ace` | `angular-ui-ace` | Query editors | Stimulus + `window.ace` |
| `angularUtils.directives.dirPagination` | `angular-utils-pagination` | Query paging | Stimulus pager |
| `ngCsvImport` | `angular-csv-import` | CSV upload | Papa Parse + file input |
| `ngTagsInput` | `ng-tags-input` | Wizard fields | Tom Select / tags Stimulus |
| `ng-rails-csrf` | `interceptors/rails-csrf.js` | CSRF on `$http` | Fetch wrapper with CSRF meta tag |
| `templates` | `build_templates.js` | `$templateCache` | ERB partials / Stimulus templates |
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
| Case layout markup | Rails view | `app/views/core/index.html.erb` + `_case_header`/`_case_toolbar` partials |
| App bootstrap & loading gate | controller | `LoadingCtrl` — `controllers/loading.js` |
| Case/try bootstrapping | controller | `MainCtrl` — `controllers/mainCtrl.js` |
| Current user on `$rootScope` | service | `bootstrapSvc`, `userSvc` |
| App config flags | service | `configurationSvc` |
| CSRF on API requests | interceptor | `interceptors/rails-csrf.js` |
| Case/try URL helpers | service | `caseTryNavSvc` — still the Angular-facing navigation API (`navigateTo`/`navigationCompleted`/`isLoading`/`notFound`/`getCaseNo`/`getTryNo`); called from several still-Angular components (case rename, try switch, wizard). `navigateTo()` is a real `$window.location.assign()` (full reload, not an SPA transition); `notFound()` flashes an error and stays on the page rather than navigating anywhere — its ~6 callers are generic `$http`-failure handlers (case create/rename/etc.), not actual routing 404s, so there's no good page to send the user to. |
| Pane layout (east slider) | service + value | `paneSvc`, `eastPaneWidth` |

Routing is server-side (Rails); `MainCtrl` is attached directly in `core/index.html.erb`.

### 3. Case header, scoring, and case actions

| Item | Type | Key files |
|------|------|-----------|
| Case layout shell | Rails view | `app/views/core/index.html.erb` |
| Case score display | component | Diff/snapshot `<qscore-case>` — `components/qscore_case/` |
| Per-query score | component | Diff/snapshot `<qscore-query>` — `components/qscore_query/` |
| Case rename, nightly/public/archived badges, scorer name | Rails partial + Stimulus | `app/views/core/_case_header.html.erb` + `case_rename_controller.js`, served by `Core::CaseHeaderController`. `CaseCtrl` (`controllers/case.js`) survives only for the drawer's nightly checkbox and `<import-ratings>`'s `acase` binding |
| Try rename in header | Rails partial + Stimulus | same partial/controller as case rename |
| Import ratings | component | `<import-ratings>` — `components/import_ratings/` |
| Diff against snapshot | component | `<diff>` — `components/diff/` |
| New-case wizard launcher | controller | `WizardCtrl` — `controllers/wizardCtrl.js` |

Backing services: `caseSvc`, `scorerSvc`, `ScorerFactory`, `querySnapshotSvc`, `snapshotSearcherSvc`, `SnapshotFactory`, `importRatingsSvc`, `caseCSVSvc`, `bookSvc`, `diffResultsSvc`, `qscoreSvc`

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
| Rating popover | Stimulus controller | `rating_popover_controller.js` — mutation still bridges back to Angular via `rating-popover:rate`/`:reset` events |
| Rate elements | service | `rateScaleSvc`, `ratingsStoreSvc` |
| Rating background styling | filter | `ratingBgStyle` |
| Query notes | controller | `QueryNotesCtrl` |
| Annotations list | component | `<annotations>` — `components/annotations/` |
| Single annotation | component | `<annotation>` — `components/annotation/` (uses `timeAgo` filter) |
| Query options modal | component | `<query-options>` — `components/query_options/` |
| Move query modal | component | `<move-query>` — `components/move_query/` |
| Missing documents search | controllers + template | `TargetedSearchCtrl`, `DocFinderCtrl`, `TargetedSearchModalCtrl`, `templates/views/targetedSearchModal.html` |
| Diff results view | directive + controller | `<query-diff-results>`, `QueryDiffResultsCtrl`, `templates/views/queryDiffResults.html` |
| Embed helper | directive | `quepidEmbed` on `searchResult.js` |
| Hit count display | template | `searchResults.html` (`{{ query.getNumFound() }}`) |
| Copy query text | service | `clipboardSvc` — `services/clipboardSvc.js` |

Backing services/factories: `docCacheSvc`, `DocListFactory`, `annotationsSvc`, `AnnotationFactory`, `searchEndpointSvc`

Filters: `quepidTypeaheadHighlight` (used by typeahead directive)

### 7. Tune Relevance (east pane / dev settings)

| Item | Type | Key files |
|------|------|-----------|
| Dev settings shell | controller + template | `SettingsCtrl`, `templates/views/_dev_settings.html` |
| Query params editor | directive + controller | `<query-params>`, `QueryParamsCtrl`, `templates/views/devQueryParams.html` |
| Try details popover/modal | controller + template | `QueryParamsDetailsCtrl`, `templates/views/queryParamsDetails.html` |
| Try history | directive + controller | `<query-params-history>`, `queryParamsHistoryCtrl`, `templates/views/queryParamsHistory.html` |
| Settings persistence | service + factories | `settingsSvc`, `SettingsFactory`, `TryFactory` |
| Search endpoint popup | template | `templates/views/searchEndpoint_popup.html` |

Uses heavily: `ui-ace`, `settingsIdValue`

### 8. Shared UI primitives (migrate before or alongside features)

These Angular-specific wrappers are used across many templates:

| Primitive | File | Replaces |
|-----------|------|----------|
| `$quepidModal` | `services/quepidModalSvc.js` | Bootstrap 5 modals (already BS5-backed shim; call-site count in [Hardest § By file (LOC)](#by-file-loc)) |
| `quepidCollapse` | `directives/quepidCollapse.js` | Bootstrap collapse (used by `wizardModal.html`) |
| `quepidTypeahead` | `directives/quepidTypeahead.js` | `autocompleter` (already vanilla; wired via Angular directive) |
| `vega` | `directives/angular-vega.js` | Vega embed (Vega loaded via importmap `vega_globals`) |

---

## Component inventory (14 folders)

| Folder | Element | Purpose |
|--------|---------|---------|
| `add_query` | `<add-query>` | Add query |
| `annotation` | `<annotation>` | Single annotation CRUD |
| `annotations` | `<annotations>` | Annotation list |
| `browse_query` | `<browse-query>` | "Browse N Results on {engine}" link, opens results in a new tab/window |
| `diff` | `<diff>` | Snapshot diff picker |
| `frog_report` | `<frog-report>` | Zero-results report + Vega |
| `import_ratings` | `<import-ratings>` | CSV import |
| `move_query` | `<move-query>` | Move query to another case |
| `new_case` | `<new-case>` | Header new-case entry |
| `qgraph` | `<qgraph>` | Score timeline |
| `qscore_case` | `<qscore-case>` | Case score display |
| `qscore_query` | `<qscore-query>` | Per-query score |
| `query_explain` | `<query-explain>` | Thin Angular data bridge + Stimulus `query-explain` modal (sync params/parsing via `data-*-value`; live `renderTemplate()` via CustomEvent) |
| `query_options` | `<query-options>` | Per-query options |

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

Attribute directives: `quepidSortable`, `quepidCollapse`, `quepidTypeahead`, `quepidEmbed`, `vega`

Thin shells (~14–16 LOC): `queries`, `queryParams`, `customHeaders`, `queryParamsHistory`, `queryDiffResults`. Heavy: `quepidTypeahead` (299), `searchResult` (79).

---

## Services, factories, and filters

**Services (26):** `annotationsSvc`, `bookSvc`, `bootstrapSvc`*, `caseCSVSvc`, `caseSvc`, `caseTryNavSvc`, `clipboardSvc`, `configurationSvc`*, `diffResultsSvc`, `docCacheSvc`, `importRatingsSvc`, `paneSvc`, `qscoreSvc`, `queriesSvc`, `querySnapshotSvc`, `queryViewSvc`, `rateScaleSvc`, `ratingsStoreSvc`, `scorerSvc`, `searchEndpointSvc`, `searchErrorTranslatorSvc`, `settingsSvc`, `snapshotSearcherSvc`, `userSvc`*, `varExtractorSvc` (* = `UtilitiesModule`).

**Factories (8):** `$quepidModal` (`services/quepidModalSvc.js`), `AnnotationFactory`, `broadcastSvc`, `DocListFactory`, `ScorerFactory`, `SettingsFactory`, `SnapshotFactory`, `TryFactory`

`broadcastSvc` wraps `$rootScope.$broadcast` — used by `caseSvc`, `settingsSvc`, `queriesSvc`, `annotationsSvc`, `bookSvc`. See [event bus inventory](./event_bus_inventory.md).

**Filters (7 under `filters/`):** `caseType`, `quepidTypeaheadHighlight`, `queryStateClass`, `ratingBgStyle`, `scoreDisplay`, `searchEngineName`, `timeAgo`

**Directive-local filters (1):** `plusOrMinus` (`searchResults.js`)

**Values (2):** `eastPaneWidth`, `settingsIdValue`

---

## Templates (34 HTML files)

**Shell:** `queries.html`, `embed.html`

**Search/results:** `searchResults.html`, `searchResult.html`, `queryDiffResults.html`, `targetedSearchModal.html`

**Case-action modals:** `searchEndpoint_popup.html`

**Dev pane:** `_dev_settings.html`, `devQueryParams.html`, `queryParamsDetails.html`, `queryParamsHistory.html`, `customHeaders.html`

**Wizard:** `wizardModal.html`

**Components:** 21 HTML files under `app/assets/javascripts/components/`

Compiled by `build_templates.js` → `app/assets/builds/angular_templates.js`.

---

## Other inventory

### Splainer-search shim

`app/javascript/splainer_search_adapter.js` — wraps fetch in Angular `$q` for digest cycles. Drop when off Angular.

### DOM bridge (`quepid_dom.js`)

`app/javascript/quepid_dom.js` — side-effect entry that pins `window.quepidDom` (tooltip/popover/paste helpers, `countUp`, `flash`, `modal.open` (`utils/dynamic_modal.js`), `jsonExplorer.render`/`escapeHtml` (`utils/json_explorer.js`)) for thin Angular controllers that need to build one-off vanilla UI (e.g. `searchResult.js`'s detailed-doc modal). Loaded with the Angular vendor bundle (`build:angular-vendor` passes esbuild `--alias:utils=./app/javascript/utils` so bridged utils can keep their normal importmap-style bare imports); remove with Angular.
### Non-Angular JS in the Angular bundle

`footer.js`, `tour.js`, `ace_config.js`, `scorerEvalTest.js`, `mode-json.js` — relocate when bundle goes away.

### Stylesheets

Core layout loads: `json-explorer` (Quepid-owned, styles the vanilla JSON tree), plus vendored `angular-wizard` / `ng-tags-input`. `core.css` + `bootstrap5-compat.css` style the case UI.

### Build toolchain

| Artifact | Path |
|----------|------|
| npm `angular`, `angular-mocks` | `package.json` |
| Vendor bundle | `app/javascript/angular_app.js` → `app/assets/builds/angular_app.js` |
| App bundle | `build_angular_app.js` → `quepid_angular_app.js` |
| Templates | `build_templates.js` → `angular_templates.js` |
| yarn scripts | `build:angular*` included in `yarn build` |
| Linked stylesheets | `build_css.js` → `copyLinkedStylesheets()` · audit: `audit_css.js` |

Vendored libs: `app/javascript/vendor/angular-*`, `ng-*` (6 packages; see [vendor README](../../app/javascript/vendor/README.md))

### Tests

- **Karma:** 38 specs in `spec/javascripts/angular/` (incl. `timeAgo`); loads all three Angular bundles + `angular-mocks`
- **Vitest (51 specs):** incl. `controllers/{share_case,share_case_core}_controller.test.js` and `utils/share_case_teams.js`
- **Playwright (24 specs; Angular core and Stimulus):** `angular_pages*.spec.ts`, `angular_case_helpers.ts`, baselines; also `core_smoke`, `popover_visibility`, `modal_a11y`, `case_header_typography`, `dom_migration_screenshots` (before/after migration shots; local screenshot viewer under `test/playwright/screenshot-viewer*`)
- **Playwright (Stimulus):** `stimulus_pages.spec.ts` — smoke for cases index (`import-case`, `quepid_root_url`), bulk judge, mapper wizard; `share_case_smoke.spec.ts` — core toolbar share/unshare; `dom_migration_screenshots.spec.ts` — per-surface before/after shots (`share-case/` core, `share-case-rails/` index)
- **Rails:** `core_controller_test.rb`, `tls_flow_test.rb`, `user_invite_flow_test.rb`, `cases_controller_test.rb` (Stimulus cases index), `application_helper_test.rb` (`quepid_root_url`)

### Angular core HTTP patterns (legacy)

The core case UI at `/case/...` still uses AngularJS `$http`. **Do not copy these patterns on new Rails pages** — see [DEVELOPER_GUIDE § Stimulus HTTP conventions](../../DEVELOPER_GUIDE.md#stimulus-http-conventions).

| Concern | Pattern |
|---------|---------|
| API paths | Relative `api/...` (no leading slash), e.g. `$http.get('api/cases/' + caseNo)` |
| CSRF | Automatic via `ng-rails-csrf` (`interceptors/rails-csrf.js`) for URLs containing `api/` |
| Navigation / subpaths | `caseTryNavSvc.getQuepidRootUrl()` (rule: see root `CLAUDE.md`) |
| Route param | Cases use `:case_id` in `config/routes.rb` |

```javascript
$http.delete('api/cases/' + caseNumber)
$http.post('api/import/ratings?file_format=hash', data)
$window.location.href = caseTryNavSvc.getQuepidRootUrl() + '/cases'
```

**Endpoint catalog:** OpenAPI at `/api/docs` (not a hand-maintained list). Domains hit from Angular: cases, tries, queries, ratings, snapshots, scorers, teams, books, judgements, search endpoints, annotations, export/import. `CoreController` syncs wizard params server-side.

**Migration targets** (hybrid: shared CSRF + root URL; server-owned endpoint URLs per control):

- [ ] Remaining Stimulus HTTP consistency — see [todo.md § Stimulus HTTP infra follow-ups](./todo.md#p2--stimulus-http-infra-follow-ups-hybrid-migration) (`bulk_judgement` URLs, `import_snapshot` `apiFetch`, import-case `redirect_url`, …)
- [ ] Turbo query routes, server-side import page URLs (add `data-*-url-value` per migrated control)
- [ ] Port additional `build*Url` helpers from `deangularjs-experimental` only when a control cannot use server-rendered URLs

---

## Removal checklist

### JavaScript

- [ ] `app/assets/javascripts/` (entire tree)
- [ ] `app/javascript/angular_app.js`, `quepid_app.js`, `quepid_dom.js`, `splainer_search_adapter.js`
- [ ] `app/javascript/vendor/angular-*`, `ng-*`
- [ ] `app/assets/templates/`

### Built artifacts

- [ ] `app/assets/builds/angular_app.js`, `quepid_angular_app.js`, `angular_templates.js`
- [ ] Vendor CSS builds: `angular-wizard.css`, `ng-tags-input*.css` (`json-explorer.css` stays — owned by the vanilla JSON tree)

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

- [ ] `bootstrap5-compat.css` Angular-only shims

---

## Definition of done

1. No `angular`, `angular.module`, or `ng-*` / `ui-*` template directives in the repo
2. No `angular` / `angular-mocks` in `package.json`
3. `core.html.erb` loads no Angular bundles
4. `/case/*` works on Stimulus/Hotwire (or equivalent) with same functionality
5. Karma and Playwright pass without Angular bundles or mocks; Vitest covers migrated `app/javascript/` logic
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
| [js_tooling.md](../js_tooling.md) | Vitest, ESLint, Prettier for `app/javascript/` |

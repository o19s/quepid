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
| Angular JS source files (`app/assets/javascripts`) | 12 files, 8 register with Angular |
| HTML templates (`app/assets/templates`) | 2 |
| Controllers | 0 |
| Services | 0 (`.service()` registrations) |
| Factories | 1 |
| Filters | 1 under `filters/` |
| Custom directives / components | 1 directive, no components |
| `QuepidApp` module dependencies | 4 |
| Vendored Angular libraries (`app/javascript/vendor`) | 6 packages (+ `angular` core from npm) |
| Karma unit specs (`spec/javascripts/angular`) | 4 |
| Vitest unit specs (`test/javascript/**/*.test.js`) | 116 |
| Playwright specs (`test/playwright/*.spec.ts`) | 24 |

---

## What actually needs to change

| Priority | Item | Notes |
|----------|------|-------|
| **P0** | AngularJS 1.8.3 EOL | 28 JavaScript source files and 2 Angular templates remain under the legacy asset/template trees (see [Executive summary](#executive-summary)) — no patches since Dec 2021 |
| **P0** | `queriesSvc` god object (1,366 lines) | Query state, search, scoring, book sync, positions via `$rootScope.$broadcast` |
| **P0** | `eval()` scorers | Inside `$timeout()`, no sandbox; Web Worker timeout commented out |
| **P1** | Scorer dual-execution drift | `scorer_runtime.js` (client) vs `scorer_logic.js` (server) — client API is richer |
| **P1** | `new Function()` mappers | SearchAPI mappers; MiniRacer on server; mapper wizard already Stimulus |
| **P2** | Digest workarounds | Version counters / sentinels instead of clear data flow |
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
| Tour | Shepherd tour |
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

Agents: `angular-case-migration` skill (`.agents/skills/angular-case-migration/SKILL.md`).

### Category playbooks

Use the class that matches the work. Details and phase checklist live in the skill; this section is the human/agent map.

| Class | Examples | Do | Don't |
|-------|----------|----|--------|
| **Management modals** | share, clone, export, delete/archive | **Per surface:** core matches Angular; Rails pages match their prior partial; split UI when they differ | One modal UX everywhere; Angular UX on index/teams; Rails `<select>` on core toolbar |
| **Heavy widgets** | diff, export+job, wizard | Inventory jobs/Cable/multi-step UI; esbuild or large Stimulus; step screenshots | Block on rewriting `queriesSvc` |
| **Live query state** | `queriesSvc`, search results, ratings, live score | Explicit state plan; dual-run read path first; keep client `scoreAll()` + browser→engine search | Start casually; move live search/score server-side as a “migration” |
| **App-level seams** | scorers, splainer-search, TLS/JSONP, mappers | Port with the UI that needs them; reuse `splainer-search` 3.x ESM | Rebuild search/scoring stacks from scratch without a fork decision |

### Difficulty scoring

Use when sizing a PR:

- **Coupling** — Touches live query/search/rating state (`queriesSvc`, `$scope` trees)?
- **Scope** — JS size and number of templates.
- **Replacement ready?** — Stimulus / vanilla pattern already on Rails pages? (**Ready ≠ identical UX** — still port Angular.)
- **Infrastructure** — Safe to remove only after dependents are gone?

### Remaining PR order

Everything left routes through the [live query-state phase](#live-query-state-phase-committed-final-phase): `queriesSvc` and the scoring/search adapters — not skipped, but gated on that phase's state plan being signed off before any code starts.

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

The toolbar is server-rendered from `@case`/`@try` (`app/views/core/_case_toolbar.html.erb`). The import action is Stimulus-owned (`import-ratings-core`) with a temporary query refresh bridge into Angular. Snapshot fetching and the live Query/snapshot-searcher adapter remain Angular behind the `diff:*` bridge.

**The toolbar keeps a Stimulus `hidden` readiness gate, and it is load-bearing.** Its actions
still depend on live query state: "Create snapshot" clicked before `queriesSvc` has bootstrapped
posts an empty snapshot that never resolves, leaving the modal stuck on "Snapshot Being Created".
The gate is now controlled by `case-toolbar` after `core-bootstrap` readiness; remove it only when
the remaining snapshot/export flows no longer depend on live query state.

### Stimulus twins already on Rails pages

Reuse these instead of reimplementing modals/flows:

| Stimulus controller | Typical usage |
|---------------------|---------------|
| `rating-popover` | Per-result and score-all rating UI. Shell is Stimulus; `doc.rate()` / `resetRating()` / `scoreAll()` still run in Angular via `rating-popover:rate` / `:reset`. |
| `share-book`, `share-scorer`, `share-search-endpoint` | Shared modals under `app/views/shared/` |
| `import-case`, `import-snapshot` | Shared modals |
| `confirm-delete` | Archive / delete / unarchive (cases, teams, books, search endpoints, members) |
| `invite`, `team-member-autocomplete` | Team invite / membership |
| `bulk-judgement`, `mapper-wizard` | Book LLM judge; mapper wizard |
| `document-fields-modal`, `scoring-guidelines`, `scorer-scale` | Books / scorers forms |
| `bs-tooltip`, `text-paste` | BS5 tooltips on Rails pages; paste-to-textarea (the add-query controller now imports the shared paste utility) |
| `confetti`, `prompt-form`, `user-activity` | Judgement celebration; prompts; admin charts |

Controllers: `app/javascript/controllers/` · entry: `app/javascript/application_modern.js`

**Shared migration primitives (Rails pages today; reuse on case workspace):**

| Module | Path | Notes |
|--------|------|-------|
| `apiFetch` / `getCsrfToken` | `app/javascript/api/fetch.js` | CSRF-aware JSON fetch (Vitest-covered) |
| `getQuepidRootUrl` | `app/javascript/utils/quepid_root.js` | Subpath-safe root from `data-quepid-root-url` |
| CodeMirror 6 editor | `app/javascript/modules/editor.js` | Candidate `ui-ace` replacement for dev pane |
| BS5 tooltip / popover / paste | `utils/bs_tooltip.js`, `utils/bs_popover.js`, `utils/text_paste.js` | Static icons use the `bs-popover` Stimulus controller; Angular call sites use shared DOM helpers through `window.quepidDom` |
| Core Stimulus entry | `app/javascript/core_stimulus.js` | Controllers without Turbo; loaded from `core.html.erb` |

New Stimulus logic in `app/javascript/api/` or `utils/` needs a `*.test.js` under `test/javascript/` (Vitest, mirroring the source path — not colocated). See [`js_tooling.md`](../js_tooling.md).

### Full removal order (after incremental PRs)

When replacing the case SPA (not just toolbar actions), work in dependency order:

The case page is bootstrapped by `core_bootstrap_controller.js`; the surviving Angular services remain behind the temporary
compatibility adapter until live query/search/scoring migration is complete.

**Turbo is loaded on `core`** (`core_stimulus.js`), for Frames and Streams only. `Turbo.session.drive = false` is set there for the same reason it is set in `application_modern.js`, and it matters more here: Angular runs `$locationProvider.html5Mode(true)`, so letting Drive intercept navigation would put two routers on one URL. Frames still work with Drive off, because Turbo treats anything inside a `<turbo-frame>` as navigatable regardless.

1. Shared primitives — `quepidTypeahead` and the remaining CSRF callers. Tooltip/popover/paste utils, dynamic modals, and flash are already Stimulus-owned. Remaining call sites are concentrated in the diff bridge and surviving Angular service seams; `quepidTypeahead` still supports `searchEndpoint_popup.html`. They fall out as those remaining components migrate — don't plan a standalone PR for this step.
2. Services layer — the former `caseSvc`, `caseTryNavSvc`, `settingsSvc`, and `queriesSvc`; scorer execution is now framework-free
   registration is now a runtime initializer and is tracked with live query state.
3. Splainer — drop `$q` shim; use `splainer-search/wired.js` directly
4. Query list + results — `search-results`, rating UI
5. Case action modals — import ratings, diff
6. Cleanup — removal checklist below

### Hardest — sequence last, needs the state plan first

#### By file (LOC)

| Name | LOC | Why |
|------|-----|-----|
| **live-query runtime initializer** | 1,072 | Compatibility assembly for case state, search, scores, and persistence; now invoked by the Stimulus core bootstrap with explicit Angular service dependencies |
| **scorer_runtime** | 286 | Framework-free scoring model + judgement math |
| **angular core** | — | Remove last |

**Defer on the case workspace** (Solr JSONP, live state, or remaining Angular wrappers): `quepidTypeahead`. Snapshot search/scoring remains behind its explicit Angular bridge. The remaining deferred pieces imply rebuilding the case SPA, not a framework swap.

#### `queriesSvc` seam inventory (phase 1)

The remaining Angular and compatibility consumers reach into `queriesSvc`; the `*_core_controller.js` Stimulus controllers reach it only through `document` CustomEvents (already bridged). The shadow `queryCollectionStore` now also receives bootstrap, collection, and search-lifecycle state, without changing Angular's search/scoring ownership. Grouped by what a caller actually needs:

| Surface | Members | Callers |
|---------|---------|---------|
| **Read / display** | `queryArray`, `latestScoreInfo`, `version`, `hasUnscoredQueries`, `scoredQueryCount`, `queryCount`, `isBootstrapping`, `queries`, `showOnlyRated` | `utils/case_csv.js`; Frog Report reads `queryDocumentsStore` |
| **Mutation / lifecycle** | `bootstrapQueries`, `changeSettings`, `searchAll`, `createQuery`, `deleteQuery`, `moveQuery`, `updateQueryDisplayPosition`, `reset`, `updateScores`, `scoreAll`, `refreshAllDiffs`, `syncToBook` | `mainCtrl`, `add_query`, `diff`; move/delete persistence is Stimulus-owned and only reconciles Angular's live objects |
| **Search / score engine** (`Query`) | `search`, `searchFromSnapshot`, `paginate`, `ratedPaginate`, `score` / `scoreOthers`, `refreshRatedDocs`, `setDocs`, `filterToRatings`, plus internal searcher construction, document normalization, `searchApiRatedDocs`, `pAll`, mapper `eval` | `docFinder`; otherwise internal |


**`static` is normalized to `solr` by mutation.** `createSearcherFromSettings()` assigns `passedInSettings.searchEngine = 'solr'` for a static engine, and `Query.search()` passes `currSettings` uncopied — so the rewrite persists on the service until the next `changeSettings()`. It is load-bearing: `Query.search()` builds `ratedSearcher` with `filterToRated: true` on every search, and `filterToRatings()` has no `static` branch, so without the rewrite a static case pushes `undefined` into `fq`. The rewrite reaches only the settings-level copy — `selectedTry.searchEngine` stays `static`, which is why `trySupportsRatedDocsLookup()` (read off the try) correctly leaves "Show only rated" disabled for static cases. Extractions must normalize `static` → `solr` at the searcher/filter seam **only**, never in the capability predicates, or the toggle silently turns on. No Karma or Vitest example covers a static engine.

#### Re-render mechanism

Angular's digest is what repaints `queriesCtrl` / `searchResults` / `qscore-*` when a rating changes. Stimulus supplies no reactivity, so the replacement is explicit. **Decided 2026-09-22** (see [decision lenses](#decision-lenses)).

**Ownership decides the mechanism.** Server-owned state re-renders through **Turbo Frames**; client-owned state re-renders through a **client store + Stimulus**. The case header is a Frame because Rails owns the case name. Scores and documents fail that test: live search is browser → customer engine and the server never sees the documents, so it has nothing to render from. **Turbo Streams are not available for score or document state** — this is a data-ownership fact, not a preference, and it does not reopen the search/IR or UX-fidelity lenses.

**Mechanism:** a plain-JS observable store built on `EventTarget` owns query/score/rating state. Stimulus controllers subscribe and write to the DOM directly. No reactive framework (React/Vue/Alpine/signals) and no bespoke reactivity layer — if the store grows a template syntax or a dependency graph, it has failed. Use the **Stimulus Values API + `xValueChanged()`** for display scalars (score, rating, max), as `rating_popover_controller.js` already does; keep data out of `data-*` attributes — never serialize a doc list into one.

**The reactive surface is small and enumerable.** `RatingsStore.markDirty()` → `rating-changed` → the rated doc's badge (`ratingBgStyle`), the per-query score (`qscore-query` Stimulus controller), the case score and label (`qscore-case` Stimulus controller), `isNotAllRated` / `getNumFound()`, and diff scores when enabled. Four numbers and a background colour — the digest re-evaluates the world, the actual delta does not justify a framework.

**This removes digest workarounds rather than porting them.** The version counters (`svcVersion`) and the 100 ms debounce in `queriesCtrl` exist because the digest offers no change notification. An explicit store with real change events deletes them — one reason to prefer it over any mechanism that reintroduces implicit invalidation.

**Do not scope `scoreAll()` in the same change.** One rating rescores every query today; the performance lens says carry that forward. An explicit store makes per-query scoping possible later, but taking it here ships an unapproved behaviour change and makes any score discrepancy unattributable.

- `queriesSvc` publishes the collection and document stores after search, rated-document refresh, pagination, errors, and rating changes. Query-list ordering, filtering, sorting, expansion, counts, state, Querqy flags, options, and explain metadata now read from the collection store; only on-demand query-template rendering remains behind a live-query compatibility callback. Search, scoring, diff, finder, and options remain behind their existing live-query boundaries; document rating, bulk rating, toggle, pagination, show-only-rated, and collapse-all cross the explicit `queryCommands` runtime. The live-query capability now translates its Angular-shaped request contract to native `apiFetch` and native Promises; `$rootScope` remains only as a digest scheduling bridge for the legacy surface.
- Case-level score aggregation now runs through the framework-free `createCaseScoringRuntime`; Angular supplies live Query objects and remains only the compatibility adapter for scorer execution and legacy `latestScoreInfo` consumers.
- Snapshot fetching and hydration now run through the Stimulus/framework-free snapshot registry; Angular still owns the live Query objects and per-query diff scoring behind the document-store bridge.
- `snapshot_searcher.js` owns the framework-free snapshot searcher contract, including registry lookup; `queriesSvc` supplies the remaining Angular callbacks directly at the boundary.
- Core case bootstrap now consumes one named `core` capability group rather than raw Angular service names. The adapter still owns the case/settings/navigation/scorer implementations, but modern code no longer destructures or stores those Angular services directly.
- Snapshot comparison, case wizard, and Tune Relevance now consume named capability groups as well. Their Angular services remain adapter-owned for behavior parity; modern controllers no longer destructure the injector-shaped service object.
- The named `splainerSearch` capability is now the sole source for field-spec creation, document explanation, search validation, and ES template detection; those four Splainer services are no longer requested from the Angular injector by the snapshot, wizard, or Tune Relevance capability definitions.

**The `window.quepidStore` bridge is temporary.** It exists so `queriesSvc` (still Angular) can push into a store that Stimulus (not yet the page owner) can read, during dual-run. Once the case workspace has its own entry bundle, the global goes away in favor of a module import — don't grow further ad hoc bridges on `window.quepidStore` as if it were the permanent integration point.

**`setLatestScoreInfo()` replaces the whole score map, on purpose — for now.** It mirrors `scoreAll()` rescoring every query on every rating (see "Do not scope `scoreAll()`" above). If a later slice adds a partial-update path (e.g. scoping to one query), give it its own method name rather than overloading `setLatestScoreInfo()` with a partial payload — subscribers currently assume a full replace on every `change` event, and a silent partial write would reproduce the class of staleness bug this store exists to avoid.

**Test obligations.** Testability without a browser is a condition of this choice, not a bonus: a digest is untestable in Vitest, an `EventTarget` store is not. Every rating-driven update needs a Vitest example asserting the subscriber fired, plus Playwright coverage of the composite (rate a doc → badge, per-query score **and** case score all move). The failure mode to design against is silent staleness from a missed subscription. `core_smoke.spec.ts`'s "rating updates the query score, case score, and rating badge" test satisfies the Playwright half of this for the qscore slice.

#### App-level (port seams; don't rebuild)

**Scoring runtime** — Custom JS scorers expose an ~18-function API. `scorer_runtime.js` and `scorer_logic.js` still need a canonical shared contract, but client execution is now framework-free and no longer depends on Angular. **Direction:** shared npm package with an explicit canonical API and a scorer migration guide — not server-only scoring; every rating triggers client `scoreAll()` today.

**Search engine coupling** — **Still hard:** Quepid-specific seams — snapshot fake-Solr, proxy/basic auth, TLS protocol switching, SearchAPI mapper code — must port with any case UI work.

#### UI-level (reimplement on any framework)

1. **Scorer sandboxing** — Replace `eval()`. **Direction:** Web Worker (docs + scorer code in, score out). Budget for `scoreAll()` calling the worker per query per rating unless the flow is redesigned. MiniRacer stays for batch paths only.

2. **Multi-snapshot diff + scoring** — ≤5 snapshots, snapshot-as-searcher, client `scoreOthers()`, per-position diff, case averages. The remaining work sits on fake-Solr snapshots and rating-driven refetch.

3. **Angular templates → target syntax** — 32 templates (`ng-repeat`, `ng-if`, `ng-model`, `dir-paginate`, `quepid-sortable`, `ui-ace`, …) become ERB partials plus Stimulus targets, with store subscriptions doing the updates Angular's bindings did (see [Re-render mechanism](#re-render-mechanism)).

4. **Field spec parsing and display** — `id:id title:name …` — type detection (JSON / URL / text), thumb prefixes, media by extension, snippet `<strong>` wrapping. Domain logic in splainer-search + Quepid display code, not framework glue.

### Open bugs & UX (address during migration)

Playwright MCP–verified issues on the core case UI. **Do not patch in AngularJS** — fix when migrating the owning surface (see [todo.md § Obviated](./todo.md#obviated-by-angular-removal-do-not-fix-in-angular)).

#### Icon-only controls lack accessible names

**Observed:** Icon-only controls (copy-query; snapshot delete/clear in Compare) lack accessible names on the button.

**Fix during migration:** Add `aria-label` (or visible text) on the replacement controls. Align with [decision lens § A11y](#decision-lenses) — scores and rating controls need real ARIA, not color-only state.

**Touches:** `search_results_template.js`, diff/snapshot Compare UI, [Feature area § Search results](#6-search-results-and-rating-ui).

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
The former Angular `CaseCtrl.caseModel.selectedCase()` returned `{ caseNo: -1, caseName: '' }` on every call before the
case loaded. Remaining Angular bindings read the selected case, so a new object identity each digest is a change
each digest. Angular's template had hidden this behind `ng-if="caseModel.caseLoaded()"`; rendering
the toolbar unconditionally exposed it as `$rootScope:infdig`. Return a single stable instance.

**A scope whose body ends in `.first` returns the relation when there is no record.**
`Try.latest` was `scope :latest, -> { order(id: :desc).first }`. Rails returns the record when there
is one and falls back to the *relation* when the body is nil, so a case with no tries yielded an
`AssociationRelation` and `@try.try_number` raised `NoMethodError`. Nothing noticed until a view
actually read `@try`. It is a class method now.

**A fire-and-forget request before a navigation gets aborted.**
The wizard issued the case-rename `PUT` after the settings runtime update, which ends in a real
`$window.location.assign`. The browser cancelled the rename often enough that the case kept its
scratch name — visible in a Playwright trace as a request with status `-1`. The rename runs first
and is awaited now. Worth remembering generally: anything Angular fires near navigation
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
- CSS: `json-explorer` (Quepid-owned)
- Inline core configuration is seeded from Rails config — including `caseNo`/`tryNo` from `params[:id]`/`params[:try_number]`/`@case`. Interpolate as bare integers/`"null"`, never `.to_json` — Rails' default HTML-escaping of `<%= %>` mangles `"`/`&` inside a `<script>` tag (`"1"` → `&quot;1&quot;`), silently breaking the whole inline script.

### Case shell (`app/views/core/index.html.erb`)

The layout lives in ERB, not an Angular template, because the header and toolbar read `@case`/`@try`: templates under `app/assets/templates` are compiled into the `angular_templates` bundle and cannot contain ERB.

Angular still compiles what is left, because custom elements inside `ng-app` are compiled at bootstrap like any other markup.

The query-list shell is Rails-rendered and no longer declares an Angular scope. Deferred live-result controls still receive a short-lived root-scope child for compilation. The score badges remain at the same DOM position for `qscore.css`'s `:last-child`-based badge-spacing rules to apply correctly.

### `app/assets/javascripts/routes.js`

`$locationProvider.html5Mode(true)` + `$httpProvider` cache/header config only — no `$routeProvider`.

---

## Root module and dependencies

### `QuepidApp` (`app/assets/javascripts/app.js`)

| Module | Source | Used for | Replace with |
|--------|--------|----------|--------------|
| `ngSanitize` | `angular-sanitize` | `ng-bind-html` | DOMPurify or server sanitize |
| `o19s.splainer-search` | `splainer_search_adapter.js` | Search HTTP | `splainer-search/wired.js` directly |
| `ng-rails-csrf` | `interceptors/rails-csrf.js` | CSRF on `$http` | Fetch wrapper with CSRF meta tag |
| `templates` | `build_templates.js` | `$templateCache` | ERB partials / Stimulus templates |

Non-Angular libs that **stay**: Bootstrap 5, D3, Vega, ACE, autocompleter, clipboard, URI.js, Shepherd, SortableJS.

---

## Feature areas to migrate

Work is grouped by user-visible capability. Each area spans templates, controllers, directives/components, and backing services.

### 1. Application shell

| Item | Type | Key files |
|------|------|-----------|
| Current user | Rails-rendered state + framework-free runtime | `app/javascript/utils/user_runtime.js` owns core bootstrap and wizard API mutations |
| App config flags | runtime | `configuration_runtime.js` |
| CSRF on API requests | interceptor | `interceptors/rails-csrf.js` |
| Case/try URL helpers | runtime | `app/javascript/utils/navigation_runtime.js` owns navigation state, URL helpers, protocol switching, proxy URLs, and endpoint links. |

### 3. Case header, scoring, and case actions

| Item | Type | Key files |
|------|------|-----------|
| Import ratings | Stimulus controller + Angular refresh bridge | `app/javascript/controllers/import_ratings_core_controller.js`, `app/views/shared/_import_ratings_core_modal.html.erb`; refreshes live query state through `imports:queries-need-reload` |
| Diff renderer and picker | Stimulus renderer + explicit compatibility bridge | `app/javascript/controllers/diff_core_controller.js`, `app/javascript/controllers/snapshot_bridge_controller.js`, `app/javascript/controllers/search_results_controller.js`, `app/javascript/controllers/diff_score_controller.js`, `app/javascript/controllers/diff_case_scores_controller.js`, `app/javascript/stores/query_documents_store.js`, `app/javascript/utils/diff_results.js`; Angular still owns snapshot search/scoring |

Backing compatibility boundary: the live-query runtime; snapshot hydration and
scoring now cross through `snapshot_bridge_controller.js` without a snapshot
Angular service.

### 4. Wizard follow-up

Mapper-specific endpoint editing remains follow-up work before the surviving Angular services can
be removed. Endpoint validation and case/settings persistence still use an explicit temporary
adapter into those services.

### 5. Query list

| Item | Type | Key files |
|------|------|-----------|
| Add query | Stimulus controller + temporary Angular state bridge | `app/javascript/controllers/add_query_controller.js`, `app/javascript/controllers/query_lifecycle_controller.js`, and `app/javascript/utils/query_lifecycle.js`; Angular retains Query construction and search/scoring only |

Remaining backing service: `queriesSvc`

`queriesSvc` remains the compatibility adapter for live Query objects, search
persistence, and engine-specific callbacks. The framework-free query
runtime now owns rated-document refresh and pagination, including Search API
support checks and stale rating-generation retries. The next extraction can
move the remaining injected operations without changing the query-local
contract.

Query persistence is now Stimulus/store-owned for create, bulk create, delete,
move, and reorder. The only remaining mutation bridge for delete/move is
`queryCapabilities.reconcileQueryRemoval`, which removes the corresponding live
Angular `Query` until search and scoring migrate. The Angular service no longer
owns duplicate delete/move/reorder HTTP methods or listens directly for the
Stimulus completion events.

### 6. Search results and rating UI

| Item | Type | Key files |
|------|------|-----------|
| Results panel | Stimulus shell + isolated Angular controls | `app/javascript/controllers/search_results_controller.js` and `search_results_template.js` own the expanded-results shell/document rendering and browse-results modal; Query construction, searcher creation, diff, finder, pagination, and scoring remain explicit Angular control islands |
| Rating popover | Stimulus controller | `rating_popover_controller.js` — mutation still bridges back to Angular via `rating-popover:rate`/`:reset` events |
| Rate elements | framework-free runtime + Angular transport callback | `app/javascript/utils/ratings_store.js`, `app/javascript/utils/live_query_runtime_initializer.js` |
| Query scoring and case aggregation | framework-free runtime + Angular adapter | `app/javascript/utils/query_scoring.js`, `app/javascript/utils/live_query_runtime_initializer.js` |
| Rating background styling | framework-free utility + Stimulus controller | `app/javascript/utils/scoring.js`, `app/javascript/controllers/rating_popover_controller.js` |
| Query options modal | Stimulus controller + Angular scoring bridge | `app/javascript/controllers/query_options_core_controller.js`, `app/views/shared/_query_options_core_modal.html.erb`; save dispatches `query-options:saved` so Angular updates the live Query and rescoring continues through `queriesSvc` |
| Move query modal | Stimulus controller + query API seam | `app/javascript/controllers/move_query_core_controller.js` and `app/javascript/utils/query_lifecycle.js`; Stimulus owns persistence, while `queriesSvc` only reconciles its live object through `query-command:move-completed` |
| Missing documents search | Stimulus controller + framework-free targeted-search runtime + Angular dependency adapter | `app/javascript/controllers/missing_documents_controller.js`, `app/javascript/utils/query_runtime.js`, and `app/javascript/quepid_search.js`; `queriesSvc` now only injects legacy searcher/settings/document dependencies |

Automatic post-search synchronization now uses the tested `createBookSyncRuntime`
for configuration, deduplication, batching, and retry-on-failure; `queriesSvc`
only invokes that runtime after a live search.

Backing runtimes: `app/javascript/utils/doc_cache.js`, `app/javascript/utils/search_endpoint_runtime.js`

Filters: `quepidTypeaheadHighlight` (used by typeahead directive)

### 7. Tune Relevance (east pane / dev settings)

| Item | Type | Key files |
|------|------|-----------|
| Settings persistence | framework-free runtime | `app/javascript/utils/settings_runtime.js`, `app/javascript/utils/settings_catalog_runtime.js` |
| Search endpoint popup | template | `templates/views/searchEndpoint_popup.html` |

Uses the framework-free settings and case runtimes through `core_angular_adapter.js`; the drawer UI no longer depends on Angular templates, controller scopes, or direct injector access.

### 8. Shared UI primitives (migrate before or alongside features)

These Angular-specific wrappers are used across many templates:

| Primitive | File | Replaces |
|-----------|------|----------|
| `quepidTypeahead` | `directives/quepidTypeahead.js` | `autocompleter` (already vanilla; wired via Angular directive) |

---

## Remaining Angular directives

Attribute directives: `quepidTypeahead`

Heavy: `quepidTypeahead` (299).

---

## Services, factories, and filters

**Services (0):** `caseSvc`, `caseTryNavSvc`, `configurationSvc`, `queriesSvc`, `scorerSvc`, `userSvc`, `settingsSvc`, `mapperBasedSearchEngineSvc`, and `searchEndpointSvc` registrations are gone. Case loading, selection, mutation, metadata, and navigation now live in the tested framework-free `case_runtime.js` and `navigation_runtime.js` modules. Core configuration and settings helpers live in `configuration_runtime.js`, `settings_catalog_runtime.js`, and `settings_runtime.js`. Custom scorer execution now lives in the tested framework-free `scorer_runtime.js`. `querySnapshotSvc` was removed: `snapshot_bridge_controller.js` now owns shallow bootstrap and create transport, while snapshot hydration and scoring remain behind the explicit compatibility boundary. `docCacheSvc` was also removed; its shared/scoped cache now lives in the tested `app/javascript/utils/doc_cache.js` runtime used by the Angular query/scoring island and Stimulus snapshot/bootstrap/wizard boundaries.

`queriesSvc` reads the framework-free snapshot registry directly. Static snapshot
imports in the new-case wizard use `app/javascript/utils/snapshot_import.js`.
Snapshot creation payload construction lives in the tested
`app/javascript/utils/snapshot_payload.js` utility, and the obsolete Angular
CSV-import methods are gone. The compatibility object now exposes only the
snapshot registry, model factory, and registry searcher needed by the remaining
live Query/scoring island; payload, API, hydration, and unused searcher helpers
are no longer exported through the Angular bundle.

**Factories (0):** No Angular factories remain.

The former `caseSvc` and `queriesSvc` consumers now use framework-free runtimes, named native events, or EventTarget stores. See [event bus inventory](./event_bus_inventory.md).

`queriesSvc` retains the temporary Angular ownership of rating persistence
transport and query scoring, while the framework-free `RatingsStore` owns the
rating dictionary and mutation behavior. Splainer search, document factories,
and explain normalization now cross `window.quepidSearch.splainerSearch`
instead of the Angular injector. Its no-store compatibility path emits
the named native `ratings:changed` event; the Angular root event relay is
removed. The `CaseScoreStore` event remains the normal path until the live
query/scoring migration is complete.

**Filters (1 under `filters/`):** `quepidTypeaheadHighlight`

Removed on 2026-09-28: `queryStateClass`, `ratingBgStyle`, `scoreDisplay`, and
`searchEngineName`. Their framework-free replacements are covered by Vitest
and are the consumers used by the Stimulus case workspace.

**Values (0):** No Angular values remain.

---

## Templates (2 Angular HTML files)

**Views:** `views/embed.html`, `views/searchEndpoint_popup.html`

Compiled by `build_templates.js` → `app/assets/builds/angular_templates.js`.

---

## Other inventory

### Splainer-search shim

`app/javascript/splainer_search_adapter.js` — wraps fetch in Angular `$q` for digest cycles. Drop when off Angular.

### DOM bridge (`quepid_dom.js`)

`app/javascript/quepid_dom.js` — side-effect entry that pins `window.quepidDom` (tooltip/popover/paste helpers, `countUp`, `flash`, `modal.open` (`utils/dynamic_modal.js`), `jsonExplorer.render`/`escapeHtml` (`utils/json_explorer.js`)) for the remaining thin Angular controllers and compatibility bridges. It is now loaded through the framework-free `case_runtime` bundle before Angular; remove the global when the remaining compatibility bridges are gone.

Curator-variable extraction and try state are now framework-free in `app/javascript/utils/curator_vars.js` and `app/javascript/utils/settings_runtime.js`. Book population similarly keeps its Angular transport in `queriesSvc`, while payload construction lives in `app/javascript/utils/book_sync.js`.
### Non-Angular JS in the Angular bundle

`footer.js`, `tour.js`, `ace_config.js` — relocate when the remaining Angular bundle goes away.

The legacy scorer worker probe was removed with the Angular scorer factory; custom scorer execution remains on the existing client path until the worker/shared-contract work is completed.

### Stylesheets

Core layout loads: `json-explorer` (Quepid-owned, styles the vanilla JSON tree). `core.css` + `bootstrap5-compat.css` style the case UI.

### Build toolchain

| Artifact | Path |
|----------|------|
| npm `angular`, `angular-mocks` | `package.json` |
| Framework-free case runtime | `app/javascript/case_runtime.js` → `app/assets/builds/case_runtime.js` |
| Case-domain runtime | `app/javascript/utils/case_runtime.js` |
| Vendor bundle | `app/javascript/angular_app.js` → `app/assets/builds/angular_app.js` |
| App bundle | `build_angular_app.js` → `quepid_angular_app.js` |
| Templates | `build_templates.js` → `angular_templates.js` |
| yarn scripts | `build:case-runtime` and `build:angular*` included in `yarn build` |
| Linked stylesheets | `build_css.js` → `copyLinkedStylesheets()` · audit: `audit_css.js` |

Vendored libs: `app/javascript/vendor/angular-*`, `ng-*` (6 packages; see [vendor README](../../app/javascript/vendor/README.md))

### Tests

- **Karma:** 12 specs in `spec/javascripts/angular/`; loads all three Angular bundles + `angular-mocks`
- **Vitest (116 specs):** includes the framework-free stores, runtimes, and migrated Stimulus controllers under `test/javascript/`
- **Playwright (24 specs; Angular core and Stimulus):** `angular_pages*.spec.ts`, `angular_case_helpers.ts`, baselines; also `core_smoke`, `popover_visibility`, `modal_a11y`, `case_header_typography`, `dom_migration_screenshots` (before/after migration shots; local screenshot viewer under `test/playwright/screenshot-viewer*`)
- **Playwright (Stimulus):** `stimulus_pages.spec.ts` — smoke for cases index (`import-case`, `quepid_root_url`), bulk judge, mapper wizard; `share_case_smoke.spec.ts` — core toolbar share/unshare; `dom_migration_screenshots.spec.ts` — per-surface before/after shots (`share-case/` core, `share-case-rails/` index)
- **Rails:** `core_controller_test.rb`, `tls_flow_test.rb`, `user_invite_flow_test.rb`, `cases_controller_test.rb` (Stimulus cases index), `application_helper_test.rb` (`quepid_root_url`)

### Angular core HTTP patterns (legacy)

The core case UI at `/case/...` still uses AngularJS `$http`. **Do not copy these patterns on new Rails pages** — see [DEVELOPER_GUIDE § Stimulus HTTP conventions](../../DEVELOPER_GUIDE.md#stimulus-http-conventions).

| Concern | Pattern |
|---------|---------|
| API paths | Relative `api/...` (no leading slash), e.g. `$http.get('api/cases/' + caseNo)` |
| CSRF | Automatic via `ng-rails-csrf` (`interceptors/rails-csrf.js`) for URLs containing `api/` |
| Navigation / subpaths | `navigation_runtime.js` (rule: see root `CLAUDE.md`) |
| Route param | Cases use `:case_id` in `config/routes.rb` |

```javascript
$http.delete('api/cases/' + caseNumber)
$http.post('api/import/ratings?file_format=hash', data)
window.location.href = navigationRuntime.getQuepidRootUrl() + '/cases'
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
- [ ] `app/javascript/angular_app.js`, `quepid_dom.js`, `splainer_search_adapter.js`
- [ ] `app/javascript/vendor/angular-*`, `ng-*`
- [ ] `app/assets/templates/`

### Built artifacts

- [ ] `app/assets/builds/angular_app.js`, `quepid_angular_app.js`, `angular_templates.js`

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

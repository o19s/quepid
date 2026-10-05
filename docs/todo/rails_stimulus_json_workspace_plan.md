# Simplify the case workspace while keeping JSON APIs

**Proposed:** 2026-10-05. This plan builds on the source investigation for the
[Rails/Hotwire workspace plan](rails_hotwire_workspace_plan.md) and describes
the alternative that keeps existing JSON endpoints. Completed work and browser
verification are recorded under [Execution record](#execution-record).

## Direction

Keep Rails responsible for page structure, authorization, static markup and URLs.
Use Stimulus for interaction, JSON API requests and rendering dynamic data into
ERB-provided templates. Retain focused browser modules and stores for direct
search, unsaved tuning settings, documents and instant scoring.

AngularJS and the client router are already removed. The case workspace already
uses this architecture in several places, including static modal shells and
query-row templates. Extend those patterns where they remove complexity rather
than rebuilding working surfaces. This remains a rich browser workspace; ERB
templates alone do not eliminate client-side orchestration.

The core plan requires no new HTML endpoints, HTML response negotiation on API
controllers, or wholesale conversion to Rails form submissions. Existing Rails
forms, Frames, Streams and job progress updates continue to serve their current
roles. Case/try navigation remains a full-document transition. Turbo Drive is an
optional later project, not an acceptance gate for this simplification.

## Engineering criteria

From a pragmatic perspective, each batch should remove an observed maintenance
cost: redundant bootstrap requests, duplicated markup, overlapping state owners
or poorly scoped lifecycle work. Count what is removed as well as what is added.
Avoid a new facade or generic rendering framework that simply wraps the old one.

Preserve edit/apply timing, shared state, history refresh and navigation behavior.
Behavior changes require separate, explicit authorization.

From a Rails/Hotwire perspective, ERB owns static structure and Stimulus owns DOM
behavior and connection cleanup. JSON APIs retain persistence and validation;
stores retain shared mutable browser state. Server-rendered lists/forms can be
reconsidered for an individual surface when their benefits justify the endpoint
work. That decision does not block this plan.

Follow the existing [workspace ownership map](../app_structure.md),
[Stimulus HTTP conventions](../../DEVELOPER_GUIDE.md#stimulus-http-conventions)
and [case-page lifecycle contract](../../DEVELOPER_GUIDE.md#turbo-on-the-case-page).

## Ordered batches

Complete implementation, removal of replaced code and verification for each batch
before moving on. Record any concrete blocker and its smallest prerequisite here.

1. **[MIGRATION-FOLLOWUP] Establish the baseline and choose one complete pilot.**
   - Inventory the initial user/case/try requests and their consumers. Record request
     count, payload size and when the toolbar and first search become ready; separate
     Quepid bootstrap latency from customer-engine latency.
   - Identify remaining static/repeated markup built in JavaScript. Exclude templates
     already rendered by ERB and genuinely computed search content.
   - Use the annotations list as the first candidate: keep its JSON CRUD, score
     capture and `annotations:changed` contract; evaluate its existing row template
     before deciding what markup or lifecycle code still needs to move.
   - **Acceptance:** a bounded pilot scope with current ownership, affected scenarios
     and before evidence. If annotations already follow the desired pattern, choose
     a remaining JSON-fed list rather than rewriting them to satisfy the plan.

2. **[MIGRATION-FOLLOWUP] Finish the ERB-template and Stimulus pilot.**
   - Put any remaining static row/modal structure in an ERB partial or `<template>`.
     Clone and populate templates from JSON using targets, actions and explicit data
     slots. Keep text insertion safe and preserve existing per-surface behavior.
   - Keep load/save/delete through the existing JSON helpers and server-provided URLs.
     Handle loading, empty states, validation errors, pending submission and retry.
   - Preserve keyed rows, focus and unfinished edits when updating a list. Remove
     replaced HTML strings and manual DOM listeners in the same batch.
   - **Acceptance:** the pilot's complete read/mutate/reopen flow and failure/retry
     path work; dependent graph or scoring updates fire correctly. The patch removes
     rendering/lifecycle duplication without adding a second state owner.

3. **[MIGRATION-FOLLOWUP] Reduce duplicate bootstrap work through the existing page response.**
   - Use the baseline to choose which initial requests are actually redundant.
     `CoreController` already selects an authorized case and try; supply only the
     initial data whose inclusion replaces a subsequent request.
   - Reuse serialization and normalization where practical. Avoid maintaining one
     independent embedded-data schema and another API schema for the same consumer.
     Use safely escaped JSON and preserve user scoping and credential/cache boundaries.
   - Adapt `core_bootstrap_controller.js` to consume that initial contract. Preserve
     mapper/field normalization, scorer loading, book configuration, search startup,
     wizard/empty-case handling and meaningful errors. Keep later refreshes through APIs.
   - **Acceptance:** direct links and reloads select the correct case/try, initial
     requests decrease without redundant embedded data, and first-search readiness
     does not regress under comparable conditions. Denied access, invalid try and
     search failures remain covered. Remove the superseded fetch path.

4. **[MIGRATION-FOLLOWUP] Simplify settings and state ownership in complete feature groups.**
   - Identify concrete duplicate state among bootstrap, selected-case data, settings,
     query objects and stores. Keep one authoritative owner for each responsibility;
     retain read models and adapters when they serve distinct consumers.
   - Start with Tune Relevance save/new-try and its navigation handoff. Preserve
     existing edit/apply timing and shared-state semantics; persist through the existing API. Preserve ancestry,
     failure/retry and drawer behavior, then handle history operations as a separate
     complete group if needed.
   - Remove obsolete copied fields, capability wrappers and coordination events only
     after all their consumers move. Keep query/document/score stores and immediate
     browser scoring. Retain server-generated URL values/templates for requests and links.
   - **Acceptance per group:** success and failure paths preserve drafts and reconcile
     saved data once; query/search/scoring consumers read the correct owner. The old
     state or wrapper is removed, rather than left alongside its replacement.

5. **[MIGRATION-FOLLOWUP] Tighten lifecycle cleanup within the current navigation boundary.**
   - Move remaining UI lifecycle work from helpers such as `dynamic_modal.js` and
     `detailed_document_modal.js` into owning controllers where it reduces complexity.
     Keep thin Bootstrap helpers and the existing ERB modal shells.
   - Pair controller subscriptions/listeners, timers and widgets with cleanup.
     Prevent superseded requests from updating closed/reopened modals or detached
     regions; abort supported requests or ignore obsolete responses.
   - Keep document-lifetime runtime ownership where full-page navigation makes it
     appropriate. Do not rebuild every singleton solely to prepare for optional Drive.
   - **Acceptance:** repeated open/close and reconnect, slow responses, failed saves
     and navigation during work do not duplicate handlers or update the wrong region.
     Replaced helper lifecycle code is removed and ownership docs are updated.

6. **[MIGRATION-FOLLOWUP] Apply the proven pattern to remaining useful candidates.**
   - Review scorer/team lists, snapshot selectors and judgement/export configuration
     one group at a time. Convert remaining markup only where the pilot demonstrates
     a meaningful reduction. Preserve JSON actions, downloads and background jobs.
   - Keep search results, explanations, ratings, comparison calculations and paging
     browser-owned. Avoid a universal list renderer or generic API form framework.
   - **Acceptance per group:** affected core and Rails surfaces preserve their own
     behavior, complete actions and error handling; the patch removes specific old
     rendering or coordination code. Update docs and tracker path mappings as needed.

## Optional later batch: Turbo Drive on the workspace

Proceed only if smoother navigation has enough user benefit to justify the work.
This requires an explicit workspace mount/dispose contract, cancellation or stale
response protection for searches, a cache/draft restoration policy and coordinated
asset/controller loading across management and case pages. Repeated visits must
not retain a previous case's stores or start duplicate searches.

The gate includes case A → B while searches are pending, try changes, management
→ case → management, Back/Forward, cached previews, modal/editor cleanup and expired
sessions. Preserve full-document protocol transitions for Solr JSONP and the
independent analytics boundary. Keep prefetch disabled until GET mutations are audited.
Lift the reload boundary and Drive disable only after those gates pass.

## Verification and completion

- Run relevant Vitest contracts, lint/build checks and Rails tests when server
  serialization or behavior changes, inside the existing server container.
- Update checked-in Playwright flows and manual scenario prose/path mappings for
  affected behavior. Agree a representative browser sample per batch, including
  success and failure/retry where applicable; record deferred coverage explicitly.
- Capture and inspect matched before/after screenshots for changed UI flows. Update
  tracking timestamps only for scenarios actually exercised.
- Compare bootstrap measurements under equivalent conditions. Keep an optimization
  only when it eliminates work without an unjustified payload or maintenance cost.

The core plan is complete when the selected duplication has been removed, static
markup and UI lifecycle have clear owners, JSON mutations reconcile browser state
reliably, and all selected batches pass their gates. It does not require removing
all browser modules, adding HTML endpoints or enabling case-page Turbo Drive.

## Execution record

**2026-10-05: batches 1 and 2 complete for the scorer-selection pilot; batch 3
complete for page-supplied bootstrap data; batch 4 complete for Tune Relevance;
batch 5 complete for the audited one-off modal lifecycles; the judgement book
choices group of batch 6 is complete, while batch 6 remains open.**
The existing restriction on parallel HTML endpoints
does not block this plan.

### Batch 1: baseline and pilot scope

Measured in Playwright MCP against the existing development server on port 3000,
signed in as the realistic-activity user. Three sequential full-document visits
to case 6 / try 32 used a 1100×850 viewport and the existing browser cache, without
network throttling. Times below are milliseconds since navigation, from Resource
Timing and a MutationObserver of toolbar readiness/query-row creation. Each sample
was collected two seconds after bootstrap readiness. These are local observations,
not a production latency claim or a search-completion benchmark.

| Measurement | Run 1 | Run 2 | Run 3 |
| --- | ---: | ---: | ---: |
| Toolbar ready | 817 | 694 | 689 |
| First query row | 826 | 696 | 691 |
| First customer-engine request starts | 814 | 691 | 686 |
| First customer-engine request duration | 403 | 43 | 57 |
| Quepid API requests in the sample window | 14 | 14 | 14 |
| Customer-engine requests in the sample window | 20 | 20 | 20 |

The API count includes last-viewed metadata and score persistence plus the graph's
post-save reload. Customer-engine traffic is separate; cross-origin Resource Timing
reports zero body sizes without timing permission, so those bytes were not measured.

| Initial API data | Consumer / ownership | Observed response body bytes |
| --- | --- | ---: |
| Current user | `user_runtime`; awaited by bootstrap | 377 |
| Case 6 | `case_runtime`; bootstrap settings/selected case | 44,584–44,585 |
| Case scorer | `scorer_catalog`; initiated by `changeSettings` | 5,665 |
| Queries with bootstrap ratings | `live_query_collection`; query store | 5,723 |
| Snapshots | `snapshot-bridge`; snapshot catalog | 996 |
| Scores, initial and after score save | `qgraph`; graph history | 17,651–17,652 each |
| Annotations, twice initially | `qgraph` and `annotations`, independently | 1,406 each |
| Search endpoints, all and case-scoped | wizard and Tune Relevance | 10,846 / 1,490 |
| Mapper catalog | wizard | 6,189 |

The user read precedes the case read; query/scorer loading starts after case data
arrives. The case response contains all tries and sampled scores. For batch 3,
evaluate minimal initial user/selected-try data against those actual consumers;
embedding the entire response would retain much of its existing payload cost.
The duplicate annotation read is a separate candidate, not a reason to introduce
a global response cache. No request reduction has been implemented yet.

Markup inventory: annotations and query-list shells already clone ERB templates.
Scorer rows, team buttons, snapshot-picker rows and judgement book choices still
had JavaScript-built markup; Tune Relevance and wizard also contain dynamic rows
and options. Browser-generated search documents remain a distinct responsibility.

Selected pilot: `pick_scorer_core_controller.js` and its core modal only. Rails owns
the row shell; Stimulus fills scorer name/id and selection state. JSON APIs own
catalog loading and persistence; `pick-scorer:selected` hands successful selection
to the live-query runtime and header refresh. Management scorer pages retain their
own behavior. The scope includes both default/custom row rendering, existing empty
and communal-only handling, failure/retry and reopen; it does not redesign the modal
or add lifecycle/state facades.

### Batch 2: implementation and verification

- Added `core/_scorer_list_template.html.erb`, rendered inside the existing modal.
  The controller clones the row, inserts names as text and supplies its scorer ID;
  classes, action and target stay in ERB. Replaced four `innerHTML` clearing sites
  with `replaceChildren` and removed that controller's lint-baseline allowance.
- Existing unit contracts now load the actual ERB template. Added safe-name and
  repeated-render coverage; Rails rendering asserts that the modal includes it.
  The checked-in Playwright scorer test now forces a save error, retries, reloads
  and verifies the persisted selection on reopen, retaining its `afterAll` cleanup.
- Passed: full Vitest (165 files / 1,465 tests), changed-file ESLint, case bundle build,
  `core_controller_test.rb` (14 tests / 130 assertions), and targeted Playwright
  scorer flow plus authentication setup (2 passed).
- Covered live: default selection, forced save failure/retry, instant rescore,
  header update, persisted reopen and Cancel on disposable clones 630 and 632.
  Both were deleted; API 404 confirmed for 630. Source fixture ratings/settings
  were not edited.
- Screenshots captured and inspected under `.playwright-mcp/json-workspace/`:
  `scorer-list-clone`, `scorer-save-error`, `scorer-saved` before/after pairs.
  Modal appearance is preserved. Saved-state backgrounds differ as accumulating
  score history makes the graph visible and changes header wrapping; those images
  are not claimed pixel-identical. Scenario 4.8 records the actual sampled coverage.
- Deferred live coverage: custom-scorer selection, empty catalogs, communal-only
  configuration, inaccessible scorer and Create New Scorer navigation. Existing
  unit contracts cover custom/configuration/warning behavior. A broader workspace
  sweep and Drive migration were not part of this pilot.

### Batch 3: page-supplied bootstrap data

Rails now embeds the authorized current user and case in the bootstrap controller's
Object value. `core/_bootstrap.json.jbuilder` reuses the existing case, current-user
and try serializers. The user/case runtime owners apply their existing normalization
and selection contracts; the bootstrap capability no longer exposes the initial
user/case fetch methods. No HTML endpoint or second selected-case owner was added.
Fresh API reads and mutations retain their existing contracts.

All tries remain necessary for Tune Relevance history, details, delete/duplicate
guards and navigation. Loading only the selected try would require another history
loading lifecycle. Instead this batch excludes graph-owned scores and the duplicate
nested search-endpoint objects; flat try fields retain mapper settings, credentials,
options, curator variables and field specifications. The try serializer's optional
`no_endpoint` flag leaves ordinary API responses unchanged. Tries preload their
endpoint and curator-variable associations.

The JSON attribute is explicitly converted to an ordinary String before ERB escapes
it, because render results can be marked HTML-safe. Escaping tests exercise quotes,
ampersands and script-like case names. The page uses `private, no-store` cache control
because embedded try settings include user-scoped credentials. Inaccessible or
missing cases still return 404 before rendering data; explicitly invalid try numbers
retain the existing visible bootstrap error. Solr JSONP and full-page protocol and
navigation boundaries are unchanged.

#### Measurements

Three before and three final after visits to case 6 / try 32, using the same
Playwright MCP session, cache, 1100×850 viewport, no throttling, and a two-second
window after readiness. Final after measurements ran after other test commands
finished. Times are milliseconds from navigation; bytes are decoded Resource Timing
body sizes, not compressed wire traffic. Local observations do not establish a
production speedup or customer-engine completion latency.

| Measurement | Before 1 | Before 2 | Before 3 | After 1 | After 2 | After 3 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Toolbar / first-search readiness | 657 | 729 | 692 | 633 | 553 | 522 |
| First query row | 659 | 738 | 693 | 635 | 556 | 525 |
| Page response end | 83 | 97 | 94 | 181 | 122 | 127 |
| Quepid API requests | 14 | 14 | 14 | 12 | 12 | 12 |
| Page bytes | 158,996 | 158,996 | 158,996 | 201,682 | 201,682 | 201,682 |
| API response bytes | 115,766 | 115,756 | 115,762 | 70,796 | 70,796 | 70,796 |

The initial JSON is 30,153 bytes; attribute escaping adds HTML overhead. Combined
page/API bodies decrease from about 274.8 KB to 272.5 KB, so this is principally
removal of two sequential requests, not a large byte reduction. The page response
itself takes longer, while median toolbar readiness improves from 692 to 553 ms.
Final after first customer-engine requests start at 630 / 552 / 519 ms, with
durations of 62 / 91 / 104 ms; all visits retain 20 customer-engine requests.
Before customer-engine timing was not separately captured in this repeat baseline;
the earlier batch-1 observations above remain separate measurements.

#### Verification and sampled coverage

- Passed full Vitest: 165 files / 1,467 tests, then the added mismatch rejection
  contract: bootstrap controller 11 tests. Changed-file ESLint, enforced-scope
  Prettier check, changed Ruby/Jbuilder RuboCop and the case bundle build passed.
- Core controller: 16 tests / 145 assertions; existing current-user, case and try
  API controllers: 106 tests / 423 assertions. These cover scoped 404s, invalid
  tries, no-case redirect, request-parameter updates, escaping and cache control.
- Checked-in Playwright: existing case-shell navigation (4 flows) and complete
  wizard creation (1 flow) passed. New `workspace_bootstrap.spec.ts` (3 flows)
  passes direct links/reloads with redundant APIs intercepted, oldest/latest try
  selection, complete history rows and history navigation, invalid try recovery,
  missing-case 404, search failure/reload recovery. Its `afterAll` deletes the clone.
- Review follow-up: failure interception now derives from the cloned try's
  endpoint rather than assuming a snapshot-backed Static URL. The complete
  bootstrap spec passes with the default fixture (4 including authentication),
  and failure/reload recovery passes with `QUEPID_E2E_CASE_ID=6` (2 including
  authentication). Proxy requests are matched by their configured endpoint ID.
- User-approved live sample: scenario 4.17, including direct links and reload,
  case 6 ↔ static fixture 219, history try 32 → 31, all 32 history rows, bare `/case`,
  missing case, inaccessible case 472, invalid try and forced Solr failure/reload
  recovery. Inaccessible case data was absent. Existing wizard completion is
  covered by the checked-in E2E rather than a separate MCP wizard walkthrough.
- Captured and inspected three matching viewport screenshot pairs in
  `.playwright-mcp/json-bootstrap/`: `workbench`, `missing-try`, `search-error`.
  Workbench appearance and visible error behavior are preserved. The failure
  pair captures the immediate rejection state while the remaining search queue
  still shows updating feedback; it does not claim a settled all-query state.
- Deferred: broader scoring, snapshot and management sweeps; this sample does
  not repeat query-options/list controls, zero-case wizard onboarding, try
  deletion or every endpoint/mapper type live. Existing unit/API contracts retain
  coverage of settings normalization, book configuration and mixed protocols.


### Batch 4: Tune Relevance group complete

Restored the flat Tune Relevance form and controller-owned save/navigation handoff.
The settings runtime owns tries and selection; removed its state wrapper, copied
methods, unused version counter and duplicate reload capability. Query/knob/endpoint
edits remain shared; form fields remain local and reset after history mutations.
Wizard update timing and its event/navigation adapter are retained for that consumer.
The approved save-error/retry and repeat-submission guard remain.

- Passed: 165 Vitest files / 1,473 tests, JavaScript lint, runtime formatting,
  case bundle build and eight Playwright tests covering auth, tuning, wizard,
  bootstrap and save/error/retry/reload/history/older-parent ancestry.
- MCP clone 655 confirmed shared query/knob edits, save failure/retry with Settings
  retained, and history rename resetting rows=23 to saved rows=12. Cleanup: 204,
  then GET 404. Current sources and bundle restored after the baseline capture.
- Inspected error and history-reload pairs in `.playwright-mcp/json-settings-parity/`:
  drawer and feedback preserved; error captures differ in search progress/results.
  Tracker entries record partial coverage; no full-workbench parity claim.
- Deferred browser coverage: endpoint swaps, fields/escape/nightly combinations,
  other engines, remaining history failure variants and scoring/snapshot/management.

Save-error feedback fixes a pre-existing defect with approval. Historical source at
`86e3de9f96b0cca87655da51f4d9dc8e92aaa782` lacks rejection handling in
`app/assets/javascripts/controllers/settings.js` and `services/settingsSvc.js`
(lines 592–607); this was source inspection, not a live historical replay.

### Batch 5: one-off modal lifecycle cleanup complete

- `dynamic-modal` now owns Bootstrap show/hide transitions, nested-event guards
  and teardown. `dynamic_modal.js` only clones/populates the shell boundary and
  exposes close; its helper-owned hidden listener and Bootstrap lifecycle were
  removed. Close-before-connect is handled; disconnect during opening waits
  safely for Bootstrap's transition. Existing stacking, body-lock restoration and
  full-document navigation remain in place.
- Detailed Document actions moved from manual helper listeners to ERB actions
  and `detailed-document`. Browse and Explain Query have modal-owned controller
  instances instead of retaining their work on a result-row launcher. Explain
  Query removes listeners, cancels feedback timers, disposes Bootstrap tabs and
  ignores closed/superseded template responses. Existing error/copy behavior is
  retained; no endpoint or additional shared state owner was introduced.
- Frog Report unsubscribes and finalizes charts on hide/disconnect. Charts render
  into a detached host and only the latest result mounts; obsolete results are
  finalized. A successful in-flight foreground book refresh still reloads shared
  queries after close, while late feedback and navigation require the original
  connection. Missing Documents already has request-generation/editor cleanup;
  its implementation was retained.
- Passed: full Vitest (168 files / 1,492 tests), JavaScript lint, enforced-scope
  formatting, core bundle build and core controller rendering (16 tests /
  145 assertions). Final `workspace_modal_lifecycle.spec.ts` passes four flows
  plus authentication: repeated detail dismissal, template failure/retry and
  stale responses/navigation, refresh failure/retry and chart races, and repeated
  nested Debug backdrop dismissal. Existing detail/Frog smoke flows also passed.
- MCP sample: detail open/raw fields/close on case 219; Browse/copy, Params/Parsing,
  tab disposal, forced template error and delayed close/reopen, fully-rated Frog
  chart and refresh failure/retry, and finder/nested Debug on case 6. Book settings
  were changed only in memory and refresh PUT responses intercepted; template
  responses used the existing outlet seam. No disposable users, teams or cases
  were created. Tracker entries record partial coverage and actual timestamps.
- Captured and inspected ten viewport pairs under
  `.playwright-mcp/json-lifecycle/`: detail/fields, Explain Params/template error,
  Browse/copy, Frog normal/error, nested Debug/backdrop close. Modal appearance
  is preserved; background toasts, scroll offsets and search progress differ.
  The extra nested Escape pair records the baseline limitation below, and an
  after-only screenshot records current-template rendering after a delayed reopen.
  Current sources and bundles were restored and checked after helper-only baseline
  captures. Ownership docs and scenario prose/path mappings are updated.
- Deferred live coverage: real ES/OpenSearch template rendering, real book sync
  and 50+ query background refresh, external document/browse navigation,
  credentials, translations/embeds, other engines, full JSON-tree interactions,
  and broader snapshot/management flows. Existing unit contracts retain rendering,
  sanitation and foreground/background refresh behavior.

Nested Escape can close the finder while leaving Debug open in both the live
pre-batch helper baseline and current code. Backdrop dismissal closes only the
inner modal and retains the finder/scroll lock. Historical pre-removal source at
`86e3de9f96b0cca87655da51f4d9dc8e92aaa782` (`services/quepidModalSvc.js`) constructs
BS5 modals with `focus: true`, stacks their z-indices and restores body lock, but
has no explicit focus-trap handoff. This is source inspection, not a live
historical replay; Angular-regression classification remains unresolved. The
unchanged Escape behavior is recorded for separate investigation, not changed by
this lifecycle batch.

### Batch 6: judgement book choices complete

Rails now owns None/book-row structure in `core/_judgement_book_templates.html.erb`.
`judgements-core` clones rows, inserts names as text and supplies IDs and View URLs.
The server supplies the View URL template relative to the existing base element,
preserving subpath navigation. Removed three `innerHTML` sites and their lint
allowance. Existing ordering, selection/Cancel, sync flags, JSON persistence and
refresh events retain their owners; no new state or lifecycle abstraction was added.

- Passed: full Vitest (168 files / 1,493 tests), JavaScript lint, core build,
  changed Ruby RuboCop and core rendering (16 tests / 149 assertions). Unit contracts
  use the shipped templates and cover safe names, repeated rendering, selection
  and supplied URLs. The strengthened toolbar Playwright flow passes with auth
  (2 tests), covering View/Cancel, save failure/retry, reopen, disconnect/reload,
  load failure/reopen and empty states; its disposable case uses `afterAll` cleanup.
- MCP sample covered the same settings paths on clone 660; no-team/no-book states
  and load/save errors used intercepted responses. Both sync flags were off for
  successful linking, so no book data or fixture ratings were changed. Deleted
  the clone (204) and confirmed GET 404.
- Captured and inspected six viewport pairs under `.playwright-mcp/json-judgements/`:
  list, save-error, reopened, load-error, no-books and no-teams. Modal appearance
  and feedback are preserved; background progress, scroll position and toasts
  differ. The latter three baselines used the pre-batch controller from HEAD;
  current sources/bundles were restored, and final relative View navigation checked.
- Deferred: real Populate/Refresh/Sync, background jobs, Create/Judge shortcuts,
  multi-team catalogs and wider management coverage. Team lists, snapshot selectors
  and export configuration remain candidates to assess individually; this completes
  the judgement choices group, not all of batch 6.

### Remaining-work audit (2026-10-05)

This is a source and coverage audit, not new live verification. It examines the
remaining batch-6 candidates, settings/history ownership, the completed modal
helper boundary, workspace construction/forwarding and the duplicate annotation
reads recorded in the baseline. The governing goal is fewer lines and clearer
Rails/Stimulus ownership, not converting every `createElement` into a template.
No implementation or manual verification timestamps were changed by this audit.

| Candidate | Current source evidence | Recommendation |
| --- | --- | --- |
| Compare Snapshots | `diff_core_controller.js#renderSelections` constructs the whole row: layout styles, label, select, two buttons, icons and actions. `core/_diff_modal.html.erb` owns only the surrounding shell. | Strongest remaining conversion: an ERB row template removes substantial static structure from the controller. Keep options and computed labels dynamic. |
| Core Share Case | `share_case_core_controller.js#renderTeamList` creates one button per team and receives classes/actions from its two callers. The modal shell and forms already live in ERB. | Conditional small conversion: only proceed if the complete patch improves clarity without disproportionate template/target plumbing. This removes markup construction, not a second state owner or manual listeners. |
| Export configuration | `_export_case_core_modal.html.erb` already owns format controls, descriptions and links. `_loadSnapshots` only creates blank/data options for three selects; download dispatch and CSV generation serve distinct formats. | Retain. Moving a bare option into a template would add plumbing without removing meaningful structure or orchestration. No persisted export-configuration owner was found here. |
| Tune Relevance/history | History already clones `historyItemTemplate`; `settings_runtime.js` owns tries and mutation reconciliation. Local form fields and shared query/curator/endpoint edits retain different contracts. | Do not reopen batch 4 without evidence of duplicate ownership. Endpoint-suggestion buttons and try-variable rows are small remaining markup candidates, deferred from this completion scope. |
| Wizard | Built-in engine choices and steps are ERB; mapper/endpoint options and removable draft-query chips remain dynamic. | Retain in this scope. The small chip shell is a possible later template extraction, not a reason to rewrite wizard settings or validation. |

The snapshot registry/hydration bridge, comparison selection store and live-query
scoring adapter serve different responsibilities. Their presence is not evidence
of redundant state. Likewise `dynamic_modal.js` now delegates lifecycle, and
`detailed_document_modal.js` retains population/sanitation rather than its removed
action listeners. Retain those boundaries; separately assess the forwarding layers
used to reach them.

The runtime audit found a stronger deletion candidate than team-button markup:
`configuration_runtime.js` (31 lines) receives bootstrap writes, but none of its
getters has a production caller. Scorer and query-list flags already arrive from
Rails as their own controllers' Boolean values; navigation owns the active IDs.
Remove this unused copy, its factory/forwarding/bootstrap plumbing and redundant
bootstrap flag attributes as one group, after confirming consumer and failure
contracts. Keep the live bootstrap case/try attributes.
`user_runtime.loadCurrent` also has no production caller after batch 3; retain user
normalization and wizard completion persistence, but assess deleting that old read.

`core_workspace_runtime.js` is 290 lines, including four per-consumer capability
builders; `core_capabilities_runtime.js` adds 19 lines of async getters over groups
already built synchronously. Much of the builders forwards or renames existing
methods. Simplifying them can remove indirection, but passing all services to every
controller would weaken clarity. Audit the complete four-consumer group (bootstrap,
wizard, tuning and snapshots), preserve necessary adapters such as tuning's
`draft()` versus wizard's `editable()`, and expose existing owners directly where
that eliminates wrappers. Do not add a replacement generic facade. These are
source sizes and deletion candidates, not promised net savings.
The independent Rails/Hotwire source review confirmed the unused-code findings,
but made forwarding simplification conditional on a concrete dependency design.
The async getters preserve Promise/error and microtask behavior: Tune Relevance
uses `.then()`/`.catch()`, while the other consumers await them. Preserve startup
timing, scoped dependencies and method receiver binding as well as data contracts;
synchronous construction alone does not justify removing the async interface.

#### Proposed remaining sequence and gates

1. **[MIGRATION-FOLLOWUP] Unused bootstrap/configuration-state deletion complete
   (2026-10-05; verification below).**
   Assess redundant forwarding as a separate conditional follow-up, using a
   concrete patch and preserving Promise/startup-order and receiver-binding
   contracts. Retain forwarding when removing it increases consumer complexity.
   This follows
   batch 4's ownership criteria rather than treating its completed tuning group as
   proof that all workspace plumbing is minimal. Preserve shared instances,
   normalization, wizard update timing, tuning save/history reconciliation,
   snapshot hydration and protocol/navigation behavior. Verify direct-link/reload
   and invalid-try bootstrap, flags at their actual consuming controllers, wizard
   completion, tuning save/error/retry and snapshot apply/clear. Keep existing
   behavioral tests; tests solely exercising deleted unused getters do not create
   a production requirement. Record production JS + ERB additions/deletions
   separately from tests/docs, and explain every retained adapter.
2. **[MIGRATION-FOLLOWUP] Establish the Compare Snapshots baseline, then complete
   the row-template group.** Preserve the five-row limit, selection order, duplicate
   and processing warnings, Remove versus Delete, delete confirmation, apply/clear
   behavior and failure-retained selections. Keep hydration/scoring in the bridge.
   Existing Vitest contracts cover these operations and rejected bridge commands;
   checked-in Playwright covers creation/listing, duplicate warning, apply, diff
   badges and clear, but not delete or forced picker/bridge failure/retry. Extend
   that coverage on a disposable case with `afterAll` cleanup. Sample scenario
   5.3: multi-row selection, apply/reopen/clear, delete cancel/confirm, load failure
   and apply/delete failure/retry, including visible diff scores. Capture and inspect
   matching baseline/current states; defer large/background snapshots and other
   engines explicitly. Source shows every selection change replaces all rows, so
   establish current focus behavior before choosing a keyed update strategy. The
   plan's focus-preservation gate does not authorize silently improving a baseline
   defect. Slow close/reopen behavior also needs a baseline before any lifecycle fix.
3. **[MIGRATION-FOLLOWUP] Assess the smaller Core Share Case template group against
   the same deletion/clarity gate.** If selected, complete it end-to-end:
   Preserve mutually exclusive/toggle-off selection, distinct no-teams versus
   all-teams-shared states, API stay-on-page mutations and the judgement-modal
   outlet. Keep the management `share-case` surface's select/form/redirect contract
   separate. Unit tests cover load/share/unshare errors, events and cross-case stale
   loads. `share_case.spec.ts` covers both surfaces and the outlet, but changes
   fixture memberships to establish its starting state; use a disposable case for
   the new mutation/error sample. Scenario 6.5's latest recorded sample only opened
   and closed the modal. Verify share/unshare persistence after reload, Cancel,
   load failure/reopen, mutation failure/retry and no-team/all-shared states, with
   inspected before/after pairs. Same-case reopen races are an investigation gate,
   not an established regression or an authorized behavior change.
4. **[MIGRATION-FOLLOWUP] Close the plan with explicit dispositions.** Record the
   selected groups' removals and verification, retain Export and the small wizard/tuning
   candidates with the rationale above, and update ownership docs/tracker paths
   for templates actually added. Completion means the selected groups pass their
   gates; it does not imply exhaustive workspace verification.

The duplicate initial annotation GET remains measurable (list and graph each load
their own projection). Sharing it would require a request/data ownership contract
that preserves list errors, graph refresh and `annotations:changed`; embedding it
alone would not remove both reads. Defer that optimization unless its benefit
justifies the additional coordination. Later snapshot catalog reads on modal open
also refresh server data; do not replace them with the bootstrap registry merely
because the URL overlaps.

Known accessibility defects in Compare/Export and the unrated-snapshot TREC export
failure are already marked `[PREEXISTING]` in [todo.md](todo.md). They need separate
authorization, not incidental fixes during template extraction. Nested Escape is
still separately unresolved as recorded under batch 5. Case-page Drive and parallel
HTML endpoints remain outside this plan.

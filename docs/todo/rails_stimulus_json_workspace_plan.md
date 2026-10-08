# Remaining case-workspace follow-ups while keeping JSON APIs

The selected simplification batches are complete. This file retains conditional
follow-ups and deferred verification; actual browser coverage remains in the
[manual testing tracker](../manual-testing/tracking.yml).

Keep Rails responsible for static structure, authorization and URLs; Stimulus
owns interactions and JSON requests. Browser modules/stores retain direct search,
unsaved tuning values, documents and instant scoring. Follow the
[ownership map](../app_structure.md),
[Stimulus HTTP conventions](../../DEVELOPER_GUIDE.md#stimulus-http-conventions)
and [case-page lifecycle contract](../../DEVELOPER_GUIDE.md#turbo-on-the-case-page).
Preserve behavior; product changes and pre-existing defect fixes require separate
authorization. Targeted HTML endpoints for persisted case UI are permitted;
existing JSON API contracts and browser-owned state remain intact.

## First HTML conversion: annotations list — complete

`CaseAnnotationsController` returns Rails-rendered rows for list/create/update;
Stimulus mounts the fragments and retains browser score capture, relative timestamps,
`annotations:changed` and the existing edit modal lifecycle. Writes retain JSON
payloads; the separate JSON API retains its response contracts. Shared creation
logic preserves persistence and parameter filtering.

This uses explicit fragment requests rather than frame navigation: create prepends
one row and edit retains its position, while a full list reload follows persisted
ordering. The modal shell stays outside replacement. Success/error UI and drafts
remain controller-owned. No second read is needed after a successful write.

Verified create, edit/cancel, failure/retry, reload, delete and graph refresh;
matched screenshot pairs are in `.playwright-mcp/annotations-html/`. Rails contracts,
controller unit tests and the annotation E2E passed. The tracker records partial
coverage; no-score browser state and graph tooltip/empty-state checks remain deferred.

Review follow-up: edit responses now match rows by ID after an intervening delete;
the regression test and updated core-page assertions pass (32 Rails tests,
8 JavaScript tests, ESLint). Browser verification passed against a separate
pre-fix worktree at `/private/tmp/quepid-annotations-review`: overlapping delete/edit
leaves stale text before and displays the saved edit after. Matched viewport
screenshots were inspected in `.playwright-mcp/annotations-edit-race/`;
reload retained the edit and temporary annotations were removed.

## Conditional follow-ups

1. **[MIGRATION-FOLLOWUP] Assess runtime forwarding only with a concrete dependency design.**
   Review bootstrap, wizard, tuning and snapshot consumers together. Preserve scoped
   dependencies, shared instances, Promise/error/microtask timing, startup order and
   method receiver binding, including tuning's `draft()` versus wizard's `editable()`.
   Retain adapters when removal increases consumer complexity; avoid a generic facade.
   Verify direct-link/reload and invalid-try bootstrap, consuming-controller flags,
   wizard completion, tuning save/history/error/retry and snapshot apply/clear.
   Record production additions/deletions separately from tests/docs.

2. **[MIGRATION-FOLLOWUP] Assess duplicate initial annotation reads.**
   The list and graph each load their own projection. Sharing a read requires an
   ownership contract preserving list errors, graph refresh and `annotations:changed`;
   embedding data alone does not remove both reads. Proceed only if the saved work
   justifies the coordination. Snapshot catalog reads on modal open refresh server
   data and should retain that contract.

3. **[MIGRATION-FOLLOWUP] Investigate unresolved modal behavior before proposing changes.**
   Snapshot selection replaces all rows and loses select focus; a keyed update would
   change the baseline behavior. Same-case sharing response races remain unclassified.
   Nested Escape can close the finder while leaving Debug open in the live pre-batch
   and current implementations; backdrop dismissal retains the finder and scroll lock.
   Historical source at `86e3de9f96b0cca87655da51f4d9dc8e92aaa782`
   (`services/quepidModalSvc.js`) has stacking/body-lock handling but no explicit
   focus-trap handoff. This is source inspection, not live historical replay;
   Angular-regression classification remains unresolved.

Retain Export's dynamic options and the small wizard/tuning rows unless a future
patch demonstrates meaningful simplification. Retain modal population/sanitation
helpers, snapshot registry/hydration/comparison/scoring owners and existing
forwarding interfaces pending the assessment above. Compare/Export accessibility
and unrated-snapshot TREC export defects remain `[PREEXISTING]` work in
[todo.md](todo.md), requiring separate authorization.

## Deferred browser coverage

These are coverage gaps, not established defects or incomplete implementation batches.
Use representative samples and record actual results in the tracker.

- Scorer selection: custom/inaccessible scorers, empty catalogs, communal-only
  configuration and Create New Scorer navigation.
- Bootstrap/settings/history: zero-case onboarding, endpoint swaps, fields/escape/
  nightly combinations, TLS/static and other engines, remaining history failures,
  Scores/Ratings links and visualizer.
- Modal tools: real ES/OpenSearch template rendering, real book sync and large
  background refresh, external document/browse navigation, credentials,
  translations/embeds and full JSON-tree interactions.
- Judgements: real Populate/Refresh/Sync, jobs, Create/Judge shortcuts and multi-team
  catalogs.
- Snapshots: distinct multi-snapshot ordering, processing/large/background captures,
  expanded comparisons/popovers and other engines.
- Sharing: multi-team mutual exclusion, same-case response races, team creation and
  management mutation/redirect flows.
- Broader scoring, search, export, snapshot and management sweeps remain separate
  verification work; prior samples do not establish exhaustive workspace parity.

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

## Verification for selected follow-ups

Follow the repository's [testing guidance](../../DEVELOPER_GUIDE.md) and
[manual sampling policy](../../DEVELOPER_GUIDE.md#manual-testing-tracker).
Run relevant unit/Rails tests and lint/build checks in the existing server container.
Preserve behavioral contracts, exercise success and failure/retry, inspect matched
before/after screenshots and record deferred coverage. Update timestamps only for
scenarios actually exercised. Compare optimization measurements under equivalent
conditions and retain changes only when they remove justified maintenance/runtime cost.

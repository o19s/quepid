# Deangularization execution plan

This is the execution checklist for the remaining AngularJS removal work on
the core case page.

When asked to “look at `docs/todo/deangularization_execution_plan.md` and do
what is next”, execute the first incomplete batch below. A batch is
intentionally large enough to remove a dependency path end-to-end, but must
remain independently reviewable and reversible. Do not replace a batch with a
small preparatory refactor unless a concrete safety blocker is found and
documented here.

## Current position

Step 4 is active: finish removing the live-query runtime initializer and the
remaining Angular bootstrap dependency after the adapter groups and their
consumers have been proven through framework-free tests and browser checks.

The injectable `queriesSvc` registration, core provider lookup, and retained
legacy service object have already been removed. The live-query runtime is now
initialized by the Stimulus core bootstrap through an explicit capability
object; Angular supplies only the still-legacy service dependencies.

## Operating rules for every batch

Before editing:

1. Run `docker compose ps app`. If the permanent `app` container is running,
   use `docker compose exec app`; never create or replace an app container.
2. Read the relevant Angular templates/controllers, the corresponding
   Stimulus/ERB surface, and `docs/todo/event_bus_inventory.md` when events
   are involved.
3. Run the relevant Karma baseline before deleting or changing Angular
   contracts. Record the command and result in the final handoff.
4. Run `bin/manual_test_status` for every tracked path touched by the batch.
5. Capture the affected core-case browser state before editing when the
   behavior is user-visible. Keep before/after screenshots paired and inspect
   both images.

During editing:

- Preserve core-case behavior separately from Rails-page behavior. Do not
  collapse unlike surfaces into one partial or controller.
- Use explicit ESM stores, adapters, and CustomEvents for new boundaries. Do
  not add another arbitrary injector lookup from modern code.
- Keep URLs server-owned and use `apiFetch` for mutating JSON requests.
- Do not change live-query transport, score timing, Solr JSONP behavior, or
  try-navigation semantics as incidental cleanup.
- Keep the Angular implementation alive until every consumer has moved and
  the replacement has browser proof.

Before declaring a batch complete:

- port the relevant Karma contracts to Vitest, or document why a contract is
  intentionally retained;
- run focused Vitest tests, then the full Vitest suite and `yarn lint:js`;
- run the relevant Rails tests if a controller/view or endpoint changed;
- drive the affected Playwright/manual scenarios against the live app;
- update `docs/manual-testing/tracking.yml` and scenario prose when behavior
  or ownership changed;
- inspect the before/after screenshots;
- update `docs/todo/angularjs_removal_inventory.md` with the removed dependency
  path and remaining bridge;
- leave all unrelated user changes, including untracked files, untouched.

## Step 4: remove Angular bootstrap and dead services

Step 4 is the deletion phase. It starts only after modern consumers and event
dependencies have moved behind tested boundaries.

### Current execution checklist

- [x] Extract the initializer's `$http`, `$q`, digest scheduling, settings,
  scorer, searcher, document, and explain callbacks into explicit adapter
  groups with framework-free contracts.
- [x] Cut the capability and command consumers over to those adapter groups;
  leave the initializer responsible only for wiring, not query behavior.
- [x] Port the remaining initializer boundary contracts to Vitest and remove
  its Angular/Karma spec.
- [x] Move runtime initialization behind the framework-free case bootstrap and
  remove the asset-pipeline initializer.
- [x] Run the full Vitest/Karma/ESLint gates; re-drive the affected core
  workbench bootstrap scenario and retain the existing tracked search, rating,
  snapshot/diff, and mutation coverage.

This checklist is the active work queue for the final live-query migration;
do not mark the batch complete at the provider-removal boundary alone.

Progress note: the framework callback group now owns request, GET, promise,
digest scheduling, logging, resolve, and reject callbacks. Settings, scorer,
navigation, and the remaining settings/scoring callbacks now cross explicit
domain adapter groups. Splainer search, document factories, normalization, and
explain callbacks are supplied through the named framework-free
`splainerSearch` capability. Public capability,
command, lifecycle, and targeted-search registration now goes through a tested
framework-free installer. Runtime initialization now lives in
`app/javascript/utils/live_query_runtime_initializer.js` and is invoked by
`core_bootstrap_controller.js`; no Angular run block or asset-pipeline
initializer remains. The core bootstrap no longer resolves Splainer search,
document, explain, or engine-classification services from Angular; those are
published by `splainer_search_adapter.js` as the named `splainerSearch`
capability. Remaining Angular dependencies are now the Quepid case/settings,
scorer, navigation, and live-query transport boundaries.

## Deletion order

1. Generate a fresh consumer inventory for each candidate Angular service,
   directive, template, factory, and bundle entry.
2. Delete only services with zero runtime consumers outside tests or explicitly
   retained legacy paths.
3. Remove their Karma specs only after replacement contracts exist in Vitest or
   Rails tests.
4. Remove obsolete Angular component registrations, templates, controllers,
   and bundle imports.
5. Remove compatibility-adapter methods one capability at a time, with a
   failing test first for any accidental consumer.
6. Rebuild the affected Angular/vendor bundles and verify the page does not
   load the removed code.
7. Keep the final Angular bootstrap only for genuinely remaining legacy code;
   then remove it in a separate, reviewable commit.

## Deletion safety gates

- `rg` consumer inventory is clean for every deleted symbol.
- Karma and Vitest baselines pass, with intentional test deletions documented.
- Rails tests and affected Playwright/manual scenarios pass.
- Browser console has no new errors or unhandled promise rejections.
- Case navigation, scoring, rating, snapshots/diffs, wizard, tune relevance,
  export, and error paths have been exercised according to their tracked
  scenarios.
- Bundle-size or asset inventory changes are recorded so accidental
  reintroduction is detectable.

## Commit and handoff shape

Use one commit per completed batch, not one commit per adapter method.
Preferred messages:

- `refactor(core): remove injector lookups from case controllers`
- `refactor(core): replace migrated Angular events with explicit stores`
- `chore(core): remove unused Angular case services`

Every handoff should state:

- which batch was completed;
- which Angular services remain and why;
- exact test/manual commands and results;
- screenshot locations;
- the next unchecked acceptance criterion in this document.

If a safety gate blocks the batch, record the blocker and the smallest safe
prerequisite here, then stop at that boundary. Do not silently shrink the
requested batch into unrelated micro-changes.

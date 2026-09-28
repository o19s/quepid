# Angular event-bus inventory

Living inventory of every cross-controller / cross-service event flowing through
the AngularJS bundle (`app/assets/javascripts/`). Re-run the [methodology](#methodology)
before deleting any emitter or listener — hidden `$broadcast` consumers are easy to
break silently.

As Angular slices migrate to Stimulus (see
[`angularjs_removal_inventory.md`](./angularjs_removal_inventory.md)),
replace each row's emitter and listeners with `apiFetch` re-fetch and/or
`CustomEvent`, then remove the row from this table.

**Out of scope:** framework routing events (`$routeChangeSuccess`, etc. in
`angular-route`), vendor wizard events (`wizard:stepChanged`), and Stimulus/native
events in `app/javascript/` (`vega:load`, `change` on scorer scale). This doc
covers only Quepid application events.

## Mechanisms in use

| Mechanism | Purpose | Direction |
|-----------|---------|-----------|
| `CustomEvent` | Named application boundary for lifecycle and one-shot actions | document/root → listeners |
| `EventTarget` store | Observable state boundary for query/document and score/rating state | store → subscribers |

The former Angular `$emit`, `$broadcast`, and `$on` mechanisms are retained
here only as historical terminology for the migration audit; application code
no longer uses them.

There are no remaining application-level Angular broadcast implementations.

### `$rootScope` aliased as `$scope` (grep trap)

Three singleton services inject `$rootScope` but name the parameter `$scope`.
Static searches for `$scope.$on` under-count root listeners; read the DI array,
not the parameter name.

| Service | File | Actual scope |
|---------|------|--------------|
| `queriesSvc` | `utils/live_query_runtime_initializer.js` | explicit runtime callbacks |

The remaining Angular listener is now a native document event; no application
event uses `$rootScope.$emit` / `$rootScope.$on`.

## Event table

The migrated core uses explicit `CustomEvent`s and `EventTarget` stores. The
legacy Angular bus is no longer used by application code. Ratings retain a
native document-event fallback for bundles that do not load the modern store.

| Event name | Emitter(s) | Listener(s) | Listener kind | Notes |
|------------|------------|-------------|---------------|-------|
| `rating-changed` | `CaseScoreStore` | `queriesSvc.js`, `qscore_case_controller.js` | EventTarget store | Normal rating-change path. |
| `ratings:changed` | `queriesSvc.js` | `queriesSvc.js` | native event | Compatibility fallback when an older Angular bundle has no `CaseScoreStore`; payload is `{ queryId }`. The framework-free `RatingsStore` now calls the query service's notification callback directly. |
| `scoring-complete` | `CaseScoreStore` | `qscore_case_controller.js`, `qgraph_controller.js` | EventTarget store | Fully migrated from the former Angular score event. |

## Step 3 classification

| Category | Events | Boundary |
|----------|--------|----------|
| Query/document state | `case-book:associated`, `query-options:saved`, `query-diffs:refreshed`, `queries-state:changed` | Named document `CustomEvent`s; Angular remains the live query owner where noted. |
| Score/rating state | `rating-changed`, `scoring-complete`, `ratings:changed` | `CaseScoreStore` for the normal path; native document fallback only when the modern store is absent. |
| Navigation/bootstrap lifecycle | `core-bootstrap:ready`, `core-bootstrap:failed`, `quepid:case-header-stale` | Named document `CustomEvent`s with Stimulus connect/disconnect ownership. |
| Modal/action completion | `quepid:case-team-changed`, `case-score:persisted`, `judgements:book-settings-saved` | Named document `CustomEvent`s; payloads are documented at emitters and covered by focused tests. |
| Legacy-only/dead | `caseSelected`, `fetchedDropdownCasesList`, `caseUpdate`, `settings-changed`, `updatedQueriesList` | Removed; no replacement event is emitted. |

The dead broadcasts `caseSelected`, `fetchedDropdownCasesList`, `caseUpdate`,
`settings-changed`, and the commented `updatedQueriesList` were removed rather
than replaced with no-op events.

## Listener index

| File | Kind | Events | Deregisters? |
|------|------|--------|--------------|
| `controllers/qscore_case_controller.js` | store | `scoring-complete`, `rating-changed` | yes (`disconnect`) |
| `controllers/qgraph_controller.js` | store | `scoring-complete` | yes (`disconnect`) |
| `utils/live_query_runtime_initializer.js` | document + store | `case-book:associated`, `query-options:saved`, `rating-changed`, `ratings:changed` | app lifetime / store-owned |

## Migration-relevant observations

1. The ratings compatibility path remains intentionally until the live
   query/scoring migration removes the last Angular-only bundle path, but it no
   longer crosses the Angular root event bus.


## Methodology

Emitters, listeners, and line numbers re-verified 2026-09-21 from:

```bash
# Emitters
rg "broadcastSvc\.send" app/assets/javascripts/
rg "\$scope\.\$emit|\$rootScope\.\$emit" app/assets/javascripts/

# Listeners — also read the DI array in queriesSvc.js
rg "\$scope\.\$on|\$rootScope\.\$on" app/assets/javascripts/

# Dead-event sanity check (each event name)
rg "caseUpdate|settings-changed|updatedQueriesList" app/assets/javascripts/
```

Re-run on each Angular slice migration to keep the table honest. Drop rows
when the emitter and all listeners have moved off Angular.

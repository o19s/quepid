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
| `broadcastSvc.send(name, data)` | App-wide pub/sub. Wraps `$rootScope.$broadcast` | downward (root → all child scopes) |
| `$rootScope.$broadcast(name, data)` | Direct fan-out from root. Only used inside `broadcastSvc` itself | downward |
| `$scope.$emit(name, data)` | Bubbles up the scope chain to ancestor `$on` handlers | upward |
| `$rootScope.$emit(name, data)` | Fires `$on` handlers registered on `$rootScope` (no bubbling — root has no parent) | root only |
| `$scope.$on(name, fn)` / `$rootScope.$on(name, fn)` | Subscribe | n/a |

`broadcastSvc` (`app/assets/javascripts/factories/broadcastSvc.js`) is a
3-line wrapper around `$rootScope.$broadcast` — there is exactly one
implementation, no other app-level broadcast mechanisms.

### `$rootScope` aliased as `$scope` (grep trap)

Three singleton services inject `$rootScope` but name the parameter `$scope`.
Static searches for `$scope.$on` under-count root listeners; read the DI array,
not the parameter name.

| Service | File | Actual scope |
|---------|------|--------------|
| `queriesSvc` | `services/queriesSvc.js:12,31` | `$rootScope` |
| `ratingsStoreSvc` | `services/ratingsStoreSvc.js:13,15` | `$rootScope` |

`rating-changed` and `scoring-complete` therefore use `$rootScope.$emit` /
`$rootScope.$on` throughout — not child-scope bubbling.

## Event table

The migrated core uses explicit `CustomEvent`s and `EventTarget` stores. The
legacy Angular bus is retained only as a compatibility fallback for ratings.

| Event name | Emitter(s) | Listener(s) | Listener kind | Notes |
|------------|------------|-------------|---------------|-------|
| `case-header:renamed` | `case_toolbar_controller.js` | `caseSvc.js` | native event | Server-rendered header rename updates the Angular-owned case directly. |
| `quepid:case-team-changed` | `share_case_core_controller.js` | `caseSvc.js` | native event | Core share/unshare updates the selected case in memory. |
| `case-book:associated` | `caseSvc.js` | `queriesSvc.js` | native event | Replaces `associateBook`; the query service re-fetches case book-sync flags. |
| `case-settings:updated` | `settingsSvc.js` | `caseSvc.js` | native event | Replaces `settings-updated`; one service-level listener updates current in-memory cases. |
| `rating-changed` | `CaseScoreStore`; legacy fallback in `ratingsStoreSvc.js` | `queriesSvc.js`, `qscore_case_controller.js` | EventTarget store | Store event is the normal path; the Angular fallback remains for older bundles. |
| `scoring-complete` | `CaseScoreStore` | `qscore_case_controller.js`, `qgraph_controller.js` | EventTarget store | Fully migrated from the former Angular score event. |

The dead broadcasts `caseSelected`, `fetchedDropdownCasesList`, `caseUpdate`,
`settings-changed`, and the commented `updatedQueriesList` were removed rather
than replaced with no-op events.

## Listener index

| File | Kind | Events | Deregisters? |
|------|------|--------|--------------|
| `controllers/qscore_case_controller.js` | store | `scoring-complete`, `rating-changed` | yes (`disconnect`) |
| `controllers/qgraph_controller.js` | store | `scoring-complete` | yes (`disconnect`) |
| `services/caseSvc.js` | document | `case-header:renamed`, `quepid:case-team-changed`, `judgements:book-settings-saved`, `case-settings:updated` | app lifetime; one listener per event |
| `services/queriesSvc.js` | document + store | `case-book:associated`, `query-options:saved`, `rating-changed` | app lifetime / store-owned |

## Migration-relevant observations

1. The legacy `broadcastSvc` factory is now unused by Quepid code; remove its
   registration with the final Angular cleanup once no bundle references it.
2. The ratings fallback remains intentionally until the live query/scoring
   migration removes the last Angular-only bundle path.


## Methodology

Emitters, listeners, and line numbers re-verified 2026-09-21 from:

```bash
# Emitters
rg "broadcastSvc\.send" app/assets/javascripts/
rg "\$scope\.\$emit|\$rootScope\.\$emit" app/assets/javascripts/

# Listeners — also read DI arrays in queriesSvc.js and ratingsStoreSvc.js
rg "\$scope\.\$on|\$rootScope\.\$on" app/assets/javascripts/

# Dead-event sanity check (each event name)
rg "caseUpdate|settings-changed|updatedQueriesList" app/assets/javascripts/
```

Re-run on each Angular slice migration to keep the table honest. Drop rows
when the emitter and all listeners have moved off Angular.

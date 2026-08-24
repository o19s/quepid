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

Listeners are split between `$scope.$on` (component-local) and
`$rootScope.$on` (lives until app teardown — leak-prone, must explicitly
deregister). `R` and `S` columns below distinguish them.

| Event name | Emitter(s) | Listener(s) | Listener kind | Notes |
|------------|------------|-------------|---------------|-------|
| `caseSelected` | `caseSvc.js:126` | `headerCtrl.js:64`, `export_case_controller.js:37` | S | |
| `updatedCasesList` | `caseSvc.js:158,220,489,500`, `move_query_modal_instance_controller.js:63` | `headerCtrl.js:49` (loop), `move_query_modal_instance_controller.js:39` (loop) | S | Most-fanned event; five emitters |
| `fetchedDropdownCasesList` | `caseSvc.js:239` | `headerCtrl.js:34` | S | |
| `updatedCaseScore` | `caseSvc.js:301`, `annotationsSvc.js:29,39,71` | `queriesCtrl.js:163`, `annotations_controller.js:42`, `move_query_modal_instance_controller.js:39` (loop) | S | |
| `caseRenamed` | `caseSvc.js:365` | `caseSvc.js:103`, `headerCtrl.js:49` (loop), `move_query_modal_instance_controller.js:39` (loop) | R + S | `caseSvc` listens via `$rootScope.$on` |
| `caseUpdate` | `caseSvc.js:386` | *(none found)* | — | **Dead emit** — no `$on('caseUpdate')` matches |
| `associateBook` | `caseSvc.js:424` | `headerCtrl.js:44`, `queriesSvc.js:65` | S + R | `queriesSvc` listener is `$rootScope.$on` (aliased `$scope`) |
| `caseTeamAdded` | `teamSvc.js:77` | `caseSvc.js:109` | R | |
| `caseTeamRemoved` | `teamSvc.js:94` | *(none found)* | — | **Dead emit** |
| `annotationDeleted` | `annotationsSvc.js:40` | `annotations_controller.js:38` | S | |
| `fetchedDropdownBooksList` | `bookSvc.js:147` | `headerCtrl.js:39` | S | |
| `settings-changed` | `settingsSvc.js:408` | *(none found)* | — | **Dead emit** — emitted on try-list fetch; no listener (COREUI doc reference is stale) |
| `settings-updated` | `settingsSvc.js:549,626` | `caseSvc.js:96` (per `Case` instance), `move_query_modal_instance_controller.js:39` (loop) | R + S | **Leak:** listener registered inside `Case` constructor — one `$rootScope.$on` per constructed case |
| `updatedScorersList` | `scorerSvc.js:68,81,106,148,193` | *(none found)* | — | **Dead emit** — five emitters, zero listeners; `ScorerCtrl` calls `scorerSvc.list()` directly |
| `rating-changed` | `ratingsStoreSvc.js:29` (`$rootScope.$emit` via alias) | `queriesSvc.js:119`, `queriesCtrl.js:67`, `searchResults.js:26` | R | All three listeners are `$rootScope.$on`; `queriesCtrl` deregisters on `$destroy`, others do not |
| `scoring-complete` | `queriesSvc.js:1252` (`$rootScope.$emit` via alias), `add_query_controller.js:49` (`$rootScope.$emit`) | `queriesCtrl.js:54` | R | Both emitters use `$rootScope.$emit`; `queriesCtrl` deregisters on `$destroy` |
| `deepCaseListUpdated` | *(none found)* | `move_query_modal_instance_controller.js:39` (loop) | S | **Dead listener** — no emitter |
| `updatedQueriesList` | `queriesSvc.js:1056` (commented out) | *(none)* | — | Commented-out emit; remove next time someone touches that file |

## Emitter index (`broadcastSvc.send`)

26 active calls across 7 files (+1 commented in `queriesSvc.js`; last counted 2026-08-24):

| File | Count | Events |
|------|-------|--------|
| `services/caseSvc.js` | 10 | `caseSelected`, `updatedCasesList` ×5, `fetchedDropdownCasesList`, `updatedCaseScore`, `caseRenamed`, `caseUpdate`, `associateBook` |
| `services/scorerSvc.js` | 5 | `updatedScorersList` |
| `services/annotationsSvc.js` | 4 | `updatedCaseScore` ×3, `annotationDeleted` |
| `services/settingsSvc.js` | 3 | `settings-changed`, `settings-updated` ×2 |
| `services/teamSvc.js` | 2 | `caseTeamAdded`, `caseTeamRemoved` |
| `services/bookSvc.js` | 1 | `fetchedDropdownBooksList` |
| `components/move_query/move_query_modal_instance_controller.js` | 1 | `updatedCasesList` |

## Listener index (`$on`)

| File | Kind | Events | Deregisters? |
|------|------|--------|--------------|
| `controllers/headerCtrl.js` | S | `fetchedDropdownCasesList`, `fetchedDropdownBooksList`, `associateBook`, `updatedCasesList`, `caseRenamed`, `caseSelected` | scope teardown |
| `controllers/queriesCtrl.js` | R | `scoring-complete`, `rating-changed` | yes (`$destroy`) |
| `controllers/queriesCtrl.js` | S | `updatedCaseScore` | scope teardown |
| `controllers/searchResults.js` | R | `rating-changed` | **no** — one listener per `SearchResultsCtrl` instance |
| `services/caseSvc.js` | R | `caseRenamed`, `caseTeamAdded` | **no** (singleton; acceptable) |
| `services/caseSvc.js` (`Case` ctor) | R | `settings-updated` | **no** — **multiplies per constructed case** |
| `services/queriesSvc.js` | R | `associateBook`, `rating-changed` | **no** (singleton; acceptable) |
| `components/annotations/annotations_controller.js` | S | `annotationDeleted`, `updatedCaseScore` | scope teardown |
| `components/export_case/export_case_controller.js` | S | `caseSelected` | scope teardown |
| `components/move_query/move_query_modal_instance_controller.js` | S | `caseRenamed`, `deepCaseListUpdated`, `settings-updated`, `updatedCaseScore`, `updatedCasesList` | scope teardown |

## Migration-relevant observations

1. **`caseSvc` is the bus hub.** 10 of the 26 active `broadcastSvc.send` calls originate
   there. Any migration that touches `caseSvc` must account for every row above
   where `caseSvc.js` appears — prefer `apiFetch` re-fetch for shared state and
   `document.dispatchEvent(new CustomEvent(...))` only when a surviving Angular
   listener still needs notification during a partial migration.

2. **Dead emits to clean up.** `caseUpdate`, `caseTeamRemoved`,
   `settings-changed`, `updatedQueriesList` (commented), and all five
   `updatedScorersList` emits have no `$on` listeners. Safe to remove after a
   quick template grep confirms no `ng-{{…}}` bindings depended on the digest
   side-effect.

3. **Dead listener.** `deepCaseListUpdated` in
   `move_query_modal_instance_controller.js:31-37` listens for an event no one
   emits. Safe to drop in the same change that touches that file.

4. **`$rootScope.$on` leaks — audit before migrating.**
   - `queriesCtrl` captures deregistration return values and calls them on
     `$destroy` — good pattern to copy.
   - `searchResults.js` registers `$rootScope.$on('rating-changed')` per controller
     instance with no deregister — leaks when query rows are recreated.
   - `Case` constructor (`caseSvc.js:96`) registers `$rootScope.$on('settings-updated')`
     once per `new Case(...)` — accumulates listeners as cases are loaded.
   - Singleton services (`caseSvc`, `queriesSvc`) register root listeners at init;
     acceptable for the app lifetime but must not be copied into per-instance code.

5. **`$emit` on `$rootScope` is not bubbling.** `rating-changed` and
   `scoring-complete` both emit from `$rootScope` (directly or via the `$scope`
   alias). Listeners must be `$rootScope.$on`, not child `$scope.$on`. When
   migrating to `CustomEvent`, dispatch on `document` with `bubbles: true` so
   listeners do not depend on Angular scope ancestry.

## Methodology

Last refreshed 2026-08-24 from:

```bash
# Emitters
rg "broadcastSvc\.send" app/assets/javascripts/
rg "\$scope\.\$emit|\$rootScope\.\$emit" app/assets/javascripts/

# Listeners — also read DI arrays in queriesSvc.js and ratingsStoreSvc.js
rg "\$scope\.\$on|\$rootScope\.\$on" app/assets/javascripts/

# Dead-event sanity check (each event name)
rg "caseUpdate|caseTeamRemoved|settings-changed|updatedScorersList|deepCaseListUpdated|updatedQueriesList" app/assets/javascripts/
```

Re-run on each Angular slice migration to keep the table honest. Drop rows
when the emitter and all listeners have moved off Angular.
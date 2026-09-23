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
| `caseSelected` | `caseSvc.js:183` | *(none found)* | — | **Dead emit** — `headerCtrl.js` was the only listener; removed when the core header dropdowns moved to Turbo Frames (see angularjs_removal_inventory.md) |
| `updatedCasesList` | `caseSvc.js:215,276,541`, `move_query_modal_instance_controller.js:63` | `move_query_modal_instance_controller.js:39` (loop) | S | `headerCtrl.js`'s listener is gone (same removal as above) |
| `fetchedDropdownCasesList` | `caseSvc.js:295` | *(none found)* | — | **Dead emit** — same removal as `caseSelected` |
| `updatedCaseScore` | `caseSvc.js:357`, `annotationsSvc.js:29,39,71` | `queriesCtrl.js:173`, `move_query_modal_instance_controller.js:39` (loop) | S | Annotation CRUD no longer listens directly; the Stimulus controller emits `annotations:changed` for the temporary qgraph bridge |
| `caseRenamed` | `caseSvc.js:126,421` | `caseSvc.js:102`, `move_query_modal_instance_controller.js:39` (loop) | R + S | `caseSvc` listens via `$rootScope.$on`. `:126` is the Stimulus bridge — a `case-header:renamed` CustomEvent from the server-rendered header re-broadcast into Angular. `headerCtrl.js`'s listener is gone (same removal as `caseSelected`) — the recent-cases dropdown is its own Turbo Frame now and doesn't live-refresh on rename either, matching the Rails-page navbar's identical frame |
| `caseUpdate` | `caseSvc.js:454` | *(none found)* | — | **Dead emit** — no `$on('caseUpdate')` matches |
| `associateBook` | `caseSvc.js:168,501` | `queriesSvc.js:74` | R | `queriesSvc` listener is `$rootScope.$on` (aliased `$scope`). `:168` is the Stimulus bridge from `quepid:case-team-changed`. `headerCtrl.js`'s listener is gone (same removal as `caseSelected`) |
| `annotationDeleted` | `annotationsSvc.js:40` | *(none)* | — | **Dead emit** — annotation CRUD now uses Stimulus `apiFetch`; `annotationsSvc.fetchAll` remains only as the temporary qgraph read bridge |
| `settings-changed` | `settingsSvc.js:496` | *(none found)* | — | **Dead emit** — emitted on try-list fetch; no listener (COREUI doc reference is stale) |
| `settings-updated` | `settingsSvc.js:637,727` | `caseSvc.js:94` (per `Case` instance), `move_query_modal_instance_controller.js:39` (loop) | R + S | **Leak:** listener registered inside `Case` constructor — one `$rootScope.$on` per constructed case |
| `rating-changed` | `ratingsStoreSvc.js:29` → `window.quepidStore.scoring` (legacy `$rootScope.$emit` fallback) | Store listeners in `queriesSvc.js`, `queriesCtrl.js`, `searchResults.js` (legacy service fallback only) | R | Store event carries `{ detail: { queryId } }`; per-row listeners deregister on `$destroy` |
| `scoring-complete` | `CaseScoreStore.setLatestScoreInfo()`; legacy add-query emitter removed | Store listener in `queriesCtrl.js` | R | Published after the store's `change`; Angular consumers re-enter through `$evalAsync` |
| `deepCaseListUpdated` | *(none found)* | `move_query_modal_instance_controller.js:39` (loop) | S | **Dead listener** — no emitter |
| `updatedQueriesList` | `queriesSvc.js:1371` (commented out) | *(none)* | — | Commented-out emit; remove next time someone touches that file |

## Emitter index (`broadcastSvc.send`)

19 active calls across 4 files (+1 commented in `queriesSvc.js`; last counted 2026-09-21):

| File | Count | Events |
|------|-------|--------|
| `services/caseSvc.js` | 11 | `caseSelected`, `updatedCasesList` ×3, `fetchedDropdownCasesList`, `updatedCaseScore`, `caseRenamed` ×2, `caseUpdate`, `associateBook` ×2 |
| `services/annotationsSvc.js` | 4 | `updatedCaseScore` ×3, `annotationDeleted` |
| `services/settingsSvc.js` | 3 | `settings-changed`, `settings-updated` ×2 |
| `components/move_query/move_query_modal_instance_controller.js` | 1 | `updatedCasesList` |

Of the 19, 2 became dead emits when `headerCtrl.js` was deleted (core header dropdowns → Turbo Frames):
`caseSelected`, `fetchedDropdownCasesList` (both `caseSvc.js`). A third, `fetchedDropdownBooksList`
(`bookSvc.js`), went dead the same way but was deleted outright along with its now-unreachable
`fetchDropdownBooks()` emitter — see [Migration-relevant observations](#migration-relevant-observations)
§2 — so it no longer appears in this count. `services/bookSvc.js` also drops out of the file list
above as a result: it registered zero other `broadcastSvc.send` calls.

## Listener index (`$on`)

| File | Kind | Events | Deregisters? |
|------|------|--------|--------------|
| `controllers/queriesCtrl.js` | R | `scoring-complete`, `rating-changed` | yes (`$destroy`) |
| `controllers/queriesCtrl.js` | S | `updatedCaseScore` | scope teardown |
| `controllers/searchResults.js` | R | `rating-changed` | **no** — one listener per `SearchResultsCtrl` instance |
| `services/caseSvc.js` | R | `caseRenamed` | **no** (singleton; acceptable) |
| `services/caseSvc.js` (`Case` ctor) | R | `settings-updated` | **no** — **multiplies per constructed case** |
| `services/queriesSvc.js` | R | `associateBook`, `rating-changed` | **no** (singleton; acceptable) |
| `components/move_query/move_query_modal_instance_controller.js` | S | `caseRenamed`, `deepCaseListUpdated`, `settings-updated`, `updatedCaseScore`, `updatedCasesList` | scope teardown |

## Migration-relevant observations

1. **`caseSvc` is the bus hub.** 11 of the 20 active `broadcastSvc.send` calls originate
   there. Any migration that touches `caseSvc` must account for every row above
   where `caseSvc.js` appears — prefer `apiFetch` re-fetch for shared state and
   `document.dispatchEvent(new CustomEvent(...))` only when a surviving Angular
   listener still needs notification during a partial migration.

2. **Dead emits to clean up.** `caseUpdate`, `settings-changed`,
   `updatedQueriesList` (commented), `caseSelected`, and
   `fetchedDropdownCasesList` have no `$on` listeners. The last two went dead
   when `headerCtrl.js` was deleted (core header dropdowns → Turbo Frames).
   `fetchDropdownCases()` (`caseSvc.js`) — which feeds `fetchedDropdownCasesList`
   — was deliberately left in place despite that, because `caseSvc.casesCount`
   (read by `NewCaseCtrl`'s default case-name fallback) has no other populator;
   only the broadcast itself is dead. `fetchDropdownBooks()` (`bookSvc.js`) had
   no such reason — `bookSvc.booksCount` had no reader anywhere — so it was
   deleted outright along with `dropdownBooks`/`booksCount` and the
   `fetchedDropdownBooksList` broadcast; that event no longer appears in the
   table above. Safe to remove the rest after a quick template grep confirms
   no `ng-{{…}}` bindings depended on the digest side-effect.

3. **Dead listener.** `deepCaseListUpdated` in
   `move_query_modal_instance_controller.js:31-43` listens for an event no one
   emits. Safe to drop in the same change that touches that file.

4. **`$rootScope.$on` leaks — audit before migrating.**
   - `queriesCtrl` captures deregistration return values and calls them on
     `$destroy` — good pattern to copy.
   - `searchResults.js` registers `$rootScope.$on('rating-changed')` per controller
     instance with no deregister — leaks when query rows are recreated.
   - `Case` constructor (`caseSvc.js:94`) registers `$rootScope.$on('settings-updated')`
     once per `new Case(...)` — accumulates listeners as cases are loaded.
   - Singleton services (`caseSvc`, `queriesSvc`) register root listeners at init;
     acceptable for the app lifetime but must not be copied into per-instance code.

5. **`$emit` on `$rootScope` is not bubbling.** `rating-changed` and
   `scoring-complete` both emit from `$rootScope` (directly or via the `$scope`
   alias). Listeners must be `$rootScope.$on`, not child `$scope.$on`. When
   migrating to `CustomEvent`, dispatch on `document` with `bubbles: true` so
   listeners do not depend on Angular scope ancestry.

## Methodology

Emitters, listeners, and line numbers re-verified 2026-09-21 from:

```bash
# Emitters
rg "broadcastSvc\.send" app/assets/javascripts/
rg "\$scope\.\$emit|\$rootScope\.\$emit" app/assets/javascripts/

# Listeners — also read DI arrays in queriesSvc.js and ratingsStoreSvc.js
rg "\$scope\.\$on|\$rootScope\.\$on" app/assets/javascripts/

# Dead-event sanity check (each event name)
rg "caseUpdate|settings-changed|deepCaseListUpdated|updatedQueriesList" app/assets/javascripts/
```

Re-run on each Angular slice migration to keep the table honest. Drop rows
when the emitter and all listeners have moved off Angular.

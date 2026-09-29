# Core event inventory

Living inventory of every cross-controller / cross-service event in the core
JavaScript runtime (`app/javascript/`). Re-run the [methodology](#methodology)
before deleting any emitter or listener.

When an event boundary changes, update its emitter, listeners, and payload
notes here in the same change.

**Out of scope:** unrelated Stimulus/native events in `app/javascript/`
(`vega:load`, `change` on scorer scale). This doc covers only Quepid
application event boundaries.

## Mechanisms in use

| Mechanism | Purpose | Direction |
|-----------|---------|-----------|
| `CustomEvent` | Named application boundary for lifecycle and one-shot actions | document/root → listeners |
| `EventTarget` store | Observable state boundary for query/document and score/rating state | store → subscribers |

## Event table

The core uses explicit `CustomEvent`s and `EventTarget` stores. Ratings retain
a native document-event fallback for bundles that do not load the modern store.

| Event name | Emitter(s) | Listener(s) | Listener kind | Notes |
|------------|------------|-------------|---------------|-------|
| `rating-changed` | `CaseScoreStore` | `qscore_case_controller.js` | EventTarget store | Normal rating-change path. |
| `ratings:changed` | live-query owner | none in the core path | native event | Fallback for bundles without the modern score store; the core path calls the store directly. |
| `scoring-complete` | `CaseScoreStore` | `qscore_case_controller.js`, `qgraph_controller.js` | EventTarget store | Score calculation completion notification. |

## Step 3 classification

| Category | Events | Boundary |
|----------|--------|----------|
| Query/document state | `case-book:associated`, `query-options:saved`, `query-diffs:refreshed`, `queries-state:changed` | Named document `CustomEvent`s owned by the core runtime. |
| Score/rating state | `rating-changed`, `scoring-complete`, `ratings:changed` | `CaseScoreStore` for the normal path; native document fallback only when the modern store is absent. |
| Navigation/bootstrap lifecycle | `core-bootstrap:ready`, `core-bootstrap:failed`, `quepid:case-header-stale` | Named document `CustomEvent`s with Stimulus connect/disconnect ownership. |
| Modal/action completion | `quepid:case-team-changed`, `case-score:persisted`, `judgements:book-settings-saved` | Named document `CustomEvent`s; payloads are documented at emitters and covered by focused tests. |

## Listener index

| File | Kind | Events | Deregisters? |
|------|------|--------|--------------|
| `controllers/qscore_case_controller.js` | store + document | `scoring-complete`, `rating-changed`, `query-diffs:refreshed` | yes (`disconnect`) |
| `controllers/qgraph_controller.js` | store + document | `scoring-complete`, `case-score:persisted` | yes (`disconnect`) |
| `utils/live_query_runtime_owner.js` | document + store | `case-book:associated`, `query-options:saved`, `rating-changed`, `ratings:changed` | app lifetime / store-owned |

## Methodology

Emitters and listeners re-verified 2026-09-21 from:

```bash
# Event emitters and listeners
rg "new CustomEvent|dispatchEvent|addEventListener|removeEventListener" app/javascript

# Store event boundaries
rg "rating-changed|ratings:changed|scoring-complete" app/javascript
```

Re-run when an emitter or listener changes to keep the table aligned with the
current runtime.

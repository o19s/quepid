# AngularJS removal: remaining inventory

This document tracks open risks and cleanup after removing AngularJS from the
core case UI. Completed migrations, removed files, historical debugging notes,
and completed checklists are intentionally omitted.

Quepid’s frontend has two surfaces:

| Surface | Stack | Entry |
|---------|-------|-------|
| Core case UI | Rails + Stimulus, vanilla JS, and an esbuild case bundle | `app/views/layouts/core.html.erb` |
| Rails pages | ERB + Stimulus (+ Turbo Streams in places) | teams, books, scorers, cases index, home, admin, … |

The Rails backend, existing models/services, REST API, MySQL, Solid Queue/Cable,
and `splainer-search` 3.x remain in scope and should be extended rather than
replaced as part of frontend cleanup.

See also: [App structure](../app_structure.md), [Vendor README](../../app/javascript/vendor/README.md), [DEVELOPER_GUIDE](../../DEVELOPER_GUIDE.md), and the [event bus inventory](./event_bus_inventory.md).

## Open work

| Priority | Item | Current scope |
|----------|------|---------------|
| **P0** | Scorer sandboxing | Client scorer code still executes through `new Function()`; evaluate a Web Worker or equivalent browser isolation. V8/MiniRacer remains the batch path. |
| **P1** | Scorer contract drift | `app/javascript/utils/scorer_runtime.js` and `scorer_logic.js` need a canonical shared API and migration guidance. |
| **P1** | SearchAPI mapper execution | Browser mapper code uses `new Function()` while the server uses MiniRacer; document and harden the shared contract. |
| **P2** | Compatibility invalidation | Remove `svcVersion` and ratings-version counters once their remaining consumers are gone. |
| **P2** | Accessibility | Complete the pass for score and rating controls so state is not conveyed by color alone; add accessible names to icon-only controls. |

## Remaining compatibility seams

These are not Angular migration items to mark complete; they are the remaining
boundaries whose behavior must be preserved while the core UI evolves:

- Live search remains browser → customer search engine, with Quepid proxy/auth
  and TLS protocol switching where required. Batch evaluation remains server-side.
- Snapshot fake-Solr behavior is still required for engines without document lookup.
- Search engine coupling remains in snapshot search, proxy/basic auth, rated-document
  lookup, pagination, and SearchAPI mapper behavior.
- Case ↔ Book synchronization retains its bidirectional and three-judgement
  consensus behavior.
- Fractional indexing, try ancestry overflow handling, position-weighted selection,
  and score deduplication remain backend contracts that frontend work must not change.
- `app/javascript/utils/core_capabilities_runtime.js` now exposes module-owned
  capabilities for bootstrap, snapshots, the wizard, and Tune Relevance; it no
  longer accepts a legacy runtime from callers. The remaining store-transition
  boundary is `app/javascript/utils/live_query_runtime_initializer.js`, which
  coordinates live-query search, scoring, and live query objects alongside the
  explicit query stores. Remove the duplicate ownership only after those
  consumers have been moved and verified.

## Open UX and testing work

### Icon-only controls

Some core controls still need accessible names, including copy-query and snapshot
delete/clear actions. Add `aria-label` or visible text while touching the owning
control, and cover the result with the relevant Playwright scenario.

### Verification requirements

For changes to the core case surface:

- Preserve the core surface’s existing behavior and appearance; do not collapse it
  with a Rails-page interaction model that used different UX.
- Add or update Vitest contracts for changed framework-free modules and controllers.
- Drive the affected user flow through Playwright and update the matching manual
  testing tracker entry.
- For visual changes, keep matched before/after screenshots for the core surface.

## Cleanup candidates

These are intentionally separate from feature migration work:

- Remove stale Angular terminology from comments, generated-build labels, test names,
  and helper names where it no longer describes the implementation.
- Remove remaining Angular-era build or CSS compatibility steps only after verifying
  that no core or Rails surface still depends on them.
- Keep this inventory limited to unresolved work; record completed migrations in
  commit history or feature-specific documentation instead.

## Related docs

| Doc | Purpose |
|-----|---------|
| [docs/README.md](../README.md) | Documentation index and dedup rules |
| [event_bus_inventory.md](./event_bus_inventory.md) | `$broadcast` / `$emit` map |
| [QUEPID_FEATURES.md](./QUEPID_FEATURES.md) | App-wide feature inventory |
| [QUEPID_COREUI_FEATURES.md](./QUEPID_COREUI_FEATURES.md) | Case UI feature deep dive |
| [core_ui_implementation_reference.md](./core_ui_implementation_reference.md) | Case UI internals and edge cases |
| [todo.md](./todo.md) | Open backend and hardening work |
| [DEVELOPER_GUIDE](../../DEVELOPER_GUIDE.md#stimulus-http-conventions) | Stimulus fetch and URL conventions |
| [js_tooling.md](../js_tooling.md) | Vitest, ESLint, and Prettier guidance |

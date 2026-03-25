# AngularJS Elimination — Complete

**Status:** AngularJS has been fully removed from the codebase. The Stimulus-based UI is the sole case workspace served at `/case/:id`. This document is kept for historical reference.

---

## What was done

1. **Removed AngularJS** from the production bundle (`ng-app`, `QuepidApp`, vendor JS,
   Karma tests, `angular_app.js`, `angular_templates.js`, all Angular controllers/
   services/directives/factories/filters/interceptors/values).
2. **Consolidated routes** — the `/new_ui` parallel route was merged into the default
   `/case/:id(/try/:try_number)` route. `CoreController#new_ui` and the `core_new_ui`
   layout were removed.
3. **Replaced Angular infrastructure** with Rails + Stimulus + importmap:
   - `splainer-search` → `search_executor.js` + `query_template.js`
   - `$http` → `fetch` with `apiUrl()` wrapper
   - `configurationSvc` → `data-*` attributes on `<body>`
   - `broadcastSvc` → DOM custom events
   - `paneSvc` → `resizable_pane_controller.js`
   - `headerCtrl` → ERB layout partial
   - Karma → Vitest (`test/javascript/`)
   - ACE editor → CodeMirror 6
   - `angular-ui-sortable` → Sortable.js via Stimulus
   - Bootstrap 3 → Bootstrap 5

## Completed phases

- **Phase 0** — P0 baseline flows verified.
- **Phase 2** — Core shell, CaseCtrl/CurrSettingsCtrl parity, header, east pane resizer.
- **Phase 3** — Query list: CRUD, sort, filter, pagination, collapse, bulk actions, Run All.
- **Phase 4** — Results and rating: field rendering, media embeds, translate links, explain modal (including Solr template rendering), doc finder, bulk rate.
- **Phase 5** — Tune relevance: 5-tab pane, curator variables, annotations, try management, endpoint picker, CodeMirror editor, query param validation, nightly toggle.
- **Phase 6** — Scoring: sparkline chart, score badges, Frog Pond Report (Vega).
- **Phase 7** — Snapshots and diffs: creation, compare, side-by-side diff, import.
- **Phase 8** — Lifecycle: wizard (7 engine types), import/export modals, judgements modal, unarchive, delete case.
- **Phase 9** — Ancillary: flash messages, loading states, 404 handling, tour.
- **Phase 10** — Decommission: Angular bundle removed, jQuery removed from core layout, BS3→BS5 migration, `Procfile.dev` cleaned, dead entry points deleted.

---

## Status log

- **2026-03-19** — Initial plan created.
- **2026-03-21** — Synced `new_ui` status; readable rewrite with TOC.
- **2026-03-22** — Phases 3, 5, 6 complete.
- **2026-03-23** — Phases 4, 8, 9 complete. All parity review items resolved.
- **2026-03-24** — Phase 2 leftovers done. Plan consolidated.
- **2026-03-25** — Angular fully removed. Routes consolidated. Phase 10 complete.

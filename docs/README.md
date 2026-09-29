# Documentation index

**Primary docs** live at the top level of `docs/` — use these for day-to-day work on `main`. **Branch archives** (`ds-phase-1/`, `view-components-port/`, `other-stashes/`, `encryption-robustness/`) are reference snapshots from abandoned branches; they do not override primary docs.

## Primary (living on `main`)

| Doc | Purpose |
|-----|---------|
| [`todo/core_ui_implementation_reference.md`](./todo/core_ui_implementation_reference.md) | Case UI deep internals (tour, queriesSvc quirks, TryFactory, bulk judgement, Rails) |
| [`ENCRYPTION_SETUP.md`](./ENCRYPTION_SETUP.md) | ActiveRecord encryption |
| [`app_structure.md`](./app_structure.md), [`data_mapping.md`](./data_mapping.md) | How the app is built |
| [`todo/QUEPID_FEATURES.md`](./todo/QUEPID_FEATURES.md) | Whole-app feature inventory |
| [`todo/QUEPID_COREUI_FEATURES.md`](./todo/QUEPID_COREUI_FEATURES.md) | Case workspace (`/case/...`) deep dive |
| [`complete_application_specification.md`](./complete_application_specification.md) | Schema columns, HTML routes, business rules (rewrite reference) |
| [`todo/todo.md`](./todo/todo.md) | Open bugs, hardening, and cleanup on `main` (excludes obviated Angular UI — see [§ Obviated](./todo/todo.md#obviated-by-angular-removal-do-not-fix-in-angular)) |

## Dedup rules (Aug 2026)

- **Encryption:** one living doc — [`ENCRYPTION_SETUP.md`](./ENCRYPTION_SETUP.md).
- **Frontend cleanup:** one living section — [`todo.md` § Frontend cleanup after Angular removal](./todo/todo.md#frontend-cleanup-after-angular-removal). Former migration-plan documents are historical.
- **Open bugs / hardening:** one living doc — [`todo/todo.md`](./todo/todo.md). Outstanding work only; remove entries when fixed (no completed section).
- **Data model:** narrative — [`data_mapping.md`](./data_mapping.md); quick table index — [`todo/QUEPID_FEATURES.md` §3](./todo/QUEPID_FEATURES.md#3-data-model--relationships); schema columns — [`complete_application_specification.md` §3](./complete_application_specification.md#3-data-model).
- **REST API:** canonical list — OpenAPI at `/api/docs`; Stimulus client conventions — [`DEVELOPER_GUIDE.md` § Stimulus HTTP conventions](../DEVELOPER_GUIDE.md#stimulus-http-conventions); HTML routes — [`complete_application_specification.md` §20.5](./complete_application_specification.md#205-html-rails-routes-non-api).
- **Core UI implementation quirks:** [`todo/core_ui_implementation_reference.md`](./todo/core_ui_implementation_reference.md) (not duplicated in [`todo/QUEPID_COREUI_FEATURES.md`](./todo/QUEPID_COREUI_FEATURES.md)).
- **Core UI implementation quirks:** [`todo/core_ui_implementation_reference.md`](./todo/core_ui_implementation_reference.md) (not COREUI §23+).
- **Obviated Angular UI bugs:** listed in [`todo/todo.md` § Obviated](./todo/todo.md#obviated-by-angular-removal-do-not-fix-in-angular); remaining frontend cleanup in [`todo.md` § Frontend cleanup after Angular removal](./todo/todo.md#frontend-cleanup-after-angular-removal).
- **Business rules / edge cases:** [`complete_application_specification.md` § Edge Cases](./complete_application_specification.md#edge-cases-and-business-rules); architectural narrative — [`todo/QUEPID_FEATURES.md` §35](./todo/QUEPID_FEATURES.md#35-key-architectural-decisions).

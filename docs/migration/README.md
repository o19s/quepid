# Core UI migration documentation

Docs for removing AngularJS from the **case / try workspace** on `main` while preserving behavior.

## Migration strategy: strangler fig

We are using the **[strangler fig pattern](https://martinfowler.com/bliki/StranglerFigApplication.html)**: new behavior is built at the “edges” (Rails views, Stimulus, Turbo, `fetch` to existing JSON APIs) and wired in **alongside** the legacy Angular core until a slice is complete; then that slice is cut over and the old implementation is removed. The monolithic Angular workspace is replaced **incrementally**, not in a single big-bang rewrite. Surfaces that already left Angular (home, `/cases`, teams, scorers, books, admin, etc.) are earlier strangler milestones; the core case UI is the remaining trunk.

## Start here

| Doc | Role |
|-----|------|
| [angularjs_elimination_plan.md](./angularjs_elimination_plan.md) | **Canonical plan** — phased work, P0 parity, browser `splainer-search` + client scoring |
| [deangularjs_experimental_review.md](./deangularjs_experimental_review.md) | **`deangularjs-experimental` branch** — what to reuse (tooling, ideas) vs avoid (full merge, server workspace search) |

## Stack options (same JSON APIs)

Phased scope stays in the elimination plan. React-era reference material lives under [old/](./old/).

| Doc | Role |
|-----|------|
| [rails_stimulus_migration_alternative.md](./rails_stimulus_migration_alternative.md) | Stimulus + Turbo artifacts (no duplicate phase checklist — use elimination plan) |
| [old/react_migration_plan.md](./old/react_migration_plan.md) | React + esbuild alternative (same; phases authoritative in elimination plan) |
| [old/migration_roundtable_discussion.md](./old/migration_roundtable_discussion.md) | Archived discussion comparing the two paths |

## Inventories and behavior

| Doc | Role |
|-----|------|
| [angularjs_inventory.md](./angularjs_inventory.md) | File-level Angular map |
| [angularjs_ui_inventory.md](./angularjs_ui_inventory.md) | Feature / screenshot map |
| [angular_services_responsibilities_mapping.md](./angular_services_responsibilities_mapping.md) | Services → server vs client after port |
| [workspace_behavior.md](./workspace_behavior.md) | Current Angular workspace flows |
| [new_ui_capabilities.md](./new_ui_capabilities.md) | **Capability contract** — new UI vs Angular (parity / intentional / gap) |
| [workspace_api_usage.md](./workspace_api_usage.md) | API paths the workspace uses |
| [workspace_state_design.md](./workspace_state_design.md) | Where state should live post-port |

## Hotwire / client conventions

| Doc | Role |
|-----|------|
| [turbo_frame_boundaries.md](./turbo_frame_boundaries.md) | Frame IDs and boundaries (design reference) |
| [turbo_streams_guide.md](./turbo_streams_guide.md) | Stream actions and use cases |
| [api_client.md](./api_client.md) | fetch, CSRF, relative URLs |
| [../stimulus_and_modern_js_conventions.md](../stimulus_and_modern_js_conventions.md) | **Stimulus + module guardrails** (`apiUrl`, outlets, tests) — pairs with api_client |
| [ui_consistency_patterns.md](./ui_consistency_patterns.md) | Bootstrap 5, modals, flash |

## Product / security notes (read before “improving” UX)

| Doc | Role |
|-----|------|
| [intentional_design_changes.md](./intentional_design_changes.md) | **Section 1** = recommended API hardening / robustness. **Section 2** = product ideas from experimental — **not** parity scope unless explicitly signed off |

## Manuals and tooling

| Doc | Role |
|-----|------|
| [core_case_evaluation_manual.md](./core_case_evaluation_manual.md) | User-facing manual |
| [core_case_evaluation_manual_screenshots.md](./core_case_evaluation_manual_screenshots.md) | Screenshot checklist |
| [screenshot_automation.md](./screenshot_automation.md) | Playwright capture notes |

## Other

| Doc | Role |
|-----|------|
| [pragmatic_engineering_setup_review.md](./pragmatic_engineering_setup_review.md) | CI / tooling review |
| [code_review_findings.md](./code_review_findings.md) | Security / review notes |

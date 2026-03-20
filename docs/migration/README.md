# Core UI migration documentation

Docs for removing AngularJS from the **case / try workspace** on `main` while preserving behavior.

## Start here

| Doc | Role |
|-----|------|
| [angularjs_elimination_plan.md](./angularjs_elimination_plan.md) | **Canonical plan** — phased work, P0 parity, browser `splainer-search` + client scoring |
| [deangularjs_experimental_review.md](./deangularjs_experimental_review.md) | **`deangularjs-experimental` branch** — what to reuse (tooling, ideas) vs avoid (full merge, server workspace search) |

## Stack options (same JSON APIs)

| Doc | Role |
|-----|------|
| [rails_stimulus_migration_alternative.md](./rails_stimulus_migration_alternative.md) | Stimulus + Turbo artifacts (no duplicate phase checklist — use elimination plan) |
| [old/react_migration_plan.md](./old/react_migration_plan.md) | React + esbuild alternative (same; phases authoritative in elimination plan) |
| [migration_roundtable_discussion.md](./migration_roundtable_discussion.md) | Discussion comparing the two paths |

## Inventories and behavior

| Doc | Role |
|-----|------|
| [angularjs_inventory.md](./angularjs_inventory.md) | File-level Angular map |
| [angularjs_ui_inventory.md](../angularjs_ui_inventory.md) | Feature / screenshot map |
| [angular_services_responsibilities_mapping.md](./angular_services_responsibilities_mapping.md) | Services → server vs client after port |
| [workspace_behavior.md](./workspace_behavior.md) | Current Angular workspace flows |
| [workspace_api_usage.md](./workspace_api_usage.md) | API paths the workspace uses |
| [workspace_state_design.md](./workspace_state_design.md) | Where state should live post-port |

## Hotwire / client conventions

| Doc | Role |
|-----|------|
| [turbo_frame_boundaries.md](./turbo_frame_boundaries.md) | Frame IDs and boundaries (design reference) |
| [turbo_streams_guide.md](./turbo_streams_guide.md) | Stream actions and use cases |
| [api_client.md](./api_client.md) | fetch, CSRF, relative URLs |
| [ui_consistency_patterns.md](./ui_consistency_patterns.md) | Bootstrap 5, modals, flash |

## Product / security notes (read before “improving” UX)

| Doc | Role |
|-----|------|
| [intentional_design_changes.md](./intentional_design_changes.md) | **§1** = recommended API hardening / robustness. **§2** = product ideas from experimental — **not** parity scope unless explicitly signed off |

## Manuals and tooling

| Doc | Role |
|-----|------|
| [core_case_evaluation_manual.md](./core_case_evaluation_manual.md) | User-facing manual |
| [core_case_evaluation_manual_screenshots.md](./core_case_evaluation_manual_screenshots.md) | Screenshot checklist |
| [screenshot_automation.md](./screenshot_automation.md) | Playwright capture notes |
| [markdown_files_inventory.md](./markdown_files_inventory.md) | Repo `.md` inventory |

## Other

| Doc | Role |
|-----|------|
| [pragmatic_engineering_setup_review.md](./pragmatic_engineering_setup_review.md) | CI / tooling review |
| [code_review_findings.md](./code_review_findings.md) | Security / review notes |
| [system_notes.md](./system_notes.md), [stuff_to_talk_about.md](./stuff_to_talk_about.md) | Working notes |

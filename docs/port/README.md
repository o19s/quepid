# Porting Docs Index

This folder contains documentation for the Angular-to-Stimulus/Turbo/ViewComponent port plus related architecture and UX notes.

## Canonical Documents

- `workspace_api_usage.md` - Endpoint inventory and request/response usage.
- `workspace_state_design.md` - Server/client state boundaries.
- `workspace_behavior.md` - Legacy behavior reference used for parity checks.
- `intentional_design_changes.md` - Deliberate behavior differences from Angular.
- `angular_services_responsibilities_mapping.md` - Service-to-architecture mapping.
- `ui_consistency_patterns.md` - UI implementation patterns.
- `view_component_conventions.md` - ViewComponent conventions.
- `turbo_frame_boundaries.md` - Frame boundaries and responsibilities.
- `turbo_streams_guide.md` - Stream action patterns and usage.
- `future_tasks.md` - Deferred technical debt and follow-up refactors.

## Historical / Audit References

- `deangularjs_branch_comparison.md` - Historical branch comparison.
- `angular_to_stimulus_hotwire_viewcomponents_checklist.md` - Migration checklist record (completed).
- `codebase_review_report.md` - Point-in-time code review report.
- `gap_implementation_review.md` - Review of previously identified gap implementations.
- `stuff_to_talk_about.md` - UX feedback notes.
- `archives/deangularjs_experimental_functionality_gaps_complete.md` - Full parity/gap archive and completed items.

## Dedupe Notes

- Canonical tooling/pipeline review lives at `../pragmatic_engineering_setup_review.md` (not duplicated under `docs/port`).
- Links that previously pointed to removed temporary parity docs now point to `archives/deangularjs_experimental_functionality_gaps_complete.md`.

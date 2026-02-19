# Porting Docs Index

This folder contains documentation for the Angular-to-Stimulus/Turbo/ViewComponent port plus related architecture and UX notes.

## Canonical Documents

- `workspace_api_usage.md` - Endpoint inventory and request/response usage.
- `workspace_state_design.md` - Server/client state boundaries.
- `intentional_design_changes.md` - Deliberate behavior differences from Angular.
- `ui_consistency_patterns.md` - UI implementation patterns (Bootstrap 5, modals, flash messages).
- `view_component_conventions.md` - ViewComponent conventions and patterns.
- `turbo_frame_boundaries.md` - Turbo Frame boundaries and responsibilities.
- `turbo_streams_guide.md` - Turbo Stream action patterns and usage.
- `api_client.md` - API client usage and URL building rules.
- `future_tasks.md` - Deferred technical debt and follow-up refactors.
- `admin_scorer_editing.md` - Admin scorer editing functionality (completed).
- `gap_implementation_review.md` - Review of gap implementations and remaining concerns.

## Historical / Audit References

- `archives/workspace_behavior.md` - Legacy behavior reference used for parity checks.
- `archives/angular_services_responsibilities_mapping.md` - Service-to-architecture mapping.
- `archives/deangularjs_branch_comparison.md` - Historical branch comparison.
- `archives/port_completed.md` - Migration checklist and completed implementation details.
- `archives/deangularjs_experimental_functionality_gaps_complete.md` - Full parity/gap archive and completed items.
- `stuff_to_talk_about.md` - UX feedback notes.

## Dedupe Notes

- Canonical tooling/pipeline review lives at `../pragmatic_engineering_setup_review.md` (not duplicated under `docs/port`).
- Links that previously pointed to removed temporary parity docs now point to `archives/deangularjs_experimental_functionality_gaps_complete.md`.

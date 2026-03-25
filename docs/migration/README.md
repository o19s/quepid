# Core UI migration documentation

The AngularJS-to-Stimulus migration is **complete**. Angular has been removed and the case workspace runs entirely on Stimulus/Turbo.

Historical migration plans, inventories, and decision docs have been moved to [old/](./old/).

## Active reference docs

### Hotwire / client conventions

| Doc | Role |
|-----|------|
| [turbo_frame_boundaries.md](./turbo_frame_boundaries.md) | Frame IDs and boundaries (design reference) |
| [turbo_streams_guide.md](./turbo_streams_guide.md) | Stream actions and use cases |
| [api_client.md](./api_client.md) | fetch patterns, proxy, response handling (edge cases beyond parent doc) |
| [workspace_api_usage.md](./workspace_api_usage.md) | API paths the workspace uses |
| [../stimulus_and_modern_js_conventions.md](../stimulus_and_modern_js_conventions.md) | **Authoritative** for URLs, CSRF, Stimulus patterns, testing |
| [ui_consistency_patterns.md](./ui_consistency_patterns.md) | Bootstrap 5, modals, flash |

### Security and product notes

| Doc | Role |
|-----|------|
| [security_and_robustness.md](./security_and_robustness.md) | Consolidated security/performance checklist (SSRF, IDOR, CSRF, N+1, proxy) |
| [intentional_design_changes.md](./intentional_design_changes.md) | Product/UX candidates from experimental — **not** parity scope unless signed off |

### Manuals and tooling

| Doc | Role |
|-----|------|
| [core_case_evaluation_manual.md](./core_case_evaluation_manual.md) | User-facing manual |
| [core_case_evaluation_manual_screenshots.md](./core_case_evaluation_manual_screenshots.md) | Screenshot checklist |
| [screenshot_automation.md](./screenshot_automation.md) | Playwright capture notes |

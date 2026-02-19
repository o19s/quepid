# Quepid Documentation Index

> Index of documentation by topic. For each topic, one doc is the **authoritative source**; others cross-reference it.

---

## Authoritative Sources by Topic

| Topic | Authoritative Source | Description |
|-------|---------------------|-------------|
| **URL / root URL / navigation** | [api_client.md](api_client.md) | Never hardcode `/`; use `getQuepidRootUrl()` (Stimulus) or `quepid_root_url` (Rails) |
| **Bootstrap 5 / modals / flash** | [ui_consistency_patterns.md](ui_consistency_patterns.md) | Bootstrap 5 attributes, modal patterns, flash messages |
| **Turbo Streams** | [turbo_streams_guide.md](turbo_streams_guide.md) | Actions, client/server patterns, use cases |
| **Turbo Frame boundaries** | [turbo_frame_boundaries.md](turbo_frame_boundaries.md) | Frame IDs, regions, modals, implementation status |
| **Admin communal scorers removal** | [admin_communal_scorers_removal.md](admin_communal_scorers_removal.md) | What was removed, migration path, rollback |
| **Admin scorer editing** | [admin_scorer_editing.md](admin_scorer_editing.md) | How admins edit communal scorers, creating via console/seeds |
| **Migration checklist (Angular → Stimulus)** | [angular_to_stimulus_hotwire_viewcomponents_checklist.md](angular_to_stimulus_hotwire_viewcomponents_checklist.md) | Phases, per-component template, pattern table |
| **Workspace state design** | [workspace_state_design.md](workspace_state_design.md) | Server vs client state, Turbo Frame regions |
| **Workspace behavior** | [workspace_behavior.md](workspace_behavior.md) | User flows, keyboard shortcuts, flash, errors |
| **Workspace API usage** | [workspace_api_usage.md](workspace_api_usage.md) | Endpoints, request/response shapes |
| **ViewComponent conventions** | [view_component_conventions.md](view_component_conventions.md) | Location, naming, slots, Turbo Frames |
| **App structure** | [app_structure.md](app_structure.md) | Frontend stack, workspace architecture |
| **Development setup** | [../DEVELOPER_GUIDE.md](../DEVELOPER_GUIDE.md) | Docker, local, tests, troubleshooting |

---

## Other Documentation

| Doc | Description |
|-----|-------------|
| [data_mapping.md](data_mapping.md) | Data model and entity relationships |
| [angular_services_responsibilities_mapping.md](angular_services_responsibilities_mapping.md) | Angular services → server/client placement |
| [per_component_migration_checklist.md](per_component_migration_checklist.md) | List of components to migrate |
| [code_review_angular_removal.md](code_review_angular_removal.md) | Code review findings (lost functionality, orphaned files) |
| [codebase_review_report.md](codebase_review_report.md) | In-depth codebase review: bugs, bad practices, security, regressions |
| [deangularjs_branch_comparison.md](deangularjs_branch_comparison.md) | Branch diff: main vs deangularjs |
| [deangularjs_experimental_functionality_gap_report.md](deangularjs_experimental_functionality_gap_report.md) | Functionality gap analysis |
| [operating_documentation.md](operating_documentation.md) | Operations, scripting, Thor tasks |
| [database.md](database.md) | Database setup and migrations |
| [docker_images.md](docker_images.md) | Docker image build and deploy |
| [endpoints_solr.md](endpoints_solr.md) | Solr search endpoint configuration |
| [endpoints_opensearch.md](endpoints_opensearch.md) | OpenSearch endpoint configuration |
| [agentic_javascript_extraction.md](agentic_javascript_extraction.md) | Agentic workflow for JS extraction |
| [jupyterlite.md](jupyterlite.md) | Jupyterlite notebooks |
| [ENCRYPTION_SETUP.md](ENCRYPTION_SETUP.md) | Encryption configuration |
| [credits.md](credits.md) | Credits and acknowledgments |
| [docs_consolidation_analysis.md](docs_consolidation_analysis.md) | Duplication analysis and consolidation plan |

---

## Quick Links

- **New to Quepid?** Start with [app_structure.md](app_structure.md) and [../DEVELOPER_GUIDE.md](../DEVELOPER_GUIDE.md)
- **Migrating Angular → Stimulus?** See [angular_to_stimulus_hotwire_viewcomponents_checklist.md](angular_to_stimulus_hotwire_viewcomponents_checklist.md) and [angular_services_responsibilities_mapping.md](angular_services_responsibilities_mapping.md)
- **Building UI?** See [view_component_conventions.md](view_component_conventions.md), [ui_consistency_patterns.md](ui_consistency_patterns.md), [turbo_streams_guide.md](turbo_streams_guide.md)

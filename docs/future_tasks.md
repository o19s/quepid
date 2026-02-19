# Future Tasks

RuboCop issues we've deferred rather than fixed, tracked here for future refactoring.

## Naming/PredicateMethod for `detect_querqy`

**File:** `app/services/query_search_service.rb:150`

RuboCop flags `detect_querqy` because methods starting with `detect_` should end with `?`. But `detect_querqy` returns data (the querqy configuration), not a boolean — this is a false positive. Either rename the method (e.g., `querqy_config_for`) or keep the cop disabled.

**Config:** `Naming/PredicateMethod: Enabled: false`

## ViewComponent Parameter Lists

**Files:** `app/components/document_card_component.rb`, `frog_report_component.rb`, `judgements_component.rb`, `matches_component.rb`, `new_case_wizard_component.rb`, `qscore_case_component.rb`, `query_list_component.rb`, `scorer_panel_component.rb`, `settings_panel_component.rb`

ViewComponent `initialize` methods naturally take many keyword arguments (one per prop). For example `DocumentCardComponent.new(doc:, rating:, index:, diff_entries:, scale:, highlights:, image_prefix:)` has 7 params. The alternative would be a params object or hash, but keyword args are the idiomatic ViewComponent pattern. Consider grouping related params into value objects if components grow further.

**Config:** `Metrics/ParameterLists` exclude for `app/components/**/*`

## FetchService Parameter List

**File:** `app/services/fetch_service.rb:541`

`execute_get_request` takes 6 parameters. Could be refactored to use a request object or options hash.

**Config:** `Metrics/ParameterLists` exclude for `app/services/fetch_service.rb`

## Global Variable `$query` in Search Controller

**File:** `app/controllers/api/v1/tries/queries/search_controller.rb:203`

Uses `$query` global variable from the Quepid query template system. Fixing requires refactoring the template variable system to use a class-level constant or passed parameter instead.

**Config:** `Style/GlobalVars` exclude for this file

## Complex Methods (Metrics Violations)

These pre-existing methods exceed complexity/length thresholds and have inline `rubocop:disable` comments. Each would benefit from extraction into smaller methods or service objects:

- `Api::V1::Import::RatingsController#create` — Cyclomatic/Perceived complexity (handles hash, RRE, LTR formats)
- `Api::V1::SearchEndpoints::ValidationsController#create` — AbcSize, complexity, method length (validates multiple search engine types)
- `Api::V1::SnapshotsController#create` — AbcSize, method length, perceived complexity
- `Api::V1::Tries::Queries::SearchController#show` — AbcSize, method length (orchestrates search + diff)
- `Api::V1::Tries::Queries::SearchController#build_diff_data` — Cyclomatic/Perceived complexity
- `Core::ImportsController#information_needs` — AbcSize, complexity (CSV parsing + query matching)
- `Core::ImportsController#extract_ratings` — Complexity, method length (multi-format parsing)
- `Core::QueriesController#create` — AbcSize, method length
- `ImportCaseRatingsJob#extract_ratings` — Cyclomatic/Perceived complexity
- `QuerySearchService#extract_num_found` — Cyclomatic complexity (handles multiple search engine response formats)

# Future Tasks

> **Last updated:** 2026-02-19

This document tracks RuboCop violations that have been deferred rather than fixed, via configuration-level excludes or documented inline disables. For a complete list of inline `rubocop:disable` comments, search the codebase for `rubocop:disable`.

## Naming/PredicateMethod for `detect_querqy`

**File:** `app/services/query_search_service.rb:152`

RuboCop flags `detect_querqy` because methods starting with `detect_` should end with `?`. But `detect_querqy` returns data (the querqy configuration), not a boolean — this is a false positive. Either rename the method (e.g., `querqy_config_for`) or keep the cop disabled.

**Config:** `Naming/PredicateMethod: Enabled: false` (see `.rubocop.yml:38`)

## ViewComponent Parameter Lists

**Files:** All ViewComponents in `app/components/**/*`

ViewComponent `initialize` methods naturally take many keyword arguments (one per prop). For example `DocumentCardComponent.new(doc:, rating:, index:, diff_entries:, scale:, highlights:, image_prefix:)` has 7 params. The alternative would be a params object or hash, but keyword args are the idiomatic ViewComponent pattern. Consider grouping related params into value objects if components grow further.

**Config:** `Metrics/ParameterLists` exclude for `app/components/**/*` (see `.rubocop.yml:42`)

## FetchService Parameter List

**File:** `app/services/fetch_service.rb:541`

`execute_get_request` takes 6 parameters. Could be refactored to use a request object or options hash.

**Config:** `Metrics/ParameterLists` exclude for `app/services/fetch_service.rb` (see `.rubocop.yml:43`)

## Global Variable `$query` in Search Controller

**File:** `app/controllers/api/v1/tries/queries/search_controller.rb:207`

Uses `$query` global variable from the Quepid query template system. The variable is used in query parameter substitution: `a_try.query_params.to_s.gsub("#{$query}##", CGI.escape(query.query_text.to_s))`. Fixing requires refactoring the template variable system to use a class-level constant or passed parameter instead.

**Config:** `Style/GlobalVars` exclude for this file (see `.rubocop.yml:47`)

## Complex Methods (Metrics Violations)

These pre-existing methods exceed complexity/length thresholds and have inline `rubocop:disable` comments. Each would benefit from extraction into smaller methods or service objects:

- `Api::V1::Import::RatingsController#create` (line 13) — Cyclomatic/Perceived complexity, AbcSize, method length (handles hash, RRE, LTR formats)
- `Api::V1::SearchEndpoints::ValidationsController#create` (line 30) — AbcSize, complexity, method length (validates multiple search engine types)
- `Api::V1::SnapshotsController#create` (line 42) — AbcSize, method length, perceived complexity
- `Api::V1::Tries::Queries::SearchController#show` (line 38) — AbcSize, method length (orchestrates search + diff)
- `Api::V1::Tries::Queries::SearchController#build_diff_data` (line 153) — Cyclomatic/Perceived complexity
- `Core::ImportsController#information_needs` (line 59) — AbcSize, complexity (CSV parsing + query matching)
- `Core::ImportsController#extract_ratings` (line 106) — Complexity, method length (multi-format parsing)
- `Core::QueriesController#create` (line 25) — AbcSize, method length
- `ImportCaseRatingsJob#extract_ratings` (line 46) — Cyclomatic/Perceived complexity
- `QuerySearchService#extract_num_found` (line 88) — Cyclomatic complexity (handles multiple search engine response formats)

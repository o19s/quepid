# Quepid Test Suite Review

## Summary

The Ruby, JavaScript, and Playwright suites were reviewed against the application code and the automated suites were run.

Current baseline:

- Rails: 1,577 tests, 5,439 assertions, all passing; 8 skips.
- Ruby line coverage: 88.5%, but branch coverage is disabled.
- Vitest: 136 files, 808 tests, all passing.
- Playwright: 24 specs, but not run by CI.
- Manual tracker: 56 of 132 scenarios are currently due.

## Tests to add

### Highest priority

- `app/constraints/admin_constraint.rb`
  - No direct tests.
  - Cover no session, valid admin, valid non-admin, and stale/nonexistent user ID. The current `User.find` path can raise instead of returning `false`.

- `ScorersController`
  - Add tests for `update_default`, `share`, and `unshare`.
  - Cover missing records, unauthorized scorers, communal scorers, already-shared/not-shared teams, successful updates, and failed saves.
  - Existing coverage stops after clone behavior despite these actions containing important authorization logic.

- `CoreController`
  - Test `new`, case-name population, search endpoint creation/update, try selection, missing/inaccessible cases, and protocol tracking.
  - The current controller test only asserts that `index` returns success.

- `HomeController`
  - Add coverage for `case_prophet` and `book_summary_detail`.
  - Include empty scores, fewer than three scores, same-day vs. multi-day scores, zero initial score, annotations, ETag/not-modified responses, and missing cases.

- `Admin::Users::PulsesController`
  - Add tests for all six `data` modes and unknown data values.
  - Current coverage is only about 37%.

- `Books::ExportController`
  - Add HTML-controller tests for queueing, duplicate requests, job completion, authorization, and redirect/flash behavior.
  - There are API export tests, but the HTML controller is a separate duplicated implementation.

- `JudgementsController`
  - Add tests for search filters, `user_id`, `unrateable`, `judge_later`, failed create/update, and the 50th-judgement leaderboard/party branch.

- `Users::SignupsController`
  - Current coverage is only through Playwright.
  - Add focused controller tests for invited-user reuse, blank email, invalid signup, session assignment, and analytics tracking.

### JavaScript priorities

Add behavioral tests for currently untested controllers:

- `bulk_judgement_controller`
- `document_fields_modal_controller`
- `judge_documents_modal_controller`
- `tune_relevance_controller`
- `scorer_scale_controller`
- `scoring_guidelines_controller`
- `user_activity_controller`
- `wizard_controller`
- `qgraph_controller`

These should focus on user-visible state transitions and failed API requests, not implementation details.

## Tests and infrastructure to update

- Run Playwright in CI, at least as a separate required or nightly job. CI currently runs Rails and frontend unit tests only: `config/ci.rb`.
- Enable branch coverage or add targeted branch assertions. The current SimpleCov setup reports line coverage only: `test/test_helper.rb`.
- Strengthen low-value controller tests that only assert `200`/`success` without checking rendered data or side effects.
- Add a shared contract test for the duplicated HTML/API book-export behavior.
- Rename `test/controllers/books/import_controller_test.rb`, whose class is currently `BooksControllerTest`, to make test ownership clear.
- Drive and update the 56 due manual scenarios, especially core workbench, import/export, snapshots, books, and responsive/accessibility coverage.

## Tests to delete or retire

Delete or move the non-discoverable test artifacts:

- `test/controllers/books_controller_test.txt`
- `test/controllers/query_doc_pairs_controller_test.txt`
- `test/system/*.txt`

They are not Rails test files and should either become documentation or be removed.

Remove obsolete benchmark/prototype tests from the normal suite:

- `test/integration/experiment_with_bulk_insert_test.rb`
- `test/integration/experiment_with_json_render.rb`
- Obsolete all-skipped portions of `test/integration/experiment_with_ruby_llm_test.rb`

These currently add skips and runtime noise without testing shipped behavior. Keep deterministic tests for the real mapper/LLM pipeline.

Keep the existing model, service, job, API, and store tests. Those areas are comparatively healthy and generally have strong coverage.

## Overall recommendation

The suite is broad and green, but its next investment should be authorization branches, server-rendered controller behavior, untested admin/analytics paths, and Playwright CI integration—not more generic CRUD tests.

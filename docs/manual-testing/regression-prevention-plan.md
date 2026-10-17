# Regression prevention execution plan

Prevent silent feature loss before the AngularJS removal lands. The
[landing gate](../todo/todo.md#migration-sign-off-gate-for-landing-the-angularjs-removal)
is the single definition of done; this plan only orders the work toward it.

The wizard established the pattern: its stub-based UI tests were replaced with
real-Stimulus tests against Rails-rendered fixtures, and a deliberately broken
action made the migrated test fail. See
[controller testing guidance](../js_tooling.md#controller-test-fixtures).
Don't repeat the deliberate-break check per area; repeat it only for a new
fixture technique.

## Per feature area

For each area below, in any order:

1. Close its rows in the [parity checklist](angular-parity-checklist.md) against
   the historical UI: retained, removed by an existing decision, or a tagged
   defect in `todo.md`.
2. Replace its stub-based UI tests with real-Stimulus tests against actual
   markup or Rails-rendered fixtures. Keep logic-only tests; don't keep both.
3. Browser-check the success and failure paths, including persistence after
   reload, following the [browser evidence workflow](../screenshot_review.md).
   Extend Playwright specs where a branch is repeatable.

## Areas

- Case wizard and custom headers — Stimulus tests done; browser parity open.
- Tune Relevance: query parameters, tuning, try history and try details.
- Modal lifecycle: nested diff/missing-document dialogs, share case.
- Core workbench: add query → rate → score → reload, snapshot comparison.
- Case import/export and judging.
- Remaining checklist rows: size them before starting, then assign to an area.

Record progress in the checklist, `tracking.yml` and commits, not here.

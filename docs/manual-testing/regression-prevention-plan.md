# Regression prevention execution plan

Prevent silent feature loss before the AngularJS removal lands. The
[landing gate](../todo/todo.md#migration-sign-off-gate-for-landing-the-angularjs-removal)
is the single definition of done; this plan only orders the work toward it.

The wizard and Tune Relevance established the pattern: their stub-based UI tests were
replaced with Playwright specs against the live app, using disposable cases created
through the API. See [Playwright E2E](../../DEVELOPER_GUIDE.md#playwright-e2e) and the
[controller testing guidance](../js_tooling.md#controller-test-fixtures).

## Per feature area

For each area below, in any order:

1. Close its rows in the [parity checklist](angular-parity-checklist.md) against
   the historical UI: retained, removed by an existing decision, or a tagged
   defect in `todo.md`.
2. Replace its stub-based UI tests with Playwright specs against the live app.
   Keep logic-only tests; don't keep both.
3. Browser-check the success and failure paths, including persistence after
   reload, following the [browser evidence workflow](../screenshot_review.md).
   Extend Playwright specs where a branch is repeatable.

## Areas

- Case wizard and custom headers — live Playwright specs and browser parity done; three findings await a decision in `todo.md`.
- Tune Relevance: query parameters, tuning, try history and try details — live Playwright specs and browser parity done; twelve findings await a decision in `todo.md`.
- Modal lifecycle: nested diff/missing-document dialogs, share case.
- Core workbench: add query → rate → score → reload, snapshot comparison.
- Case import/export and judging.
- Remaining checklist rows: sized and assigned below.

## Remaining rows by area

Rows 1 to 55 (ported on this branch) block landing; rows 56 to 106 (ported on main) are triaged separately and belong to no area here. Small is up to 12 checklist items, medium 13 to 50, large over 50.

| Area | Checklist rows | Not started | Items | Large rows |
|---|---|---|---|---|
| Case wizard and custom headers | 1, 25, 51, 53 | 51, 53 | 2 | none |
| Tune Relevance | 2, 11, 27 | none | 0 | none |
| Modal lifecycle | 7, 9, 13, 15–18, 20–22, 33, 37–43, 45, 47, 48, 50 | 22 rows | 308 | 7 |
| Core workbench | 6, 8, 10, 12, 14, 19, 23, 24, 26, 28, 30–32, 35, 36, 46, 49, 52, 54, 55 | 20 rows | 315 | 6, 8 |
| Case import/export and judging | 3–5, 29, 34, 44 | 6 rows | 309 | 3, 4, 5 |

Core workbench includes the annotation rows 23, 24 and 26 (scenario 5.4). Suggested order: the two wizard rows, then Core workbench (the page the other areas sit in), Modal lifecycle, and Case import/export and judging last, since three large modal rows hold most of its items.

Record progress in the checklist, `tracking.yml` and commits, not here.

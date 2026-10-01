# Manual-test failure provenance

Baseline: `main` commit `5f53d8f8` (2026-06-23), before the September core deangularization. The comparison used `git show`, `git grep`, and diffs without replacing working-tree files. Current behavior was exercised through Playwright MCP; historical behavior was inspected in source, not replayed in an old server. Screenshots are under `.playwright-mcp/due-oct01/`.

| Scenario | Classification | Historical evidence and implication |
|---|---|---|
| 1.9 Account deletion confirmation | `[PREEXISTING]` — source-supported | The Rails Profile form already used `data: {confirm: ...}` on its submit input. Its modern entry loaded Turbo with Drive off and did not start Rails UJS; repository search found no Rails UJS handler. The inert confirmation predates core Angular removal. This is an inference from the old wiring, not a historical browser replay. |
| 4.10 Query editor restores old text | `[MIGRATION]` — likely, needs historical runtime confirmation for certainty | The old `devQueryParams.html` bound ACE directly to `settings.selectedTry.queryParams`. `QueryParamsCtrl#toggleTab` cloned the try before `updateVars`, explicitly preserving edited query text; the old Karma suite exercises edits followed by variable extraction. The new CodeMirror integration reads editor state in a native `input` listener and immediately refreshes it. Current browser testing reproduced immediate reversion even before tab switching. The old controller comment documents a different, guarded tab-switch reset hazard; it is not proof that the current immediate-input failure was inherited. |
| 4.11 Knob creation blocked | Same failure as 4.10 | The old `queryParams_spec.js` sets `q=#$query##&boo=##testvar##`, switches tabs, and asserts a knob named `testvar`, value 10, marked in use. The current test could not reach that state because editor changes reverted. |
| 4.11 Missing empty-state instructions | `[MIGRATION]` — confirmed source loss | The old `devQueryParams.html` explicitly explained `##` and showed `title^##titleBoost##` when there were no variables. The new ERB only says to edit the query. The manual expectation is supported by the Angular baseline. |
| 4.13 Blank try visualization | `[PREEXISTING]` implementation limitation; exact data origin undetermined | The controller and visualization templates are unchanged from the June baseline. The tree emits each try's parent ID while the controller supplies only that case's tries. A parent outside that set can therefore produce Vega's missing-parent error. Current case 219 reported `missing: 11`. This establishes the inherited handling limitation, not when that case acquired its ancestry. |
| 5.3 Empty duplicate-snapshot warning | `[MIGRATION]` — confirmed source loss | The Angular `components/diff/_modal.html` contains the warning text in the same `ng-show` block as duplicate detection. The new ERB target starts empty, and `diff_core_controller.js#renderSelections` only changes visibility. Text is populated later in submit validation, so selection alone shows an empty box. |
| 17.1 Image click does nothing | Unsupported test expectation — parity preserved | Angular `searchResult.html` renders plain thumbnail/image elements with `ng-src`, without anchors or click actions. Only the title invokes `showDoc()`. The old controller has no image click handler. The current plain image behavior matches that baseline; scenario 17.1 was corrected instead of requesting a new feature. |
| 17.5 External score without query payload returns 500 | `[PREEXISTING]` — confirmed source defect | June `CaseScoreManager#added_query?` already calls `score_data[:queries].each` without guarding an omitted query payload when historical query scores exist. The same path remains today. The earlier successful empty-case test did not exercise this branch; the latest test did. |

## Baseline source paths

- Rails account form: `app/views/profiles/show.html.erb`; initialization: `app/javascript/application_modern.js`.
- Query and knobs: `app/assets/templates/views/devQueryParams.html`, `app/assets/javascripts/controllers/queryParams.js`, `spec/javascripts/angular/controllers/queryParams_spec.js`.
- Comparison warning: `app/assets/javascripts/components/diff/_modal.html`.
- Result images: `app/assets/templates/views/searchResult.html`, `app/assets/javascripts/controllers/searchResult.js`.
- Visualization: `app/controllers/analytics/tries_visualization_controller.rb`, `app/views/analytics/tries_visualization/_tree.json.jbuilder`, `vega_data.json.jbuilder`, and `vega_specification.json.erb`.
- External scoring: `app/services/case_score_manager.rb`.

Recover historical files with `git show 5f53d8f8:<path>`. A newer `main` source check also retained the relevant empty-knob help, score-manager defect, account confirmation markup, and visualization implementation.

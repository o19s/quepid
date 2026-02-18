# Per-Component Migration Checklist

Apply the template from [angular_to_stimulus_hotwire_viewcomponents_checklist.md](angular_to_stimulus_hotwire_viewcomponents_checklist.md) (Phase 4.2) to each component below.

**Status:** All components have been migrated to ViewComponents + Stimulus controllers as of the `deangularjs-experimental` branch. Angular is fully removed from the codebase.

## 1. action_icon — [x] Migrated
**ViewComponent:** `ActionIconComponent` | **Stimulus:** (static UI, no controller needed)

## 2. add_query — [x] Migrated
**ViewComponent:** `AddQueryComponent` | **Stimulus:** `add_query_controller.js`

## 3. clone_case — [x] Migrated
**ViewComponent:** `CloneCaseComponent` | **Stimulus:** `clone_case_controller.js`

## 4. export_case — [x] Migrated
**ViewComponent:** `ExportCaseComponent` | **Stimulus:** `export_case_controller.js`

## 5. delete_case — [x] Migrated
**ViewComponent:** `DeleteCaseComponent` | **Stimulus:** `delete_case_controller.js`

## 6. delete_case_options — [x] Migrated
**ViewComponent:** `DeleteCaseOptionsComponent` | **Stimulus:** `delete_case_options_controller.js`

## 7. share_case — [x] Migrated
**ViewComponent:** `ShareCaseComponent` | **Stimulus:** `share_case_controller.js`

## 8. new_case — [x] Migrated
**ViewComponent:** `NewCaseComponent` | **Stimulus:** (static form, no controller needed)

## 9. move_query — [x] Migrated
**ViewComponent:** `MoveQueryComponent` | **Stimulus:** `move_query_controller.js`

## 10. query_options — [x] Migrated
**ViewComponent:** `QueryOptionsComponent` | **Stimulus:** `query_options_controller.js`

## 10a. delete_query — [x] Migrated
**ViewComponent:** `DeleteQueryComponent` | **Stimulus:** `delete_query_controller.js`

## 11. import_ratings — [x] Migrated
**ViewComponent:** `ImportRatingsComponent` | **Stimulus:** `import_ratings_controller.js`

## 12. judgements — [x] Migrated
**ViewComponent:** `JudgementsComponent` | **Stimulus:** `judgements_controller.js`

## 13. diff — [x] Migrated
**ViewComponent:** `DiffComponent` | **Stimulus:** `diff_controller.js`

## 13a. take_snapshot — [x] Migrated
**ViewComponent:** `TakeSnapshotComponent` | **Stimulus:** `take_snapshot_controller.js`

## 13b. custom_headers — [x] Migrated
**ViewComponent:** `CustomHeadersComponent` | **Stimulus:** `custom_headers_controller.js`

## 14. expand_content — [x] Migrated
**ViewComponent:** `ExpandContentComponent` | **Stimulus:** `expand_content_controller.js`

## 15. query_explain — [x] Migrated
**ViewComponent:** `QueryExplainComponent` | **Stimulus:** `query_explain_controller.js`

## 16. debug_matches — [x] Migrated
**ViewComponent:** `MatchesComponent` (renamed from `debug_matches`) | **Stimulus:** `matches_controller.js`

## 17. frog_report — [x] Migrated
**ViewComponent:** `FrogReportComponent` | **Stimulus:** `frog_report_controller.js`

## 18. annotation — [x] Migrated
**ViewComponent:** `AnnotationComponent` | **Stimulus:** `annotations_controller.js` (shared)

## 19. annotations — [x] Migrated
**ViewComponent:** `AnnotationsComponent` | **Stimulus:** `annotations_controller.js`

## 20. qscore_case — [x] Migrated
**ViewComponent:** `QscoreCaseComponent` | **Stimulus:** `qscore_controller.js` (shared)

## 21. qscore_query — [x] Migrated
**ViewComponent:** `QscoreQueryComponent` | **Stimulus:** `qscore_controller.js` (shared)

## 22. qgraph — [x] Migrated
**ViewComponent:** `QgraphComponent` | **Stimulus:** `qgraph_controller.js`

## 23. matches — [x] Migrated
**ViewComponent:** `MatchesComponent` | **Stimulus:** `matches_controller.js`

## 24. query_list (composite) — [x] Migrated
**ViewComponent:** `QueryListComponent` | **Stimulus:** `query_list_controller.js`

## 25. results_pane (composite) — [x] Migrated
**ViewComponent:** `ResultsPaneComponent` | **Stimulus:** `results_pane_controller.js`

---

## Additional Components (not in original Angular)

These ViewComponents were added during migration and don't have Angular equivalents:

- **ChartPanelComponent** + `chart_panel_controller.js` — D3 score chart panel
- **ScorerPanelComponent** + `scorer_panel_controller.js` — Scorer selection panel
- **SettingsPanelComponent** + `settings_panel_controller.js` — Settings/try configuration panel
- **QueryParamsPanelComponent** + `query_params_panel_controller.js` — Query params display
- **DocumentCardComponent** — Individual document card rendering
- **DocFinderComponent** + `doc_finder_controller.js` — Find and rate missing documents
- **NewCaseWizardComponent** + `new_case_wizard_controller.js` — Guided case creation flow
- **QscoreColorable** — Shared module for score-to-color mapping

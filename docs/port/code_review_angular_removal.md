# Code Review: Angular Removal

**Date:** Feb 17, 2026
**Updated:** Feb 17, 2026 — Angular is now fully removed from the codebase.

---

## 1. Medium: Lost Functionality — Tour

**Files:** `app/assets/javascripts/tour.js` (deleted), `app/assets/stylesheets/tour.css` (still present)

**Finding:** The Shepherd tour (`setupTour`) that guided users through the case workspace was deleted with the Angular app. The tour was never ported to the modern stack. `tour.css` still exists with `.shepherd-active` and related classes but is unused — kept as a placeholder for future tour implementation.

**Impact:** New users no longer get the guided onboarding tour when they first open a case.

**Recommendation:** Port the tour to Stimulus or a standalone JS module when onboarding UX is prioritized. If ported, update selectors to `#add-query` and `#add-query-submit`. Consider removing `tour.css` if no tour is planned.

---

## 2. Medium: Lost Functionality — New Case Wizard

**Files:** `app/controllers/core_controller.rb` (line 32), `new_case_component.rb`

**Finding:** `CoreController#new` redirects with `params: { showWizard: true }`. The Angular `WizardModalCtrl` / `WizardCtrl` that handled the multi-step wizard was deleted. The modern `NewCaseComponent` links to `case_new_path` and does not implement a wizard modal.

**Impact:** The `showWizard=true` query param is passed but has no effect; users get a redirect to the case workspace without a guided setup flow.

**Recommendation:** Either (a) remove the `showWizard` param from the redirect until a wizard is implemented, or (b) implement a Stimulus-based wizard modal as a follow-up.

---

## 3. Low: Orphaned Files

**Files:** `app/assets/javascripts/mode-json.js`, `app/assets/javascripts/scorerEvalTest.js`

These are the only two files remaining in `app/assets/javascripts/` — all Angular services, factories, components, controllers, and templates have been deleted.

| File | Purpose | Referenced by | Modern equivalent | Recommendation |
|------|---------|---------------|-------------------|----------------|
| **mode-json.js** | ACE editor JSON syntax highlighting mode | `lib/jshint/lint.rb` (skip list only) | CodeMirror (`modules/editor.js`) is used in the modern stack | **Remove.** ACE editor is no longer used. The lint skip reference would also be removed. |
| **scorerEvalTest.js** | Scorer evaluation test utility | `scorer_test_controller.js` (comment only, noting it replaced this file) | `scorer_test_controller.js` + server-side `JavascriptScorer` | **Remove.** Superseded by Stimulus controller; only referenced in a historical comment. |

---

## 7. Functionality from Deleted Angular Code — Migration Status

| Functionality | Deleted Source | Modern Status | Notes |
|---------------|----------------|---------------|-------|
| **Tour (onboarding)** | `tour.js` | ❌ Not migrated | Shepherd tour deleted; no Stimulus equivalent. `tour.css` remains as placeholder. |
| **Full Angular app** | `app/assets/javascripts/` | ✅ Fully removed | Only `mode-json.js` and `scorerEvalTest.js` remain as orphaned files (safe to delete). |
| **Case listing** | Angular `casesCtrl.js` + components | ✅ Migrated | `cases_controller.rb` + `app/views/cases/index.html.erb` |
| **Teams** | Angular `teamsCtrl.js` + components | ✅ Migrated | `teams_controller.rb` + `app/views/teams/` |
| **Scorers** | Angular `scorersCtrl.js` + components | ✅ Migrated | `scorers_controller.rb` + `app/views/scorers/` |
| **Core workspace** | Angular directives + controllers | ✅ Migrated | 36 ViewComponents + 50 Stimulus controllers |
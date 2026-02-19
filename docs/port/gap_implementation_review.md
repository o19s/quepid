# Gap Implementation Review: Concerns & Recommendations

Review of the 5 high-priority gaps implemented during de-Angularization. For the full gap inventory and resolution record, see [archives/deangularjs_experimental_functionality_gaps_complete.md](archives/deangularjs_experimental_functionality_gaps_complete.md).

**Status (current codebase):** Multiple items from this review are now complete and have been moved to the archive record (`archives/deangularjs_experimental_functionality_gaps_complete.md`): URL fix in `_addFirstQuery`, curator-vars transaction, delete-current-try redirect, inline endpoint creation, document-field payload guard, unique details modal IDs, try duplication curator-var copy, wizard step validation, dynamic engine options, and `apiFetch` usage in `_addFirstQuery`.

---

## Gap 1: Detailed Document View / Full Field Explorer

**Current implementation:** Document cards are **server-rendered** by `DocumentCardComponent` (`app/components/document_card_component.html.erb`). The `data-doc-fields` attribute is set with ERB `h(fields_json)`. The results pane fetches HTML from the query search API and injects it; the detail modal in `results_pane_controller.js` reads `data-doc-fields` from the card and builds the fields list in JS.

### Concerns

- No open concerns currently.

### Recommendations

- Add an integration test that clicks the Details button and verifies modal content renders.

---

## Gap 2: Try History Browser + Try Management

**Current implementation:** `settings_panel_controller.js` implements `deleteTry()`. When the deleted try is the current try, it navigates to `buildPageUrl(root, "case", caseId)` (case root, which loads the latest try) instead of reloading, avoiding a 404.

### Concerns

- No open concerns currently.

### Recommendations

- Keep existing guard and truncation behavior covered by tests.

---

## Gap 3: Curator Variables / Tuning Knobs

**Current implementation:** `Api::V1::TriesController#update` wraps `curator_variables.destroy_all` and `add_curator_vars` in `ActiveRecord::Base.transaction` when `params[:curator_vars].present?` (lines 103–107). Curator inputs are rendered in `settings_panel_controller.js` via `_renderCuratorVarInputs()`.

### Concerns

1. **`innerHTML` with user-controlled content** — `_renderCuratorVarInputs()` in `settings_panel_controller.js` builds HTML via string interpolation with `_escapeHtmlAttr(name)` and `_escapeHtmlAttr(value)`. Values go into `value="..."` attributes; ensure `_escapeHtmlAttr` covers all necessary characters (e.g. `"`, `<`, `&`). Prefer DOM API or a shared safe-builder for defense-in-depth.

### Recommendations

- Switch `_renderCuratorVarInputs()` to DOM API (`document.createElement`) instead of innerHTML where practical.

---

## Gap 4: New Case Setup Wizard (Enhanced)

**Current implementation:** `new_case_wizard_controller.js` uses `buildCaseQueriesUrl(root, this.caseIdValue)` for the first-query POST (`_addFirstQuery`), so the URL is correct. `Api::V1::TriesController#update` supports inline endpoint creation: it accepts `params[:search_endpoint]`, finds or creates a `SearchEndpoint` (including `SearchEndpoint.new(...).save!` when not found), and assigns it to `@try` (lines 86–100).

### Concerns

- **`_markWizardComplete` updates user profile** — Sends `{ user: { completed_case_wizard: true } }` to the users API. This is a per-user flag; once set, the wizard does not show again for new cases. Consider per-case or conditional display based on try configuration.

### Recommendations

- Reconsider the per-user `completed_case_wizard` flag — e.g. per-case or show wizard when try has no configured endpoint.

---

## Gap 5: Client-Side Real-Time Scoring

**Current implementation:** `QueryScoreService` provides lightweight per-query scoring using persisted ratings (no search re-fetch). The score endpoint (`Api::V1::Queries::ScoresController`) uses `QueryScoreService` to compute scores server-side. `query_list_controller.js` listens for `query-score:refresh` events and updates score badges. Scorer testing has been enhanced: `ScorersController#test` (POST `/scorers/:id/test`) runs scorer code server-side with sample docs, and `scorer_test_controller.js` provides the UI integration.

### Concerns

- **JavascriptScorer instantiation per request** — `QueryScoreService.score` creates a new `JavascriptScorer` (MiniRacer context) per call. MiniRacer context creation is expensive (~10-50ms). For rapid rating changes, this could add up. Consider caching the scorer instance per-request or using a connection pool.
- **`this.caseId` vs `this.caseIdValue` inconsistency** — In `query_list_controller.js:93`, the score update dispatches `caseId: this.caseId` (a computed getter at line 443-446 that reads from the workspace DOM element), but the refresh event handler at line 56 reads `event.detail.caseId`. These work but use different casing conventions (`caseId` getter vs `caseIdValue` Stimulus value). The controller doesn't declare `caseId` as a Stimulus value, relying instead on the DOM getter. This is fine but could confuse future maintainers.
- **Authorization on the score endpoint** — `Api::V1::Queries::ScoresController` uses `set_case` (from `CurrentCaseManager`: case is loaded via `current_user.cases_involved_with` or as a public case) and `check_case` (renders 404 if `@case` is nil). So only cases the user can access are scoreable; no change needed for auth.
- **Race condition between lightweight and full scoring** — The lightweight score updates the badge immediately, then the 3-second debounced full evaluation overwrites it. If the user rates multiple docs quickly, the sequence could be: lightweight score A → lightweight score B → full eval (using all ratings) → badge shows full eval score. This is fine, but the badge may "jump" from the lightweight score to the full score, which could confuse users.
- **Missing error handling for non-JS scorers** — Some scorers may use external scoring (e.g. LLM-based scorers via `AiJudge`). `QueryScoreService` only handles `JavascriptScorer`. If the case uses a non-JS scorer, the endpoint returns `nil` score, and the badge shows nothing. Should fall back gracefully.

### Recommendations

- Add a prominent caveat in the UI or service docs: lightweight scoring is an approximation for position-independent scorers only. For NDCG/AP/ERR, the full evaluation is needed.
- Add a rate limit or debounce on the client side for the lightweight score endpoint — don't fire it more than once per 500ms per query.
- Handle the badge "jump" with a brief fade transition so the score change looks intentional.

---

## Cross-Cutting Concerns

### 1. `innerHTML` usage pattern
Document cards are server-rendered (`DocumentCardComponent`); the results pane still assigns fetched HTML and builds the detail modal content via `innerHTML` with `_escapeHtml` / `_escapeHtmlAttr`. The settings panel builds curator var inputs with `innerHTML`. One missed escape in a future edit could introduce XSS. Consider:
- A shared `buildElement()` helper using the DOM API
- Or `<template>` elements in HTML, cloned and populated

### 2. `apiFetch` vs raw `fetch`
Most controllers use `apiFetch()` (CSRF and root URL). `new_case_wizard_controller.js` now uses `apiFetch()` in `_addFirstQuery` with form-encoded content. `scorer_test_controller.js` still uses raw `fetch()` (lines 31–39) with manual CSRF token extraction.

### 4. Missing test coverage
- No JS tests for any of the 5 gap implementations (Vitest)
- No system/integration tests for the wizard multi-step flow
- No controller test for `TriesController#update` with `curator_vars` parameter
- The `QueryScoreService` test doesn't test with a real scorer code string (mocking would require MiniRacer setup in test env)
- `ScorersController#test` has controller tests (`scorers_controller_test.rb` lines 242-304), but no JS tests for `scorer_test_controller.js`

### 5. Accessibility
- Detail modal, wizard steps, and curator var inputs lack `aria-label` or `aria-describedby` attributes
- Step navigation doesn't announce step changes to screen readers (add `aria-live="polite"` region)
- Rating popovers and badge updates don't announce score changes

### 6. Mobile responsiveness
- The detail modal `<dl class="row">` with `col-sm-3`/`col-sm-9` will stack on small screens, which is fine
- The wizard modal is `modal-lg` — on phones this could overflow. Consider `modal-dialog-scrollable`
- Try history buttons are very small (`py-0 px-1`) — hard to tap on touch devices

---

## Priority Fix List

| Priority | Gap | Issue | Status / Effort |
|----------|-----|-------|-----------------|
| **P3** | All | Add JS tests for new controllers | 2-4 hrs |
| **P3** | All | Accessibility improvements | 1-2 hrs |

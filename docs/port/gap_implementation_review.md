# Gap Implementation Review: Concerns & Recommendations

Review of the 5 high-priority gaps implemented during de-Angularization. For the full gap inventory and resolution record, see [archives/deangularjs_experimental_functionality_gaps_complete.md](archives/deangularjs_experimental_functionality_gaps_complete.md).

**Status (current codebase):** The former P0 URL bug in Gap 4 is **fixed**: `_addFirstQuery` uses `buildCaseQueriesUrl(root, this.caseIdValue)` from `utils/quepid_root.js`, which correctly builds `/case/:id/queries`. Curator-vars update in Gap 3 is wrapped in a transaction. Delete-current-try in Gap 2 redirects to case root instead of reload (avoids 404). Inline endpoint creation in the tries API is supported.

---

## Gap 1: Detailed Document View / Full Field Explorer

**Current implementation:** Document cards are **server-rendered** by `DocumentCardComponent` (`app/components/document_card_component.html.erb`). The `data-doc-fields` attribute is set with ERB `h(fields_json)`. The results pane fetches HTML from the query search API and injects it; the detail modal in `results_pane_controller.js` reads `data-doc-fields` from the card and builds the fields list in JS.

### Concerns

1. **XSS in detail modal field display** — The modal builds HTML via `_escapeHtml` / `_escapeHtmlAttr` in `results_pane_controller.js` (e.g. lines 491–498). Card attributes themselves are server-escaped; the remaining risk is in the JS-built `<dl>` content. Ensure all field values are consistently escaped (e.g. `&` in values).

2. **Large JSON payloads in DOM attributes** — `DocumentCardComponent` embeds full `fields_json` in `data-doc-fields` on every card with no size limit. Documents with many fields (e.g. 50+ Solr fields) can bloat the DOM. Consider a size guard in the component (e.g. omit `data-doc-fields` when `fields_json.length > 10_000`) and have the detail modal fetch fields on demand or use a smaller payload.

3. **Modal ID collision** — The detail modal uses a static ID. If multiple results-pane instances exist (e.g. with Turbo Frames), they could share the same modal. Consider a unique suffix (e.g. query ID).

### Recommendations

- Add a size guard in `DocumentCardComponent`: if `fields_json.length > 10_000`, omit `data-doc-fields` (or pass a truncated payload) and have the detail modal fetch full fields on demand or from a smaller source.
- Add an integration test that clicks the Details button and verifies modal content renders.

---

## Gap 2: Try History Browser + Try Management

**Current implementation:** `settings_panel_controller.js` implements `deleteTry()`. When the deleted try is the current try, it navigates to `buildPageUrl(root, "case", caseId)` (case root, which loads the latest try) instead of reloading, avoiding a 404.

### Concerns

1. **No protection against deleting the last try** — `deleteTry()` sends DELETE without checking if this is the only try on the case. The API may allow it, leaving the case in a broken state with no try.

2. **N+1 query potential** — Where tries are loaded (e.g. settings panel / try history), ensure `includes(:search_endpoint)` (or other associations used in the view) is present. Adding access to `curator_variables` or other associations without eager loading would introduce N+1.

3. **No pagination for try history** — Cases with 50+ tries (common in iterative tuning) render a long list. Consider showing only the latest 10–20 with a "Show all" toggle.

### Recommendations

- Add a client-side guard in `deleteTry()`: count visible try items, refuse if only 1 remains.
- Add `limit(20)` (or similar) to the tries list and a "Show all N tries" link if truncated.

---

## Gap 3: Curator Variables / Tuning Knobs

**Current implementation:** `Api::V1::TriesController#update` wraps `curator_variables.destroy_all` and `add_curator_vars` in `ActiveRecord::Base.transaction` when `params[:curator_vars].present?` (lines 103–107). Curator inputs are rendered in `settings_panel_controller.js` via `_renderCuratorVarInputs()`.

### Concerns

1. **`innerHTML` with user-controlled content** — `_renderCuratorVarInputs()` in `settings_panel_controller.js` builds HTML via string interpolation with `_escapeHtmlAttr(name)` and `_escapeHtmlAttr(value)`. Values go into `value="..."` attributes; ensure `_escapeHtmlAttr` covers all necessary characters (e.g. `"`, `<`, `&`). Prefer DOM API or a shared safe-builder for defense-in-depth.

2. **No server-side validation of curator var names** — The regex `##([^#]+?)##` allows any non-`#` characters. `Try#add_curator_vars` creates `CuratorVariable` records without strict name validation. Consider sanitizing names server-side (e.g. alphanumeric + underscores).

3. **Curator vars not copied on try duplication** — `duplicateTry()` in `settings_panel_controller.js` sends only `{ parent_try_number, try: {} }`. The API create action does not copy `curator_variables` from the parent try, so duplicated tries lose their tuning knobs.

### Recommendations

- Switch `_renderCuratorVarInputs()` to DOM API (`document.createElement`) instead of innerHTML where practical.
- When creating a try with `parent_try_number`, copy parent `curator_variables` (server-side or by sending `curator_vars` from client using parent try's values).
- Consider sanitizing var names server-side (alphanumeric + underscores only).

---

## Gap 4: New Case Setup Wizard (Enhanced)

**Current implementation:** `new_case_wizard_controller.js` uses `buildCaseQueriesUrl(root, this.caseIdValue)` for the first-query POST (`_addFirstQuery`), so the URL is correct. `Api::V1::TriesController#update` supports inline endpoint creation: it accepts `params[:search_endpoint]`, finds or creates a `SearchEndpoint` (including `SearchEndpoint.new(...).save!` when not found), and assigns it to `@try` (lines 86–100).

### Concerns

1. **No input validation** — The wizard can advance with an empty endpoint URL (step 2) or empty field spec (step 3). Step 4 allows no query by design. Steps 2 and 3 should validate before "Next" (e.g. disable button or highlight required fields).

2. **`_markWizardComplete` updates user profile** — Sends `{ user: { completed_case_wizard: true } }` to the users API. This is a per-user flag; once set, the wizard does not show again for new cases. Consider per-case or conditional display based on try configuration.

3. **Hardcoded engine list** — The search engine `<select>` in `new_case_wizard_component.html.erb` hardcodes 6 options (solr, es, os, vectara, algolia, searchapi). Prefer deriving from `SearchEndpoint` (e.g. `SEARCH_ENGINES`) or an API response so new engines are picked up automatically.

4. **`_addFirstQuery` uses raw `fetch`** — Unlike other wizard calls that use `apiFetch()`, the first-query POST uses raw `fetch` with manual CSRF token. Standardizing on `apiFetch()` would keep behavior and error handling consistent.

### Recommendations

- Add step validation: disable "Next" until required fields (endpoint URL, field spec) have values.
- Reconsider the per-user `completed_case_wizard` flag — e.g. per-case or show wizard when try has no configured endpoint.
- Pull the engine list from a data attribute or API (e.g. from `SearchEndpoint`).
- Use `apiFetch()` in `_addFirstQuery` for consistency.

---

## Gap 5: Client-Side Real-Time Scoring

### Concerns

1. **Scorer code assumes search result order** — `QueryScoreService` builds `docs` from `query.ratings` in database order, not search-result rank order. Position-sensitive scorers (NDCG, ERR, AP) **will produce wrong scores** because they need the document's rank position from the actual search results. The service comment acknowledges this ("scorers that need position info won't work without a search") but doesn't surface this limitation to the user — the badge will show a score that may be significantly different from the real score.

2. **JavascriptScorer instantiation per request** — `QueryScoreService.score` creates a new `JavascriptScorer` (MiniRacer context) per call. MiniRacer context creation is expensive (~10-50ms). For rapid rating changes, this could add up. Consider caching the scorer instance per-request or using a connection pool.

3. **`this.caseId` vs `this.caseIdValue` inconsistency** — In `query_list_controller.js:89`, the score update dispatches `caseId: this.caseId` (a computed getter that reads from the workspace DOM element), but the refresh event handler at line 52 reads `event.detail.caseId`. These work but use different casing conventions (`caseId` getter vs `caseIdValue` Stimulus value). The controller doesn't declare `caseId` as a Stimulus value, relying instead on the DOM getter. This is fine but could confuse future maintainers.

4. **Authorization on the score endpoint** — `Api::V1::Queries::ScoresController` uses `set_case` (from `CurrentCaseManager`: case is loaded via `current_user.cases_involved_with` or as a public case) and `check_case` (renders 404 if `@case` is nil). So only cases the user can access are scoreable; no change needed for auth.

5. **Race condition between lightweight and full scoring** — The lightweight score updates the badge immediately, then the 3-second debounced full evaluation overwrites it. If the user rates multiple docs quickly, the sequence could be: lightweight score A → lightweight score B → full eval (using all ratings) → badge shows full eval score. This is fine, but the badge may "jump" from the lightweight score to the full score, which could confuse users.

6. **Missing error handling for non-JS scorers** — Some scorers may use external scoring (e.g. LLM-based scorers via `AiJudge`). `QueryScoreService` only handles `JavascriptScorer`. If the case uses a non-JS scorer, the endpoint returns `nil` score, and the badge shows nothing. Should fall back gracefully.

### Recommendations

- Add a prominent caveat in the UI or service docs: lightweight scoring is an approximation for position-independent scorers only. For NDCG/AP/ERR, the full evaluation is needed.
- Consider passing a `position` field to each doc in `QueryScoreService` (based on the last known search result order, if cached).
- Add a rate limit or debounce on the client side for the lightweight score endpoint — don't fire it more than once per 500ms per query.
- Handle the badge "jump" with a brief fade transition so the score change looks intentional.

---

## Cross-Cutting Concerns

### 1. `innerHTML` usage pattern
Document cards are server-rendered (`DocumentCardComponent`); the results pane still assigns fetched HTML and builds the detail modal content via `innerHTML` with `_escapeHtml` / `_escapeHtmlAttr`. The settings panel builds curator var inputs with `innerHTML`. One missed escape in a future edit could introduce XSS. Consider:
- A shared `buildElement()` helper using the DOM API
- Or `<template>` elements in HTML, cloned and populated

### 2. Error feedback via `window.flash`
Several controllers use `if (window.flash) window.flash.error = err.message`. Verify that `window.flash` is actually wired up in the modern layout. If not, errors are silently swallowed and only appear in the console. Users won't know why an operation failed.

### 3. `apiFetch` vs raw `fetch`
Most controllers use `apiFetch()` (CSRF and root URL). `new_case_wizard_controller.js` still uses raw `fetch()` with manual CSRF in `_addFirstQuery` (lines 202–210). Standardize on `apiFetch()` there for consistent error handling and CSRF.

### 4. Missing test coverage
- No JS tests for any of the 5 gap implementations (Vitest)
- No system/integration tests for the wizard multi-step flow
- No controller test for `TriesController#update` with `curator_vars` parameter
- The `QueryScoreService` test doesn't test with a real scorer code string (mocking would require MiniRacer setup in test env)

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
| ~~**P0**~~ | 4 | ~~Missing `/` in `_addFirstQuery` URL~~ | **Fixed** — uses `buildCaseQueriesUrl()` |
| ~~**P1**~~ | 3 | ~~`destroy_all` not wrapped in transaction~~ | **Fixed** — transaction in `TriesController#update` |
| ~~**P1**~~ | 2 | ~~Delete current try → reload hits 404~~ | **Fixed** — redirect to case root when deleting current try |
| ~~**P1**~~ | 4 | ~~Verify tries API handles inline endpoint~~ | **Verified** — `TriesController#update` finds/creates endpoint |
| **P2** | 5 | Position-insensitive scoring caveat + docs | 15 min |
| **P2** | 1 | Large JSON in DOM — size guard in `DocumentCardComponent` | 15 min |
| **P2** | 3 | Curator vars not copied on try duplication | 30 min |
| **P2** | 4 | Use `apiFetch()` in `_addFirstQuery` | 5 min |
| **P3** | 2 | Guard: refuse delete when only one try; paginate try history | 20 min |
| **P3** | 4 | Step validation before Next; engine list from backend | 30 min |
| **P3** | All | Add JS tests for new controllers | 2-4 hrs |
| **P3** | All | Accessibility improvements | 1-2 hrs |

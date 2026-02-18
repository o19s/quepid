# Gap Implementation Review: Concerns & Recommendations

Review of the 5 high-priority gaps implemented on the `deangularjs-experimental` branch. See [deangularjs_experimental_functionality_gap_report.md](deangularjs_experimental_functionality_gap_report.md) for the full gap inventory.

**Note:** The P0 URL bug in Gap 4 (`_addFirstQuery` missing `/` at `new_case_wizard_controller.js:130`) is **still present** as of the latest commit.

---

## Gap 1: Detailed Document View / Full Field Explorer

### Concerns

1. **XSS risk in `_buildDocumentCardsHtml` field embedding** — The `data-doc-fields` attribute on JS-built cards uses `_escapeHtmlAttr(JSON.stringify(doc.fields))`. Verify that `_escapeHtmlAttr` handles all edge cases (nested quotes, backticks, template literals in field values from untrusted search engines). The server-rendered path uses ERB `h()` which is safer.

2. **Large JSON payloads in DOM attributes** — Documents with many fields (e.g. 50+ Solr fields) embed the full JSON as a `data-doc-fields` attribute on every card. This doubles the DOM size and slows parsing. Consider lazy-loading: only fetch fields on demand when the user clicks "Details", either from `_lastRenderedDocs` (already in memory for JSON path) or via a lightweight API call.

3. **Modal ID collision** — The detail modal uses a static `id="results-pane-detail-modal"`. If multiple `ResultsPaneComponent` instances exist on the same page (unlikely but possible with Turbo Frames), they'd share the same modal ID, causing Bootstrap to target the wrong one. Consider using a unique suffix (e.g. the query ID).

### Recommendations

- Add a size guard: if `fields_json.length > 10_000`, omit `data-doc-fields` and fall back to the `_lastRenderedDocs` lookup (or an API fetch).
- Add an integration test that clicks the Details button and verifies modal content renders.

---

## Gap 2: Try History Browser + Try Management

### Concerns

1. **No protection against deleting the last try** — `deleteTry()` sends DELETE without checking if this is the only try on the case. The API may allow it, leaving the case in a broken state with no try. The Angular version prevented this.

2. **`window.location.reload()` after delete** — If the deleted try was the current try, the reload would hit a 404 (`/case/:id/try/:deleted_number`). Should redirect to the latest remaining try instead.

3. **N+1 query potential** — `tries: @case.tries.includes(:search_endpoint).order(try_number: :desc)` is good, but if the template accesses `t.curator_variables` or other associations, it will N+1. Currently it only uses `search_endpoint`, so this is fine today but fragile.

4. **No pagination for try history** — Cases with 50+ tries (common in iterative tuning) will render a very long list. Consider showing only the latest 10 with a "Show all" toggle.

### Recommendations

- Add a client-side guard in `deleteTry()`: count visible try items, refuse if only 1 remains.
- After delete, redirect to `${root}case/${caseId}/try/${latestTryNumber}` (fetch latest from API or read from DOM) rather than `window.location.reload()`.
- Add `limit(20)` to the tries query and a "Show all N tries" link if truncated.

---

## Gap 3: Curator Variables / Tuning Knobs

### Concerns

1. **`innerHTML` with user-controlled content** — `_renderCuratorVarInputs()` builds HTML via string interpolation with `escapedName` and `escapedValue`. The escaping covers `"` and `<`, but not `'` or `` ` ``. Since values go into `value="..."` attributes (double-quoted), single quotes are safe, but a value containing `&` would render as literal `&amp;` in the input. Use proper HTML entity encoding or build DOM elements programmatically.

2. **`destroy_all` + `add_curator_vars` is not atomic** — In `tries_controller.rb#update`, if `add_curator_vars` raises (e.g. validation error), the old variables are already destroyed. Wrap in a transaction:
   ```ruby
   ActiveRecord::Base.transaction do
     @try.curator_variables.destroy_all
     @try.add_curator_vars params[:curator_vars]
   end
   ```

3. **No server-side validation of curator var names** — The regex `##([^#]+?)##` allows any non-`#` characters, including spaces, special chars, even newlines. The `Try#add_curator_vars` method may or may not validate names. If not, malformed names could cause issues during query substitution.

4. **Curator vars not included in try duplication** — When `duplicateTry()` creates a new try via `parent_try_number`, it's unclear if the API's try creation logic copies curator variables from the parent. If not, duplicated tries lose their tuning knobs.

### Recommendations

- Switch `_renderCuratorVarInputs()` to DOM API (`document.createElement`) instead of innerHTML for defense-in-depth.
- Wrap the destroy/create in a transaction in the controller.
- Verify `Try.dup_try` copies `curator_variables` — if not, add that.
- Consider sanitizing var names server-side (alphanumeric + underscores only).

---

## Gap 4: New Case Setup Wizard (Enhanced)

### Concerns

1. **URL construction bug in `_addFirstQuery`** — Line 130: `` `${root}case${this.caseIdValue}/queries` `` is missing the `/` between `case` and the case ID. Should be `` `${root}case/${this.caseIdValue}/queries` ``. This means the first-query POST goes to the wrong URL.

2. **New endpoint creation not supported by tries API** — `_saveEndpointAndFieldSpec()` sends `body.search_endpoint = { search_engine, endpoint_url }` in the try update PUT. The `Api::V1::TriesController#update` may not handle inline endpoint creation (it likely expects `search_endpoint_id` only). The Angular wizard created the endpoint first via `SearchEndpointsController`, then passed the ID to the try. This needs verification.

3. **No input validation** — The wizard allows finishing with an empty endpoint URL (step 2), empty field spec (step 3), and empty query (step 4, by design). Steps 2 and 3 should validate before allowing "Next" — at minimum, highlight required fields.

4. **`_markWizardComplete` updates user profile** — This PUTs `{ user: { completed_case_wizard: true } }` to the users API. But this is a per-user flag, not per-case. Once set, the wizard never shows again, even for new cases created later. The Angular version showed the wizard per-case by checking the try's configuration state, not a user flag.

5. **Hardcoded engine list** — The search engine `<select>` hardcodes 6 options (solr, es, os, vectara, algolia, searchapi). This should come from `SearchEndpoint::SEARCH_ENGINES` or equivalent to stay in sync as new engines are added.

### Recommendations

- **Fix the URL bug** — Critical: add the missing `/` in `_addFirstQuery`.
- Verify the try update API can create endpoints inline, or add a preliminary POST to `/api/v1/search_endpoints` before updating the try.
- Add step validation: disable "Next" until required fields have values.
- Reconsider the per-user `completed_case_wizard` flag — either make it per-case or show the wizard conditionally based on whether the try has a configured endpoint.
- Pull the engine list from a data attribute or API response.

---

## Gap 5: Client-Side Real-Time Scoring

### Concerns

1. **Scorer code assumes search result order** — `QueryScoreService` builds `docs` from `query.ratings` in database order, not search-result rank order. Position-sensitive scorers (NDCG, ERR, AP) **will produce wrong scores** because they need the document's rank position from the actual search results. The service comment acknowledges this ("scorers that need position info won't work without a search") but doesn't surface this limitation to the user — the badge will show a score that may be significantly different from the real score.

2. **JavascriptScorer instantiation per request** — `QueryScoreService.score` creates a new `JavascriptScorer` (MiniRacer context) per call. MiniRacer context creation is expensive (~10-50ms). For rapid rating changes, this could add up. Consider caching the scorer instance per-request or using a connection pool.

3. **`this.caseId` vs `this.caseIdValue` inconsistency** — In `query_list_controller.js:89`, the score update dispatches `caseId: this.caseId` (a computed getter that reads from the workspace DOM element), but the refresh event handler at line 52 reads `event.detail.caseId`. These work but use different casing conventions (`caseId` getter vs `caseIdValue` Stimulus value). The controller doesn't declare `caseId` as a Stimulus value, relying instead on the DOM getter. This is fine but could confuse future maintainers.

4. **No authorization on the score endpoint** — `ScoresController` inherits from `Api::ApiController` and uses `set_case` + `check_case`. Verify that `check_case` enforces that the current user has access to the case. If it only checks existence, any authenticated user could score any case's queries.

5. **Race condition between lightweight and full scoring** — The lightweight score updates the badge immediately, then the 3-second debounced full evaluation overwrites it. If the user rates multiple docs quickly, the sequence could be: lightweight score A → lightweight score B → full eval (using all ratings) → badge shows full eval score. This is fine, but the badge may "jump" from the lightweight score to the full score, which could confuse users.

6. **Missing error handling for non-JS scorers** — Some scorers may use external scoring (e.g. LLM-based scorers via `AiJudge`). `QueryScoreService` only handles `JavascriptScorer`. If the case uses a non-JS scorer, the endpoint returns `nil` score, and the badge shows nothing. Should fall back gracefully.

### Recommendations

- Add a prominent caveat in the UI or service docs: lightweight scoring is an approximation for position-independent scorers only. For NDCG/AP/ERR, the full evaluation is needed.
- Consider passing a `position` field to each doc in `QueryScoreService` (based on the last known search result order, if cached).
- Add a rate limit or debounce on the client side for the lightweight score endpoint — don't fire it more than once per 500ms per query.
- Verify `check_case` authorization in `ApiController`.
- Handle the badge "jump" with a brief fade transition so the score change looks intentional.

---

## Cross-Cutting Concerns

### 1. `innerHTML` usage pattern
Multiple controllers build HTML via string interpolation and assign to `innerHTML`. While `_escapeHtml` / `_escapeHtmlAttr` helpers mitigate XSS, this pattern is fragile — one missed escape in a future edit creates a vulnerability. Consider:
- A shared `buildElement()` helper that uses the DOM API
- Or a lightweight template library (e.g. `<template>` elements in HTML, cloned and populated)

### 2. Error feedback via `window.flash`
Several controllers use `if (window.flash) window.flash.error = err.message`. Verify that `window.flash` is actually wired up in the modern layout. If not, errors are silently swallowed and only appear in the console. Users won't know why an operation failed.

### 3. `apiFetch` vs raw `fetch`
Some controllers use `apiFetch()` (which handles CSRF and root URL) while others use raw `fetch()` with manual CSRF token extraction (e.g. `new_case_wizard_controller.js:132`). Standardize on `apiFetch()` everywhere to reduce duplication and ensure consistent error handling.

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

| Priority | Gap | Issue | Effort |
|----------|-----|-------|--------|
| **P0** | 4 | Missing `/` in `_addFirstQuery` URL — wizard can't add queries | 1 min |
| **P1** | 3 | `destroy_all` not wrapped in transaction — data loss risk | 5 min |
| **P1** | 2 | Delete current try → reload hits 404 | 15 min |
| **P1** | 4 | Verify tries API handles inline endpoint creation | 30 min |
| **P2** | 5 | Position-insensitive scoring caveat + docs | 15 min |
| **P2** | 1 | Large JSON in DOM attributes — add size guard | 15 min |
| **P2** | 3 | Curator vars not copied on try duplication | 30 min |
| **P2** | All | Standardize on `apiFetch()` everywhere | 20 min |
| **P3** | 2 | Paginate try history (limit 20) | 20 min |
| **P3** | 4 | Step validation before Next | 30 min |
| **P3** | All | Add JS tests for new controllers | 2-4 hrs |
| **P3** | All | Accessibility improvements | 1-2 hrs |

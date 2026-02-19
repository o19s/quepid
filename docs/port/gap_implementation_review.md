# Gap Implementation Review: Concerns & Recommendations

Review of the 5 high-priority gaps implemented during de-Angularization. For the full gap inventory and resolution record, see [archives/deangularjs_experimental_functionality_gaps_complete.md](archives/deangularjs_experimental_functionality_gaps_complete.md).

**Status (current codebase):** Multiple items from this review are now complete and have been moved to the archive record (`archives/deangularjs_experimental_functionality_gaps_complete.md`): URL fix in `_addFirstQuery`, curator-vars transaction, delete-current-try redirect, inline endpoint creation, document-field payload guard, unique details modal IDs, try duplication curator-var copy, wizard step validation, dynamic engine options, and `apiFetch` usage in `_addFirstQuery`.

---

**Note:** All 5 gap implementations are complete. Implementation details have been moved to [archives/port_completed.md](archives/port_completed.md#completed-gap-implementations-2026-02-19). This document now focuses on remaining concerns and recommendations.

---

## Gap 5: Client-Side Real-Time Scoring

**Status:** ✅ **COMPLETE** — See [archives/port_completed.md](archives/port_completed.md#completed-gap-implementations-2026-02-19).

### Concerns

- **JavascriptScorer instantiation per request** — `QueryScoreService.score` creates a new `JavascriptScorer` (MiniRacer context) per call. MiniRacer context creation is expensive (~10-50ms). For rapid rating changes, this could add up. Consider caching the scorer instance per-request or using a connection pool.
- **`this.caseId` vs `this.caseIdValue` inconsistency** — In `query_list_controller.js:93`, the score update dispatches `caseId: this.caseId` (a computed getter at line 443-446 that reads from the workspace DOM element), but the refresh event handler at line 56 reads `event.detail.caseId`. These work but use different casing conventions (`caseId` getter vs `caseIdValue` Stimulus value). The controller doesn't declare `caseId` as a Stimulus value, relying instead on the DOM getter. This is fine but could confuse future maintainers.
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

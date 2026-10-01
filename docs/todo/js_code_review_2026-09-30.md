# JavaScript code review — 2026-09-30

Scope: `app/javascript/` (Stimulus controllers, utils, stores), reviewed by hand with targeted greps. This is a **sampled** review, not a line-by-line audit of all ~20k lines. Nothing was run and no code was changed.

**Priority key:** **P1** = do now (user-visible failure or unblocks other fixes); **P2** = do soon (real defect or real cost, limited blast radius); **P3** = opportunistic (fix when touching the file; no urgency).

Overall: XSS escaping and document/window listener cleanup are mostly disciplined. The real problems are a handful of concrete bugs, duplicated plumbing, and layering.

## Bugs worth fixing

1. **[P2] Autocomplete race.** [team_member_autocomplete_controller.js:60](../../app/javascript/controllers/team_member_autocomplete_controller.js#L60) debounces typing but never cancels in-flight requests. A slow response for "da" can arrive after "dave" and overwrite the dropdown. Fix: keep an `AbortController`; abort on each new search and in `disconnect`.
2. **[P2] Infinite polling in `pane_controller`.** [pane_controller.js:36-38](../../app/javascript/controllers/pane_controller.js#L36-L38) retries `refreshElements` every 200ms while `offsetWidth === 0`, and `disconnect()` never clears the timer. If the pane is removed while hidden it polls forever against a detached node. Fix: store and clear the timer, or use `ResizeObserver`/`IntersectionObserver`.
3. **[P3] `wizard_controller` polls for capabilities.** [wizard_controller.js:55-60](../../app/javascript/controllers/wizard_controller.js#L55-L60) retries up to 100 × 100ms, uncleared on disconnect. Replace with a single ready promise or the existing `core-bootstrap:ready` event. The 1500ms tour-start timeout at line 346 is also uncleared.
4. **[P2] Mapper wizard fixed sleep.** [mapper_wizard_controller.js:58](../../app/javascript/controllers/mapper_wizard_controller.js#L58) waits 500ms for CodeMirror to initialize. That is a race on slow machines (the code already re-calls `captureEditors()` later "in case they weren't ready"). Wait on an editor-ready event/promise.
5. **[P2] Export snapshot loading fails silently.** Most `apiFetch` calls in `mapper_wizard_controller.js` and `export_case_core_controller.js` now use `postJson` or check `response.ok`, but [`export_case_core_controller.js:172`](../../app/javascript/controllers/export_case_core_controller.js#L172) still returns silently when loading the snapshot list receives a non-2xx response. Surface a visible error or status message for that failure.
6. **[P3] Orphan global listener** (add the missing `.catch` now; the stacking only bites on re-bootstrap/tests). [live_query_runtime_owner.js:312](../../app/javascript/utils/live_query_runtime_owner.js#L312) adds a `case-book:associated` document listener inside the factory and never removes it; each factory call stacks another. Its `.then(...)` has no `.catch` (unhandled rejection). `live_query_events.connect()` has the same add-without-remove shape (5 listeners, no teardown).
7. **[P3] `user_activity` URL building.** [user_activity_controller.js:131](../../app/javascript/controllers/user_activity_controller.js#L131) builds `${urlValue}&start=...`, assuming the URL already has a `?`. Use `new URL()` + `searchParams`. It also returns `[]` on any error, so a failed fetch looks like "no activity".

## DRY opportunities

- **[P2] Two hand-rolled HTML sanitizers.** `sanitizeHtml` ([search_result_controller.js:235](../../app/javascript/controllers/search_result_controller.js#L235)) and `sanitizeDocumentHtml` ([detailed_document_modal.js:44](../../app/javascript/utils/detailed_document_modal.js#L44)) share the same walk, attribute stripping and link-protocol logic, differing only in allow-list. No `DOMPurify` in `package.json`. Preferred: replace both with DOMPurify and two configs. Minimum: merge into `utils/sanitize.js` with a configurable allow-list. Today `search_results_controller` imports a utility from a *controller* module, which is backwards.
- **[P2] JSON request boilerplate.** The `apiFetch` + `Content-Type` + `JSON.stringify` + `.json()` + ok-check sequence still appears in many callers. Shared `getJson`/`postJson` helpers now exist in `api/json.js` and throw `HttpError`; migrate the remaining callers, including `user_activity_controller.js` and the export snapshot-list path.
- **[P3] CSRF token read twice.** `utils/destructive_form.js` re-implements `getCsrfToken()` instead of importing it from `api/fetch.js`.
- **[P3] Engine-name maps in three places:** `utils/search_engine_name.js`, an inline map at [live_query_runtime_owner.js:1094](../../app/javascript/utils/live_query_runtime_owner.js#L1094), and `wizard_controller.js:378`. Keep one.
- **[P3] Repeated constants/idioms.** `REDIRECT_DELAY_MS` is defined twice with different values (1000 in clone, 500 in judgements). `Number(detail.caseId) !== Number(getCaseNo())` appears ~12 times. The 11 `*_core_controller` files each re-implement submit/busy/error handling on top of the shared modal base.

## Architecture / bad practices

- **[P2] `live_query_runtime_owner.js` (1123 lines) is mostly indirection.** Large and risky: do it incrementally behind the existing tests, not as a big-bang rewrite. `liveQueryServices` is a nested object of one-line wrappers (`function(){ return runtimeDomain.x(...) }`) forwarding to things that already have that signature. It is built before `runtimeFramework`/`runtimeDomain` are assigned, so it relies on closures and `latedef:false`. It is inconsistent (`commitQueries.bind(...)` is bound, its siblings are not — a `this` hazard) and keeps Angular-era leftovers (`promiseApi`/`defer`, `onDirty: function(){}`, `isSortingEnabled` hard-coded `false`). Flatten the wrappers into direct references, then split by concern (settings/mapper, rated-docs, diff read model).
- **[P3] String-named event bus.** 71 `new CustomEvent` sites and dozens of document-level listeners. Most are cleaned up correctly, but names are bare strings with mixed prefixes (`quepid:case-header-stale` vs `pick-scorer:selected`), so nothing checks producer/consumer agreement. Add an `events.js` of exported name constants with payload JSDoc.
- **[P3] Error HTML built in business logic.** `createDocList` ([live_query_runtime_owner.js:27-45](../../app/javascript/utils/live_query_runtime_owner.js#L27-L45)) builds `<strong>…` strings containing `fieldSpec.id`, a user-set value. Safe today only because the render site sanitizes ([search_results_controller.js:97](../../app/javascript/controllers/search_results_controller.js#L97)); the safety lives far from the string. Return structured data (`{code, fieldId}`) or `escapeHtml` at the source.
- **[P3] Large `innerHTML` templates for static markup.** `queries_list_controller.js:401-555`, `search_results_controller.js:315`, `annotations_controller.js:192`. This conflicts with AGENTS.md ("static structure in ERB, JS owns behavior"). Interpolated values are numeric or escaped, so this is maintainability, not security. Prefer ERB-rendered `<template>` elements cloned by JS.
- **[P3] Smaller items.**
  - `window.Stimulus`, `window.ace`, `window.CodeMirror`, `window.quepidWizardContracts` globals exist for legacy callers.
  - `invite_controller.js` uses native `alert()`.
  - `tune_relevance.js:23` builds `new RegExp(typo)` on every keystroke, and `queryParamsWarning` returns raw HTML.
  - Timer tracking is inconsistent; only `tune_relevance` and `flash` clear theirs.

## Suggested order

1. Finish migrating the remaining callers to `getJson`/`postJson` from
   `api/json.js`; `HttpError` and core-capability error handling are now in
   place.
2. Fix the three timer/polling issues (`pane`, `wizard`, `mapper_wizard`) and add the autocomplete `AbortController`.
3. Consolidate the sanitizers (decision needed: DOMPurify dependency vs merged hand-rolled).
4. Flatten `live_query_runtime_owner` and add teardown for its listeners and `live_query_events`.
5. Add the events-constants module.

Items 1–2 are small and low-risk. Each change needs Vitest specs under `test/javascript/` per the PR policy.

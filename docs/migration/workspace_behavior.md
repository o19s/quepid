# Workspace behavior reference (Angular core workspace)

> **Scope:** On **`main`**, the **core query-tuning workspace** (`/case/:id` and `/case/:id/try/:try_number`, route name `case_core`) is still implemented with **AngularJS** (`app/views/layouts/core.html.erb`, `app/views/core/index.html.erb`, `app/assets/javascripts/routes.js`, `MainCtrl`, etc.). Sections 1–4 document that implementation. Other surfaces (e.g. books, home) may use Stimulus, Turbo, and Rails views independently. **Replacement plan:** [angularjs_elimination_plan.md](./angularjs_elimination_plan.md).

This document describes the behavior of that workspace. URLs are commonly written as `/case/:caseNo/try/:tryNo`; Rails uses `:id` and `:try_number` for the same segments.

---

## 1. User flows

### 1.1 Load case

- **Entry:** User navigates to `/case/:id` or `/case/:id/try/:try_number` (e.g. from home, case dropdown, or clone/export flows).
- **Rails:** `config/routes.rb` → `core#index` (`case_core`). **Angular:** `routes.js` maps the client route to `queriesLayout.html` and `MainCtrl`.
- **Flow:**
  1. `MainCtrl` reads `caseNo` and `tryNo` from `$routeParams`; if `tryNo` is missing, it is set from the case’s `lastTry` after the case is loaded.
  2. `queriesSvc.reset()` if the case number changed from the previous view.
  3. `bootstrapCase()`: `caseSvc.get(caseNo)` → `caseSvc.selectTheCase(acase)`, `settingsSvc.setCaseTries(acase.tries)`, `settingsSvc.setCurrentTry(tryNo)`. Validates try exists and (if applicable) mixed-content/proxy for search URL.
  4. `loadQueries()`: `docCacheSvc.update(settings)`, then `queriesSvc.changeSettings(caseNo, newSettings)` and `queriesSvc.searchAll()` so all queries run and scores appear.
  5. `loadSnapshots()`: `querySnapshotSvc.bootstrap(caseNo)` (snapshots for diff).
  6. `updateCaseMetadata()`: `caseSvc.trackLastViewedAt(caseNo)`, `caseSvc.fetchDropdownCases()`.
  7. `paneSvc.refreshElements()` for east pane.
- **Special:** If `caseNo === 0`, a flash message tells the user to create a case. On bootstrap/search errors, flash is set and `paneSvc.refreshElements()` still runs.

### 1.2 Add query

- **Entry:** User types in the “Add query” input (or pastes multiple lines/semicolon-separated) and submits (or “Add queries” for multiple).
- **Components:** `add_query` directive/controller; `queriesSvc.createQuery`, `persistQuery` / `persistQueries`, `searchAndScore` / `searchAll`.
- **Flow:**
  1. Single query: `queriesSvc.createQuery(queryText)` → `persistQuery(q)` (POST `api/cases/:id/queries`) → `q.searchAndScore()` → on success `$rootScope.$emit('scoring-complete')`, `flash.success = 'Query added successfully.'`; then `queriesSvc.updateScores()`.
  2. Multiple: `createQuery` for each → `persistQueries` (POST bulk) → `queriesSvc.searchAll()` → flash success/error; scores updated via searchAll.
- **Errors:** On search/scoring failure, `flash.error` and `flash.to('search-error').error` are set with a message.

### 1.3 Rate document → see score

- **Two rating paths:**

  **A. Inline rating (main workspace)**  
  - Each result row uses the `search-result` directive; `rateElementSvc` provides a rating scale (popover) and calls `doc.rate(newRating)` / `doc.resetRating()`.  
  - `ratingsStoreSvc.rateDocument(docId, rating)` sends PUT `api/cases/:caseId/queries/:queryId/ratings`, updates local ratings dict, then `$scope.$emit('rating-changed', queryId)`.  
  - Listeners: `queriesSvc` and `queriesCtrl` (and others) react to `rating-changed`. `queriesSvc.updateScores()` marks queries dirty and runs `scoreAll()` so query and case scores recompute and the UI updates (no full page reload).

  **B. Book-of-judgements modal**  
  - User opens the Judgements modal (e.g. from header) to rate documents in the context of a Book. The modal can load the Rails-rendered judgement form (`app/views/judgements/_form.html.erb`) for a single query-doc pair, which includes keyboard shortcuts (see below). Submitting the form persists the rating; on refresh/close, the workspace shows updated scores via the same `rating-changed` / `updateScores` flow when back on the try view.

- **Score display:** Query scores appear in `qscore-query`; case score in `qscore-case`. Scores update automatically when ratings change (via the `rating-changed` event and debounced case-score refresh in `queriesCtrl`).

### 1.4 Export

- **Entry:** User clicks Export (e.g. `export-case` in the case header).
- **Components:** `ExportCaseCtrl`, `export_case` directive; modal template `export_case/_modal.html`.
- **Flow:**
  1. Modal opens; case comes from `caseSvc.getSelectedCase()` or `$scope.theCase` when on cases list.
  2. User picks export type (e.g. general CSV, detailed CSV, snapshot). “General” refetches case with `caseSvc.get(ctrl.theCase.caseNo, false)` then uses `caseCSVSvc.stringify(...)` and triggers download (e.g. `saveAs` blob). “Detailed” uses in-memory case and `queriesSvc.queries`. Snapshot option uses snapshot id and similar CSV/build.
  3. Modal also exposes **API links** (no JS `$http`) for direct GET of case JSON, queries JSON, annotations, scores, ratings, snapshots, full export (see [workspace_api_usage.md](./workspace_api_usage.md)). User can open/download these URLs in the browser.

### 1.5 Clone

- **Entry:** User clicks Clone (e.g. `clone-case` in the case header).
- **Components:** `CloneCaseCtrl`, `clone_case` directive; modal `clone_case/_modal.html` and `CloneCaseModalInstanceCtrl`.
- **Flow:**
  1. Modal opens with options (e.g. clone_queries, clone_ratings, preserve_history, try_number, case_name).
  2. User confirms; `caseSvc.cloneCase(ctrl.acase, options)` calls POST `api/clone/cases` with the chosen options.
  3. On success: `flash.success = 'Case cloned successfully!'` and `caseTryNavSvc.navigateTo({ caseNo: acase.caseNo, tryNo: acase.lastTry })` (navigate to the new case/try).
  4. On failure: `flash.error = 'Unable to clone your case, please try again.'`

---

## 2. Keyboard shortcuts and accessibility

### 2.1 Rating (Judgements form – Book flow)

When the judgement form is shown (Rails-rendered `app/views/judgements/_form.html.erb`, e.g. in the Book-based rating flow):

- **Shortcuts:** Keys **a, s, d, f, g, h, j, k, l** and **;** (semicolon) map to the scorer’s rating buttons (labels and keys come from `JudgementHelper` / `generate_rating_buttons`). Keypress/keydown set the selected rating and submit the form (with a short delay on keypress to allow visual feedback).
- **Behavior:** `keydown` updates visual state (bold/highlight for the key’s button); `keypress` triggers the button click (rate + submit). Shortcuts are disabled when the explanation modal is open or when focus is in an input/textarea.
- **UI:** A row under the buttons shows the keyboard key for each rating (e.g. “A”, “S”, “D”…) when `@show_keyboard_shortcuts` is true.

### 2.2 Workspace (Angular) keyboard behavior

- **Modals:** UI Bootstrap modals use `keyboard: true` by default (Escape to close). Dropdowns and popovers use keydown for navigation where applicable.
- **No other workspace-specific global shortcuts** are defined in the Angular app for the try page itself; rating in the main results list is via the inline scale/popover (no dedicated keyboard shortcuts there).

### 2.3 Accessibility

- **Flash/search error:** The search-error flash area is a dedicated region; general flash uses `flash-alert` directive. No explicit `role="alert"` or `aria-live` was added in the app’s own templates; the Angular/UI Bootstrap build includes various `aria-*` and `role` attributes in modals, dropdowns, and datepicker (e.g. `aria-expanded`, `aria-labelledby`, `tabindex`).
- **Navigation:** Links and buttons are focusable; modals trap focus and support Escape. No documented screen-reader-specific announcements for score updates; score changes are visible in the DOM.

---

## 3. Real-time updates (WebSockets, polling)

- **Core workspace:** The Angular try page does **not** subscribe to WebSockets, ActionCable, or `turbo_stream_from`; its updates are request/response:
  - Load case and queries on route entry.
  - Rating: PUT rating → `rating-changed` event → client-side `updateScores()` (scorer runs in the browser).
  - Add query, clone, export, settings: standard HTTP API calls and then client/navigation updates.

- **Turbo Streams / notifications:** Pages that include `turbo_stream_from(:notifications)` (e.g. `app/views/home/show.html.erb`, `app/views/books/show.html.erb`) can receive broadcasts. `RunCaseEvaluationJob` uses `Turbo::StreamsChannel.broadcast_render_to(:notifications, …)` with targets `notifications` and `notifications-case-#{case_id}` (see `app/jobs/run_case_evaluation_job.rb`). The **Angular core layout** (`layouts/core.html.erb`) does **not** include `turbo_stream_from`, so the try page does not consume those streams.

- **ActionCable in the app:** Still mounted (`config/routes.rb`); `config/cable.yml` uses Solid Cable (e.g. polling adapter in dev). Admin “Websocket Tester” and jobs like `RunJudgeJudyJob` participate in real-time flows elsewhere. The **workspace try view** still has no subscription that pushes case/query/rating updates from other sessions or jobs into the Angular UI.

- **Polling:** No polling on the try page for case/query/rating updates. User actions (rate, add query, etc.) trigger immediate API calls and client-side score recalculation.

---

## 4. Error handling and flash messages

### 4.1 Flash infrastructure

- **Provider:** `flashProvider` (angular-flash); error class includes `alert-danger`.
- **Display:** Two areas in `views/common/flash.html`:
  - General flash: one `flash-alert` (shows `flash.message`), dismissible.
  - Search/query errors: `ng-include` of `search_flash.html` → `#search-error` with `flash-alert`, `duration="-1"`, so it stays until dismissed or overwritten.
- **Targeting:** Code can set `flash.to('search-error').error = message` so the message appears in the search-error region; otherwise `flash.error` / `flash.success` drive the general flash.

### 4.2 When flash is set (workspace-relevant)

| Context | Type | Message (examples) |
|--------|------|---------------------|
| No cases (caseNo === 0) | error | You don't have any Cases created… |
| Bootstrap: try missing | error (search-error) | The try that was specified for the case does not actually exist! |
| Bootstrap: mixed-content / blocked request | error (search-error) | Blocked Request: mixed-content. … |
| Bootstrap: case load failure | error (search-error) | Could not retrieve case … / Could not load the case … due to: … |
| loadQueries success | success | All queries finished successfully! |
| loadQueries failure | error + search-error | Some queries failed to resolve! + detail |
| Add query (one) success | success | Query added successfully. |
| Add query (one) error | error + search-error | Your new query had an error! + detail |
| Add queries (bulk) success | success | Queries added successfully. |
| Add queries (bulk) error | error + search-error | One (or many) of your new queries had an error! + detail |
| Clone success | success | Case cloned successfully! |
| Clone failure | error | Unable to clone your case, please try again. |
| Export modal | — | No flash; download or API links in modal. |
| Judgements modal (Book refresh) | success | Ratings refreshed successfully! / Ratings are being refreshed… |
| Move query, delete case, share case, annotations, query notes, try delete/duplicate, etc. | success/error | Various (see grep of `flash.` in `app/assets/javascripts`). |

### 4.3 API error handling

- Failed API calls (e.g. persist query, clone, rate) typically set `flash.error` or `flash.to('search-error').error` and sometimes a generic message; rejection data from the server is not always surfaced verbatim. Bootstrap and add-query flows pass through or format error messages for the search-error area.

---

## 5. Relationship to the rest of the app and migration docs

- **Core workspace (this doc §1–4):** Still Angular; try-page search, scoring refresh, and flash follow the patterns above (e.g. `angular-flash`, `queriesSvc`). Port target: [angularjs_elimination_plan.md](./angularjs_elimination_plan.md). There is no `QuerySearchService` in `app/services` on `main`.

- **Rails judgement form (§2.1):** Shared non-Angular UI; keyboard shortcuts remain in `app/views/judgements/_form.html.erb`.

- **Stimulus:** Controllers under `app/javascript/controllers/` cover other flows (e.g. share case, mapper wizard, books-related UI); they do **not** replace the core case/try workspace layout.

- **`RunCaseEvaluationJob`:** Background case evaluation and progress UI target the notification streams described in §3, not Turbo Frame IDs such as `qscore-case-*` or `query_list_*` (those frame/stream names appear in **migration design** docs as a target architecture, not in the Angular workspace templates in `app/views/core/`).
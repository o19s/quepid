# Workspace Behavior Reference (Legacy Angular)

> **Historical reference:** This document describes the behavior of the **AngularJS** workspace as it existed on `main`. The modern stack has replaced all Angular code with ViewComponents + Stimulus + Turbo. The user flows, keyboard shortcuts, and error handling patterns described below were used as migration requirements and are preserved or improved in the modern stack.

> **Current status:** All flows described below have been migrated to the modern stack. See [workspace_state_design.md](workspace_state_design.md) for the current architecture and [workspace_api_usage.md](workspace_api_usage.md) for API usage patterns.

This document describes the behavior of the core query-tuning workspace at `/case/:caseNo/try/:tryNo` (and `/case/:caseNo`) as implemented in AngularJS.

---

## 1. User flows

### 1.1 Load case

- **Entry:** User navigates to `/case/:caseNo` or `/case/:caseNo/try/:tryNo` (e.g. from home, case dropdown, or clone/export flows).
- **Route:** `routes.js` maps to `queriesLayout.html` and `MainCtrl`.
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
  3. Modal also exposes **API links** (no JS `$http`) for direct GET of case JSON, queries JSON, annotations, scores, ratings, snapshots, full export (see `workspace_api_usage.md`). User can open/download these URLs in the browser.

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

- **Core workspace:** The try page does **not** use WebSockets or ActionCable. All updates are request/response:
  - Load case and queries on route entry.
  - Rating: PUT rating → `rating-changed` event → client-side `updateScores()` (scorer runs in the browser).
  - Add query, clone, export, settings: standard HTTP API calls and then client/navigation updates.

- **ActionCable in the app:** Used elsewhere (e.g. Books, background jobs). `config/cable.yml` uses Solid Cable (e.g. polling adapter in dev). Admin “Websocket Tester” and jobs like `RunJudgeJudyJob` / `RunCaseEvaluationJob` can broadcast progress; the **workspace try view itself does not subscribe** to any channel. So there is no real-time push for “another user changed a rating” or “background job updated this case” on the current try page.

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

## 5. Migration status

All flows described above have been migrated to the modern stack:

- **User flows:** Load → add query → rate → score update → export → clone are all functional via ViewComponents + Stimulus. See [deangularjs_experimental_functionality_gaps_complete.md](deangularjs_experimental_functionality_gaps_complete.md) for parity and gap history.
- **Keyboard:** Rating shortcuts (a/s/d/f/g/h/j/k/l/;) preserved in the Rails-rendered judgement form (`app/views/judgements/_form.html.erb`).
- **Real-time:** The modern workspace subscribes to `turbo_stream_from(:notifications)` for score update broadcasts from `RunCaseEvaluationJob` (new capability not present in Angular). Score updates broadcast via Turbo Streams to update `qscore-case-#{case_id}` and `query_list_#{case_id}` frames.
- **Errors:** Flash messages use `window.flash` (from `utils/flash.js`) for client-side feedback and Rails flash for server-side. See [ui_consistency_patterns.md](ui_consistency_patterns.md).
- **Search:** Now goes through server-side `QuerySearchService` proxy, eliminating CORS/mixed-content issues.
- **Turbo Frames:** The workspace uses Turbo Frames (`workspace_content`, `query_list_<case_id>`, `results_pane`) for independent region updates. Query selection uses Turbo Frame navigation instead of full-page reload. See [turbo_frame_boundaries.md](turbo_frame_boundaries.md) for frame mapping.
- **Turbo Streams:** Add/remove queries, rating updates, and score changes use Turbo Streams for live DOM updates without full-page reload. See [turbo_streams_guide.md](turbo_streams_guide.md) for implementation patterns.

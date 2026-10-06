# Part 4: Core Workbench — Queries & Scoring

## Overview

The Core Workbench is the case-tuning screen you land on at `/case/:id` (or `/case/:id/try/:try_number`). The query/results workspace is driven by Stimulus controllers and shared live-query modules, while the Tune Relevance drawer owns its page behavior through Stimulus and the settings runtime. This is where the actual relevance-tuning workflow happens: add queries, run them against your search endpoint, rate documents, watch the score change, and tweak query/engine settings live.

This part covers the query list and its per-query tools, rating, scoring, and the "Tune Relevance" settings drawer. Parts 5 and 6 cover the rest of this same page (history/snapshots/diff/annotations, and export/import/explain/case-level actions respectively).

## Page layout orientation

Before testing individual features, get oriented:

- [ ] Header area: case score badge + sparkline, case name (double-click to rename inline), try name (also double-click renamable), badges for `nightly` / `PUBLIC` / `ARCHIVED` as applicable, current scorer name.
- [ ] Case action toolbar (row of icons under the header): Select scorer, Judgements, Create snapshot, Compare snapshots, Import, Share case, Clone, Delete, Export, Tune Relevance (wrench).
- [ ] Queries panel: the main list, with add/sort/filter controls and the Frog Report icon.
- [ ] East slide-out drawer (opened by the wrench icon): "Tune Relevance" — 5 tabs (Query, Tuning Knobs, Settings, History, Annotations).

## Test scenarios

### 4.1 Rename case / rename try

- [ ] **Steps:**
  1. Double-click the case name in the header. Edit the text. Click **Rename** (or **Cancel**).
  2. Repeat for the try name next to it.
- **Expected:** Name updates in place and persists on reload.
- **Edge cases:**
  - [ ] Submit a blank name — confirm behavior is sane (should not save an empty name silently).

### 4.2 Add a query (single)

- [ ] **Steps:**
  1. Type a query string into the add-query input at the top of the query list.
  2. Click **Add query**.
- **Expected:** The query is added, searched, and scored; it appears in the list with a spinner shown while the search is in flight.
- **Edge cases:**
  - [ ] Submit empty/whitespace-only input — button should be disabled or a no-op.
  - [ ] On a case using a `static` search endpoint, confirm Add is disabled with a message that adding isn't supported.
  - [ ] Cause a search/scoring failure for the new query (e.g., bad endpoint) — confirm a flash error appears but doesn't block the rest of the app.

### 4.3 Add multiple queries (bulk)

- [ ] **Steps:**
  1. Paste multi-line text into the add-query input (one query per line), or type several queries separated by `;`.
  2. Confirm the button label switches to **Add queries**.
  3. Click it.
- **Expected:** All queries are added; a bulk success/failure flash is shown (distinct from the single-add flash), and a single failed query doesn't prevent the others from being added.

### 4.4 Move a query to another case

- [ ] **Steps:**
  1. Expand a query row, click **Move Query**.
  2. In the "Move Query to Another Case" modal, click a target case from the list.
  3. Confirm the footer button updates to "Move to {case name}", click it.
- **Expected:** The query (with its ratings/history) is transferred to the target case and removed from the current one.
- **Edge cases:**
  - [ ] With no other cases available, confirm the modal shows "Please create another case to move this query to first." with no way to proceed.
  - [ ] Rename or create a case in another tab while this modal is open, then reopen it — confirm the case list reflects the change.
  - [ ] Force a failure — confirm flash "Unable to move query."
  - [ ] After picking a case, and again after a failed move, press Escape — confirm the modal closes.

### 4.5 Set per-query options (Query Options)

- [ ] **Steps:**
  1. Expand a query, click **Set Options**.
  2. Edit the JSON in the code editor (e.g., add a key used by a scorer via `qOption('key')`).
  3. Click **Set Options** to save (or Cancel).
- **Expected:** Valid JSON saves and triggers a rescore of all queries.
- **Edge cases:**
  - [ ] Enter invalid JSON, click Set Options — confirm the flash "Please provide a valid JSON object." appears and the modal does **not** close or save.
  - [ ] Force a save failure (e.g., simulate a network error) — confirm the flash "Unable to save query options." appears rather than a success message.
  - [ ] Delay query A's save, dismiss the modal, and open query B. A successful completion updates only A's live options; B's modal stays open with its own JSON. A failed completion must not flash an error for B or alter B's Save button.

### 4.6 Rate a document

- [ ] **Steps:**
  1. Expand a query to view its search results.
  2. Click a document's rating badge to open the rating popover.
  3. Click a rating-scale value.
  4. Reload the page and confirm it persisted.
  5. Reopen the popover and click **RESET**.
- **Expected:** Rating saves immediately, updates the badge color/value, and rolls into the query and case score. RESET clears the rating back to unrated.
- **Edge cases:**
  - [ ] Rate a document that can't be uniquely identified (missing/duplicate doc id) — confirm the "This document can't be uniquely identified..." banner appears instead of a rating control.
  - [ ] Rate documents until you reach the scorer's "depth of rating" cutoff — confirm the "Results above are counted in scoring" note appears at the right rank.

### 4.7 Case & query score badges

- [ ] **Steps:**
  1. On a brand-new case, confirm the case score badge shows `?` or `--` before any query has been scored.
  2. Run searches / rate documents, confirm the case score badge and each query's score badge update with a sensible color (low score vs. high score should look visually distinct).
- **Expected:** Badge color scale looks sane at both ends of the range; badges update live as ratings change.

### 4.8 Select a scorer for the case

Core toolbar opens the Stimulus **pick-scorer-core** modal (`#pickScorerModal`); its rows are cloned from a Rails-rendered template and loaded/saved through JSON APIs. After save the live-query runtime rescores the active queries.

- [ ] **Steps:**
  1. Click **Select scorer** in the case toolbar.
  2. In "How would you like to score this case?", browse the default/communal scorers and your own custom scorers.
  3. Pick a different scorer, click **Select Scorer**.
  4. Try the **Create New Scorer** shortcut (hidden when the deployment is communal-scorers-only).
- **Expected:** Case score recalculates using the new scorer; the scorer name in the header updates.
- **Edge cases:**
  - [ ] When the case's current scorer is not in your accessible lists, confirm the warning that "you won't have access to it again" if you switch away from it.
  - [ ] Force a scorer-save failure: the modal stays open, shows the server error and retains the selected row; retry succeeds and closes the modal.
  - [ ] Reload and reopen the modal: the saved scorer remains selected.

### 4.9 Missing Documents finder

- [ ] **Steps:**
  1. Expand a query, click **Missing Documents**.
  2. Enter a Lucene-syntax search against the underlying index to find a document that should match but doesn't currently appear in the query's results.
  3. Rate the found document inline.
  4. Click **Reset to All Rated Docs**.
- **Expected:** Search returns matching documents with a count message (or a "no results" message); ratings set here affect the query's score, matching the persistent on-screen warning "Changing ratings will affect the query score."
- **Edge cases:**
  - [ ] Reject a search, reset, or next-page request — expect a contextual "Unable to … Please try again." message, a hidden spinner, and usable controls. Retry successfully and confirm the error clears. A failed reset keeps the edited query parameters.
  - [ ] Dismiss while a request is pending — completion must not render into the detached modal. Reopening creates a usable finder.

### 4.10 Tune Relevance drawer — Query tab (Query Sandbox)

- [ ] **Steps:**
  1. Click the wrench icon ("Tune Relevance") to open the east drawer.
  2. On the **Query** tab, edit the raw query template in the CodeMirror editor (Solr parameters or JSON for ES/OS/Vectara/Algolia/SearchAPI). Switch to Tuning Knobs and back; confirm the edits remain.
  3. Click **Rerun My Searches!**.
- **Expected:** All queries re-run against the edited template and rescore. Dragging the drawer beyond either edge keeps a usable main column and drawer; resizing reclamps its width, including below the workbench minimum width.
- **Edge cases:**
  - [ ] On a `static` engine case, confirm the tab shows "With a Static search endpoint there are no query settings to play with" instead of an editor.
  - [ ] If a TLS/protocol mismatch is detected (HTTP vs HTTPS), confirm the button instead reads "Reload Quepid in {protocol}" and behaves accordingly.

### 4.11 Tune Relevance drawer — Tuning Knobs tab

- [ ] **Steps:**
  1. Add a `##variableName##` placeholder to your query template (Query tab), then switch to **Tuning Knobs**.
  2. Confirm a slider/numeric input auto-appears for the variable.
  3. Change its value, click **Rerun My Searches!**.
- **Expected:** The query re-runs with the new value substituted in, and the score updates accordingly.
- **Edge cases:**
  - [ ] With no `##variable##` placeholders defined, confirm the empty state explains the templating convention (e.g., `##titleBoost##`) rather than showing a blank panel.

### 4.12 Tune Relevance drawer — Settings tab

- [ ] **Steps:**
  1. Switch to **Settings**. Search Endpoints, Evaluate Nightly? and Escape Queries start collapsed (+); click a header to expand it (−).
  2. **Search Endpoints**: pick a different shared endpoint from the dropdown, or use the typeahead search. The list only contains endpoints shared with one of **this case's** teams (`api/cases/:id/search_endpoints`), so on a case that isn't shared with a team it shows "No search endpoints found. Create or share an endpoint to use it here." — share the case and an endpoint with the same team first.
  3. **Endpoint Details**: confirm read-only name/URL/icon show, and the "More" link works; if the endpoint is archived, confirm the warning banner appears.
  4. **Displayed Fields**: change the comma-separated list of fields shown per result, confirm the result rows update.
  5. **Number of Results to Show**: change the numeric value (max 100), confirm the result count changes accordingly.
  6. **Evaluate Nightly?**: toggle on, then click **Rerun My Searches Now in the Background!**.
  7. **Escape Queries**: toggle the Lucene-syntax escaping option and confirm query behavior changes as expected.
- **Expected:** Each control's change takes effect either immediately or after the next search run, as appropriate. The section list scrolls inside the drawer; **Rerun My Searches!** stays pinned at the drawer's bottom (check at a 900px-tall window).
- **Edge cases:**
  - [ ] Set Number of Results above the max (100) — confirm it's clamped/rejected.
  - [ ] Force the new-try POST to fail: an error appears, the form/editor values remain, and the save button becomes enabled for retry. While pending, repeat clicks must not create multiple tries.
  - [ ] Retry successfully: the URL selects the new try, the drawer remains open on Settings, and reload retains the saved values.
  - [ ] Toggle Evaluate Nightly on, then check that a background job is actually queued (verify via Admin > Job Manager, Part 14, if accessible).

> Toggling **Evaluate Nightly** must also update the nightly (repeat) icon in the case header immediately, without a page reload — the header is server-rendered, so it only reflects the change if the toggle tells it to refresh. Regression-covered by `test/playwright/case_header_rename.spec.ts`.

### 4.13 Tune Relevance drawer — History tab

Covered in depth in Part 5 (Tries / History). Quick smoke test here:

- [ ] **Steps:**
  1. Switch to **History**, confirm links "Visualize your tries", "Check Scores", "Check Ratings" are present and navigate correctly.
  2. Confirm the try list below renders, with tries color-coded by search URL. Each row shows the try name, the query params in plain text truncated inline with "...", and "using {endpoint}".
- **Expected:** "Check Scores" goes to `/cases/:id/scores` — a table of all scores with Scorer/Try Number/Score/Day columns, filterable by scorer, with a bulk **Delete** action (checkboxes + a confirm dialog) and a link to "Understand Score Duplication" (Part 13). "Check Ratings" goes to `/cases/:id/ratings` — a page headed "Ratings for Case …" with a searchable (`query, doc id, or rating`) table of every rating with Rating ID/Query/Doc ID/Rating/User/Created/Updated columns.
- **Edge cases:**
  - [ ] On the Scores page, select several scores via checkboxes, confirm **Delete** is disabled until at least one is checked, then confirm deletion requires a confirm dialog and actually removes just those score rows (not the whole case).
  - [ ] On the Scores page, use "Check All" then uncheck one — confirm "Check All" itself becomes unchecked (partial-selection state).
  - [ ] On the Ratings page, search by a doc id and separately by a rating value, confirm the filter matches on all three documented fields (query, doc id, rating).

### 4.14 Tune Relevance drawer — Annotations tab

Covered in depth in Part 5.

### 4.15 Per-query quick actions (Copy, Delete Query)

Every expanded query row has a small toolbar beyond the tools already covered above (Move Query, Set Options, Explain Query, Missing Documents).

- [ ] **Steps:**
  1. Expand a query, click the **Copy query** (clipboard) icon.
  2. Paste the clipboard contents somewhere and confirm it's exactly the query text.
  3. Click **Delete Query**.
  4. Confirm the browser's native `confirm()` dialog reads "Are you absolutely sure you want to delete?" — accept it.
  5. Confirm the query is removed from the list and the case rescopes/rescoes without it.
  6. Repeat but click **Cancel** on the confirm dialog instead.
- **Expected:** Copy always copies the raw query text. Delete Query removes only that single query (and, per the case model, its ratings/history) — this is a *different, narrower* action than the case-wide "Delete All Queries" option covered in Part 6.4. Cancelling the confirm dialog leaves the query untouched.
- **Edge cases:**
  - [ ] Delete a query that has ratings/annotations tied to it and confirm the case score recalculates correctly afterward.
  - [ ] Confirm there is no secondary safety net beyond the one native confirm dialog — this is a single-click-plus-confirm irreversible action, worth flagging if a more deliberate confirmation (e.g., typing the query name) is ever expected here.

### 4.16 Query Notes & Information Need

- [ ] **Steps:**
  1. Expand a query, click **Toggle Notes**.
  2. Confirm a panel opens with two fields: **Information Need** (single-line) and **Notes on this Query** (multi-line textarea).
  3. Fill in both, click **Save**.
  4. Click **Toggle Notes** again to collapse the panel, then re-expand it (or reload the page) and confirm both values were persisted and reload correctly.
- **Expected:** Flash "Success! Your query details have been saved." on save; the panel auto-collapses after a successful save.
- **Edge cases:**
  - [ ] Force a save failure (e.g., simulate a network error) — confirm the flash "Ooooops! Could not save your query details. Please try again." appears and the panel stays open with your unsaved edits intact. (Regression-covered by `test/playwright/query_notes.spec.ts`.)
  - [ ] Start typing **immediately** after clicking Toggle Notes, before the panel has finished loading — confirm your text is not overwritten when the load completes. (The panel renders editable before its own fetch returns; regression-covered by the same spec.)
  - [ ] Leave both fields blank and save — should succeed without error (notes are optional).
  - [ ] Confirm the **Information Need** value entered here is the same one referenced/exported by the "Information Need" export/import format in Part 6.1/6.2 — edit it here, then run an Information Need export, and confirm it round-trips correctly.

### 4.17 Workbench boot & case/try navigation

- [ ] **Steps:**
  1. Navigate directly to `/case/:id/try/:try_number` for an existing case. Confirm the workbench boots (header, toolbar, query list) with no console errors.
     In the Network panel, confirm bootstrap does not GET `/api/users/current` or `/api/cases/:id`: the initial user/case data comes from the authorized Rails page. Queries, scorers and other independently owned data still load through APIs.
  2. From the header's **Relevancy Cases** dropdown, click a different case. Confirm the browser does a full page navigation (URL changes, page reloads) to that case's workbench, which then boots correctly.
  3. Navigate to bare `/case` (no id). Confirm it loads your most recent non-archived case's workbench rather than a "Not Found" page.
  4. Navigate to a path Rails doesn't route at all (e.g. `/case/x/y/z/garbage`). Confirm you get Rails' own 404 rather than a client-side application shell.
  5. Hard-reload an existing case, expand a query and immediately open **Set Options**. Confirm it shows that query's current options; cancel, then filter/sort the list and collapse the query. Confirm the controls work without another bootstrap or duplicate actions.
- **Expected:** Navigation loads the workbench (or a real 404) via a normal server-rendered page load — case/try switching is no longer an in-page SPA transition.
- **Edge cases:**
  - [ ] Navigate to an existing case with a nonexistent try number. Confirm a visible try-not-existing error and a hidden toolbar; returning to a valid try must boot normally. Missing or inaccessible case IDs must return Rails 404 without embedded workspace data.
  - [ ] Force customer-engine searches to fail. Confirm the booted toolbar remains usable and the search error is visible; remove the failure and reload to confirm successful recovery.
  - [ ] On a disposable case with two tries, delete the latest try through `DELETE /api/cases/:id/tries/:n`, then reload `/case/:id`. Confirm the remaining try boots and rerunning searches saves a score. Deleting the only remaining try must return 400 and leave the case usable.
  - [ ] Switch try via "revert to last try" or a Settings-tab save that changes the selected try — confirm this also does a full navigation to the new try's URL.
  - [ ] A logged-in user with zero cases hitting bare `/case` sees the "You don't have any Cases created in Quepid" flash instead of a blank or broken page.

### 4.18 Browse query results

- [ ] **Steps:**
  1. Expand a query whose search endpoint supports browsing (Solr, or a Search API using GET).
  2. Click **Browse N Results on {engine}** in the results footer.
  3. Confirm the modal shows a copyable curl command and the correct engine name.
  4. Click **Copy curl command** and confirm the button changes to **Copied!**. Close/reopen during a pending clipboard write and confirm its completion cannot alter the new modal.
  5. When the endpoint has no configured headers or credentials, click **Open URL directly** and confirm it opens the browse URL in a new tab.
- **Expected:** The modal preserves the query's URL encoding, includes configured headers/credentials in the curl command, warns that those values are secret, and hides the direct-URL action when headers or credentials are present.

### 4.19 Query-list controls

- [ ] **Steps:**
  1. Open a case with at least one query.
  2. Enter text that matches no query in **Filter Queries**, then clear it.
  3. Click **Name** under Sort and confirm the list reorders and the URL records the selected sort.
  4. Expand a query, then click **Collapse all**.
- **Expected:** Filtering, sorting, and collapse are handled without a page reload; the list returns to its full state after clearing the filter and no query remains expanded after **Collapse all**.
- **Edge cases:**
  - [ ] Reorder queries when manual sorting is enabled and confirm the order persists after reload.
  - [ ] Expand a query while results are still loading, then click **Collapse all**.
    Confirm it stays collapsed when results arrive. Expand again, collapse, and
    filter/sort away and back; confirm neither the row nor its results reopen.

### 4.20 Query-list sorting, pagination & "Show only rated"

- [ ] **Steps:**
  1. With a case of more than 15 queries, confirm the list is paginated 15 per page with working page controls.
  2. Click each sort link in turn — **Manual, Name, Modified, Score, Errors** — and click the active one again to flip direction. Confirm ordering: Name alphabetical; Modified/Score/Errors newest/highest/errored first; the URL records `sort=`.
  3. Rate a document in a low-scoring query, click Modified — confirm that query moves to the top. Trigger an error (e.g. break the endpoint URL) and confirm Errors groups failing queries together.
  4. On page 2 with **Manual** sort, drag a query to a new position; reload.
  5. Click **Show only rated**. Expand a query and confirm only rated documents are listed and the result count switches to the rated count; click again to restore.
- **Expected:** Sorting, paging and the rated filter never trigger a page reload. Manual reorder persists across reload, including when dragging on a page other than page 1 (the position update accounts for the page offset).
- **Edge cases:**
  - [ ] Drag handles are inactive for every sort except Manual.
  - [ ] Filter text plus a non-default sort plus page 2 — confirm the page clamps back to a valid page when the filtered set shrinks below it.
  - [ ] "Show only rated" on Solr and ES/OS cases — each should filter via the engine (results contain exactly the rated doc IDs); confirm no error on an engine that can't look up by id.
  - [ ] While a rescore runs, confirm the "Updating Queries" progress banner appears and clears when done.
  - [ ] With more than ten queries, force every search to fail (e.g. a broken endpoint URL); confirm every query gets an error and the progress banner clears instead of stalling at 10 / N. Repeat with mixed successes and failures, then restore the endpoint and retry successfully.

### 4.21 Query row states & score badge values

- [ ] **Steps:**
  1. Find or create queries in each state: loading, loaded with results, zero results, error, and never-rated.
  2. Read each row's header: score badge, result count text, unrated-frog badge.
  3. Hover the query text of a query with an Information Need.
  4. If you have a Querqy-enabled Solr, search a query that triggers a rewrite.
- **Expected:** The score badge shows `?` while pending and a red→green scaled 2-decimal number once scored. `--` (nothing rated) and `zsr` (zero search results) only appear when the scorer returns no score; scorers that compute a number, such as AP@10's 0/0, show `0.00` instead (per source comparison with pre-migration `main`, not a live replay). Error rows are visibly styled distinct from empty-result rows. The unrated frog shows the count of unrated results and links to the Frog Report (6.9). Hovering query text shows "Info Need: ..." after ~1s. The Querqy icon ("Querqy Strikes Again!") appears only on rows where a rewrite fired.
- **Edge cases:**
  - [ ] With snapshots being compared (5.3), confirm one extra diff score badge per enabled snapshot (max 5) on each row.

### 4.22 Bulk rating ("Score All") & result paging

- [ ] **Steps:**
  1. Expand a query, click **Score All**, and choose a rating value in the popover.
  2. Confirm every visible result gets that rating and the query/case scores update.
  3. Turn on **Show only rated** and repeat — only the visible (rated) docs are affected.
  4. Use the popover's reset option to clear all visible ratings.
  5. Click **Peek at the next page** at the bottom of the results; confirm additional results append below (not replace) and can be rated.
- **Expected:** One request rates all visible docs (no per-doc flicker); scores recompute; reload confirms persistence. Reset clears all visible ratings in one action.
- **Edge cases:**
  - [ ] Score All in the Missing Documents finder (4.9) rates only the finder's results.
  - [ ] Peek at the next page with "Show only rated" on — pagination steps through rated docs, not all docs.
  - [ ] Peek past the last page — the control disappears/does nothing rather than erroring.

### 4.23 Search result rendering

- [ ] **Steps:**
  1. Expand a query on a case whose Displayed Fields include a title, plain-text fields, a URL field, an object/array field, and (if available) `thumb:`/`image:` fields with a prefix, an audio/video field, and a `translations:` field.
  2. Confirm the layout: rating badge left, content center, explain chart right (only when full explain is available).
  3. Click a result title to open the Detailed Document modal (6.11).
  4. Click the **Matches** link on a result (Solr/ES with explain).
- **Expected:** Highlight snippets keep `<strong>` emphasis; HTML from documents is sanitized (no script execution); URL values are clickable links opening in a new tab; object/array values render as an expandable JSON tree; images honor the field-spec prefix; `.mp3/.wav/.ogg` render `<audio controls>`, `.mp4/.webm` render `<video controls>`; translations show a Google Translate link. The Matches popover titled "Relevancy Score: N" shows up to 3 score-contribution bars with "Show N More"/"Show Less", plus **Debug** and **Expand** buttons; Debug opens the raw explain JSON modal (6.8). Clicking a hot-match bar on the result row also opens that modal (intentional; see 6.8).
- **Edge cases:**
  - [ ] A doc whose fields contain injected markup (`<img onerror=...>`) — confirm nothing executes.
  - [ ] "No Match" shows for a doc with no matching terms; "no per-term score breakdown" when explain has no children.
  - [ ] A doc with a very long field value or huge JSON — layout doesn't overflow the results column at 1280px and 768px widths.

### 4.24 Workbench layout: Tune Relevance pane open/close & resize

- [ ] **Steps:**
  1. Confirm the Tune Relevance pane is closed on fresh page load.
  2. Click the wrench/**Tune Relevance** control to open it (default width ~450px) and again to close it.
  3. Drag the slider between the query list and the pane to resize it; resize the browser window.
  4. Reload.
- **Expected:** Pane opens/closes without layout jumps; dragging resizes smoothly with no text selection or stuck-drag after releasing the mouse (including releasing outside the window); the query list reflows. After reload, the pane is closed again and the width resets (session-only state).
- **Edge cases:**
  - [ ] Open the pane at a narrow window width — the query list must remain usable (see Part 16.2).
  - [ ] Open/close the pane rapidly several times; confirm no duplicate event handling (one toggle per click).

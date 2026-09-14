# Part 4: Core Workbench — Queries & Scoring

## Overview

The Core Workbench is the AngularJS-powered case-tuning screen you land on at `/case/:id` (or `/case/:id/try/:try_number`). This is where the actual relevance-tuning workflow happens: add queries, run them against your search endpoint, rate documents, watch the score change, and tweak query/engine settings live.

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

### 4.5 Set per-query options (Query Options)

- [ ] **Steps:**
  1. Expand a query, click **Set Options**.
  2. Edit the JSON in the code editor (e.g., add a key used by a scorer via `qOption('key')`).
  3. Click **Set Options** to save (or Cancel).
- **Expected:** Valid JSON saves and triggers a rescore of all queries.
- **Edge cases:**
  - [ ] Enter invalid JSON, click Set Options — confirm the flash "Please provide a valid JSON object." appears and the modal does **not** close or save.

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
  1. On a brand-new case with no searches run, confirm the score badge shows `?`.
  2. Run searches / rate documents, confirm the case score badge and each query's score badge update with a sensible color (low score vs. high score should look visually distinct).
- **Expected:** Badge color scale looks sane at both ends of the range; badges update live as ratings change.

### 4.8 Select a scorer for the case

- [ ] **Steps:**
  1. Click the **Select scorer** icon in the case toolbar.
  2. In "How would you like to score this case?", browse the default/communal scorers and your own custom scorers.
  3. Pick a different scorer, click **Select Scorer**.
  4. Try the **Create New Scorer** shortcut.
- **Expected:** Case score recalculates using the new scorer; the scorer name in the header updates.
- **Edge cases:**
  - [ ] Pick a scorer that isn't shared with you (if applicable) — confirm the warning that "you won't have access to it again" if you switch away from it.

### 4.9 Missing Documents finder

- [ ] **Steps:**
  1. Expand a query, click **Missing Documents**.
  2. Enter a Lucene-syntax search against the underlying index to find a document that should match but doesn't currently appear in the query's results.
  3. Rate the found document inline.
  4. Click **Reset to All Rated Docs**.
- **Expected:** Search returns matching documents with a count message (or a "no results" message); ratings set here affect the query's score, matching the persistent on-screen warning "Changing ratings will affect the query score."

### 4.10 Tune Relevance drawer — Query tab (Query Sandbox)

- [ ] **Steps:**
  1. Click the wrench icon ("Tune Relevance") to open the east drawer.
  2. On the **Query** tab, edit the raw query template (textarea for Solr, Ace/JSON editor for ES/OS/Vectara/Algolia/SearchAPI).
  3. Click **Rerun My Searches!**.
- **Expected:** All queries re-run against the edited template and rescore.
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
  1. Switch to **Settings**.
  2. **Search Endpoints**: pick a different shared endpoint from the dropdown, or use the typeahead search.
  3. **Endpoint Details**: confirm read-only name/URL/icon show, and the "More" link works; if the endpoint is archived, confirm the warning banner appears.
  4. **Displayed Fields**: change the comma-separated list of fields shown per result, confirm the result rows update.
  5. **Number of Results to Show**: change the numeric value (max 100), confirm the result count changes accordingly.
  6. **Evaluate Nightly?**: toggle on, then click **Rerun My Searches Now in the Background!**.
  7. **Escape Queries**: toggle the Lucene-syntax escaping option and confirm query behavior changes as expected.
- **Expected:** Each control's change takes effect either immediately or after the next search run, as appropriate.
- **Edge cases:**
  - [ ] Set Number of Results above the max (100) — confirm it's clamped/rejected.
  - [ ] Toggle Evaluate Nightly on, then check that a background job is actually queued (verify via Admin > Job Manager, Part 14, if accessible).

### 4.13 Tune Relevance drawer — History tab

Covered in depth in Part 5 (Tries / History). Quick smoke test here:

- [ ] **Steps:**
  1. Switch to **History**, confirm links "Visualize your tries", "Check Scores", "Check Ratings" are present and navigate correctly.
  2. Confirm the try list below renders, with tries color-coded by search URL.
- **Expected:** "Check Scores" goes to `/cases/:id/scores` — a table of all scores with Scorer/Try Number/Score/Day columns, filterable by scorer, with a bulk **Delete** action (checkboxes + a confirm dialog) and a link to "Understand Score Duplication" (Part 13). "Check Ratings" goes to `/cases/:id/ratings` — a searchable (`query, doc id, or rating`) table of every rating with Rating ID/Query/Doc ID/Rating/User/Created/Updated columns.
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
  - [ ] Force a save failure (e.g., simulate a network error) — confirm the flash "Ooooops! Could not save your query details. Please try again." appears and the panel stays open with your unsaved edits intact.
  - [ ] Leave both fields blank and save — should succeed without error (notes are optional).
  - [ ] Confirm the **Information Need** value entered here is the same one referenced/exported by the "Information Need" export/import format in Part 6.1/6.2 — edit it here, then run an Information Need export, and confirm it round-trips correctly.

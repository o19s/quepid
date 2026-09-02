# Part 6: Core Workbench — Import, Export & Explain Tools

## Overview

This part covers the remaining case-toolbar actions (Export, Import, Clone, Delete/Archive, Share, Judgements link) and the diagnostic tools for understanding *why* a query/document scored the way it did (Explain Query, Debug Explain, Frog Report).

## Test scenarios

### 6.1 Export a case

- [ ] **Steps:**
  1. Click **Export** in the case toolbar.
  2. In "Export Case: {case name}", try each format radio button in turn: **Information Need**, **General**, **Detailed** (only enabled in single-case view), **Snapshot** (pick a snapshot from its dropdown), **Basic**, **TREC** (pick a snapshot), **Rated Ranking Evaluator / RankQuest**, **Learning to Rank**.
  3. For each, click **Export** and confirm a file downloads with a sensible filename (e.g., `{caseName}_general.csv`) and the content matches what the modal's copy describes.
  4. Also check the **Quepid API** links section (Case/Queries/Annotations/Scores/Ratings/Snapshot JSON) and the **Quepid** full-case-JSON export (usable for re-import, see Part 3.3).
- **Expected:** Export button stays disabled until a format is chosen. Each format produces a correctly structured file.
- **Edge cases:**
  - [ ] Choose a Snapshot/Basic/TREC export while that snapshot is still being processed in the background — confirm the warning about "currently being processed" appears instead of exporting incomplete/corrupt data.
  - [ ] Try Detailed export outside of single-case context — confirm it's disabled, not silently broken.

### 6.2 Import into a case (ratings / information needs / snapshots)

- [ ] **Steps — Ratings tab:**
  1. Click **Import** in the case toolbar, select the **Ratings** tab.
  2. Toggle "Clear existing queries?" as desired.
  3. Choose a format: **CSV** (headers must be exactly `query,docid,rating`), **Rated Ranking Evaluator**, or **Learning to Rank** (file pickers).
  4. Upload a valid file, confirm the warning banner "This operation WILL override your existing ratings..." then click **Import**.
- [ ] **Steps — Information Needs tab:**
  1. Toggle "Create missing queries?" as desired.
  2. Upload a CSV with headers exactly `query,information_need`.
  3. Click **Import**.
- [ ] **Steps — Snapshots tab:**
  1. Upload a CSV with headers containing `Snapshot Name,Snapshot Time,Case ID,Query Text,Doc ID,Doc Position` (the file's Case ID column is ignored — it always imports into the current case).
  2. Click **Import**.
- **Expected:** Each import type validates headers strictly and refreshes the relevant data (queries/scores) after success, with a flash confirming the result.
- **Edge cases:**
  - [ ] Upload a Ratings CSV with mismatched headers — confirm a red "Headers mismatch!" alert lists the expected headers.
  - [ ] Upload a Ratings CSV where a row has more than 3 comma-separated values without quote-wrapping — confirm a red alert lists the specific offending line number(s). Repeat for Information Needs with the 2-column limit.
  - [ ] Upload the wrong file into the wrong tab (e.g., an Information Needs CSV into the Ratings tab) — confirm this is caught by header validation rather than silently corrupting data.
  - [ ] Cancel out of the modal after uploading but before confirming — confirm nothing was imported.

### 6.3 Clone a case

- [ ] **Steps:**
  1. Click **Clone** in the case toolbar.
  2. Enter a new case name (required).
  3. Choose "Only include a specific try" (pick one from the Select) or "Include the entire try history".
  4. Toggle **Include Queries** (checked by default) and **Include Ratings**.
  5. Click **Clone**.
- **Expected:** On success, you're navigated into the new case at its last try, with the chosen data (tries/queries/ratings) copied appropriately.
- **Edge cases:**
  - [ ] Leave the name blank — Clone button should stay disabled.
  - [ ] Uncheck **Include Queries** — confirm the warning "You have chosen not to import any queries. The new case will be empty." appears, and the resulting case is indeed empty of queries.
  - [ ] Check Include Queries but uncheck Include Ratings — confirm queries clone without any ratings attached.
  - [ ] Force a failure — confirm flash "Unable to clone your case, please try again."

### 6.4 Delete / Archive / Delete-all-queries (in-case toolbar)

⚠️ These are destructive; use a disposable test case.

- [ ] **Steps:**
  1. Click **Delete** (x icon) in the case toolbar to open "Delete Options for Case: {case name}".
  2. Try each of the three options in turn (on separate disposable test cases), reading the contextual warning text each time before confirming:
     - **Delete All Queries** — deletes all queries and their ratings; you remain on the case (now empty of queries).
     - **Archive Case** — moves case to Archived, navigates you to the Cases list.
     - **Delete Case** — permanently deletes the case, navigates you to the Cases list.
  3. Confirm the footer button label always matches the selected option ("Delete All Queries" / "Archive" / "Delete").
- **Expected:** Each option does exactly what its own description promises — no more, no less. In particular, confirm "Delete All Queries" also removes ratings for those queries (per its own copy) but does **not** delete the case, its annotations, or its snapshots — verify this last part explicitly, since it's easy to assume too much or too little is deleted.
- **Edge cases:**
  - [ ] Confirm button (**Cancel** aside) stays disabled until one of the three options is picked.
  - [ ] Force a server failure on each path — confirm the flash includes the server error message and doesn't leave the UI in a half-deleted state.

### 6.5 Share a case (in-case toolbar)

- [ ] **Steps:** Same flow as Part 3.6, but triggered from inside the workbench via the "Share case" icon. Confirm behavior matches (share/unshare, "already shared with" list, no-teams-yet prompt with a **Create a team** shortcut).
- **Edge cases:**
  - [ ] Click **Create a team** from inside this modal — confirm it navigates away to `/teams` and that no unsaved workbench state (e.g., an in-progress edit elsewhere on the page) is silently lost.

### 6.6 Judgements link (connect a case to a Book)

- [ ] **Steps:**
  1. Click the **Judgements** (book) icon in the case toolbar.
  2. If the case isn't yet shared with any team, confirm you're prompted to share it or create a team first.
  3. Pick (or create) a Book from a team the case is shared with.
  4. Toggle **Case → Book: Query/Doc Pairs** sync and use its manual **Populate Now** button.
  5. Toggle **Book → Case: Judgement Ratings** sync and use its manual **Refresh Ratings** button.
  6. Try **Sync Queries** (pulls in queries missing from the book).
  7. Click **Save** (should only be enabled once something has actually changed).
- **Expected:** The case-to-book link is established; sync directions work independently in both directions. Large operations (50+ queries) run as a background job with a redirect and a flash notice rather than blocking the UI.
- **Edge cases:**
  - [ ] Attempt this on a case with zero team-sharing — confirm the gating message/prompt to share first.
  - [ ] Use **Create a book** and **Judge Documents!** shortcuts — confirm they land you in the right place (Part 10/11).

### 6.7 Explain a query (Explain Query modal)

- [ ] **Steps:**
  1. Expand a query, click **Explain Query**.
  2. **Params** tab — view the JSON of parameters sent to the engine. (Solr may show a "not returned by the current Search Engine" message instead — this is expected, not a bug.)
  3. **Parsing** tab — view how the engine parsed the query.
  4. **Query Template** tab — click it; if the query is templated, confirm the populated template renders; otherwise confirm "This is not a templated query." shows.
  5. Use the **Copy** icon to copy the active tab's content, then paste it somewhere to confirm it copied correctly.
- **Expected:** Each tab shows accurate, engine-appropriate information; the Query Template tab only fetches on-demand (switching to it, not on modal open).

### 6.8 Explain a single document (Debug Explain)

- [ ] **Steps:**
  1. Expand a query, expand a document's detailed explain/score-breakdown area.
  2. Click **Debug**.
  3. In "Debug Explain for {doc title} (id:{doc id})", expand/collapse nodes in the JSON tree.
- **Expected:** The tree accurately reflects the raw explain payload returned by the search engine for that specific document.

### 6.9 Frog Report

- [ ] **Steps:**
  1. Click the frog icon at the top-right of the query list.
  2. Review "The Frog Pond Report: {case name}" — summary stats on ratings coverage (queries with/without results, total ratings needed, % missing).
  3. On a fully-rated case, confirm the "All the queries have been fully rated!" congratulations state appears.
  4. Review the bar chart of query counts grouped by missing-rating depth.
  5. If the case is linked to a Book, use **Refresh ratings from book {book name}**.
- **Expected:** Stats and chart accurately reflect the case's current rating coverage; the refresh action pulls the latest judgements from the linked book.

### 6.10 Unarchive case (from within a case context)

- [ ] **Steps:**
  1. Trigger the "Unarchive case" modal (lists archived cases for a team, or across all your cases).
  2. Click **Add Back {case name}** on one.
- **Expected:** The chosen case is restored to active status.

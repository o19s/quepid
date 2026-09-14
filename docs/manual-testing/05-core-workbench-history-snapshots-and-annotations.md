# Part 5: Core Workbench — History, Snapshots & Annotations

## Overview

Quepid keeps a full history of configuration changes (**Tries**), point-in-time captures of search results (**Snapshots**), and free-text notes tied to a score (**Annotations**). Together these let a tester or relevance engineer answer "what did we change, and did it help?" This part covers all three, plus the score-trend sparkline that ties them together visually.

## Test scenarios

### 5.1 Try history (History tab)

Every time case/query/engine settings change, Quepid saves a new **Try** so you can go back in time.

- [ ] **Steps:**
  1. Open the Tune Relevance drawer, go to the **History** tab.
  2. Confirm the try list shows every past try, background-color-coded by search endpoint URL.
  3. Click an older try in the list.
  4. Hover/click the "..." button that appears on a try row to see its per-try edit details.
- **Expected:** Clicking a try switches the entire page — queries, scores, and settings — to that try's configuration live (not just a read-only view).
- **Edge cases:**
  - [ ] Change a setting (e.g., Displayed Fields) and confirm a *new* try is created rather than mutating the old one.
  - [ ] Switch to a much older try, then switch back to the newest — confirm no data is lost or corrupted by the round trip.

### 5.2 Create a snapshot

- [ ] **Steps:**
  1. Click the camera icon ("Create snapshot") in the case toolbar.
  2. Enter a snapshot name (required).
  3. If shown (only for engines that support lookup-by-id), toggle **Record Document Fields?**.
  4. Click **Take Snapshot**.
- **Expected:** While processing, the modal (or relevant UI) shows "Snapshot Being Created (this can take a minute or so)"; once done, the snapshot is available for comparison (5.3) and export (Part 6).
- **Edge cases:**
  - [ ] Submit with no name — should be blocked (required field).
  - [ ] Force a server error — confirm it surfaces clearly rather than leaving the modal stuck on "in progress" forever.
  - [ ] Take a snapshot on a large case (many queries) — confirm the async/background behavior doesn't block the rest of the UI.

### 5.3 Compare snapshots (diff)

- [ ] **Steps:**
  1. Click "Compare snapshots" (bar-chart icon) in the case toolbar.
  2. For "Snapshot 1", pick a snapshot from the dropdown.
  3. Click **Add Snapshot** to add a second (and third) comparison row, up to the maximum allowed.
  4. Click **Update Comparison Settings**.
  5. Confirm additional score badges (per query, and per case) appear reflecting each chosen snapshot.
  6. Click the "x" on a row to clear just that selection.
  7. Click **Clear Comparison View** to disable all diffs at once.
- **Expected:** Diff badges accurately reflect each snapshot's historical scores/results side-by-side with the live/current view.
- **Edge cases:**
  - [ ] Select the same snapshot in two rows — confirm the inline warning "You have selected the same snapshot multiple times." appears.
  - [ ] Select a snapshot that's still being processed in the background — confirm a warning is shown and the UI doesn't present stale/partial data as if it were complete.
  - [ ] While fetching snapshot data, confirm the "Fetching snapshot data..." progress text shows and the footer buttons are disabled meanwhile.
  - [ ] ⚠️ Click the trash icon next to a snapshot row inside this modal — this **deletes the snapshot itself**, not just the selection. Confirm the inline "Are you sure you want to delete this snapshot?" prompt appears before anything is destroyed, and that this is easy enough to notice (it's an easy action to trigger by accident since it's tucked inside a comparison-picker UI).

### 5.4 Annotations

- [ ] **Steps:**
  1. Open Tune Relevance → **Annotations** tab.
  2. Type a note (e.g., "disabled synonyms, see what happens") in the message box, click **Create**.
  3. Confirm the new annotation appears at the top of the "Existing Annotations" list with a relative timestamp, the current try's score, and your message.
  4. Open the per-annotation dropdown menu (list icon), click **Edit**, change the message, click **Update** (or Cancel).
  5. Delete an annotation via the same dropdown.
- **Expected:** Annotations record a point-in-time note tied to the current score; edits/deletes reflect immediately in the list and on the score graph (5.5).
- **Edge cases:**
  - [ ] On a brand-new case where no search has been run yet (`lastScore` undefined), attempt to create an annotation — confirm the flash error "Can't create a new annotation until searches have been run! Please rerun your searches." and no annotation is created.
  - [ ] Open Edit, change the message, then click **Cancel** — confirm the original message is restored (no partial edit leaks through).
  - [ ] Delete an annotation — note there is no confirmation dialog on this action; confirm this is intentional (and mention it to the team if it feels too easy to trigger accidentally).

### 5.5 Score graph (sparkline) & annotation markers

- [ ] **Steps:**
  1. Run searches multiple times on a case to build up score history, and create at least one annotation.
  2. Observe the small sparkline graph near the case score badge.
  3. Hover a vertical annotation marker on the graph.
- **Expected:** With 2+ historical scores, the sparkline renders (last ~10 scores). Hovering a marker shows a tooltip with the annotation's message. With 0–1 scores, no graph is shown at all.
- **Edge cases:**
  - [ ] Confirm the graph doesn't duplicate or flicker when scores/annotations update while the page is open (re-render should replace, not stack).

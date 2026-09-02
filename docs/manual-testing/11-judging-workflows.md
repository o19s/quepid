# Part 11: Judging Workflows

## Overview

This part covers the actual human judging experience: the one-at-a-time judging screen, the faster bulk-judging grid, the judgement audit list, judgement stats/leaderboard, and direct management of query/doc pairs. See Part 10 for book setup and Part 12 for AI-judge-specific flows.

## Test scenarios

### 11.1 Single-pair judging screen

- [ ] **Steps:**
  1. From a book's Overview (or the home dashboard's **Judge** button), start judging — navigate to `/books/:id/judge`.
  2. Confirm the card shows the query text, information need (if present), a collapsible **Scoring Guidelines** panel, document fields (with thumbnail if available), and one rating button per scale value (color gradient, labeled per the scorer if configured).
  3. Click a rating button with the mouse.
  4. Confirm you're advanced to the next pair, and that a background job eventually syncs the rating into any linked Case (if applicable — see Part 6.6).
- **Expected:** Rating saves immediately on click; you move to the next pair without a full page reload feel.
- **Edge cases:**
  - [ ] Double-click / rapid duplicate-click a rating button — confirm no duplicate judgement/error results (the same judgement record should just get updated).

### 11.2 Keyboard-shortcut rating

- [ ] **Steps:**
  1. On the judging screen, press each of the mapped keys: **A S D F G H J K L ;** (note: "I" is intentionally skipped).
  2. Confirm the corresponding rating button highlights (bold + a "preselected" style) and, after a short hold (~500ms), auto-submits that rating.
  3. Click into the Explanation textarea (or the "I Can't Tell" modal) and press one of these keys while typing.
- **Expected:** Keyboard shortcuts work reliably for all mapped keys; they must **not** fire while focus is inside a text input/textarea or while the "I Can't Tell" modal is open.

### 11.3 "I will Judge Later"

- [ ] **Steps:** Click **I will Judge Later**.
- **Expected:** A judgement is created with `judge_later = true` and no rating; you advance to the next pair; it later shows under the "Judge Later" filter in the Judgements list (11.6) and is included in Part 10.6d's bulk-resolve tool.

### 11.4 "I Can't Tell" (mark unrateable)

- [ ] **Steps:**
  1. Click **I Can't Tell**.
  2. In the "Record Explanation" modal, optionally type a reason.
  3. Click **Skip Judging**.
  4. On a separate pair, open the modal and click Cancel instead.
- **Expected:** Confirming creates a judgement with `unrateable = true` (visible under the "Unrateable" filter, 11.6, and counted in Judgement Stats, 11.7). Cancelling creates nothing, and keyboard shortcuts should resume working normally afterward.

### 11.5 Session milestones, navigation, and completion

- [ ] **Steps:**
  1. Judge roughly 50 pairs in one session (or as many as feasible).
  2. On the 50th, confirm a "party time" screen: confetti, a progress bar, a leaderboard chart, and an **"I'm Ready for More!"** button that resumes judging.
  3. Use **Go Back to Previous Query/Doc Pair** to reopen and re-rate the immediately prior pair.
  4. Click **Quit Judging** — confirm it returns to the Book Overview without losing already-saved judgements.
  5. If feasible, exhaust all pairs available to the current user — confirm the friendly "You have judged all the documents you can!" message and redirect.
- **Expected:** All of the above behave as described, with no data loss on quit/navigate-away.
- **Edge cases:**
  - [ ] Re-open a judgement originally made by a **different** user (e.g., via Go Back after someone else judged, or via the Judgements list edit link) — confirm the warning banner "This judgement was made by {fullname}!" appears before you accidentally overwrite someone else's rating.
  - [ ] Book configured with `show_rank: true` vs. `false` — confirm "Document Rank" appears/disappears accordingly.

### 11.6 Judgements list (audit view)

- [ ] **Steps:**
  1. Open a book's **Judgements** tab.
  2. Search using field-specific syntax: `query_doc_pair_id:123`, `doc_id:abc`, `query_text:...` — and separately, plain free text (should match across query text/doc id/information need/explanation).
  3. Filter by **Judge** (dropdown of users).
  4. Toggle **Compact** off — confirm additional columns appear (Document fields, Unrateable, Judge Later, Explanation, Created/Updated At).
  5. Toggle **Unrateable** and **Judge Later** filters, individually and combined.
  6. Click a judgement's ID to open it in the edit/re-rate screen (same UI as 11.1).
- **Expected:** All filters apply correctly and can combine; editing via the ID link lets you correct a previous judgement.

### 11.7 Judgement Stats (leaderboard)

- [ ] **Steps:**
  1. Open a book's **Judgement Stats** tab (with judgements from 2+ users, including at least one anonymous/legacy judgement if possible).
  2. Confirm the leaderboard bar chart shows one bar per judge, plus an "anonymous" bucket for `user: nil` judgements.
  3. In the table below, click **reset** next to a judge's "Marked Unrateable" count.
  4. Click **reset** next to a judge's "Marked Judge Later" count.
- **Expected:** Each reset deletes just that judge's unrateable (or judge-later) judgements and the count drops to 0; the reset button itself disappears once the count is 0 (since it's only rendered when count > 0).
- **Edge cases:**
  - [ ] Confirm the **Prepare to Judge!** button (AI judge rows, Part 12) is disabled when there's nothing left to judge, or when the book has already reached 3 judgements per pair.

### 11.8 Bulk Judge (grid mode)

- [ ] **Steps:**
  1. From the Judgements tab, click **Bulk Judge**.
  2. Confirm results are grouped by query, each with a doc count, and default-filtered to **Unrated** only.
  3. Click a rating button on a document — confirm it saves via AJAX (no full page reload) and visually marks as selected.
  4. Reload the page — confirm the rating persisted.
  5. Click **Reset** ("clear rating") on a rated document — confirm it's removed via AJAX and the Reset control disappears.
  6. Toggle **Show Explanations** on, type into a document's explanation field — confirm it auto-saves (no explicit save button) and persists on reload.
  7. Toggle **Show Explanations** off with existing explanations present — confirm they render read-only rather than vanishing.
  8. Uncheck **Unrated** — confirm already-rated documents also appear, pre-selected.
  9. Use the **Rank Depth** dropdown to limit to `position <= N`.
  10. Enter a **query text** filter that matches no queries — confirm the empty state lists active filters with working "clear this filter" quick links.
  11. Page through results (25 per page) if there are enough documents, and confirm grouping-by-query stays correct across the page boundary.
- **Expected:** All of the above work as described; saving/clearing ratings never triggers a full page reload.
- **Edge cases:**
  - [ ] Submit an invalid rating value (e.g., via browser dev tools tampering the request) — expect a `422` JSON error response and some visible failure indication in the UI, not a silent no-op.

### 11.9 Query/Doc Pairs management

- [ ] **Steps:**
  1. Open a book's **Query/Doc Pairs** tab.
  2. Search by partial query text, doc id, pair id, or document-field content.
  3. Toggle "Include Judgement Count" — confirm a Judgements column appears, linking to the Judgements tab pre-filtered to that pair.
  4. Click the info icon on a truncated Document Fields cell — confirm the full JSON modal opens correctly.
  5. Click **New Query Doc Pair**, fill in query text, doc id, position, and (optionally) Document Fields / Options JSON, Information Need, Notes, save.
  6. Edit an existing pair's query text or JSON fields, save, and confirm any judgements linked to it (by `query_doc_pair_id`, not by content) remain correctly attached.
- **Expected:** All CRUD and search operations behave as described.
- **Edge cases:**
  - [ ] Submit invalid JSON in Document Fields or Options on the New/Edit form — confirm a clear validation error, not a broken save.
  - [ ] Cross-check the result of Part 10.6c ("Delete Query Doc Pairs Below Position") from this tab's list — confirm exactly the expected pairs were removed.

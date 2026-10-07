# Part 10: Books Management

## Overview

A **Book** is Quepid's offline relevance-judgement workflow: a set of query/document pairs (**Query Doc Pairs**) that one or more people (or AI Judges) rate independently (**Judgements**). Judgements can later be synced back into a Case's ratings (Part 6.6). This part covers creating/configuring a book, its danger-zone maintenance tools, and import/export. Judging itself is covered in Part 11; AI Judges in Part 12.

**Where to find it:** `/books`. Every book page shares a tab strip: **Overview** and **Judge Overview**. Management pages also show **Judgement Stats, Query/Doc Pairs, Judgements, Import, Share book, Export, Settings**.

## Test scenarios

### 10.1 Books list

- [ ] **Steps:**
  1. Go to `/books`. Confirm columns: ID, Name, Teams, Scale, Status (query/doc pair count + Archived badge), Share icon.
  2. Use the `q` search box (matches book or team name).
  3. Use the team dropdown filter.
  4. Toggle **View Archived Books** / **View Active Books**.
- **Expected:** Filters combine; empty state ("Create your first book...") shows when you have none.
- **Edge cases:**
  - [ ] Combine team filter + text filter + archived flag simultaneously — confirm all apply together correctly.
  - [ ] Search for a team name (not a book name) — confirm it still matches via the team join.

### 10.2 Create a new book

- [ ] **Steps:**
  1. Click **New Book**. Leave Name blank, submit — confirm a validation error re-renders the form.
  2. Fill Name, check at least one team to share with, pick a **Rating Scale** (scorer), review/edit the auto-populated **Scoring Guidelines**, save.
- **Expected:** Redirects to the new book's Overview with "Book was successfully created."
- **Edge cases:**
  - [ ] Create a book while belonging to zero teams — confirm the team picker offers "Create a team" and the book can still be saved privately.
  - [ ] Create a book from within a Case's "Judgements" flow (Part 6.6, passes `origin_case_id`) — confirm the "Case Integration" toggles appear. Uncheck Link the Case: both sync switches disable; recheck it: their choices remain. Save checked and unchecked variants, verifying that unchecked creation preserves the case's existing book/settings. Set different sync choices, uncheck Link the Case and submit without a scale (bypass browser validation to reach the server). Confirm case context and choices survive validation; recheck linking and verify the original choices before correcting the scale and retrying.
  - [ ] Save without checking any team — confirm the book still saves (now effectively private to you) without erroring.

### 10.3 Edit book settings

- [ ] **Steps:**
  1. Open an existing book's **Settings** tab.
  2. Change Name, add/remove Teams, add/remove **AI Judges Assigned to this Book** checkboxes (see Part 12 for creating an AI Judge first), set per-judge **Auto-run on new pairs** and **Rank Depth**, toggle **Show Rank of Documents when Judging**, toggle **Supports Implicit Judgements**, change **Rating Scale** and **Scoring Guidelines**.
  3. Save, reload, confirm everything persisted.
- **Expected:** All settings persist correctly.
- **Edge cases:**
  - [ ] With an import or export file already attached, check "Delete Import File" / "Delete Export File" and save — confirm the file is purged and the checkbox becomes disabled afterward.
  - [ ] As a member of only one of the book's several sharing teams, edit and save the book — confirm hidden teams and AI judges are preserved. AI judge checkboxes list judges you own or that are shared with your teams; hidden assignments and their auto-run flags must survive; saving the unchanged visible selection must succeed (best tested with two accounts).
  - [ ] Change the Rating Scale after judgements already exist on the old scale — confirm existing judgements still display sensibly rather than breaking.

  - [ ] Submit a foreign team ID or an inaccessible/human AI judge ID in a create/update request — expect 404, no new book and no changes to existing memberships.

### 10.4 Book Overview / Show page

- [ ] **Steps:**
  1. Open a book's **Overview** tab. Confirm Fully Judged (3+ judgements), Not Started and In Progress coverage; AI/human Judge Activity with counts, last-active time and 30-day charts; Linked Cases with sync-direction arrows; Book Settings and Associated Files. Coverage respects Rank Depth and updates on refresh; activity updates live.
  2. Click **Archive**, confirm the dialog, confirm.
  3. From the archived list, reopen it, click **Unarchive**, confirm.
- **Expected:** Archive/unarchive work with the standard browser confirm dialog; the Archived badge and index-list membership update accordingly.
- **Edge cases:**
  - [ ] With legacy anonymous judgements present (`user: nil`), confirm the yellow "anonymous judgements" warning banner appears and links toward the Assign Anonymous tool (10.6a).
  - [ ] With an import currently processing, confirm the red in-progress alert + manual **Refresh** link appears, and clicking Refresh updates the pair count once the job finishes.
  - [ ] Confirm unassigned accessible AI judges are offered and assigned judges are shown in activity even with zero judgements. Play opens the bounded/all-pairs modal; Refine Prompt appears only for judges you can edit. Linked-case arrows distinguish sends pairs, receives ratings, both and no auto-sync; running jobs pulse the matching direction.

### 10.5 Combine (merge) books

- [ ] **Steps:**
  1. On Settings, find the "Populate/Combine Books" section listing your other books, each with a rated-pair-count badge.
  2. Select one or more source books that have rated pairs (books with 0 rated pairs should be disabled/unselectable), click **Merge these Books into this Book**.
- **Expected:** Notice "Combined N query/doc pairs." Query/doc pairs and averaged ratings (averaged per-user across the two books) appear in the target book.
- **Edge cases:**
  - [ ] Choose a source book whose scale doesn't match the target's — expect an alert stating the target scale, and no merge performed.
  - [ ] Confirm a book with 0 rated pairs truly can't be selected via the UI (disabled checkbox), not just discouraged.
  - [ ] Submit an inaccessible or missing source id — expect a scoped 404 and no pairs or judgements merged, including from other selected sources.
  - [ ] Force a pair, judgement or final book validation failure — expect an error alert and all merge writes rolled back; no merge update jobs should be enqueued.

### 10.6a Assign anonymous judgements/ratings to a user

- [ ] **Steps:** On Settings > Danger Zone, pick an assignee from the team-member dropdown (required), click **Assign Ratings and Judgements**.
- **Expected:** Notice "Assigned {fullname} to ratings and judgements."; anonymous (`user: nil`) judgements/ratings become attributed to that user.
- **Edge cases:**
  - [ ] If the chosen user already judged the same query/doc pair, confirm the anonymous duplicate is removed rather than causing a uniqueness error.
  - [ ] Submit with no assignee chosen — should be blocked by required-field validation.

### 10.6b Delete judgements by user

- [ ] **Steps:** Pick a judge from the dropdown, confirm the dialog, click **Delete Judgements**.
- **Expected:** Notice "Deleted N judgements belonging to {fullname}."; those judgements disappear from the Judgements tab.

### 10.6c Delete query doc pairs below a rank

- [ ] **Steps:** Pick a position value from the dropdown (built from distinct positions present in the book), confirm, submit **Delete Query Doc Pairs**.
- **Expected:** Notice "Deleted N query/doc pairs below position X."; pairs with `position > X` are gone; pairs with no position set are untouched.

### 10.6d Assign rating to Judge Later judgements

- [ ] **Steps:** Have some judgements marked "Judge Later" (Part 11.1). On Settings, pick a rating value from the book's scale, confirm, submit **Assign Rating and Clear Judge Later**.
- **Expected:** Notice "Mapped N judgements to have rating X."; those judgements now carry the chosen rating and are no longer flagged Judge Later (they disappear from the "Judge Later" filter in the Judgements list).
- **Edge cases:**
  - [ ] Run this with zero Judge Later judgements present — should still succeed, reporting 0 mapped.

### 10.6e Remap judgement ratings

- [ ] **Steps:**
  1. On Settings > Danger Zone, scroll to **Remap Judgement Ratings**. Confirm one row per distinct rating value currently used by the book's judgements or its associated cases' ratings, each with a "Map To" number input pre-filled with the same value.
  2. Change one or more targets (e.g. collapse a 0–3 scale to binary: 3→1, 2→1, 1→0), confirm the dialog, click **Remap Ratings**.
  3. Open the Judgements tab and an associated Case's ratings (`/cases/:id/ratings`) and confirm the values changed.
- **Expected:** Notice "Remapped N judgements and M case ratings."; both the book's judgements and all associated cases' ratings are remapped together.
- **Edge cases:**
  - [ ] Submit without changing any value — expect "No ratings changed." and no data touched.
  - [ ] Chained mappings (e.g. 3→2 and 2→1 together) — confirm each original value maps exactly once (3 does not end up as 1).
  - [ ] A book with no rated judgements or case ratings — the form shows "No rated judgements or case ratings found in this book." instead of a table.
  - [ ] Blank a "Map To" input — that value is left unchanged rather than nulled.
  - [ ] After remapping, confirm the book's Rating Scale (Settings) is **not** changed automatically; update it separately if the scale should change.

### 10.7 Import a new book from JSON

- [ ] **Steps:**
  1. From the Books index, click **Import Book**.
  2. Upload a valid `.json` export of a previous book (or a `.json.zip` containing one JSON file).
  3. Leave "Force create users" unchecked initially.
- **Expected:** Redirected to the new book's Show page with "Book was successfully created."; import processes in the background — confirm the "currently being processed" alert clears once done and pairs/judgements populate.
- **Edge cases:**
  - [ ] Submit with no file chosen — expect "You must select the file to be imported first."
  - [ ] Upload a file with invalid JSON syntax — expect "Invalid JSON file format. Unable to parse the provided data structure. {message}".
  - [ ] Upload structurally-invalid (but syntactically valid) JSON — expect "Invalid JSON file: Unable to process the provided data structure. {message}".
  - [ ] Upload judgements referencing a `user_email` not already in this Quepid instance with **Force create users unchecked** — expect "User with email '...' needs to be migrated over first." and the book is not created.
  - [ ] Repeat with **Force create users checked** — expect the user to be auto-invited and import to proceed successfully.
  - [ ] Upload a payload whose pair carries **two judgements with no `user_email`** — expect *both* to land as separate rows on the Judgements tab with Rater "anonymous" (they must not collapse into one, nor be attributed to an AI judge; AI-judge users have no email, so a sloppy lookup matches them), and the Overview to report "This book has 2 anonymous judgements that could be mapped to a user." Note that re-uploading that same file *doubles* the anonymous rows — expected, since an anonymous judgement has no identity to upsert on; judgements carrying a `user_email` upsert instead. **Caveat worth checking:** that doubling is not cosmetic — once a pair reaches 3 judgements, `RatingsManager` stops averaging and takes the min of the top 3, so re-importing can move a computed case rating (see the anonymous-judgement idempotency entry in `docs/todo/todo.md`).

### 10.8 Import additional data into an existing book

- [ ] **Steps:**
  1. On an existing book's **Import** tab, confirm the heading identifies the book, Import is active and the Overview/Judge Overview tabs navigate correctly. Upload a JSON payload of additional `query_doc_pairs` (referencing existing `query_doc_pair_id`s, or new `query_text`/`doc_id` pairs to upsert).
  2. Separately, upload an `all_judgements` payload (using `email` to attribute judgements to a user, and optionally a nested `query_doc_pair` object instead of an id).
- **Expected:** Pairs/judgements are created or updated once the background job completes.
- **Edge cases:**
  - [ ] Same JSON-validity edge cases as 10.7 apply here too. Submit each upload form without a file: both must show "You must select the file to be imported first." and queue no import.
  - [ ] Anonymous (`user_email`-less) judgements stay separate and unattributed on both upload forms — see 10.7's anonymous-judgement edge case.

### 10.9 Export a book

- [ ] **Steps:**
  1. On the **Export** tab, click the judgement-data CSV link — confirm it downloads correctly.
  2. Click **Export** (or **Re-Export** if one already exists) — confirm notice "Queued up export of book as file." and that revisiting the tab shows "currently being exported" status while the job runs.
  3. Once complete, confirm a download link with a "created X ago" timestamp appears, and the button now reads **Re-Export**.
  4. Click Export/Re-Export a second time immediately (before the first job finishes) — confirm it's blocked/disabled rather than queuing a duplicate job.
  5. Follow the "Quepid APIs" link to the OAS docs page.
- **Expected:** Exactly one export job runs at a time per book; the resulting JSON file is a valid, complete book export (good candidate for reuse as an import template, per Part 10.7).

### 10.10 Judge Overview

- [ ] **Steps:** Open **Judge Overview** before and after contributing a judgement. Check personal progress, remaining available pairs, the book's rubric and your 30-day activity chart. Follow **Start Judging** and **Bulk Judging**.
- **Expected:** Personal progress and remaining pairs respect Rank Depth and the book's selection strategy; total contributions and the activity chart include the whole book. Completed/empty books disable judging links and explain what remains for other judges. Reload updates personal metrics.

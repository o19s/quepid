# Part 10: Books Management

## Overview

A **Book** is Quepid's offline relevance-judgement workflow: a set of query/document pairs (**Query Doc Pairs**) that one or more people (or AI Judges) rate independently (**Judgements**). Judgements can later be synced back into a Case's ratings (Part 6.6). This part covers creating/configuring a book, its danger-zone maintenance tools, and import/export. Judging itself is covered in Part 11; AI Judges in Part 12.

**Where to find it:** `/books`. Every book page shares a tab strip: **Overview, Query/Doc Pairs, Judgement Stats, Judgements, Import, Share book, Export, Settings**.

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
  - [ ] Create a book while belonging to zero teams — confirm the info alert + "Create a team" link appears in the Teams checklist area.
  - [ ] Create a book from within a Case's "Judgements" flow (Part 6.6, passes `origin_case_id`) — confirm the "Case Integration" toggles (Link the Case, Case→Book auto-populate, Book→Case auto-populate) appear and function.
  - [ ] Save without checking any team — confirm the book still saves (now effectively private to you) without erroring.

### 10.3 Edit book settings

- [ ] **Steps:**
  1. Open an existing book's **Settings** tab.
  2. Change Name, add/remove Teams, add/remove **AI Judges Assigned to this Book** checkboxes (see Part 12 for creating an AI Judge first), toggle **Show Rank of Documents when Judging**, toggle **Supports Implicit Judgements**, change **Rating Scale** and **Scoring Guidelines**.
  3. Save, reload, confirm everything persisted.
- **Expected:** All settings persist correctly.
- **Edge cases:**
  - [ ] With an import or export file already attached, check "Delete Import File" / "Delete Export File" and save — confirm the file is purged and the checkbox becomes disabled afterward.
  - [ ] As a member of only one of the book's several sharing teams, edit and save the book — confirm teams/AI-judges you can't see are preserved rather than silently removed (best tested with two accounts).
  - [ ] Change the Rating Scale after judgements already exist on the old scale — confirm existing judgements still display sensibly rather than breaking.

### 10.4 Book Overview / Show page

- [ ] **Steps:**
  1. Open a book's **Overview** tab. Confirm it shows: judgements-needed banner, AI judge info or call-to-action, Teams, Scale labels, Show Rank/Implicit Judgements flags, Related Cases, and Associated Files.
  2. Click **Archive**, confirm the dialog, confirm.
  3. From the archived list, reopen it, click **Unarchive**, confirm.
- **Expected:** Archive/unarchive work with the standard browser confirm dialog; the Archived badge and index-list membership update accordingly.
- **Edge cases:**
  - [ ] With legacy anonymous judgements present (`user: nil`), confirm the yellow "anonymous judgements" warning banner appears and links toward the Assign Anonymous tool (10.6b).
  - [ ] With an import currently processing, confirm the red in-progress alert + manual **Refresh** link appears, and clicking Refresh updates the pair count once the job finishes.
  - [ ] Confirm "AI Judges Available" only appears when the book's teams have an unassigned AI judge, and flips to "we have an AI Judge helping" text once one is assigned.

### 10.5 Combine (merge) books

- [ ] **Steps:**
  1. On Settings, find the "Populate/Combine Books" section listing your other books, each with a rated-pair-count badge.
  2. Select one or more source books that have rated pairs (books with 0 rated pairs should be disabled/unselectable), click **Merge these Books into this Book**.
- **Expected:** Notice "Combined N query/doc pairs." Query/doc pairs and averaged ratings (averaged per-user across the two books) appear in the target book.
- **Edge cases:**
  - [ ] Choose a source book whose scale doesn't match the target's — expect an alert naming the mismatched book, and no merge performed.
  - [ ] Confirm a book with 0 rated pairs truly can't be selected via the UI (disabled checkbox), not just discouraged.

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

### 10.8 Import additional data into an existing book

- [ ] **Steps:**
  1. On an existing book's **Import** tab, upload a JSON payload of additional `query_doc_pairs` (referencing existing `query_doc_pair_id`s, or new `query_text`/`doc_id` pairs to upsert).
  2. Separately, upload an `all_judgements` payload (using `email` to attribute judgements to a user, and optionally a nested `query_doc_pair` object instead of an id).
- **Expected:** Pairs/judgements are created or updated once the background job completes.
- **Edge cases:** Same JSON-validity and missing-file edge cases as 10.7 apply here too.

### 10.9 Export a book

- [ ] **Steps:**
  1. On the **Export** tab, click the judgement-data CSV link — confirm it downloads correctly.
  2. Click **Export** (or **Re-Export** if one already exists) — confirm notice "Queued up export of book as file." and that revisiting the tab shows "currently being exported" status while the job runs.
  3. Once complete, confirm a download link with a "created X ago" timestamp appears, and the button now reads **Re-Export**.
  4. Click Export/Re-Export a second time immediately (before the first job finishes) — confirm it's blocked/disabled rather than queuing a duplicate job.
  5. Follow the "Quepid APIs" link to the OAS docs page.
- **Expected:** Exactly one export job runs at a time per book; the resulting JSON file is a valid, complete book export (good candidate for reuse as an import template, per Part 10.7).

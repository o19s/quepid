# Part 8: Scorers

## Overview

A Scorer is a JavaScript formula that turns a set of graded judgements into a single relevance score per query (e.g. nDCG@10, Precision@10). Quepid ships 7 built-in **Communal** scorers available to everyone; users can also write and share **Custom** scorers.

**Where to find it:** Sidebar icon (list-task), tooltip "Scorers" → `/scorers`.

## Test scenarios

### 8.1 Scorers list

- [ ] **Steps:**
  1. Go to Scorers. Confirm the "Communal: N &nbsp; Custom: N" counter at top-right.
  2. Confirm the table shows Name, Type (Communal/Custom), Scale (e.g. `[0, 1, 2, 3]`), Owner ("System" for communal), and row actions.
  3. Use the "Filter scorers" search box (matches name).
  4. Toggle the **Communal** / **Custom** checkboxes — confirm checking exactly one narrows the list to that type; note that checking both or neither shows everything (this is expected, not a bug).
- **Expected:** Filtering and counts stay consistent as you toggle.
- **Edge cases:**
  - [ ] As a non-admin, confirm communal rows show a **Clone** icon but no **Edit** icon (Edit is admin-only for communal scorers).
  - [ ] As an admin, confirm communal rows show both **Edit** and **Clone**.

### 8.2 Set your default scorer

- [ ] **Steps:**
  1. On the Scorers page, in "Your Default Scorer", pick a scorer from the dropdown (communal + your custom scorers combined).
  2. Click **Save**.
- **Expected:** Flash "Default scorer updated."; new cases (or cases without an explicit scorer chosen) use this scorer going forward.
- **Edge cases:**
  - [ ] A brand-new user with no default set yet — confirm the system-wide fallback (AP@10, unless reconfigured) is used sensibly.
  - [ ] Submit a scorer id you don't actually have access to (e.g., via a stale form) — expect "You cannot select that scorer as default."

### 8.3 Create a custom scorer

- [ ] **Steps:**
  1. Click **+ Add New**.
  2. Enter a Name (help text suggests including depth, e.g. "nDCG@10 mine").
  3. Write/paste scoring JavaScript in the **Code** editor.
  4. Choose a **Scale for query ratings**: Binary (0,1), Graded (0,1,2,3), or Custom (type your own comma-separated list).
  5. Toggle "Show scale labels?" and, if on, fill in a label per scale value.
  6. Click **Save**.
- **Expected:** Redirects to the Edit page with notice "Scorer created."; the new scorer is always `communal: false` and owned by you regardless of any tampering with the form.
- **Edge cases:**
  - [ ] Leave Name blank — confirm it auto-assigns something like "Scorer {N}" rather than failing.
  - [ ] Enter more than 10 comma-separated scale values — expect a length validation error.
  - [ ] Enter non-integer values in the scale list (e.g. `a,b,c`) — expect a type validation error.
  - [ ] Enter scale values with stray spaces (`0, 1, 2`) — confirm this is handled gracefully (not silently broken).

### 8.4 Edit a scorer

- [ ] **Steps:**
  1. Open one of your custom scorers, click **Edit** (or navigate from the list), change the code/scale/labels, save.
  2. As an **admin**, edit a communal scorer — confirm the warning banner "You are editing a communal scorer that is available to all users. Changes will affect everyone using this scorer." appears, and saving actually affects the shared communal scorer.
- **Expected:** Changes persist; communal-scorer edits by an admin affect all users of that scorer.
- **Edge cases:**
  - [ ] As a **non-admin**, try to reach the Edit page for a communal scorer directly by URL — expect a redirect to the Scorers list with "You cannot edit communal scorers." (or a 404/not-found, since non-admins can't even load someone else's private scorer this way either).
  - [ ] As a non-admin, try to reach the Edit page for another user's private (non-shared) scorer directly by URL — expect it to fail to load rather than exposing the scorer.

### 8.5 Clone a scorer

- [ ] **Steps:**
  1. Click **Clone** on a communal scorer (as a non-admin) — confirm this succeeds and produces an editable custom copy named "Clone of {original name}".
  2. Click **Clone** on a custom scorer a teammate shared with your team (not owned by you) — confirm this also succeeds.
- **Expected:** Clone is the sanctioned way for a non-admin to "customize" a built-in metric. Redirects to the new clone's Edit page with notice "Scorer cloned."
- **Edge cases:**
  - [ ] Force a clone failure — expect redirect to the list with alert "Unable to clone scorer."

### 8.6 Delete a scorer

- [ ] **Steps:**
  1. On one of your custom scorers' Edit page, click **Delete**, confirm the dialog.
  2. As an admin, attempt to delete a communal scorer.
  3. As a non-admin, attempt to delete a communal scorer (e.g. by direct request) — expect it to be blocked.
- **Expected:** Deleting nullifies (doesn't cascade-delete) dependent snapshots/scores, so historical grading data isn't destroyed; non-admins get "You cannot delete communal scorers."

### 8.7 Share / unshare a scorer with a team

- [ ] **Steps:**
  1. On a **custom** scorer you own, click the Share icon.
  2. Pick a team, click **Share with team** — confirm it shows under "Already shared with".
  3. Share again with the same team — expect an informational alert, no duplicate.
  4. Unshare — confirm removal and correct flash; unshare again — expect "is not shared with" alert.
- **Expected:** Communal scorers have no Share icon at all (they're already available to everyone) — confirm this in the UI.
- **Edge cases:**
  - [ ] Attempt to share/unshare a communal scorer via a direct request — expect "Communal scorers are already available to everyone."
  - [ ] Attempt to share/unshare a scorer you don't have access to — expect "You do not have access to that scorer."
  - [ ] Attempt with a nonexistent team or scorer id — expect "Team or scorer not found."

### 8.8 Confirm the seeded communal scorers

- [ ] **Steps:** After a fresh `db:seed`, confirm all 7 ship and match:

| Name | Scale | Labels |
|---|---|---|
| nDCG@10 | 0–3 | Poor / Fair / Good / Perfect |
| DCG@10 | 0–3 | Poor / Fair / Good / Perfect |
| CG@10 | 0–3 | Poor / Fair / Good / Perfect |
| P@10 | 0–1 | Irrelevant / Relevant |
| AP@10 | 0–1 | Irrelevant / Relevant |
| RR@10 | 0–1 | Irrelevant / Relevant |
| ERR@10 | 0–3 | Poor / Fair / Good / Perfect |

- **Expected:** All 7 appear with Owner "System"; AP@10 is the system-wide default for users who haven't set their own.

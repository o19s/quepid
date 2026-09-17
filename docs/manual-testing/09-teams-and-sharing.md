# Part 9: Teams & Sharing

## Overview

Teams let multiple users collaboratively own and share Cases, Books, Search Endpoints, and Scorers. A team also acts as the container for **AI Judges** (see Part 12). This part covers team lifecycle, membership/invitations, and the shared "share this with a team" pattern used app-wide.

**Where to find it:** `/teams`.

You'll get much more out of this part with two logged-in accounts — a team owner and a second account to invite/add.

## Test scenarios

### 9.1 Create, rename, and browse teams

- [ ] **Steps:**
  1. Go to `/teams`. Confirm the table shows ID/Name/Members/Cases, a "Filter by name" box, and a "My Teams" checkbox (auto-submits).
  2. Click **+ Add New**, enter a Name, click **Create Team**.
  3. Confirm you (the creator) are automatically added as a member.
  4. Open the team, use the **Rename Team** card to rename it, click **Rename**.
- **Expected:** New team appears in the list; rename updates immediately with flash "Team renamed."
- **Edge cases:**
  - [ ] Submit a blank team name on create or rename — expect validation error.
  - [ ] Rename to a name identical to the current one — should be a harmless no-op.
  - [ ] Create two teams with the same name (if allowed) — confirm no confusing collision in the UI.

### 9.2 Add a team member (existing user)

- [ ] **Steps:**
  1. On the team's show page, use **Add Team Member**: type an email that matches an existing Quepid user.
  2. Confirm the autocomplete suggests matches (by name or email) as you type.
  3. Click **Add user**.
- **Expected:** The user is added directly; flash "X added to the team."
- **Edge cases:**
  - [ ] Add the same user again — expect "X is already a member of this team."
  - [ ] Type a partial name/email of a user who shares no team with you and doesn't share your email domain — confirm they do **not** appear in autocomplete suggestions (privacy boundary), unless you type their **exact** email (exact email match bypasses that restriction).

### 9.3 Invite a new (non-existing) user

- [ ] **Steps:**
  1. On **Add Team Member**, type an email address with no matching Quepid account.
  2. Click **Add user**.
- **Expected:** If signups are enabled, an invited `User` is created. If email delivery is configured, flash "Invitation email was sent to X"; if not, flash instructs you to share the invite link directly. The new member shows an `INVITED` badge in the members list.
- **Edge cases:**
  - [ ] Attempt this when signups are disabled — expect "No user found with email X. Signups are disabled so cannot invite."
  - [ ] Click the 📋 copy-link button next to an `INVITED` badge member — confirm it copies a working invitation URL to the clipboard (paste it somewhere to verify).
  - [ ] Complete the invite acceptance flow (Part 1.5) and confirm the `INVITED` badge disappears afterward.

### 9.4 Remove a team member

- [ ] **Steps:**
  1. Click the "x" remove icon next to a member row, confirm the dialog ("Remove {fullname} from this team?").
- **Expected:** Member is removed immediately; their access to team-shared resources is revoked.
- **Edge cases:**
  - [ ] Remove the last human member of a team — confirm the app handles an ownerless/memberless team sensibly (doesn't error, and note what happens to shared resources).
  - [ ] As the removed user, confirm previously-team-shared cases/books/etc. are no longer visible to you afterward.

### 9.5 Sharing a Case / Book / Search Endpoint / Scorer with a team

This same modal pattern appears in two places for each resource type: on the resource's own index page (per-row Share icon), and on the Team show page (per-row Share icon in its Cases/Books/Search Endpoints/Scorers sub-tables).

- [ ] **Steps (repeat once from each entry point, for each of the 4 resource types):**
  1. Click the Share icon.
  2. Pick a team from "Select a team to share this X with:" (only your own teams appear), click **Share with team**.
  3. Confirm it now appears under "Already shared with:".
  4. Unshare it from the same modal.
- **Expected:** Both entry points produce identical, consistent results. Repeating an already-done share/unshare shows an informational alert, not an error or duplicate.
- **Edge cases:**
  - [ ] Attempt to share a resource you don't have access to — expect "You do not have access to that {case/book/search endpoint/scorer}."
  - [ ] Note: **Scorers** may only support Share (no Unshare control wired into this particular list) — confirm current behavior and flag if unshare is unexpectedly missing.
  - [ ] Use the "+ Create a team" shortcut link inside the modal — confirm it takes you to `/teams/new` without losing context awkwardly.

### 9.6 Archive / unarchive a Case or Search Endpoint from the team page

- [ ] **Steps:**
  1. On the team show page, in the Cases (or Search Endpoints) sub-table, use the "Archived" filter checkbox to toggle active/archived view.
  2. Click the archive icon on an active row, confirm the dialog, confirm.
  3. Switch to the archived view, click unarchive on the same row, confirm.
- **Expected:** Archiving via the team page reassigns ownership to the acting user (same as the case-list-level archive action in Part 3.5) and only works for resources actually associated with this team.
- **Edge cases:**
  - [ ] Note **Books** use the global archive/unarchive routes rather than a team-scoped one — confirm archiving a book still works correctly from wherever it's exposed (Part 10), even though it's not part of this team-page pattern.
  - [ ] Note the **Scorers** sub-table has no archive controls at all — this is expected (scorers aren't archivable).

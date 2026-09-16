# Part 14: Admin Area

## Overview

The Admin area (`/admin`) is gated to users with `administrator? == true`. There's no self-service path to become an admin — an existing admin must promote another user via Admin > Users > Edit. Non-admins should never see the "Admin Home" nav link at all.

Use the `quepid+admin@o19s.com` seed account (Part 1) to test this part.

## Test scenarios

### 14.1 Admin access gating

- [ ] **Steps:**
  1. Log in as a non-admin user. Confirm no "Admin Home" nav link appears anywhere in the UI.
  2. Attempt to navigate directly to `/admin`.
- **Expected:** Redirected to the home page with an alert like "You must be a Quepid Administrator."
- **Edge cases:**
  - [ ] Repeat for each admin sub-page directly by URL (`/admin/users`, `/admin/announcements`, `/admin/websocket_tester`) — confirm all are equally gated, not just the index.

### 14.2 Admin Home dashboard

- [ ] **Steps:** Log in as an admin, go to `/admin`. Confirm three cards: **Managing Quepid** (Users, Announcements), **Analytics** (SQL Analytics), **Background Jobs** (Job Manager, Websocket Tester).
- **Expected:** All links navigate to their respective tools without error.

### 14.3 User management — list & search

- [ ] **Steps:**
  1. Go to Admin > Users. Confirm columns: Username/Name/Signed Up/Marketing/# Logins/Administrator?, with a lock icon shown inline for locked users.
  2. Use "Filter by email or name".
  3. Try **Export** (CSV) and **Export JSON**.
- **Expected:** Filters and both export formats work and reflect the current filtered set (verify whether export respects the active filter or always exports everything — worth confirming either way).

### 14.4 User show page & Pulse activity

- [ ] **Steps:**
  1. Open a user with a reasonable amount of activity (e.g., `realisticActivity`).
  2. Confirm displayed fields: Email, Name, Company, Signed Up (+ time ago), Created by Invite?, Email Marketing, Number of Logins, Is Administrator?, Locked?, Encrypted Password.
  3. Review the **Pulse** charts: Cases viewed, Cases scored, Cases created, Queries created, Books created, Judgements created.
  4. Open a **pending-invite** user who hasn't accepted yet.
- **Expected:** Pulse charts render grouped-by-date counts for a normal user. For a pending-invite user, confirm the info alert "This user hasn't accepted the invite to join Quepid, therefore no usage data is available." replaces the charts.

### 14.5 Lock / unlock a user

- [ ] **Steps:**
  1. On a test user's show page, click **Lock**, confirm the lock icon now appears next to their email in the Users index.
  2. In a separate session, attempt to log in as that user — confirm login is blocked.
  3. Return to Admin, click **Unlock**.
  4. Confirm the previously-blocked user can now log in again.
- **Expected:** Lock immediately prevents login; unlock immediately restores it.
- **Edge cases:**
  - [ ] Lock a user who is **currently logged in** in another tab — confirm whether their active session is invalidated immediately or only on their next login attempt (record actual behavior either way, since this affects security expectations).
  - [ ] Lock/unlock yourself (the admin account) — confirm this doesn't lock you out of your own admin session unexpectedly.

### 14.6 Edit a user

- [ ] **Steps:**
  1. Open a test user's **Edit** page.
  2. Toggle "Quepid Administrator?" on for a second test account, save; log in as that account and confirm admin access now works.
  3. Toggle it back off, confirm admin access is revoked.
  4. Set a plain-text password/confirmation for a user, save, confirm they can log in with it.
- **Expected:** Admin flag and password changes take effect correctly.
- **Edge cases:**
  - [ ] Toggle "Quepid Administrator?" off on the account you're **currently logged in as** — confirm the resulting behavior (should not silently break your own active session in a confusing way).

### 14.7 Assign judgements to anonymous user (admin-level)

- [ ] **Steps:**
  1. On a user's Edit page, note the count of judgements owned by them.
  2. Click **Assign Judgements to Anonymous User**.
- **Expected:** That user's `Judgement` rows have their `user_id` nilled out (reassigned to anonymous); the page text explains this is a prerequisite step before deleting a user who owns judgements.

### 14.8 Delete a user

⚠️ Use a disposable test account.

- [ ] **Steps:**
  1. On a disposable test user's Edit page, click **Delete this User**.
  2. Confirm the dialog reads "Are you sure you want to delete this User?" (previously a copy-paste bug read "this Search Endpoint" — fixed).
  3. Confirm the deletion.
- **Expected:** The user is deleted.
- **Edge cases:**
  - [ ] Attempt to delete a user who still owns un-reassigned judgements (skip step 14.7 first) — confirm it's blocked gracefully (re-renders the Edit page with an error) rather than crashing, since `User#judgements` uses `dependent: :restrict_with_error`.
  - [ ] Delete a user who owns cases/teams — confirm downstream effects match what you'd expect from Part 1.9 (account self-deletion) applied via the admin path: owned cases/books are nullified (not deleted) if shared with a team, and survive.
  - [ ] Delete a user who authored an **Annotation** (Part 5.4) — confirm this succeeds and the annotation survives with its `user_id` nullified, rather than a 500 (`ActiveRecord::InvalidForeignKey`). This was previously broken because `User` had no `has_many :annotations` association at all, so `destroy` never nullified the FK before hitting the DB-level constraint — fixed by adding `has_many :annotations, dependent: :nullify` to `app/models/user.rb`. This affects both this admin path and the self-service Danger Zone deletion (Part 1.9).

### 14.9 Announcements

- [ ] **Steps:**
  1. Go to Admin > Announcements, click **New**.
  2. Enter announcement text (try including basic HTML/an emoji, per the help text "You can use HTML and emojis").
  3. Save, then click **Turn Off**/**Make Live** to publish it.
  4. Log in as a **different**, non-admin user and confirm the announcement banner appears at the top of their page.
  5. Dismiss/see the banner, then reload — confirm it does **not** reappear for that same user (seen-once behavior).
  6. Back in Admin, confirm the "Views" column incremented.
  7. Publish a second announcement live at the same time as the first — confirm which one (if not both) actually shows to end users.
- **Expected:** Only live (published) announcements show; each user sees a given announcement at most once; view counts track correctly.
- **Edge cases:**
  - [ ] Enter a `<script>` tag or other active HTML in the announcement text — since this renders as raw HTML (`html_safe`) to every user, confirm your organization's risk tolerance here is understood; this is a legitimate XSS-shaped surface if announcement authorship isn't fully trusted. Flag to the team if this feels like it needs tightening.
  - [ ] Enter very long announcement text — confirm the banner wraps sensibly rather than breaking page layout.
  - [ ] Delete an announcement (Edit page, browser confirm dialog) — confirm it disappears from the index and stops showing to users.

### 14.10 Websocket Tester

- [ ] **Steps:**
  1. Go to Admin > Websocket Tester.
  2. Review the dumped ActionCable config (per-environment settings) shown for diagnostics.
  3. Click **Run Test Background Job**.
  4. Watch the notification area for a live countdown that updates once per second.
- **Expected:** Flash notice confirms the job was queued ("Websocket Tester Background Job was queued up." — previously a typo read "Websocker", fixed). The live countdown should then appear via ActionCable/websocket push.
- **Edge cases:**
  - [ ] If the countdown never appears, this indicates an ActionCable/Redis/adapter misconfiguration in this environment — that's exactly what this page exists to surface, so treat a missing countdown as an infrastructure bug to report, not a UI bug.

### 14.11 Mounted engines (Job Manager, SQL Analytics)

- [ ] **Steps:**
  1. As an admin, open **Job Manager** (MissionControl::Jobs) from the Admin Home — confirm it loads and shows background job queues/status.
  2. Open **SQL Analytics** (Blazer) — confirm it loads and can run a basic query.
  3. As a **non-admin**, attempt to reach both directly by URL (`/admin/jobs`, `/admin/blazer`) — confirm access is denied.
- **Expected:** Both tools are reachable only by admins; a deep dive into their internal functionality is out of scope for this guide (they're third-party engines), but confirm they at least load without erroring and are properly access-gated.

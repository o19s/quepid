# Part 1: Environment Setup & Accounts

## Overview

Before testing feature areas, get a Quepid instance running and know which seed accounts to use. This part also covers everything related to signing up, logging in, resetting passwords, accepting invitations, OAuth login, and managing your own profile/API keys/account.

## Getting an environment running

Quepid runs in Docker.

1. First-time setup: `bin/setup_docker` (installs dependencies, sets up the database, runs migrations, seeds data).
2. Start the app: `bin/docker s`.
3. Visit the app at `http://localhost:3000` (the port `bin/docker s` publishes by default, per `.env`'s `APP_PORT`).

If you need to reset to a clean database: `bin/docker r bin/rake db:drop db:create db:migrate db:seed`.

## Seed accounts

All seed accounts follow the pattern `quepid+[type]@o19s.com` / password `password`:

| Type | Account | Notes |
|---|---|---|
| `admin` | `quepid+admin@o19s.com` | An administrator account — use for Part 14 (Admin Area) |
| `realisticActivity` | `quepid+realisticactivity@o19s.com` | Has realistic demo data: multiple cases, the "Haystack Rating Party" demo case and book, and is a member of the `OSC` team. **Use this as your primary/default test account.** |
| `100sOfQueries` | `quepid+100sofqueries@o19s.com` | A case with hundreds of queries (usually disabled) — useful for scale/performance testing |
| `1000sOfQueries` | `quepid+1000sofqueries@o19s.com` | A case with thousands of queries (usually disabled) — useful for scale/performance testing |
| `oscOwner` | `quepid+oscowner@o19s.com` | Owns the `OSC` team — useful for team-management tests |
| `oscMember` | `quepid+oscmember@o19s.com` | A member (not owner) of the `OSC` team — useful for testing permission differences |

Having at least two logged-in sessions (e.g., one normal browser + one private/incognito window) makes it much easier to test sharing, teams, and judging scenarios realistically.

## Test scenarios

### 1.1 Sign up for a new account

- [ ] **Steps:**
  1. Go to `/` while logged out (redirects to `/sessions/new`; there is no `/login` route).
  2. On the right panel, "Sign up to get started!" (only visible if signups are enabled), fill in Full Name, Email, Password, Confirm Password.
  3. If a "Agree to terms & conditions?" checkbox is shown, check it.
  4. If a "Keep me in the know..." marketing opt-in checkbox is shown, leave it as desired.
  5. Click **Sign up**.
- **Expected:** Account is created and you're logged in (or redirected per app config).
- **Edge cases:**
  - [ ] Sign up with an email that's already registered — should show an error, not silently succeed.
  - [ ] Submit with Password and Confirm Password not matching — should show a validation error.
  - [ ] Submit with the terms checkbox unchecked when required — should block submission.
  - [ ] If signups are disabled in this environment, confirm the sign-up panel doesn't render at all.

### 1.2 Log in / log out

- [ ] **Steps:**
  1. Go to `/sessions/new` (or `/`, which redirects there while logged out).
  2. Enter a valid seed account's email/password, click **Sign in**.
  3. Confirm you land on the home dashboard.
  4. Click **Logout** (or navigate to `/logout`).
- **Expected:** Successful login lands on `/`; logout clears the session and returns you to the sign-in page.
- **Edge cases:**
  - [ ] Wrong password → generic error: "Unknown email/password combo. Double check you have the correct email address and password, or sign up for a new account." (confirm it does **not** reveal whether the email exists).
  - [ ] Attempt several rapid failed logins in a row — check whether the account locks out after a configured number of attempts, and what message is shown if so.
  - [ ] Log in as a locked account (see Part 14 to lock one via Admin) — confirm you cannot log in and the error message doesn't leak "this account is locked" info beyond what's intended.

### 1.3 OAuth login (if configured in this environment)

- [ ] **Steps:**
  1. On `/sessions/new`, note which OAuth buttons appear (Google, Keycloak, generic OpenID Connect) — this depends on environment configuration.
  2. Click one and complete the provider's login flow.
- **Expected:** You're logged into Quepid, with your name/avatar populated from the provider.
- **Edge cases:**
  - [ ] If running over plain HTTP in a production-like config, the Google button should be disabled with a message about needing HTTPS.
  - [ ] OAuth login with an email that doesn't match any existing user, in an environment where signups are disabled — should show "You can only sign in with already created users." rather than creating an account.
  - [ ] Log in via OAuth using the same email as an existing password-based account — should log into the *same* account (not create a duplicate).
  - [ ] OAuth login attempt for a locked account should be blocked with "Can't log in a locked user."

### 1.4 Password reset

- [ ] **Steps:**
  1. From `/sessions/new`, click **Forgot Password?**.
  2. Enter your email, click **Send me reset password instructions**.
  3. Retrieve the reset email (check test mail catcher / logs depending on environment) and open the reset link.
  4. Enter a new password and confirmation, click **Change my password**.
- **Expected:** You can then log in with the new password; the old password no longer works.
- **Edge cases:**
  - [ ] Request a reset for an email that doesn't exist — should behave the same as a valid request (no confirmation/denial of account existence).
  - [ ] Try to reuse an already-used or expired reset link — should be rejected.
  - [ ] Submit mismatched new password / confirmation — should show a validation error.
  - [ ] Submit a password shorter than the minimum length — should show a validation error.

### 1.5 Invitations (accepting one)

Invitations are generated from the **Teams > Add Team Member** flow (see Part 9) when an email doesn't match an existing user.

- [ ] **Steps:**
  1. Have another user invite your test email to a team (Part 9, section 9.2).
  2. Retrieve the invite link (from email, or copied via the clipboard button next to the `INVITED` badge on the team page).
  3. Open the invite link (`/users/invitation/accept?invitation_token=...`).
  4. Fill in Full Name, Email (pre-filled), Password, Confirm Password, any terms/marketing checkboxes.
  5. Click **Accept Invite**.
- **Expected:** You're logged in as a new user who is now a member of the inviting team.
- **Edge cases:**
  - [ ] Try to reuse the same invitation link a second time after accepting — should be rejected.
  - [ ] Submit mismatched passwords — should show a validation error.
  - [ ] Confirm that before accepting, the invited user shows an `INVITED` badge on the team page and doesn't show up in Admin > Users > Pulse activity data (Part 14).

### 1.6 Profile page

- [ ] **Steps:**
  1. Log in, navigate to your **Profile** page.
  2. Confirm the header shows your avatar (via Gravatar), display name, email, and counts of Cases / Teams / Queries / Ratings, plus "Member since...".
  3. Under the **Profile** form, edit Email, Name, and Company Name, click **Update profile**.
  4. Reload the page and confirm the changes persisted.
- **Expected:** Profile updates save and display correctly.
- **Edge cases:**
  - [ ] Change your email to one already used by another account — should show a validation error.
  - [ ] Clear the Name field entirely — check what displays elsewhere (should fall back to showing the email as display name).

### 1.7 Change password from Profile

- [ ] **Steps:**
  1. On the Profile page, find **Account Security**.
  2. Enter your current (Old) password, a New Password, and Confirm New Password.
  3. Click **Update password**.
- **Expected:** Password changes; you can log in with the new password afterward.
- **Edge cases:**
  - [ ] Enter an incorrect Old Password — should show "The original password is incorrect." and not change anything.
  - [ ] Enter mismatched New Password / Confirm New Password — should show a validation error.

### 1.8 API Keys (Personal Access Tokens)

- [ ] **Steps:**
  1. On the Profile page, find the Personal Access Tokens / API Keys section.
  2. Click **Generate new Token**.
  3. Confirm the new key appears in the table, and note the example `curl` command shown.
  4. Use the generated token to make an authenticated API request (e.g., `curl` to `/api/users/current`) and confirm it works.
  5. Click **Destroy** next to a key, confirm the dialog.
- **Expected:** New tokens work for API auth immediately; destroyed tokens stop working immediately.
- **Edge cases:**
  - [ ] Generate several tokens in a row — confirm there's no unexpected limit, or that a limit (if any) is enforced with a clear message.
  - [ ] After destroying a key, retry the same `curl` command — it should now fail authentication.
  - [ ] Confirm what's actually displayed in the table after generation is copyable/usable (vs. a hash/digest that can't be used for auth) — this is worth double-checking since it's easy for a UI to display the wrong value here.

### 1.9 Account deletion ("Danger Zone")

⚠️ Use a disposable test account for this, not a seed account you need later.

- [ ] **Steps:**
  1. Create (or use) a throwaway account that owns at least one case not shared with any team, and separately owns a case that **is** shared with a team.
  2. On the Profile page, scroll to the red **Danger Zone** section, read the warning text.
  3. Click **Delete your account**, confirm the dialog.
- **Expected:** Per the warning text: you're removed from any teams; any case you own that has **no** team association is deleted (along with its snapshots/ratings). Cases that are shared with a team should not simply vanish for the team.
- **Edge cases:**
  - [ ] Confirm a case that was shared with a team **survives** the owner's account deletion (verify with a teammate's login) — this is the trickiest behavior to verify and worth explicit testing.
  - [ ] Delete an account that is the sole member of a team — check what happens to that orphaned team.
  - [ ] Delete an account that has outstanding/pending team invitations it sent — confirm nothing errors for the invitee.
  - [ ] Delete an account that authored an Annotation (Part 5.4) on any case — confirm this succeeds (the annotation survives with `user_id` nulled) rather than a 500 (`ActiveRecord::InvalidForeignKey`); previously `User` had no `has_many :annotations` association, so the FK constraint blocked the raw delete. Fixed via `has_many :annotations, dependent: :nullify` in `app/models/user.rb`.

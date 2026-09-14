# Part 3: Case Management

## Overview

The Cases list page (`/cases`) is where you find, filter, create, import, archive, and share Cases — the top-level container for a relevance-tuning effort. Once you open a specific case, you're in the Core Workbench (Parts 4–6).

## Test scenarios

### 3.1 Cases list — browsing and filtering

- [ ] **Steps:**
  1. Log in and go to `/cases`.
  2. Confirm the table shows: ID, Case Title (link), Last Try #, # of Queries, Last Score (or "Never Run"), Last Run On, Last Run By, Associated Judgements (badge count or "—"), Teams (linked), Owner.
  3. Type a partial case name into the filter box, submit.
  4. Type an exact case ID into the filter box, submit.
  5. Use the **Team** dropdown to filter to a specific team's cases; set back to "All".
  6. Check the **Archived** checkbox — list should auto-submit and switch to archived cases only. Uncheck to return to active cases.
- **Expected:** Each filter narrows the list correctly; filters can combine (e.g., team + text + archived together).
- **Edge cases:**
  - [ ] Filter text that matches nothing — table should render empty, not error.
  - [ ] With zero cases at all (no filter applied), confirm the "Create your first case by clicking on Relevancy Cases > Create a case in the navigation bar above." message appears — and confirm it does **not** appear when a filter/search/team/archived selection simply matches zero cases (i.e. you still have cases overall, just none matching).
  - [ ] Pagination — with enough cases to span multiple pages, confirm page controls work and filters persist across pages.
  - [ ] Confirm only cases you're "involved with" (own, or shared via a team you belong to) ever appear — log in as a second unrelated account and confirm you don't see the first account's private cases.

### 3.2 Create a new case (setup wizard)

- [ ] **Steps:**
  1. Click **Relevancy Cases > Create a case** in the top navbar dropdown (there's no standalone "New Case" button on the `/cases` list page itself), or the equivalent button inside an existing case's workbench.
  2. A wizard modal opens automatically. Step through: **Welcome** → **Name** (enter a case name) → **Endpoint** (choose a search engine type — Solr / Elasticsearch / OpenSearch / Vectara / Static / SearchAPI / Algolia — enter/validate the endpoint URL, choose Proxy vs. CORS as appropriate, use the "ping it" test button) → remaining steps (field spec/finish, depending on engine chosen).
  3. Complete the wizard.
- **Expected:** A new case is created and you land in its Core Workbench (Part 4), on its first try, connected to the chosen search endpoint.
- **Edge cases:**
  - [ ] Leave the case name blank and try to proceed — should be blocked.
  - [ ] Enter an invalid/unreachable endpoint URL and use "ping it" — should surface a clear connection error, not a silent failure or crash.
  - [ ] Enter an HTTPS Quepid session pointed at an HTTP-only Solr endpoint — confirm the wizard surfaces the protocol-mismatch guidance (see also `bootstrap5-compat.css`/HTTPS notes for Solr JSONP in the project's engineering docs).
  - [ ] Create your very first-ever case on a brand-new account — confirm the product tour auto-starts shortly after the wizard completes.
  - [ ] Visit `/cases/new` directly (no query param needed — it always creates a brand-new case immediately and redirects to `/case/:id/try/1?showWizard=true`) — confirm the wizard auto-triggers. Note: reloading that redirected URL re-triggers the wizard again each time, since `showWizard=true` stays in the URL and is never stripped client-side (`app/assets/javascripts/controllers/wizardCtrl.js`) — this is current behavior, not a one-time trigger.

### 3.3 Import a case from JSON

- [ ] **Steps:**
  1. From `/cases`, click **Import Case from JSON**.
  2. Read the modal's explanation (best template is a previously exported case — see Part 6, Export).
  3. Choose a valid exported-case JSON file, click **Import**.
- **Expected:** A brand-new case is created from the file; spinner shows while processing; success navigates you to (or notifies you of) the new case.
- **Edge cases:**
  - [ ] Upload a non-JSON file, or JSON that doesn't validate as a proper case structure — should show a clear inline error in the modal (not a blank failure).
  - [ ] Upload a very large export — confirm reasonable behavior (progress indicator, no browser freeze).
  - [ ] Cancel mid-way through selecting a file — no partial case should be created.

### 3.4 Import snapshots from CSV

- [ ] **Steps:**
  1. From `/cases`, click **Import Snapshots from CSV**.
  2. Read the header requirement: `Snapshot Name,Snapshot Time,Case ID,Query Text,Doc ID,Doc Position`. Note the `Case ID` must already exist in Quepid.
  3. Prepare a CSV matching an existing case's ID (see the modal's sample data for format), upload it.
  4. Confirm the CSV preview panel shows before submitting.
  5. Click **Import**.
- **Expected:** Snapshot(s) get created against the referenced case, one snapshot per distinct `Snapshot Name`, viewable from that case's Compare Snapshots / History tools (Part 5).
- **Edge cases:**
  - [ ] Reference a `Case ID` that doesn't exist — should show a clear error, not silently create an orphaned snapshot.
  - [ ] Upload a CSV missing/misnamed headers — should be rejected with a clear message.
  - [ ] Upload a CSV with two different `Snapshot Name` values — confirm two separate snapshots are created correctly split by name.
  - [ ] Try submitting with no file chosen — the Import button should stay disabled until a file is selected (button starts `disabled`).

### 3.5 Archive / unarchive a case from the list

- [ ] **Steps:**
  1. On an active case's row, click the folder/archive icon in the rightmost column.
  2. Confirm the inline confirmation dialog ("Archive {case name}?").
  3. Confirm — case should disappear from the active list.
  4. Check the **Archived** filter checkbox, find the case, click its (now green) unarchive icon, confirm the dialog, confirm.
- **Expected:** Archiving moves the case out of the default list and flashes "Case #{name} archived."; unarchiving reverses this and flashes "Case #{name} unarchived." Archiving also reassigns case ownership to the archiving user.
- **Edge cases:**
  - [ ] Archive a case you only have team access to (not owned) — confirm this is allowed if you have permission, and observe that ownership transfers to you.
  - [ ] Attempt to archive/unarchive a case ID that no longer exists (e.g., two tabs, one deletes while the other archives) — should flash "Case not found." rather than error.

### 3.6 Share a case from the list

- [ ] **Steps:**
  1. Click the share icon on a case row.
  2. In the modal, select a team from "Select a team to share this case with", click **Share with team**.
  3. Confirm the team now appears under "Already shared with".
  4. Click the team under "Already shared with" to unshare, confirm.
- **Expected:** Sharing/unsharing updates immediately and the case's Teams column on the list updates on reload. Flash messages confirm each action; repeating an already-done action produces an informational alert instead of a duplicate/error.
- **Edge cases:**
  - [ ] Share with a team you don't belong to — shouldn't be possible (the dropdown should only list your own teams).
  - [ ] Try sharing a case you don't have access to (e.g., via a stale/tampered request) — should be blocked with "You do not have access to that case."

> Case-level actions reachable from *inside* a case (Clone, Delete/Archive/Delete-all-queries, Export, Judgements linkage) are covered in Part 6, since they live in the Core Workbench toolbar, not this list page.

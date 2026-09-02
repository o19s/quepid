# Part 7: Search Endpoints & Mapper Wizard

## Overview

A Search Endpoint tells Quepid how to reach a search engine or search API (Solr, Elasticsearch, OpenSearch, Vectara, Algolia, a static file, or a fully custom "Search API") so cases can query it and read back results. The Mapper Wizard is an AI-assisted tool for building the custom JavaScript needed to translate a bespoke Search API's responses into what Quepid expects.

**Where to find it:** Sidebar paper-plane icon, tooltip "Search Endpoints" → `/search_endpoints`.

## Test scenarios

### 7.1 Browse / filter the Search Endpoints list

- [ ] **Steps:**
  1. Go to Search Endpoints. Confirm columns: Name, Search Engine (with icon), Endpoint Url, and a per-row Share button.
  2. Use "Filter by name or url" text box.
  3. Toggle **Mine** (owned only).
  4. Toggle **Archived** to see archived endpoints.
  5. Use the **Team** dropdown filter.
- **Expected:** Filters combine correctly; only endpoints you own or have via a team appear at all (log in as an unrelated user to confirm isolation).
- **Edge cases:**
  - [ ] Zero endpoints (no filter applied) — confirm the empty-state message reads "Create your first search endpoint by clicking on the New Search Endpoint button above." (previously a copy-paste bug read "book" instead — fixed). Also confirm the message does **not** appear when a filter/search/team/archived selection simply matches zero endpoints (i.e. you still have endpoints overall, just none matching).
  - [ ] Try to open an endpoint you have no relationship to via a direct URL — should redirect with "Search Endpoint you are looking for either doesn't exist or you don't have permissions."

### 7.2 Create a Search Endpoint — one per engine type

Repeat for each: **Solr**, **Elasticsearch**, **OpenSearch**, **Vectara**, **Algolia**, **Static File**, **Search API**.

- [ ] **Steps:**
  1. Click **New Search Endpoint**.
  2. Fill Name (optional — falls back to a truncated "{Engine title} {url}" if blank).
  3. Choose the **Search Engine** type.
  4. Enter **Endpoint Url** (required).
  5. Choose **API Method** (GET / POST / JSONP / PUT).
  6. Optionally: **Custom Headers** (JSON), **Proxy requests** toggle, **Rate Limit**, **Basic Auth Credential** (`username:password`), **Options** (JSON), **Test Query**, **Mapper Code** (last two mainly relevant to Search API).
  7. Check any **Teams to Share this Endpoint With**.
  8. Submit.
- **Expected:** Redirects to the endpoint's Show page on success.
- **Edge cases (validation — test at least once each):**
  - [ ] Leave Search Engine / Endpoint Url / API Method blank — each is required.
  - [ ] Enter a JSON **array** (not object) in Custom Headers or Options — expect "must be a JSON object..." error.
  - [ ] Enter malformed JSON in either field — expect "must be valid JSON: ..." error.
  - [ ] Enter a Basic Auth Credential with no colon — expect "must be in username:password format" error.
  - [ ] Choose API Method = **JSONP** while **Proxy requests** is also enabled — expect an error ("cannot be JSONP when proxy_request is enabled").
  - [ ] If the environment requires proxy with basic auth, enter a Basic Auth Credential with Proxy off — expect a validation error.
  - [ ] With zero teams of your own, confirm the alert "Search Endpoints are meant to be shared with Teams..." with a **Create a Team** shortcut appears.

### 7.3 View / Edit a Search Endpoint

- [ ] **Steps:**
  1. Open an endpoint's Show page — confirm every field from creation displays correctly, including a **masked** Basic Auth Credential (`username:******`), Requests Per Minute ("0 means no throttling"), "Shared with Teams" (note: shows *all* teams sharing it, not just yours), "Used by Cases" (cases whose tries reference it), and Owner.
  2. Click **Edit**, change a field (e.g., Rate Limit), save.
  3. Edit again but leave the masked Basic Auth Credential field untouched, save.
- **Expected:** The real password is preserved when the masked value is resubmitted unchanged (it should *not* get overwritten with the literal masked string).
- **Edge cases:**
  - [ ] If archived, confirm the Show page shows "You must unarchive this search endpoint to use it with new cases."
  - [ ] Update team-sharing as a user who only has access to some of the endpoint's teams — confirm teams you can't see are preserved, not silently wiped (best tested with two accounts).

### 7.4 Clone a Search Endpoint

- [ ] **Steps:**
  1. Open an endpoint, click **Clone**.
  2. Confirm the form pre-fills with `Clone of {original name}` and all other fields copied.
  3. Edit the name (and any secrets, if desired) and submit.
- **Expected:** A brand-new endpoint is created, owned by you.
- **Edge cases:**
  - [ ] Confirm whether team-sharing carries over from the original to the clone (it may not, since HABTM associations aren't duplicated by a simple record copy) — note actual behavior either way.
  - [ ] If the original had a Basic Auth Credential, confirm the clone actually stores the real secret rather than the literal masked placeholder text.

### 7.5 Archive / Delete a Search Endpoint

- [ ] **Steps:**
  1. On the Edit page, click **Archive**, confirm the dialog.
  2. Confirm it disappears from the default (active) index list, and reappears when you check the **Archived** filter.
  3. On a different disposable endpoint, click **Delete** (danger), confirm.
- **Expected:** Archive sets `archived = true` with notice "Search Endpoint was archived."; Delete hard-removes the record with notice "Search Endpoint was deleted." Cases/tries that referenced the deleted endpoint should retain their historical data (the endpoint reference is nullified, not cascade-deleted).
- **Edge cases:**
  - [ ] Archive/unarchive the same endpoint from a **Team** page instead (if it's associated with that team) — confirm it works the same way and reassigns ownership to the acting user.
  - [ ] Try archiving via a team page for an endpoint **not** associated with that team — expect "...is not associated with this team."

### 7.6 Share / unshare a Search Endpoint

- [ ] **Steps:**
  1. Click the Share icon on an endpoint's row.
  2. Pick a team, click **Share with team** — confirm it appears under "Already shared with".
  3. Share the same endpoint with the same team again — expect an informational alert, not a duplicate.
  4. Unshare — confirm removal and the correct flash message; unshare again — expect "is not shared with" alert.
- **Edge cases:**
  - [ ] Attempt to share/unshare an endpoint you don't have access to — expect "You do not have access to that search endpoint."

### 7.7 Mapper Wizard — Step 1: Fetch Search Results

- [ ] **Steps:**
  1. From Search Endpoints, click **New SearchAPI with Mapper Wizard** (or, on an existing Search API endpoint, **Mapper Wizard**).
  2. Choose HTTP Method (GET/POST). Enter a Search URL and a Test Query (query-string params for GET, JSON body for POST — hint text should change with the method).
  3. Optionally expand "Advanced Options" and add a Basic Auth Credential and/or Custom HTTP Headers (JSON).
  4. Click **Fetch**.
- **Expected:** The raw HTML/JSON response is fetched server-side and displayed in a scrollable, expandable, copyable preview pane, with its length shown. Steps 2–3 reveal themselves once this succeeds.
- **Edge cases:**
  - [ ] Leave the URL blank — expect "URL is required".
  - [ ] Enter a non-http(s) URL — expect "Invalid URL format".
  - [ ] Point at an unreachable host — expect "Connection failed: ...".
  - [ ] Point at a very slow endpoint — expect a "Request timed out" message rather than hanging indefinitely.
  - [ ] Enter invalid JSON in Custom HTTP Headers — expect a clear validation error.

### 7.8 Mapper Wizard — Step 2: Generate Mappers with AI

- [ ] **Steps:**
  1. Enter an OpenAI API key (masked field; note text confirms it's used only for this request and not stored).
  2. Click **Generate Mappers with AI**.
- **Expected:** The two code editors in Step 3 (`numberOfResultsMapper`, `docsMapper`) populate with AI-generated JavaScript based on the fetched HTML/JSON.
- **Edge cases:**
  - [ ] Try this before completing Step 1 — expect "No HTML content. Fetch HTML first."
  - [ ] Leave the API key blank — expect "OpenAI API key required."
  - [ ] Use an invalid/revoked API key — expect "AI generation failed: ...".
  - [ ] If the model returns a response with no code block, confirm "No JavaScript code found in response" is shown rather than a silent failure.

### 7.9 Mapper Wizard — Step 3: Edit, Test & Refine

- [ ] **Steps:**
  1. For each of `numberOfResultsMapper` and `docsMapper`: hand-edit the code directly (this is a valid path even without ever using AI).
  2. Click **Test** on each — confirm the Test Result and any `console.log` output ("Console Logs") display.
  3. Click **Refine with AI**, provide feedback text, confirm the editor content updates with the AI's improved version.
- **Expected:** Test runs the code safely (sandboxed) against the previously fetched sample data and shows accurate results/errors; Refine incorporates your feedback into a revised version.
- **Edge cases:**
  - [ ] Test with empty/broken code — expect "Code is required" or a "JavaScript error: ..." message, not a crash.
  - [ ] Test before ever fetching HTML — expect "HTML content is required".
  - [ ] Refine without an API key — expect "API key required".
  - [ ] If editing an **existing** Search API endpoint's mapper code, confirm both editors pre-populate correctly from its stored `mapper_code`.

### 7.10 Mapper Wizard — Step 4: Save Search Endpoint

- [ ] **Steps:**
  1. Enter an Endpoint Name.
  2. Toggle "Proxy requests through Quepid" (defaults on for new endpoints).
  3. Check any teams to share with (auto-checked if you belong to exactly one team on a new endpoint).
  4. Click **Save Search Endpoint**.
- **Expected:** Redirects to the resulting endpoint's Show page; `search_engine` is forced to `searchapi`; the two mapper functions are combined into one `mapper_code` blob.
- **Edge cases:**
  - [ ] Save with invalid Custom Headers JSON or missing Endpoint Url — expect a clear validation error, not a silent failure.
  - [ ] Start a wizard session, fetch HTML, then navigate away **without saving**, and come back into the wizard — confirm you get a fresh session (previous fetch/draft state should NOT be resumed).
  - [ ] Enter the wizard via a URL referencing a `search_endpoint_id` that doesn't exist or you don't own — expect a redirect with "Search endpoint you are looking for either doesn't exist or you don't have permissions."
  - [ ] Enter a Basic Auth Credential in Step 1's Advanced Options, complete the wizard and save, then re-open the wizard for that same endpoint — confirm the credential is never displayed back to you in plaintext via the wizard (masked at most).

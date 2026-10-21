# Part 18: API Workflows

## Overview

The UI exercises many APIs, but it does not exercise every supported operation or payload. These checks cover direct clients using the routes in `config/routes.rb`, controller parameter declarations, and the in-app API Docs. Token generation/revocation is in 1.8/17.4, external scores in 17.5, public access in 13.4, and import/export formats in Parts 3, 6 and 10.

**Where to find it:** Avatar menu → **API Docs**, or a terminal HTTP client. Paths below are relative to the configured Quepid root; use `/api/...`, not an invented `/api/v1/...` prefix. Send `Accept: application/json`, `Content-Type: application/json` for JSON writes, and `Authorization: Bearer <token>` from a cookie-free client. Capture HTTP status, response body and persisted state, without recording token or secret values.

Use disposable resources and test accounts for writes, particularly deletion and scorer replacement. Record created IDs and remove fixtures afterward; revoke test tokens. A source audit establishes what to test, not a passing result. If a check fails, retain the failure and compare historical behavior before calling it a migration regression.

## Test scenarios

### 18.1 Resource lists, boolean filters and recent-case metadata

- [ ] **Steps:**
  1. Prepare active/archived owned cases and books, plus resources shared through a team. Compare `GET /api/cases`, `/api/books`, `/api/search_endpoints`, `/api/teams` and `/api/scorers` with the corresponding UI lists.
  2. On lists supporting `archived`, compare omitted, `false`, `0`, `true` and `1`. For books, combine `owned=true/false` with archived filtering: owned-only excludes books accessible solely through a team.
  3. Update `/api/cases/:case_id/metadata` with `{"metadata":{"last_viewed_at":"<current UTC timestamp>"}}`. Confirm 204, then verify recent-case ordering in the API dropdown and normal navbar after reload. Another user's recent ordering must not change.
  4. With suitable fixtures, compare case-list responses for an account with at most 30 involved cases and one with more than 30. Verify IDs, query counts and applicable latest scores against detail views.
- **Expected:** Lists honor access and boolean filters. The large-case-list response intentionally omits tries, teams and last-score detail; absence of those optional fields is distinct from a zero score or missing case. Metadata belongs to the current user.
- **Edge cases:** No resources, never-viewed cases, a case with a zero latest score, and an archived shared case (the archived case API list is owned-only). Confirm per-team and per-case endpoint lists use the relevant team relationships rather than every endpoint the user can access.

### 18.2 Try API: preview, clone and deletion

- [ ] **Steps:**
  1. On a disposable case, list tries and read one through `/api/cases/:case_id/tries/:try_number`. Use the case-local try number, not the database ID.
  2. POST `{"query_params":"<valid alternate query template>"}` to that try's `/preview_args`. Compare returned `args` with the engine/template and tuning variables; re-read the try and confirm no stored template, try count or latest-try number changed.
  3. POST a valid try payload to `/api/cases/:case_id/tries`, with `parent_try_number` identifying an existing parent. Confirm a new number and ancestry, then rename through the try update API and reload History.
  4. POST `/api/clone/cases/:case_id/tries/:try_number`. Verify the clone's endpoint, fields, row count, query template, escape setting and tuning variables against the source, and its parent link against analytics. The original must remain unchanged.
  5. Delete a non-final try; confirm 204, absence from the list and a correct `last_try_number`. Create another try and verify numbering and workbench boot. Delete down to one and attempt to delete the last: expect 400 with "Cannot delete the only try in a case."
- **Expected:** Preview is nonpersistent; create/clone produces a separate try and deletion preserves a usable case. A missing case-local try returns a JSON 404 rather than selecting a try from another case. Workbench checks also live in 4.17.
- **Edge cases:** Use a templated Elasticsearch/OpenSearch try for preview where available. Invalid settings must report an error; verify persisted state before retrying instead of assuming every failed API operation is atomic.

### 18.3 Query, options, notes, order and ratings API

- [ ] **Steps:**
  1. POST `/api/cases/:case_id/queries` with `query` containing `query_text`, `information_need`, `notes` and an `options` object. Repeat with surrounding whitespace in the same query text: confirm the existing query is returned rather than duplicated.
  2. GET/PUT that query's `/notes` and `/options` resources using the `query` envelope. Re-read the query list: values and the `display_order` array agree with the workbench after reload.
  3. PUT `/api/cases/:case_id/queries/:query_id/position` with an accessible sibling's ID in `after` and test `reverse` as supported by the ordering operation. Verify each query occurs once in returned/persisted order.
  4. PUT the singular `/ratings` resource with `{"rating":{"doc_id":"manual-doc","rating":0}}`. Repeat with a changed rating; confirm one stored rating for that document. DELETE with the same `rating.doc_id`, then repeat DELETE: both return 204.
  5. PUT the query's `/bulk/ratings` with `doc_ids` and a top-level numeric `rating`; verify only those documents changed. Clear them through DELETE and the legacy POST `/bulk/ratings/delete` alias.
  6. POST `/api/bulk/cases/:case_id/queries` with `{"queries":["manual one","manual two","manual one"]}`. Repeat: confirm existing exact query texts are reused, with one row per distinct text and a consistent returned order. This bulk operation does not share single-create trimming/model validation; inspect blank/whitespace input separately rather than assuming parity.
  7. Delete one query and verify its ratings disappear and the remaining query order is intact. On a separate disposable case, DELETE `/api/bulk/cases/:case_id/queries/delete`: confirm 204, all its queries/ratings removed and the case itself retained.
- **Expected:** Document IDs remain intact, including punctuation and leading zeros; a zero rating is retained. Notes/options persist independently. Repeated single-rating deletion is a no-op, not a 500. Linked-book write behavior is checked in 6.6/12.8.
- **Edge cases:** Missing query, blank query text, a query ID from another case and an absent rating. Record validation responses and check saved state after rejected payloads; bulk rating writes must be inspected row by row rather than assumed transactional.

### 18.4 Book pairs and judgement API lifecycle

- [ ] **Steps:**
  1. POST `/api/books/:book_id/query_doc_pairs` with a `query_doc_pair` containing query text, document ID, position, information need, notes, Options as an object and Document Fields as serialized JSON. Read/list it, then POST the same query/document again with changed fields: verify the existing pair is updated.
  2. PUT a pair update and re-read it through both API and the detail page (11.9). Verify existing judgements remain attached.
  3. POST `/api/books/:book_id/judgements` with `judgement` containing pair ID, an identified test judge's `user_id`, numeric rating and explanation. Repeat for that same judge/pair: verify one updated judgement. POST two judgements omitting `user_id`: confirm two separate anonymous rows.
  4. GET `/api/books/:book_id/query_doc_pairs/to_be_judged/:judge_id` before and after that judge exhausts eligible pairs. Verify a pair response or empty 204 respectively, following the depth/three-judgement rules in 11.10; selection itself must not create a judgement.
  5. Read and update an identified judgement, then delete it: confirm 204 and disappearance from the audit view. Delete a pair through the API: its own judgements disappear while other pairs and judgements remain.
- **Expected:** Pair upsert uses query/document identity within the book; identified judgement upsert uses pair/user identity. Anonymous contributions stay distinct. Direct pair deletion has no browser confirmation, so use only the recorded disposable pair ID.
- **Edge cases:** Missing book/pair/judgement IDs and an existing pair/judgement ID belonging to another book must not expose or mutate the foreign record. For rejected create/update payloads, inspect both response and stored rows, including whether an initial pair was created before validation failed. JSON/CSV export and anonymous re-import behavior remain in 10.7–10.9.

### 18.5 Team API membership, sharing and deletion

- [ ] **Steps:**
  1. Create `/api/teams` with `{"team":{"name":"<unique test name>"}}`, list/read it, and rename it through update. Confirm the creator is a member and the UI shows the same team.
  2. Add an existing test user via POST `/api/teams/:team_id/members` using top-level `id` as their numeric ID, then repeat with their mixed-case email. Confirm one membership. Remove using the corresponding DELETE member URL and verify loss of team-only access.
  3. Share a disposable case and custom scorer through `/api/teams/:team_id/cases` and `/scorers`, using top-level `id`. Repeat share/unshare and check no duplicate associations. Read team books and search endpoints as the second member.
  4. Delete the disposable team through `/api/teams/:team_id`; confirm 204 and absence from lists. The owned case, book, endpoint, scorer and member accounts survive, with their team associations removed.
- **Expected:** API operations and Rails team pages agree. Team deletion removes associations, not the associated resources. Missing members return a useful error when added; repeated removal of an absent association is harmless.
- **Edge cases:** Foreign team IDs and inaccessible case/scorer IDs must not grant access. API invitations use `/members/invite` with `id` as email; test delivery/acceptance with 1.5/9.3 and confirm "Signups are disabled!" with 404 when invitations are disabled. Do not send invitations to real addresses for this check.

### 18.6 Background evaluation and explicit book synchronization API

- [ ] **Steps:**
  1. POST `/api/cases/:case_id/run_evaluation` with a valid `try_number`, then without it. Verify 200 contains the requested try number (latest when omitted), case ID and queued message; wait for job completion and inspect scores/status (17.2).
  2. Repeat with a nonexistent try: expect 422 and no evaluation job for that invalid try.
  3. Using a disposable linked book/case, PUT `/api/books/:book_id/cases/:case_id/refresh` with `create_missing_queries` and `process_in_background` false. Verify returned creation counts against actual queries/ratings.
  4. Repeat with background processing true: verify the response identifies background processing and eventual stored state after completion; immediate zero counts are not final work totals. Test false/true as JSON booleans and form-style strings.
  5. PUT `/api/books/:book_id/populate` with a valid case/pair payload matching the case-to-book sync request. While its populate job is pending, repeat: expect 409 rather than success for discarded work. After completion, retry and verify pairs are not duplicated.
- **Expected:** Requests identify the intended case/try, synchronous counts describe completed work and asynchronous acknowledgement does not claim completion. Populate conflicts remain retryable. Rating calculations and missing-query metadata are checked in 10.12.
- **Edge cases:** Empty case/book, missing case/try, unavailable search engine and failed background job. Record job failure separately from HTTP acknowledgement, and verify unrelated cases were not refreshed.

### 18.7 Configuration APIs and scorer replacement on deletion

- [ ] **Steps:**
  1. Create/read/update a disposable search endpoint through `/api/search_endpoints`. Exercise required fields, malformed Custom Headers, Options and proxy/JSONP validation from 7.2. Re-submit an unchanged masked credential and verify the real connection still works, without capturing its secret. Archive/unarchive and compare active/archived lists, then delete the endpoint and verify historical tries survive.
  2. Create/update a book through `/api/books` with a valid accessible `scorer_id`; verify its scale/labels and current user's ownership. Exercise archived and implicit-judgement flags; reject a foreign `team_id` without creating the book. Delete through the API and verify the same child-data cleanup as 10.11.
  3. Create/read/update a disposable custom scorer through `/api/scorers`, including code, scale and labels. As a teammate, attempt to edit the shared scorer: expect 403 "Cannot edit a scorer you do not own". Exercise communal-only configuration with 8.1.
  4. Set the scorer as a disposable user's default and a disposable case's scorer. DELETE without `force`: expect 400 with the dependency explanation and no deletion. Repeat with `force=true` and a valid `replacement_scorer_id`: confirm 204 and both defaults now use that replacement. On a separate fixture omit replacement: the system default is used.
- **Expected:** Direct JSON writes receive validation errors as JSON rather than HTML redirects. Forced scorer replacement updates the dependent users/cases; historical scores and snapshots survive. UI validation and API validation must be tested separately because their payloads and permitted fields differ.
- **Edge cases:** Private/inaccessible IDs, invalid scale types, and `force=false`/`0` must not silently perform forced replacement. Inspect all fields after failed updates: an error response alone does not prove no partial change. Use valid disposable replacements; record unsupported replacement IDs as a separate failure check without modifying shared defaults.

### 18.8 User lookup and API profile preferences

- [ ] **Steps:**
  1. GET `/api/users/current` with a disposable user's token; confirm the identity and counts belong to that user.
  2. GET `/api/users?prefix=<test email/name prefix>` using mixed case. Confirm prefix matching, no more than eight results, and an empty array when the prefix is omitted or matches nothing.
  3. Read that test user through `/api/users/:id`, using their numeric ID and then mixed-case email. Confirm both resolve to the same user.
  4. Update that user's `company` and `default_scorer_id` using the `user` envelope. Re-read through API and Profile/Scorers; verify the stored preferences. Set `default_scorer_id` to `0` and confirm the system default is restored.
  5. On the same disposable account, set `completed_case_wizard` false/true and check the wizard's automatic tour eligibility (3.2). Restore the original preference afterward.
- **Expected:** Lookup behavior agrees across numeric IDs and normalized emails; supported preferences persist. Missing users return JSON 404. Lookup responses must not contain password hashes, reset/invitation tokens or personal access tokens.
- **Edge cases:** Use an inaccessible scorer and malformed update body; record the response and persisted default rather than assuming the Rails default-scorer form and API enforce identical validation. Restrict preference writes to the disposable user's own record.

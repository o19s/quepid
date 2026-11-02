# After AngularJS removal

Restructuring, consolidation and deliberate departures from Legacy that were held
back while the AngularJS-removal branch was under a parity-only scope freeze. The
branch landed on `main` in `8d4fc1cd` (#1842), so these are now ordinary PRs.
`[PREEXISTING]` bugs, security and backend fixes are here too, from the
[pre-existing section](#preexisting-found-during-parity-testing) onwards. Open
parity decisions stay in [todo.md](todo.md).

Entries use the same provenance markers and `P I C` ratings as
[todo.md](todo.md). When something is done, remove its entry.

## Legacy behaviour kept only for parity

The user chose to restore these to Legacy (`8ceb99e9`) while parity gated the
branch. Revisit them as product decisions.

### [MIGRATION-FOLLOWUP] P3 I1 C1 — Case wizard Search API query pattern

Restored to Legacy on 2026-10-17: the pattern is set on the Query step and starts
as the endpoint's saved test query (`wizard_controller.js#selectEndpoint`,
`_wizard_modal.html.erb`).

1. **Warning on arrival.** A test query rarely contains `#$query##`, so the box
   nearly always opens with "Your query pattern should include `#$query##`".
   Seeding it with a template (`q=#$query##` for GET, `{ "query": "#$query##" }`
   otherwise) would avoid that.
2. **Two inputs for one setting.** A one-line input for GET and a textarea
   otherwise, both bound to `queryParams`, need the `api-get`/`api-body`
   conditions and a plural `queryPattern` target. One textarea would do.

### [MIGRATION-FOLLOWUP] P3 I0 C1 — Maybe: annotations reuse a stale recorded score

Kept as Legacy on 2026-10-19. When no query scores in the current run (for
example every search fails because the endpoint is down), Create falls back to
the case's last recorded score and saves the annotation with it
(`annotations_controller.js#scorePayload`, `data-annotations-last-score-value`
in `core/index.html.erb`). The annotation then shows a score that does not
match what the user is looking at. Refusing Create until a query scores in the
current run would be more accurate. A case that has never scored a query is
refused either way.

### [MIGRATION-FOLLOWUP] P3 I0 C2 — Compare-snapshots columns are too narrow for result text

Kept as Legacy on 2026-10-20. With three or more comparison columns at a 1200px
window, each column is about 285px wide and the Matches text wraps one letter per
line ("n/o/e/x/p/l/a/i/n"), and long titles and fields wrap to a few words per
line. Replayed on Legacy (:3001, case 4) and Current (:3000): both give the same
equal-width columns, so this is not a migration regression. Current also allows
five snapshots where Legacy allowed three, so the squeeze reaches six columns
(`.diff-column` in `qscore.css`, cells built in `search_results_controller.js`).
Options: give the Matches chart a minimum width, hide it in comparison columns, or
let the comparison scroll sideways past a minimum column width.

### [MIGRATION-FOLLOWUP] P3 I0 C1 — Make the no-cases message archive-aware

`CoreController#set_case_or_bootstrap` redirects to `/cases` with "You don't have
any Cases created in Quepid…" whenever the user has no non-archived case. A user
whose cases are all archived gets the same message, although they do have cases.
Legacy behaved the same way (its client flashed the text when `caseNo` was 0), so
this is parity. A better message would point at the Archived filter when
`cases_involved_with.archived` is not empty.

## Frontend consolidation

Moved from [todo.md](todo.md) on 2026-10-19. These change or restructure the
Stimulus frontend.

### [MIGRATION-FOLLOWUP] P3 I2 C3 — Server-rendered modal lists

See [Persisted case UI](../app_structure.md#persisted-case-ui) for the accepted
HTML-endpoint boundary.

`diff_core` (snapshot selects) and `export_case_core` still build lists from JSON
in JS. They could become partials loaded through lazy
`<turbo-frame src=...>`, like `DropdownController#cases_core`, and modal form
posts could be answered with Turbo Streams.

Case Frames/Streams already work with Drive disabled. Keep the workspace's
full-document navigation boundary and prove annotation list and edit-modal parity
before expanding the conversion.

### [PREEXISTING] P3 I1 C2 — Rating-color consistency

- `scorer_runtime.js#scaleToColors`: an hsl gradient across the scorer's scale.
- `scoring.js`: a fixed 1–10 palette (`DEFAULT_RATING_SCALE`), used when a
  result has no scale.
- `JudgementHelper`: `calculate_hsl_color` ports the gradient (but rounds the
  hue), and `calculate_button_class` sets a `btn-*` color class on the same
  button.

**Fix:** one gradient rule; render the Rails judging buttons from the same scale
colors.

Visual consistency only: Rails currently rounds hues, and changing `btn-*`
classes changes appearance. Cross-language sharing is worthwhile only if it
reduces complexity; preserve scale semantics.

### [MIGRATION-FOLLOWUP] P3 I2 C3 — Search-engine rule boundaries

`utils/search_engines.js` is meant to be the one place for engine checks, but
most of the rules are written out somewhere else:

- **"Store document fields in the snapshot"** (`static || !supportsLookupById`)
  is written three times: `snapshot_bridge_controller.js:57`,
  `snapshot_hydration.js:11` and `snapshot_hydration.js:80`.
- **`["solr", "es", "os"]`** is still hardcoded three times, with different
  meanings: `query_runtime.js:363`, `settings_catalog_runtime.js:182`
  (`supportsEscapeQuery`) and `live_query_runtime_owner.js:689` (with
  `"searchapi"` added).
- **`usesJsonQueryParams`** lives in `search_endpoint_runtime.js:40`, and
  `tune_relevance_controller.js:405` adds its own Search API "starts with `{`"
  exception on top.
- **Too many layers:** pure checks pass through two or three runtime layers.
  `isEsLikeEngine` becomes `isEsOrOsEngine` and then `isEsOrOs`, which is wired
  up twice in `core_workspace_runtime.js` (lines 176 and 228) and once more in
  `live_query_runtime_owner.js:400`.
- **Engine names:** `browse_query.js:1` has its own engine display name instead
  of using `searchEngineLabel`.

**Defer the full consolidation.** Safe fragments may include reusing display
labels and removing redundant pass-throughs while preserving the exact
predicate. Do not merge engine sets with different meanings or alter lookup,
escaping, query DSL, or snapshot-field rules.

### [MIGRATION-FOLLOWUP] P3 I1 C3 — Refresh-ratings orchestration

Current thresholds, reloads, redirects and errors are documented in
[Refresh-ratings orchestration](../core_ui_implementation_reference.md#refresh-ratings-orchestration).

**Defer.** These flows alter scoring inputs and differ in stale-response
handling, reload completion, errors, and redirects. Extracting only the threshold
and PUT offers little reduction. Keep the existing reload event contracts.

### [MIGRATION-FOLLOWUP] P3 I1 C3 — Snapshot CSV import contracts

Caller-specific failure policies are documented in
[Snapshot CSV import contracts](../core_ui_implementation_reference.md#snapshot-csv-import-contracts).

Each one also builds its import URL differently.

"Required headers present, no parse errors, not empty" validation exists three
times with different messages (the third is `wizard_contracts.js#validateStaticHeaders`).

**Defer upload-loop consolidation.** Preserve each caller's continue/stop
policy, payloads, order, and error messages. Choosing one failure or validation
policy is a behavior change.

### [MIGRATION-FOLLOWUP] P3 I1 C2 — Server-owned URLs and template replacement

Eleven controllers fill server-passed URL templates with
`.replaceAll("__CASE_ID__", …)` and similar placeholders. Some wrap the value in `String()`, none
encode it, and nothing catches a placeholder that was never filled. Separately,
about 80 call sites build `api/...` paths on the client, which the
DEVELOPER_GUIDE discourages.

**Defer as proposed.** Encoding values and throwing for unresolved placeholders
add behavior. A replacement-only helper could preserve the contract but offers
limited LOC savings. [MIGRATION-FOLLOWUP] P3 I1 C3 — Moving client URLs to Rails ownership is a separate task.

### [MIGRATION-FOLLOWUP] P3 I0 C3 — Request-generation abstractions

There are seven versions: `qscore_case_controller` (`diffRefreshGeneration`),
`judgements_core_controller` (`openGeneration`), `query_collection_store`
(`_searchGeneration`), `live_query_collection`, `case_runtime`, `query_runtime`
(`ratingsGeneration`), and the `AbortController` in
`team_member_autocomplete_controller`.

**Defer.** These counters govern request races and invalidation; AbortController
also cancels work. A shared token helper saves few lines and must not replace
caller-specific cancellation or stale-response rules.


### [MIGRATION-FOLLOWUP] P3 I0 C2 — Success-and-redirect helpers

Current delays are documented in
[Success-and-redirect timing](../core_ui_implementation_reference.md#success-and-redirect-timing).

**Defer.** One delay changes the current contract. A helper preserving each
caller's delay, URL, notice, and navigation method saves very little.

### [MIGRATION-FOLLOWUP] P3 I1 C2 — Busy-state helpers

Existing implementations are documented in
[Busy-state contracts](../core_ui_implementation_reference.md#busy-state-contracts).

**Defer a universal helper.** Disabled controls, spinner classes, visibility,
and HTML replacement have different contracts. Consolidate only demonstrably
identical operations; leave modal-level progress bars and distinct state
transitions alone.

### [MIGRATION-FOLLOWUP] P2 I1 C2 — Choose explicit error-message policies

`utils/error_message.js:8` provides `errorMessage`; `:27` provides
`serverMessage`. `query_lifecycle_controller.js:60` uses the former, whereas
`share_case_core_controller.js:295,336`, `judgements_core_controller.js:295`,
and `import_ratings_core_controller.js:220` use `error.message || fallback`.
Mapper Wizard interpolates `error.message` directly in several catch blocks
(`mapper_wizard_controller.js:149,205,366,431`). Frog Report additionally
rewrites an `HttpError`'s message before displaying it
(`frog_report_controller.js:206`).

**Fix direction:** apply the [Error-message policies](../../DEVELOPER_GUIDE.md#error-message-policies)
explicitly at each boundary, with focused tests for intentional changes. Preserve
the [Import-ratings error precedence](../core_ui_implementation_reference.md#import-ratings-error-precedence).

### Review boundaries

See [Scope and change control](../../AGENTS.md#scope-and-change-control)
and [Direct Bootstrap modal calls](../core_ui_implementation_reference.md#direct-bootstrap-modal-calls).

### [MIGRATION-FOLLOWUP] P3 I2 C3 — Rated-document lookup duplication

**Decision needed:** Decide whether the two rated-document surfaces should share ranking and rating-persistence semantics. Equivalent-branch cleanup can proceed separately.

Current search and write strategies are documented in
[Rated-document search and write paths](../core_ui_implementation_reference.md#rated-document-search-and-write-paths).

**Decide first:** should "Show only rated" and the Document Finder's rated list
rank the same way? Then use one rated-search builder for all three paths.

[MIGRATION-FOLLOWUP] P3 I1 C2 — Sharing the equivalent `resetToRated`/default-list pagination branches can
preserve behavior. Merging all builders or rating-write paths needs the ranking
and persistence decisions first.

## Developer experience

Moved from todo.md's Developer Experience Review on 2026-10-19.

### [MIGRATION-FOLLOWUP] P3 I2 C3 — 5. Clarify frontend ownership and delivery boundaries

Retain the explicit state owners described in [Application structure](../app_structure.md#core-frontend-app).

- [MIGRATION-FOLLOWUP] P3 I1 C2 — Group coherent subsystems in `utils/` when their boundaries are understood. Search, scoring, snapshots, case state, Bootstrap and DOM helpers currently share that directory; imposing `domain/`, `ui/` and `net/` everywhere is not a prerequisite.
- Moving `utils/` DOM lifecycles into controllers is done (`f4226b05`), and global event names have shared constants (`utils/core_events.js`; see the [core event bus](../../DEVELOPER_GUIDE.md#core-event-bus)). Preserve each surface's own lifecycle. See [Persisted case UI](../app_structure.md#persisted-case-ui) for rendering and background-update ownership.
- Follow [JavaScript delivery](../js_pipeline.md) and [JavaScript tooling](../js_tooling.md) when adding modules; retain the core/application CSS outputs and compatibility layers.

Follow [Scope and change control](../../AGENTS.md#scope-and-change-control) for module moves. Moving root-level `build_css.js` or `audit_css.js` alone has modest payoff and affects build/lint paths; prioritize command drift and CI coverage.

### [MIGRATION-FOLLOWUP] P3 I0 C2 — Patch upstream Stimulus LSP controller detection

Submit an upstream [stimulus-parser](https://github.com/marcoroth/stimulus-parser)
patch to resolve Rails importmap paths (`controllers/...`) and mixin inheritance
such as `extends withStatusMessages(Controller)` and
`extends withDestructiveForm(CoreModalControllerBase)`. Verify controller
discovery, inherited actions, targets and values against Quepid's shared bases
and ordinary `extends Controller` classes. Stimulus LSP 1.1.2's bundled parser
misses these controllers; `.stimulus-lsp/config.json` temporarily suppresses
`stimulus.controller.invalid` for the affected identifiers. Remove those ignores
once an extension release detects them correctly.

Also patch [Stimulus LSP](https://github.com/marcoroth/stimulus-lsp) to exclude
Bootstrap's `data-bs-target` from Stimulus target validation; it currently
reports a nonexistent `bs` controller. Verify Bootstrap targets produce no
Stimulus diagnostics while real Stimulus target validation still works, then
remove the temporary `data-bs-target` entry from `ignoredAttributes` in the
same config.

## [PREEXISTING] Found during parity testing

Moved from [todo.md](todo.md) on 2026-10-19, with every other `[PREEXISTING]`
entry below. These predate the AngularJS removal.

### [PREEXISTING] P2 I1 C2 — splainer-search 3.x copies every result doc's text several times

splainer-search 3.x deep-clones response docs with `structuredClone`
(`utilsSvc.deepClone`), which copies strings; 2.x's `angular.copy` shared them.
`DocFactory` clones each doc onto itself (`copyOnto`), `origin()` clones it again,
and `subsList` holds further copies, so each doc's text is held three to four
times. `getDocExplain` also calls `origin()` twice just to check for an `id`. On
a 400-query `large_data` case that is ~40 MB of the 54 MB retained heap. Fix it
in splainer-search (share strings, or don't clone read-only response data), then
tighten `PER_QUERY_BUDGET_KB` in `test/playwright/large_case.perf.spec.ts` and
measure with `yarn test:perf`.

### [PREEXISTING] P2 I0 C1 — "Show only rated" fires every rated-docs request at once

`toggleShowOnlyRated` (`live_query_runtime_owner.js`) calls `refreshRatedDocs`
for every query that isn't ready, outside `pAll`, ignoring both the concurrency
of 10 and the try's `requestsPerMinute`. On a 5000-query case that is 5000
simultaneous requests to the user's engine. Legacy's `queriesSvc` did the same.
Route the refreshes through `pAll`.

### [PREEXISTING] P2 I0 C2 — One failed search skips scoring the whole case

`pAll` (`utils/query_service.js`) runs the rest of the queue after a failure, then
rejects, so `runSearchAll` skips `scoreAll` and book sync: a single 429 near the
end of a large run loses the case score. Legacy's `queriesSvc.pAll` did the
same. Score the queries that succeeded and report the failures.

### [MIGRATION-FOLLOWUP] P3 I1 C2 — Further large-case load cost

From profiling `yarn test:perf` (`PERF_PROFILE=1`) after the large-case fix:
each query is scored as it finishes and again by `scoreAll`; `scorer_runtime.js`
compiles the scorer with `new Function` on every call; the query list re-sorts
every query each animation frame while results arrive, calling `localeCompare`
with options per comparison (cache one `Intl.Collator`); and `ratedSearcher` is
built for every query although few use it. Batch runs could also request
`debug=results` without `echoParams`, re-running with full debug only when the
query-details modal opens, but that changes what users see in dev tools, so it
needs a product decision.

**Garbage per animation frame.** Compared on 2026-10-24 with main's Angular page
(`a31569e4`, :3003) using two interleaved 5000-query runs each, from one host
Chromium, with a temporary copy of `large_case.perf.spec.ts` whose expand and
explain selectors match both pages (the committed spec can't run on main's page).
The branch matched main on load time (~20 s) and retained heap (~533 MB against
~536 MB) and used a quarter of its script time (~3 s against ~12 s). It peaked at
~975 MB against main's ~630 MB, but at 622 MB in the dev container, so the raw
peak depends on when Chromium collects. A temporary diagnostic that forced GC
before each sample, as `PERF_LIVE_PEAK=1` now does, found both peak at their
retained size (520 MB against 536 MB), so the extra peak is uncollected garbage,
not held data. Main allocates
~32 GB during the load, mostly tiny digest objects (`getComparisonObject`) that
die young. The branch allocates ~4 GB, but as 5000-element arrays and per-query
snapshots that survive into the old generation until a major GC. Each query-list
render, scheduled every frame while results arrive, makes them:

- `renderQueryCollection` calls `orderedLiveQueries` twice, and each call builds a
  `querySnapshot` for every query through `store.query()` (~890 MB). Only one page
  is shown, and the first call is used only for its length. Snapshot just the
  visible page when no filter or sort needs every query, and count with
  `store.size`.
- `orderedQueryIds` (`query_collection_store.js`) builds a new `Set` of every key
  and a filtered copy of the display order on each call (~885 MB). Cache it until
  queries are added, removed or moved.
- `getListState` (`live_query_runtime_owner.js`) runs `hasPendingQueries`,
  `settledQueryCount` and `queryCount`, each turning the whole query map into an
  object and then an array through `liveQueries()` (~500 MB).
  `add_query_controller` calls it too. Iterate the store's map directly, or keep
  the counts as queries settle.

### [PREEXISTING] P1 I0 C2 — Align RRE export and import formats

Scenario 6.2 accepts the exported `doc_id: {gain: rating}` format but the importer
interprets it as `rating: [doc_ids]`, creating malformed document IDs and ratings.
Both implementations already exist at Angular baseline `8ceb99e9`; this is source
evidence, not a historical live replay. Define supported RRE variants and verify
export/import round trips before changing the parser.

### [PREEXISTING] P1 I0 C2 — Preserve proxy transport during Solr result paging

Scenario 4.22: the first proxied search succeeds, but paging drops `proxyUrl`
and requests the engine directly, failing CORS. Current splainer-search3.3.0
`buildPagerOptions` and installed historical2.36.2 `pager()` both omit the proxy
configuration; provenance is dependency-source comparison, not a new historical
live replay. Fix in the shared search dependency/integration and verify real
proxied paging, unique appended results, retained ratings and failed-page retry.
Browser CORS overrides are evidence fixtures, not a fix. Deferred from the
migration-only parity patch.

### [PREEXISTING] P1 I0 C2 — Resolve stored mapper input compatibility - EP review needed

Manual scenario 7.9: stored `JSON.parse(data)` mappers work on historical
`8ceb99e9` but fail on current because `lib/v8_mapper_executor.rb` pre-parses JSON
into an object. Upstream `92519d55` changed that contract before the Stimulus
mapper migration. Define a compatible input contract and verify both stored
string-based and object-based mappers; an adaptive mapper workaround does not
resolve existing saved mapper failures.

### [PREEXISTING] P1 I0 C3 — Scorer sandboxing - LATER

**Decision needed:** Agree on the trust model for shared scorer code and the isolation guarantees required while preserving supported scorer behavior.

Client scorer code still executes through `new Function()`; evaluate a Web
Worker or equivalent browser isolation. The batch path already uses the shared
scorer runtime through V8/MiniRacer; keep browser and batch scorer behavior
aligned when adding isolation.

### [PREEXISTING] P3 I0 C1 — Wizard Finish reuses archived search endpoints

Scenario 7.13: new-engine Finish attached an archived endpoint with dummy
credentials, so searches failed. `SearchEndpoint.find_or_initialize_for_user`
(from #1705, `b1a9d26b`) doesn't exclude archived rows. Same on `main` with the
required-proxy flag on or off. Fix: add `.not_archived` to the lookup and cover
it with a controller test. Keep reusing credentialed endpoints when Finish sends
a blank credential: hidden-credential deployments rely on it.

## [PREEXISTING] Security

### [PREEXISTING] P0 I0 C3 — User API IDOR and cross-account write path

**Decision needed:** Confirm whether cross-user lookup is an intended directory contract, who may use it, and which fields it may expose; the existing test explicitly permits it.

**Location:** `app/controllers/api/v1/users_controller.rb:24-51`, `test/controllers/api/v1/users_controller_test.rb:30-39`

`set_user` looks up any user by email or numeric ID without scoping to `current_user`, and `update` permits `company`, `completed_case_wizard`, and `default_scorer_id`. The existing test codifies one signed-in user fetching another's record. Unless this is an intentional admin directory, it exposes account metadata and allows cross-account changes.

**Fix direction:** Scope ordinary requests to `current_user`. If admin lookup is needed, make it a separate admin-only endpoint with its own serializer and authorization test.

---

### [PREEXISTING] P1 I0 C2 — Personal access tokens are stored and shown in usable form

**Location:** `app/controllers/concerns/api_key_authenticatable.rb:31`, `app/views/profiles/_personal_access_tokens.html.erb:12,27`, `app/controllers/api_keys_controller.rb#create`, `app/models/api_key.rb`, `lib/tasks/user.thor:131`

`ApiKey` HMACs the token into `token_digest` on create, but the raw `SecureRandom.hex` token is then discarded, and the authenticator matches the bearer value directly with `find_by token_digest: http_token`. The digest is therefore the credential: anyone who can read `api_keys` (database, backup, replica) can use every token, and the Profile page shows each key's digest on every visit, not once at creation. The model's own `authenticate_by_token!`, which hashes the bearer first, is unused. Found in manual pass 2026-10-28 (17.4: "No token is exposed in the response body or page markup").

Hashing was meant to protect stored tokens from the start. In the review of #756 (`a4d48f8c`, 2023-06-15), @mkr commented on the migration: "Should we use store hashed tokens right from the beginning. Does not seem to be too much effort looking at https://keygen.sh/blog/how-to-implement-api-key-authentication-in-rails-without-devise/." Eric Pugh replied "Ugh.. Okay @mkr I will do the right thing..... SIgh" and added the HMAC in the model, but the lookup and the Profile display kept using the stored value. Neither has changed since.

**Fix direction:** Authenticate with `HMAC(bearer)`. A one-time data migration that sets each `token_digest` to `HMAC(token_digest)` keeps every token users and scripts hold today working (irreversible). Show a new token only once after creation, list keys on Profile without the secret, and have the thor task print the raw token. Update `api_workflows_test.rb` and `api/api_controller_test.rb`, which send `token_digest` as the bearer, and the 32-character examples in `docs/operating_documentation.md`.

---

### [PREEXISTING] P1 I0 C2 — Outbound HTTPS certificate verification is disabled globally

**Location:** `app/services/http_client_service.rb:91-101`

`HttpClientService` sets `faraday.ssl.verify = false` for every request (proxy, mapper wizard, downloads, search calls), permitting man-in-the-middle interception of credentials and API keys.

**Fix direction:** Remove the override. If development needs a custom CA, use a CA bundle or an explicit development-only opt-in. Add a test that production clients verify certificates.

---

### [PREEXISTING] P1 I0 C3 — Proxy SSRF controls are incomplete

**Location:** `app/controllers/proxy_controller.rb:105-120`, `app/services/http_client_service.rb:91-99`

The proxy validates the initial DNS resolution and blocks private ranges, but Faraday resolves the host again when making the request (DNS-rebinding window), and redirect following means an allowed public URL can redirect to an internal address without revalidation.

**Fix direction:** Use a single validated connection target, disable redirects by default, or validate each redirect target. Tests: redirect-to-private-address, IPv6/link-local, rebinding, non-default ports, credential forwarding.

The same block (`634aa4a5`, from `main`) also stops proxied search to engines on internal networks: localhost, RFC1918 and Docker-network hosts are rejected, and there is no allow-list. Legacy (`8ceb99e9`) proxied to them. A deployment that sets `REQUIRE_PROXY_FOR_ALL_SEARCH_ENDPOINTS` cannot search an internal engine at all.

**Decision needed:** Whether internal engines must stay reachable through the proxy. If they must, add an operator-configured allow-list of hosts or CIDR ranges, with a test that a listed private address passes and an unlisted one is still blocked.

---

### [PREEXISTING] P1 I0 C1 — `SEARCH_ENDPOINT_VIEWS_ADMIN_ONLY` is ignored

**Location:** `app/controllers/search_endpoints_controller.rb`, `config/initializers/customize_quepid.rb:130`

`32b427b6` (#1592) added `require_admin_if_restricted` so that, with `SEARCH_ENDPOINT_VIEWS_ADMIN_ONLY=true`, only administrators can manage search endpoints. `dc2f46af` ("Basic Auth Credentials are encrypted", on `main`) removed the `before_action` and the method; nothing else in that commit relates to it. The setting is still read and is still documented in `QUEPID_FEATURES.md`, so a deployment that enables it silently lets every user manage endpoints.

**Fix direction:** Restore the guard with a controller test for both values of the setting. If the removal was intended, delete the setting and its documentation instead.

---

### [PREEXISTING] P1 I0 C2 — Team member suggestions expose other accounts

**Location:** `app/controllers/teams_controller.rb:268-366` (`suggest_members`)

From `e52cec3a` (#1642, on `main`). A full email address matches any registered user, regardless of team or domain, and returns their name, email and avatar, so any signed-in team member can test whether an address has an account. Prefix and name matches are limited to shared teams or the caller's email domain; for a public domain such as `gmail.com` that is every user on that domain. Each request also logs about a dozen timing lines at `info` and returns an `X-Performance-Timing` header.

**Decision needed:** What the add-member form may reveal about users outside the caller's teams.

**Fix direction:** Limit suggestions to users who share a team with the caller (and, if wanted, a configured organisation domain rather than any domain). Let a full email address be submitted without echoing account details back. Remove the timing logs and header. Add tests for an outside exact-email match and a public-domain prefix match.

---

### [PREEXISTING] P1 I0 C3 — Static Active Record encryption keys committed as production fallbacks

**Location:** `config/application.rb:58-60`

Deployments that omit the env vars use publicly known keys, so encrypted fields are recoverable by anyone with the database.

**Fix direction:** Fail fast in production when keys are absent; keep generated dev/test defaults out of production config; document key rotation and backup.

---

### [PREEXISTING] P1 I0 C3 — Proxy CSRF bypass and permissive CORS / Action Cable origins

**Decision needed:** Agree on supported cross-origin clients, trusted deployment origins, proxy authentication and rate limits before restricting the existing interfaces.

**Location:** `app/controllers/proxy_controller.rb:5-8`, `config/initializers/cors.rb:6-17`, `config/environments/production.rb:41-50`

`fetch` skips CSRF verification (`skip_before_action :verify_authenticity_token`) for GET and POST while requiring login, so cross-site POSTs from an authenticated session remain possible. Production also allows every CORS origin, disables Action Cable request forgery protection, and accepts every Action Cable origin.

**Fix direction:** Restrict CORS to configured origins with credentials off unless needed; derive Action Cable allowed origins from the deployment host list; give the proxy a CSRF token or a deliberately token-authenticated route.

**Also open:** [PREEXISTING] P2 I0 C2 — no rate limiting on proxy fetch (production concern when `proxy_requests: true`).

---

### Brakeman findings

Specific suppression notes live in `config/brakeman.ignore`. As the fixes below
eliminate warnings, remove their fingerprints and rerun the CI Brakeman gate.

**Review evidence (2026-10-08):** A fresh Brakeman 8.1.0 scan reproduced all 24 warnings with zero scan errors. Source/caller inspection and unsaved runtime probes informed the recommendations below; persistence exploit tests, the Rails suite and browser flows were not run. Import compatibility and suitable execution limits remain unverified.

**Bookkeeping verification (2026-10-08):** The CI Brakeman gate passes with
24 suppressed warnings, no scan errors and no obsolete fingerprints. Focused
authentication and sampling tests pass (14 tests, 44 assertions); the added
authentication coverage passes RuboCop. These checks do not resolve the findings below.

#### [PREEXISTING] P1 I0 C3 — Restrict nested case-import attributes

**Location:** `app/services/case_importer.rb` (`build_queries_and_ratings`, `update_first_try`), `app/controllers/api/v1/import/cases_controller.rb`

Queries, ratings, tries and curator variables receive broadly accepted nested attributes. Unsaved probes confirmed assignment of internal query/rating IDs, timestamps, rating `user_id`, and try `case_id`/`ancestry`; persisted cross-account effects were not tested.

**Fix direction:** Use explicit attribute allowlists inside the importer, following `BookImporter`'s existing pattern, so all callers share the boundary. Replacing the controller's `permit!` alone is insufficient.

**Compatibility gate:** Compare actual case exports and supported import payloads before excluding fields. Preserve content, supported metadata and rating attribution; prevent imported internal IDs or relationships from redirecting writes. Verify valid export/import round trips and malicious nested attributes. Do not infer that every historically accepted field is disposable.

#### [PREEXISTING] P1 I0 C3 — Bound server-side JavaScript execution

**Location:** `lib/v8_mapper_executor.rb`, `lib/javascript_scorer.rb`

MiniRacer contexts have no execution timeout or memory limit. User-authored and LLM-generated mapper/scorer code can loop indefinitely or exhaust resources. Intentional JavaScript evaluation is not itself evidence of Ruby remote code execution.

**Fix direction:** Keep the execution architecture and add MiniRacer timeouts and memory soft limits, preserving existing error handling. Review exposed Ruby callbacks, including the unused `fetchData` stub, without adding access to application records. This is separate from the browser isolation decision under "Scorer sandboxing - LATER".

**Compatibility gate:** Existing scorer and mapper fixtures must produce identical successful outputs. Exercise legitimate large cases before choosing limits: previously successful slow evaluations may now fail. Termination must report an explicit error without persisting partial results or substituting zero scores. Limits reduce resource-exhaustion risk; they do not establish complete isolation.

#### [PREEXISTING] P2 I0 C2 — Allowlist ratings-export templates

**Location:** `app/controllers/api/v1/export/ratings_controller.rb`

One warning (the JSON template) still covers template names derived from `file_format`. No traversal exploit was established.

**Fix direction:** Map supported formats to literal template names and define the unsupported-format response.

**Compatibility gate:** Preserve existing valid formats, casing behavior, defaults, snapshot selection and output. Supported export content must remain identical; unknown formats may receive a deliberate error instead of the current template-resolution failure. Do not fold unrelated export behavior fixes into this hardening.

---

## [PREEXISTING] P2 — Security

### [PREEXISTING] P2 I0 C1 — Search endpoint API returns `basic_auth_credential` in clear text

**Decision needed:** Is returning the stored credential to any client that can read the endpoint acceptable, given that direct-from-browser search needs it?

**Location:** `app/views/api/v1/search_endpoints/_search_endpoint.json.jbuilder` (`api_basic_auth_credential`)

**Observed:** Manual pass 2026-10-28 (18.7). Added in `35249934` (2023-10-24, #855); `dc2f46af` (2026-03-24) made it nil when `REQUIRE_PROXY_WITH_BASIC_AUTH_CREDENTIALS` is on and the full credential "for direct browser connections" otherwise. This is documented, intended behavior, so it is a design question and not a bug. Omitting it for everyone would break direct search against endpoints with credentials.

**Options:** keep and document the flag as the supported mitigation; or return it only to users who can edit the endpoint.

---

### [PREEXISTING] P2 I0 C1 — Password reset enumerates accounts

**Observed:** Unknown email → "email was not found"; known email → neutral "you will receive…" message.

**Cause:** `config.paranoid` commented out in `config/initializers/devise.rb`.

**Fix direction:** Enable `config.paranoid = true` (or normalize both responses).

### [PREEXISTING] P2 I0 C1 — `QUEPID_CONSIDER_ALL_REQUESTS_LOCAL=false` enables detailed errors

**Location:** `config/environments/production.rb:18`, `.env.example`

`consider_all_requests_local` is set from `ENV[...].present?`, so any value,
including the `false` that `.env.example` recommends, shows detailed error pages
(stack traces, request details) in production. Only an unset or empty variable
disables them.

**Fix direction:** Parse the value as a boolean (for example
`ActiveModel::Type::Boolean.new.cast(ENV[...])`) and add a test. Deployments
that rely on any non-empty value enabling detailed errors will change behavior.

### [PREEXISTING] P1 I0 C2 — No minimum password length

**Observed:** Resetting a password through the reset link with `abc` succeeds and the user can then log in with it. Manual test 1.4's short-password edge case expects a validation error.

**Cause:** `User` validates only presence and `maximum: 80` on `password` (`app/models/user.rb`). `config.password_length = 8..72` in `config/initializers/devise.rb` is never applied because `:validatable` is not enabled.

**Fix direction:** Add a minimum length validation (match the Devise 8..72 setting) on password create/change paths, then check seed data, fixtures, and existing tests for shorter passwords.

---

## [PREEXISTING] P2 — Product bugs

### [PREEXISTING] P3 I0 C1 — Small UI defects from the 2026-10-28 manual pass

Each was recorded in `tracking.yml` as unchanged since merge-base, except where noted. Fix opportunistically; the first three are worth doing soon.

- **11.9** After a fractional-position error the re-rendered Position input keeps `2.5` with no `min`/`step`, so the browser rejects a corrected integer ("nearest valid values are 2.5 and 3.5"). Reset the value or add `step="1"`.
- **14.5** An admin can lock their own account from their own show page and is logged out immediately with no warning, so recovery needs another admin. Hide or confirm **Lock** on one's own page. A locked user's next HTML request also returns raw JSON `{"reason":"Locked"}`.
- **12.10** The TypeSafe Jev Minimum confidence input has `step=0.1`, so the browser blocks saving values like `0.95` that the preview accepts.
- **14.3** Admin Users CSV/JSON export ignores the active filter (the links omit `q`; the endpoint honors it). `index.json.jbuilder` line 6 puts a debug key `bob` in every JSON user.
- **14.9** A long unbroken word in an announcement overflows the viewport (needs `overflow-wrap`). The dev DB also holds about 21 leftover live "Playwright announcement" rows from e2e runs.
- **16.4** The Import ratings modal title is an `h5`, not passing `title_tag: :h2` like Export and Judgements, which gives a moderate `heading-order` violation.
- **11.2** The `;` shortcut's hint label shows `SC` (`judgement_helper` key `sc`, since 2025-12).
- **10.5** The "N rated query/doc pairs" badge counts judgements, not pairs (10 shown for 6 rated pairs).
- **10.6d** The Rating label's `for=book_rating` does not match `select#rating`.
- **10.8** The import error box renders under both upload forms, not only the one submitted.
- **11.7** Judgement Stats resets redirect to the book Overview, not back to Judgement Stats.

---

### [PREEXISTING] P3 I0 C1 — Book settings 422 page loses the scorer and the settings tab

**Location:** `app/controllers/books_controller.rb` (`update`), `app/helpers/books_helper.rb` (`book_settings_active?`)

**Observed:** When `update` fails validation, `respond_with` re-renders the edit form. `update` never sets the `scorer_id` virtual attribute the way `edit` does (`matching_scorer_id_for_book`), so the scorer dropdown can come back blank. `book_settings_active?` only matches `action_name == 'edit'`, so the settings nav item isn't highlighted on the re-rendered page. At the `be9b319a` baseline, `update` also didn't set `scorer_id`. The tab helper came from #1792, a feature PR rather than migration work.

**Fix direction:** Set `@book.scorer_id` in `update` when errors are present (unless the submitted value is already set), and treat `update` as the settings page in `book_settings_active?`. Add a controller test for the failed-update render.

---

### [PREEXISTING] P2 I0 C1 — A newly added query jumps from the bottom to the top on reload

**Location:** `app/controllers/api/v1/queries_controller.rb` (`create`)

**Observed:** Adding a query shows it at the bottom of a Manual-sorted list, but after a reload (or anything that re-bootstraps the case, such as Rerun My Searches! creating a new try) it is at the top. The `create` response's `display_order` lists the new id last, while `index` lists it first. The `Case#queries` scope orders `arranged_at IS NULL DESC`, so a new, unarranged query sorts first in the database, and `create` builds `display_order` from the association it just built on, which appears to put the in-memory record last. Reproduced 2026-10-04 on case 598. The controller is unchanged from `main`, and the `be9b319a` Angular client also applied the `create` response's `display_order`, so this predates the migration (source evidence only, not replayed).

**Fix direction:** Reload the association (`@case.queries.reload`) before building `display_order` in `create`, and add a controller test that `create` and `index` return the same order.

---

### [PREEXISTING] P3 I0 C1 — Case wizard's Use Mapper Wizard fails silently when the draft case can't be deleted

**Location:** `app/javascript/controllers/wizard_controller.js` (`goToMapperWizard`)

**Observed:** **Use Mapper Wizard** deletes the draft case, then closes the modal and navigates to the Mapper Wizard. The delete promise has no rejection handler, so if the delete fails (network error, 403) the button does nothing, the modal stays open, and the only trace is an unhandled rejection in the console. At `be9b319a`, `goToMapperWizard` chained only `.then` on `caseSvc.deleteCase`, which had no error handling, and the only `$http` interceptor was CSRF, so this predates the migration (source comparison only, not replayed).

**Fix direction:** Add a `.catch` that shows the failure in the wizard's alert (`this.fail(...)`), and a unit test for a rejected delete.

---

### [PREEXISTING] P2 I0 C2 — Bulk judging reshuffles documents between pages

`BulkJudgeController#new` shuffles each query group before pagination on every request, so consecutive pages can repeat documents and omit others. Current browser replay confirms overlap; Angular `8ceb99e9` has the same ordering code (source comparison only; live historical replay pending). Preserve a stable ordering across a judging session before paginating.

---

### [PREEXISTING] P2 I1 C3 — Judgement rating not validated against book's scale (outside AI judging)

**Observed:** `Judgement#rating` only validates presence, never that the value is actually one of the book's configured scale values. `Api::V1::JudgementsController#update`, `JudgementsController`, and `BulkJudgeController#save` (`judgement.rating = params[:rating]`, no scale check) all write a client-supplied rating with no scale check — they're only "safe" today because the judging UI happens to render buttons limited to the book's actual scale values; nothing stops a raw form/API POST from bypassing that. The AI-judging path (`app/jobs/run_judge_judy_job.rb`, hardened in `37840b47`) is the only one with a guard, and it's job-local.

**Cause:** No model-level validation ties `Judgement#rating` to `query_doc_pair.book.scale`.

**Audit result (done):** Two call sites *legitimately* write ratings outside the discrete scale, both gated on `book.support_implicit_judgements?`:
- `[PREEXISTING]` `BookCombiner#merge_judgement` (`app/services/book_combiner.rb:41`, called by `BooksController#combine`) averages two existing ratings — `(judgement.rating + j.rating) / 2` — and explicitly skips rounding when `support_implicit_judgements` is true (e.g. `(0+3)/2 = 1.5` on a `[0,1,2,3]` scale).
- `[PREEXISTING]` `JudgementFromRatingJob#perform` (`app/jobs/judgement_from_rating_job.rb:24`) copies a case-level `Rating#rating` straight into `judgement.rating` via `judgement.save!` (raises on failure) — that value comes from the case's scorer scale, which has no guaranteed relationship to the book's judgement scale.

`BookImporter`/`RatingsImporter` are fine: `RatingsImporter` writes the unrelated `Rating` model, and `BookImporter#import_judgement` already silently no-ops on failed saves.

**Fix direction:** Add an `inclusion` validation on `Judgement` for required ratings (preserve `rating_not_required?` for unrateable/judge-later rows), scoped to `query_doc_pair.book.scale`, conditioned `unless: -> { query_doc_pair&.book&.support_implicit_judgements? }` (safe-navigate — `query_doc_pair` is a required `belongs_to` but its own presence validation runs independently, so a blank `query_doc_pair` must not blow up this lambda with a `NoMethodError`) so the two legitimate continuous-rating paths above stay unaffected. Change `JudgementFromRatingJob` to `save` + handle a validation failure instead of `save!` (a case rating can legitimately be off-scale for an explicit-only book). Retire the job-local check in `run_judge_judy_job.rb` in favor of the model validation (catch the failure, call `mark_unrateable`).

The separate coercion/aggregation decision is in [Judgement coercion and aggregation semantics](#preexisting-p2-i2-c3--judgement-coercion-and-aggregation-semantics).

---

### [PREEXISTING] P2 I0 C2 — Cloning a case doesn't keep manual query order

Cloning case 6 swapped its first two queries. `Case#clone_case` dups each query and appends it, and `Arrangement::Item#prepend_node_to_list` overwrites the copied arrangement on create and prepends each clone, so iterating the original order can reverse it. The deterministic ordering on `Case#queries` does not fix that callback. Re-sequence the clones in the original order after creation (or explicitly avoid prepending during cloning) and cover it with a model test.

---

### [PREEXISTING] P2 I0 C1 — Snapshot CSV import hides per-snapshot failure reasons

`import_snapshot_controller.js#importSnapshots` logs individual API errors to
the console, then throws only "1 snapshot(s) failed to import. Some may have
been imported successfully." An unknown case therefore produces a generic
alert even when the API explains "Case not found!". Surface the case ID,
snapshot name and API reason in the alert, and distinguish partial success.

---

### [PREEXISTING] P2 I0 C3 — Anonymous judgements have no identity: `combine` collapses them, re-import duplicates them

**Decision needed:** Define what identifies an anonymous judgement across book operations. For `combine`, choose separate anonymous rows versus a combined rating, and define aggregation when combining multiple books. For import, choose whether anonymous imports accumulate rows or replace an authoritative set, and define an identity/retry contract. Decide both together; they share a root cause.

#### `BooksController#combine` collapses anonymous judgements into one averaged row

**Location:** `app/services/book_combiner.rb:41` — `BookCombiner#merge_judgement`

The merge loop upserts each source judgement with `pair.judgements.find_or_initialize_by(user: source.user)`. `Judgement` deliberately permits several nil-user rows per pair (`validates :user_id, uniqueness: { scope: :query_doc_pair_id }, unless: -> { user_id.nil? }`), so *every* anonymous judgement in the source book matches the same target row. N anonymous judgements collapse to 1 — and because the same loop averages (`(judgement.rating + source.rating) / 2`), the surviving rating is an order-dependent running mean, not a true average.

**Reproduced** by running the verbatim inner loop against the test DB (a script, not a Playwright pass): a source pair carrying anonymous `[1.0, 3.0, 3.0]` produced **one** target row rating `2.5`, where the true mean is 2.33.

**Cause:** Same root cause as the import bug fixed in `BookImporter#import_judgement` on 2026-09-10 — `find_or_initialize_by(user: nil)` treats "no judge" as an identity.

**Fix direction:** Needs a product call first: should anonymous judgements copy across as separate rows (mirroring the importer, no averaging), or keep collapsing into one averaged row? If separate, skip the find when `source.user.nil?` and `build` unconditionally. Note the averaging is order-dependent even for identified users once you merge 3+ books; the same `combine` line is already documented under the [judgement-scale validation item](#preexisting-p2-i1-c3--judgement-rating-not-validated-against-books-scale-outside-ai-judging) for a different reason.

#### Re-importing anonymous judgements is not idempotent, and it moves computed case ratings

**Location:** `app/services/book_importer.rb` — `import_judgement`

An anonymous judgement has no identity to upsert on, so as of the 2026-09-10 fix each import `build`s a new row (the alternative — `find_or_initialize_by(user: nil)` — collapsed all of them into one, which was worse). The accepted cost is documented in the code and in `docs/manual-testing/10-books-management.md`. What makes it more than cosmetic: `RatingsManager#calculate_rating_from_judgements` averages 1-2 judgements but takes the **min of the top 3** at 3 or more, so duplication can move a rating a user never re-judged — `[3.0, 0.0]` → 1.5 becomes `[3.0, 3.0, 0.0]` → 0.0. Pinned by `test/services/book_importer_test.rb`'s "re-importing anonymous judgements duplicates them and moves the computed case rating".

**Reached by** the ordinary export → re-import path, since `_judgements.json.jbuilder` emits `user_email` only `if judgement.user`, so exported anonymous rows come back identity-less; also by a Mission Control retry of a failed `ImportBookJob` (no job-local `retry_on`; `DeferredPayload.consume` retains the upload on failure and purges it only after the import block succeeds), and plausibly by a double-submitted import form.

**Fix direction:** Needs the same product call as `combine` above. Option: treat a payload's `judgements` array as authoritative for a pair's *anonymous* set — `query_doc_pair.judgements.where(user: nil).delete_all` before building the incoming user-less ones — which keeps upsert semantics for identified judges and makes repeated imports converge. Wrong answer if a book legitimately accumulates anonymous judgements across several import files.

---

### [PREEXISTING] P2 I2 C3 — Judgement coercion and aggregation semantics

**Decision needed:** Choose the rounding and aggregation rules across rating writers before centralizing them. Scale validation remains in the [separate validation item](#preexisting-p2-i1-c3--judgement-rating-not-validated-against-books-scale-outside-ai-judging).

Also audit coercion and aggregation across rating writers (former DRY #15).
`BookCombiner` (behind `BooksController#combine`) and `RatingsManager` round unless the book supports
implicit judgements; bulk judging, the judgements API, `JudgementFromRatingJob`
and `LlmService` do not all apply that rule. `BookCombiner` uses a pairwise mean,
while `RatingsManager#calculate_rating_from_judgements` uses a different
aggregation rule. Decide intended semantics before centralizing coercion in
`Judgement`; check bulk writers that bypass callbacks and preserve legitimate
continuous ratings. Changing rounding or aggregation changes stored ratings
and scores, so keep it separate from behavior-preserving cleanup.

---

## [PREEXISTING] P1 — Backend correctness and authorization

### [PREEXISTING] P2 I0 C2 — Admin user delete leaves ownerless cases and books

**Decision needed:** Is leaving ownerless cases and books after a user is deleted the intended contract, or should they be removed or reassigned? Scenario 14.8 currently documents "nullified (not deleted) if shared with a team, and survive".

**Location:** `app/models/user.rb` (`has_many :cases` and `has_many :books`, both `dependent: :nullify`), `Admin::UsersController#destroy`

**Observed:** Manual pass 2026-10-28 (`findings-2026-10-28.md`, 14.8): deleting a user as admin left case `1067525580` and books `1071057366` and `1071057364` with no owner. Nothing in the app lists or cleans them up, and it is unknown whether they were shared with a team. The `nullify` is long-standing: cases since `85d8e52f` (#359, 2021-07-31, with the comment "sometimes a case belongs to a team, so don't just delete it"), books since `56c1c483` (#916, 2024-01-17). Not compared against pre-deangularization `main`.

**Options:** keep `nullify` for team-shared records only and destroy private ones; reassign to the deleting admin or a team member; or keep as is and document it.

---

### [PREEXISTING] P2 I0 C1 — Case lists order by, and duplicate on, other users' view metadata

**Decision needed:** Confirm the "recently viewed" ordering is meant to be per user. The intentional reading I can construct ("most recently viewed by anyone", for team activity) has no support in the code or docs, and the duplicates have no plausible purpose.

**Location:** `app/controllers/api/v1/cases_controller.rb` (`fetch_full_cases`); likely also `app/controllers/home_controller.rb` (`show`) and `app/controllers/concerns/authentication/current_case_manager.rb` (`recent_cases`)

**Observed:** Manual pass 2026-10-28 (`findings-2026-10-28.md`, 18.1): `GET /api/cases` left-joined `case_metadata` with no user filter, so a case appeared once per metadata row from any user (`oscmember` got ids `[6, 6, 586, 586, 473]`) and other users' `last_viewed_at` changed the ordering. Eric Pugh introduced the unfiltered join in `379e5bf3` (2023-08-24, #795); later commits (`05f687cf`, `383fef60`, `5557449d`) kept its shape. Not compared against pre-deangularization `main`.

**Current state:** `fetch_full_cases` now joins only the current user's metadata row (uncommitted, with a test in `cases_controller_test.rb`). `HomeController#show` and `recent_cases` use `.includes(:metadata)` with the same unfiltered `case_metadata.last_viewed_at` ordering. They probably have the same cross-user ordering problem, but this is untested and unchanged.

**Fix direction:** Confirm the two other callers with a test where another user has a newer view, then filter them the same way, or extract one shared per-user "recently viewed" scope.

---

### [PREEXISTING] P1 I0 C1 — Book collaborators can run an AI judge they cannot access

**Decision needed:** Should a book collaborator be able to run (or cancel) an AI judge that the book owner assigned to the book but that the collaborator does not own and that is not shared with them via a team? Running spends the judge owner's LLM key.

**Location:** `app/controllers/books_controller.rb` (`run_judge_judy`, `cancel_judge_judy`), `Book#working_ai_judge`

**Observed:** Manual pass 2026-10-28 (`findings-2026-10-28.md`, 12.8): `working_ai_judge` only checks that the judge is assigned to the book or on call for it, so any collaborator on the book could run another user's judge. `run_judge_judy` came with `3e38c655` (Eric Pugh, 2025-01-15), when judges were communal. The ownership model (`c468d18f`, `4a9065db`, 2026-09-23) never added a per-user check to the run action. Not compared against pre-deangularization `main`.

**Current state:** Deferred pending a product decision; existing run and cancel behavior is preserved. Decide whether assigning a judge to a book authorizes its collaborators to run it, and how that relates to automatic runs and escalation. `AiJudge.for_user(current_user)` also grants prompt/configuration editing, so sharing a judge with a team is not a run-only permission. Document the agreed contract in scenario 12.8 before changing authorization or run controls.

---

### [PREEXISTING] P2 I0 C1 — API accepts invalid input with 200, or fails with 500

**Location:** `app/controllers/api/v1/queries_controller.rb` and `bulk/queries_controller.rb` (query create), `queries/positions_controller.rb`, `scorers_controller.rb`, `books_controller.rb` (create), `users_controller.rb` (update)

**Observed:** Manual pass 2026-10-28 (`findings-2026-10-28.md`, 18.3, 18.7, 18.8). The classification found each code path unchanged by the migration.
- Blank `query_text` is accepted: single create returns 200, bulk create stores `""` and `"  "`.
- Moving a query with an invalid sibling id returns 500 instead of 4xx.
- A scorer created with scale `'abc'` returns 200 and stores `[]` (strong params `scale: []` plus `sanitized_params.delete(:scale)`; the `ScaleValidator` branch only covers the HTML form's `scale_list`).
- Forced scorer delete with a nonexistent `replacement_scorer_id` returns 500.
- `POST /api/books` with a nonexistent `scorer_id` returns 200 and creates a book with an empty scale. Replayed on Legacy `8ceb99e9` 2026-10-28: same 200 and `scale=[]`.
- `PUT /api/users/:id` accepts params without the `user` envelope (18.8).

**Fix direction:** A presence validation on `Query#query_text` (check no import flow relies on blank names first), `RecordNotFound` handling that renders 4xx for the sibling and replacement ids, a scale validation shared with the form path, and a 400 for an unknown `scorer_id`. Each is a few lines with a controller test; batch them in one PR.

---


### [PREEXISTING] P2 I1 C1 — Bulk ratings accept values outside the scorer scale

**Location:** `app/controllers/api/v1/bulk_ratings_controller.rb`, `app/models/rating.rb`

**Observed:** Source inspection: the controller does an unchecked `rating.save` and `Rating` has no scale validation, before or after the migration, which only changed judgement syncing after the save (`JudgementSync.from_ratings`). Out-of-scale values can feed straight into case scores. This API path has not been verified by the recorded 11.8 run: that run exercised `BulkJudgeController#save` and `Judgement`, confirming the separate [book-scale validation finding](#preexisting-p2-i1-c3--judgement-rating-not-validated-against-books-scale-outside-ai-judging).

**Fix direction:** Validate against the case scorer's scale in `Rating` or the controller and report the rejected rows. Related to [Judgement rating not validated against book's scale](#preexisting-p2-i1-c3--judgement-rating-not-validated-against-books-scale-outside-ai-judging), and the same question about legitimate off-scale values applies.

---

### [PREEXISTING] P1 I0 C1 — Book update saves memberships even when the update fails

**Location:** `app/controllers/books_controller.rb` (`update`)

**Observed:** `update` writes team and AI-judge memberships (`assign_book_memberships`: `TeamSharing#assign_teams`, `@book.ai_judges =` and auto-run flag saves) before calling `@book.update`. Those association writes persist immediately. If the update then fails validation, the 422 page shows errors, but the membership changes are already saved and the other field changes aren't. The user sees "failed" while part of the form is saved. At the `be9b319a` baseline, `update` had the same order (`@book.teams.replace` and `@book.ai_judges <<` before `update`).

**Fix direction:** Wrap the membership changes and `update` in `Book.transaction` and roll back when `update` returns false. Keep the file purges outside the transaction or after it succeeds. Add a controller test where a failing update leaves teams and AI judges unchanged.

---

### [PREEXISTING] P2 I0 C2 — Core search-endpoint lookup matches archived and other users' endpoints

**Location:** `app/controllers/core_controller.rb` (`populate_from_params`)

**Observed:** When `/case/:id` gets `searchEngine` params, it calls `SearchEndpoint.find_or_create_by(search_engine:, endpoint_url:, api_method:, basic_auth_credential:)`. That lookup is global: an archived endpoint, or one owned by a team or user the current user can't see, can be attached to the try. The baseline `be9b319a` had the identical call.

**Fix direction:** Add `.not_archived` to the lookup, and scope it to `current_user.search_endpoints_involved_with`. Creating a new endpoint should then set the owner. Add a controller test with an archived endpoint that matches.

**Decision needed:** How matching should treat credentials when the matched endpoint belongs to someone else (reuse it, ignore the submitted credentials, or always create a user-owned endpoint). Settle this before broadening the scope beyond `.not_archived`.

---

### [PREEXISTING] P1 I0 C1 — `FetchService` query substitution treats `\0`/`\1` as backreferences - EP review needed

**Location:** `app/services/fetch_service.rb` — `build_get_params`

`#$query##` is substituted twice. `build_get_params` uses
`gsub(string, string)`, so `\0` or `\1` in the query text is treated as a
backreference and the server sends a different query than the user typed.
`replace_values` already uses the safe block form. Background scores can
silently differ from the case page.

**Fix direction:** Use the block form (or a shared substitution helper) and add
a test with backslash sequences in the query text.

**Investigation:** Isolated Ruby/browser-template probes confirmed ordinary text,
quotes, Unicode and URL characters are preserved by block substitution, matching
existing POST and browser Solr handling. Current GET substitution also collapses
doubled backslashes and raises on `\k<name>`. Queries compensating for this
corruption may produce different future background results/scores after the fix;
stored queries and historical scores remain unchanged. No full suite or live
search verification performed.

### [PREEXISTING] P1 I0 C2 — `FetchService` drops repeated GET params such as Solr `fq` - EP review needed

**Location:** `app/services/fetch_service.rb` — `build_get_params`

`build_get_params` assigns `params[key] = val` in a loop, so repeated Solr
params such as `fq` keep only the last value. Background evaluations then run
with fewer filters than the browser search and produce different scores.

**Fix direction:** Accumulate repeated keys into arrays and encode them as
repeated params; add a test with multiple `fq` values. This changes fetched
results and background scores, so verify against a client search for the same
try.

**Investigation — fix deferred:** Present since FetchService's introduction
(`3bfa92d7`, 2025-01-16). Stubbed HTTP/browser-code probes confirm lost filters
and facets; arrays require flat encoding to avoid `fq[]`. Single-value encoding
matched; repeated values/order were preserved with flat encoding. Scope encoding
to FetchService; endpoint-URL duplicates also collapse in the shared client and
need separate scope. Future multi-filter runs may change results/scores; no data
migration or historical recalculation is needed, though normal recent-score updates
and snapshot retention still apply. No live search or full suite verification.

### [PREEXISTING] P2 I0 C3 — Mapper wizard function extraction is not lexical-aware

**Location:** `app/services/mapper_wizard_service.rb:302` (`extract_single_function`)

`extract_single_function` counts every brace, including braces inside strings,
comments, and regular expressions. Generated mapper code containing one of
those can be truncated before it is saved.

**Fix direction:** Use a JavaScript-aware extraction strategy or the existing
V8/parser path, and add regression cases for braces in strings, comments, and
regular expressions.

### [PREEXISTING] P1 I0 C2 — Safe LLM judgement handling misses malformed success bodies - EP review needed

**Location:** `app/services/llm_service.rb` — `perform_safe_judgement`;
`app/services/llm_judge_adapters/base.rb` — `extract_judgement`

`extract_judgement` calls `JSON.parse` on model content, but
`perform_safe_judgement` does not rescue `JSON::ParserError` or a missing
content value. A successful HTTP response with malformed model output can
escape the safe-judgement path and leave the job unhandled.

**Fix direction:** Treat malformed/missing content as an unrateable judgement
with the same recorded explanation as other safe-judgement failures, and add
tests for malformed JSON and missing provider content.

**Impact/question:** Stubbed service/adapter/middleware probes confirmed malformed
model JSON, missing content and non-object JSON escape handling. The job stops
before saving that judgement or broadcasting completion; earlier judgements remain
saved, with no configured automatic job retry for these errors. Recording Unrateable
would let the run continue but exclude that pair from normal selection for the same
judge until reset/removal. Should these failures follow that existing policy or
remain eligible for an explicit retry? Prefer a specific adapter response error
over rescuing programming errors broadly. Persistence effects were source-traced;
no full suite or live provider verification performed.

### [PREEXISTING] P2 I0 C1 — Whitespace-prefixed JSON takes the bare-query path

**Location:** `app/models/try.rb:188` (`json_query_params?`)

`json_query_params?` checks only whether the raw value starts with `{`.
Whitespace-prefixed JSON is accepted by `JSON.parse` but is classified as bare
text, so `resolved_api_method` can select the wrong request method.

**Fix direction:** Strip surrounding whitespace for dispatch (while preserving
the original payload), and add tests for leading/trailing whitespace.

### [PREEXISTING] P2 I0 C1 — Core search-endpoint lookup can never match a stored credential

**Location:** `app/controllers/core_controller.rb:54-85` (`populate_from_params`)

`populate_from_params` calls `SearchEndpoint.find_or_create_by` including `basic_auth_credential`. Since `dc2f46af` (on `main`) that column is encrypted non-deterministically, so a query on it never matches a stored value. Every load of `/case/:id` with `searchEngine` and a `basicAuthCredential` parameter creates another ownerless endpoint and attaches it to the try. An empty value is encrypted too, so it never matches either; the wizard's http↔https reload always sends `basicAuthCredential=`, so each reload of that URL adds an endpoint (confirmed in the browser on 2026-10-19). `SearchEndpoint.find_or_initialize_for_user` already excludes the credential from its lookup for this reason. Related to the global-lookup entry above; fix them together.

**Fix direction:** Look up without the credential (reuse `find_or_initialize_for_user`), set or compare the credential afterwards, and set the owner on create. Add a controller test that reloading the same URL twice creates at most one endpoint.

### [PREEXISTING] P3 I0 C1 — Rating remap returns 500 for out-of-range values

**Location:** `app/controllers/books_controller.rb:440` (`remap_judgement_ratings`)

From `e77dcfb8` (#1751, on `main`). Submitted values pass through `to_f` and are interpolated into a SQL `CASE`. A value such as `1e400` becomes `Infinity`, the SQL is invalid and the request fails with a 500. Non-numeric text silently becomes `0.0`.

**Fix direction:** Parse with `Float(value, exception: false)`, reject non-finite or non-numeric values with a flash alert, and add a controller test for both.

---

## [PREEXISTING] P3 — Code quality

### [PREEXISTING] P3 I0 C1 — Unsafe integer coercion in snapshot search

**Location:** `app/controllers/api/v1/snapshots/search_controller.rb:59-60`

`params[:rows].to_i` / `params[:start].to_i` without validation; non-numeric strings coerce to `0`.

---

### [PREEXISTING] P2 I1 C2 — BookImporter: judge identifiers `validate` doesn't check import silently as anonymous

**Location:** `app/services/book_importer.rb` — `find_judgement_user`, `validate`, `emails_of_judges`

`#validate` pre-checks judgement `user_email`s against existing users and refuses the import with "User with email '...' needs to be migrated over first." (or invites them, under `force_create_users`). Two identifiers `find_judgement_user` honours slip past it entirely, and both degrade to an unattributed judgement with no warning:

1. **`user_id`** is never validated at all. A payload naming a `user_id` that doesn't exist in this instance imports anonymous — and `app/views/books/import/edit.html.erb` documents `user_id` as *the* judge identifier for `all_judgements`, while row ids never survive a cross-instance export, so this is the routine case rather than an exotic one.
2. **`:email` on a *nested* judgement** — `emails_of_judges` reads only `judgement[:user_email]` in the `query_doc_pairs` branch, while the `all_judgements` branch reads `user_email || email` and `find_judgement_user` accepts either. So `{"rating":1.0,"email":"nobody@example.com"}` nested under a pair skips both the migration error and the `force_create_users` invite.

Not a regression — before the 2026-09-10 fix these were silently attributed to whichever nil-email AI-judge user the database returned first, which was worse — but all the identifier paths should fail the same way.

**Fix direction:** Have `emails_of_judges` read `user_email || email` in both branches, and have the `validate` pass collect `user_id`s alongside emails so an id that doesn't resolve is treated like an unknown email rather than degrading to anonymous in silence.

---

### [PREEXISTING] P2 I0 C3 — BookImporter: unsaved records aren't reported back to the user

**Decision needed:** Choose how partial imports are reported and whether valid rows remain imported when other rows fail.

**Location:** `app/services/book_importer.rb` — `import_query_doc_pairs`, `import_all_judgements`, `import_judgement`, `upsert_nested_query_doc_pair`

None of these check the return value of `qdp.save` / `judgement.save`. If a row fails validation during an "add more data" import (`Books::ImportController#update`), it's silently dropped — `ImportBookJob` still clears `book.import_job` and reports success, with no indication some rows didn't make it in. Pre-existing gap (the original code didn't check `.create`'s success either), just calling it out now that this path is being hardened for repeated/production re-imports. Fixing it well means deciding how partial failures should surface to the user (job status field? notification?) — a small design call, not a drive-by fix.

---

### [PREEXISTING] P3 I0 C1 — Dead or redundant code found by Ruby mutation testing

**Location:** `app/services/case_score_manager.rb`, `app/lib/analytics/tracker/`

Mutant (`config/mutant.yml`) found code no test can reach through the public entry points. The unreachable `CaseScoreManager` branches (nil-score and both-empty guards in `added_query?`, the failed-save branch and explicit `touch` in `update`), the `DeferredPayload.stash!` `content_type` and the second `import_succeeded` guard in `CaseImporter#import` are already removed with identical behavior. Two items remain because each needs a check or a decision first:

- **Unused arguments on `Analytics::Tracker` share/membership events** (`track_case_shared_event`, `track_book_shared_event`, `track_search_endpoint_shared_event`, `track_scorer_shared_event`, `track_member_removed_from_team_event`). They take `_user` and `_team`/`_member` but only read the record or team, so `TeamSharing` and `TeamMembership` pass values nothing uses. Drop the parameters or start recording them.
- **`CaseScoreManager` `last_score.updated_at.blank?` guards** in `user_ratings_docs?` and `same_score?`. Rails always sets `updated_at`, but `case_scores.updated_at` is nullable, so confirm no legacy rows have `NULL` before removing.

**Fix direction:** Remove each item in its own small change, keeping behavior identical, and delete any test that only exercised the dead path. Add further dead code found by later Mutant runs to this list instead of opening separate entries.

---

## [PREEXISTING] P2 — Background jobs

### [PREEXISTING] P1 I2 C3 — Import/populate jobs leave state and idempotency to best effort

**Decision needed:** Define failure/retry states, uploaded-blob retention and repeated-submission semantics; automatic cleanup must not erase retryable work.

**Location:** `app/jobs/import_book_job.rb:7-21` (and similar populate jobs)

Jobs set status strings before working and clear them only on success, so a failure can leave a book permanently busy and leave uploaded blobs in place. Several import paths use `find_or_create_by` plus later updates, vulnerable to duplicate work from retries or concurrent requests. Related to the anonymous-judgement re-import entry above.

**Fix direction:** `ensure`/failure transitions for status and blob cleanup; deliberate retry/discard policy; idempotency via unique constraints or an explicit import identity. Test a failed job followed by retry, and a duplicate submission.

Scenario 18.6 (2026-10-28) also showed two simultaneous populate PUTs both getting
204: `populate_controller.rb` checks `@book.populate_job.present?` and sets it later,
a check-then-set race unchanged by the migration (which only swapped the inline
update for `@book.queue_job(:populate)`). A unique-per-book job guard or an atomic
`update_all` conditional on a blank status would close it.

The shared lifecycle scope also includes `ExportBookJob` and
`Book#queue_job`: queueing sets “queued”, each job sets “started”, and each
clears status only on success. Consider one `book.run_job(operation) { … }`
boundary. Define failed/retry status and blob retention before using `ensure`;
blindly clearing everything could hide failed work or prevent retries.
Status cleanup alone does not change scoring inputs.

`ApplicationJob` already discards jobs whose records have been
deleted (`DeserializationError`), but `retry_on` remains commented out.
Decide on a default retry policy for the jobs that take Active Record arguments.

### [PREEXISTING] P2 I1 C1 — Linked Cases card queries the job queue per case

**Location:** `app/views/books/_linked_cases_list.html.erb:17-18`, `app/jobs/update_case_ratings_job.rb` (`active_for`)

From `dafb7f52` (#1792, on `main`). Each render checks four job classes for every linked case, and each check loads every unfinished Solid Queue row of that class. `UpdateCaseRatingsJob.active_for` then runs one query per queued job to find its book, because the job's arguments carry pair ids, not the book. The card re-renders on every `BroadcastLinkedCasesJob`, and AI judging queues one sync per judgement, so a render during a run costs (linked cases × queued sync jobs) queries.

**Fix direction:** Drop the `UpdateCaseRatingsJob` check: a pair sync takes a fraction of a second, so its pulse is almost never visible. If the pulse is kept, look up each job class once per book rather than once per case, and pass the book as a job argument so the filter can be done in SQL. Recording sync start/finish on the book is the fuller fix if the page is still slow during AI judging.

### [PREEXISTING] P2 I0 C1 — Overlapping AI-judge runs fail on duplicate judgements

**Location:** `app/jobs/run_judge_judy_job.rb` (`limits_concurrency`, `judge_pairs`)

The one-run-per-book-and-judge lock expires after its `duration`: Solid Queue's 3-minute default on `main`, 30 minutes here. A "judge all" run on a large book outlasts it, so a second manual run can start alongside the first. Nothing reserves a pair for a run, so both can pick the same pair; the unique `(user_id, query_doc_pair_id)` index then raises `RecordNotUnique` at `judgement.save!` and that job fails.

**Fix direction:** Rescue `RecordNotUnique` on the save, treat the pair as judged and continue. Add a job test that pre-creates the judgement the job is about to save.

---

## [PREEXISTING] RuboCop deferrals

These candidates still carry inline Metrics suppressions. Search the codebase
for `rubocop:disable` and check `.rubocop.yml` for the full current lint scope.

### [PREEXISTING] P3 I1 C2 — Metrics/ParameterLists

- `[PREEXISTING]` P3 I1 C2 — `Case#clone_case` — `app/models/case.rb:144`
- `[PREEXISTING]` P3 I1 C2 — `HttpClientService#initialize` — `app/services/http_client_service.rb:32`

### [PREEXISTING] P3 I2 C3 — Complex methods (Metrics/*)

Candidates for extraction into smaller methods or services:

- `[PREEXISTING]` P3 I2 C3 — `FetchService` — `app/services/fetch_service.rb`

`FetchService` is 522 lines and `BooksController` is 607. Inspect the 73
`rubocop:disable` occurrences across `app/` individually; they include non-Metrics
exclusions and do not all represent complexity debt. Extract concrete
responsibilities when the relevant behavior is being changed and can be tested
independently. `LatestCaseScores` and `CaseScoreSamples` provide service examples.

`BooksController` has non-CRUD member actions:
`archive`, `unarchive`, `combine`, `run_judge_judy`, `assign_anonymous`,
`delete_ratings_by_assignee`, `reset_unrateable`, `reset_judge_later`,
`delete_query_doc_pairs_below_position`, `eric_steered_us_wrong`,
`remap_judgement_ratings` and `judgement_stats`. Rails
convention is a small resourceful controller per noun, for example
`Books::ArchivesController#create/destroy`, `Books::CombinationsController`
and `Books::RatingRemapsController`. `Books::ExportController` and
`Books::ImportController` already follow this pattern. `TeamsController`,
`HomeController` and `MapperWizardsController` are the next
candidates. Do this opportunistically, when an action is touched for another
reason.

---

## [PREEXISTING] Consolidated DRY review

### [PREEXISTING] P2 I0 C1 — Blank-to-`nil` conversion turns `false` into `nil`

`Api::V1::TriesController` and `lib/tasks/case.thor` carry the same
`convert_blank_values_to_nil`; `false.blank?` is true, so `false` becomes `nil`,
which looks unintended. Decide the correct behavior and fix it with a test in
both places. Do not share the function (request handling vs. Thor task).

### [PREEXISTING] P3 I1 C3 — Controller index filtering — deferred

Review ownership and filtering semantics independently before extracting a
concern. The team filter currently uses `joins` (Cases), `includes` plus a hash
`where` (Books), and a subquery (SearchEndpoints). SearchEndpoints parses
`archived` with `bool.deserialize`; the others use `deserialize_bool_param`.

A shared concern is appropriate only where accessible/owned scopes, archive
behavior, duplicate handling, and responses have the same contract. Preserve
those scopes and boolean semantics during extraction.

### [PREEXISTING] P2 I2 C3 — Server search request building duplicates and drifts

Inside `FetchService`:

- [PREEXISTING] P2 I0 C3 — `escape_query` is never applied on the server, while the client honors it.

This backlog accepts keeping response parsing in both Ruby and JS. Request
building is different: it drifts from the client and is buggy.

**Fix:** one substitution helper, a small `FieldSpec` value object on `Try`, and
multi-valued GET params.

**Field-spec investigation — extraction deferred:** Isolated probes found only
token splitting shared between Ruby's RRE-export ID lookup and Solr field-list
builder. Browser rules differ for missing IDs, multiple aliases, `+` separators,
JSON definitions and function fields. Unifying them can change fetched fields,
exports and scores; preserving separate rules offers little duplication reduction.
No live search verification performed.

Substitution, multi-valued filters and server escaping fixes change fetched
results and background scores; verify them separately.

### [PREEXISTING] P1 I2 C3 — Align client and server scoring inputs and aggregation

**Decision needed:** Choose the canonical fractional-rating, empty-score, NaN and rounding behavior before making client and batch scores match.

The scorer code is shared (MiniRacer runs it on the server), but the code around
it is not, and the two sides disagree:

| Rule | Case page (JS) | Server (`FetchService`, `JavascriptScorer`) |
| --- | --- | --- |
| Best-docs ratings | `parseInt`, so 2.5 becomes 2 (`ratings_store.js#bestDocs`) | `to_f`, kept as float |
| Case score with nothing scored | `'--'` | `0.0` |
| `all_rated` | computed | `nil` |
| NaN query score | shown as blank | stored as 0 |
| Rounding | none | `smart_round` to 2 places |

Ratings are `float` in the schema, and averaged judgements produce non-integers.
So a case can score differently in the UI and in a background evaluation.

**Fix:** move input assembly (`bestDocs`) and case aggregation into the shared
scorer module so both sides run the same code.

### [PREEXISTING] P2 I0 C3 — The CSP is effectively off

`config/initializers/content_security_policy.rb` sets only `font_src` and a
`report_uri` of `/csp-violation-report-endpoint`. No route serves that path.
`script-src`, `object-src` and the nonce generator are all commented out.
Rails 8's default is a nonce-based policy, and `javascript_importmap_tags`
already supports nonces.

**Fix:** enable `script_src :self`
plus nonces in report-only mode first, then enforce it. The core page's Solr JSONP needs the search endpoint
hosts in `script-src`, or a per-request allow-list. Either remove
`report_uri` or add the endpoint.

### [PREEXISTING] P3 I1 C2 — Small Rails idiom issues

- [PREEXISTING] P3 I1 C2 — **`Case` initialization.** `Case` uses `after_initialize` to default
  `archived` and to call `set_scorer`
  (`app/models/case.rb:95,99`). `set_scorer` can query the database for
  every instantiated record whose `scorer_id` is nil. Move the `archived`
  default into the migration (as a column default) or into an `attribute`
  default, and set the scorer `before_validation on: :create` instead.
- [PREEXISTING] P3 I0 C1 — **`where(...).first`.** Review remaining scalar-primary-key
  lookups for scoped `find_by`, retaining authorization and existing nil/redirect/404
  handling. Leave non-unique try-number/document-ID, ordered/history and ambiguous
  email-or-ID selection unchanged. Optional/request-parameter IDs remain deferred
  because arrays can match multiple rows and `find_by` drops implicit ID ordering.

## [PREEXISTING] Developer Experience Review

### [PREEXISTING] P2 I2 C1 — 2. Reconcile onboarding, Docker and frontend documentation

Use the established destinations in the [Documentation index](../README.md).

- [PREEXISTING] P2 I2 C1 — Replace conflicting operational advice with safe, complete procedures for identifying and reusing the running server. The guide currently recommends throwaway commands during development, killing port owners, resetting the environment and pruning Docker resources, while agent guidance requires preserving the server. Once the shared procedures are correct, link to them from `AGENTS.md` and remove duplicated human-facing policy. Retain agent-specific safeguards.

### [PREEXISTING] P2 I2 C2 — 3. Add safe execution support for existing server containers

`bin/docker s` / `q` start servers through `docker compose run`; `r`, `b` and `c` create separate containers. Add an explicit exec command that recognizes actual `quepid-app-run-*` servers and refuses ambiguous choices, preserving startup semantics.

Until that exists, use `docker exec <actual-server-container>` or `docker compose exec app` for an existing service container. Do not infer that the server is stopped from an empty Compose service listing.

## Someday

### [PREEXISTING] P3 I1 C2 — Log skipped rows in TREC and similar exports for review

`TrecExport` skips snapshot docs that have no rating, and the other text and CSV exports leave out or blank rows they can't render. Nothing tells the user or an admin that rows were dropped.

**Future idea only:** record each skipped row (export format, case, snapshot, query, doc, reason) in a log or a small reviewable list, so people can see what an export left out. The export itself must keep succeeding; logging must never raise or block the download.

Revisit if users report exports that look incomplete.

### [PREEXISTING] P2 I1 C1 — Try API clone loses tuning variables

Scenario 18.2 reproduced a clone with empty `curator_vars` from a source containing
`boost=2`. `Api::V1::Clone::TriesController#create` calls
`@try.add_curator_vars` on the source instead of the new try. The same call exists
at Legacy `8ceb99e9` (source comparison only; no historical live replay).
Copy variables onto the clone and verify source immutability and cloned args.

### [PREEXISTING] P2 I1 C2 — Judging shortcut can submit while the explanation modal opens

Scenario 15.8 reproduced one rating POST when A was pressed immediately after
**I Can't Tell**, before the modal acquired `show`; the audit retained rating 0.
Typing and settled-modal exclusions pass. Current `judgement_rating_controller.js`
and Legacy `8ceb99e9`'s inline judging handler both guard only `.modal.show` before
scheduling a delayed click. Live replay 2026-10-28 on Legacy `8ceb99e9` (:3001) and
Current, cancelling the form submit to avoid writing judgements: pressing A then
opening **I Can't Tell** within 500 ms submits rating 0 on both; pressing A with the
modal settled open submits nothing on both; clicking the A button directly while the
modal is open submits on both (`rate` has no modal check). Not a migration regression.
Guard the opening transition and cancel/recheck pending shortcut timers when the
modal opens, and have `rate` ignore clicks while a modal is open; verify that
cancelling the modal creates no judgement. The finding's "edit loss" half was never
described and has not been reproduced.

### [MIGRATION-FOLLOWUP] P2 I1 C2 — Classify concurrent case-evaluation deadlock

Scenario 18.6 queued two evaluations of the same disposable case: one finished,
one failed with a MySQL deadlock. HTTP 200 acknowledged both jobs. Legacy
`8ceb99e9` also permits two concurrent evaluation jobs, but source comparison does
not establish the origin of this database failure. Reproduce against Current and
the historical implementation in isolated fixtures before choosing a fix; retain
job failure evidence rather than treating queue acknowledgement as completion.

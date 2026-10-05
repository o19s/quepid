# Todo

**Last updated:** 2026-10-05

Outstanding bugs, hardening, and cleanup in the current codebase. When something is fixed, remove its entry — do not add a completed section or keep resolved items for history.

Every actionable item carries a provenance marker: `[MIGRATION]` means it was
introduced by or is required to complete AngularJS removal, `[MIGRATION-FOLLOWUP]`
means it is related cleanup but not necessarily a migration regression, and
`[PREEXISTING]` means it predates the AngularJS removal. Use these markers when
choosing migration work; do not treat pre-existing defects as migration regressions.
The pre-migration baseline is `be9b319a` (`main` before the Bootstrap 3→5 and
AngularJS-removal work began). Later `main` commits already include migration
changes, so don't use them to decide provenance.

Ratings appear as `P2 I3 C1` beside each item. These are initial estimates
based on the described scope; revise them when implementation reveals more.

| Rating | 0 | 1 | 2 | 3 |
| --- | --- | --- | --- | --- |
| **P — Priority** (lower is more urgent) | Critical | High | Normal | Opportunistic |
| **I — Simplification impact** (higher is more benefit) | Little or no code reduction | Local simplification | Removes duplication or complexity across several paths | Substantial reduction in wrappers, code, or maintenance burden |
| **C — Complexity / risk** (lower is easier and safer) | Trivial, isolated edit | Small change with limited regression risk | Several interacting paths or meaningful behavioral risk | Broad change, sensitive data/security contracts, or unresolved design decisions |

Impact measures expected reduction in code and maintenance complexity, not
user benefit or security importance; an urgent bug can be `P0 I0`. Complexity
includes verification effort and regression risk, not just lines changed.
Choose by priority first, then favor higher impact and lower complexity within
a priority tier. For example, `P2 I3 C1` offers more simplification for less risk
than `P2 I1 C3`. Group ratings summarize scope; nested items have their own estimates.

Source audit: 2026-10-05 against `4bf88e5b` and the working tree. This review
checked current implementations, recent changes and existing tests/verification
records; it did not rerun browser flows or tests. Historical observations below
are retained only where the current source still supports the unresolved issue.
Browser coverage and actual verification timestamps live in
`docs/manual-testing/tracking.yml`.
Line numbers may drift — re-check cited files before fixing.

## [MIGRATION-FOLLOWUP] Frontend cleanup after Angular removal

### [PREEXISTING] P0 I1 C3 — Scorer sandboxing - LATER

Client scorer code still executes through `new Function()`; evaluate a Web
Worker or equivalent browser isolation. The batch path already uses the shared
scorer runtime through V8/MiniRacer; keep browser and batch scorer behavior
aligned when adding isolation.

### [PREEXISTING] P2 I0 C2 — Accessibility - LATER

Score and rating controls still convey state by color alone; add text or icons so state is not color-only, and cover it with the relevant Playwright scenario.

axe-core flags two unlabeled `<select>`s as critical (`select-name`): the API snapshot picker in the Export modal (`shared/_export_case_core_modal.html.erb`) and each snapshot picker in Compare Snapshots (`diff_core_controller.js` builds a `<label>` that isn't tied to its select). Both were unlabeled on `main` too. Associate the labels (`for`/`id` or `aria-label`). The same scan reports `heading-order` in the Export, Compare Snapshots and Judgements modals (scenario 16.4).

The query-list sort controls (Manual, Name, Modified, Score, Errors) are `<a>` elements without `href`, so they can't be reached with the keyboard. Make them buttons. Not compared against `main`.

---

### [MIGRATION-FOLLOWUP] P3 I1 C2 — Replace the tether-shepherd tour globals

`core_vendor.js` puts `Tether` and `Shepherd` on `window` because `tour.js`
expects bare globals. `tether-shepherd` is a dated dependency; choosing a
replacement tour library is its own decision, after which converting `tour.js`
to imports is cheap. `bootstrap_globals.js` and `vega_globals.js` load UMD
builds for their own data-API/consumer reasons; revisit them separately.

---

## [MIGRATION-FOLLOWUP] Angular remnants, Stimulus/Turbo retrofit, and frontend DRY

AngularJS removal is complete; remaining work concerns ownership, lifecycle and
optional simplification. Ordinary management/admin pages now enable Turbo Drive
through `application_modern.js`. The case workspace uses the shared Rails layout
but keeps a separate bundle with Drive disabled and a destination reload boundary;
standalone analytics also forces a fresh document. Frames and Streams remain
available on the case page. Shared layout/header markup does not make runtime
lifecycle or per-surface behavior interchangeable.

Follow [DEVELOPER_GUIDE.md — Turbo navigation](../../DEVELOPER_GUIDE.md#turbo-navigation)
and [Turbo on the case page](../../DEVELOPER_GUIDE.md#turbo-on-the-case-page)
for the current contracts. Actual Drive verification and deferred coverage are in
[turbo_drive.md](turbo_drive.md) and manual scenario 15.8. Existing retrofit
constraints and historical work are in
`docs/archived/stimulus_turbo_retrofit_completed.md`.

### [MIGRATION-FOLLOWUP] P3 I2 C3 — Evaluate moving the case JavaScript entry onto importmap

Independent of the layout/header merge. The installed `splainer-search` 3.3.0
ships ESM sources (`wired.js` and its dependency tree) as well as IIFE dist
bundles; it is not IIFE-only. Inventory the full browser dependency graph,
including `sortablejs`, `splainer-search/wired.js`, and transitive dependencies,
before choosing pins or an ESM bundle boundary. Retaining esbuild for the heavy
case workspace is acceptable if importmap adds complexity without a useful gain.

Preserve one Stimulus application, one Turbo instance, and one initialization of
the case runtime. Do not load both `application_modern.js` and the existing case
bundle without resolving overlapping initialization. Audit vendor globals and
script order before removing or replacing either bundle.

**Acceptance:** record the loading decision and dependency inventory. If changing
loading, pass relevant unit tests, lint and builds, then verify search, rating and
score updates, sorting, modal/drawer behavior, and case-to-management navigation
with inspected before/after screenshots. Record sampled/deferred manual coverage.

### [MIGRATION-FOLLOWUP] P3 I1 C2 — Rename case-only `_core` controllers and modal partials

Inventory `controllers/*_core_controller.js`
and `shared/_*_core_modal.html.erb` and remove suffixes that only mean "lives on
the case page". Keep distinct names for features with different per-surface
behavior, notably `share-case` and `share-case-core`. Asset-loader changes are
not a prerequisite. Rename references together across registration, ERB actions,
outlets, tests, docs and manual-tracker paths; avoid standalone cosmetic churn.

**Acceptance:** search for stale references, pass affected unit/rendering tests,
lint and builds, and browser-smoke the renamed controllers' connections and
outlets. Record sampled/deferred coverage and retain inspected screenshots for
the sampled interactions.

### [MIGRATION-FOLLOWUP] P3 I1 C2 — Move remaining `utils/` DOM lifecycles into controllers (retrofit Track E)

`dynamic_modal.js`, `detailed_document_modal.js`, `destructive_form.js` and
`status_message.js` still manage DOM state or events outside Stimulus. Static
modal shells already live in `shared/_dynamic_modal_templates.html.erb`; preserve
that Rails-owned markup and consider moving the remaining lifecycle/behavior
into controllers or controller mixins. Management caching now has a
`page-cache` controller; reuse its existing boundary where relevant. The case
workspace still navigates as a full page, so its destructive-form helper is not
a reason to add global Turbo opt-outs or convert every submission. Leave thin Bootstrap
wrappers (`bs_modal`, `bs_tooltip`, `bs_popover`) as helpers. Opportunistic.

### [MIGRATION-FOLLOWUP] P3 I2 C3 — Server-rendered modal lists (retrofit Track D, blocked) - BLOCKED

`pick_scorer_core` (scorer lists), `share_case_core` (team list), `diff_core`
(snapshot selects), and possibly `judgements_core` and `export_case_core`
build lists from JSON in JS. They could become partials loaded through lazy
`<turbo-frame src=...>`, like `dropdown/cases_core.html.erb`, and modal form
posts could be answered with Turbo Streams. The annotations list
(`annotations_controller.js`) is the cleanest candidate: it is entirely
server-owned, so a lazy frame plus Turbo Stream answers to create, edit and
delete would remove its client-side rendering (it would still dispatch
`annotations:changed` for `qgraph`).

**Blocked by the endpoint-design decision:** parallel HTML endpoints for the
case page are not wanted for now. Enabling Drive on management pages does not
lift that constraint; case Frames/Streams already work with Drive disabled. If
that changes, pilot `pick_scorer_core` or annotations and prove selection and the
edit modal work inside a lazy frame first.

### [MIGRATION-FOLLOWUP] P3 I0 C1 — Close retrofit manual-verification gaps

Custom scorer creation (8.3), book creation (10.2) and the non-admin scorer
edit branch (8.4) are now verified live. The templated ES query branches were
sampled on the ES demo cluster, which has a stored `tmdb-title-search-template`.
To reproduce, give a try on an ES case the query params
`{"id": "tmdb-title-search-template", "params": {"search_query": "#$query##"}}`.
Search goes through `/_search/template` and Explain Query → Query Template
renders the `/_render/template` output. A forced render failure shows "Unable
to render the query template.", and a plain query shows "This is not a
templated query." A background rerun of that try (4.12) queued
`RunCaseEvaluationJob`, which completed its fetch snapshot. Creating a book from
an unshared case's Judgements modal (6.6) saved the case-sync toggles. 4.12, 6.6
and 6.7 are still due for their other branches and were not re-stamped.

Still unsampled: 6.6's sync toggles on an already-linked book and the 50+ query
background redirect; 10.3's AI judge, upload and multi-team permission
branches; 17.2/17.3 job pacing and concurrency; 4.16's blank save.

### [MIGRATION-FOLLOWUP] P3 I1 C2 — Replace test-override shims with `vi.mock`

`core_test_overrides.js` and the test-override branches in
`core_store_access.js`, `core_capability_access.js` and `core_flash.js` let specs
inject fakes into production modules. Replace those injection seams with
`vi.mock` when touching the specs; many specs already use it. Keep the named
store/capability accessors as production boundaries unless their consumers are
also deliberately redesigned. The flash `Proxy` exists solely for overrides
and can become a plain object once its specs mock the module.

Settle the controller-facing flash API in this same scope (former JS DRY J14).
Some controllers use `coreFlash.show`; Annotations, Judgements and Export
import `showFlash` directly, bypassing the override-aware Proxy. Choose one
public convention after migrating the relevant test injection seams.
Keep `utils/flash.js` as the event implementation and preserve target selection,
structured search-error parts and the explicit HTML option. Inline status
messages remain a distinct UI contract.

---

### [MIGRATION-FOLLOWUP] P3 I1 C1 — Adopt the shared controller fixture in remaining specs

`test/javascript/support/controller_fixture.js` (see
`docs/js_tooling.md#controller-test-fixtures`) is already used by many
controller specs.
Adopt it in smaller specs when touched. Separately, mounting real Stimulus
against real markup would catch ERB target/action drift the fixture can't;
use it for new specs and convert old ones when touched, not big-bang.

### [PREEXISTING] P2 I0 C2 — Audit GET mutations before enabling Turbo prefetch

Management/admin layouts explicitly disable hover prefetch with
`<meta name="turbo-prefetch" content="false">`. Keep that guard while auditing
`config/routes.rb` and the actions behind GET links. Confirmed mutations include
`JudgementsController#judge_later` (persists a judgement) and
`SessionsController#destroy` (`GET /logout`). The search-endpoint clone GET only
prepares an unsaved form; scorer cloning already uses POST. Audit the actual
side effects rather than converting every route named `clone`. Judging selection also advances a session counter on
GET; account for that when deciding which destinations can be prefetched.

**Fix direction:** move persistent mutations to POST/PATCH/DELETE with
server-owned form URLs, appropriate confirmation and 303 redirects. Preserve
explicit session opt-outs. Audit other GET side effects and protect intentionally
non-prefetchable destinations before considering removal of the global guard.
Test that GET/hover causes no persistent mutation, deliberate submissions run
once, and Drive/history navigation preserves the intended judging flow.
Drive enablement is complete; prefetch remains a separate decision. The
judge-later and logout GET routes also exist in the `be9b319a` baseline
(source comparison, not a live historical replay).

### [PREEXISTING] P3 I0 C2 — Identify API endpoints only the Angular client used

Compare historical Angular consumers with current routes and callers. The API
is also public (scripts, notebooks), so an endpoint the UI no longer calls is
not necessarily dead. Only worth doing alongside an API
review.

---

## [PREEXISTING] P0 — Product bugs

### [PREEXISTING] P0 I1 C3 — Try delete orphans scores

**Observed:** Scores keep a stale `try_id` after the try is deleted. (The `PUT /api/cases/:id/scores` 500 on an orphaned `last_score` is fixed — `same_score_source?` now treats a nil try as a different source.)

**Cause:** No cascade/nullify from try → scores (`case_scores.try_id` has no FK).

**Fix direction:** Cascade or nullify scores on try destroy.

---

## [PREEXISTING] P0 — Security

### [PREEXISTING] P0 I1 C2 — User API IDOR and cross-account write path

**Location:** `app/controllers/api/v1/users_controller.rb:24-48`, `test/controllers/api/v1/users_controller_test.rb:30-39`

`set_user` looks up any user by email or numeric ID without scoping to `current_user`, and `update` permits `company`, `completed_case_wizard`, and `default_scorer_id`. The existing test codifies one signed-in user fetching another's record. Unless this is an intentional admin directory, it exposes account metadata and allows cross-account changes.

**Fix direction:** Scope ordinary requests to `current_user`. If admin lookup is needed, make it a separate admin-only endpoint with its own serializer and authorization test.

---

## [PREEXISTING] P1 — Product bugs

### [PREEXISTING] P1 I1 C2 — Uploading the judgements export imports nothing and reports success

**Location:** `app/services/book_importer.rb:66`, `app/views/api/v1/judgements/index.json.jbuilder`, `app/views/books/import/edit.html.erb:71`

The Import Judgements panel tells users verbatim: *"The format for importing Judgement data is the same as that for exporting it: `/api/books/:id/judgements`"*. That endpoint emits a top-level **`judgements`** key; `#import` only reads **`all_judgements`**, and nothing normalizes between them (`grep all_judgements app/controllers app/jobs app/services` → importer only). So the advertised round-trip drops every row, `#import` still returns `true`, and the user gets "Data was successfully queued for import."

**Status:** Confirmed by reading; not driven through the UI. Two nearby format mismatches in the same panel, worth fixing together: the export's per-judgement `judgement_id` key isn't a `Judgement` attribute (the `ASSIGNABLE_JUDGEMENT_KEYS` allowlist now drops it), and the panel's promise that *"If you do NOT provide a `query_doc_pair_id` then you must provide `query_text` and `doc_id`"* isn't implemented — `find_query_doc_pair` returns nil for a blank id and `import_all_judgements` then does `next unless qdp`, silently dropping the judgement. Only the nested-`query_doc_pair`-object form actually upserts.

**Fix direction:** Pick one canonical envelope and add a fixture-based export → import round-trip test. Accept `judgements` as an alias for `all_judgements` (or make the export emit `all_judgements`), implement the flat `query_text`/`doc_id` fallback through `find_or_initialize_query_doc_pair`, and either way make a payload that matches zero rows report that instead of flashing success.

---

### [PREEXISTING] P1 I1 C3 — Wizard TLS reload exposes basic-auth credentials

**Location:** `app/javascript/controllers/wizard_controller.js`, `renderTls`

The protocol-switch link places `basicAuthCredential` in the query string. A
credential entered during wizard setup can therefore leak through browser
history, server/proxy logs, referrers, and the subsequent `CoreController`
request. This behavior predates AngularJS removal; it was carried forward while
restoring the TLS handoff.

**Fix direction:** Preserve pending wizard state server-side or behind a
short-lived opaque token, and never put the credential itself in a URL.

---

### [PREEXISTING] P1 I1 C3 — Wizard TLS reload loses endpoint-specific settings

**Location:** `app/javascript/controllers/wizard_controller.js`, `applyReloadParams`

The protocol-switch reload reapplies engine defaults and restores only the URL,
case name, API method, and basic-auth credential. Custom query parameters,
headers, mapper code, test query, field selections, and intentionally empty
values can be replaced or lost. This was also present in the Angular wizard and
is not a deangularization regression.

**Fix direction:** Preserve the complete pending endpoint configuration across
the reload, including explicit empty values, without reapplying defaults over
user-entered settings.

---

### [PREEXISTING] P1 I1 C3 — Account deletion fails for users who sent invitations, after deleting their cases

**Observed:** Deleting an account (Profile → Danger Zone) whose user has invited anyone (a pending invitee row with `invited_by_id` pointing at them) returns a 500: `ActiveRecord::InvalidForeignKey` on `fk_rails_ae14a5013f` (`users.invited_by_id → users.id`). The account survives, but its unshared cases are already gone — `AccountsController#destroy` calls `c.really_destroy` for each team-less case *before* `@user.destroy`, outside a transaction.

**Cause:** Nothing nullifies `users.invited_by_id` for invitees, and the case cleanup plus user destroy are not atomic. Same code on `main`.

**Fix direction:** Nullify `invited_by_id` on invitees before destroying the user (e.g. a `has_many :invitations, class_name: 'User', foreign_key: :invited_by_id, dependent: :nullify`), and wrap case cleanup + user destroy in one transaction so a failure leaves the account's data intact. Add a controller test that deletes a user with a pending invitee and an unshared case.

---

## [PREEXISTING] P1 — Security

### [PREEXISTING] P1 I0 C2 — Outbound HTTPS certificate verification is disabled globally

**Location:** `app/services/http_client_service.rb:91-101`

`HttpClientService` sets `faraday.ssl.verify = false` for every request (proxy, mapper wizard, downloads, search calls), permitting man-in-the-middle interception of credentials and API keys.

**Fix direction:** Remove the override. If development needs a custom CA, use a CA bundle or an explicit development-only opt-in. Add a test that production clients verify certificates.

---

### [PREEXISTING] P1 I1 C3 — Proxy SSRF controls are incomplete

**Location:** `app/controllers/proxy_controller.rb:105-120`, `app/services/http_client_service.rb:91-99`

The proxy validates the initial DNS resolution and blocks private ranges, but Faraday resolves the host again when making the request (DNS-rebinding window), and redirect following means an allowed public URL can redirect to an internal address without revalidation.

**Fix direction:** Use a single validated connection target, disable redirects by default, or validate each redirect target. Tests: redirect-to-private-address, IPv6/link-local, rebinding, non-default ports, credential forwarding.

---

### [PREEXISTING] P1 I1 C3 — Secrets exposed through API serializers and admin views

**Location:** `app/models/concerns/maskable_credential.rb:21-28`, `app/views/api/v1/search_endpoints/_search_endpoint.json.jbuilder:11-15`, `app/views/api/v1/tries/_try.json.jbuilder:22-25`, `app/views/admin/users/index.json.jbuilder:7-9`, `app/views/admin/users/show.html.erb:88-92`

`api_basic_auth_credential` is returned in full unless `REQUIRE_PROXY_WITH_BASIC_AUTH_CREDENTIALS` is enabled (default false), so shared endpoint members receive stored credentials in endpoint and try responses. Admin user JSON/HTML also render the encrypted password hash.

**Fix direction:** Never serialize credentials or custom secret headers; return a masked/presence-only value and proxy server-side when secrets are needed. Make this unconditional rather than flag-dependent. Remove password hashes from admin views.

---

### [PREEXISTING] P1 I0 C3 — Static Active Record encryption keys committed as production fallbacks

**Location:** `config/application.rb:55-61`

Deployments that omit the env vars use publicly known keys, so encrypted fields are recoverable by anyone with the database.

**Fix direction:** Fail fast in production when keys are absent; keep generated dev/test defaults out of production config; document key rotation and backup.

---

### [PREEXISTING] P1 I1 C3 — Proxy CSRF bypass and permissive CORS / Action Cable origins

**Location:** `app/controllers/proxy_controller.rb:5-8`, `config/initializers/cors.rb:6-17`, `config/environments/production.rb:41-50`

`fetch` skips CSRF verification (`skip_before_action :verify_authenticity_token`) for GET and POST while requiring login, so cross-site POSTs from an authenticated session remain possible. Production also allows every CORS origin, disables Action Cable request forgery protection, and accepts every Action Cable origin.

**Fix direction:** Restrict CORS to configured origins with credentials off unless needed; derive Action Cable allowed origins from the deployment host list; give the proxy a CSRF token or a deliberately token-authenticated route.

**Also open:** no rate limiting on proxy fetch (production concern when `proxy_requests: true`).

---

### [PREEXISTING] P1 I2 C3 — Authenticate the Cable connection for job progress

**Remaining:** `ApplicationCable::Connection` still needs session authentication. Signed stream isolation does not revoke an already copied subscription token when its holder logs out.

---

## [PREEXISTING] P2 — Security

### [PREEXISTING] P2 I0 C0 — Password reset enumerates accounts

**Observed:** Unknown email → "email was not found"; known email → neutral "you will receive…" message.

**Cause:** `config.paranoid` commented out in `config/initializers/devise.rb`.

**Fix direction:** Enable `config.paranoid = true` (or normalize both responses).

### [PREEXISTING] P2 I0 C2 — No minimum password length

**Observed:** Resetting a password through the reset link with `abc` succeeds and the user can then log in with it. Manual test 1.4's short-password edge case expects a validation error.

**Cause:** `User` validates only presence and `maximum: 80` on `password` (`app/models/user.rb`). `config.password_length = 8..72` in `config/initializers/devise.rb` is never applied because `:validatable` is not enabled.

**Fix direction:** Add a minimum length validation (match the Devise 8..72 setting) on password create/change paths, then check seed data, fixtures, and existing tests for shorter passwords.

---

## [PREEXISTING] P2 — Product bugs

### [PREEXISTING] P2 I0 C1 — TREC export with a snapshot 500s on any unrated snapshot doc

**Location:** `app/views/api/v1/export/ratings/show_trec_snapshot.txt.erb:3`

**Observed:** Export → TREC with a snapshot picked in the Basic/TREC dropdown calls `/api/export/ratings/:case_id.txt?file_format=trec_snapshot&snapshot_id=…`, which fails with `NoMethodError (undefined method 'rating' for nil)` whenever a snapshot doc has no rating. The modal then flashes "Export failed. Please try again." Reproduced 2026-10-04 on a clone of case 6 (snapshot 98); the template is identical at the `be9b319a` baseline. Plain TREC (no snapshot) works.

**Fix direction:** Skip unrated docs (or write an explicit unrated value) instead of dereferencing a nil `Rating`, and add a controller test with an unrated snapshot doc.

---

### [PREEXISTING] P3 I0 C1 — A newly added query jumps from the bottom to the top on reload

**Location:** `app/controllers/api/v1/queries_controller.rb` (`create`)

**Observed:** Adding a query shows it at the bottom of a Manual-sorted list, but after a reload (or anything that re-bootstraps the case, such as Rerun My Searches! creating a new try) it is at the top. The `create` response's `display_order` lists the new id last, while `index` lists it first. The `Case#queries` scope orders `arranged_at IS NULL DESC`, so a new, unarranged query sorts first in the database, and `create` builds `display_order` from the association it just built on, which appears to put the in-memory record last. Reproduced 2026-10-04 on case 598. The controller is unchanged from `main`, and the `be9b319a` Angular client also applied the `create` response's `display_order`, so this predates the migration (source evidence only, not replayed).

**Fix direction:** Reload the association (`@case.queries.reload`) before building `display_order` in `create`, and add a controller test that `create` and `index` return the same order.

---

### [PREEXISTING] P3 I0 C1 — Book Import tab reports "Invalid JSON" when no file is chosen

**Location:** `app/controllers/books/import_controller.rb` (`load_import_params`)

**Observed:** On an existing book's Import tab, submitting **Import Query Doc Pairs** with no file shows "Invalid JSON file: Unable to process the provided data structure. undefined method '[]' for nil" instead of "You must select the file to be imported first." That form has no other `book[...]` field, so `params[:book]` is nil and `params[:book][:import_file]` raises into the generic `StandardError` rescue. The judgements form and new-book import carry `book[force_create_users]`, so they show the right message. Reproduced 2026-10-04 on book 33; the same lookup exists at `be9b319a`.

**Fix direction:** Read the file with `params.dig(:book, :import_file)` and add a controller test that submits the pairs form without a file.

---

### [PREEXISTING] P2 I2 C3 — Judgement rating not validated against book's scale (outside AI judging)

**Observed:** `Judgement#rating` only validates presence, never that the value is actually one of the book's configured scale values. `Api::V1::JudgementsController#update`, `JudgementsController`, and `BulkJudgeController#save` (`judgement.rating = params[:rating]`, no scale check) all write a client-supplied rating with no scale check — they're only "safe" today because the judging UI happens to render buttons limited to the book's actual scale values; nothing stops a raw form/API POST from bypassing that. The AI-judging path (`app/jobs/run_judge_judy_job.rb`, hardened in `37840b47`) is the only one with a guard, and it's job-local.

**Cause:** No model-level validation ties `Judgement#rating` to `query_doc_pair.book.scale`.

**Audit result (done):** Two call sites *legitimately* write ratings outside the discrete scale, both gated on `book.support_implicit_judgements?`:
- `[PREEXISTING]` `BooksController#combine` (`app/controllers/books_controller.rb:277`) averages two existing ratings — `(judgement.rating + j.rating) / 2` — and explicitly skips rounding when `support_implicit_judgements` is true (e.g. `(0+3)/2 = 1.5` on a `[0,1,2,3]` scale).
- `[PREEXISTING]` `JudgementFromRatingJob#perform` (`app/jobs/judgement_from_rating_job.rb:24`) copies a case-level `Rating#rating` straight into `judgement.rating` via `judgement.save!` (raises on failure) — that value comes from the case's scorer scale, which has no guaranteed relationship to the book's judgement scale.

`BookImporter`/`RatingsImporter` are fine: `RatingsImporter` writes the unrelated `Rating` model, and `BookImporter#import_judgement` already silently no-ops on failed saves.

**Fix direction:** Add an `inclusion` validation on `Judgement` for required ratings (preserve `rating_not_required?` for unrateable/judge-later rows), scoped to `query_doc_pair.book.scale`, conditioned `unless: -> { query_doc_pair&.book&.support_implicit_judgements? }` (safe-navigate — `query_doc_pair` is a required `belongs_to` but its own presence validation runs independently, so a blank `query_doc_pair` must not blow up this lambda with a `NoMethodError`) so the two legitimate continuous-rating paths above stay unaffected. Change `JudgementFromRatingJob` to `save` + handle a validation failure instead of `save!` (a case rating can legitimately be off-scale for an explicit-only book). Retire the job-local check in `run_judge_judy_job.rb` in favor of the model validation (catch the failure, call `mark_unrateable`).

Also audit coercion and aggregation across rating writers (former DRY #15).
`BooksController#combine` and `RatingsManager` round unless the book supports
implicit judgements; bulk judging, the judgements API, `JudgementFromRatingJob`
and `LlmService` do not all apply that rule. `combine` uses a pairwise mean,
while `RatingsManager#calculate_rating_from_judgements` uses a different
aggregation rule. Decide intended semantics before centralizing coercion in
`Judgement`; check bulk writers that bypass callbacks and preserve legitimate
continuous ratings. Changing rounding or aggregation changes stored ratings
and scores, so keep it separate from behavior-preserving cleanup.

The explicit `unrateable`/`judge_later` resets in `BulkJudgeController#save`
are redundant: `Judgement#rating=` already clears both for a non-nil rating.
Removing just those resets is a separate small no-op cleanup.

---

### [PREEXISTING] P2 I1 C3 — `BooksController#combine` collapses anonymous judgements into one averaged row

**Location:** `app/controllers/books_controller.rb:275` — `combine`

The merge loop upserts each source judgement with `query_doc_pair.judgements.find_or_initialize_by(user: j.user)`. `Judgement` deliberately permits several nil-user rows per pair (`validates :user_id, uniqueness: { scope: :query_doc_pair_id }, unless: -> { user_id.nil? }`), so *every* anonymous judgement in the source book matches the same target row. N anonymous judgements collapse to 1 — and because the same loop averages (`(judgement.rating + j.rating) / 2`), the surviving rating is an order-dependent running mean, not a true average.

**Reproduced** by running the verbatim inner loop against the test DB (a script, not a Playwright pass): a source pair carrying anonymous `[1.0, 3.0, 3.0]` produced **one** target row rating `2.5`, where the true mean is 2.33.

**Cause:** Same root cause as the import bug fixed in `BookImporter#import_judgement` on 2026-09-10 — `find_or_initialize_by(user: nil)` treats "no judge" as an identity.

**Fix direction:** Needs a product call first: should anonymous judgements copy across as separate rows (mirroring the importer, no averaging), or keep collapsing into one averaged row? If separate, skip the find when `j.user.nil?` and `build` unconditionally. Note the averaging is order-dependent even for identified users once you merge 3+ books; the same `combine` line is already documented under the judgement-scale validation item above for a different reason.

---

### [PREEXISTING] P2 I1 C3 — Re-importing anonymous judgements is not idempotent, and it moves computed case ratings

**Location:** `app/services/book_importer.rb` — `import_judgement`

An anonymous judgement has no identity to upsert on, so as of the 2026-09-10 fix each import `build`s a new row (the alternative — `find_or_initialize_by(user: nil)` — collapsed all of them into one, which was worse). The accepted cost is documented in the code and in `docs/manual-testing/10-books-management.md`. What makes it more than cosmetic: `RatingsManager#calculate_rating_from_judgements` averages 1-2 judgements but takes the **min of the top 3** at 3 or more, so duplication can move a rating a user never re-judged — `[3.0, 0.0]` → 1.5 becomes `[3.0, 3.0, 0.0]` → 0.0. Pinned by `test/services/book_importer_test.rb`'s "re-importing anonymous judgements duplicates them and moves the computed case rating".

**Reached by** the ordinary export → re-import path, since `_judgements.json.jbuilder` emits `user_email` only `if judgement.user`, so exported anonymous rows come back identity-less; also by a Mission Control retry of a failed `ImportBookJob` (no job-local `retry_on`; `DeferredPayload.consume` retains the upload on failure and purges it only after the import block succeeds), and plausibly by a double-submitted import form.

**Fix direction:** Needs a product call, same as the `combine` entry above. Option: treat a payload's `judgements` array as authoritative for a pair's *anonymous* set — `query_doc_pair.judgements.where(user: nil).delete_all` before building the incoming user-less ones — which keeps upsert semantics for identified judges and makes repeated imports converge. Wrong answer if a book legitimately accumulates anonymous judgements across several import files.

---

### [PREEXISTING] P2 I1 C2 — `Api::V1::JudgementsController#create` keys its lookup off `:user` but assigns `:user_id`

**Location:** `app/controllers/api/v1/judgements_controller.rb:80`

`find_or_create_by(query_doc_pair_id: ..., user_id: judgement_params[:user])` looks up on `:user`, while eight lines later the judge is assigned from `judgement_params[:user_id]`. The lookup therefore runs with `user_id: nil`, which can match an existing *anonymous* judgement on that pair and then re-attribute it to the posting user: a silent overwrite of someone else's rating instead of a new row.

**Status:** Confirmed by reading `extract_judgement_params` — `:user` is **not** in its permit list (`:rating, :unrateable, :judge_later, :query_doc_pair_id, :user_id, :explanation`), so `judgement_params[:user]` is always nil and the lookup key is *always* `nil`, not just when a caller omits it. Consequences in order: the endpoint never attributes a judgement to anyone unless the caller passes `user_id`; when a caller does pass it, the request adopts and re-attributes an existing anonymous row; two API clients judging the same pair fight over one row. Deferrable because nothing in Quepid's own frontend calls it (checked current `app/javascript` callers) — this is external API surface only. Note the existing controller test asserts only a `judgements.count` delta, so it passes either way. Same bug family as the `BookImporter` nil-user work of 2026-09-10.

**Fix direction:** Decide which key is canonical, use it in both places, and guard the lookup so a nil judge cannot adopt an existing anonymous row.

---

### [PREEXISTING] P2 I1 C2 — Snapshot CSV `Snapshot Time` parses two-digit years as year 00YY

**Observed:** Importing a snapshot CSV (cases list → Import Snapshots from CSV) with `Snapshot Time` `10/01/26 18:05` stored `created_at` as `0010-01-26 18:05`, shown as `(1/26/10)` in Compare Snapshots. The modal's own sample format (`10/10/18 18:05`) has the same problem.

**Cause:** `import_snapshot_controller.js` posts the raw string as `created_at`; the server's time parsing reads `NN/NN/NN` as year/month/day. The Angular importer passed the string through the same way.

**Fix direction:** Parse `Snapshot Time` explicitly (document the accepted formats, e.g. ISO 8601 and `MM/DD/YY HH:MM`) and reject unparseable values with a row-numbered error instead of storing a wrong date. Fix the sample in the modal to an unambiguous format.

---

### [PREEXISTING] P2 I0 C1 — New-team form shows no validation errors

**Observed:** Submitting `/teams/new` with a blank name, or a name another team already uses, re-renders the form with no message. (Rename on the team page does show "Name can't be blank".)

**Remaining cause:** `app/views/teams/new.html.erb` still doesn't render
`@team.errors`. `TeamsController#create` now returns 422 on failure, so Turbo
can display the invalid form, but users still receive no validation message.

**Fix direction:** Render the shared error-messages partial on `teams/new`.
Cover blank and duplicate names with rendering assertions and a Drive submission
that keeps the entered value and displays the validation message.

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

## [PREEXISTING] P1 — Backend correctness and authorization

### [PREEXISTING] P1 I1 C2 — Elasticsearch/OpenSearch document IDs are not persisted

**Location:** `app/services/fetch_service.rb:75-100,118-125`

The Elasticsearch/OpenSearch extractor stores the backend identifier as
`doc[:_id]`, while snapshot persistence reads `doc[:id]`. Results from these
engines can therefore create `SnapshotDoc` rows with a blank document ID,
breaking later judgement, snapshot comparison, and document identity behavior.

**Fix direction:** Normalize the extractor to the same `:id` contract used by
Solr and Search API results, then add an extractor-to-`SnapshotDoc` regression
test for both Elasticsearch and OpenSearch.

### [PREEXISTING] P1 I1 C3 — Mapper wizard function extraction is not lexical-aware

**Location:** `app/services/mapper_wizard_service.rb:265-296`

`extract_single_function` counts every brace, including braces inside strings,
comments, and regular expressions. Generated mapper code containing one of
those can be truncated before it is saved.

**Fix direction:** Use a JavaScript-aware extraction strategy or the existing
V8/parser path, and add regression cases for braces in strings, comments, and
regular expressions.

### [PREEXISTING] P1 I1 C2 — Safe LLM judgement handling misses malformed success bodies

**Location:** `app/services/llm_service.rb:32-40,209-220`

`parse_response` calls `JSON.parse` on model content, but
`perform_safe_judgement` does not rescue `JSON::ParserError` or a missing
content value. A successful HTTP response with malformed model output can
escape the safe-judgement path and leave the job unhandled.

**Fix direction:** Treat malformed/missing content as an unrateable judgement
with the same recorded explanation as other safe-judgement failures, and add
tests for malformed JSON and missing provider content.

### [PREEXISTING] P1 I0 C1 — Whitespace-prefixed JSON takes the bare-query path

**Location:** `app/models/try.rb:207-218`

`json_query_params?` checks only whether the raw value starts with `{`.
Whitespace-prefixed JSON is accepted by `JSON.parse` but is classified as bare
text, so `resolved_api_method` can select the wrong request method.

**Fix direction:** Strip surrounding whitespace for dispatch (while preserving
the original payload), and add tests for leading/trailing whitespace.

## [PREEXISTING] P2 — Error handling consistency

### [PREEXISTING] P2 I1 C2 — Missing team resources redirect instead of using the app-wide 404

`TeamsController` has a controller-wide `rescue_from ActiveRecord::RecordNotFound`
that redirects to the teams page with a flash. This differs from the default
`ApplicationController` behavior, which renders the styled 404 for HTML
requests. Decide whether inaccessible or missing team resources should remain a
redirect, become a 404 (or 403), and apply the chosen policy consistently.

Apply the same policy review to the five `set_book` variants in
`CurrentBookManager`, `BooksController`, `Books::ImportController`,
`Api::V1::BooksController` and `AiJudges::PromptsController`: missing or
inaccessible books currently yield a 404, redirect, or nil `@book`.
A shared scoped lookup is optional (P3 I1 C1); preserve each surface's response
contract unless deliberately changing it. Sharing lookup alone need not make
HTML redirects and API 404s identical.

---

## [PREEXISTING] P3 — Security & consistency

### [PREEXISTING] P3 I0 C2 — Public tries visualization also answers on the numeric case ID

**Observed:** While a case is public, `/analytics/tries_visualization/<numeric id>` loads for anonymous users, not just the `public_id` URL the clipboard link hands out. Making the case private again revokes both.

**Fix direction:** Decide whether anonymous access should require the `public_id`; if so, only accept the numeric ID for authenticated users with access to the case.

---

## [PREEXISTING] P3 — Code quality

### [PREEXISTING] P3 I0 C1 — Unsafe integer coercion in snapshot search

**Location:** `app/controllers/api/v1/snapshots/search_controller.rb:45-46`

`params[:rows].to_i` / `params[:start].to_i` without validation; non-numeric strings coerce to `0`.

---

### [PREEXISTING] P3 I0 C1 — Predicate method naming

**Location:** `app/models/selection_strategy.rb`

Rename `user_has_judged_all_available_pairs?` → `user_judged_all_available_pairs?` (style-only; project convention — see `credentials?` vs `has_credentials?` in AGENTS.md, already followed by `HttpClientService#credentials?`).

**Also found:** `every_query_doc_pair_has_three_judgements?` (same file, line 56) has the same `has_` prefix. Different grammatical shape though — it's "has N of a noun" (a count check), not "has verbed" (where the participle alone already reads as a fine predicate, as in `judged`). Dropping `has_` here reads badly (`every_query_doc_pair_three_judgements?`); it would need a rephrase (e.g. `every_query_doc_pair_judged_three_times?`) rather than a straight deletion. Worth a call when touching this file rather than bundling blindly with the first rename.

---

### [PREEXISTING] P3 I1 C3 — BookImporter: unsaved records aren't reported back to the user

**Location:** `app/services/book_importer.rb` — `import_query_doc_pairs`, `import_all_judgements`, `import_judgement`, `upsert_nested_query_doc_pair`

None of these check the return value of `qdp.save` / `judgement.save`. If a row fails validation during an "add more data" import (`Books::ImportController#update`), it's silently dropped — `ImportBookJob` still clears `book.import_job` and reports success, with no indication some rows didn't make it in. Pre-existing gap (the original code didn't check `.create`'s success either), just calling it out now that this path is being hardened for repeated/production re-imports. Fixing it well means deciding how partial failures should surface to the user (job status field? notification?) — a small design call, not a drive-by fix.

---

### [PREEXISTING] P3 I1 C2 — BookImporter: judge identifiers `validate` doesn't check import silently as anonymous

**Location:** `app/services/book_importer.rb` — `find_judgement_user`, `validate`, `emails_of_judges`

`#validate` pre-checks judgement `user_email`s against existing users and refuses the import with "User with email '...' needs to be migrated over first." (or invites them, under `force_create_users`). Two identifiers `find_judgement_user` honours slip past it entirely, and both degrade to an unattributed judgement with no warning:

1. **`user_id`** is never validated at all. A payload naming a `user_id` that doesn't exist in this instance imports anonymous — and `app/views/books/import/edit.html.erb` documents `user_id` as *the* judge identifier for `all_judgements`, while row ids never survive a cross-instance export, so this is the routine case rather than an exotic one.
2. **`:email` on a *nested* judgement** — `emails_of_judges` reads only `judgement[:user_email]` in the `query_doc_pairs` branch, while the `all_judgements` branch reads `user_email || email` and `find_judgement_user` accepts either. So `{"rating":1.0,"email":"nobody@example.com"}` nested under a pair skips both the migration error and the `force_create_users` invite.

Not a regression — before the 2026-09-10 fix these were silently attributed to whichever nil-email AI-judge user the database returned first, which was worse — but all the identifier paths should fail the same way.

**Fix direction:** Have `emails_of_judges` read `user_email || email` in both branches, and have the `validate` pass collect `user_id`s alongside emails so an id that doesn't resolve is treated like an unknown email rather than degrading to anonymous in silence.

---

## [PREEXISTING] P2 — Background jobs

### [PREEXISTING] P2 I2 C3 — Import/populate jobs leave state and idempotency to best effort

**Location:** `app/jobs/import_book_job.rb:7-21` (and similar populate jobs)

Jobs set status strings before working and clear them only on success, so a failure can leave a book permanently busy and leave uploaded blobs in place. Several import paths use `find_or_create_by` plus later updates, vulnerable to duplicate work from retries or concurrent requests. Related to the anonymous-judgement re-import entry above.

**Fix direction:** `ensure`/failure transitions for status and blob cleanup; deliberate retry/discard policy; idempotency via unique constraints or an explicit import identity. Test a failed job followed by retry, and a duplicate submission.

The shared lifecycle scope also includes `ExportBookJob` and
`Book#queue_job`: queueing sets “queued”, each job sets “started”, and each
clears status only on success. Consider one `book.run_job(operation) { … }`
boundary. Define failed/retry status and blob retention before using `ensure`;
blindly clearing everything could hide failed work or prevent retries.
Status cleanup alone does not change scoring inputs.

---

## [PREEXISTING] P2 — Performance

### [PREEXISTING] P2 I1 C2 — Case-list latest-score queries bypass eager loading

`CasesController#index` includes `scores: :user`, but `Case#last_score` calls
`scores.last_one`, whose ordering/limit scope issues a separate lookup per case.
`cases/index.html.erb` also reads that score's user. The team case list in
`teams/_cases.html.erb` uses the same method, while `TeamsController#show`
preloads only owner and teams.

Measure both list endpoints with query-count tests, then load only the latest
score and its user per case. Avoid loading every historical score merely to
render one badge; Bullet is available in development/test.

### [PREEXISTING] P2 I1 C2 — API serializer query amplification

`app/views/api/v1/users/_user.json.jbuilder:12-13` runs two relation counts per user; `app/views/api/v1/cases/_case.json.jbuilder:13-51` repeatedly traverses `last_score`, owner, book, teams, tries, and sampled scores. These become N+1s on index endpoints, especially team/case listings; `app/controllers/api/v1/cases_controller.rb:192` includes `owner` and `book` and preloads `tries`, `teams` and `cases_teams`,
but does not preload the score paths. `queries_count` already uses a selected
count when available; preserve that optimization.

**Fix direction:** Endpoint-specific query objects, or preload/count exactly what each serializer needs. Add query-count tests for representative index responses, not just response-shape tests.

---

## [PREEXISTING] Backend duplication

The same feature is built several times, and most copies have already drifted
apart, so behavior depends on which path ran. Where copies differ, decide which
behavior is correct before consolidating and call it out in the PR. One pattern
per PR; keep this out of in-flight feature branches.

### [PREEXISTING] P3 I1 C2 — `Archivable` model concern

`Case` and `SearchEndpoint` define `mark_archived`/`mark_archived!`; `Book`
defines `archive!` but `BooksController` calls `update(archived: true)`
directly. `not_archived` includes `nil` on `Case` but not on `SearchEndpoint`.
Case archive/unarchive actions are copied between `CasesController` and
`TeamsController`. One concern with `archive!`, `unarchive!`, `archived`,
`not_archived` fixes naming and scope semantics. The redundant analytics
availability guards were removed in the analytics-layer cleanup.

Not worth acting on: search-response parsing exists in Ruby
(`FetchService#extract_docs_*`) and JS (splainer-search) because evaluations run
server-side; keep them in step rather than merging.

---

## [PREEXISTING] RuboCop deferrals

These candidates still carry inline Metrics suppressions. Search the codebase
for `rubocop:disable` and check `.rubocop.yml` for the full current lint scope.

### [PREEXISTING] P3 I1 C2 — Metrics/ParameterLists

- `[PREEXISTING]` P3 I1 C2 — `Case#clone_case` — `app/models/case.rb:130`
- `[PREEXISTING]` P3 I1 C2 — `HttpClientService#initialize` — `app/services/http_client_service.rb:32`

### [PREEXISTING] P3 I2 C3 — Complex methods (Metrics/*)

Candidates for extraction into smaller methods or services:

- `[PREEXISTING]` P3 I2 C3 — `FetchService` — `app/services/fetch_service.rb`
- `[PREEXISTING]` P3 I2 C2 — `Api::V1::Import::RatingsController#create`
- `[PREEXISTING]` P3 I2 C2 — `Api::V1::Export::RatingsController`
- `[PREEXISTING]` P3 I2 C2 — `Api::V1::Snapshots::SearchController`
- `[PREEXISTING]` P3 I3 C3 — `RatingsImporter`
- `[PREEXISTING]` P3 I2 C3 — `MapperWizardsController`
- `[PREEXISTING]` P3 I2 C3 — `TeamsController` / `BooksController` / `HomeController`

---

## [MIGRATION-FOLLOWUP] Consolidated DRY review

Consolidated from the 2026-10-04 general and JavaScript DRY reviews.
Retain scoring inputs, calculations, persistence, serialization, request order,
import failure policies and each surface's UI contract when simplifying.
Similarity alone does not justify a shared behavior. Ratings are estimates;
no LOC reduction has been measured. Imported DRY provenance is provisional
unless an entry records historical evidence; `[MIGRATION-FOLLOWUP]` denotes
cleanup, not a confirmed regression.

Fix concrete bugs before expanding abstractions. Low-risk fragments include
removing duplicate field mapping, extracting identical field-spec parsing,
and sharing the Document Finder's equivalent reset/pagination branches.
Merging stores rewires score publication; compare the case UI before/after.
Changing rated-result ranking, stored ratings, scoring aggregation, engine
filters or request escaping is an intentional behavior change with its own
verification. Keep frontend and background scoring aligned.

### [PREEXISTING] P3 I2 C2 — Controller index filtering — deferred

Review ownership and filtering semantics independently before extracting a
concern. The team filter currently uses `joins` (Cases), `includes` plus a hash
`where` (Books), and a subquery (SearchEndpoints). SearchEndpoints parses
`archived` with `bool.deserialize`; the others use `deserialize_bool_param`.

A shared concern is appropriate only where accessible/owned scopes, archive
behavior, duplicate handling, and responses have the same contract. Preserve
those scopes and boolean semantics during extraction.

### [MIGRATION-FOLLOWUP] P2 I3 C3 — Consolidate mutable query-state ownership — completed

API query fields are normalized once by `live_query_factory.js`; bootstrap
publishes the resulting live queries rather than remapping raw API rows.
`QueryCollectionStore` owns live queries, display order, expansion and rated-only
preferences, and derives its plain snapshots on read. `QueryDocumentsStore`
keeps normalized document projections and reads shared query status, score
completeness, missing-rating counts and display preferences from the collection.
The command bridge routes collapse-all once through the runtime. The runtime no
longer keeps separate order or rated-only variables. Workspace capabilities still
come from the explicit `core_workspace_runtime.js` dependency boundary.

`CaseScoreStore` deliberately retains the completed scoring projection: case
aggregates, persistence and graphs consume one atomic full scoring result,
including during in-flight searches and diff-only rescoring.

Verification: full Vitest suite (1,433 tests), ESLint and scoped Prettier checks;
regression tests cover rating/rescore consistency across live queries and all
three projections, early expand/collapse, republishing, removal, reset and order.
Authorized browser sample: cases 219 and 6, expanded/collapsed results, score and
missing-rating badges, Solr rated-only results, name ordering, document rating
and restoration, and forced search errors. Before/after screenshots were inspected
under `.playwright-mcp/query-state/`. Review follow-up scopes single-query change
notifications and verifies that an unrelated publication preserves an open rating
popover in a snapshot comparison; inspected screenshot pairs are under
`.playwright-mcp/query-notifications/`. Deferred: broader imports, full snapshot/diff,
manual drag persistence, bulk editing and other search engines.

### [PREEXISTING] P2 — Search failures abandon queued queries

When the first ten concurrent searches reject, `query_service.js#pAll` exits all
workers before remaining queries start. Those queries have neither scores nor
errors, so the progress banner stays visible. Preserve bounded concurrency and
rate limiting while allowing the queue to settle and explicitly report failures.
Add coverage for a failing batch larger than the concurrency limit.

Observed on both sides of the query-state refactor. Pre-deangularization main
commit `ed5c17ea`, `app/assets/javascripts/services/queriesSvc.js:1231–1268`, has
the same unguarded worker `await promise`; `controllers/queriesCtrl.js:488–504`
uses unscored queries for progress. This is historical source evidence, not a
live historical replay. The forced-error sample verified row errors and unchanged
batch behavior; it did not establish successful completion of that failed batch.

### [MIGRATION-FOLLOWUP] P2 I2 C2 — Rated-document lookup duplication

"Fetch the docs this query has rated" has three implementations with different
strategies:

- `query_runtime.js#refreshRatedDocs`: the `filterToRated` searcher option.
  `buildSearcherRequest` wraps the ES query in `bool: { should: query, filter }`
  or adds a Solr `fq`, so the original query still ranks the results.
- `createTargetedSearchAdapter#resetToRated`: replaces the ES `queryDsl` with
  the filter outright, strips template args by hand, and uses Solr
  `explainOther`.
- The adapter's `paginate` default-list branch: repeats the `resetToRated`
  engine branches, including the ES template stripping, nearly line for line.

Rating is also written twice: `live_query_commands.js#rateDocument`/`rateAll` go
through `ratingsStore`, while `adapter.rate`/`rateAll` call the doc's
`rate`/`rateBulk`.

**Decide first:** should "Show only rated" and the Document Finder's rated list
rank the same way? Then use one rated-search builder for all three paths.

Sharing the equivalent `resetToRated`/default-list pagination branches can
preserve behavior. Merging all builders or rating-write paths needs the ranking
and persistence decisions first.

### [PREEXISTING] P2 I2 C2 — Align client and server scoring inputs and aggregation

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

### [PREEXISTING] P2 I1 C2 — Server search request building duplicates and drifts

Inside `FetchService`:

- `#$query##` is substituted twice. `build_get_params` uses
  `gsub(string, string)`, so `\0` or `\1` in the query text is treated as a
  backreference. `replace_values` uses the safe block form.
- `build_get_params` assigns `params[key] = val` in a loop, so repeated Solr
  params such as `fq` keep only the last value.
- `escape_query` is never applied on the server, while the client honors it.
- `field_spec` is parsed in `FetchService#add_solr_params` and again in
  `Try#id_from_field_spec`.

This backlog accepts keeping response parsing in both Ruby and JS. Request
building is different: it drifts from the client and is buggy.

**Fix:** one substitution helper, a small `FieldSpec` value object on `Try`, and
multi-valued GET params.

Identical field-spec parsing can be extracted without changing scores.
Substitution, multi-valued filters and server escaping fixes change fetched
results and background scores; verify them separately.

### [PREEXISTING] P3 I1 C1 — Rating-color consistency

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

### [MIGRATION-FOLLOWUP] P2 I2 C2 — Search-engine rule boundaries — deferred

`utils/search_engines.js` is meant to be the one place for engine checks, but
most of the rules are written out somewhere else:

- **"Store document fields in the snapshot"** (`static || !supportsLookupById`)
  is written three times: `snapshot_bridge_controller.js:57`,
  `snapshot_hydration.js:11` and `snapshot_hydration.js:75`.
- **`["solr", "es", "os"]`** is hardcoded four times, with different meanings:
  `rated_docs.js:9`, `query_runtime.js:344`, `settings_catalog_runtime.js:182`
  (`supportsEscapeQuery`) and `live_query_runtime_owner.js:683`.
- **`usesJsonQueryParams`** lives in `search_endpoint_runtime.js:41`, and
  `tune_relevance_controller.js:319` adds its own Search API "starts with `{`"
  exception on top.
- **Too many layers:** pure checks pass through two or three runtime layers.
  `isEsLikeEngine` becomes `isEsOrOsEngine` and then `isEsOrOs`, which is wired
  up twice in `core_capabilities_runtime.js` (lines 182 and 225).
- **Engine names:** `browse_query.js:1` has its own engine display name instead
  of using `searchEngineLabel`.

**Defer the full consolidation.** Safe fragments may include reusing display
labels and removing redundant pass-throughs while preserving the exact
predicate. Do not merge engine sets with different meanings or alter lookup,
escaping, query DSL, or snapshot-field rules.

### [MIGRATION-FOLLOWUP] P2 I2 C1 — Refresh-ratings orchestration — deferred

`frog_report_controller.js#refresh` (line 143) and
`judgements_core_controller.js#_refreshRatings` (line 432) both fill in
`__BACKGROUND__`, use the same "run in the background at 50 or more queries"
rule, send a PUT, then either reload the queries or redirect.

| | `frog_report` | `judgements_core` |
| --- | --- | --- |
| Threshold | hardcoded `50` | `BACKGROUND_QUERY_THRESHOLD` |
| Reload | calls `queryLifecycle.refreshQueries` | dispatches `judgements:queries-need-reload` |
| Redirect | immediate, no notice | 500ms, with `?notice=` |
| Error text | `` `${status} ${statusText}` `` | `serverMessage(...)` |

There are also two event names for one action:
`judgements:queries-need-reload` and `imports:queries-need-reload` both go to
the same handler (`live_query_events.js:91-92`).

**Defer.** These flows alter scoring inputs and differ in stale-response
handling, reload completion, errors, and redirects. Extracting only the threshold
and PUT offers little reduction. Keep the existing reload event contracts.

### [MIGRATION-FOLLOWUP] P2 I2 C2 — Snapshot CSV import contracts — deferred

| Caller | On failure |
| --- | --- |
| `import_snapshot_controller.js#importSnapshots` (line 127) | keeps going, counts failures, then throws |
| `import_ratings_core_controller.js#importSnapshots` (line 136) | stops at the first failure |
| `snapshot_import.js#importSnapshotsToCase` (line 45, used by the wizard) | stops at the first failure |

Each one also builds its import URL differently.

The snapshot column list is written three times: the excluded-fields list in
`snapshot_import.js`, `expectedHeaders` in `import_snapshot`, and
`REQUIRED_HEADERS.snapshots` in `import_ratings_core`. "Required headers present,
no parse errors, not empty" validation exists three times with different
messages (the third is `wizard_contracts.js#validateStaticHeaders`).

**Defer upload-loop consolidation.** Preserve each caller's continue/stop
policy, payloads, order, and error messages. Shared column constants may be a
small safe cleanup after checking that the lists serve the same purpose;
choosing one failure or validation policy is a behavior change.

### [MIGRATION-FOLLOWUP] P3 I1 C0 — Server-owned URLs and template replacement — deferred

Fourteen controllers fill server-passed URL templates with
`.replaceAll("__CASE_ID__", …)`. Some wrap the value in `String()`, none
encode it, and nothing catches a placeholder that was never filled. Separately,
about 80 call sites build `api/...` paths on the client, which the
DEVELOPER_GUIDE discourages.

**Defer as proposed.** Encoding values and throwing for unresolved placeholders
add behavior. A replacement-only helper could preserve the contract but offers
limited LOC savings. Moving client URLs to Rails ownership is a separate task.

### [MIGRATION-FOLLOWUP] P3 I1 C1 — Request-generation abstractions — deferred

There are seven versions: `qscore_case_controller` (`diffRefreshGeneration`),
`judgements_core_controller` (`openGeneration`), `query_collection_store`
(`_searchGeneration`), `live_query_collection`, `case_runtime`, `query_runtime`
(`ratingsGeneration`), and the `AbortController` in
`team_member_autocomplete_controller`.

**Defer.** These counters govern request races and invalidation; AbortController
also cancels work. A shared token helper saves few lines and must not replace
caller-specific cancellation or stale-response rules.

### [MIGRATION-FOLLOWUP] P2 I1 C1 — Clipboard feedback and fallback contracts

There are four versions of "copy, then swap the button label for a moment":
`query_explain_controller.js:68`, `invite_controller.js:33`,
`mapper_wizard_controller.js:446` and `browse_query_controller.js:44`.

- **Bug:** `mapper_wizard` calls `navigator.clipboard` directly and skips the
  plain-HTTP fallback in `utils/clipboard`, so copying fails on deployments
  served over plain HTTP.
- `browse_query` never puts its label back and never reports a failed copy.

**Optional narrow scope:** share repeated feedback plumbing while preserving
each caller's labels, icons, restoration delay, status messages, and errors.
Do not impose one feedback policy on all four callers.

The mapper HTTP fallback and Browse label restoration/error reporting are
separate behavior fixes, outside a strict behavior-preserving refactor.

Mapper Wizard's direct clipboard call is `[PREEXISTING]` (present in
`be9b319a:app/javascript/controllers/mapper_wizard_controller.js`). Fix that
fallback independently of optional feedback consolidation; verify plain HTTP.
Browse feedback provenance has not been classified against the baseline.

### [MIGRATION-FOLLOWUP] P3 I1 C0 — Success-and-redirect helpers — deferred

There are five versions with different delays: `import_case_controller.js:55`
and `import_snapshot_controller.js:112` (1500ms), `clone_case_core_controller.js:138`
(1000ms), `judgements_core_controller.js:478` (500ms), and
`frog_report_controller.js:163` (none).

**Defer.** One delay changes the current contract. A helper preserving each
caller's delay, URL, notice, and navigation method saves very little.

### [MIGRATION-FOLLOWUP] P3 I1 C1 — Busy-state helpers — deferred

There are about six versions: `CoreModalControllerBase#setLoading`/`setProgress`,
`import_form_controller_base.js#setLoading`, `add_query_controller`,
`missing_documents_controller`, `team_member_autocomplete_controller` (which
uses `style.display` instead of `d-none`), and `mapper_wizard_controller`,
which swaps the button's `innerHTML`.

**Defer a universal helper.** Disabled controls, spinner classes, visibility,
and HTML replacement have different contracts. Consolidate only demonstrably
identical operations; leave modal-level progress bars and distinct state
transitions alone.

### [MIGRATION-FOLLOWUP] P2 I2 C1 — Choose explicit error-message policies

`utils/error_message.js:8` provides `errorMessage`; `:32` provides
`serverMessage`. `query_lifecycle_controller.js:60` uses the former, whereas
`share_case_core_controller.js:317,357`, `judgements_core_controller.js:307`,
and `import_ratings_core_controller.js:201` use `error.message || fallback`.
Mapper Wizard interpolates `error.message` directly in several catch blocks
(`mapper_wizard_controller.js:149,205,366,431`). Frog Report additionally
rewrites an `HttpError`'s message before displaying it (`:164`).

**Fix direction:** explicitly choose an error policy at each
boundary: contextual server errors via `serverMessage`, unknown rejection
shapes via `errorMessage`, structured search errors via `flashErrorMessage`.
Reuse the appropriate existing helper rather than add another extractor.
Replacing `error.message || fallback` with `errorMessage` expands accepted
rejection shapes; replacing it with `serverMessage` also changes the fallback
for body-less HTTP failures. Treat those as intentional changes with focused
tests, not mechanically equivalent substitutions. Preserve fixed generic
messages and editor parse diagnostics. In `import_ratings_core_controller`,
`error.data?.message || serverMessage(...)` deliberately prefers `data.message`
when both `message` and `error` exist, while `serverMessage` and `HttpError`
prefer `data.error`. The existing import-ratings test pins that distinction;
keep the fallback unless a change deliberately preserves that precedence.

### [MIGRATION-FOLLOWUP] P3 I1 C1 — Snapshot short-date formatting

Export uses `formatShortDate` (`export_case_core_controller.js:181`), defined
in `utils/case_csv.js:61` with local date components. Diff constructs the same
ordinary month/day/two-digit-year display using `toLocaleDateString`
(`diff_core_controller.js:235`). Diff also resolves three alternative time
fields and suppresses missing/invalid dates; the export formatter has no such
guard. Snapshot models use full-year locale dates, with an explicit `en-US`
override from `snapshot_bridge_controller.js:80,86`.

**Fix direction:** share the short-date operation after checking
valid-date equivalence, ideally from a neutral date utility rather than making
Diff depend on CSV serialization. Keep Diff's guards and field fallbacks in
its caller. Test timezone-boundary timestamps, invalid dates, and unusual years;
manual year slicing and Intl formatting are not universally equivalent.
Keep full-year snapshot labels and activity tooltip formatting distinct.

### [MIGRATION-FOLLOWUP] P2 I1 C1 — Use the shared CodeMirror disposal contract in case controllers

`modules/editor.js#fromTextArea` now exposes `editor.destroy()`: it cancels the
initial-format timer, synchronizes the textarea, removes the form-submit
listener, destroys the view/wrapper, restores textarea visibility and releases
`textarea.editor`. The management `codemirror` controller uses it on disconnect
and `turbo:before-cache`; global editor auto-initialization has been removed.
The adapter teardown is covered in `test/javascript/modules/editor.test.js`.

**Remaining:** `tune_relevance_controller.js#disconnect` and
`missing_documents_controller.js#disconnect` still call only
`editor.view.destroy()`. `query_options_core_controller.js` creates an editor
on connect but has no disconnect hook. Those paths bypass some or all of the
adapter's cleanup and can leave generated DOM or callbacks behind on remount.

**Fix direction:** use the existing adapter destroy method and clear each
controller's reference; do not introduce another disposal API. Verify repeated
connect/disconnect without duplicate editors, wrappers or submit listeners,
including pending initial formatting. Case modal hide is not necessarily a
Stimulus disconnect, and the case workspace still uses full-page navigation;
management Drive enablement alone does not establish a browser leak here.

### [MIGRATION-FOLLOWUP] P3 I1 C1 — Small utility cleanups

- JSON cloning is repeated in `settings_runtime.js`, `settings_catalog_runtime.js`
  and `query_service.js`. `snapshot_model.js` preserves prototypes intentionally;
  keep that operation separate. Extraction offers little reduction.
- Explain parsing is repeated in `snapshot_searcher.js` and `snapshot_model.js`;
  preserve parse failures rather than silently accepting invalid explains.
- Remaining ID comparisons in Wizard, sharing, collection and scorer selection
  can use `isSameId` only after proving equivalence. Numeric scorer comparisons
  behave differently from string comparisons; do not mechanically replace them.

### [MIGRATION-FOLLOWUP] P3 I1 C0 — Direct Bootstrap modal wrappers — deferred

Former J12: wrapping lookup/show/hide made call sites longer without removing
instance lookup. Keep direct calls; do not expand helpers solely for this cleanup.
Preserve silent no-op behavior when Bootstrap is absent and the existing error
when Bootstrap exists but Modal is missing. Existing screenshot pairs and actual
verification timestamps remain in the manual-testing tracker.

### Review boundaries

Do not unify sequential import upload loops or their stop/continue policies.
Avoid changing `pAll`'s rate-limited starts and bounded concurrency for style.
Book-sync scheduling needs the separate correctness fix below; it is not an
example of interchangeable parallel work. CSV parsing consumes lookahead and
advances its index intentionally. Prefer loop constructs according to intent,
not uniform syntax.

Keep autocomplete's server filtering separate from endpoint suggestions'
client filtering; rating popovers and downloads already have shared helpers.
Keep Rails/core sharing twins separate where their behavior differs, even with
the shared layout and header markup. Ruby and
JS response parsers and CSV formula escaping serve distinct execution/export
contracts; keep them aligned rather than merging them. Similar jbuilder
partials have separate export/API contracts. The small Thor ratings/snapshot
generators do not justify abstraction solely for copied lines.

## [MIGRATION-FOLLOWUP] JavaScript correctness findings

Reviewed 2026-10-05. The five focused suites for bulk judging, Query Options,
book sync, the editor and Missing Documents passed (49 tests), but omit the
cross-row and overlapping-request cases below. Read-only source reproductions
with mocked APIs confirmed the bulk explanation, options-context, book-rank
and failed-search cleanup failures. These were not browser passes.
Historical comparisons below use source at `be9b319a`, not a live historical
replay. A followup marker with unclassified provenance does not establish a
migration regression.

### [MIGRATION] P1 I0 C2 — Query Options save completion can target a different query

**Location:** `app/javascript/controllers/query_options_core_controller.js#save`,
`app/javascript/utils/live_query_events.js#optionsSaved`.

Save A, dismiss the modal, and open B before A's PUT finishes. The completion
reads the mutable `this.queryId`, dispatching B's ID with A's options. The event
consumer updates B's live options and recalculates scores, while the server
saved A. Completion also closes B's newly opened modal.

**Fix direction:** capture the request's query ID/URL and options before awaiting;
use an open-generation guard for UI effects. Still apply a successful save to
its original live query. Test reopening B during A's pending success/failure.

**Provenance:** the baseline Angular Query Options controller retained its own
`ctrl.query` and opened a distinct modal instance per prompt; it did not reuse
the mutable ID in the shared Stimulus modal.

### [PREEXISTING] P1 I0 C1 — Bulk judging drops cross-row explanation edits

**Location:** `app/javascript/controllers/bulk_judgement_controller.js#saveExplanation`.

One debounce timer serves the entire multi-row controller. Editing B within a
second of A cancels A's pending write, leaving its visible explanation unsaved.

**Fix direction:** key pending saves by query-document pair; preserve independent
row edits and define disconnect/navigation behavior explicitly. Test two rows
edited inside the debounce window and cleanup of all pending timers. With Drive
now enabled on the bulk-judging page, also cover navigating away and returning:
`disconnect()` currently cancels a pending edit rather than persisting it. Decide
whether to flush or block navigation with unsaved edits; do not imply that
history restoration proves the text was saved.

**Provenance:** the same single `saveTimeout` exists in the baseline controller.

### [PREEXISTING] P1 I0 C2 — Book auto-sync renumbers newly discovered documents

**Location:** `app/javascript/utils/book_sync.js#sync`, `buildQueryDocPairsPayload`.

The sync cache filters out already-sent documents before payload construction
assigns `index + 1`. After A has synced, results `[A, B]` send B at position 1
instead of 2. `PopulateBookJob#fix_duplicate_positions` can consequently clear
A's position, changing rank-depth judging coverage.

**Fix direction:** carry original result positions through cache filtering.
Test mixed synced/unsynced documents and persistence through the population job.

**Provenance:** baseline `queriesSvc.js#syncToBook` similarly filters
first; `bookSvc.js#updateQueryDocPairs` numbers the filtered list.

### [MIGRATION-FOLLOWUP] P1 I0 C2 — Book auto-sync batches conflict with queued population

**Location:** `app/javascript/utils/book_sync.js#sync`,
`app/controllers/api/v1/books/populate_controller.rb#update`, `Book#queue_job`.

More than 100 queries produce concurrent population requests for one book.
The first queues a job and marks the book busy; additional requests can receive
409. The client logs failures and clears their cache entries but resolves the
sync without retrying them, so a completed search can leave the book incomplete.

**Fix direction:** coordinate submission with job completion, or submit one
server-managed payload. Awaiting each HTTP response alone is insufficient:
204 acknowledges queueing, not completion. Surface partial failure and test
101+ queries against the queued-job contract and a retry path.

**Provenance:** parallel client batching predates the migration; the baseline
population endpoint did not have the current conflict guard. The introduction
of that contract mismatch has not been classified against migration history.

### [PREEXISTING] P2 I0 C1 — Clearing an explanation-only judgement is not persisted

**Location:** `app/javascript/controllers/bulk_judgement_controller.js#saveExplanation`.

When no rating is selected and explanation text becomes empty, the callback
skips the request. An existing explanation therefore returns after reload.
The server can accept an explicit empty explanation.

**Fix direction:** distinguish an untouched empty field from clearing previously
saved content. Test saving text, clearing it, and reloading its persisted value;
preserve zero-valued ratings and the untouched-empty case.

**Provenance:** the same empty-input early return exists in the baseline controller.

### [MIGRATION-FOLLOWUP] P2 I0 C1 — Failed Missing Documents operations leave controls busy

**Location:** `app/javascript/controllers/missing_documents_controller.js#run`.

A rejected search/reset/pagination operation bypasses spinner removal and
re-enabling Search, leaving the modal stuck without contextual error feedback.

**Fix direction:** restore controls in `finally`, report failures, and guard
post-await rendering after disconnect. Cover rejected operations and successful
retry. This controller's failure has been reproduced with a mock; whether the
old Document Finder had an equivalent failure remains unclassified.

### [PREEXISTING] P2 I0 C1 — Tune Relevance does not handle its save promise

**Location:** `app/javascript/controllers/tune_relevance_controller.js#save`,
`app/javascript/utils/settings_runtime.js#save`.

The controller neither awaits nor returns the save promise, handles rejection,
nor disables submission. Network/server failures have no contextual feedback;
repeated clicks can create multiple tries.

**Fix direction:** await the save, disable submission while pending, report the
failure and restore controls appropriately. Test failure/retry and double-click
submission while preserving navigation and drawer handoff on success.

**Provenance:** baseline `controllers/settings.js#submit` also discards
`settingsSvc.save`; the service handles success without a rejection handler.

## [PREEXISTING] Background refresh counts

### [PREEXISTING] P2 I0 C1 — UpdateCaseJob reports inconsistent creation totals

**Location:** `app/jobs/update_case_job.rb#perform`.

`@counts['ratings_created'] = + service.ratings_created` assigns rather than
adds. `queries_created` adds the reused RatingsManager's cumulative totals
again for every case, double-counting earlier work. Both patterns exist at
`be9b319a`.

**Fix direction:** accumulate per-case deltas or report the service's final
cumulative totals consistently. Test multiple cases with different creation
counts. This changes refresh API counts, not ratings or score calculations.

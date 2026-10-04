# Todo

**Last updated:** 2026-10-04

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

Source audit: 2026-10-04 against `9a9a7974` and the working tree. This audit
checked implementations and existing tests/verification records; it did not
rerun browser flows or tests. Historical observations below are retained only
where the current source still supports the unresolved issue. Browser coverage
and actual verification timestamps live in `docs/manual-testing/tracking.yml`.
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

## [MIGRATION-FOLLOWUP] JavaScript defects and cleanup

These items were rechecked against the current source when consolidating the
sampled JavaScript review. They are source findings, not live browser
reproductions. Each item's marker was checked against the pre-migration source
(`be9b319a`).

### [MIGRATION-FOLLOWUP] P3 I1 C2 — Replace the tether-shepherd tour globals

`core_vendor.js` puts `Tether` and `Shepherd` on `window` because `tour.js`
expects bare globals. `tether-shepherd` is a dated dependency; choosing a
replacement tour library is its own decision, after which converting `tour.js`
to imports is cheap. `bootstrap_globals.js` and `vega_globals.js` load UMD
builds for their own data-API/consumer reasons; revisit them separately.

---

## [MIGRATION-FOLLOWUP] Angular remnants, Stimulus/Turbo retrofit, and frontend DRY

No Angular code is left (no `ng-*`, `$scope`, or Angular packages outside
comments); what remains is mostly structure. Audited 2026-10-03 on
`angular-phase-10`. Completed retrofit work and standing guidance (constraints,
outlet-vs-event rule, pitfalls, what stays manual by design) are in
`docs/archived/stimulus_turbo_retrofit_completed.md`.

### [MIGRATION] P2 I3 C3 — Merge the case page into the main app

The case page (`/case/:id`) is still its own app: its own layout
(`layouts/core.html.erb`), header and footer (`layouts/_header_core_app.html.erb`,
`_footer_core_app.html.erb`), esbuild IIFE bundles (`core_case.js`, built from `core_stimulus.js`, and
`core_vendor.js`, alongside importmap-loaded Bootstrap and Vega; other pages
use the importmap for their application controllers), and CSS layer
(`core-additions.css` ~635 lines, `bootstrap5-compat.css` ~552 lines). Steps:

1. Merge `_header_core_app.html.erb` into `_header.html.erb`, rendering the
   case-specific parts (case name, try, score) only on a case. Same for the footer.
2. Render the case page in `application.html.erb`, linking the `core` CSS
   bundle there instead of `application`. Move the `core_stimulus.js` entry onto the importmap
   at the same time; that needs pins for `sortablejs` and `splainer-search/wired.js`
   (the package ships only an IIFE `dist`).
3. Rename the `_core` twins (11 `controllers/*_core_controller.js`, 10
   `shared/_*_core_modal.html.erb`). Only `share_case` has a non-core
   counterpart; for the rest the suffix just means "lives on the case page".
   Don't rename before steps 1–2; it's churn on its own.

Preserve the `<base href>` rendered by `layouts/_head_common.html.erb`: relative
URLs and `utils/html.js` URL validation rely on it for sub-path deployments.

**Bootstrap 3 look (decided 2026-10-03): keep it, scoped to the case page.**
`html { font-size: 87.5% }`, the BS3 brand blue `#337ab7` (`--q-brand-blue`),
the BS3 `<pre>` box and modal shadow, and compatibility rules in
`bootstrap5-compat.css`, `core-additions.css` and `misc.css` are a design choice.
`build_css.js` builds `core.css` as a complete bundle that only the case page
links. Do not prefix the compat selectors unless the shared header must look
identical everywhere: many rules are global (`html`, `:root`, `a`, `.modal`,
`.tooltip`, `.popover`), modals and popovers attach to `<body>`, and the root
font size cannot be scoped below `<html>`.

### [MIGRATION] P2 I2 C3 — Replace the `quepid_search.js` service locator

`app/javascript/quepid_search.js` is a shared module-level object standing in
for Angular's dependency injection: its `queryCapabilities` slots start `null`
and are filled at startup by the runtime owner. Shared case state stays in sync
through page-wide events such as `quepid:case-selected` and
`judgements:book-settings-saved` in `core_runtime.js`. Independent of the layout
merge; pairs naturally with the live-query owner simplification above.

### [MIGRATION-FOLLOWUP] P3 I1 C2 — Move remaining `utils/` DOM lifecycles into controllers (retrofit Track E)

`dynamic_modal.js`, `detailed_document_modal.js`, `destructive_form.js` and
`status_message.js` still manage DOM state or events outside Stimulus. Static
modal shells already live in `shared/_dynamic_modal_templates.html.erb`; preserve
that Rails-owned markup and consider moving the remaining lifecycle/behavior
into controllers or controller mixins. Leave thin Bootstrap
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
`annotations:changed` for `qgraph`). **Blocked:** parallel HTML
endpoints for the case page are not wanted for now. If that changes, pilot
`pick_scorer_core` or annotations and prove selection and the edit modal work
inside a lazy frame first.

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

### [MIGRATION-FOLLOWUP] P2 I0 C1 — The core_smoke rating test hangs when the first result is unrated

`core_smoke.spec.ts` "rating updates the query score, case score, and rating
badge" resets the first result's rating, then waits for the result list to
rebuild (`watchResultsRebuilds`). On static case 219 that result has no
rating, so the reset changes nothing, the list never rebuilds, and the test
hits its 30s timeout. Resolve the settle promise after a quiet period even when
no mutation arrives, or skip the reset when the result is unrated.

### [MIGRATION-FOLLOWUP] P3 I1 C1 — Adopt the shared controller fixture in remaining specs

`test/javascript/support/controller_fixture.js` (see
`docs/js_tooling.md#controller-test-fixtures`) is used by 20 controller specs.
Adopt it in smaller specs when touched. Separately, mounting real Stimulus
against real markup would catch ERB target/action drift the fixture can't;
use it for new specs and convert old ones when touched, not big-bang.

### [PREEXISTING] P3 I0 C2 — Identify API endpoints only the Angular client used

Compare historical Angular consumers with current routes and callers. The API
is also public (scripts, notebooks), so an endpoint the UI no longer calls is
not necessarily dead. Only worth doing alongside an API
review.

---

## [PREEXISTING] P0 — Product bugs

### [PREEXISTING] P0 I1 C2 — Deleting the latest try bricks the case (backend)

---

### [PREEXISTING] P0 I1 C3 — Try delete orphans scores

**Observed:** Scores keep a stale `try_id` after the try is deleted. (The `PUT /api/cases/:id/scores` 500 on an orphaned `last_score` is fixed — `same_score_source?` now treats a nil try as a different source.)

**Cause:** No cascade/nullify from try → scores (`case_scores.try_id` has no FK).

**Fix direction:** Cascade or nullify scores on try destroy.

---

## [PREEXISTING] P0 — Security

### [PREEXISTING] P0 I1 C2 — Public cases and snapshots allow unauthenticated mutation

---

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

**Reached by** the ordinary export → re-import path, since `_judgements.json.jbuilder` emits `user_email` only `if judgement.user`, so exported anonymous rows come back identity-less; also by a Mission Control retry of a failed `ImportBookJob` (no `retry_on`, and `book.import_file.purge` runs *after* `service.import`), and plausibly by a double-submitted import form.

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

**Cause:** `app/views/teams/new.html.erb` doesn't render `@team.errors`, and `TeamsController#create` renders `:new` without `status: :unprocessable_content`.

**Fix direction:** Render the shared error-messages partial on `teams/new` and return 422 on failure.

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

### [PREEXISTING] P1 I1 C2 — Search-endpoint updates accept unauthorized team IDs

**Location:** `app/controllers/search_endpoints_controller.rb:59-74`

The HTML update action preserves hidden teams, but resolves submitted team IDs
with `Team.find` rather than scoping them to `current_user.teams`. A user who
can edit an endpoint can submit another team's ID and attach that endpoint to
the foreign team.

**Fix direction:** Resolve submitted IDs through `current_user.teams.where(id:
...)`, reject or report unauthorized IDs, and add a negative controller test.

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
`not_archived` fixes naming and scope semantics. While there: the
`if defined?(Analytics::Tracker) && Analytics::Tracker.respond_to?(…)` guard is
repeated 8 times; the tracker is always loaded, so it can go.

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

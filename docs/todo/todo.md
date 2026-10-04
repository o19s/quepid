# Todo

**Last updated:** 2026-10-04

Outstanding bugs, hardening, and cleanup on `main` only. When something is fixed, remove its entry — do not add a completed section or keep resolved items for history.

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

Product bugs marked *Playwright MCP* were verified in a May 2026 headed pass and re-checked against the tree in Aug 2026. Line numbers may drift — re-check cited files before fixing.

## [MIGRATION-FOLLOWUP] Frontend cleanup after Angular removal

### [MIGRATION] P3 I1 C2 — Workbench panes assume a 60px header

`panes.css` sizes `.pane_main` and `.pane_east` as `calc(100% - 60px)`, but the BS5 core header is about 74px tall. Both panes extend about 14px past the viewport. The Tune Relevance drawer still fits **Rerun My Searches!** only because its 15px bottom padding absorbs the overflow, so a taller header pushes the button below the fold again. Size the panes from the header's actual height, for example with a flex column layout, instead of a hard-coded offset. Check the main pane's scrolling and the drawer before and after.

### [PREEXISTING] P0 I1 C3 — Scorer sandboxing

Client scorer code still executes through `new Function()`; evaluate a Web
Worker or equivalent browser isolation. V8/MiniRacer remains the batch path.

### [PREEXISTING] P2 I0 C2 — Accessibility

Score and rating controls still convey state by color alone; add text or icons so state is not color-only, and cover it with the relevant Playwright scenario.

axe-core flags two unlabeled `<select>`s as critical (`select-name`): the API snapshot picker in the Export modal (`shared/_export_case_core_modal.html.erb`) and each snapshot picker in Compare Snapshots (`diff_core_controller.js` builds a `<label>` that isn't tied to its select). Both were unlabeled on `main` too. Associate the labels (`for`/`id` or `aria-label`). The same scan reports `heading-order` in the Export, Compare Snapshots and Judgements modals (scenario 16.4).

The query-list sort controls (Manual, Name, Modified, Score, Errors) are `<a>` elements without `href`, so they can't be reached with the keyboard. Make them buttons. Not compared against `main`.

### [PREEXISTING] P2 I0 C1 — Explain Query Copy gives no feedback

`query_explain_controller.js` swallows `copyText()` rejections (`.catch(() => {})`) and shows no success state. Surface failure and a "Copied!" state.

---

## [MIGRATION-FOLLOWUP] JavaScript defects and cleanup

These items were rechecked against the current source when consolidating the
sampled JavaScript review. They are source findings, not live browser
reproductions. Each item's marker was checked against the pre-migration source
(`be9b319a`).

### [MIGRATION-FOLLOWUP] P2 I3 C3 — Reduce live-query owner indirection incrementally

`app/javascript/utils/live_query_runtime_owner.js` still builds a nested
`liveQueryServices` graph of about a hundred forwarding wrappers, with closures
depending on later-initialized runtime objects. The `promiseApi` seam is gone;
simplify the remaining wrappers and obsolete compatibility seams behind
existing tests, preserving method binding. Wrappers that defer a lookup of a
later `const` (`liveQueryFactory`, `liveQueryCollectionRuntime`, …) must stay
deferred. Work one cluster at a time rather than as a large runtime rewrite.

The broader problem is concept count: the runtime spans about 18 modules
(`live_query_*`, `query_runtime`, `query_service`, `query_model`, `query_state`,
`query_lifecycle`), several of which only pass through to others, left over
from migration staging. Collapse pass-through modules as each cluster is
simplified.

### [MIGRATION-FOLLOWUP] P3 I2 C2 — Simplify repeated modal plumbing

Several core modal subclasses still specialize submit/busy handling despite
`core_modal_controller_base.js` providing shared helpers (`setSubmitting`
overrides in `clone_case_core`, `pick_scorer_core`, `share_case_core`; `setBusy`
in `diff_core`, `import_ratings_core`, `judgements_core`; `setLoading` in
`move_query_core`). Consolidate only identical behavior when touching those
controllers; keep specialized state and intentionally different redirect
delays. Leave the two `setProgress(visible)` copies alone for now. For URL
placeholder replacement, prefer server-owned URLs passed through data
attributes or form actions over a generic client-side `fillUrlTemplate` helper.

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
`_footer_core_app.html.erb`), esbuild IIFE bundles (`core_case.js`,
`core_vendor.js`; every other page uses the importmap), and CSS layer
(`core-additions.css` ~660 lines, `bootstrap5-compat.css` ~640 lines). Steps:

1. Merge `_header_core_app.html.erb` into `_header.html.erb`, rendering the
   case-specific parts (case name, try, score) only on a case. Same for the footer.
2. Render the case page in `application.html.erb`, linking the `core` CSS
   bundle there instead of `application`. Move `core_case.js` onto the importmap
   at the same time; that needs pins for `sortablejs` and `splainer-search/wired.js`
   (the package ships only an IIFE `dist`).
3. Rename the `_core` twins (11 `controllers/*_core_controller.js`, 10
   `shared/_*_core_modal.html.erb`). Only `share_case` has a non-core
   counterpart; for the rest the suffix just means "lives on the case page".
   Don't rename before steps 1–2; it's churn on its own.

Keep `<base href>` in both layouts: `core_capabilities_runtime.js`,
`detailed_document_modal.js` and `search_result_controller.js` rely on
`document.baseURI` for sub-path deployments.

**Bootstrap 3 look (decided 2026-10-03): keep it, scoped to the case page.**
`html { font-size: 87.5% }`, the BS3 brand blue `#337ab7` (`--q-brand-blue`),
the BS3 `<pre>` box and modal shadow, and ~50 "BS3" comments in
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

### [MIGRATION-FOLLOWUP] P3 I1 C2 — Convert markup-owning `utils/` DOM helpers to controllers (retrofit Track E)

`dynamic_modal.js`, `detailed_document_modal.js`, `destructive_form.js` and
`status_message.js` own markup and events but are not Stimulus controllers.
Convert them into controllers or controller mixins. Leave thin Bootstrap
wrappers (`bs_modal`, `bs_tooltip`, `bs_popover`) as helpers. Opportunistic.

### [MIGRATION-FOLLOWUP] P3 I2 C3 — Server-rendered modal lists (retrofit Track D, blocked)

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

The 2026-10-02 sweep left these unverified in the browser: confirming Delete
Query in the accumulated review (Track C batch 3 verified real Delete/Move
separately); actual imports, export downloads, and scorer/book saves; and a
templated Elasticsearch/OpenSearch query's rendered-template success path (no
suitable dev case; unit tests only). Track D's no-endpoint subset was compared
on 4.11, 4.13, 7.7 and 7.9; scenarios sharing only a touched file were not
rerun: 4.10, 4.12, 4.14, 4.24, 5.4, 11.2, 17.1, 17.2, 17.9.

### [MIGRATION-FOLLOWUP] P3 I1 C1 — Move remaining hand-written modals onto `_modal_shell`

`core/_try_details_modal.html.erb`, `core/_tune_relevance.html.erb` and
`shared/_query_options_core_modal.html.erb` hand-write
`.modal > .modal-dialog > .modal-content`. The shell needs a configurable
dismiss-button label ("Dismiss" vs "Cancel") and title heading tag. The
judgements form, query-doc-pairs index and unleash modals on non-core pages are
also candidates. Convert each when next edited.

### [MIGRATION-FOLLOWUP] P3 I1 C2 — Replace test-override shims with `vi.mock`

`utils/core_store_access.js`, `core_capability_access.js`, `core_flash.js` (a
`Proxy`) and `core_test_overrides.js` exist so specs can inject fakes into
production modules; `vi.mock` already does this in 34 specs. About 60 source
lines plus 21 importers. Small payoff across many files; fold into spec work
when it falls out naturally.

### [MIGRATION-FOLLOWUP] P3 I1 C1 — Adopt the shared controller fixture in remaining specs

`test/javascript/support/controller_fixture.js` (see
`docs/js_tooling.md#controller-test-fixtures`) is used by 17 controller specs.
Adopt it in smaller specs when touched. Separately, mounting real Stimulus
against real markup would catch ERB target/action drift the fixture can't;
use it for new specs and convert old ones when touched, not big-bang.

### [PREEXISTING] P3 I0 C2 — Identify API endpoints only the Angular client used

Git history didn't recover the old client's URLs (it built them by string
concatenation). The API is also public (scripts, notebooks), so an endpoint the
UI no longer calls is not necessarily dead. Only worth doing alongside an API
review.

---

## [PREEXISTING] P0 — Product bugs

### [PREEXISTING] P0 I1 C2 — Deleting the latest try bricks the case (backend)

**Observed:** `DELETE /api/cases/:id/tries/:n` on the live try returns 204, but `cases.last_try_number` still points at the deleted try. Reload → banner *"Cannot read properties of null (reading 'tryNo')"*; case unusable until DB repair.

**Cause:** `Api::V1::TriesController#destroy` destroys the try but never recomputes `last_try_number` (create increments it). Deleting the latest try (including via API) can brick on reload.

**Fix direction:** After destroy, set `last_try_number` to `tries.maximum(:try_number)` (or null), or forbid deleting the current try. Add a test that deletes the latest try, reloads the case, and verifies the next core bootstrap and score update both succeed.

**Frontend/UX:** the Tune Relevance try-delete action now asks for confirmation, but it still refuses only the *selected* try, not the latest one, so the backend fix above is still needed.

---

### [PREEXISTING] P0 I1 C3 — Try delete orphans scores

**Observed:** Scores keep a stale `try_id` after the try is deleted. (The `PUT /api/cases/:id/scores` 500 on an orphaned `last_score` is fixed — `same_score_source?` now treats a nil try as a different source.)

**Cause:** No cascade/nullify from try → scores (`case_scores.try_id` has no FK).

**Fix direction:** Cascade or nullify scores on try destroy.

---

## [PREEXISTING] P0 — Security

### [PREEXISTING] P0 I1 C2 — Public cases and snapshots allow unauthenticated mutation

**Location:** `app/controllers/api/v1/cases_controller.rb:10-16`, `app/controllers/api/v1/snapshots_controller.rb:13-20`

`Api::V1::CasesController#authenticate_api!` calls `set_case` and returns success whenever the case is public, regardless of action. That inherited callback covers `show`, `update`, and `destroy`, so a public case can be modified or deleted without an API key. `SnapshotsController` has the same bypass for listing, creation, and deletion.

**Fix direction:** "Public" grants read access only; mutation requires an authenticated user plus an ownership/permission check. Split authentication into separate read and write policies instead of overriding the shared callback by action name. Add negative tests first: anonymous `PUT/PATCH/DELETE` against public cases and snapshots.

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

### [PREEXISTING] P1 I2 C3 — Job progress broadcasts go to one global, unauthenticated stream

**Location:** `app/jobs/run_case_evaluation_job.rb`, `run_judge_judy_job.rb`, `export_book_job.rb`, `populate_book_job.rb`, `app/services/book_importer.rb`, `app/channels/application_cable/connection.rb`

Every job broadcasts to the single `:notifications` stream, which the home, books and websocket-tester pages subscribe to. Every subscriber therefore receives every user's job progress, including case query text from `admin/run_case/_notification`, whether or not the page shows it. `ApplicationCable::Connection` identifies no user, and the signed stream name is the same for everyone, so a subscriber does not need to be signed in.

**Fix direction:** Broadcast to per-record streams (`[acase, :notifications]`, `[book, :notifications]`) and subscribe only on pages for that record. Authenticate the Cable connection from the session.

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

### [PREEXISTING] P2 I2 C3 — Judgement rating not validated against book's scale (outside AI judging)

**Observed:** `Judgement#rating` only validates presence, never that the value is actually one of the book's configured scale values. `Api::V1::JudgementsController#update`, `JudgementsController`, and `BulkJudgeController#save` (`judgement.rating = params[:rating]`, no scale check) all write a client-supplied rating with no scale check — they're only "safe" today because the judging UI happens to render buttons limited to the book's actual scale values; nothing stops a raw form/API POST from bypassing that. The AI-judging path (`app/jobs/run_judge_judy_job.rb`, hardened in `37840b47`) is the only one with a guard, and it's job-local.

**Cause:** No model-level validation ties `Judgement#rating` to `query_doc_pair.book.scale`.

**Audit result (done):** Two call sites *legitimately* write ratings outside the discrete scale, both gated on `book.support_implicit_judgements?`:
- `[PREEXISTING]` `BooksController#combine` (`app/controllers/books_controller.rb:277`) averages two existing ratings — `(judgement.rating + j.rating) / 2` — and explicitly skips rounding when `support_implicit_judgements` is true (e.g. `(0+3)/2 = 1.5` on a `[0,1,2,3]` scale).
- `[PREEXISTING]` `JudgementFromRatingJob#perform` (`app/jobs/judgement_from_rating_job.rb:24`) copies a case-level `Rating#rating` straight into `judgement.rating` via `judgement.save!` (raises on failure) — that value comes from the case's scorer scale, which has no guaranteed relationship to the book's judgement scale.

`BookImporter`/`RatingsImporter` are fine: `RatingsImporter` writes the unrelated `Rating` model, and `BookImporter#import_judgement` already silently no-ops on failed saves.

**Fix direction:** Add an `inclusion` validation on `Judgement` scoped to `query_doc_pair.book.scale`, conditioned `unless: -> { query_doc_pair&.book&.support_implicit_judgements? }` (safe-navigate — `query_doc_pair` is a required `belongs_to` but its own presence validation runs independently, so a blank `query_doc_pair` must not blow up this lambda with a `NoMethodError`) so the two legitimate continuous-rating paths above stay unaffected. Change `JudgementFromRatingJob` to `save` + handle a validation failure instead of `save!` (a case rating can legitimately be off-scale for an explicit-only book). Retire the job-local check in `run_judge_judy_job.rb` in favor of the model validation (catch the failure, call `mark_unrateable`).

---

### [PREEXISTING] P2 I1 C3 — `BooksController#combine` collapses anonymous judgements into one averaged row

**Location:** `app/controllers/books_controller.rb:275` — `combine`

The merge loop upserts each source judgement with `query_doc_pair.judgements.find_or_initialize_by(user: j.user)`. `Judgement` deliberately permits several nil-user rows per pair (`validates :user_id, uniqueness: { scope: :query_doc_pair_id }, unless: -> { user_id.nil? }`), so *every* anonymous judgement in the source book matches the same target row. N anonymous judgements collapse to 1 — and because the same loop averages (`(judgement.rating + j.rating) / 2`), the surviving rating is an order-dependent running mean, not a true average.

**Reproduced** by running the verbatim inner loop against the test DB (a script, not a Playwright pass): a source pair carrying anonymous `[1.0, 3.0, 3.0]` produced **one** target row rating `2.5`, where the true mean is 2.33.

**Cause:** Same root cause as the import bug fixed in `BookImporter#import_judgement` on 2026-09-10 — `find_or_initialize_by(user: nil)` treats "no judge" as an identity.

**Fix direction:** Needs a product call first: should anonymous judgements copy across as separate rows (mirroring the importer, no averaging), or keep collapsing into one averaged row? If separate, skip the find when `j.user.nil?` and `build` unconditionally. Note the averaging is order-dependent even for identified users once you merge 3+ books; the same `combine` line is already documented under [Judgement rating not validated against book's scale](#judgement-rating-not-validated-against-books-scale-outside-ai-judging) for a different reason.

---

### [PREEXISTING] P2 I1 C3 — Re-importing anonymous judgements is not idempotent, and it moves computed case ratings

**Location:** `app/services/book_importer.rb` — `import_judgement`

An anonymous judgement has no identity to upsert on, so as of the 2026-09-10 fix each import `build`s a new row (the alternative — `find_or_initialize_by(user: nil)` — collapsed all of them into one, which was worse). The accepted cost is documented in the code and in `docs/manual-testing/10-books-management.md`. What makes it more than cosmetic: `RatingsManager#calculate_rating_from_judgements` averages 1-2 judgements but takes the **min of the top 3** at 3 or more, so duplication can move a rating a user never re-judged — `[3.0, 0.0]` → 1.5 becomes `[3.0, 3.0, 0.0]` → 0.0. Pinned by `test/services/book_importer_test.rb`'s "re-importing anonymous judgements duplicates them and moves the computed case rating".

**Reached by** the ordinary export → re-import path, since `_judgements.json.jbuilder` emits `user_email` only `if judgement.user`, so exported anonymous rows come back identity-less; also by a Mission Control retry of a failed `ImportBookJob` (no `retry_on`, and `book.import_file.purge` runs *after* `service.import`), and plausibly by a double-submitted import form.

**Fix direction:** Needs a product call, same as the `combine` entry below. Option: treat a payload's `judgements` array as authoritative for a pair's *anonymous* set — `query_doc_pair.judgements.where(user: nil).delete_all` before building the incoming user-less ones — which keeps upsert semantics for identified judges and makes repeated imports converge. Wrong answer if a book legitimately accumulates anonymous judgements across several import files.

---

### [PREEXISTING] P2 I1 C2 — `Api::V1::JudgementsController#create` keys its lookup off `:user` but assigns `:user_id`

**Location:** `app/controllers/api/v1/judgements_controller.rb:80`

`find_or_create_by(query_doc_pair_id: ..., user_id: judgement_params[:user])` looks up on `:user`, while eight lines later the judge is assigned from `judgement_params[:user_id]`. The lookup therefore runs with `user_id: nil`, which can match an existing *anonymous* judgement on that pair and then re-attribute it to the posting user: a silent overwrite of someone else's rating instead of a new row.

**Status:** Confirmed by reading `extract_judgement_params` — `:user` is **not** in its permit list (`:rating, :unrateable, :judge_later, :query_doc_pair_id, :user_id, :explanation`), so `judgement_params[:user]` is always nil and the lookup key is *always* `nil`, not just when a caller omits it. Consequences in order: the endpoint never attributes a judgement to anyone unless the caller passes `user_id`; when a caller does pass it, the request adopts and re-attributes an existing anonymous row; two API clients judging the same pair fight over one row. Deferrable because nothing in Quepid's own frontend calls it (grepped `app/javascript`, `app/assets/javascripts`) — this is external API surface only. Note the existing controller test asserts only a `judgements.count` delta, so it passes either way. Same bug family as the `BookImporter` nil-user work of 2026-09-10.

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

### [PREEXISTING] P2 I1 C2 — Floating labels break when a field has a validation error

**Observed:** On the Profile form, saving a duplicate email shows "Email has already been taken" but the floating "Email" label drops below the input and overlaps the Gravatar help text. The profile header card also shows the rejected email as if it were saved.

**Cause:** Rails' default `field_error_proc` wraps the errored input in `div.field_with_errors`, which breaks Bootstrap's `.form-floating > .form-control ~ label` sibling selector. The header reads `current_user.email` from the unsaved, invalid model.

**Fix direction:** Set a `field_error_proc` that adds `is-invalid` to the input instead of wrapping it, and render the profile header from the persisted user (`current_user.reload` or an `*_was` value) when the update fails.

---

### [PREEXISTING] P2 I0 C0 — Ratings page heading says "Scores for Case"

`app/views/ratings/index.html.erb` uses `page_header "Scores for #{case_title @case}"` — copy-pasted from the scores page. Should read "Ratings for …".

---

### [PREEXISTING] P2 I1 C1 — New annotation shows its score unrounded

Right after **Create** in Tune Relevance → Annotations, the new entry reads e.g. `Score: 0.08723905360685648`; after an edit (re-rendered from the server) the same annotation reads `0.0872391`. `annotations_controller.js` appends `annotation.score.score` raw, as the Angular template did. Format the score consistently (e.g. two decimals, like the case score badge).

---

### [PREEXISTING] P2 I1 C1 — Compare Snapshots copy says 1–3 but allows 5

The modal says "Select 1-3 snapshots to compare", but `diff_core_controller.js` caps selections at `maxSnapshots` (default 5), as `main` did via `queryViewSvc.getMaxSnapshots()`. Make the copy read from the same limit.

---

### [PREEXISTING] P2 I0 C2 — Tune Relevance drawer can be dragged wider than the window

Dragging the slider past the left edge of the window leaves the drawer wider than the viewport (main column about 230px, drawer about 1490px at a 1440px window), and resizing the window doesn't correct it. `pane_controller.js#moveEastTo` uses `event.clientX` unclamped, as `main`'s `paneSvc.js` did. Clamp the position to a minimum main-column width and a minimum drawer width.

---

### [PREEXISTING] P2 I0 C2 — Cloning a case doesn't keep manual query order

Cloning case 6 swapped its first two queries. `Case#clone_case` dups each query and appends it, and `Arrangement::Item` re-sequences `arranged_at` on create, so the original order isn't copied. Copy `arranged_at` (or re-sequence in the original order) and cover it with a model test.

---

### [PREEXISTING] P2 I0 C2 — Snapshot CSV import gives no success confirmation

**Observed:** On the cases list, a successful Import Snapshots from CSV just closes the modal; no flash says what was created. (The in-case Import modal's Snapshots tab does flash "Snapshots imported successfully!".) The failure message for a nonexistent `Case ID` is also generic: "1 snapshot(s) failed to import. Some may have been imported successfully." without saying the case wasn't found.

**Fix direction:** Flash the number of snapshots created and name the case(s); surface the per-snapshot reason (e.g. "Case 999999 not found") in the failure alert.

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

### [PREEXISTING] P3 I1 C0 — Proxy `proxy_debug` boolean parsing

**Location:** `app/controllers/proxy_controller.rb:26`

Uses `'true' == params[:proxy_debug]` instead of `deserialize_bool_param`. Low real-world impact.

---

### [PREEXISTING] P3 I2 C2 — Proxy URL parsing bug

**Location:** `app/controllers/proxy_controller.rb:75-80` (`extract_extra_url_params`)

Manual `split('?')` / `split('=')` only captures the first embedded query param for proxied GET requests (e.g. loses `rows` from `?q=test&rows=10`). The shared HTTP client already reapplies the embedded URL query for POST requests, so this item does not include a separate POST-loss defect.

Fix the overlapping URL parsing call sites together. Add multi-parameter and
encoded-value tests (code review 2026-09-29 recommends
`Addressable::URI#query_values`). The duplicate parsing in
`api/v1/search_endpoints/validations_controller.rb` and
`application_helper.rb` (`get_protocol_from_url`) should use the same helper;
this is a refactoring part of this item, not a separate bug.

**Recommendation:** Cherry-pick `UrlParserService` from `origin/deangularjs-experimental` (commit `db1c4e50`) as its own small PR rather than reimplementing from scratch. That branch is a 1092-file, big-bang AngularJS→Rails rewrite that changed core architecture (server-side search execution, two-tier scoring, dropped/relocated features) — almost certainly why it was never merged, since it conflicts with this project's incremental per-surface migration strategy (see `angular-case-migration` skill). But `UrlParserService` itself is small, self-contained, and clean: wraps `Addressable::URI` (already a `Gemfile` dependency — no new gem needed), has 9 focused unit tests, and its `query_values` method fixes exactly this bug. Note that branch's `ProxyController` still had the CSRF-skip issue above — that fix wasn't part of the same effort and needs doing separately regardless.

---

## [PREEXISTING] P3 — Code quality

### [PREEXISTING] P3 I0 C1 — Unsafe integer coercion in snapshot search

**Location:** `app/controllers/api/v1/snapshots/search_controller.rb:45-46`

`params[:rows].to_i` / `params[:start].to_i` without validation; non-numeric strings coerce to `0`.

---

### [PREEXISTING] P3 I0 C1 — Predicate method naming

**Location:** `app/models/selection_strategy.rb`

Rename `user_has_judged_all_available_pairs?` → `user_judged_all_available_pairs?` (style-only; project convention — see `credentials?` vs `has_credentials?` in CLAUDE.md, already followed by `HttpClientService#credentials?`).

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

### [PREEXISTING] P2 I0 C2 — Potential N+1 queries

1. **`app/controllers/cases_controller.rb:32`** — `includes(:owner, :teams, scores: :user).distinct`; scores accessed later may still N+1.
2. **`app/controllers/teams_controller.rb:248`** — `includes(:owner, :teams)`; missing `scores` if the view touches them.

Bullet is enabled in dev/test — fix as surfaced; review views for missing eager loads.

### [PREEXISTING] P2 I1 C2 — API serializer query amplification

`app/views/api/v1/users/_user.json.jbuilder:12-13` runs three relation counts per user; `app/views/api/v1/cases/_case.json.jbuilder:13-51` repeatedly traverses `last_score`, owner, book, teams, tries, and sampled scores. These become N+1s on index endpoints, especially team/case listings; `app/controllers/api/v1/cases_controller.rb:192` preloads only `tries`, `teams` and `cases_teams`.

**Fix direction:** Endpoint-specific query objects, or preload/count exactly what each serializer needs. Add query-count tests for representative index responses, not just response-shape tests.

---

## [PREEXISTING] Backend duplication

The same feature is built several times, and most copies have already drifted
apart, so behavior depends on which path ran. Where copies differ, decide which
behavior is correct before consolidating and call it out in the PR. One pattern
per PR; keep this out of in-flight feature branches.

### [PREEXISTING] P2 I2 C2 — One trigger for judgement ↔ rating sync

`UpdateCaseRatingsJob` is enqueued by hand 5 times in `JudgementsController` and
3 times in `BulkJudgeController`. `Api::V1::JudgementsController` create, update
and destroy never enqueue it, so API judgement writes never sync to case
ratings. `BookImporter` and `RunJudgeJudyJob` take other routes (the latter runs
a whole-book `UpdateCaseJob`). In the other direction, `JudgementFromRatingJob`
runs for single and bulk rating saves but not for `RatingsImporter`.

**Fix direction:** an `after_commit` on `Judgement` (and possibly `Rating`), or
route every write through one `Judgements::Recorder`. Decide which bulk paths
(import, AI judging) should batch instead of syncing per row. Related: "find or
create the book's query-doc pair by query text and doc id" is written five
times (`PopulateBookJob`, `JudgementFromRatingJob`, `BooksController`,
`Api::V1::QueryDocPairsController`, `BookImporter`); it belongs on `Book`.

### [PREEXISTING] P2 I2 C1 — Shared CSV export helper; two exports allow formula injection

`make_csv_safe` is copied into `Api::V1::Export::RatingsController` and
`Api::V1::JudgementsController`; JS has a stricter `csvField` in
`utils/case_csv.js`. `api/v1/export/queries/information_needs/show.csv.erb` and
`admin/users/index.csv.erb` don't neutralize spreadsheet formulas at all.

**Fix direction:** one Ruby `CsvExport` helper (formula neutralizing plus
`CSV.generate_line`) used by every `.csv.erb`. Case export is also split: the
general, detailed and snapshot CSVs are built in the browser, basic and
information-need on the server; moving them is a separate decision.

### [PREEXISTING] P2 I3 C2 — Team sharing service

Share/unshare is written per entity: web `TeamsController#share_case`,
`#unshare_case`, `#share_book`, `#unshare_book`, `#share_search_endpoint`,
`#unshare_search_endpoint`, `ScorersController#share`/`#unshare`; API
`Api::V1::TeamCasesController`, `TeamScorersController`, and book sharing in
`Api::V1::BooksController#create`. The copies disagree: API case sharing also
shares the case's search endpoint (web doesn't); book sharing records no
analytics event; scorer actions use `find_by` with a combined "Team or scorer
not found" message while the others 404.

**Fix direction:** one `TeamSharing` service with per-entity config (access
scope, display name, side effects, analytics event).

### [PREEXISTING] P3 I2 C2 — Deferred job payload and progress broadcaster

The pickle-request-to-storage → job-unpickles-and-purges hand-off is written
three times (`Books::ImportController` → `ImportBookJob`,
`Api::V1::Books::PopulateController` → `PopulateBookJob`,
`Api::V1::SnapshotsController` → `PopulateSnapshotJob`), along with copied
`track_book_*_queued` helpers; a `DeferredPayload` concern (`stash!`,
`load_and_purge!`) covers both halves. `broadcast_render_to(:notifications, …)`
is called by hand in 6 files, and the per-1% progress loop is written twice
(`BookImporter`, `PopulateBookJob`, both rendering `books/blah`); a
`ProgressBroadcaster` would own throttling and target (coordinate with the
per-record stream fix under P1 Security). `Books::ExportController#update` and
`Api::V1::Export::BooksController#update` are flagged as duplicates and already
differ: only the web one deletes the old export file before queueing.

### [PREEXISTING] P3 I1 C2 — `Archivable` model concern

`Case` and `SearchEndpoint` define `mark_archived`/`mark_archived!`; `Book`
defines `archive!` but `BooksController` calls `update(archived: true)`
directly. `not_archived` includes `nil` on `Case` but not on `SearchEndpoint`.
Case archive/unarchive actions are copied between `CasesController` and
`TeamsController`. One concern with `archive!`, `unarchive!`, `archived`,
`not_archived` fixes naming and scope semantics. While there: the
`if defined?(Analytics::Tracker) && Analytics::Tracker.respond_to?(…)` guard is
repeated 8 times; the tracker is always loaded, so it can go.

### [PREEXISTING] P3 I2 C1 — Index-page text search scope

About 17 index actions (cases, books, teams, scorers, search endpoints, ratings,
judgements, query-doc pairs, bulk judge, admin users and announcements)
hand-write `where('LOWER(col) LIKE ?', "%#{q.downcase}%")`. None escape `%` or
`_`; `sanitize_sql_like` isn't used anywhere. A `search_by(:name, ...)` scope in
a concern removes the repetition and fixes escaping once.

Not worth acting on: search-response parsing exists in Ruby
(`FetchService#extract_docs_*`) and JS (splainer-search) because evaluations run
server-side; keep them in step rather than merging.

---

## [PREEXISTING] RuboCop deferrals

Inline `rubocop:disable` only on this branch (no config-level excludes). Search codebase for `rubocop:disable` for the full list.

### [PREEXISTING] P3 I1 C2 — Metrics/ParameterLists

- `[PREEXISTING]` P3 I1 C2 — `Case#clone_case` — `app/models/case.rb:130`
- `[PREEXISTING]` P3 I1 C2 — `HttpClientService#initialize` — `app/services/http_client_service.rb:32`

### [PREEXISTING] P3 I2 C3 — Complex methods (Metrics/*)

Candidates for extraction into smaller methods or services:

- `[PREEXISTING]` P3 I2 C3 — `FetchService` — `app/services/fetch_service.rb`
- `[PREEXISTING]` P3 I2 C2 — `Api::V1::Import::RatingsController#create`
- `[PREEXISTING]` P3 I2 C2 — `Api::V1::Export::RatingsController`
- `[PREEXISTING]` P3 I2 C2 — `Api::V1::Snapshots::SearchController`
- `[PREEXISTING]` P3 I3 C3 — `BookImporter` / `RatingsImporter`
- `[PREEXISTING]` P3 I2 C3 — `MapperWizardsController`
- `[PREEXISTING]` P3 I2 C3 — `TeamsController` / `BooksController` / `HomeController`

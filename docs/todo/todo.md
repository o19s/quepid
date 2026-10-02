# Todo

**Last updated:** 2026-10-02

Outstanding bugs, hardening, and cleanup on `main` only. When something is fixed, remove its entry — do not add a completed section or keep resolved items for history.

Every actionable item carries a provenance marker: `[MIGRATION]` means it was
introduced by or is required to complete AngularJS removal, `[MIGRATION-FOLLOWUP]`
means it is related cleanup but not necessarily a migration regression, and
`[PREEXISTING]` means it predates the AngularJS removal. Use these markers when
choosing migration work; do not treat pre-existing defects as migration regressions.

Product bugs marked *Playwright MCP* were verified in a May 2026 headed pass and re-checked against the tree in Aug 2026. Line numbers may drift — re-check cited files before fixing.

## [MIGRATION-FOLLOWUP] Frontend cleanup after Angular removal

### [MIGRATION] Search failure flashes expose link markup

A controlled failed search shows literal `<a href="...">` markup in the error flash instead of clickable endpoint/troubleshooting links (manual scenario 4.21; `.playwright-mcp/due-sweep/query-error.png`). The search-error translator returns markup, while `flash_controller.js` renders messages as text unless explicitly opted into HTML.

Baseline source at pre-deangularization `main` commit `5f53d8f8c470d3471055510c1f41d490302ea75b` uses `ng-bind-html="flash.message"` in `app/assets/templates/views/common/search_flash.html` and builds these links in `searchErrorTranslatorSvc.js`. This establishes a migration difference by source inspection, not a live historical replay.

Render the troubleshooting links safely, preferably as structured message/link data. Preserve escaping for endpoint URLs and server/user text; do not enable unrestricted HTML for all flash messages. Recheck the failed-search flow and ordinary plain-text errors.

### [MIGRATION] Debug Explain opens with its tree collapsed

On pre-deangularization `main` (`86e3de9f`), Debug Explain (Matches popover → **Debug**) opens with the explain tree fully expanded: `components/debug_matches/_modal.html` passes `collapsed="false"` to `json-explorer`. The Stimulus port shows only `+ details: [...]` until the user expands it, because `match_explain_controller.js#openDebugModal` passes `{ collapsed: true }` (introduced in `0be2aefb`). Confirmed with a live before/after replay (`.playwright-mcp/branch-ui-diff/6.8-debug-modal-{before,after}.png`). Pass `collapsed: false` and recheck manual scenario 6.8.

### [MIGRATION-FOLLOWUP] Clicking a hot-match bar now opens Debug Explain

On `main`, each hot-match bar under **Matches** declares `ng-click="showDetailed()"` (`views/stackedChart.html`), but in a live replay clicking a bar opened nothing; `showDetailed` lives on the search-result scope rather than the chart's. The Stimulus port opens Debug Explain on bar click. Decide whether to keep that new affordance or drop it for parity, and document the decision in scenario 6.8 or 4.23.

### [MIGRATION] Tune Relevance drawer closes after Rerun My Searches!

On `main`, saving from the drawer keeps it open on the new try. This branch navigates to `case/:id/try/:n` and the drawer is closed afterward. Calling `save()` directly shows the same result, so this predates the Stimulus action routing. Decide whether to restore main's behavior; recheck scenario 4.10.

### [MIGRATION] Minor Tune Relevance and Missing Documents differences

Found in the same before/after replay against `main` (`86e3de9f`):
- The Settings tab opens with every section expanded; `main` starts Evaluate Nightly, Escape Queries and Search Endpoints collapsed (scenario 4.12).
- The background-run button reads "Rerun My Searches in the Background!"; `main` says "Rerun My Searches Now in the Background!".
- Missing Documents names the static engine "Static"; `main` says "Static File" (scenario 4.9).

### [MIGRATION-FOLLOWUP] Move Query modal ignores Escape after a case is chosen

Picking a case calls `move_query_core_controller.js#renderCases`, which rebuilds the list buttons. The clicked button is replaced, so focus falls back to `<body>`. Bootstrap only handles Escape when focus is inside the modal, so Escape no longer closes it (the close button still works). Keep focus on the newly rendered active item. Found on 2026-10-02 while verifying scenario 4.4.

### [MIGRATION-FOLLOWUP] core_smoke E2E fails against current dev data

Five `test/playwright/core_smoke.spec.ts` tests fail identically on `HEAD` (`71ff9ad1`) and with the 2026-10-02 fixes applied:
- Screenshot diffs: open case, explain modal, query results render, and leave a judgement (about 4–5% of pixels).
- A timeout in "rating updates the query score…": the rating option is detached while the test clicks it.

The fixture case 219 has drifted: it now has 21 queries and a "Try 31 - Try 2" header. Reseed or restore the fixture before treating these as regressions. Don't regenerate the baselines against the drifted data.

### [PREEXISTING] P0 — Scorer sandboxing

Client scorer code still executes through `new Function()`; evaluate a Web
Worker or equivalent browser isolation. V8/MiniRacer remains the batch path.

### [PREEXISTING] P1 — Scorer contract drift

`app/javascript/utils/scorer_runtime.js` and `scorer_catalog.js` need a canonical
shared API and migration guidance.

### [PREEXISTING] P2 — Accessibility

Score and rating controls still convey state by color alone; add text or icons so state is not color-only, and cover it with the relevant Playwright scenario.

### [PREEXISTING] P2 — Try delete has no confirm dialog

`deleteTry()` in `tune_relevance_controller.js` has the null and active-try guards, but one click on Delete still removes the try permanently. Add a confirm step.

### [MIGRATION-FOLLOWUP] P3 — Workbench clips at phone width

At 375px the core workbench clips on the right with no scroll: the toolbar's Compare snapshots / Import / Share case links, each query row's result count and expand chevron, and the end of the case title are cut off. 768px is fine. Phone width isn't an official target and this wasn't compared against `main`; let the toolbar and query-row header wrap.

### [PREEXISTING] P2 — Explain Query Copy gives no feedback

`query_explain_controller.js` swallows `copyText()` rejections (`.catch(() => {})`) and shows no success state. Surface failure and a "Copied!" state.

Leave the two `setProgress(visible)` copies alone for now. For URL placeholder
replacement, prefer server-owned URLs passed through data attributes or form
actions over a generic client-side `fillUrlTemplate` helper.

### [MIGRATION-FOLLOWUP] P3 — Extract untestable read-model logic from `live_query_runtime_owner.js`

Three pieces of real logic in `app/javascript/utils/live_query_runtime_owner.js`
are closure-private and can only be reached by driving a full search through the
runtime graph, so they have no unit coverage (StrykerJS: the file scores ~17%,
almost all of it wiring that is covered elsewhere):

- `createDocList` — builds the user-facing "ID field missing" / "ID shared with
  another doc" errors and the placeholder ids for those docs.
- `documentUrlFor` (inside `publishQueryDocuments`) — injects
  `basicAuthCredential` into document links and prefixes the proxy URL when
  `proxyRequests` is on.
- `buildDiffReadModel` — snapshot-comparison columns: hides docs under
  show-only-rated, computes `maxDocScore`, defaults name/score.

**Fix direction:** Move them into a small pure module (e.g.
`app/javascript/utils/live_query_read_models.js`) that takes its dependencies as
arguments (`normalDocsSvc.createNormalDoc`, `proxyUrlFor`, `showOnlyRated`), have
the owner call it, and add a Vitest spec. Re-run
`yarn test:mutation --mutate "app/javascript/utils/live_query_read_models.js"`
to confirm the new tests kill its mutants.

---

## [PREEXISTING] P0 — Product bugs

### [PREEXISTING] Deleting the latest try bricks the case (backend)

**Observed:** `DELETE /api/cases/:id/tries/:n` on the live try returns 204, but `cases.last_try_number` still points at the deleted try. Reload → banner *"Cannot read properties of null (reading 'tryNo')"*; case unusable until DB repair.

**Cause:** `Api::V1::TriesController#destroy` destroys the try but never recomputes `last_try_number` (create increments it). Deleting the latest try (including via API) can brick on reload.

**Fix direction:** After destroy, set `last_try_number` to `tries.maximum(:try_number)` (or null), or forbid deleting the current try. Add a test that deletes the latest try, reloads the case, and verifies the next core bootstrap and score update both succeed.

**Frontend/UX** (confirm dialog): see [Frontend cleanup after Angular removal](#frontend-cleanup-after-angular-removal).

---

### [PREEXISTING] Try delete orphans scores

**Observed:** Scores keep a stale `try_id` after the try is deleted. (The `PUT /api/cases/:id/scores` 500 on an orphaned `last_score` is fixed — `same_score_source?` now treats a nil try as a different source.)

**Cause:** No cascade/nullify from try → scores (`case_scores.try_id` has no FK).

**Fix direction:** Cascade or nullify scores on try destroy.

---

## [PREEXISTING] P0 — Security

### [PREEXISTING] Public cases and snapshots allow unauthenticated mutation

**Location:** `app/controllers/api/v1/cases_controller.rb:10-16`, `app/controllers/api/v1/snapshots_controller.rb:13-20`

`Api::V1::CasesController#authenticate_api!` calls `set_case` and returns success whenever the case is public, regardless of action. That inherited callback covers `show`, `update`, and `destroy`, so a public case can be modified or deleted without an API key. `SnapshotsController` has the same bypass for listing, creation, and deletion.

**Fix direction:** "Public" grants read access only; mutation requires an authenticated user plus an ownership/permission check. Split authentication into separate read and write policies instead of overriding the shared callback by action name. Add negative tests first: anonymous `PUT/PATCH/DELETE` against public cases and snapshots.

---

### [PREEXISTING] User API IDOR and cross-account write path

**Location:** `app/controllers/api/v1/users_controller.rb:24-48`, `test/controllers/api/v1/users_controller_test.rb:30-39`

`set_user` looks up any user by email or numeric ID without scoping to `current_user`, and `update` permits `company`, `completed_case_wizard`, and `default_scorer_id`. The existing test codifies one signed-in user fetching another's record. Unless this is an intentional admin directory, it exposes account metadata and allows cross-account changes.

**Fix direction:** Scope ordinary requests to `current_user`. If admin lookup is needed, make it a separate admin-only endpoint with its own serializer and authorization test.

---

## [PREEXISTING] P1 — Product bugs

### [PREEXISTING] Uploading the judgements export imports nothing and reports success

**Location:** `app/services/book_importer.rb:66`, `app/views/api/v1/judgements/index.json.jbuilder`, `app/views/books/import/edit.html.erb:71`

The Import Judgements panel tells users verbatim: *"The format for importing Judgement data is the same as that for exporting it: `/api/books/:id/judgements`"*. That endpoint emits a top-level **`judgements`** key; `#import` only reads **`all_judgements`**, and nothing normalizes between them (`grep all_judgements app/controllers app/jobs app/services` → importer only). So the advertised round-trip drops every row, `#import` still returns `true`, and the user gets "Data was successfully queued for import."

**Status:** Confirmed by reading; not driven through the UI. Two nearby format mismatches in the same panel, worth fixing together: the export's per-judgement `judgement_id` key isn't a `Judgement` attribute (a denylist entry now absorbs it, see `UNASSIGNABLE_JUDGEMENT_KEYS`), and the panel's promise that *"If you do NOT provide a `query_doc_pair_id` then you must provide `query_text` and `doc_id`"* isn't implemented — `find_query_doc_pair` returns nil for a blank id and `import_all_judgements` then does `next unless qdp`, silently dropping the judgement. Only the nested-`query_doc_pair`-object form actually upserts.

**Fix direction:** Pick one canonical envelope and add a fixture-based export → import round-trip test. Accept `judgements` as an alias for `all_judgements` (or make the export emit `all_judgements`), implement the flat `query_text`/`doc_id` fallback through `find_or_initialize_query_doc_pair`, and either way make a payload that matches zero rows report that instead of flashing success. Needs the allowlist work above first, since routing flat `query_text`/`doc_id` into `Judgement#assign_attributes` would raise `UnknownAttributeError` under the current denylist.

---

### [PREEXISTING] Wizard TLS reload exposes basic-auth credentials

**Location:** `app/javascript/controllers/wizard_controller.js`, `renderTls`

The protocol-switch link places `basicAuthCredential` in the query string. A
credential entered during wizard setup can therefore leak through browser
history, server/proxy logs, referrers, and the subsequent `CoreController`
request. This behavior predates AngularJS removal; it was carried forward while
restoring the TLS handoff.

**Fix direction:** Preserve pending wizard state server-side or behind a
short-lived opaque token, and never put the credential itself in a URL.

---

### [PREEXISTING] Wizard TLS reload loses endpoint-specific settings

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

### [PREEXISTING] Account deletion fails for users who sent invitations, after deleting their cases

**Observed:** Deleting an account (Profile → Danger Zone) whose user has invited anyone (a pending invitee row with `invited_by_id` pointing at them) returns a 500: `ActiveRecord::InvalidForeignKey` on `fk_rails_ae14a5013f` (`users.invited_by_id → users.id`). The account survives, but its unshared cases are already gone — `AccountsController#destroy` calls `c.really_destroy` for each team-less case *before* `@user.destroy`, outside a transaction.

**Cause:** Nothing nullifies `users.invited_by_id` for invitees, and the case cleanup plus user destroy are not atomic. Same code on `main`.

**Fix direction:** Nullify `invited_by_id` on invitees before destroying the user (e.g. a `has_many :invitations, class_name: 'User', foreign_key: :invited_by_id, dependent: :nullify`), and wrap case cleanup + user destroy in one transaction so a failure leaves the account's data intact. Add a controller test that deletes a user with a pending invitee and an unshared case.

---

## [PREEXISTING] P1 — Security

### [PREEXISTING] Outbound HTTPS certificate verification is disabled globally

**Location:** `app/services/http_client_service.rb:91-101`

`HttpClientService` sets `faraday.ssl.verify = false` for every request (proxy, mapper wizard, downloads, search calls), permitting man-in-the-middle interception of credentials and API keys.

**Fix direction:** Remove the override. If development needs a custom CA, use a CA bundle or an explicit development-only opt-in. Add a test that production clients verify certificates.

---

### [PREEXISTING] Proxy SSRF controls are incomplete

**Location:** `app/controllers/proxy_controller.rb:105-120`, `app/services/http_client_service.rb:91-99`

The proxy validates the initial DNS resolution and blocks private ranges, but Faraday resolves the host again when making the request (DNS-rebinding window), and redirect following means an allowed public URL can redirect to an internal address without revalidation.

**Fix direction:** Use a single validated connection target, disable redirects by default, or validate each redirect target. Tests: redirect-to-private-address, IPv6/link-local, rebinding, non-default ports, credential forwarding.

---

### [PREEXISTING] Secrets exposed through API serializers and admin views

**Location:** `app/models/concerns/maskable_credential.rb:21-28`, `app/views/api/v1/search_endpoints/_search_endpoint.json.jbuilder:11-15`, `app/views/api/v1/tries/_try.json.jbuilder:22-25`, `app/views/admin/users/index.json.jbuilder:7-9`, `app/views/admin/users/show.html.erb:88-92`

`api_basic_auth_credential` is returned in full unless `REQUIRE_PROXY_WITH_BASIC_AUTH_CREDENTIALS` is enabled (default false), so shared endpoint members receive stored credentials in endpoint and try responses. Admin user JSON/HTML also render the encrypted password hash.

**Fix direction:** Never serialize credentials or custom secret headers; return a masked/presence-only value and proxy server-side when secrets are needed. Make this unconditional rather than flag-dependent. Remove password hashes from admin views.

---

### [PREEXISTING] Static Active Record encryption keys committed as production fallbacks

**Location:** `config/application.rb:55-61`

Deployments that omit the env vars use publicly known keys, so encrypted fields are recoverable by anyone with the database.

**Fix direction:** Fail fast in production when keys are absent; keep generated dev/test defaults out of production config; document key rotation and backup.

---

### [PREEXISTING] Proxy CSRF bypass and permissive CORS / Action Cable origins

**Location:** `app/controllers/proxy_controller.rb:5-8`, `config/initializers/cors.rb:6-17`, `config/environments/production.rb:41-50`

`fetch` skips CSRF verification (`skip_before_action :verify_authenticity_token`) for GET and POST while requiring login, so cross-site POSTs from an authenticated session remain possible. Production also allows every CORS origin, disables Action Cable request forgery protection, and accepts every Action Cable origin.

**Fix direction:** Restrict CORS to configured origins with credentials off unless needed; derive Action Cable allowed origins from the deployment host list; give the proxy a CSRF token or a deliberately token-authenticated route.

**Also open:** no rate limiting on proxy fetch (production concern when `proxy_requests: true`).

---

## [PREEXISTING] P2 — Security

### [PREEXISTING] Password reset enumerates accounts

**Observed:** Unknown email → "email was not found"; known email → neutral "you will receive…" message.

**Cause:** `config.paranoid` commented out in `config/initializers/devise.rb`.

**Fix direction:** Enable `config.paranoid = true` (or normalize both responses).

### [PREEXISTING] No minimum password length

**Observed:** Resetting a password through the reset link with `abc` succeeds and the user can then log in with it. Manual test 1.4's short-password edge case expects a validation error.

**Cause:** `User` validates only presence and `maximum: 80` on `password` (`app/models/user.rb`). `config.password_length = 8..72` in `config/initializers/devise.rb` is never applied because `:validatable` is not enabled.

**Fix direction:** Add a minimum length validation (match the Devise 8..72 setting) on password create/change paths, then check seed data, fixtures, and existing tests for shorter passwords.

---

## [PREEXISTING] P2 — Product bugs

### [PREEXISTING] Judgement rating not validated against book's scale (outside AI judging)

**Observed:** `Judgement#rating` only validates presence, never that the value is actually one of the book's configured scale values. `Api::V1::JudgementsController#update`, `JudgementsController`, and `BulkJudgeController#save` (`judgement.rating = params[:rating]`, no scale check) all write a client-supplied rating with no scale check — they're only "safe" today because the judging UI happens to render buttons limited to the book's actual scale values; nothing stops a raw form/API POST from bypassing that. The AI-judging path (`app/jobs/run_judge_judy_job.rb`, hardened in `37840b47`) is the only one with a guard, and it's job-local.

**Cause:** No model-level validation ties `Judgement#rating` to `query_doc_pair.book.scale`.

**Audit result (done):** Two call sites *legitimately* write ratings outside the discrete scale, both gated on `book.support_implicit_judgements?`:
- `[PREEXISTING]` `BooksController#combine` (`app/controllers/books_controller.rb:277`) averages two existing ratings — `(judgement.rating + j.rating) / 2` — and explicitly skips rounding when `support_implicit_judgements` is true (e.g. `(0+3)/2 = 1.5` on a `[0,1,2,3]` scale).
- `[PREEXISTING]` `JudgementFromRatingJob#perform` (`app/jobs/judgement_from_rating_job.rb:24`) copies a case-level `Rating#rating` straight into `judgement.rating` via `judgement.save!` (raises on failure) — that value comes from the case's scorer scale, which has no guaranteed relationship to the book's judgement scale.

`BookImporter`/`RatingsImporter` are fine: `RatingsImporter` writes the unrelated `Rating` model, and `BookImporter#import_judgement` already silently no-ops on failed saves.

**Fix direction:** Add an `inclusion` validation on `Judgement` scoped to `query_doc_pair.book.scale`, conditioned `unless: -> { query_doc_pair&.book&.support_implicit_judgements? }` (safe-navigate — `query_doc_pair` is a required `belongs_to` but its own presence validation runs independently, so a blank `query_doc_pair` must not blow up this lambda with a `NoMethodError`) so the two legitimate continuous-rating paths above stay unaffected. Change `JudgementFromRatingJob` to `save` + handle a validation failure instead of `save!` (a case rating can legitimately be off-scale for an explicit-only book). Retire the job-local check in `run_judge_judy_job.rb` in favor of the model validation (catch the failure, call `mark_unrateable`).

---

### [PREEXISTING] `BooksController#combine` collapses anonymous judgements into one averaged row

**Location:** `app/controllers/books_controller.rb:275` — `combine`

The merge loop upserts each source judgement with `query_doc_pair.judgements.find_or_initialize_by(user: j.user)`. `Judgement` deliberately permits several nil-user rows per pair (`validates :user_id, uniqueness: { scope: :query_doc_pair_id }, unless: -> { user_id.nil? }`), so *every* anonymous judgement in the source book matches the same target row. N anonymous judgements collapse to 1 — and because the same loop averages (`(judgement.rating + j.rating) / 2`), the surviving rating is an order-dependent running mean, not a true average.

**Reproduced** by running the verbatim inner loop against the test DB (a script, not a Playwright pass): a source pair carrying anonymous `[1.0, 3.0, 3.0]` produced **one** target row rating `2.5`, where the true mean is 2.33.

**Cause:** Same root cause as the import bug fixed in `BookImporter#import_judgement` on 2026-09-10 — `find_or_initialize_by(user: nil)` treats "no judge" as an identity.

**Fix direction:** Needs a product call first: should anonymous judgements copy across as separate rows (mirroring the importer, no averaging), or keep collapsing into one averaged row? If separate, skip the find when `j.user.nil?` and `build` unconditionally. Note the averaging is order-dependent even for identified users once you merge 3+ books; the same `combine` line is already documented under [Judgement rating not validated against book's scale](#judgement-rating-not-validated-against-books-scale-outside-ai-judging) for a different reason.

---

### [PREEXISTING] Re-importing anonymous judgements is not idempotent, and it moves computed case ratings

**Location:** `app/services/book_importer.rb` — `import_judgement`

An anonymous judgement has no identity to upsert on, so as of the 2026-09-10 fix each import `build`s a new row (the alternative — `find_or_initialize_by(user: nil)` — collapsed all of them into one, which was worse). The accepted cost is documented in the code and in `docs/manual-testing/10-books-management.md`. What makes it more than cosmetic: `RatingsManager#calculate_rating_from_judgements` averages 1-2 judgements but takes the **min of the top 3** at 3 or more, so duplication can move a rating a user never re-judged — `[3.0, 0.0]` → 1.5 becomes `[3.0, 3.0, 0.0]` → 0.0. Pinned by `test/services/book_importer_test.rb`'s "re-importing anonymous judgements duplicates them and moves the computed case rating".

**Reached by** the ordinary export → re-import path, since `_judgements.json.jbuilder` emits `user_email` only `if judgement.user`, so exported anonymous rows come back identity-less; also by a Mission Control retry of a failed `ImportBookJob` (no `retry_on`, and `book.import_file.purge` runs *after* `service.import`), and plausibly by a double-submitted import form.

**Fix direction:** Needs a product call, same as the `combine` entry below. Option: treat a payload's `judgements` array as authoritative for a pair's *anonymous* set — `query_doc_pair.judgements.where(user: nil).delete_all` before building the incoming user-less ones — which keeps upsert semantics for identified judges and makes repeated imports converge. Wrong answer if a book legitimately accumulates anonymous judgements across several import files.

---

### [PREEXISTING] `Api::V1::JudgementsController#create` keys its lookup off `:user` but assigns `:user_id`

**Location:** `app/controllers/api/v1/judgements_controller.rb:80`

`find_or_create_by(query_doc_pair_id: ..., user_id: judgement_params[:user])` looks up on `:user`, while eight lines later the judge is assigned from `judgement_params[:user_id]`. The lookup therefore runs with `user_id: nil`, which can match an existing *anonymous* judgement on that pair and then re-attribute it to the posting user: a silent overwrite of someone else's rating instead of a new row.

**Status:** Confirmed by reading `extract_judgement_params` — `:user` is **not** in its permit list (`:rating, :unrateable, :judge_later, :query_doc_pair_id, :user_id, :explanation`), so `judgement_params[:user]` is always nil and the lookup key is *always* `nil`, not just when a caller omits it. Consequences in order: the endpoint never attributes a judgement to anyone unless the caller passes `user_id`; when a caller does pass it, the request adopts and re-attributes an existing anonymous row; two API clients judging the same pair fight over one row. Deferrable because nothing in Quepid's own frontend calls it (grepped `app/javascript`, `app/assets/javascripts`) — this is external API surface only. Note the existing controller test asserts only a `judgements.count` delta, so it passes either way. Same bug family as the `BookImporter` nil-user work of 2026-09-10.

**Fix direction:** Decide which key is canonical, use it in both places, and guard the lookup so a nil judge cannot adopt an existing anonymous row.

---

### [PREEXISTING] Snapshot CSV `Snapshot Time` parses two-digit years as year 00YY

**Observed:** Importing a snapshot CSV (cases list → Import Snapshots from CSV) with `Snapshot Time` `10/01/26 18:05` stored `created_at` as `0010-01-26 18:05`, shown as `(1/26/10)` in Compare Snapshots. The modal's own sample format (`10/10/18 18:05`) has the same problem.

**Cause:** `import_snapshot_controller.js` posts the raw string as `created_at`; the server's time parsing reads `NN/NN/NN` as year/month/day. The Angular importer passed the string through the same way.

**Fix direction:** Parse `Snapshot Time` explicitly (document the accepted formats, e.g. ISO 8601 and `MM/DD/YY HH:MM`) and reject unparseable values with a row-numbered error instead of storing a wrong date. Fix the sample in the modal to an unambiguous format.

---

### [PREEXISTING] New-team form shows no validation errors

**Observed:** Submitting `/teams/new` with a blank name, or a name another team already uses, re-renders the form with no message. (Rename on the team page does show "Name can't be blank".)

**Cause:** `app/views/teams/new.html.erb` doesn't render `@team.errors`, and `TeamsController#create` renders `:new` without `status: :unprocessable_content`.

**Fix direction:** Render the shared error-messages partial on `teams/new` and return 422 on failure.

---

### [PREEXISTING] Floating labels break when a field has a validation error

**Observed:** On the Profile form, saving a duplicate email shows "Email has already been taken" but the floating "Email" label drops below the input and overlaps the Gravatar help text. The profile header card also shows the rejected email as if it were saved.

**Cause:** Rails' default `field_error_proc` wraps the errored input in `div.field_with_errors`, which breaks Bootstrap's `.form-floating > .form-control ~ label` sibling selector. The header reads `current_user.email` from the unsaved, invalid model.

**Fix direction:** Set a `field_error_proc` that adds `is-invalid` to the input instead of wrapping it, and render the profile header from the persisted user (`current_user.reload` or an `*_was` value) when the update fails.

---

### [PREEXISTING] Ratings page heading says "Scores for Case"

`app/views/ratings/index.html.erb` uses `page_header "Scores for #{case_title @case}"` — copy-pasted from the scores page. Should read "Ratings for …".

---

### [PREEXISTING] New annotation shows its score unrounded

Right after **Create** in Tune Relevance → Annotations, the new entry reads e.g. `Score: 0.08723905360685648`; after an edit (re-rendered from the server) the same annotation reads `0.0872391`. `annotations_controller.js` appends `annotation.score.score` raw, as the Angular template did. Format the score consistently (e.g. two decimals, like the case score badge).

---

### [PREEXISTING] Snapshot CSV import gives no success confirmation

**Observed:** On the cases list, a successful Import Snapshots from CSV just closes the modal; no flash says what was created. (The in-case Import modal's Snapshots tab does flash "Snapshots imported successfully!".) The failure message for a nonexistent `Case ID` is also generic: "1 snapshot(s) failed to import. Some may have been imported successfully." without saying the case wasn't found.

**Fix direction:** Flash the number of snapshots created and name the case(s); surface the per-snapshot reason (e.g. "Case 999999 not found") in the failure alert.

---

## [PREEXISTING] P1 — Backend correctness and authorization

### [PREEXISTING] Elasticsearch/OpenSearch document IDs are not persisted

**Location:** `app/services/fetch_service.rb:75-100,118-125`

The Elasticsearch/OpenSearch extractor stores the backend identifier as
`doc[:_id]`, while snapshot persistence reads `doc[:id]`. Results from these
engines can therefore create `SnapshotDoc` rows with a blank document ID,
breaking later judgement, snapshot comparison, and document identity behavior.

**Fix direction:** Normalize the extractor to the same `:id` contract used by
Solr and Search API results, then add an extractor-to-`SnapshotDoc` regression
test for both Elasticsearch and OpenSearch.

### [PREEXISTING] Search-endpoint updates accept unauthorized team IDs

**Location:** `app/controllers/search_endpoints_controller.rb:59-74`

The HTML update action preserves hidden teams, but resolves submitted team IDs
with `Team.find` rather than scoping them to `current_user.teams`. A user who
can edit an endpoint can submit another team's ID and attach that endpoint to
the foreign team.

**Fix direction:** Resolve submitted IDs through `current_user.teams.where(id:
...)`, reject or report unauthorized IDs, and add a negative controller test.

### [PREEXISTING] Mapper wizard function extraction is not lexical-aware

**Location:** `app/services/mapper_wizard_service.rb:265-296`

`extract_single_function` counts every brace, including braces inside strings,
comments, and regular expressions. Generated mapper code containing one of
those can be truncated before it is saved.

**Fix direction:** Use a JavaScript-aware extraction strategy or the existing
V8/parser path, and add regression cases for braces in strings, comments, and
regular expressions.

### [PREEXISTING] Safe LLM judgement handling misses malformed success bodies

**Location:** `app/services/llm_service.rb:32-40,209-220`

`parse_response` calls `JSON.parse` on model content, but
`perform_safe_judgement` does not rescue `JSON::ParserError` or a missing
content value. A successful HTTP response with malformed model output can
escape the safe-judgement path and leave the job unhandled.

**Fix direction:** Treat malformed/missing content as an unrateable judgement
with the same recorded explanation as other safe-judgement failures, and add
tests for malformed JSON and missing provider content.

### [PREEXISTING] Whitespace-prefixed JSON takes the bare-query path

**Location:** `app/models/try.rb:207-218`

`json_query_params?` checks only whether the raw value starts with `{`.
Whitespace-prefixed JSON is accepted by `JSON.parse` but is classified as bare
text, so `resolved_api_method` can select the wrong request method.

**Fix direction:** Strip surrounding whitespace for dispatch (while preserving
the original payload), and add tests for leading/trailing whitespace.

## [PREEXISTING] P2 — Error handling consistency

### [PREEXISTING] Missing team resources redirect instead of using the app-wide 404

`TeamsController` has a controller-wide `rescue_from ActiveRecord::RecordNotFound`
that redirects to the teams page with a flash. This differs from the default
`ApplicationController` behavior, which renders the styled 404 for HTML
requests. Decide whether inaccessible or missing team resources should remain a
redirect, become a 404 (or 403), and apply the chosen policy consistently.

---

## [PREEXISTING] P3 — Security & consistency

### [PREEXISTING] Public tries visualization also answers on the numeric case ID

**Observed:** While a case is public, `/analytics/tries_visualization/<numeric id>` loads for anonymous users, not just the `public_id` URL the clipboard link hands out. Making the case private again revokes both.

**Fix direction:** Decide whether anonymous access should require the `public_id`; if so, only accept the numeric ID for authenticated users with access to the case.

---

### [PREEXISTING] Proxy `proxy_debug` boolean parsing

**Location:** `app/controllers/proxy_controller.rb:26`

Uses `'true' == params[:proxy_debug]` instead of `deserialize_bool_param`. Low real-world impact.

---

### [PREEXISTING] Proxy URL parsing bug

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

### [PREEXISTING] BookImporter: replace the mass-assignment denylists with allowlists

**Location:** `app/services/book_importer.rb` — `UNASSIGNABLE_JUDGEMENT_KEYS`, `UNASSIGNABLE_QUERY_DOC_PAIR_KEYS`

Both `Judgement` and `QueryDocPair` are updated from an uploaded file via `assign_attributes(attrs.except(...))`. The `except` lists were built by hand and have twice needed a same-day patch: `:judgement_id` for `Judgement` (the judgements-API export emits it, and it isn't a real attribute, so it raised `UnknownAttributeError`) and `:book_id`/`:id` for `QueryDocPair` (a crafted value let one authenticated user write, or move, a query_doc_pair into another user's book — closed as a stopgap on 2026-09-10, reproduction is in this branch's history). Two escapes from small denylists in one review pass is the argument that a denylist can't converge here — the next producer to add a column or export a new key reopens the same class of bug.

**Fix direction:** Replace both `.except(...)` calls with `.slice(...)` **allowlists** — `QueryDocPair`: `query_text`, `doc_id`, `position`, `document_fields`, `information_need`, `notes`, `options`; `Judgement`: `rating`, `unrateable`, `judge_later`, `explanation`. This also converts "unexpected key crashes the import job" into a silent no-op, closing the judgements-export entry above for free. Bigger change than the stopgap — touches every assign path in the importer and needs its own test pass — hence P3, not urgent.

---

### [PREEXISTING] Unsafe integer coercion in snapshot search

**Location:** `app/controllers/api/v1/snapshots/search_controller.rb:45-46`

`params[:rows].to_i` / `params[:start].to_i` without validation; non-numeric strings coerce to `0`.

---

### [PREEXISTING] Predicate method naming

**Location:** `app/models/selection_strategy.rb`

Rename `user_has_judged_all_available_pairs?` → `user_judged_all_available_pairs?` (style-only; project convention — see `credentials?` vs `has_credentials?` in CLAUDE.md, already followed by `HttpClientService#credentials?`).

**Also found:** `every_query_doc_pair_has_three_judgements?` (same file, line 56) has the same `has_` prefix. Different grammatical shape though — it's "has N of a noun" (a count check), not "has verbed" (where the participle alone already reads as a fine predicate, as in `judged`). Dropping `has_` here reads badly (`every_query_doc_pair_three_judgements?`); it would need a rephrase (e.g. `every_query_doc_pair_judged_three_times?`) rather than a straight deletion. Worth a call when touching this file rather than bundling blindly with the first rename.

---

### [PREEXISTING] BookImporter: unsaved records aren't reported back to the user

**Location:** `app/services/book_importer.rb` — `import_query_doc_pairs`, `import_all_judgements`, `import_judgement`, `upsert_nested_query_doc_pair`

None of these check the return value of `qdp.save` / `judgement.save`. If a row fails validation during an "add more data" import (`Books::ImportController#update`), it's silently dropped — `ImportBookJob` still clears `book.import_job` and reports success, with no indication some rows didn't make it in. Pre-existing gap (the original code didn't check `.create`'s success either), just calling it out now that this path is being hardened for repeated/production re-imports. Fixing it well means deciding how partial failures should surface to the user (job status field? notification?) — a small design call, not a drive-by fix.

---

### [PREEXISTING] BookImporter: judge identifiers `validate` doesn't check import silently as anonymous

**Location:** `app/services/book_importer.rb` — `find_judgement_user`, `validate`, `emails_of_judges`

`#validate` pre-checks judgement `user_email`s against existing users and refuses the import with "User with email '...' needs to be migrated over first." (or invites them, under `force_create_users`). Two identifiers `find_judgement_user` honours slip past it entirely, and both degrade to an unattributed judgement with no warning:

1. **`user_id`** is never validated at all. A payload naming a `user_id` that doesn't exist in this instance imports anonymous — and `app/views/books/import/edit.html.erb` documents `user_id` as *the* judge identifier for `all_judgements`, while row ids never survive a cross-instance export, so this is the routine case rather than an exotic one.
2. **`:email` on a *nested* judgement** — `emails_of_judges` reads only `judgement[:user_email]` in the `query_doc_pairs` branch, while the `all_judgements` branch reads `user_email || email` and `find_judgement_user` accepts either. So `{"rating":1.0,"email":"nobody@example.com"}` nested under a pair skips both the migration error and the `force_create_users` invite.

Not a regression — before the 2026-09-10 fix these were silently attributed to whichever nil-email AI-judge user the database returned first, which was worse — but all the identifier paths should fail the same way.

**Fix direction:** Have `emails_of_judges` read `user_email || email` in both branches, and have the `validate` pass collect `user_id`s alongside emails so an id that doesn't resolve is treated like an unknown email rather than degrading to anonymous in silence.

---

## [PREEXISTING] P2 — Background jobs

### [PREEXISTING] Import/populate jobs leave state and idempotency to best effort

**Location:** `app/jobs/import_book_job.rb:7-21` (and similar populate jobs)

Jobs set status strings before working and clear them only on success, so a failure can leave a book permanently busy and leave uploaded blobs in place. Several import paths use `find_or_create_by` plus later updates, vulnerable to duplicate work from retries or concurrent requests. Related to the anonymous-judgement re-import entry above.

**Fix direction:** `ensure`/failure transitions for status and blob cleanup; deliberate retry/discard policy; idempotency via unique constraints or an explicit import identity. Test a failed job followed by retry, and a duplicate submission.

---

## [PREEXISTING] P2 — Performance

### [PREEXISTING] Potential N+1 queries

1. **`app/controllers/cases_controller.rb:32`** — `includes(:owner, :teams, scores: :user).distinct`; scores accessed later may still N+1.
2. **`app/controllers/teams_controller.rb:248`** — `includes(:owner, :teams)`; missing `scores` if the view touches them.
3. **`app/controllers/api/v1/cases_controller.rb:192`** — watch for extra associations in serializers beyond `preload(:tries, :teams, :cases_teams)`.

Bullet is enabled in dev/test — fix as surfaced; review views for missing eager loads.

### [PREEXISTING] API serializer query amplification

`app/views/api/v1/users/_user.json.jbuilder:12-13` runs three relation counts per user; `app/views/api/v1/cases/_case.json.jbuilder:13-51` repeatedly traverses `last_score`, owner, book, teams, tries, and sampled scores. These become N+1s on index endpoints, especially team/case listings.

**Fix direction:** Endpoint-specific query objects, or preload/count exactly what each serializer needs. Add query-count tests for representative index responses, not just response-shape tests.

---

## [PREEXISTING] RuboCop deferrals

Inline `rubocop:disable` only on this branch (no config-level excludes). Search codebase for `rubocop:disable` for the full list.

### [PREEXISTING] Metrics/ParameterLists

- `[PREEXISTING]` `Case#clone_case` — `app/models/case.rb:130`
- `[PREEXISTING]` `HttpClientService#initialize` — `app/services/http_client_service.rb:32`

### [PREEXISTING] Complex methods (Metrics/*)

Candidates for extraction into smaller methods or services:

- `[PREEXISTING]` `FetchService` — `app/services/fetch_service.rb`
- `[PREEXISTING]` `Api::V1::Import::RatingsController#create`
- `[PREEXISTING]` `Api::V1::Export::RatingsController`
- `[PREEXISTING]` `Api::V1::Snapshots::SearchController`
- `[PREEXISTING]` `BookImporter` / `RatingsImporter`
- `[PREEXISTING]` `MapperWizardsController`
- `[PREEXISTING]` `TeamsController` / `BooksController` / `HomeController`

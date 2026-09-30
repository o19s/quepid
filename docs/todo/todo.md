# Todo

**Last updated:** 2026-09-30

Outstanding bugs, hardening, and cleanup on `main` only. When something is fixed, remove its entry — do not add a completed section or keep resolved items for history.

Every actionable item carries a provenance marker: `[MIGRATION]` means it was
introduced by or is required to complete AngularJS removal, `[MIGRATION-FOLLOWUP]`
means it is related cleanup but not necessarily a migration regression, and
`[PREEXISTING]` means it predates the AngularJS removal. Use these markers when
choosing migration work; do not treat pre-existing defects as migration regressions.

Product bugs marked *Playwright MCP* were verified in a May 2026 headed pass and re-checked against the tree in Aug 2026. Line numbers may drift — re-check cited files before fixing.

**Angular removal:** do not patch the core case UI for items listed under [Obviated by Angular removal](#obviated-by-angular-removal-do-not-fix-in-angular). Remaining frontend cleanup is tracked in [Frontend cleanup after Angular removal](#frontend-cleanup-after-angular-removal).

## [MIGRATION-FOLLOWUP] Frontend cleanup after Angular removal

### [PREEXISTING] P0 — Scorer sandboxing

Client scorer code still executes through `new Function()`; evaluate a Web
Worker or equivalent browser isolation. V8/MiniRacer remains the batch path.

### [PREEXISTING] P1 — Scorer contract drift

`app/javascript/utils/scorer_runtime.js` and `scorer_catalog.js` need a canonical
shared API and migration guidance.

### [MIGRATION-FOLLOWUP] P2 — Accessibility

Score and rating controls still convey state by color alone; add text or icons so state is not color-only, and cover it with the relevant Playwright scenario. (Copy-query, close-pane and snapshot delete/clear controls now have accessible names.)

### [PREEXISTING] Opportunistic — Core-toolbar status-message duplication

Several core-toolbar modal controllers duplicate `showAlert`/`clearAlert`
behavior, while `judgements_core_controller.js` has a structurally similar
`showError`/`clearError` variant. Consider a small shared status-message helper
or a narrow addition to `ModalTriggerControllerBase` once the current modal
migration work settles.

Leave the two `setProgress(visible)` copies alone for now. For URL placeholder
replacement, prefer server-owned URLs passed through data attributes or form
actions over a generic client-side `fillUrlTemplate` helper.

### [MIGRATION] P2 — Core Stimulus registration parity test

Normal Rails pages lazy-load every controller (`app/javascript/controllers/index.js`), while the core page has its own esbuild entry with a manual `register(...)` list (`app/javascript/core_stimulus.js`). The split is deliberate: it keeps the splainer-search runtime out of ordinary pages, so **do not merge the two into one registration source**. The risk is that nothing ties the core views to the core list, so a controller used by a core view but missing from `core_stimulus.js` never connects and fails silently. This is most likely when markup moves between layouts.

**Fix direction:** Add a vitest (runs under `yarn test:unit`) that collects every `data-controller` name from `app/views/core/**` and `app/views/layouts/core.html.erb`, plus controller names emitted by JS templates such as `search_results_template.js`, and fails if any is not registered in `core_stimulus.js`. Use a small allowlist for names supplied by shared partials that only render on normal pages. Optionally also flag core registrations that nothing references. Only add a "registered by both paths on one page" check if it has caused a real bug.

### [MIGRATION] P3 — Document core event bus ownership

The core runtime uses a large document-level `CustomEvent` bus and exposes `window.Stimulus`, `window.quepidWizardContracts`, Bootstrap globals, Sortable, and Ace. The globals are acceptable migration glue; leave them unless one causes a bug.

**Fix direction:** Write a short doc listing each event, its owner (emitter), its listeners, and lifecycle rules (who adds and removes listeners, and when). Put it in the developer guide's Stimulus section.

### [MIGRATION] P2 — Client-rendered HTML is an XSS and lifecycle hotspot (code review 2026-09-29)

Template-string rendering remains in e.g. `search_results_controller.js:315-323` and `queries_list_controller.js:400-455`. Escaping is spread across helpers and call sites, and `innerHTML` replacement complicates Stimulus lifecycle reasoning.

**Fix direction:** Prefer ERB shells plus Stimulus targets for stable UI, and DOM construction/text nodes for user-controlled values. Where templates are necessary, centralize escaping and add XSS regression tests for query text, document IDs, endpoint names, error messages, and mapper output.

### [MIGRATION] Verification requirements

For changes to the core case surface:

- `[MIGRATION]` Preserve the core surface’s existing behavior and appearance; do not collapse it
  with a Rails-page interaction model that used different UX.
- `[MIGRATION]` Add or update Vitest contracts for changed modules and controllers.
- `[MIGRATION]` Drive the affected user flow through Playwright and update the matching manual
  testing tracker entry.
- `[MIGRATION]` For visual changes, keep matched before/after screenshots for the core surface.

### [MIGRATION-FOLLOWUP] Cleanup candidates

- `[MIGRATION-FOLLOWUP]` Remove remaining Angular-era build or CSS compatibility steps only after verifying
  that no core or Rails surface still depends on them.

---

## [MIGRATION] Obviated by Angular removal (do not fix in Angular)

These affect the core case UI (`/case/...`) today but **should not be patched in AngularJS** — the owning code is scheduled for replacement. Fix the **backend/API** parts in the sections below when called out; handle **frontend/UX** in [Frontend cleanup after Angular removal](#frontend-cleanup-after-angular-removal).

| Item | Why not patch Angular | Where it moves |
|------|----------------------|----------------|
| Try delete confirm dialog (frontend) | Null guard and active-try guard are done in `tune_relevance_controller.js`; confirm dialog still missing | [Frontend cleanup after Angular removal](#frontend-cleanup-after-angular-removal) |
| Icon-only controls lack accessible names | Copy-query; snapshot delete/clear in Compare | [Frontend cleanup after Angular removal](#frontend-cleanup-after-angular-removal) |
| Explain Query Copy silently fails | `ngclipboard` + modal dismiss race | [Frontend cleanup after Angular removal](#frontend-cleanup-after-angular-removal) |

---

## [PREEXISTING] P0 — Product bugs (Playwright MCP verified)

### [PREEXISTING] Deleting the latest try bricks the case (backend)

**Observed:** `DELETE /api/cases/:id/tries/:n` on the live try returns 204, but `cases.last_try_number` still points at the deleted try. Reload → banner *"Cannot read properties of null (reading 'tryNo')"*; case unusable until DB repair.

**Cause:** `Api::V1::TriesController#destroy` destroys the try but never recomputes `last_try_number` (create increments it). Deleting the latest try (including via API) can brick on reload.

**Fix direction:** After destroy, set `last_try_number` to `tries.maximum(:try_number)` (or null), or forbid deleting the current try. Add a test that deletes the latest try, reloads the case, and verifies the next core bootstrap and score update both succeed.

**Frontend/UX** (confirm dialog): obviated — see [Frontend cleanup after Angular removal](#frontend-cleanup-after-angular-removal).

---

### [PREEXISTING] Try delete orphans scores

**Observed:** Scores keep a stale `try_id` after the try is deleted. (The `PUT /api/cases/:id/scores` 500 on an orphaned `last_score` is fixed — `same_score_source?` now treats a nil try as a different source.)

**Cause:** No cascade/nullify from try → scores (`case_scores.try_id` has no FK).

**Fix direction:** Cascade or nullify scores on try destroy.

---

## [PREEXISTING] P0 — Security (code review 2026-09-29)

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

## [PREEXISTING] P1 — Product bugs (Playwright MCP verified)

### [PREEXISTING] Uploading the judgements export imports nothing and reports success

**Location:** `app/services/book_importer.rb:66`, `app/views/api/v1/judgements/index.json.jbuilder`, `app/views/books/import/edit.html.erb:71`

The Import Judgements panel tells users verbatim: *"The format for importing Judgement data is the same as that for exporting it: `/api/books/:id/judgements`"*. That endpoint emits a top-level **`judgements`** key; `#import` only reads **`all_judgements`**, and nothing normalizes between them (`grep all_judgements app/controllers app/jobs app/services` → importer only). So the advertised round-trip drops every row, `#import` still returns `true`, and the user gets "Data was successfully queued for import."

**Status:** Confirmed by reading; not driven through the UI. Two nearby format mismatches in the same panel, worth fixing together: the export's per-judgement `judgement_id` key isn't a `Judgement` attribute (a denylist entry now absorbs it, see `UNASSIGNABLE_JUDGEMENT_KEYS`), and the panel's promise that *"If you do NOT provide a `query_doc_pair_id` then you must provide `query_text` and `doc_id`"* isn't implemented — `find_query_doc_pair` returns nil for a blank id and `import_all_judgements` then does `next unless qdp`, silently dropping the judgement. Only the nested-`query_doc_pair`-object form actually upserts.

**Fix direction:** Pick one canonical envelope and add a fixture-based export → import round-trip test. Accept `judgements` as an alias for `all_judgements` (or make the export emit `all_judgements`), implement the flat `query_text`/`doc_id` fallback through `find_or_initialize_query_doc_pair`, and either way make a payload that matches zero rows report that instead of flashing success. Needs the allowlist work above first, since routing flat `query_text`/`doc_id` into `Judgement#assign_attributes` would raise `UnknownAttributeError` under the current denylist.

---

### [PREEXISTING] Missing case: search_endpoints index 500s

**Observed:** `GET /api/cases/999999` → 404, but `GET /api/cases/999999/search_endpoints` → 500 (`undefined method 'teams' for nil`).

**Cause:** `SearchEndpointsController#index` calls `set_case` then `@case.teams` without `check_case`.

**Fix direction:** `before_action :check_case` (or nil-guard) when `params[:case_id]` is present.

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

## [PREEXISTING] P1 — Security (code review 2026-09-29)

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

### [PREEXISTING] Password reset enumerates accounts (Playwright MCP)

**Observed:** Unknown email → "email was not found"; known email → neutral "you will receive…" message.

**Cause:** `config.paranoid` commented out in `config/initializers/devise.rb`.

**Fix direction:** Enable `config.paranoid = true` (or normalize both responses).

---

## [PREEXISTING] P2 — Product bugs (Playwright MCP verified)

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

## [PREEXISTING] P2 — Error handling consistency

### [PREEXISTING] Missing team resources redirect instead of using the app-wide 404

`TeamsController` has a controller-wide `rescue_from ActiveRecord::RecordNotFound`
that redirects to the teams page with a flash. This differs from the default
`ApplicationController` behavior, which renders the styled 404 for HTML
requests. Decide whether inaccessible or missing team resources should remain a
redirect, become a 404 (or 403), and apply the chosen policy consistently.

---

## [PREEXISTING] P3 — Security & consistency

### [PREEXISTING] Proxy `proxy_debug` boolean parsing

**Location:** `app/controllers/proxy_controller.rb:26`

Uses `'true' == params[:proxy_debug]` instead of `deserialize_bool_param`. Low real-world impact.

---

### [PREEXISTING] Proxy URL parsing bug

**Location:** `app/controllers/proxy_controller.rb:75-80` (`extract_extra_url_params`)

Manual `split('?')` / `split('=')` only captures the first embedded query param (e.g. loses `rows` from `?q=test&rows=10`).

Fix together with URL extraction deduplication below. Add multi-parameter and encoded-value tests (code review 2026-09-29 recommends `Addressable::URI#query_values`).

**Recommendation:** Cherry-pick `UrlParserService` from `origin/deangularjs-experimental` (commit `db1c4e50`) as its own small PR rather than reimplementing from scratch. That branch is a 1092-file, big-bang AngularJS→Rails rewrite that changed core architecture (server-side search execution, two-tier scoring, dropped/relocated features) — almost certainly why it was never merged, since it conflicts with this project's incremental per-surface migration strategy (see `angular-case-migration` skill). But `UrlParserService` itself is small, self-contained, and clean: wraps `Addressable::URI` (already a `Gemfile` dependency — no new gem needed), has 9 focused unit tests, and its `query_values` method fixes exactly this bug. Note that branch's `ProxyController` still had the CSRF-skip issue above — that fix wasn't part of the same effort and needs doing separately regardless.

---

### [PREEXISTING] URL parameter extraction duplication

**Locations:** `proxy_controller.rb`, `api/v1/search_endpoints/validations_controller.rb`, `application_helper.rb` (`get_protocol_from_url`)

Overlapping parse logic. Same fix as "Proxy URL parsing bug" above — `UrlParserService` (cherry-picked from `deangularjs-experimental`) was purpose-built as the shared helper for exactly these three call sites (per its own docstring); use it here too rather than writing a separate helper.

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

## [PREEXISTING] P2 — Background jobs (code review 2026-09-29)

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

### [PREEXISTING] API serializer query amplification (code review 2026-09-29)

`app/views/api/v1/users/_user.json.jbuilder:12-13` runs three relation counts per user; `app/views/api/v1/cases/_case.json.jbuilder:13-51` repeatedly traverses `last_score`, owner, book, teams, tries, and sampled scores. These become N+1s on index endpoints, especially team/case listings.

**Fix direction:** Endpoint-specific query objects, or preload/count exactly what each serializer needs. Add query-count tests for representative index responses, not just response-shape tests.

---

## [PREEXISTING] RuboCop deferrals

Inline `rubocop:disable` only on this branch (no config-level excludes). Search codebase for `rubocop:disable` for the full list.

### [PREEXISTING] Metrics/ParameterLists

- `[PREEXISTING]` `Case#clone_case` — `app/models/case.rb:130`
- `[PREEXISTING]` `MapperWizardState#store_fetch_result` — `app/models/mapper_wizard_state.rb:58`
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

---

## [MIGRATION-FOLLOWUP] P2 — Stimulus HTTP infra follow-ups (hybrid migration)

Shared `apiFetch` / `getQuepidRootUrl()` landed on `main` (see [DEVELOPER_GUIDE § Stimulus HTTP conventions](../DEVELOPER_GUIDE.md#stimulus-http-conventions)). Remaining consistency work:

Add `data-quepid-root-url` to `analytics.html.erb` if that layout ever loads Stimulus HTTP code.

---

## [MIGRATION-FOLLOWUP] P2 — match-explain Stimulus controller follow-ups

From the match/explain popover + Debug/Expand modal migration (`match_explain_controller.js`, `utils/json_explorer.js`, and the former Angular result bridge). The result snapshot is now produced in `query_documents_store.js`.

### [PREEXISTING] `json_explorer.js` undefined value renders a stray comma `<li>`

**Location:** `app/javascript/utils/json_explorer.js` (`parseValue` / `parseChildren`)

A `parseValue`/`parseChildren` entry for an `undefined` value renders a stray `<li>,</li>` instead of omitting the `<li>` entirely (the vendor's `if`/`else if` chain with no final `else` just skips it). Unreachable in practice — input always comes from `JSON.parse`, which never produces `undefined` — but worth matching exactly if this file is revisited.

(Key escaping + the broken `class="prop>"` typo were fixed when the query-explain / detailed-doc follow-ups landed.)

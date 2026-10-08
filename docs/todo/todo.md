# Todo

**Last updated:** 2026-10-08

Outstanding bugs, hardening, and cleanup in the current codebase. When something is fixed, remove its entry — do not add a completed section or keep resolved items for history.

Items requiring unresolved team decisions retain a **Decision needed** note. A security label, implementation difficulty, or ordinary technical choice alone does not require team agreement.

Every actionable item carries a provenance marker: `[MIGRATION]` means it was
introduced by or is required to complete AngularJS removal, `[MIGRATION-FOLLOWUP]`
means it is related cleanup but not necessarily a migration regression, and
`[PREEXISTING]` means it predates the AngularJS removal. Use these markers when
choosing migration work; do not treat pre-existing defects as migration regressions.
The pre-migration baseline is `be9b319a` (`main` before the Bootstrap 3→5 and
AngularJS-removal work began). Later `main` commits already include migration
changes, so don't use them to decide provenance.

Ratings appear as `P2 I3 C1` beside each item. Reviewed 2026-10-08 from a
pragmatic Rails/Hotwire perspective against the described scope and current
source; revise them when implementation reveals more. Ratings include the full
fix and verification, not just the smallest extraction. Deferral and decision
notes remain in force regardless of priority.

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
Individual ratings take precedence over historical priority labels on sections.
Confirmed cross-account writes remain critical; data loss and inconsistent scores
take precedence over optional DRY work. No tests or browser flows were rerun for
this ranking review.

Source audit: 2026-10-05 against `4bf88e5b` and the working tree. This review
checked current implementations, recent changes and existing tests/verification
records; it did not rerun browser flows or tests. Historical observations below
are retained only where the current source still supports the unresolved issue.
Browser coverage and actual verification timestamps live in
`docs/manual-testing/tracking.yml`.
Line numbers may drift — re-check cited files before fixing.

### [PREEXISTING] P1 I0 C2 — Resolve stored mapper input compatibility

Manual scenario 7.9: stored `JSON.parse(data)` mappers work on historical
`8ceb99e9` but fail on current because `lib/v8_mapper_executor.rb` pre-parses JSON
into an object. Upstream `92519d55` changed that contract before the Stimulus
mapper migration. Define a compatible input contract and verify both stored
string-based and object-based mappers; an adaptive mapper workaround does not
resolve existing saved mapper failures.

## [MIGRATION-FOLLOWUP] Frontend cleanup after Angular removal

### [PREEXISTING] P1 I0 C3 — Scorer sandboxing - LATER

**Decision needed:** Agree on the trust model for shared scorer code and the isolation guarantees required while preserving supported scorer behavior.

Client scorer code still executes through `new Function()`; evaluate a Web
Worker or equivalent browser isolation. The batch path already uses the shared
scorer runtime through V8/MiniRacer; keep browser and batch scorer behavior
aligned when adding isolation.

---

## [MIGRATION-FOLLOWUP] Stimulus/Turbo retrofit, and frontend DRY

AngularJS removal is complete; remaining work concerns ownership, lifecycle and
optional simplification. Ordinary management/admin pages now enable Turbo Drive
through `application.js`. The case workspace uses the shared Rails layout
but keeps a separate bundle with Drive disabled and a destination reload boundary;
standalone analytics also forces a fresh document. Frames and Streams remain
available on the case page. Shared layout/header markup does not make runtime
lifecycle or per-surface behavior interchangeable.

Follow [DEVELOPER_GUIDE.md — Turbo navigation](../../DEVELOPER_GUIDE.md#turbo-navigation)
and [Turbo on the case page](../../DEVELOPER_GUIDE.md#turbo-on-the-case-page)
for the current contracts. Actual Drive verification and deferred coverage are in manual scenario 15.8.

### [MIGRATION-FOLLOWUP] P3 I2 C3 — Server-rendered modal lists

**Decision:** Permit targeted HTML endpoints for persisted case UI alongside the
existing JSON APIs. The first conversion, the annotations list, is complete;
broader conversions remain conditional on a concrete maintenance benefit.

The broader proposed sequence for replacing the remaining SPA responsibilities
is in [Rails/Hotwire workspace plan](rails_stimulus_json_workspace_plan.md). It starts
with the endpoint-design decision below and preserves browser search and instant
scoring while moving persisted UI and navigation into Rails/Hotwire.

`pick_scorer_core` (scorer lists), `share_case_core` (team list), `diff_core`
(snapshot selects), and possibly `judgements_core` and `export_case_core`
build lists from JSON in JS. They could become partials loaded through lazy
`<turbo-frame src=...>`, like `DropdownController#cases_core`, and modal form
posts could be answered with Turbo Streams. The annotations list
(`annotations_controller.js`) now uses server-rendered persisted rows;
creation still captures live browser scores. Its UI endpoints now return rendered
rows while retaining JSON request payloads and dispatching `annotations:changed`
for `qgraph`; the existing JSON API remains available.

Case Frames/Streams already work with Drive disabled. Keep the workspace's
full-document navigation boundary and prove annotation list and edit-modal parity
before expanding the conversion.

---

### [PREEXISTING] P3 I0 C3 — Separate legacy entry effects before any prefetch enablement

**Decision needed:** Decide whether to enable prefetch and which deliberate-navigation effects must become explicit submissions.

The [GET side-effect audit](../../DEVELOPER_GUIDE.md#get-side-effect-audit) moved
Judge Later/logout to POST/DELETE and protects speculative requests. Keep the
management/admin meta guard and controller rejection. Prefetch remains a
separate product decision.

Before relaxing either guard, decouple core case creation and URL-supplied
settings writes from GET, and move mapper wizard state reset to a deliberate
submission. Preserve the existing shared-link/bootstrap and fresh-wizard
contracts; the smallest prerequisite is defining their explicit submission UI.
Home announcement consumption, book-view tracking, judging session counters,
authentication callbacks and mounted engines also need destination-specific
prefetch decisions. Do not change those deliberate-navigation contracts merely
to enable hover requests.

## [PREEXISTING] P0 — Security

### [PREEXISTING] P0 I0 C3 — User API IDOR and cross-account write path

**Decision needed:** Confirm whether cross-user lookup is an intended directory contract, who may use it, and which fields it may expose; the existing test explicitly permits it.

**Location:** `app/controllers/api/v1/users_controller.rb:24-48`, `test/controllers/api/v1/users_controller_test.rb:30-39`

`set_user` looks up any user by email or numeric ID without scoping to `current_user`, and `update` permits `company`, `completed_case_wizard`, and `default_scorer_id`. The existing test codifies one signed-in user fetching another's record. Unless this is an intentional admin directory, it exposes account metadata and allows cross-account changes.

**Fix direction:** Scope ordinary requests to `current_user`. If admin lookup is needed, make it a separate admin-only endpoint with its own serializer and authorization test.

---

## [PREEXISTING] P1 — Security

### [PREEXISTING] P1 I0 C2 — Outbound HTTPS certificate verification is disabled globally

**Location:** `app/services/http_client_service.rb:91-101`

`HttpClientService` sets `faraday.ssl.verify = false` for every request (proxy, mapper wizard, downloads, search calls), permitting man-in-the-middle interception of credentials and API keys.

**Fix direction:** Remove the override. If development needs a custom CA, use a CA bundle or an explicit development-only opt-in. Add a test that production clients verify certificates.

---

### [PREEXISTING] P1 I0 C3 — Proxy SSRF controls are incomplete

**Location:** `app/controllers/proxy_controller.rb:105-120`, `app/services/http_client_service.rb:91-99`

The proxy validates the initial DNS resolution and blocks private ranges, but Faraday resolves the host again when making the request (DNS-rebinding window), and redirect following means an allowed public URL can redirect to an internal address without revalidation.

**Fix direction:** Use a single validated connection target, disable redirects by default, or validate each redirect target. Tests: redirect-to-private-address, IPv6/link-local, rebinding, non-default ports, credential forwarding.

---

### [PREEXISTING] P1 I0 C3 — Static Active Record encryption keys committed as production fallbacks

**Location:** `config/application.rb:55-61`

Deployments that omit the env vars use publicly known keys, so encrypted fields are recoverable by anyone with the database.

**Fix direction:** Fail fast in production when keys are absent; keep generated dev/test defaults out of production config; document key rotation and backup.

---

### [PREEXISTING] P1 I0 C3 — Secrets exposed through API serializers and admin views

**Decision needed:** Agree on the credential-sharing contract and how direct browser searches will work if stored secrets are withheld and proxying becomes mandatory. Password-hash removal has a clear independent path.

**Location:** `app/models/concerns/maskable_credential.rb:21-28`, `app/views/api/v1/search_endpoints/_search_endpoint.json.jbuilder:11-15`, `app/views/api/v1/tries/_try.json.jbuilder:22-25`, `app/views/admin/users/index.json.jbuilder:7-9`, `app/views/admin/users/show.html.erb:88-92`

`api_basic_auth_credential` is returned in full unless `REQUIRE_PROXY_WITH_BASIC_AUTH_CREDENTIALS` is enabled (default false), so shared endpoint members receive stored credentials in endpoint and try responses. Admin user JSON/HTML also render the encrypted password hash.

**Fix direction:** Never serialize credentials or custom secret headers; return a masked/presence-only value and proxy server-side when secrets are needed. Make this unconditional rather than flag-dependent. Remove password hashes from admin views.

---

### [PREEXISTING] P1 I0 C3 — Proxy CSRF bypass and permissive CORS / Action Cable origins

**Decision needed:** Agree on supported cross-origin clients, trusted deployment origins, proxy authentication and rate limits before restricting the existing interfaces.

**Location:** `app/controllers/proxy_controller.rb:5-8`, `config/initializers/cors.rb:6-17`, `config/environments/production.rb:41-50`

`fetch` skips CSRF verification (`skip_before_action :verify_authenticity_token`) for GET and POST while requiring login, so cross-site POSTs from an authenticated session remain possible. Production also allows every CORS origin, disables Action Cable request forgery protection, and accepts every Action Cable origin.

**Fix direction:** Restrict CORS to configured origins with credentials off unless needed; derive Action Cable allowed origins from the deployment host list; give the proxy a CSRF token or a deliberately token-authenticated route.

**Also open:** [PREEXISTING] P2 I0 C2 — no rate limiting on proxy fetch (production concern when `proxy_requests: true`).

---

### [PREEXISTING] P1 I0 C3 — Triage the Brakeman baseline

**Location:** `config/brakeman.ignore`

CI runs Brakeman with `--exit-on-warn`, and the 24 warnings that existed when the gate was added are suppressed in the ignore file with a "needs triage" note. They include `Marshal.load` in `DeferredPayload`, dynamic `eval` in `V8MapperExecutor`, SQL injection warnings and `protect_from_forgery with: :null_session` in `Api::ApiController`. Suppression is not an assessment of exploitability.

**Fix direction:** Review each entry. Fix real findings and delete their entries; replace the rest with a specific justification in `note`. Delete the item when the baseline holds no "needs triage" entries.

---

## [PREEXISTING] P2 — Security

### [PREEXISTING] P2 I0 C1 — Password reset enumerates accounts

**Observed:** Unknown email → "email was not found"; known email → neutral "you will receive…" message.

**Cause:** `config.paranoid` commented out in `config/initializers/devise.rb`.

**Fix direction:** Enable `config.paranoid = true` (or normalize both responses).

### [PREEXISTING] P1 I0 C2 — No minimum password length

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

### [PREEXISTING] P2 I0 C1 — A newly added query jumps from the bottom to the top on reload

**Location:** `app/controllers/api/v1/queries_controller.rb` (`create`)

**Observed:** Adding a query shows it at the bottom of a Manual-sorted list, but after a reload (or anything that re-bootstraps the case, such as Rerun My Searches! creating a new try) it is at the top. The `create` response's `display_order` lists the new id last, while `index` lists it first. The `Case#queries` scope orders `arranged_at IS NULL DESC`, so a new, unarranged query sorts first in the database, and `create` builds `display_order` from the association it just built on, which appears to put the in-memory record last. Reproduced 2026-10-04 on case 598. The controller is unchanged from `main`, and the `be9b319a` Angular client also applied the `create` response's `display_order`, so this predates the migration (source evidence only, not replayed).

**Fix direction:** Reload the association (`@case.queries.reload`) before building `display_order` in `create`, and add a controller test that `create` and `index` return the same order.

---

### [PREEXISTING] P2 I1 C3 — Judgement rating not validated against book's scale (outside AI judging)

**Observed:** `Judgement#rating` only validates presence, never that the value is actually one of the book's configured scale values. `Api::V1::JudgementsController#update`, `JudgementsController`, and `BulkJudgeController#save` (`judgement.rating = params[:rating]`, no scale check) all write a client-supplied rating with no scale check — they're only "safe" today because the judging UI happens to render buttons limited to the book's actual scale values; nothing stops a raw form/API POST from bypassing that. The AI-judging path (`app/jobs/run_judge_judy_job.rb`, hardened in `37840b47`) is the only one with a guard, and it's job-local.

**Cause:** No model-level validation ties `Judgement#rating` to `query_doc_pair.book.scale`.

**Audit result (done):** Two call sites *legitimately* write ratings outside the discrete scale, both gated on `book.support_implicit_judgements?`:
- `[PREEXISTING]` `BooksController#combine` (`app/controllers/books_controller.rb:277`) averages two existing ratings — `(judgement.rating + j.rating) / 2` — and explicitly skips rounding when `support_implicit_judgements` is true (e.g. `(0+3)/2 = 1.5` on a `[0,1,2,3]` scale).
- `[PREEXISTING]` `JudgementFromRatingJob#perform` (`app/jobs/judgement_from_rating_job.rb:24`) copies a case-level `Rating#rating` straight into `judgement.rating` via `judgement.save!` (raises on failure) — that value comes from the case's scorer scale, which has no guaranteed relationship to the book's judgement scale.

`BookImporter`/`RatingsImporter` are fine: `RatingsImporter` writes the unrelated `Rating` model, and `BookImporter#import_judgement` already silently no-ops on failed saves.

**Fix direction:** Add an `inclusion` validation on `Judgement` for required ratings (preserve `rating_not_required?` for unrateable/judge-later rows), scoped to `query_doc_pair.book.scale`, conditioned `unless: -> { query_doc_pair&.book&.support_implicit_judgements? }` (safe-navigate — `query_doc_pair` is a required `belongs_to` but its own presence validation runs independently, so a blank `query_doc_pair` must not blow up this lambda with a `NoMethodError`) so the two legitimate continuous-rating paths above stay unaffected. Change `JudgementFromRatingJob` to `save` + handle a validation failure instead of `save!` (a case rating can legitimately be off-scale for an explicit-only book). Retire the job-local check in `run_judge_judy_job.rb` in favor of the model validation (catch the failure, call `mark_unrateable`).

The separate coercion/aggregation decision is in [Judgement coercion and aggregation semantics](#preexisting-p2-i2-c3--judgement-coercion-and-aggregation-semantics).

The explicit `unrateable`/`judge_later` resets in `BulkJudgeController#save`
are redundant: `Judgement#rating=` already clears both for a non-nil rating.
[PREEXISTING] P3 I1 C1 — Removing just those resets is a separate small no-op cleanup.

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

### [PREEXISTING] P1 I0 C3 — `BooksController#combine` collapses anonymous judgements into one averaged row

**Decision needed:** Choose separate anonymous rows versus a combined rating, and define aggregation when combining multiple books.

**Location:** `app/controllers/books_controller.rb:275` — `combine`

The merge loop upserts each source judgement with `query_doc_pair.judgements.find_or_initialize_by(user: j.user)`. `Judgement` deliberately permits several nil-user rows per pair (`validates :user_id, uniqueness: { scope: :query_doc_pair_id }, unless: -> { user_id.nil? }`), so *every* anonymous judgement in the source book matches the same target row. N anonymous judgements collapse to 1 — and because the same loop averages (`(judgement.rating + j.rating) / 2`), the surviving rating is an order-dependent running mean, not a true average.

**Reproduced** by running the verbatim inner loop against the test DB (a script, not a Playwright pass): a source pair carrying anonymous `[1.0, 3.0, 3.0]` produced **one** target row rating `2.5`, where the true mean is 2.33.

**Cause:** Same root cause as the import bug fixed in `BookImporter#import_judgement` on 2026-09-10 — `find_or_initialize_by(user: nil)` treats "no judge" as an identity.

**Fix direction:** Needs a product call first: should anonymous judgements copy across as separate rows (mirroring the importer, no averaging), or keep collapsing into one averaged row? If separate, skip the find when `j.user.nil?` and `build` unconditionally. Note the averaging is order-dependent even for identified users once you merge 3+ books; the same `combine` line is already documented under the [judgement-scale validation item](#preexisting-p2-i1-c3--judgement-rating-not-validated-against-books-scale-outside-ai-judging) for a different reason.

---

### [PREEXISTING] P1 I0 C3 — Re-importing anonymous judgements is not idempotent, and it moves computed case ratings

**Decision needed:** Choose whether anonymous imports accumulate rows or replace an authoritative set, and define an identity/retry contract.

**Location:** `app/services/book_importer.rb` — `import_judgement`

An anonymous judgement has no identity to upsert on, so as of the 2026-09-10 fix each import `build`s a new row (the alternative — `find_or_initialize_by(user: nil)` — collapsed all of them into one, which was worse). The accepted cost is documented in the code and in `docs/manual-testing/10-books-management.md`. What makes it more than cosmetic: `RatingsManager#calculate_rating_from_judgements` averages 1-2 judgements but takes the **min of the top 3** at 3 or more, so duplication can move a rating a user never re-judged — `[3.0, 0.0]` → 1.5 becomes `[3.0, 3.0, 0.0]` → 0.0. Pinned by `test/services/book_importer_test.rb`'s "re-importing anonymous judgements duplicates them and moves the computed case rating".

**Reached by** the ordinary export → re-import path, since `_judgements.json.jbuilder` emits `user_email` only `if judgement.user`, so exported anonymous rows come back identity-less; also by a Mission Control retry of a failed `ImportBookJob` (no job-local `retry_on`; `DeferredPayload.consume` retains the upload on failure and purges it only after the import block succeeds), and plausibly by a double-submitted import form.

**Fix direction:** Needs a product call, same as the `combine` entry above. Option: treat a payload's `judgements` array as authoritative for a pair's *anonymous* set — `query_doc_pair.judgements.where(user: nil).delete_all` before building the incoming user-less ones — which keeps upsert semantics for identified judges and makes repeated imports converge. Wrong answer if a book legitimately accumulates anonymous judgements across several import files.

---

### [PREEXISTING] P2 I2 C3 — Judgement coercion and aggregation semantics

**Decision needed:** Choose the rounding and aggregation rules across rating writers before centralizing them. Scale validation remains in the [separate validation item](#preexisting-p2-i1-c3--judgement-rating-not-validated-against-books-scale-outside-ai-judging).

Also audit coercion and aggregation across rating writers (former DRY #15).
`BooksController#combine` and `RatingsManager` round unless the book supports
implicit judgements; bulk judging, the judgements API, `JudgementFromRatingJob`
and `LlmService` do not all apply that rule. `combine` uses a pairwise mean,
while `RatingsManager#calculate_rating_from_judgements` uses a different
aggregation rule. Decide intended semantics before centralizing coercion in
`Judgement`; check bulk writers that bypass callbacks and preserve legitimate
continuous ratings. Changing rounding or aggregation changes stored ratings
and scores, so keep it separate from behavior-preserving cleanup.

---

## [PREEXISTING] P1 — Backend correctness and authorization

### [PREEXISTING] P1 I0 C3 — Mapper wizard function extraction is not lexical-aware

**Location:** `app/services/mapper_wizard_service.rb:265-296`

`extract_single_function` counts every brace, including braces inside strings,
comments, and regular expressions. Generated mapper code containing one of
those can be truncated before it is saved.

**Fix direction:** Use a JavaScript-aware extraction strategy or the existing
V8/parser path, and add regression cases for braces in strings, comments, and
regular expressions.

### [PREEXISTING] P1 I0 C2 — Safe LLM judgement handling misses malformed success bodies

**Location:** `app/services/llm_service.rb:32-40,209-220`

`parse_response` calls `JSON.parse` on model content, but
`perform_safe_judgement` does not rescue `JSON::ParserError` or a missing
content value. A successful HTTP response with malformed model output can
escape the safe-judgement path and leave the job unhandled.

**Fix direction:** Treat malformed/missing content as an unrateable judgement
with the same recorded explanation as other safe-judgement failures, and add
tests for malformed JSON and missing provider content.

### [PREEXISTING] P2 I0 C1 — Whitespace-prefixed JSON takes the bare-query path

**Location:** `app/models/try.rb:207-218`

`json_query_params?` checks only whether the raw value starts with `{`.
Whitespace-prefixed JSON is accepted by `JSON.parse` but is classified as bare
text, so `resolved_api_method` can select the wrong request method.

**Fix direction:** Strip surrounding whitespace for dispatch (while preserving
the original payload), and add tests for leading/trailing whitespace.

---

## [PREEXISTING] P3 — Code quality

### [PREEXISTING] P3 I0 C1 — Unsafe integer coercion in snapshot search

**Location:** `app/controllers/api/v1/snapshots/search_controller.rb:45-46`

`params[:rows].to_i` / `params[:start].to_i` without validation; non-numeric strings coerce to `0`.

---

### [PREEXISTING] P1 I1 C2 — BookImporter: judge identifiers `validate` doesn't check import silently as anonymous

**Location:** `app/services/book_importer.rb` — `find_judgement_user`, `validate`, `emails_of_judges`

`#validate` pre-checks judgement `user_email`s against existing users and refuses the import with "User with email '...' needs to be migrated over first." (or invites them, under `force_create_users`). Two identifiers `find_judgement_user` honours slip past it entirely, and both degrade to an unattributed judgement with no warning:

1. **`user_id`** is never validated at all. A payload naming a `user_id` that doesn't exist in this instance imports anonymous — and `app/views/books/import/edit.html.erb` documents `user_id` as *the* judge identifier for `all_judgements`, while row ids never survive a cross-instance export, so this is the routine case rather than an exotic one.
2. **`:email` on a *nested* judgement** — `emails_of_judges` reads only `judgement[:user_email]` in the `query_doc_pairs` branch, while the `all_judgements` branch reads `user_email || email` and `find_judgement_user` accepts either. So `{"rating":1.0,"email":"nobody@example.com"}` nested under a pair skips both the migration error and the `force_create_users` invite.

Not a regression — before the 2026-09-10 fix these were silently attributed to whichever nil-email AI-judge user the database returned first, which was worse — but all the identifier paths should fail the same way.

**Fix direction:** Have `emails_of_judges` read `user_email || email` in both branches, and have the `validate` pass collect `user_id`s alongside emails so an id that doesn't resolve is treated like an unknown email rather than degrading to anonymous in silence.

---

### [PREEXISTING] P1 I0 C3 — BookImporter: unsaved records aren't reported back to the user

**Decision needed:** Choose how partial imports are reported and whether valid rows remain imported when other rows fail.

**Location:** `app/services/book_importer.rb` — `import_query_doc_pairs`, `import_all_judgements`, `import_judgement`, `upsert_nested_query_doc_pair`

None of these check the return value of `qdp.save` / `judgement.save`. If a row fails validation during an "add more data" import (`Books::ImportController#update`), it's silently dropped — `ImportBookJob` still clears `book.import_job` and reports success, with no indication some rows didn't make it in. Pre-existing gap (the original code didn't check `.create`'s success either), just calling it out now that this path is being hardened for repeated/production re-imports. Fixing it well means deciding how partial failures should surface to the user (job status field? notification?) — a small design call, not a drive-by fix.

---

## [PREEXISTING] P2 — Background jobs

### [PREEXISTING] P1 I2 C3 — Import/populate jobs leave state and idempotency to best effort

**Decision needed:** Define failure/retry states, uploaded-blob retention and repeated-submission semantics; automatic cleanup must not erase retryable work.

**Location:** `app/jobs/import_book_job.rb:7-21` (and similar populate jobs)

Jobs set status strings before working and clear them only on success, so a failure can leave a book permanently busy and leave uploaded blobs in place. Several import paths use `find_or_create_by` plus later updates, vulnerable to duplicate work from retries or concurrent requests. Related to the anonymous-judgement re-import entry above.

**Fix direction:** `ensure`/failure transitions for status and blob cleanup; deliberate retry/discard policy; idempotency via unique constraints or an explicit import identity. Test a failed job followed by retry, and a duplicate submission.

The shared lifecycle scope also includes `ExportBookJob` and
`Book#queue_job`: queueing sets “queued”, each job sets “started”, and each
clears status only on success. Consider one `book.run_job(operation) { … }`
boundary. Define failed/retry status and blob retention before using `ensure`;
blindly clearing everything could hide failed work or prevent retries.
Status cleanup alone does not change scoring inputs.

`ApplicationJob` already discards jobs whose records have been
deleted (`DeserializationError`), but `retry_on` remains commented out.
Decide on a default retry policy for the jobs that take Active Record arguments.

---

## [PREEXISTING] P2 — Performance

### [PREEXISTING] P2 I1 C2 — Dashboard case list latest-score queries bypass eager loading

`Case#last_score` calls `scores.last_one`, whose ordering/limit scope issues a
separate lookup per call. `home/_case.html.erb` reads it repeatedly and its user,
while `HomeController#show` preloads only metadata. The team-list portion is
resolved; dashboard loading remains outside that approved direct-fix batch.

Measure the endpoint with a query-count test, then load only the latest score and
its user per case. Avoid loading every historical score merely to render one
badge; Bullet is available in development/test.

## [PREEXISTING] RuboCop deferrals

These candidates still carry inline Metrics suppressions. Search the codebase
for `rubocop:disable` and check `.rubocop.yml` for the full current lint scope.

### [PREEXISTING] P3 I1 C2 — Metrics/ParameterLists

- `[PREEXISTING]` P3 I1 C2 — `Case#clone_case` — `app/models/case.rb:130`
- `[PREEXISTING]` P3 I1 C2 — `HttpClientService#initialize` — `app/services/http_client_service.rb:32`

### [PREEXISTING] P3 I2 C3 — Complex methods (Metrics/*)

Candidates for extraction into smaller methods or services:

- `[PREEXISTING]` P3 I2 C3 — `FetchService` — `app/services/fetch_service.rb`

`FetchService` is 522 lines and `BooksController` is 510. Inspect the 95
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

## [MIGRATION-FOLLOWUP] Consolidated DRY review

### [PREEXISTING] P3 I1 C1 — AI judge form defaults bypass the provider registry

`AiJudgesController` hardcodes `'openai'`, `https://api.openai.com` and the
model, while `LlmService` takes defaults from `LlmProvider`. Derive the form's
provider-owned defaults from the registry; keep controller-specific settings such
as timeout. Do not change current default values.

### [PREEXISTING] P3 I1 C1 — `deserialize_bool_param` is defined twice

`ApplicationController` and `Api::ApiController` define the same helper. Move it
to an existing shared concern. Leave `SearchEndpointsController`'s own caster
(`bool.deserialize`) alone unless its blank-string/`nil` behavior is verified
identical; the helper coerces `nil` to `false`.

### [PREEXISTING] P3 I1 C1 — `Try#options` normalizes case and endpoint options twice

`app/models/try.rb` parses strings, rescues bad JSON and converts hashes
separately for the case and the search endpoint. Extract one private normalizer.
Keep endpoint-over-case precedence and the final JSON round trip.

### [PREEXISTING] P3 I1 C2 — HTML and API signup repeat invitation-aware user construction

`Users::SignupsController` and `Api::V1::SignupsController` both look up the
invited user by email (`invitation_token` present) and assign attributes or build
a new user. Extract only that construction step (e.g. a `User` class method);
leave password handling, sessions and responses in the controllers. Cover both
paths with existing tests before and after.

### [PREEXISTING] P3 I1 C1 — V8 console methods repeat the same argument serializer

`lib/v8_mapper_executor.rb` copies the `JSON.stringify`/`String` fallback for
`log`, `error`, `warn` and `info`. Use one JS formatter plus a level-specific
wrapper. Preserve object, circular and multi-argument output.

### [PREEXISTING] P3 I1 C1 — Duplicate announcement and book-upload form fields

Extract partials only for the announcement fields (`admin/announcements`
`new`/`edit`) and the book upload fields (`books/import` `new`/`edit`). Keep form
ownership, routes and methods in each page.

### [PREEXISTING] P2 I0 C1 — Blank-to-`nil` conversion turns `false` into `nil`

`Api::V1::TriesController` and `lib/tasks/case.thor` carry the same
`convert_blank_values_to_nil`; `false.blank?` is true, so `false` becomes `nil`,
which looks unintended. Decide the correct behavior and fix it with a test in
both places. Do not share the function (request handling vs. Thor task).

### [MIGRATION-FOLLOWUP] P2 I0 C1 — `SearchResultsController` view-state predicates disagree

`isResultsView` treats any falsy value as the default view while `renderState`
defaults only `undefined`. Define the valid state values, fix with a test, and
only then collapse to one predicate.

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

- [PREEXISTING] P2 I1 C2 — `#$query##` is substituted twice. `build_get_params` uses
  `gsub(string, string)`, so `\0` or `\1` in the query text is treated as a
  backreference. `replace_values` uses the safe block form.
- [PREEXISTING] P2 I0 C2 — `build_get_params` assigns `params[key] = val` in a loop, so repeated Solr
  params such as `fq` keep only the last value.
- [PREEXISTING] P2 I0 C3 — `escape_query` is never applied on the server, while the client honors it.
- [PREEXISTING] P3 I1 C1 — `field_spec` is parsed in `FetchService#add_solr_params` and again in
  `Try#id_from_field_spec`.

This backlog accepts keeping response parsing in both Ruby and JS. Request
building is different: it drifts from the client and is buggy.

**Fix:** one substitution helper, a small `FieldSpec` value object on `Try`, and
multi-valued GET params.

Identical field-spec parsing can be extracted without changing scores.
Substitution, multi-valued filters and server escaping fixes change fetched
results and background scores; verify them separately.

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

### [MIGRATION-FOLLOWUP] P3 I2 C3 — Search-engine rule boundaries — deferred

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

### [MIGRATION-FOLLOWUP] P3 I1 C3 — Refresh-ratings orchestration — deferred

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

### [MIGRATION-FOLLOWUP] P3 I1 C3 — Snapshot CSV import contracts — deferred

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

### [MIGRATION-FOLLOWUP] P3 I1 C2 — Server-owned URLs and template replacement — deferred

Fourteen controllers fill server-passed URL templates with
`.replaceAll("__CASE_ID__", …)`. Some wrap the value in `String()`, none
encode it, and nothing catches a placeholder that was never filled. Separately,
about 80 call sites build `api/...` paths on the client, which the
DEVELOPER_GUIDE discourages.

**Defer as proposed.** Encoding values and throwing for unresolved placeholders
add behavior. A replacement-only helper could preserve the contract but offers
limited LOC savings. [MIGRATION-FOLLOWUP] P3 I1 C3 — Moving client URLs to Rails ownership is a separate task.

### [MIGRATION-FOLLOWUP] P3 I0 C3 — Request-generation abstractions — deferred

There are seven versions: `qscore_case_controller` (`diffRefreshGeneration`),
`judgements_core_controller` (`openGeneration`), `query_collection_store`
(`_searchGeneration`), `live_query_collection`, `case_runtime`, `query_runtime`
(`ratingsGeneration`), and the `AbortController` in
`team_member_autocomplete_controller`.

**Defer.** These counters govern request races and invalidation; AbortController
also cancels work. A shared token helper saves few lines and must not replace
caller-specific cancellation or stale-response rules.

### [MIGRATION-FOLLOWUP] P2 I1 C2 — Clipboard feedback and fallback contracts

There are four versions of "copy, then swap the button label for a moment":
`query_explain_controller.js:68`, `invite_controller.js:33`,
`mapper_wizard_controller.js:446` and `browse_query_controller.js:44`.

- [PREEXISTING] P2 I0 C1 — **Bug:** `mapper_wizard` calls `navigator.clipboard` directly and skips the
  plain-HTTP fallback in `utils/clipboard`, so copying fails on deployments
  served over plain HTTP.
- [MIGRATION-FOLLOWUP] P3 I0 C1 — `browse_query` never puts its label back and never reports a failed copy.

Do not impose one feedback policy on all four callers; Explain and Invite
already share `utils/temporary_feedback`, while Mapper's independent timers and
Browse's permanent success label are intentionally different.

The mapper HTTP fallback and Browse label restoration/error reporting are
separate behavior fixes, outside a strict behavior-preserving refactor.

Mapper Wizard's direct clipboard call is `[PREEXISTING]` (present in
`be9b319a:app/javascript/controllers/mapper_wizard_controller.js`). Fix that
fallback independently of optional feedback consolidation; verify plain HTTP.
Browse feedback provenance has not been classified against the baseline.

### [MIGRATION-FOLLOWUP] P3 I0 C2 — Success-and-redirect helpers — deferred

There are five versions with different delays: `import_case_controller.js:55`
and `import_snapshot_controller.js:112` (1500ms), `clone_case_core_controller.js:138`
(1000ms), `judgements_core_controller.js:478` (500ms), and
`frog_report_controller.js:163` (none).

**Defer.** One delay changes the current contract. A helper preserving each
caller's delay, URL, notice, and navigation method saves very little.

### [MIGRATION-FOLLOWUP] P3 I1 C2 — Busy-state helpers — deferred

There are about six versions: `CoreModalControllerBase#setLoading`/`setProgress`,
`import_form_controller_base.js#setLoading`, `add_query_controller`,
`missing_documents_controller`, `team_member_autocomplete_controller` (which
uses `style.display` instead of `d-none`), and `mapper_wizard_controller`,
which swaps the button's `innerHTML`.

**Defer a universal helper.** Disabled controls, spinner classes, visibility,
and HTML replacement have different contracts. Consolidate only demonstrably
identical operations; leave modal-level progress bars and distinct state
transitions alone.

### [MIGRATION-FOLLOWUP] P2 I1 C2 — Choose explicit error-message policies

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

### [MIGRATION-FOLLOWUP] P3 I0 C1 — Direct Bootstrap modal wrappers — deferred

Former J12: wrapping lookup/show/hide made call sites longer without removing
instance lookup. Keep direct calls; do not expand helpers solely for this cleanup.
Preserve silent no-op behavior when Bootstrap is absent and the existing error
when Bootstrap exists but Modal is missing. Existing screenshot pairs and actual
verification timestamps remain in the manual-testing tracker.

### Review boundaries

Triaged out as not worth standalone refactoring: a Rails sharing-modal partial
(four copies that would mostly become parameters), a team filter-form helper,
legacy deleted-flag duplication, per-caller error-message chains, sample-data
snapshot reconstruction, generator pipeline sharing, footer config, sharing
response messages, lint-runner selection and Book/Scorer scale getters. Revisit
only when already editing that code. Archive scopes (`Case.not_archived` includes
`nil`; `active` excludes it), Book/Scorer scale setters and nDCG scorer variants
differ intentionally.

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

### [MIGRATION-FOLLOWUP] P3 I2 C3 — Rated-document lookup duplication

**Decision needed:** Decide whether the two rated-document surfaces should share ranking and rating-persistence semantics. Equivalent-branch cleanup can proceed separately.

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

[MIGRATION-FOLLOWUP] P3 I1 C2 — Sharing the equivalent `resetToRated`/default-list pagination branches can
preserve behavior. Merging all builders or rating-write paths needs the ranking
and persistence decisions first.

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

## [MIGRATION-FOLLOWUP] Stimulus / Hotwire / Rails best-practices review

### [PREEXISTING] P2 I1 C2 — Inline scripts in views

The remaining inline `<script>` blocks are on the isolated analytics surfaces
(`layouts/analytics.html.erb`, `analytics/tries_visualization/show.html.erb`)
and the standalone `home/sparklines` frame example. Move their chart and
clipboard lifecycle into Stimulus controllers. Analytics keeps an explicit
full-page boundary.

### [PREEXISTING] P2 I0 C3 — The CSP is effectively off

`config/initializers/content_security_policy.rb` sets only `font_src` and a
`report_uri` of `/csp-violation-report-endpoint`. No route serves that path.
`script-src`, `object-src` and the nonce generator are all commented out.
Rails 8's default is a nonce-based policy, and `javascript_importmap_tags`
already supports nonces.

**Fix (after moving the inline scripts into Stimulus):** enable `script_src :self`
plus nonces in report-only mode first, then enforce it. The core page's Solr JSONP needs the search endpoint
hosts in `script-src`, or a per-request allow-list. Either remove
`report_uri` or add the endpoint.

### [PREEXISTING] P1 I0 C3 — Importers use `permit!` and denylists

`api/v1/import/cases_controller.rb:34` and `api/v1/import/books_controller.rb:85`
call `params.require(...).permit!`. `CaseImporter` then passes nested hashes
straight to Active Record, filtered by `except` (a denylist):

- `app/services/case_importer.rb:93`: `queries.build(query.except(...))`
- `app/services/case_importer.rb:99`: `ratings.build(rating.except(:user_email))`
- `app/services/case_importer.rb:126`: `tries.first.update(try_params.except(...))`

With a denylist, any column not explicitly excluded can be set, for example
`user_id` on a rating or `case_id` on the try. *Not verified* whether this is
exploitable (whether the association overrides the foreign key in each case),
but the best practice is an allowlist. Use nested `permit` with the export
schema's fields, or `slice` to known keys inside the importer.

### [PREEXISTING] P2 I0 C1 — `rescue Exception` in the ratings import

`api/v1/import/ratings_controller.rb:77` catches `Exception`, which includes
`Interrupt`, `NoMemoryError` and `SystemExit`, logs it at `debug` level, and
returns the raw `e.message` to the client. Rescue `StandardError` (or the
importer's own error classes) instead, report the error with
`Rails.error.report(e)`, and return a generic message for unexpected errors.

### [MIGRATION-FOLLOWUP] P3 I1 C1 — Global event names lack shared constants

[The core event bus registry](../../DEVELOPER_GUIDE.md#core-event-bus)
already documents event names, payloads, emitters, listeners and lifecycle rules.
The remaining issue is that global event names are repeated as string literals
in JavaScript and ERB `@document` actions; there is no shared constants module.

Optionally centralize genuinely global JavaScript event names in an exported
constants module. ERB actions would still need coordinated updates. Use
`this.dispatch()` for controller-owned notifications and outlets for calls to a
known peer, following the existing guide. Preserve documented event names,
payloads and scope; a registry does not justify changing their contracts.

### [PREEXISTING] P3 I1 C2 — Small Rails idiom issues

- [PREEXISTING] P3 I1 C2 — **`Case` initialization.** `Case` uses `after_initialize` to default
  `archived` and to call `set_scorer`
  (`app/models/case.rb:101,105`). `set_scorer` can query the database for
  every instantiated record whose `scorer_id` is nil. Move the `archived`
  default into the migration (as a column default) or into an `attribute`
  default, and set the scorer `before_validation on: :create` instead.
- [PREEXISTING] P3 I0 C1 — **Concurrency key.** `RunCaseEvaluationJob`'s
  `limits_concurrency key: self.class.name` is evaluated in the class body,
  so it is the string `"Class"`. It works as a class-wide limit only by
  accident. Keep the required `key:` argument: use an explicit constant key
  or `key: ->(*) { self.class.name }` for the class-wide limit. The default
  group namespaces the key by job class; it does not replace the key.
- [PREEXISTING] P3 I0 C1 — **`where(...).first`.** There are 21 uses where `find_by` (or `find`, when
  a 404 is the intended response) is the idiom, e.g.
  `core_controller.rb:24` and `search_endpoints_controller.rb:92`.
- [PREEXISTING] P3 I0 C0 — **Debug comment in a view.** `books/_book.html.erb:2` renders `Time.now`
  inside an HTML comment that ships to every browser. Remove it.

### [PREEXISTING] P3 I0 C0 — Leftover debug `console.log`s

These controllers log on `connect`: `mapper_wizard`, `prompt_form`,
`import_case` and `import_snapshot`. `eslint.config.mjs` currently sets
`no-console: 'off'`; a `warn` rule for `app/javascript/controllers/` would
catch new ones.

## [MIGRATION-FOLLOWUP] Upstream integration plan

Assessment snapshot: 2026-10-06. Branch: `angular-phase-10` at
`c465fdc5`. Upstream: `origin/main` at `c5344288`. Refresh upstream and
reassess new commits before execution.

### [MIGRATION-FOLLOWUP] Recommendation

Integrate selectively: cherry-pick isolated changes and adapt features that
overlap the Angular removal work. Reuse upstream implementations and tests;
write fresh code only where the current architecture requires it. Do not
rebase this branch onto `main` now.

| Approach | Use |
| --- | --- |
| Rebase onto `main` | Avoid now: replaying 294 branch-only commits would spread conflict resolution across intermediate implementations. |
| Cherry-pick | Use for isolated changes after checking dependencies and existing coverage. |
| Adapt upstream changes | Preferred for AI judge features and UI changes touching migrated surfaces. |
| Rewrite everything fresh | Avoid: preserve useful upstream code, tests, and implementation decisions. |
| Merge `main` | Consider after feature batches are integrated and verified, to reconcile ancestry without rewriting branch history. |

The branches have 294 branch-only and 31 upstream-only commits. Upstream
changed 343 files since the common ancestor (`f77c17d4`); 206 also changed
on this branch. A merge simulation produced 129 conflict reports, including
upstream edits to deleted Angular files. The simulation used temporary Git
objects and did not alter the branch, index, or working files.

### Existing integration

Commit `c465fdc5` already adapts portions of `c468d18f`, `348b1890`,
`957ab241`, `15a75d2a`, `213c2bdb`, `bc611bc0`, and `2acb1164`:
book scales, score-list performance, Vespa validation, mapper cleanup,
AI images, and job handling.

These commits still appear missing in Git ancestry despite some behavior
being present. Track remaining changes by feature; do not pick the commits
again wholesale or assume their complete functionality is integrated.

### [MIGRATION-FOLLOWUP] Execution batches

Batches 1–11 are complete; their ledgers have been removed. Desktop support
(`78b5f3db`) is excluded by user decision. Remaining work is tracked in the
[remaining audit inventory](#preexisting-remaining-audit-inventory).

### Contracts to preserve

- Book API team selection is scoped to `current_user.teams`; upstream uses
  unrestricted `Team.find_by`. Retain current authorization and sharing
  behavior in `app/controllers/api/v1/books_controller.rb`.
- Logout and Judge Later use mutation verbs in `config/routes.rb`; upstream
  still uses GET. Retain the current verbs and corresponding callers.
- Historical scores survive try deletion through `Try#scores` nullification
  and optional `Score#try`. Retain both sides of that association contract.
- `Try.latest` returns nil for an empty case through a class method; upstream
  uses a scope whose empty result can become a relation. Retain current behavior.
- Retain Turbo response contracts, case-page navigation boundaries, and
  existing authorization, validation, persistence, and job safeguards.

These are source-level findings, not runtime parity verification.

### [MIGRATION-FOLLOWUP] Completion gates and ledger

Follow [AGENTS.md](../../AGENTS.md) and
[DEVELOPER_GUIDE.md](../../DEVELOPER_GUIDE.md) for execution and verification.
Complete each batch end-to-end before marking it done:

- Record upstream provenance and distinguish existing adaptations from new work.
- Preserve current regression tests and bring over relevant upstream tests.
- Run affected tests and required lint/build checks in the existing server container.
- For user-visible changes, capture and inspect before/after Playwright MCP
  screenshots for representative success and failure flows. Record deferred
  coverage and update only manual scenarios actually exercised.
- Record any concrete blocker and smallest safe prerequisite; leave the batch
  incomplete when parity or acceptance criteria remain unresolved.

Maintain a concise ledger here as execution proceeds. For each feature, record
upstream commits, status (`fully integrated`, `partially adapted`, `deferred`,
or `superseded`), resulting branch commit when available, remaining work, and
verification evidence. Reconcile ancestry only after every incoming change has
an explicit disposition; choosing an entire side of a conflict is not proof
that its behavior has been reconciled.

### Remaining upstream integration audit

**Two documentation/configuration hunks remain unported from `origin/main` at
`c5344288`.** The incoming-commit map was recorded in the final ledger
(`upstream_remaining_audit_ledger.md`, batch 11, 2026-10-07); that file
is no longer present in the working tree.

#### [PREEXISTING] Remaining audit inventory

- [PREEXISTING] P2 I1 C0 — `78b5f3db`: remove the first, conflicting
  `QUEPID_CONSIDER_ALL_REQUESTS_LOCAL=true` assignment from `.env.example`,
  retaining upstream's single `false` example and its explanation. Desktop
  exclusion does not account for this unrelated cleanup.
- [PREEXISTING] P2 I0 C0 — `c468d18f`: restore the Books API index's `@parameter owned(query)` Boolean
  annotation in `app/controllers/api/v1/books_controller.rb`. The filter is
  implemented; its API documentation is missing.

These are pending corrections, not new product features.

#### Remaining verification limits

No new browser pass or production cutover was performed. Earlier sampled
browser evidence, deferred live/paid-provider and account matrices, and
production/CI verification limits remain. At the audit, the tracker reported 109/168 due
scenarios for changed paths or missing runs; no age-only expiry was found.
[MIGRATION-FOLLOWUP] P3 I0 C3 — Git ancestry still requires separate reconciliation; the incoming commits'
absence from ancestry does not mean their features are missing.

## [MIGRATION-FOLLOWUP] Developer Experience Review

A review of Quepid's tooling, structure and architecture from four perspectives: software architect, pragmatic engineer, modern Rails/Hotwire engineer, and engineering leadership. The focus is readability, maintainability and ease of use.

**Reviewed:** October 5, 2026. This snapshot includes the current working tree, including pending changes. Findings come from source, configuration and documentation inspection; no builds, test suites or browser flows were run for this documentation update. File counts describe source files, not runtime classes or test coverage.

### Snapshot

- **Backend:** Rails 8.1.3.1 (`Gemfile.lock`), Ruby 4.0.6 (`.ruby-version`), Minitest, Solid Queue and ActionCable. There are 36 model, 96 controller and 21 service Ruby files under `app/`.
- **Frontend:** Rails-rendered HTML, Stimulus, Turbo and plain JavaScript modules. `app/javascript/` contains 178 JS files, about 18,600 lines, including 74 `*_controller.js` files. The case workspace uses explicit runtime capabilities and stores rather than AngularJS.
  - Eight `live_query_*` modules remain in `utils/`; `live_query_runtime_owner.js` is 682 lines.
  - Importmap serves ordinary Rails pages; esbuild builds the case and analytics bundles. `config/importmap.rb` has 35 explicit pins plus directory-wide pins, so that number is not the total resolved module count.
- **Tests and tooling:** 165 Vitest spec files and 31 Playwright spec files, plus one Rails system-test file. These counts do not establish coverage or passing status. Node is constrained to version 24 by `package.json`; Yarn is the package manager.
- **Documentation:** 27 files under `bin/`, a 1,243-line `DEVELOPER_GUIDE.md`, and a 216-line `AGENTS.md`. Dedicated JS pipeline/tooling docs, a manual-testing tracker, migration references and an Azure-provider OpenSpec coexist.
- **CI:** `.github/workflows/test.yml` has separate MySQL, SQLite and PostgreSQL jobs. Each runs `bin/setup_docker` and `rails test`. A dedicated frontend job runs `rails test:frontend` without Compose services. A separate nightly workflow builds and publishes the production image.

#### [PREEXISTING] P2 I2 C1 — 2. Reconcile onboarding, Docker and frontend documentation

Keep [DEVELOPER_GUIDE.md](../../DEVELOPER_GUIDE.md) as the human-facing entry point, [app_structure.md](../app_structure.md) for architecture, and [js_pipeline.md](../js_pipeline.md) / [js_tooling.md](../js_tooling.md) for frontend mechanics.

- [PREEXISTING] P2 I1 C1 — Correct the local prerequisite from Node 22 or later to the Node 24 requirement in `package.json`. Link a short clone-to-first-test path to the detailed version and container guidance; time a fresh setup before promising a setup duration.
- [PREEXISTING] P2 I2 C1 — Replace conflicting operational advice with safe, complete procedures for identifying and reusing the running server. The guide currently recommends throwaway commands during development, killing port owners, resetting the environment and pruning Docker resources, while agent guidance requires preserving the server. Once the shared procedures are correct, link to them from `AGENTS.md` and remove duplicated human-facing policy. Retain agent-specific safeguards.

#### [PREEXISTING] P2 I2 C2 — 3. Add safe execution support for existing server containers

`bin/docker s` / `q` start servers through `docker compose run`; `r`, `b` and `c` create separate containers. Add an explicit exec command that recognizes actual `quepid-app-run-*` servers and refuses ambiguous choices, preserving startup semantics.

Until that exists, use `docker exec <actual-server-container>` or `docker compose exec app` for an existing service container. Do not infer that the server is stopped from an empty Compose service listing.

#### [MIGRATION-FOLLOWUP] P3 I2 C3 — 5. Clarify frontend ownership and delivery boundaries

[Application structure](../app_structure.md) describes workspace construction, capability groups and query/document/score stores. `createCoreWorkspaceRuntime` constructs dependencies before controllers connect. Retain these explicit state owners while making their relationships easier to navigate.

- [MIGRATION-FOLLOWUP] P3 I1 C2 — Group coherent subsystems in `utils/` when their boundaries are understood. Search, scoring, snapshots, case state, Bootstrap and DOM helpers currently share that directory; imposing `domain/`, `ui/` and `net/` everywhere is not a prerequisite.
- DOM ownership and Rails-owned modal shells are tracked in [the DOM lifecycle item](#migration-followup-p3-i1-c2--move-remaining-utils-dom-lifecycles-into-controllers-retrofit-track-e); global event names are tracked in [the event-constants item](#migration-followup-p3-i1-c1--global-event-names-lack-shared-constants). Preserve the per-surface lifecycles described in [Angular remnants, Stimulus/Turbo retrofit, and frontend DRY](#migration-followup-angular-remnants-stimulusturbo-retrofit-and-frontend-dry). Use `ProgressBroadcaster` as an existing pattern for background Turbo Stream updates. Browser-owned repeated content remains appropriate for interactive search results.
- Retain the established asset conventions: importmap and esbuild serve different lifecycles; Quepid already uses `jsbundling-rails`, `esbuild.config.js` and `bin/dev`. CSS has custom core/application outputs and compatibility layers. Keep importmap pins, bundle resolution and Vitest aliases consistent when modules are added.

Module moves must also update bare imports and manual-test path mappings in the same patch. Keep mechanical moves separate from behavioral changes. Moving root-level `build_css.js` or `audit_css.js` alone has modest payoff and affects build/lint paths; prioritize command drift and CI coverage.

#### [PREEXISTING] P3 I2 C3 — 6. Extract focused backend responsibilities and clarify partial inputs

Backend extraction is tracked in the [complex-methods item](#preexisting-p3-i2-c3--complex-methods-metrics).

[PREEXISTING] P3 I1 C1 — Adopt strict locals for new or substantially changed partials. Only four ERB partial files currently declare `locals:`, across 273 view files overall. This documents inputs without introducing ViewComponent solely for that purpose.

#### [MIGRATION-FOLLOWUP] P2 I2 C3 — 7. Clarify review, verification and maintenance responsibilities

- [MIGRATION-FOLLOWUP] P2 I1 C1 — Improve the existing [PR template](../../.github/PULL_REQUEST_TEMPLATE.md): correct checkbox syntax to `- [ ]`, request sampled/deferred manual coverage when applicable, and scale test requirements to the change. Define release-note expectations before adding automatic CHANGELOG enforcement; do not infer PR scope from working-tree size.
- [MIGRATION-FOLLOWUP] P2 I1 C2 — Clarify the browser release gate. Playwright is the substantial browser suite; `test/system/search_endpoints_test.rb` remains a generated-style Rails system test. Decide whether to maintain or retire it, correct `config/ci.rb`'s comment claiming none exist, and document which suite gates releases.
- [MIGRATION-FOLLOWUP] P2 I2 C3 — Automate repeatable critical paths from the [manual tracker](../../DEVELOPER_GUIDE.md#manual-testing-tracker); do not remove useful scenarios merely to shrink the tracker. Verification requirements are in [Completion gates and ledger](#migration-followup-completion-gates-and-ledger).
- [MIGRATION-FOLLOWUP] P2 I1 C1 — Document dependency-update ownership and review/merge cadence. Renovate configuration and cleanup tooling do not establish responsibility. Include checking npm and importmap versions for packages delivered through both paths.
- [MIGRATION-FOLLOWUP] P3 I1 C1 — Preserve `[MIGRATION]`, `[MIGRATION-FOLLOWUP]` and `[PREEXISTING]` until remaining work is classified and closed. Angular's removal alone does not justify retiring tags or the migration skill. Archive completed plans while keeping unresolved acceptance criteria and historical evidence accessible.

### [MIGRATION-FOLLOWUP] Execution guidance

Follow [AGENTS.md](../../AGENTS.md) for behavior-preserving scope and [Completion gates and ledger](#migration-followup-completion-gates-and-ledger) for verification. Unit tests cover state and command contracts; browser checks cover rendering, lifecycle, Bootstrap and Turbo behavior.

This review supplies priorities, not a migration acceptance plan or proof that outstanding defects are fixed. Concrete defects and their provenance remain in the preceding items; the [best-practices review](#migration-followup-stimulus--hotwire--rails-best-practices-review) retains its detailed findings and verification evidence.

Start with CI parity and documentation drift; pursue structural changes where they reduce an observed maintenance cost. A wholesale runtime rewrite, controller-wide refactor, forced importmap/esbuild consolidation or deletion of migration evidence is outside these recommendations.

## Not doing

Deferred work. Delete an entry when it is resolved or move it back to the active backlog when prioritized.

### [PREEXISTING] Wizard TLS reload exposes basic-auth credentials

The `http`↔`https` switch is a cross-origin navigation, so browser storage and `Secure` session cookies cannot provide a direct handoff. A short-lived, single-use opaque token could retrieve server-side pending state without sharing those cookies, keeping the credential itself out of browser history and URL logs. Redemption over plaintext `http` would still carry transport risk. This mitigation is deferred, not technically impossible.

### [PREEXISTING] Wizard TLS reload loses endpoint-specific settings

The same server-side handoff could preserve the full pending endpoint configuration (headers, mapper code, field selections), including explicit empty values, without reapplying engine defaults over it. This work is deferred; currently users re-enter those settings after the switch.

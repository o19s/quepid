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

### [PREEXISTING] P1 I0 C3 — Scorer sandboxing - LATER

**Decision needed:** Agree on the trust model for shared scorer code and the isolation guarantees required while preserving supported scorer behavior.

Client scorer code still executes through `new Function()`; evaluate a Web
Worker or equivalent browser isolation. The batch path already uses the shared
scorer runtime through V8/MiniRacer; keep browser and batch scorer behavior
aligned when adding isolation.

### [MIGRATION-FOLLOWUP] P3 I2 C3 — Server-rendered modal lists

See [Persisted case UI](../app_structure.md#persisted-case-ui) for the accepted
HTML-endpoint boundary.

The broader proposed sequence for replacing the remaining SPA responsibilities
is in [Rails/Hotwire workspace plan](rails_stimulus_json_workspace_plan.md). It starts
with the endpoint-design decision below and preserves browser search and instant
scoring while moving persisted UI and navigation into Rails/Hotwire.

`diff_core` (snapshot selects) and `export_case_core` still build lists from JSON
in JS. They could become partials loaded through lazy
`<turbo-frame src=...>`, like `DropdownController#cases_core`, and modal form
posts could be answered with Turbo Streams. The annotations list
(`annotations_controller.js`) now uses server-rendered persisted rows;
creation still captures live browser scores. Its UI endpoints now return rendered
rows while retaining JSON request payloads and dispatching `annotations:changed`
for `qgraph`; the existing JSON API remains available.

Case Frames/Streams already work with Drive disabled. Keep the workspace's
full-document navigation boundary and prove annotation list and edit-modal parity
before expanding the conversion.

## [PREEXISTING] Security

### [PREEXISTING] P0 I0 C3 — User API IDOR and cross-account write path

**Decision needed:** Confirm whether cross-user lookup is an intended directory contract, who may use it, and which fields it may expose; the existing test explicitly permits it.

**Location:** `app/controllers/api/v1/users_controller.rb:24-48`, `test/controllers/api/v1/users_controller_test.rb:30-39`

`set_user` looks up any user by email or numeric ID without scoping to `current_user`, and `update` permits `company`, `completed_case_wizard`, and `default_scorer_id`. The existing test codifies one signed-in user fetching another's record. Unless this is an intentional admin directory, it exposes account metadata and allows cross-account changes.

**Fix direction:** Scope ordinary requests to `current_user`. If admin lookup is needed, make it a separate admin-only endpoint with its own serializer and authorization test.

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

---

### [PREEXISTING] P1 I0 C3 — Static Active Record encryption keys committed as production fallbacks

**Location:** `config/application.rb:55-61`

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

#### [PREEXISTING] P2 I0 C2 — Sanitize announcement HTML

**Location:** `app/views/layouts/_header.html.erb`, `app/views/admin/announcements/index.html.erb`

Both displays render administrator-authored announcement text with `html_safe`. Administrator-only editing lowers exposure but still permits stored scripts and event handlers.

**Fix direction:** Apply a consistent HTML allowlist to both displays, preserving supported formatting and links.

**Compatibility gate:** Inspect existing announcement HTML before choosing allowed tags and attributes. Sanitization may remove formatting, embedded content or links; verify retained formatting and rejection of executable markup. Search results, ratings and scores should be unaffected.

#### [PREEXISTING] P2 I0 C2 — Allowlist ratings-export templates

**Location:** `app/controllers/api/v1/export/ratings_controller.rb`

Two warnings cover template names derived from `file_format`. No traversal exploit was established.

**Fix direction:** Map supported formats to literal template names and define the unsupported-format response.

**Compatibility gate:** Preserve existing valid formats, casing behavior, defaults, snapshot selection and output. Supported export content must remain identical; unknown formats may receive a deliberate error instead of the current template-resolution failure. Do not fold unrelated export behavior fixes into this hardening.

---

## [PREEXISTING] P2 — Security

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

### [PREEXISTING] P2 I0 C3 — Anonymous judgements have no identity: `combine` collapses them, re-import duplicates them

**Decision needed:** Define what identifies an anonymous judgement across book operations. For `combine`, choose separate anonymous rows versus a combined rating, and define aggregation when combining multiple books. For import, choose whether anonymous imports accumulate rows or replace an authoritative set, and define an identity/retry contract. Decide both together; they share a root cause.

#### `BooksController#combine` collapses anonymous judgements into one averaged row

**Location:** `app/controllers/books_controller.rb:275` — `combine`

The merge loop upserts each source judgement with `query_doc_pair.judgements.find_or_initialize_by(user: j.user)`. `Judgement` deliberately permits several nil-user rows per pair (`validates :user_id, uniqueness: { scope: :query_doc_pair_id }, unless: -> { user_id.nil? }`), so *every* anonymous judgement in the source book matches the same target row. N anonymous judgements collapse to 1 — and because the same loop averages (`(judgement.rating + j.rating) / 2`), the surviving rating is an order-dependent running mean, not a true average.

**Reproduced** by running the verbatim inner loop against the test DB (a script, not a Playwright pass): a source pair carrying anonymous `[1.0, 3.0, 3.0]` produced **one** target row rating `2.5`, where the true mean is 2.33.

**Cause:** Same root cause as the import bug fixed in `BookImporter#import_judgement` on 2026-09-10 — `find_or_initialize_by(user: nil)` treats "no judge" as an identity.

**Fix direction:** Needs a product call first: should anonymous judgements copy across as separate rows (mirroring the importer, no averaging), or keep collapsing into one averaged row? If separate, skip the find when `j.user.nil?` and `build` unconditionally. Note the averaging is order-dependent even for identified users once you merge 3+ books; the same `combine` line is already documented under the [judgement-scale validation item](#preexisting-p2-i1-c3--judgement-rating-not-validated-against-books-scale-outside-ai-judging) for a different reason.

#### Re-importing anonymous judgements is not idempotent, and it moves computed case ratings

**Location:** `app/services/book_importer.rb` — `import_judgement`

An anonymous judgement has no identity to upsert on, so as of the 2026-09-10 fix each import `build`s a new row (the alternative — `find_or_initialize_by(user: nil)` — collapsed all of them into one, which was worse). The accepted cost is documented in the code and in `docs/manual-testing/10-books-management.md`. What makes it more than cosmetic: `RatingsManager#calculate_rating_from_judgements` averages 1-2 judgements but takes the **min of the top 3** at 3 or more, so duplication can move a rating a user never re-judged — `[3.0, 0.0]` → 1.5 becomes `[3.0, 3.0, 0.0]` → 0.0. Pinned by `test/services/book_importer_test.rb`'s "re-importing anonymous judgements duplicates them and moves the computed case rating".

**Reached by** the ordinary export → re-import path, since `_judgements.json.jbuilder` emits `user_email` only `if judgement.user`, so exported anonymous rows come back identity-less; also by a Mission Control retry of a failed `ImportBookJob` (no job-local `retry_on`; `DeferredPayload.consume` retains the upload on failure and purges it only after the import block succeeds), and plausibly by a double-submitted import form.

**Fix direction:** Needs the same product call as `combine` above. Option: treat a payload's `judgements` array as authoritative for a pair's *anonymous* set — `query_doc_pair.judgements.where(user: nil).delete_all` before building the incoming user-less ones — which keeps upsert semantics for identified judges and makes repeated imports converge. Wrong answer if a book legitimately accumulates anonymous judgements across several import files.

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

### [PREEXISTING] P1 I0 C1 — `FetchService` query substitution treats `\0`/`\1` as backreferences

**Location:** `app/services/fetch_service.rb` — `build_get_params`

`#$query##` is substituted twice. `build_get_params` uses
`gsub(string, string)`, so `\0` or `\1` in the query text is treated as a
backreference and the server sends a different query than the user typed.
`replace_values` already uses the safe block form. Background scores can
silently differ from the case page.

**Fix direction:** Use the block form (or a shared substitution helper) and add
a test with backslash sequences in the query text.

### [PREEXISTING] P1 I0 C2 — `FetchService` drops repeated GET params such as Solr `fq`

**Location:** `app/services/fetch_service.rb` — `build_get_params`

`build_get_params` assigns `params[key] = val` in a loop, so repeated Solr
params such as `fq` keep only the last value. Background evaluations then run
with fewer filters than the browser search and produce different scores.

**Fix direction:** Accumulate repeated keys into arrays and encode them as
repeated params; add a test with multiple `fq` values. This changes fetched
results and background scores, so verify against a client search for the same
try.

### [PREEXISTING] P2 I0 C3 — Mapper wizard function extraction is not lexical-aware

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

- [PREEXISTING] P2 I0 C3 — `escape_query` is never applied on the server, while the client honors it.

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

Current thresholds, reloads, redirects and errors are documented in
[Refresh-ratings orchestration](../core_ui_implementation_reference.md#refresh-ratings-orchestration).

**Defer.** These flows alter scoring inputs and differ in stale-response
handling, reload completion, errors, and redirects. Extracting only the threshold
and PUT offers little reduction. Keep the existing reload event contracts.

### [MIGRATION-FOLLOWUP] P3 I1 C3 — Snapshot CSV import contracts — deferred

Caller-specific failure policies are documented in
[Snapshot CSV import contracts](../core_ui_implementation_reference.md#snapshot-csv-import-contracts).

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


### [MIGRATION-FOLLOWUP] P3 I0 C2 — Success-and-redirect helpers — deferred

Current delays are documented in
[Success-and-redirect timing](../core_ui_implementation_reference.md#success-and-redirect-timing).

**Defer.** One delay changes the current contract. A helper preserving each
caller's delay, URL, notice, and navigation method saves very little.

### [MIGRATION-FOLLOWUP] P3 I1 C2 — Busy-state helpers — deferred

Existing implementations are documented in
[Busy-state contracts](../core_ui_implementation_reference.md#busy-state-contracts).

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

**Fix direction:** apply the [Error-message policies](../../DEVELOPER_GUIDE.md#error-message-policies)
explicitly at each boundary, with focused tests for intentional changes. Preserve
the [Import-ratings error precedence](../core_ui_implementation_reference.md#import-ratings-error-precedence).

### Review boundaries

See [Behavior-preserving refactoring boundaries](../../DEVELOPER_GUIDE.md#behavior-preserving-refactoring-boundaries)
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

### [PREEXISTING] P3 I1 C2 — Chart initialization and lifecycle ownership

The remaining inline `<script>` blocks are on the isolated analytics surfaces
(`layouts/analytics.html.erb`, `analytics/tries_visualization/show.html.erb`)
and the standalone `home/sparklines` frame example. Defer extraction until
analytics work or CSP hardening requires it. Verify chart initialization waits
for Vega readiness; source inspection suggests a loading-order risk, not a
reproduced failure. Use Stimulus for chart and clipboard lifecycle ownership
when extracting. Analytics keeps an explicit full-page boundary. Confirm the
sparklines example is maintained functionality before migrating its frame
lifecycle.

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

### [PREEXISTING] P3 I1 C2 — Small Rails idiom issues

- [PREEXISTING] P3 I1 C2 — **`Case` initialization.** `Case` uses `after_initialize` to default
  `archived` and to call `set_scorer`
  (`app/models/case.rb:101,105`). `set_scorer` can query the database for
  every instantiated record whose `scorer_id` is nil. Move the `archived`
  default into the migration (as a column default) or into an `attribute`
  default, and set the scorer `before_validation on: :create` instead.
- [PREEXISTING] P3 I0 C1 — **`where(...).first`.** There are 21 uses where `find_by` (or `find`, when
  a 404 is the intended response) is the idiom, e.g.
  `core_controller.rb:24` and `search_endpoints_controller.rb:92`.

## [MIGRATION-FOLLOWUP] Developer Experience Review

A review of Quepid's tooling, structure and architecture from four perspectives: software architect, pragmatic engineer, modern Rails/Hotwire engineer, and engineering leadership. The focus is readability, maintainability and ease of use.

**Reviewed:** October 5, 2026. This snapshot includes the current working tree, including pending changes. Findings come from source, configuration and documentation inspection; no builds, test suites or browser flows were run for this documentation update. File counts describe source files, not runtime classes or test coverage.

### [PREEXISTING] P2 I2 C1 — 2. Reconcile onboarding, Docker and frontend documentation

Use the established destinations in the [Documentation index](../README.md).

- [PREEXISTING] P2 I2 C1 — Replace conflicting operational advice with safe, complete procedures for identifying and reusing the running server. The guide currently recommends throwaway commands during development, killing port owners, resetting the environment and pruning Docker resources, while agent guidance requires preserving the server. Once the shared procedures are correct, link to them from `AGENTS.md` and remove duplicated human-facing policy. Retain agent-specific safeguards.

### [PREEXISTING] P2 I2 C2 — 3. Add safe execution support for existing server containers

`bin/docker s` / `q` start servers through `docker compose run`; `r`, `b` and `c` create separate containers. Add an explicit exec command that recognizes actual `quepid-app-run-*` servers and refuses ambiguous choices, preserving startup semantics.

Until that exists, use `docker exec <actual-server-container>` or `docker compose exec app` for an existing service container. Do not infer that the server is stopped from an empty Compose service listing.

### [MIGRATION-FOLLOWUP] P3 I2 C3 — 5. Clarify frontend ownership and delivery boundaries

Retain the explicit state owners described in [Application structure](../app_structure.md#core-frontend-app).

- [MIGRATION-FOLLOWUP] P3 I1 C2 — Group coherent subsystems in `utils/` when their boundaries are understood. Search, scoring, snapshots, case state, Bootstrap and DOM helpers currently share that directory; imposing `domain/`, `ui/` and `net/` everywhere is not a prerequisite.
- DOM ownership and Rails-owned modal shells are tracked in [the DOM lifecycle item](#migration-followup-p3-i1-c2--move-remaining-utils-dom-lifecycles-into-controllers-retrofit-track-e); global event names are tracked in [the event-constants item](#migration-followup-p3-i1-c1--global-event-names-lack-shared-constants). Preserve the per-surface lifecycles described in [Angular remnants, Stimulus/Turbo retrofit, and frontend DRY](#migration-followup-angular-remnants-stimulusturbo-retrofit-and-frontend-dry). See [Persisted case UI](../app_structure.md#persisted-case-ui) for rendering and background-update ownership.
- Follow [JavaScript delivery](../js_pipeline.md) and [JavaScript tooling](../js_tooling.md) when adding modules; retain the core/application CSS outputs and compatibility layers.

Follow [Behavior-preserving refactoring boundaries](../../DEVELOPER_GUIDE.md#behavior-preserving-refactoring-boundaries) for module moves. Moving root-level `build_css.js` or `audit_css.js` alone has modest payoff and affects build/lint paths; prioritize command drift and CI coverage.

### [MIGRATION-FOLLOWUP] Execution guidance

Follow [AGENTS.md](../../AGENTS.md) for behavior-preserving scope and [DEVELOPER_GUIDE.md](../../DEVELOPER_GUIDE.md) for verification. Unit tests cover state and command contracts; browser checks cover rendering, lifecycle, Bootstrap and Turbo behavior.

This review supplies priorities, not a migration acceptance plan or proof that outstanding defects are fixed. Concrete defects and their provenance remain in the preceding items; the [best-practices review](#migration-followup-stimulus--hotwire--rails-best-practices-review) retains its detailed findings and verification evidence.

Start with CI parity and documentation drift; pursue structural changes where they reduce an observed maintenance cost. A wholesale runtime rewrite, controller-wide refactor, forced importmap/esbuild consolidation or deletion of migration evidence is outside these recommendations.

Deliberately deferred or declined items live in [NOT-DOING.md](NOT-DOING.md).

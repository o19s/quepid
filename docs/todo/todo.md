# Todo

**Last updated:** 2026-10-07

Outstanding bugs, hardening, and cleanup in the current codebase. When something is fixed, remove its entry — do not add a completed section or keep resolved items for history.

Items requiring unresolved team decisions are in [todo-team.md](todo-team.md).

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

### [PREEXISTING] P2 I0 C2 — Resolve stored mapper input compatibility

Manual scenario 7.9: stored `JSON.parse(data)` mappers work on historical
`8ceb99e9` but fail on current because `lib/v8_mapper_executor.rb` pre-parses JSON
into an object. Upstream `92519d55` changed that contract before the Stimulus
mapper migration. Define a compatible input contract and verify both stored
string-based and object-based mappers; an adaptive mapper workaround does not
resolve existing saved mapper failures.

### [MIGRATION-FOLLOWUP] P2 I0 C1 — Unblock OAuth verification (1.3)

Provide working Google OAuth configuration and host resolution for Keycloak,
then replay sign-in through both providers. Current Google credentials are
placeholders; Keycloak sign-in fails with no host `keycloak` entry. Host-level
configuration changes require separate authorization. This is an environment
blocker, not an established migration defect.

### [MIGRATION-FOLLOWUP] P2 I0 C2 — Complete historical list sharing parity (3.6)

Investigate the empty historical `share-case` component on baseline `8ceb99e9`
and recover its fixture/asset binding without changing current sources or the
baseline implementation. Replay list share/unshare after recovery, then cover
duplicate/tampered requests. Current share/unshare and reload persistence passed.

### [MIGRATION-FOLLOWUP] P2 I0 C1 — Complete core sharing parity (6.5)

After resolving the historical sharing blocker in 3.6, replay core toolbar and
Judgements share/unshare on the baseline. Cover current cancellation and forced
request failures. Current share/unshare and reload/reopen persistence passed;
historical components render empty.

### [MIGRATION-FOLLOWUP] P2 I0 C1 — Unblock mapper AI generation (7.8)

Provide an authorized usable OpenAI key through the wizard, then generate and
test both mapper functions on both instances. Cover no-code responses and
truncation warnings, plus the AI refinement deferred in 7.9. Blank/invalid-key
errors passed; successful generation remains unverified.

### [MIGRATION-FOLLOWUP] P2 I0 C2 — Complete live search-provider coverage (17.9)

Provide authorized working OpenSearch, Vectara and Elastic Cloud test endpoints
and credentials, then compare live searches, mapped fields, persisted ratings
and authentication/error behavior on both instances. Solr, Search API and
Elasticsearch passed the recorded live sample; Qdrant is covered in 7.12.
Dummy endpoint creation does not establish live provider parity.

### [MIGRATION-FOLLOWUP] P2 I0 C2 — Complete deployment verification (17.10)

Prepare a disposable non-root deployment and configured mail/provider services;
verify non-root URLs, mail/invitation links, encrypted-provider workflows and
realtime/job execution. The recorded production runtime/SSL sample passed, but
worker startup alone did not verify these remaining workflows. Keep the existing
development servers and data intact.

## [MIGRATION-FOLLOWUP] Frontend cleanup after Angular removal

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
through `application.js`. The case workspace uses the shared Rails layout
but keeps a separate bundle with Drive disabled and a destination reload boundary;
standalone analytics also forces a fresh document. Frames and Streams remain
available on the case page. Shared layout/header markup does not make runtime
lifecycle or per-surface behavior interchangeable.

Follow [DEVELOPER_GUIDE.md — Turbo navigation](../../DEVELOPER_GUIDE.md#turbo-navigation)
and [Turbo on the case page](../../DEVELOPER_GUIDE.md#turbo-on-the-case-page)
for the current contracts. Actual Drive verification and deferred coverage are in manual scenario 15.8.

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

## [PREEXISTING] P1 — Product bugs


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

### [PREEXISTING] P1 I0 C3 — Static Active Record encryption keys committed as production fallbacks

**Location:** `config/application.rb:55-61`

Deployments that omit the env vars use publicly known keys, so encrypted fields are recoverable by anyone with the database.

**Fix direction:** Fail fast in production when keys are absent; keep generated dev/test defaults out of production config; document key rotation and backup.

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

### [PREEXISTING] P2 I2 C3 — Judgement rating not validated against book's scale (outside AI judging)

**Observed:** `Judgement#rating` only validates presence, never that the value is actually one of the book's configured scale values. `Api::V1::JudgementsController#update`, `JudgementsController`, and `BulkJudgeController#save` (`judgement.rating = params[:rating]`, no scale check) all write a client-supplied rating with no scale check — they're only "safe" today because the judging UI happens to render buttons limited to the book's actual scale values; nothing stops a raw form/API POST from bypassing that. The AI-judging path (`app/jobs/run_judge_judy_job.rb`, hardened in `37840b47`) is the only one with a guard, and it's job-local.

**Cause:** No model-level validation ties `Judgement#rating` to `query_doc_pair.book.scale`.

**Audit result (done):** Two call sites *legitimately* write ratings outside the discrete scale, both gated on `book.support_implicit_judgements?`:
- `[PREEXISTING]` `BooksController#combine` (`app/controllers/books_controller.rb:277`) averages two existing ratings — `(judgement.rating + j.rating) / 2` — and explicitly skips rounding when `support_implicit_judgements` is true (e.g. `(0+3)/2 = 1.5` on a `[0,1,2,3]` scale).
- `[PREEXISTING]` `JudgementFromRatingJob#perform` (`app/jobs/judgement_from_rating_job.rb:24`) copies a case-level `Rating#rating` straight into `judgement.rating` via `judgement.save!` (raises on failure) — that value comes from the case's scorer scale, which has no guaranteed relationship to the book's judgement scale.

`BookImporter`/`RatingsImporter` are fine: `RatingsImporter` writes the unrelated `Rating` model, and `BookImporter#import_judgement` already silently no-ops on failed saves.

**Fix direction:** Add an `inclusion` validation on `Judgement` for required ratings (preserve `rating_not_required?` for unrateable/judge-later rows), scoped to `query_doc_pair.book.scale`, conditioned `unless: -> { query_doc_pair&.book&.support_implicit_judgements? }` (safe-navigate — `query_doc_pair` is a required `belongs_to` but its own presence validation runs independently, so a blank `query_doc_pair` must not blow up this lambda with a `NoMethodError`) so the two legitimate continuous-rating paths above stay unaffected. Change `JudgementFromRatingJob` to `save` + handle a validation failure instead of `save!` (a case rating can legitimately be off-scale for an explicit-only book). Retire the job-local check in `run_judge_judy_job.rb` in favor of the model validation (catch the failure, call `mark_unrateable`).

The separate coercion/aggregation decision is in [todo-team.md](todo-team.md#preexisting-p2-i2-c3--judgement-coercion-and-aggregation-semantics).

The explicit `unrateable`/`judge_later` resets in `BulkJudgeController#save`
are redundant: `Judgement#rating=` already clears both for a non-nil rating.
Removing just those resets is a separate small no-op cleanup.

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

---

## [PREEXISTING] P3 — Code quality

### [PREEXISTING] P3 I0 C1 — Unsafe integer coercion in snapshot search

**Location:** `app/controllers/api/v1/snapshots/search_controller.rb:45-46`

`params[:rows].to_i` / `params[:start].to_i` without validation; non-numeric strings coerce to `0`.

---

### [PREEXISTING] P3 I1 C2 — BookImporter: judge identifiers `validate` doesn't check import silently as anonymous

**Location:** `app/services/book_importer.rb` — `find_judgement_user`, `validate`, `emails_of_judges`

`#validate` pre-checks judgement `user_email`s against existing users and refuses the import with "User with email '...' needs to be migrated over first." (or invites them, under `force_create_users`). Two identifiers `find_judgement_user` honours slip past it entirely, and both degrade to an unattributed judgement with no warning:

1. **`user_id`** is never validated at all. A payload naming a `user_id` that doesn't exist in this instance imports anonymous — and `app/views/books/import/edit.html.erb` documents `user_id` as *the* judge identifier for `all_judgements`, while row ids never survive a cross-instance export, so this is the routine case rather than an exotic one.
2. **`:email` on a *nested* judgement** — `emails_of_judges` reads only `judgement[:user_email]` in the `query_doc_pairs` branch, while the `all_judgements` branch reads `user_email || email` and `find_judgement_user` accepts either. So `{"rating":1.0,"email":"nobody@example.com"}` nested under a pair skips both the migration error and the `force_create_users` invite.

Not a regression — before the 2026-09-10 fix these were silently attributed to whichever nil-email AI-judge user the database returned first, which was worse — but all the identifier paths should fail the same way.

**Fix direction:** Have `emails_of_judges` read `user_email || email` in both branches, and have the `validate` pass collect `user_id`s alongside emails so an id that doesn't resolve is treated like an unknown email rather than degrading to anonymous in silence.

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
- `[PREEXISTING]` P3 I2 C2 — `Api::V1::Import::RatingsController#create`
- `[PREEXISTING]` P3 I2 C2 — `Api::V1::Export::RatingsController`
- `[PREEXISTING]` P3 I2 C2 — `Api::V1::Snapshots::SearchController`
- `[PREEXISTING]` P3 I3 C3 — `RatingsImporter`
- `[PREEXISTING]` P3 I2 C3 — `MapperWizardsController`
- `[PREEXISTING]` P3 I2 C3 — `TeamsController` / `HomeController`

---

## [MIGRATION-FOLLOWUP] Consolidated DRY review

### [PREEXISTING] P3 I2 C2 — Controller index filtering — deferred

Review ownership and filtering semantics independently before extracting a
concern. The team filter currently uses `joins` (Cases), `includes` plus a hash
`where` (Books), and a subquery (SearchEndpoints). SearchEndpoints parses
`archived` with `bool.deserialize`; the others use `deserialize_bool_param`.

A shared concern is appropriate only where accessible/owned scopes, archive
behavior, duplicate handling, and responses have the same contract. Preserve
those scopes and boolean semantics during extraction.

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

Do not impose one feedback policy on all four callers; Explain and Invite
already share `utils/temporary_feedback`, while Mapper's independent timers and
Browse's permanent success label are intentionally different.

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

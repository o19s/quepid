# Todo

**Last updated:** 2026-09-18

Outstanding bugs, hardening, and cleanup on `main` only. When something is fixed, remove its entry — do not add a completed section or keep resolved items for history.

Product bugs marked *Playwright MCP* were verified in a May 2026 headed pass and re-checked against the tree in Aug 2026. Line numbers may drift — re-check cited files before fixing.

**Angular removal:** do not patch the core case UI for items listed under [Obviated by Angular removal](#obviated-by-angular-removal-do-not-fix-in-angular). Migration work lives in [`angularjs_removal_inventory.md`](./angularjs_removal_inventory.md#open-bugs--ux-address-during-migration).

---

## Obviated by Angular removal (do not fix in Angular)

These affect the core case UI (`/case/...`) today but **should not be patched in AngularJS** — the owning code is scheduled for replacement. Fix the **backend/API** parts in the sections below when called out; handle **frontend/UX** in [`angularjs_removal_inventory.md`](./angularjs_removal_inventory.md#open-bugs--ux-address-during-migration).

| Item | Why not patch Angular | Where it moves |
|------|----------------------|----------------|
| Try delete bricks case (frontend) | `settingsSvc.editableSettings()` null guard, confirm dialog, console rejection noise | [inventory § try delete](./angularjs_removal_inventory.md#try-delete-bricks-case-on-reload) |
| Wizard Esc orphans empty cases | `angular-wizard` modal | [inventory § wizard Esc](./angularjs_removal_inventory.md#wizard-esc-orphans-empty-cases) |
| Static CSV missing required headers | `caseCSVSvc.arrayContains` | [inventory § static CSV](./angularjs_removal_inventory.md#static-csv-missing-required-headers) |
| Icon-only controls lack accessible names | Copy-query; snapshot delete/clear in Compare | [inventory § a11y](./angularjs_removal_inventory.md#icon-only-controls-lack-accessible-names) |
| Explain Query Copy silently fails | `ngclipboard` + modal dismiss race | [inventory § known bug](./angularjs_removal_inventory.md#known-bug-copy--explain-migration) |

---

## P0 — Product bugs (Playwright MCP verified)

### Deleting the latest try bricks the case (backend)

**Observed:** `DELETE /api/cases/:id/tries/:n` on the live try returns 204, but `cases.last_try_number` still points at the deleted try. Reload → banner *"Cannot read properties of null (reading 'tryNo')"*; case unusable until DB repair.

**Cause:** `Api::V1::TriesController#destroy` destroys the try but never recomputes `last_try_number` (create increments it). Deleting the latest try (including via API) can brick on reload.

**Fix direction:** After destroy, set `last_try_number` to `tries.maximum(:try_number)` (or null).

**Frontend/UX** (null try guard, confirm dialog, console noise): obviated — see [inventory § try delete](./angularjs_removal_inventory.md#try-delete-bricks-case-on-reload).

---

### Try delete orphans scores; `same_score_source?` can 500

**Observed:** Scores keep a stale `try_id`. When an orphan is `last_score`, `PUT /api/cases/:id/scores` can 500 with `undefined method 'try_number' for nil`.

**Cause:** No cascade/nullify from try → scores (`case_scores.try_id` has no FK). Guard `return false if last_score&.try&.nil?` in `CaseScoreManager#same_score_source?` does not catch a nil try (`nil&.nil?` → `nil`, guard never trips).

**Fix direction:** Cascade or nullify scores on try destroy; change the guard to `return false if last_score.try.nil?`.

---

## P1 — Product bugs (Playwright MCP verified)

### Uploading the judgements export imports nothing and reports success

**Location:** `app/services/book_importer.rb:66`, `app/views/api/v1/judgements/index.json.jbuilder`, `app/views/books/import/edit.html.erb:71`

The Import Judgements panel tells users verbatim: *"The format for importing Judgement data is the same as that for exporting it: `/api/books/:id/judgements`"*. That endpoint emits a top-level **`judgements`** key; `#import` only reads **`all_judgements`**, and nothing normalizes between them (`grep all_judgements app/controllers app/jobs app/services` → importer only). So the advertised round-trip drops every row, `#import` still returns `true`, and the user gets "Data was successfully queued for import."

**Status:** Confirmed by reading; not driven through the UI. Two nearby format mismatches in the same panel, worth fixing together: the export's per-judgement `judgement_id` key isn't a `Judgement` attribute (a denylist entry now absorbs it, see `UNASSIGNABLE_JUDGEMENT_KEYS`), and the panel's promise that *"If you do NOT provide a `query_doc_pair_id` then you must provide `query_text` and `doc_id`"* isn't implemented — `find_query_doc_pair` returns nil for a blank id and `import_all_judgements` then does `next unless qdp`, silently dropping the judgement. Only the nested-`query_doc_pair`-object form actually upserts.

**Fix direction:** Accept `judgements` as an alias for `all_judgements` (or make the export emit `all_judgements`), implement the flat `query_text`/`doc_id` fallback through `find_or_initialize_query_doc_pair`, and either way make a payload that matches zero rows report that instead of flashing success. Needs the allowlist work above first, since routing flat `query_text`/`doc_id` into `Judgement#assign_attributes` would raise `UnknownAttributeError` under the current denylist.

---

### Missing case: search_endpoints index 500s

**Observed:** `GET /api/cases/999999` → 404, but `GET /api/cases/999999/search_endpoints` → 500 (`undefined method 'teams' for nil`).

**Cause:** `SearchEndpointsController#index` calls `set_case` then `@case.teams` without `check_case`.

**Fix direction:** `before_action :check_case` (or nil-guard) when `params[:case_id]` is present.

---


## P2 — Security

### Proxy CSRF bypass

**Location:** `app/controllers/proxy_controller.rb:8`

`fetch` skips CSRF verification (`skip_before_action :verify_authenticity_token`) while requiring login. Cross-site POSTs from an authenticated session remain possible.

**Also open:** no rate limiting on proxy fetch (production concern when `proxy_requests: true`).

---

### Password reset enumerates accounts (Playwright MCP)

**Observed:** Unknown email → "email was not found"; known email → neutral "you will receive…" message.

**Cause:** `config.paranoid` commented out in `config/initializers/devise.rb`.

**Fix direction:** Enable `config.paranoid = true` (or normalize both responses).

---

### Rating deletion: tolerate "already gone"

Deleting a rating that was already removed can error; races (tabs, double clicks) worsen with async UI.

**Action:** Prefer no-op success for "delete missing rating" so the client can stay optimistic without 500s.

---

## P2 — Product bugs (Playwright MCP verified)

### Silent HTML profile update failure

**Observed:** Clearing required email and saving does not persist, but HTML path redirects with no flash/error.

**Cause:** `ProfilesController#update` surfaces errors for JSON only.

**Fix direction:** On HTML failure, re-render with flash / errors (mirror `AccountsController`).

---

### Profile page shows the same validation errors three times

**Location:** `app/views/profiles/show.html.erb`, `app/views/shared/_error_messages.html.erb`

**Observed:** A validation error from any one form on `/profile` renders under all three section headings (Profile, Account Security, Danger Zone) at once. E.g. submitting a mismatched password confirmation on the Account Security form also shows "Password confirmation doesn't match Password" under the unrelated Profile and Danger Zone sections.

**Cause:** The view renders `shared/error_messages` three times, once per section, always against the same `current_user.errors` — with no way to tell which section's form actually produced the error. Predates the shared partial; present since the initial OSS commit.

**Fix direction:** Either scope each render to only show when its own section's form was submitted, or consolidate into a single error block shown once above all three sections.

---

### Book import forms 404 instead of importing into the book you're viewing

**Location:** `app/views/books/import/edit.html.erb`, `app/controllers/books/import_controller.rb`

**Observed:** On `/books/:id/import/edit` ("Import Data Into This Book"), uploading a file through either upload form (Import Query Doc Pairs, Import Judgements) 404s.

**Cause:** Both forms are `form_with model: @book, url: books_import_index_path` with no explicit `method:`. Since `@book` is a persisted record, Rails renders them as PATCH (via the hidden `_method` field), but `config/routes.rb` only defines POST at `books_import_index_path` (`Books::Import#create`) — no PATCH route exists there, so the request never reaches the controller.

Fixing the method alone isn't enough: `Books::Import#create` unconditionally does `@book = Book.new`, ignoring `params[:id]` — it's built only for the from-scratch "New Book" import flow (`/books/import/new`), not for adding data to an existing book.

**Fix direction:** Give `#create` (or a new action) a path to load and import into an already-existing `@book` when an id is present, and point these two forms at that route/method instead of the generic new-book endpoint.

---

### Judgement rating not validated against book's scale (outside AI judging)

**Observed:** `Judgement#rating` only validates presence, never that the value is actually one of the book's configured scale values. `Api::V1::JudgementsController#update`, `JudgementsController`, and `BulkJudgeController#save` (`judgement.rating = params[:rating]`, no scale check) all write a client-supplied rating with no scale check — they're only "safe" today because the judging UI happens to render buttons limited to the book's actual scale values; nothing stops a raw form/API POST from bypassing that. The AI-judging path (`app/jobs/run_judge_judy_job.rb`, hardened in `37840b47`) is the only one with a guard, and it's job-local.

**Cause:** No model-level validation ties `Judgement#rating` to `query_doc_pair.book.scale`.

**Audit result (done):** Two call sites *legitimately* write ratings outside the discrete scale, both gated on `book.support_implicit_judgements?`:
- `BooksController#combine` (`app/controllers/books_controller.rb:277`) averages two existing ratings — `(judgement.rating + j.rating) / 2` — and explicitly skips rounding when `support_implicit_judgements` is true (e.g. `(0+3)/2 = 1.5` on a `[0,1,2,3]` scale).
- `JudgementFromRatingJob#perform` (`app/jobs/judgement_from_rating_job.rb:24`) copies a case-level `Rating#rating` straight into `judgement.rating` via `judgement.save!` (raises on failure) — that value comes from the case's scorer scale, which has no guaranteed relationship to the book's judgement scale.

`BookImporter`/`RatingsImporter` are fine: `RatingsImporter` writes the unrelated `Rating` model, and `BookImporter#import_judgement` already silently no-ops on failed saves.

**Fix direction:** Add an `inclusion` validation on `Judgement` scoped to `query_doc_pair.book.scale`, conditioned `unless: -> { query_doc_pair&.book&.support_implicit_judgements? }` (safe-navigate — `query_doc_pair` is a required `belongs_to` but its own presence validation runs independently, so a blank `query_doc_pair` must not blow up this lambda with a `NoMethodError`) so the two legitimate continuous-rating paths above stay unaffected. Change `JudgementFromRatingJob` to `save` + handle a validation failure instead of `save!` (a case rating can legitimately be off-scale for an explicit-only book). Retire the job-local check in `run_judge_judy_job.rb` in favor of the model validation (catch the failure, call `mark_unrateable`).

---

### `BooksController#combine` collapses anonymous judgements into one averaged row

**Location:** `app/controllers/books_controller.rb:275` — `combine`

The merge loop upserts each source judgement with `query_doc_pair.judgements.find_or_initialize_by(user: j.user)`. `Judgement` deliberately permits several nil-user rows per pair (`validates :user_id, uniqueness: { scope: :query_doc_pair_id }, unless: -> { user_id.nil? }`), so *every* anonymous judgement in the source book matches the same target row. N anonymous judgements collapse to 1 — and because the same loop averages (`(judgement.rating + j.rating) / 2`), the surviving rating is an order-dependent running mean, not a true average.

**Reproduced** by running the verbatim inner loop against the test DB (a script, not a Playwright pass): a source pair carrying anonymous `[1.0, 3.0, 3.0]` produced **one** target row rating `2.5`, where the true mean is 2.33.

**Cause:** Same root cause as the import bug fixed in `BookImporter#import_judgement` on 2026-09-10 — `find_or_initialize_by(user: nil)` treats "no judge" as an identity.

**Fix direction:** Needs a product call first: should anonymous judgements copy across as separate rows (mirroring the importer, no averaging), or keep collapsing into one averaged row? If separate, skip the find when `j.user.nil?` and `build` unconditionally. Note the averaging is order-dependent even for identified users once you merge 3+ books; the same `combine` line is already documented under [Judgement rating not validated against book's scale](#judgement-rating-not-validated-against-books-scale-outside-ai-judging) for a different reason.

---

### Re-importing anonymous judgements is not idempotent, and it moves computed case ratings

**Location:** `app/services/book_importer.rb` — `import_judgement`

An anonymous judgement has no identity to upsert on, so as of the 2026-09-10 fix each import `build`s a new row (the alternative — `find_or_initialize_by(user: nil)` — collapsed all of them into one, which was worse). The accepted cost is documented in the code and in `docs/manual-testing/10-books-management.md`. What makes it more than cosmetic: `RatingsManager#calculate_rating_from_judgements` averages 1-2 judgements but takes the **min of the top 3** at 3 or more, so duplication can move a rating a user never re-judged — `[3.0, 0.0]` → 1.5 becomes `[3.0, 3.0, 0.0]` → 0.0. Pinned by `test/services/book_importer_test.rb`'s "re-importing anonymous judgements duplicates them and moves the computed case rating".

**Reached by** the ordinary export → re-import path, since `_judgements.json.jbuilder` emits `user_email` only `if judgement.user`, so exported anonymous rows come back identity-less; also by a Mission Control retry of a failed `ImportBookJob` (no `retry_on`, and `book.import_file.purge` runs *after* `service.import`), and plausibly by a double-submitted import form.

**Fix direction:** Needs a product call, same as the `combine` entry below. Option: treat a payload's `judgements` array as authoritative for a pair's *anonymous* set — `query_doc_pair.judgements.where(user: nil).delete_all` before building the incoming user-less ones — which keeps upsert semantics for identified judges and makes repeated imports converge. Wrong answer if a book legitimately accumulates anonymous judgements across several import files.

---

### `Api::V1::JudgementsController#create` keys its lookup off `:user` but assigns `:user_id`

**Location:** `app/controllers/api/v1/judgements_controller.rb:80`

`find_or_create_by(query_doc_pair_id: ..., user_id: judgement_params[:user])` looks up on `:user`, while eight lines later the judge is assigned from `judgement_params[:user_id]`. The lookup therefore runs with `user_id: nil`, which can match an existing *anonymous* judgement on that pair and then re-attribute it to the posting user: a silent overwrite of someone else's rating instead of a new row.

**Status:** Confirmed by reading `extract_judgement_params` — `:user` is **not** in its permit list (`:rating, :unrateable, :judge_later, :query_doc_pair_id, :user_id, :explanation`), so `judgement_params[:user]` is always nil and the lookup key is *always* `nil`, not just when a caller omits it. Consequences in order: the endpoint never attributes a judgement to anyone unless the caller passes `user_id`; when a caller does pass it, the request adopts and re-attributes an existing anonymous row; two API clients judging the same pair fight over one row. Deferrable because nothing in Quepid's own frontend calls it (grepped `app/javascript`, `app/assets/javascripts`) — this is external API surface only. Note the existing controller test asserts only a `judgements.count` delta, so it passes either way. Same bug family as the `BookImporter` nil-user work of 2026-09-10.

**Fix direction:** Decide which key is canonical, use it in both places, and guard the lookup so a nil judge cannot adopt an existing anonymous row.

---

## P2 — Test coverage

- Add `test/controllers/cases_controller_test.rb` — HTML **unarchive** authorization test (`archive` already has coverage at lines 68-84; `unarchive` has no test at all)

---

## P3 — Security & consistency

### Proxy `proxy_debug` boolean parsing

**Location:** `app/controllers/proxy_controller.rb:26`

Uses `'true' == params[:proxy_debug]` instead of `deserialize_bool_param`. Low real-world impact.

---

### Proxy URL parsing bug

**Location:** `app/controllers/proxy_controller.rb:75-80` (`extract_extra_url_params`)

Manual `split('?')` / `split('=')` only captures the first embedded query param (e.g. loses `rows` from `?q=test&rows=10`).

Fix together with URL extraction deduplication below.

**Recommendation:** Cherry-pick `UrlParserService` from `origin/deangularjs-experimental` (commit `db1c4e50`) as its own small PR rather than reimplementing from scratch. That branch is a 1092-file, big-bang AngularJS→Rails rewrite that changed core architecture (server-side search execution, two-tier scoring, dropped/relocated features) — almost certainly why it was never merged, since it conflicts with this project's incremental per-surface migration strategy (see `angular-case-migration` skill). But `UrlParserService` itself is small, self-contained, and clean: wraps `Addressable::URI` (already a `Gemfile` dependency — no new gem needed), has 9 focused unit tests, and its `query_values` method fixes exactly this bug. Note that branch's `ProxyController` still had the CSRF-skip issue above — that fix wasn't part of the same effort and needs doing separately regardless.

---

### URL parameter extraction duplication

**Locations:** `proxy_controller.rb`, `api/v1/search_endpoints/validations_controller.rb`, `application_helper.rb` (`get_protocol_from_url`)

Overlapping parse logic. Same fix as "Proxy URL parsing bug" above — `UrlParserService` (cherry-picked from `deangularjs-experimental`) was purpose-built as the shared helper for exactly these three call sites (per its own docstring); use it here too rather than writing a separate helper.

---

## P3 — Code quality

### BookImporter: replace the mass-assignment denylists with allowlists

**Location:** `app/services/book_importer.rb` — `UNASSIGNABLE_JUDGEMENT_KEYS`, `UNASSIGNABLE_QUERY_DOC_PAIR_KEYS`

Both `Judgement` and `QueryDocPair` are updated from an uploaded file via `assign_attributes(attrs.except(...))`. The `except` lists were built by hand and have twice needed a same-day patch: `:judgement_id` for `Judgement` (the judgements-API export emits it, and it isn't a real attribute, so it raised `UnknownAttributeError`) and `:book_id`/`:id` for `QueryDocPair` (a crafted value let one authenticated user write, or move, a query_doc_pair into another user's book — closed as a stopgap on 2026-09-10, reproduction is in this branch's history). Two escapes from small denylists in one review pass is the argument that a denylist can't converge here — the next producer to add a column or export a new key reopens the same class of bug.

**Fix direction:** Replace both `.except(...)` calls with `.slice(...)` **allowlists** — `QueryDocPair`: `query_text`, `doc_id`, `position`, `document_fields`, `information_need`, `notes`, `options`; `Judgement`: `rating`, `unrateable`, `judge_later`, `explanation`. This also converts "unexpected key crashes the import job" into a silent no-op, closing the judgements-export entry above for free. Bigger change than the stopgap — touches every assign path in the importer and needs its own test pass — hence P3, not urgent.

---

### Dead code: `ScoresController#set_score`

**Location:** `app/controllers/scores_controller.rb:24-26`

Defined but unused (no `before_action`). Safe to delete.

---

### Unsafe integer coercion in snapshot search

**Location:** `app/controllers/api/v1/snapshots/search_controller.rb:45-46`

`params[:rows].to_i` / `params[:start].to_i` without validation; non-numeric strings coerce to `0`.

---

### Predicate method naming

**Location:** `app/models/selection_strategy.rb`

Rename `user_has_judged_all_available_pairs?` → `user_judged_all_available_pairs?` (style-only; project convention — see `credentials?` vs `has_credentials?` in CLAUDE.md, already followed by `HttpClientService#credentials?`).

**Also found:** `every_query_doc_pair_has_three_judgements?` (same file, line 56) has the same `has_` prefix. Different grammatical shape though — it's "has N of a noun" (a count check), not "has verbed" (where the participle alone already reads as a fine predicate, as in `judged`). Dropping `has_` here reads badly (`every_query_doc_pair_three_judgements?`); it would need a rephrase (e.g. `every_query_doc_pair_judged_three_times?`) rather than a straight deletion. Worth a call when touching this file rather than bundling blindly with the first rename.

---

### BookImporter: unsaved records aren't reported back to the user

**Location:** `app/services/book_importer.rb` — `import_query_doc_pairs`, `import_all_judgements`, `import_judgement`, `upsert_nested_query_doc_pair`

None of these check the return value of `qdp.save` / `judgement.save`. If a row fails validation during an "add more data" import (`Books::ImportController#update`), it's silently dropped — `ImportBookJob` still clears `book.import_job` and reports success, with no indication some rows didn't make it in. Pre-existing gap (the original code didn't check `.create`'s success either), just calling it out now that this path is being hardened for repeated/production re-imports. Fixing it well means deciding how partial failures should surface to the user (job status field? notification?) — a small design call, not a drive-by fix.

---

### BookImporter: judge identifiers `validate` doesn't check import silently as anonymous

**Location:** `app/services/book_importer.rb` — `find_judgement_user`, `validate`, `emails_of_judges`

`#validate` pre-checks judgement `user_email`s against existing users and refuses the import with "User with email '...' needs to be migrated over first." (or invites them, under `force_create_users`). Two identifiers `find_judgement_user` honours slip past it entirely, and both degrade to an unattributed judgement with no warning:

1. **`user_id`** is never validated at all. A payload naming a `user_id` that doesn't exist in this instance imports anonymous — and `app/views/books/import/edit.html.erb` documents `user_id` as *the* judge identifier for `all_judgements`, while row ids never survive a cross-instance export, so this is the routine case rather than an exotic one.
2. **`:email` on a *nested* judgement** — `emails_of_judges` reads only `judgement[:user_email]` in the `query_doc_pairs` branch, while the `all_judgements` branch reads `user_email || email` and `find_judgement_user` accepts either. So `{"rating":1.0,"email":"nobody@example.com"}` nested under a pair skips both the migration error and the `force_create_users` invite.

Not a regression — before the 2026-09-10 fix these were silently attributed to whichever nil-email AI-judge user the database returned first, which was worse — but all the identifier paths should fail the same way.

**Fix direction:** Have `emails_of_judges` read `user_email || email` in both branches, and have the `validate` pass collect `user_id`s alongside emails so an id that doesn't resolve is treated like an unknown email rather than degrading to anonymous in silence.

---

## P2 — Performance

### Potential N+1 queries

1. **`app/controllers/cases_controller.rb:32`** — `includes(:owner, :teams, scores: :user).distinct`; scores accessed later may still N+1.
2. **`app/controllers/teams_controller.rb:248`** — `includes(:owner, :teams)`; missing `scores` if the view touches them.
3. **`app/controllers/api/v1/cases_controller.rb:192`** — watch for extra associations in serializers beyond `preload(:tries, :teams, :cases_teams)`.

Bullet is enabled in dev/test — fix as surfaced; review views for missing eager loads.

---

## RuboCop deferrals

Inline `rubocop:disable` only on this branch (no config-level excludes). Search codebase for `rubocop:disable` for the full list.

### Metrics/ParameterLists

- `Case#clone_case` — `app/models/case.rb:124`
- `MapperWizardState#store_fetch_result` — `app/models/mapper_wizard_state.rb:58`
- `HttpClientService#initialize` — `app/services/http_client_service.rb:32`

### Complex methods (Metrics/*)

Candidates for extraction into smaller methods or services:

- `FetchService` — `app/services/fetch_service.rb`
- `Api::V1::Import::RatingsController#create`
- `Api::V1::Export::RatingsController`
- `Api::V1::Snapshots::SearchController`
- `BookImporter` / `RatingsImporter`
- `MapperWizardsController`
- `TeamsController` / `BooksController` / `HomeController`

---

## P2 — Stimulus HTTP infra follow-ups (hybrid migration)

Shared `apiFetch` / `getQuepidRootUrl()` landed on `main` (see [DEVELOPER_GUIDE § Stimulus HTTP conventions](../DEVELOPER_GUIDE.md#stimulus-http-conventions)). Remaining consistency work:

### `bulk_judgement` — server-owned URLs

**Location:** `app/javascript/controllers/bulk_judgement_controller.js`, `app/views/bulk_judge/new.html.erb`

Still builds `` `books/${bookId}/judge/bulk/save` `` / `delete` in JS. Pass `saveUrl` and `deleteUrl` from ERB via `data-*-url-value` (same pattern as `mapper_wizard`).

---

### Import case API — return `redirect_url`

**Location:** `app/controllers/api/v1/import/cases_controller.rb`, `import_case_controller.js`

Post-import navigation still built client-side: `` `${getQuepidRootUrl()}/case/${result.case_id}` ``. When touching the import API, return `redirect_url` from `case_core_url` in JSON and drop client path construction.

---

### Remaining inline CSRF controllers

Migrate to `apiFetch` when touched: `confirm_delete_controller.js` (form submit — keep as-is unless moving to fetch).

**Also:** add `data-quepid-root-url` to `analytics.html.erb` if that layout ever loads Stimulus HTTP code.

---

## P2 — match-explain Stimulus controller follow-ups

From the match/explain popover + Debug/Expand modal migration (`match_explain_controller.js`, `utils/json_explorer.js`, `searchResult.js#matchExplainData`). Not blocking — flagged during review, deliberately deferred rather than fixed inline.

### Eager per-digest computation undoes the deleted code's lazy-compile optimization

**Location:** `app/assets/javascripts/controllers/searchResult.js` (`matchExplainData`), `app/assets/templates/views/searchResult.html`

`matchExplainData()` is bound via Angular interpolation (`data-match-explain-data-value="{{ matchExplainData() | json:0 }}"`), so it runs on every digest for every visible search-result row — including `explain.toStr()`/`explain.rawStr()` (memoized inside splainer-search, cheap after the first call) and `JSON.stringify(explain.asJson, null, 2)` (**not** memoized anywhere, re-stringified every digest). Only `hots`/`hasChildren`/`docScore` are needed for the always-visible chip+bars; the deleted `quepidPopover.js` had an explicit comment for why the rest was deferred: *"Compile lazily on first show — rating rows mount this on every result but most popovers are never opened."* That optimization is gone.

**Fix direction:** Split `matchExplainData()` into an eager piece (`hots`, `hasChildren`, `docScore`) and a piece computed only when the popover/Debug/Expand modal is actually opened (e.g. a second data attribute populated lazily on first popover show, or a dedicated event the Stimulus controller dispatches back to Angular on click). Likely not worth doing in isolation — revisit as part of the live query-state phase, where `searchResult`'s digest cost is already in scope.

---

### `json_explorer.js` doesn't escape object/array keys

**Location:** `app/javascript/utils/json_explorer.js` (`parseChildren`)

Faithfully ports the vendored `ng-json-explorer` Angular directive's own pre-existing gap: leaf string/number/boolean values are escaped, but a key name is inserted into the tree HTML raw. Unlike the vendor file, this is new code fully under our control — worth closing (`escapeHtml(key)`) next time this file is touched. Low real-world risk: reachable key names come from the search engine's explain payload or admin-configured field specs, not raw end-user input.

Same file, lower priority: a `parseValue`/`parseChildren` entry for an `undefined` value renders a stray `<li>,</li>` instead of omitting the `<li>` entirely (the vendor's `if`/`else if` chain with no final `else` just skips it). Unreachable in practice — input always comes from `JSON.parse`, which never produces `undefined` — but worth matching exactly if this file is revisited.

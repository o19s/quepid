# Todo

**Last updated:** 2026-09-09

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

### Judgement rating not validated against book's scale (outside AI judging)

**Observed:** `Judgement#rating` only validates presence, never that the value is actually one of the book's configured scale values. `Api::V1::JudgementsController#update`, `JudgementsController`, and `BulkJudgeController#save` (`judgement.rating = params[:rating]`, no scale check) all write a client-supplied rating with no scale check — they're only "safe" today because the judging UI happens to render buttons limited to the book's actual scale values; nothing stops a raw form/API POST from bypassing that. The AI-judging path (`app/jobs/run_judge_judy_job.rb`, hardened in `37840b47`) is the only one with a guard, and it's job-local.

**Cause:** No model-level validation ties `Judgement#rating` to `query_doc_pair.book.scale`.

**Audit result (done):** Two call sites *legitimately* write ratings outside the discrete scale, both gated on `book.support_implicit_judgements?`:
- `BooksController#combine` (`app/controllers/books_controller.rb:277`) averages two existing ratings — `(judgement.rating + j.rating) / 2` — and explicitly skips rounding when `support_implicit_judgements` is true (e.g. `(0+3)/2 = 1.5` on a `[0,1,2,3]` scale).
- `JudgementFromRatingJob#perform` (`app/jobs/judgement_from_rating_job.rb:24`) copies a case-level `Rating#rating` straight into `judgement.rating` via `judgement.save!` (raises on failure) — that value comes from the case's scorer scale, which has no guaranteed relationship to the book's judgement scale.

`BookImporter`/`RatingsImporter` are fine: `RatingsImporter` writes the unrelated `Rating` model, and `BookImporter#import_judgement` already silently no-ops on failed saves.

**Fix direction:** Add an `inclusion` validation on `Judgement` scoped to `query_doc_pair.book.scale`, conditioned `unless: -> { query_doc_pair&.book&.support_implicit_judgements? }` (safe-navigate — `query_doc_pair` is a required `belongs_to` but its own presence validation runs independently, so a blank `query_doc_pair` must not blow up this lambda with a `NoMethodError`) so the two legitimate continuous-rating paths above stay unaffected. Change `JudgementFromRatingJob` to `save` + handle a validation failure instead of `save!` (a case rating can legitimately be off-scale for an explicit-only book). Retire the job-local check in `run_judge_judy_job.rb` in favor of the model validation (catch the failure, call `mark_unrateable`).

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


# DRY Opportunities Across the Codebase

A whole-codebase audit (Ruby backend, modern JS, legacy AngularJS, views/config) for
duplicated or near-duplicated logic worth consolidating. Findings are grouped by area
and ranked by impact within each area. File:line references were verified against the
codebase as of 2026-09-03 — re-check before acting, since line numbers drift.

This is a findings document, not a commitment to do the work. Treat "High" items as
good candidates for a focused cleanup PR; "Low" items as opportunistic fixes when
already touching that code.

Each item now also carries a **Pragmatic priority** line — a working engineer's call
on whether this is actually worth doing given effort vs. payoff, not just theoretical
impact. Scale: **Do now** (cheap, low-risk, clear payoff — don't overthink it),
**Soon** (real win, worth a dedicated small PR), **Opportunistic** (fine to leave
alone, fix when you're already in the file), **Bundle** (not worth doing standalone —
folds into another item's fix), **Skip** (cost/risk isn't justified right now, often
because the code is migration-doomed or the "fix" would be riskier than the
duplication).

## How to use this doc

- Items tagged **migration-doomed** live in code the `angular-case-migration` effort
  is actively replacing — don't invest in refactoring them, but the pattern they
  describe may be useful context when building the Stimulus replacement.
- Items tagged **real bug** or **drift** indicate the duplication has already caused
  (or is close to causing) an actual behavioral inconsistency, not just extra typing.

---

## 1. Ruby / Rails Backend

### High impact

1. **`render json: {message/error: "X not found!"}, status: :not_found` reimplemented ~20 times**
   instead of a shared helper. Concerns `current_case_manager.rb:53-55`,
   `current_book_manager.rb:18-20`, `current_team_manager.rb:13-15`,
   `current_query_manager.rb:17-19` each define their own `check_x`; controllers
   including `query_doc_pairs_controller.rb:125-127`, `judgements_controller.rb:132-134`,
   `users_controller.rb:40`, `search_endpoints_controller.rb:138`,
   `team_scorers_controller.rb:18`, `scorers_controller.rb:157`,
   `snapshots_controller.rb:84-86`, `queries_controller.rb:91`,
   `team_cases_controller.rb:21`, `books_controller.rb:75`, `tries_controller.rb:146`,
   `team_members_controller.rb:21`, `annotations_controller.rb:57`,
   `clone/tries_controller.rb:44` hand-roll the same pattern with inconsistent
   `message` vs `error` JSON keys and wording.
   - **Fix**: `render_not_found_unless(record, resource_name)` helper on
     `Api::ApiController`, or a `Findable` concern that generates `set_x`/`check_x`
     from a model/param name. Standardize the JSON error key.
   - **Pragmatic priority — Do now:** mechanical, no behavior risk beyond a JSON key
     rename (which is arguably a client-facing break, so grep the frontend for
     `.error`/`.message` usage on 404s before standardizing). Highest call-site count
     in the doc — do this before anything else in Ruby.

2. **`deserialize_bool_param` and `signup_enabled?` duplicated** between
   `application_controller.rb:34-40` and `api/api_controller.rb:38-46` — the two
   controller base classes share no common ancestor. `deserialize_bool_param` alone
   is called 24+ times downstream (`teams_controller.rb`, `bulk_judge_controller.rb`,
   `books_controller.rb`, `api/v1/cases_controller.rb`, etc.), so any bug fix has to
   be applied twice.
   - **Fix**: Extract both into a shared concern included by both base classes.
   - **Pragmatic priority — Do now:** textbook extract-a-concern, zero semantic
     change, and it closes off the "fixed it in one place, forgot the other" failure
     mode this doc is explicitly warning about. Do this alongside #1.

3. **Explicitly self-flagged duplicate export logic** — `books/export_controller.rb:11-27`
   carries the comment `# WARNING books/export_controller.rb and
   api/v1/export/books_controller.rb ARE DUPLICATED`, and `api/v1/export/books_controller.rb:26-45`
   is the twin, including an identical private `track_book_export_queued`. The two
   have already drifted (HTML version unconditionally purges the export file, API
   version doesn't). **(drift)**
   - **Fix**: Extract a `Books::Exportable` concern or `BookExportRequester` service;
     let the two controllers differ only in response format.
   - **Pragmatic priority — Soon:** the code itself is begging for this fix (literal
     `WARNING` comment) and the purge-file discrepancy is a real, currently-live
     inconsistency, not a hypothetical one. Worth a dedicated small PR — first decide
     which purge behavior is actually correct before merging the two, since that's a
     product decision, not just a refactor.

4. **`RatingsGenerator` and `SnapshotGenerator` are ~90% identical** —
   `app/services/ratings_generator.rb` and `app/services/snapshot_generator.rb` share
   identical constructors, `show_progress?`, and the same
   `fetch_enough_docs_for_sample_words → generate_word_list → generate_query_list →
   fetch_results_per_query` pipeline, differing only in a small per-doc step
   (random rating vs. position-within-group).
   - **Fix**: Extract a shared base class holding the pipeline; subclasses/blocks
     supply only the per-doc transform.
   - **Pragmatic priority — Soon, but size it as its own PR:** good ROI long-term
     (one pipeline to test/fix instead of two), but it's a real design change to a
     background-job pipeline, not a copy-paste dedup — budget time for testing both
     generators' output stays identical, don't fold it into a bigger cleanup PR.

5. **`set_book` duplicated byte-for-byte in 3 controllers**, with a 4th
   near-duplicate in a concern: `books_controller.rb:444-447`,
   `books/import_controller.rb:102-105`, `api/v1/books_controller.rb:69-72` (all
   identical `@book = current_user.books_involved_with.where(id: params[:id]).first`
   + `TrackBookViewedJob.perform_later`), vs.
   `concerns/authentication/current_book_manager.rb:9-12` (same, keyed on
   `params[:book_id]`).
   - **Fix**: Parameterize the concern's `set_book(param_key:)` and have all four
     controllers include it instead of redefining locally.
   - **Pragmatic priority — Do now:** small, mechanical, and the four copies are
     already byte-identical modulo one param key — about as safe a refactor as exists.

### Medium impact

6. **Hand-rolled `LIKE`-based search filters** repeated across 13+ controllers
   (`cases_controller.rb:21-22`, `books_controller.rb:40-41`,
   `query_doc_pairs_controller.rb:16`, `judgements_controller.rb:171`,
   `scorers_controller.rb:24`, `search_endpoints_controller.rb:21`,
   `ratings_controller.rb:13`, `teams_controller.rb:223,244,257,264,274,407,415,425`,
   `admin/announcements_controller.rb:10`, `admin/users_controller.rb:20`,
   `bulk_judge_controller.rb:28`) — each writes its own wildcard-wrapping and
   presence guard.
   - **Fix**: A `Searchable` concern/scope (`scope :search, ->(term, *columns) {...}`).
   - **Pragmatic priority — Soon, but slice it:** real win given the call-site count,
     but 13+ controllers means 13+ places where "same shape" might hide a subtle
     column-set or SQL-injection-guard difference — migrate one controller at a time
     behind existing request specs rather than one big-bang PR.

7. **`Scorer#for_user` reimplements `ForUserScope`** instead of using the shared
   concern (`concerns/for_user_scope.rb:6-11`, used by `Case`/`Book`/`SearchEndpoint`)
   because it needs an extra `.or(communal)` clause (`models/scorer.rb:50-55`),
   leading to a divergent join style.
   - **Fix**: Extend `ForUserScope` to accept an optional extra scope.
   - **Pragmatic priority — Soon:** small, isolated, and prevents `Scorer` drifting
     further from the shared scope's semantics as `ForUserScope` evolves elsewhere.

8. **`TeamCasesController` / `TeamScorersController`** reimplement the same
   "share/unshare resource with team" pattern (`api/v1/team_cases_controller.rb:15-45`,
   `api/v1/team_scorers_controller.rb:11-35`, read-only subset in
   `api/v1/team_books_controller.rb:1-14`).
   - **Fix**: A `TeamAssociable` concern parameterized by association name, or a
     `TeamResourceSharer` service.
   - **Pragmatic priority — Soon:** good long-term consolidation, especially since it
     pairs naturally with Views #2/#9 and JS #1 (same "share with team" concept
     top-to-bottom of the stack) — worth scoping as part of that bigger effort rather
     than in isolation.

9. **`ScorersController#share`/`#unshare` ~90% duplicated**, and its `update`/`destroy`
   separately repeat the same communal-admin guard (`scorers_controller.rb:98-155`,
   `157-178`).
   - **Fix**: Extract the common lookup/guard into a private method or before_action.
   - **Pragmatic priority — Opportunistic:** single file, low blast radius — fine to
     fold into #8 if you're touching sharing logic anyway, not worth its own PR.

10. **`BookImporter` / `CaseImporter`** duplicate "create missing users during import"
    logic (`services/book_importer.rb:10-23,31-50`, `services/case_importer.rb:6-19,36-44`)
    — same constructor option defaults and the same
    `force_create_users ? User.invite! : errors.add(...)` block.
    - **Fix**: Shared `ImportUserResolver#ensure_users_exist!` or a `BaseImporter` parent.
    - **Pragmatic priority — Opportunistic:** worth doing, but import code touches
      user invitations (side effects that are annoying to test and easy to
      double-trigger) — only take this on when already deep in one of the two
      importers, with good test coverage around the invite path first.

11. **Progress-percent + Turbo broadcast pattern** duplicated verbatim between
    `services/book_importer.rb:79-95` and `jobs/populate_book_job.rb:33-92` (same
    `percent = (((total - counter).to_f / total) * 100).truncate` formula and
    last-percent bookkeeping), with the broader "wrapper around
    `Turbo::StreamsChannel.broadcast_render_to`" shape recurring in
    `jobs/run_case_evaluation_job.rb:92-108`, `jobs/run_judge_judy_job.rb:59-84`,
    `services/ratings_manager.rb:105-116`.
    - **Fix**: A `ProgressBroadcaster` helper (`broadcast_percent_progress(...)`).
    - **Pragmatic priority — Opportunistic:** touches five live, user-facing progress
      UIs at once — real risk of a subtle regression (e.g. an off-by-one in "last
      percent broadcast" suppressing an update) for a purely cosmetic win. Only worth
      it bundled with other work in that area, with manual verification of each
      progress bar afterward (see `docs/manual-testing/`).

### Low impact

12. `owned` flag computed independently (and inconsistently nil-guarded) in 4 jbuilder
    templates — `api/v1/cases/_case.json.jbuilder:13`,
    `api/v1/cases/dropdown/index.json.jbuilder:7`,
    `api/v1/scorers/_scorer.json.jbuilder:13`,
    `api/v1/export/cases/_case.json.jbuilder:4`. Add `owned_by?(user)` on the models.
    - **Pragmatic priority — Opportunistic:** cheap, safe, but purely cosmetic —
      grab it next time you're editing one of these four files.

13. `TeamsController` has a generic `rescue_from ActiveRecord::RecordNotFound`
    (`teams_controller.rb:6-10`) that sibling HTML controllers like `ScorersController`
    don't use, hand-rolling `unless record ... flash ... redirect` instead
    (`scorers_controller.rb:76-79,102-104,132-134`). Promoting the rescue_from to
    `ApplicationController` would shrink several controllers.
    - **Pragmatic priority — Opportunistic:** legitimate cleanup, but changes
      user-visible error handling (redirect + flash vs. a rescue_from response) across
      several controllers — verify the flash copy/redirect target stays equivalent
      before promoting it globally.

14. `query_text` presence/length validation duplicated verbatim in `models/query.rb:45`
    and `models/query_doc_pair.rb:39`. Minor — a shared constant would do.
    - **Pragmatic priority — Skip (for now):** two lines, two files — a shared
      constant is barely less code than the duplication itself. Fine to leave until
      the validation rule actually needs to change.

**Already done well**: `JsonFormatValidator` is consistently reused across `Query`,
`Case`, `QueryDocPair`, `SearchEndpoint`, `MapperWizardState`; the `cases/_case` and
`_snapshot` jbuilder partials are properly shared across actions rather than rebuilt.

---

## 2. Modern JS Frontend (`app/javascript/`)

### Medium-high impact

1. **Import controllers duplicate file-read/loading/alert boilerplate.**
   `readFileAsText` (`import_case_controller.js:85-92` vs.
   `import_snapshot_controller.js:213-220`), `setLoading`
   (`:94-103` vs. `:222-231`), and `showAlert`/`hideAlert` (`:105-113` vs. `:233-241`)
   are byte-for-byte identical in both files.
   - **Fix**: Extract to `utils/file_import.js` (or a shared base controller).
   - **Pragmatic priority — Soon:** only two files, byte-identical, cheap to extract
     and test in isolation. Good small follow-up PR.

### Medium impact

2. **Raw `fetch()` with manual CSRF handling bypasses `api/fetch.js`.**
   `import_snapshot_controller.js:193-211` manually reads
   `document.querySelector('meta[name="csrf-token"]').content` (no optional
   chaining — throws if the tag is missing) instead of using the project's
   `apiFetch`/`getCsrfToken()`, which its sibling `import_case_controller.js:53`
   already uses correctly. `confirm_delete_controller.js:72` is a third independent
   CSRF-token lookup (arguably legitimate since it's a plain form POST).
   - **Fix**: Use `apiFetch` in `sendSnapshotToAPI`; have `confirm_delete_controller.js`
     import `getCsrfToken()` from `api/fetch.js`.
   - **Pragmatic priority — Do now:** this is an actual crash bug waiting for a page
     where the meta tag is missing/stale, and the fix is a one-line swap to an
     already-proven helper. Don't let this sit under "medium impact" — it's cheap and
     it's a real bug.

3. **Bootstrap Modal boot-strapping duplicated with inconsistent guards.**
   `confirm_delete_controller.js:40-49`, `document_fields_modal_controller.js:26-27`
   (no guard at all — a latent bug), `share_case_core_controller.js:116-118` each
   access `window.bootstrap.Modal` differently.
   - **Fix**: `utils/bs_modal.js` mirroring the existing `utils/bs_tooltip.js` pattern.
   - **Pragmatic priority — Soon:** the unguarded case is a latent bug (throws if
     `window.bootstrap` isn't loaded yet), and there's already a proven pattern
     (`utils/bs_tooltip.js`) to copy — low effort, real payoff.

4. **`showStatus`/alert-style helpers reimplemented per-controller** instead of one
   shared flash utility: `import_case_controller.js:105-113`,
   `import_snapshot_controller.js:233-241`, `mapper_wizard_controller.js:512-527`
   (auto-hide after 5s), `bulk_judgement_controller.js:219-269` (auto-hide after 2s,
   with a "still current" guard the others lack), `share_case_core_controller.js:458-469`.
   Auto-hide timing and the "is the text still what I set" race-guard are
   reinvented differently in each. **(drift)**
   - **Fix**: `utils/status_message.js` exporting `showStatusMessage(el, {message,
     variant, autoHideMs})`.
   - **Pragmatic priority — Soon:** the missing race-guard in most copies is a real
     (if minor) UX bug — a slow response can stomp a later status message. Worth a
     dedicated small PR; pick `bulk_judgement_controller.js`'s guard as the standard
     since it's the most correct of the five.

### Low-medium impact

5. **Clipboard-copy-with-fallback duplicated with inconsistent robustness.**
   `invite_controller.js:6-35` has a full fallback path
   (`navigator.clipboard` → `execCommand('copy')`); `mapper_wizard_controller.js:484-509`
   only supports `navigator.clipboard.writeText`, no fallback. Both separately
   reimplement "swap button content for N ms then restore."
   - **Fix**: `utils/clipboard.js` (`copyToClipboard`, `flashButtonFeedback`).
   - **Pragmatic priority — Opportunistic:** the missing fallback is a real gap
     (older browsers / non-HTTPS contexts), but low traffic surface — fix when
     next touching either controller rather than as standalone work.

6. **Manual debounce-timer bookkeeping** reimplemented in
   `team_member_autocomplete_controller.js:30,36-37,44,52-55,171-176` and
   `bulk_judgement_controller.js:9,12-16,126-128,134` — same declare-in-connect /
   clear-in-disconnect / clear-then-reschedule shape.
   - **Fix**: `utils/debounce.js`.
   - **Pragmatic priority — Opportunistic:** only two call sites, working correctly
     today — nice-to-have utility, not worth a dedicated PR on its own.

### Low impact

7. Leftover `console.log("X controller connected")` debug lines in 4 controllers
   (`import_case_controller.js:9`, `import_snapshot_controller.js:7`,
   `mapper_wizard_controller.js:48`, `prompt_form_controller.js:7`) — just remove.
   - **Pragmatic priority — Do now:** literally a four-line delete with zero risk —
     no reason this should wait for a "cleanup PR," just do it in the next commit
     that touches any of these files (or as a standalone one-liner PR today).

8. Test files hand-build `Object.create(Controller.prototype)` stub controllers
   with manually-assigned `hasXTarget`/`xTarget` pairs in 4+ spec files
   (`share_case_controller.test.js:4-30`, `import_case_controller.test.js:9-21`,
   etc.) — a shared `buildStubController` test helper would reduce boilerplate.
   Test-only, optional polish.
   - **Pragmatic priority — Skip (for now):** test-only boilerplate, no production
     risk, no behavioral payoff. Note this got *worse*, not better, when the
     share-modal controller consolidation landed: it added 3 more copies of this
     exact stub-building pattern (`share_book_controller.test.js`,
     `share_scorer_controller.test.js`, `share_search_endpoint_controller.test.js`)
     rather than factoring it out, since that PR was scoped to the controllers
     themselves. Slightly higher-value than before; still optional.

**Already done well**: `utils/share_case_teams.js`, `utils/bs_tooltip.js`,
`utils/count_up.js`, `utils/text_paste.js`, and `api/fetch.js` are good examples of
small, tested, documented modules. The share-modal controllers (formerly the top
finding in this section) now join that list: `share_book_controller.js`,
`share_scorer_controller.js`, and `share_search_endpoint_controller.js` have been
ported onto `utils/share_case_teams.js` and Stimulus targets, matching
`share_case_controller.js`.

---

## 3. Legacy AngularJS (`app/assets/javascripts/`) — migration-doomed, treat as low-priority

This code is being actively replaced by the `angular-case-migration` effort. Findings
below are informational except where they represent a **real bug** or **drift** in
long-lived code that won't be migrated soon.

### Worth fixing now

1. **Real bug from copy-pasted resolve boilerplate** — `import_ratings_controller.js:23-36`
   has `queriesSvc: function () { return flash; }` (should return a queriesSvc
   reference, not `flash`). Currently harmless only because the consuming controller
   never injects it, but it's a landmine. **(real bug)** — cheap one-line fix.
   - **Pragmatic priority — Do now:** a genuine bug, one line, zero migration risk —
     fix it regardless of what else happens to this file. The kind of thing that
     costs someone an hour of confused debugging later if left alone.

2. **`searchEngine === 'es' || searchEngine === 'os'` duplicated 5x, already drifted.**
   `wizardModal.js:749`, `queryParams.js:54`, `services/queriesSvc.js:200,802` check
   only `'es'`/`'os'`; `settings.js:70` also includes `'vectara'`/`'algolia'` — so
   newer search engines are silently excluded from JSON-DSL logic in three files.
   **(drift, real bug)**
   - **Fix**: A single `searchEndpointSvc.usesJsonQueryParams(searchEngine)` predicate.
   - This is in `queriesSvc`/`settingsSvc`/wizard code, not imminently migrated —
     worth fixing.
   - **Pragmatic priority — Do now:** this is silently breaking JSON-DSL support for
     any customer on Vectara/Algolia today — it's a live product bug wearing a
     "duplication" costume, not a style nit. Fix ahead of any migration-doomed
     bucketing.

3. **`qscore_query_controller.js` and `qscore_case_controller.js` are ~95% identical**
   (68 lines each) — identical `getScoreFromScorable()`, `updateScore()`, and
   `$watchGroup` logic; only the templates differ meaningfully. Core score-display
   UI, likely to persist a while.
   - **Fix**: Merge into one component with an optional `showGraph`/`showLabel`
     binding, or extract the shared logic into `qscoreSvc` (already injected by both).
   - **Pragmatic priority — Opportunistic:** no bug, no drift — just duplication in
     code that's a migration candidate itself. Worth the `qscoreSvc` extraction only
     if you're already in this file for the Stimulus port; not worth a standalone
     Angular-side PR.

### Informational (migration will likely delete this code)

4. `$quepidModal.open()` + `.result.then()` launcher boilerplate repeated in 9
   components (`export_case`, `clone_case`, `delete_case_options`, `query_options`,
   `diff`, `query_explain`, `frog_report`, `move_query`, `judgements` controllers) —
   root cause of finding #1. **(migration-doomed)**
   - **Pragmatic priority — Skip:** don't refactor Angular code that's being deleted;
     keep this pattern in mind as the shape of the future Stimulus "modal-launch"
     controller instead.

5. `ctrl.cancel = function () { $quepidModalInstance.dismiss('cancel'); }` duplicated
   ~21 times across every modal-instance controller. **(migration-doomed)**
   - **Pragmatic priority — Skip:** same reasoning as #4 — migration will delete this
     wholesale.

6. Rating-scale watch/setup logic duplicated across `searchResults.js:86-138`,
   `docFinder.js:129-165`, `searchResult.js:13-18` — same
   `rateBulkSvc.setScale`/`handleRatingScale` + manual doc-id collection. Core UI,
   not imminently migrated; worth a `rateBulkSvc.bulkRate/bulkReset` extraction if
   anyone is in this code anyway.
   - **Pragmatic priority — Opportunistic:** no bug, core UI with no near-term
     migration date — fine to leave alone, do the extraction only incidentally while
     touching rating-scale code for a feature reason.

7. Duplicate array-containment helper in `services/caseSvc.js:529-533`
   (`listContainsCase`) and `services/bookSvc.js:26-28` (`contains`) — same
   "does list already have this id" filter. Low priority.
   - **Pragmatic priority — Skip:** trivial, no bug, in migration-adjacent code —
     not worth the diff.

8. Dead `'caseUpdate'` broadcast event (`services/caseSvc.js:410`) with no listener
   anywhere — a symptom of event names being magic strings with no shared registry.
   Low priority, cheap to add a `broadcastSvc.EVENTS` map if touching this file.
   - **Pragmatic priority — Skip:** dead code, harmless — delete opportunistically,
     don't build a registry for a problem that's mostly theoretical at this point in
     the migration.

9. `delete_case_options_controller.js:27-64` repeats the same
   "call promise, on success set flash+navigate, on failure build message" shape 3x
   with slightly drifted message text. Single file, low priority.
   - **Pragmatic priority — Skip:** single file, cosmetic message drift only — not
     worth touching migration-doomed code for this.

10. `factories/SettingsFactory.js` reimplements "find try by tryNo" 3 different ways
    (`:50-60`, `:88-90`, `:120`) instead of calling its own `getTry(tryNo)`. Cosmetic.
    - **Pragmatic priority — Skip:** cosmetic, migration-adjacent — leave it.

11. Nine parallel "case action" component trios (component + controller +
    modal-instance-controller) share identical scaffolding — the umbrella pattern
    behind findings #4-#5. **Not a refactor target** given imminent migration, but
    useful context: one generic "modal-launch" Stimulus controller could replace
    all nine when ported.
    - **Pragmatic priority — Skip (as Angular refactor); reference for the port:**
      don't touch the Angular side — treat this as the design spec for whatever
      Stimulus controller eventually replaces all nine.

---

## 4. Views, CSS, Config, E2E Tests

### High impact

1. **Page-header markup block repeated in 30+ view files**, verbatim class string
   `"d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center
   pt-3 pb-2 mb-3 border-bottom"` plus the same `<h1>` + `.btn-toolbar` wrapper shape.
   Confirmed in `books/index.html.erb:3`, `scorers/index.html.erb:1`,
   `search_endpoints/{index,new,edit}.html.erb`, `teams/{index,show,new}.html.erb`,
   `admin/users/{index,new,edit,show}.html.erb`, `query_doc_pairs/*.html.erb`,
   `books/{show,new,edit,export,judgement_stats}.html.erb`,
   `admin/announcements/{index,new,edit}.html.erb`, `ratings/index.html.erb`,
   `cases/index.html.erb`, `scores/index.html.erb`, `judgements/index.html.erb`,
   `mapper_wizards/show.html.erb`, `analytics/cases/duplicate_scores/show.html.erb`,
   `search_endpoints/{clone,show}.html.erb`, `bulk_judge/new.html.erb` (34 files total).
   - **Fix**: A `shared/_page_header` partial or `page_header(title:, &block)` helper.
   - The single largest duplication footprint in the view layer by file count.
   - **Pragmatic priority — Do now:** biggest file-count win in the doc for close to
     zero risk — it's pure markup with no logic branching. Mechanical, high-value,
     do it early to reduce noise in every other view PR that follows.

2. **Rails-scaffold `error_explanation` block duplicated in 13 files** —
   `admin/users/_form.html.erb:8-18`, `books/_form.html.erb:12-21`,
   `scorers/_form.html.erb:4-13`, `search_endpoints/_form.html.erb:4-13`,
   `query_doc_pairs/_form.html.erb:4-13`, `judgements/_form.html.erb`,
   `sessions/new.html.erb`, `users/invitations/edit.html.erb`, `profiles/show.html.erb`,
   `admin/announcements/{new,edit}.html.erb`, `books/import/{new,edit}.html.erb`.
   Some use the old `errors.full_messages.each`, others the newer
   `errors.each { |error| error.full_message }` — inconsistent even within the
   duplication.
   - **Fix**: `shared/_error_messages` partial taking `record:`/`subject:`; standardize
     on the newer Rails errors API while consolidating. Easy, low-risk win.
   - **Pragmatic priority — Do now:** exactly as the doc says — easy, low-risk, and
     it also cleans up an inconsistent Rails API usage as a free side effect. Good
     first PR for anyone new to the views layer.

### Medium impact

3. **Duplicate "Delete"/"Archive" confirm-button pattern** in 7 files
   (`books/edit.html.erb:5`, `scorers/edit.html.erb:5`, `query_doc_pairs/edit.html.erb:5`,
   `search_endpoints/edit.html.erb:5-6`, `admin/users/edit.html.erb`,
   `admin/announcements/edit.html.erb`, `scores/index.html.erb:73`) — same
   `button_to ... onclick: "return confirm('...')"` with hand-typed JS strings.
   - **Fix**: `destructive_button_to(label, path, entity_name, style:)` helper.
   - **Pragmatic priority — Soon:** small, low-risk, and standardizing the confirm
     copy is a minor UX win too — a good half-day PR, not urgent.

4. **Two parallel nav headers with a byte-identical admin dropdown** —
   `layouts/_header.html.erb:88-91` and `layouts/_header_core_app.html.erb:110-114`
   both render the same Admin Home/Users/Announcements/Job Manager sub-menu, and the
   full account dropdown (profile/logout/API docs) is duplicated across both files.
   - **Fix**: Extract `shared/_account_dropdown` (the parts with no
     Angular/Turbo-specific markup); keep the case/book dropdowns separate per the
     documented per-surface Angular/Rails parity convention.
   - **Pragmatic priority — Soon, but verify both surfaces visually:** worth doing,
     but this is exactly the kind of shared-header change that can silently break one
     surface while fixing the other (see the per-surface parity rule in
     `angular-case-migration`) — screenshot both nav headers before/after via
     Playwright MCP before calling it done.

5. **Generic Bootstrap modal shell duplicated across ~10 modal partials** — all
   `shared/_share_*_modal.html.erb` (5 files), `shared/_import_case_modal.html.erb`,
   `_import_snapshot_modal.html.erb`, `books/_unleash_modal.html.erb`,
   `judgements/_form.html.erb` repeat the same `.modal > .modal-dialog >
   .modal-content > .modal-header/.modal-body/.modal-footer` wrapper with an
   identical Cancel/`data-bs-dismiss` button. The five `_share_*_modal.html.erb`
   partials have since been unified in structure (Stimulus targets, consistent
   formatting) but still each hand-roll this same modal-shell wrapper — the
   `shared/_modal_shell` extraction below hasn't happened yet.
   - **Fix**: A `shared/_modal_shell` partial yielding body/footer content.
   - **Pragmatic priority — Soon:** the five share-modal partials are now
     consistent with each other, making them a clean first consumer for this
     extraction whenever someone picks it up — no longer needs to be bundled with
     a separate partial-consolidation PR since that part is already done.

### Low-medium impact

6. Layout `<head>` boilerplate (title, meta description, favicon, csrf_meta_tags)
   duplicated across `layouts/admin.html.erb:1-15`, `layouts/analytics.html.erb:1-14`,
   `layouts/core.html.erb:1-18`, and `layouts/application.html.erb:43-62`. The SEO
   description text has already drifted by one word between two of them. **(drift)**
   - **Fix**: `layouts/_head_meta` partial with overridable title/description.
   - **Pragmatic priority — Soon:** the SEO drift is real but harmless-ish; the
     partial is cheap and low-risk since only four layout files are involved — fine
     to knock out whenever someone's next in a layout file.

8. Footer copyright/OSC-link block duplicated between `layouts/_footer.html.erb:9-19`
   and `layouts/_footer_core_app.html.erb:4-9`. Extract `shared/_osc_copyright`.
   - **Pragmatic priority — Opportunistic:** two files, trivial, no risk — do it in
     passing, not worth a dedicated PR.

9. Routes: share/unshare sub-resource pattern expressed 3 different ways in
   `config/routes.rb` (cases/books/search_endpoints share one shape at
   `:153-159`/`:76-78`, scorers use a separate shape elsewhere) — not urgent, but
   would fall out naturally from fixing view finding #2.
   - **Pragmatic priority — Bundle:** don't touch routes standalone — let this
     normalize as a side effect of the #2/Ruby #8 "share with team" consolidation,
     where the route shape decision has to be made anyway.

**No significant findings**: CSS (`bootstrap5-compat.css`/`bootstrap5-add.css`
already went through a deliberate custom-property consolidation pass); Playwright
E2E specs already share `auth.setup.ts` and `angular_case_helpers.ts` rather than
duplicating login/setup boilerplate.

---

## Suggested priority order

If picking a small number of items to act on first:

1. **Ruby #1** (`render json: not_found` helper) and **Ruby #2**
   (`deserialize_bool_param`/`signup_enabled?`) — small, foundational, high call-site count.
2. **JS #1 / Views #2** (share-modal controllers + partials) — same root cause on
   both sides of the stack, already showing drift, and a shared utility
   (`utils/share_case_teams.js`) already exists to build on.
3. **Views #1** (page-header partial) — biggest file-count win in the views layer,
   very low risk.
4. **Legacy Angular #1 and #2** — the two legacy findings that are actual bugs/drift
   rather than just repetition, cheap to fix regardless of migration timeline.
5. Everything else — opportunistic, when already touching the relevant file.

This lines up with the per-item pragmatic calls above: everything in that ordered
list is tagged **Do now** or the paired **Do now** items above. If you only have
time for the "Do now" items across all four sections, that set is: Ruby #1, #2, #5;
JS #1, #3, #10; Views #1, #2, #3; and Legacy Angular #1, #2 — all cheap, low-risk,
and either foundational or an active bug fix.

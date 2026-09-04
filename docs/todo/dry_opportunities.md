# DRY Opportunities Across the Codebase

A whole-codebase audit (Ruby backend, modern JS, legacy AngularJS, views/config) for
duplicated or near-duplicated logic worth consolidating. Findings are grouped by area
and ranked by impact within each area. File:line references were verified against the
codebase as of 2026-09-03 — re-check before acting, since line numbers drift.

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
   - **Angular removal:** No — pure API controller/concern code, untouched by the
     Angular-to-Stimulus migration.

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
   - **Angular removal:** No — backend controller base classes only.

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
   - **Angular removal:** No — book export controllers, unrelated to the case-page
     migration.

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
   - **Angular removal:** No — backend job pipeline, no frontend surface at all.

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
   - **Angular removal:** No — book controllers, not part of the core case-page
     migration.

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
   - **Angular removal:** No — server-side search/filter logic, no Angular involvement.

7. **`Scorer#for_user` reimplements `ForUserScope`** instead of using the shared
   concern (`concerns/for_user_scope.rb:6-11`, used by `Case`/`Book`/`SearchEndpoint`)
   because it needs an extra `.or(communal)` clause (`models/scorer.rb:50-55`),
   leading to a divergent join style.
   - **Fix**: Extend `ForUserScope` to accept an optional extra scope.
   - **Pragmatic priority — Soon:** small, isolated, and prevents `Scorer` drifting
     further from the shared scope's semantics as `ForUserScope` evolves elsewhere.
   - **Angular removal:** No — model-level scope, unrelated to the frontend migration.

8. **`TeamCasesController` / `TeamScorersController`** reimplement the same
   "share/unshare resource with team" pattern (`api/v1/team_cases_controller.rb:15-45`,
   `api/v1/team_scorers_controller.rb:11-35`, read-only subset in
   `api/v1/team_books_controller.rb:1-14`).
   - **Fix**: A `TeamAssociable` concern parameterized by association name, or a
     `TeamResourceSharer` service.
   - **Pragmatic priority — Soon:** good long-term consolidation, and pairs naturally
     with the routes duplication (Views #8) — same "share with team" concept as the
     JS-controller/ERB-partial consolidation that already landed on the frontend
     side, just one layer down the stack.
   - **Angular removal:** No — API controllers only. Conceptually parallels the
     share-modal frontend consolidation (JS #3/#4, Views #5) but this item itself
     never touches AngularJS or the core case page.

9. **`ScorersController#share`/`#unshare` ~90% duplicated**, and its `update`/`destroy`
   separately repeat the same communal-admin guard (`scorers_controller.rb:98-155`,
   `157-178`).
   - **Fix**: Extract the common lookup/guard into a private method or before_action.
   - **Pragmatic priority — Opportunistic:** single file, low blast radius — fine to
     fold into #8 if you're touching sharing logic anyway, not worth its own PR.
    - **Angular removal:** No — `ScorersController` (Rails), not the core case page.

10. **`BookImporter` / `CaseImporter`** duplicate "create missing users during import"
    logic (`services/book_importer.rb:10-23,31-50`, `services/case_importer.rb:6-19,36-44`)
    — same constructor option defaults and the same
    `force_create_users ? User.invite! : errors.add(...)` block.
    - **Fix**: Shared `ImportUserResolver#ensure_users_exist!` or a `BaseImporter` parent.
    - **Pragmatic priority — Opportunistic:** worth doing, but import code touches
      user invitations (side effects that are annoying to test and easy to
      double-trigger) — only take this on when already deep in one of the two
      importers, with good test coverage around the invite path first.
    - **Angular removal:** No — backend import services.

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
    - **Angular removal:** No — backend jobs/services broadcasting via Turbo Streams,
      not AngularJS.

### Low impact

12. `owned` flag computed independently (and inconsistently nil-guarded) in 4 jbuilder
    templates — `api/v1/cases/_case.json.jbuilder:13`,
    `api/v1/cases/dropdown/index.json.jbuilder:7`,
    `api/v1/scorers/_scorer.json.jbuilder:13`,
    `api/v1/export/cases/_case.json.jbuilder:4`. Add `owned_by?(user)` on the models.
    - **Pragmatic priority — Opportunistic:** cheap, safe, but purely cosmetic —
      grab it next time you're editing one of these four files.
    - **Angular removal:** No — jbuilder JSON views, unrelated to the frontend
      migration.

13. `TeamsController` has a generic `rescue_from ActiveRecord::RecordNotFound`
    (`teams_controller.rb:6-10`) that sibling HTML controllers like `ScorersController`
    don't use, hand-rolling `unless record ... flash ... redirect` instead
    (`scorers_controller.rb:76-79,102-104,132-134`). Promoting the rescue_from to
    `ApplicationController` would shrink several controllers.
    - **Pragmatic priority — Opportunistic:** legitimate cleanup, but changes
      user-visible error handling (redirect + flash vs. a rescue_from response) across
      several controllers — verify the flash copy/redirect target stays equivalent
      before promoting it globally.
    - **Angular removal:** No — `TeamsController`/`ScorersController` (Rails HTML
      controllers), no Angular surface.

14. `query_text` presence/length validation duplicated verbatim in `models/query.rb:45`
    and `models/query_doc_pair.rb:39`. Minor — a shared constant would do.
    - **Pragmatic priority — Skip (for now):** two lines, two files — a shared
      constant is barely less code than the duplication itself. Fine to leave until
      the validation rule actually needs to change.
    - **Angular removal:** No — model validation only.

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
   - **Angular removal:** No — both controllers back Rails-page import wizards
     (`_import_case_modal.html.erb` / `_import_snapshot_modal.html.erb`), not the
     core Angular case page.

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
   - **Angular removal:** No — `import_snapshot_controller.js` and
     `confirm_delete_controller.js` are both Rails-page Stimulus controllers, no
     Angular involvement.

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
   - **Angular removal:** No — `invite_controller.js` (teams page) and
     `mapper_wizard_controller.js` (Rails wizard page) are both Rails-only.

6. **Manual debounce-timer bookkeeping** reimplemented in
   `team_member_autocomplete_controller.js:30,36-37,44,52-55,171-176` and
   `bulk_judgement_controller.js:9,12-16,126-128,134` — same declare-in-connect /
   clear-in-disconnect / clear-then-reschedule shape.
   - **Fix**: `utils/debounce.js`.
   - **Pragmatic priority — Opportunistic:** only two call sites, working correctly
     today — nice-to-have utility, not worth a dedicated PR on its own.
   - **Angular removal:** No — `team_member_autocomplete_controller.js` (teams page)
     and `bulk_judgement_controller.js` (bulk-judge page) are both Rails-only.

### Low impact

7. Leftover `console.log("X controller connected")` debug lines in 4 controllers
   (`import_case_controller.js:9`, `import_snapshot_controller.js:7`,
   `mapper_wizard_controller.js:48`, `prompt_form_controller.js:7`) — just remove.
   - **Pragmatic priority — Do now:** literally a four-line delete with zero risk —
     no reason this should wait for a "cleanup PR," just do it in the next commit
     that touches any of these files (or as a standalone one-liner PR today).
   - **Angular removal:** No — all four controllers (`import_case`,
     `import_snapshot`, `mapper_wizard`, `prompt_form`) are Rails-page Stimulus
     controllers, not core-page/Angular-replacement code.

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
   - **Angular removal:** No — all four test files cover the Rails-side share
     controllers (`share_case`, `share_book`, `share_scorer`,
     `share_search_endpoint`), not `share_case_core_controller.js` (the actual
     Angular-replacement controller, which isn't among these duplicated stubs).
     These were built to match the pattern established for the core controller but
     aren't themselves migration output.

---

## 3. Legacy AngularJS (`app/assets/javascripts/`) — migration-doomed, treat as low-priority

### Informational (migration will likely delete this code)

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
   - **Angular removal:** Yes — both controllers are AngularJS components on the
     core case page awaiting their Stimulus port.

4. `$quepidModal.open()` + `.result.then()` launcher boilerplate repeated in 9
   components (`export_case`, `clone_case`, `delete_case_options`, `query_options`,
   `diff`, `query_explain`, `frog_report`, `move_query`, `judgements` controllers) —
   root cause of finding #1. **(migration-doomed)**
   - **Pragmatic priority — Skip:** don't refactor Angular code that's being deleted;
     keep this pattern in mind as the shape of the future Stimulus "modal-launch"
     controller instead.
   - **Angular removal:** Yes — all 9 components are legacy AngularJS slated for
     migration.

5. `ctrl.cancel = function () { $quepidModalInstance.dismiss('cancel'); }` duplicated
   ~21 times across every modal-instance controller. **(migration-doomed)**
   - **Pragmatic priority — Skip:** same reasoning as #4 — migration will delete this
     wholesale.
   - **Angular removal:** Yes — legacy AngularJS modal-instance controllers.

6. Rating-scale watch/setup logic duplicated across `searchResults.js:86-138`,
   `docFinder.js:129-165` (`rateBulkSvc.setScale`/`handleRatingScale`), and
   `controllers/searchResult.js:13-18` (same `setScale` shape, but via the
   single-doc `rateElementSvc` instead) — manual doc-id collection repeated too. Core UI,
   not imminently migrated; worth a `rateBulkSvc.bulkRate/bulkReset` extraction if
   anyone is in this code anyway.
   - **Pragmatic priority — Opportunistic:** no bug, core UI with no near-term
     migration date — fine to leave alone, do the extraction only incidentally while
     touching rating-scale code for a feature reason.
   - **Angular removal:** Yes — `searchResults.js`, `docFinder.js`, and
     `controllers/searchResult.js` are all legacy AngularJS core-UI code.

7. Duplicate array-containment helper in `services/caseSvc.js:529-533`
   (`listContainsCase`) and `services/bookSvc.js:26-28` (`contains`) — same
   "does list already have this id" filter. Low priority.
   - **Pragmatic priority — Skip:** trivial, no bug, in migration-adjacent code —
     not worth the diff.
   - **Angular removal:** Yes — `services/caseSvc.js` and `services/bookSvc.js` are
     legacy AngularJS services.

8. Dead `'caseUpdate'` broadcast event (`services/caseSvc.js:410`) with no listener
   anywhere — a symptom of event names being magic strings with no shared registry.
   Low priority, cheap to add a `broadcastSvc.EVENTS` map if touching this file.
   - **Pragmatic priority — Skip:** dead code, harmless — delete opportunistically,
     don't build a registry for a problem that's mostly theoretical at this point in
     the migration.
   - **Angular removal:** Yes — `services/caseSvc.js` is legacy AngularJS.

9. `delete_case_options_controller.js:27-64` repeats the same
   "call promise, on success set flash+navigate, on failure build message" shape 3x
   with slightly drifted message text. Single file, low priority.
   - **Pragmatic priority — Skip:** single file, cosmetic message drift only — not
     worth touching migration-doomed code for this.
   - **Angular removal:** Yes — legacy AngularJS controller.

10. `factories/SettingsFactory.js` reimplements "find try by tryNo" 3 different ways
    (`:50-59`, `:86-88`, `:120`) instead of calling its own `getTry(tryNo)`. Cosmetic.
    - **Pragmatic priority — Skip:** cosmetic, migration-adjacent — leave it.
    - **Angular removal:** Yes — legacy AngularJS factory.

11. Nine parallel "case action" component trios (component + controller +
    modal-instance-controller) share identical scaffolding — the umbrella pattern
    behind findings #4-#5. **Not a refactor target** given imminent migration, but
    useful context: one generic "modal-launch" Stimulus controller could replace
    all nine when ported.
    - **Pragmatic priority — Skip (as Angular refactor); reference for the port:**
      don't touch the Angular side — treat this as the design spec for whatever
      Stimulus controller eventually replaces all nine.
    - **Angular removal:** Yes — all nine trios are legacy AngularJS awaiting
      migration.

---

## 4. Views, CSS, Config, E2E Tests

### Medium impact

3. **Duplicate "Delete"/"Archive" confirm-button pattern** in 7 files
   (`books/edit.html.erb:5`, `scorers/edit.html.erb:5`, `query_doc_pairs/edit.html.erb:5`,
   `search_endpoints/edit.html.erb:5-6`, `admin/users/edit.html.erb`,
   `admin/announcements/edit.html.erb`, `scores/index.html.erb:73`) — same
   `button_to ... onclick: "return confirm('...')"` with hand-typed JS strings.
   - **Fix**: `destructive_button_to(label, path, entity_name, style:)` helper.
   - **Pragmatic priority — Soon:** small, low-risk, and standardizing the confirm
     copy is a minor UX win too — a good half-day PR, not urgent.
   - **Angular removal:** No — all 7 are Rails HTML edit pages, no Angular surface.

### Low-medium impact

6. Layout `<head>` boilerplate (title, meta description, favicon, csrf_meta_tags)
   duplicated across `layouts/admin.html.erb:1-15`, `layouts/analytics.html.erb:1-14`,
   `layouts/core.html.erb:1-18`, and `layouts/application.html.erb:6-75`. The SEO
   description text has already drifted between them (`core.html.erb:7` reads "Use
   Quepid to help improve..." vs. `admin.html.erb:7`/`analytics.html.erb:7`'s "Use
   Quepid products & services to help improve..."). **(drift)**
   - **Fix**: `layouts/_head_meta` partial with overridable title/description.
   - **Pragmatic priority — Soon:** the SEO drift is real but harmless-ish; the
     partial is cheap and low-risk since only four layout files are involved — fine
     to knock out whenever someone's next in a layout file.
   - **Angular removal:** Partial — `layouts/core.html.erb` is the Angular
     case-page layout; `admin.html.erb`, `analytics.html.erb`, and
     `application.html.erb` are Rails-only. Any `_head_meta` extraction touches the
     Angular surface's layout file directly, so verify `core.html.erb` still renders
     correctly afterward.

8. Routes: share/unshare sub-resource pattern expressed 3 different ways in
   `config/routes.rb` (cases/books/search_endpoints share one shape at
   `:154-159`, scorers use a separate shape at `:77-78`) — not urgent, but
   would fall out naturally from consolidating `TeamCasesController` /
   `TeamScorersController` (Ruby #8).
   - **Pragmatic priority — Bundle:** don't touch routes standalone — let this
     normalize as a side effect of the Ruby #8 "share with team" controller
     consolidation, where the route shape decision has to be made anyway.
   - **Angular removal:** No — `config/routes.rb` is backend routing, unrelated to
     the frontend migration.

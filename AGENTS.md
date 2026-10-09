# Quepid agent instructions

## Scope and change control

Follow [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) for development conventions.

- Preserve behavior unless the user specifically authorizes a change. Refactoring or simplifying architecture does not authorize behavioral improvements or pre-existing bug fixes.
- Establish and verify existing edit/shared-state, persistence, refresh, validation, failure and navigation contracts. Do not rewrite tests or scenarios to justify changed behavior; leave work incomplete if parity is unresolved.
- Fix regressions while retaining the authorized implementation. Ask before a broad rollback.
- Keep changes focused. Before substantive renames, file moves, broad rewrites or other unrequested churn, ask with the proposed change, reason and smaller alternative. General refactoring instructions do not authorize that churn; specific approval persists.
- Keep documentation concise: state each rule once, link to shared guidance and retain only necessary rationale and verification evidence.
- Preserve existing and imported documentation wording and structure. Change it only for factual corrections, necessary task-related updates or an explicitly requested rewrite; do not condense, reorganize or restyle it merely to improve presentation.

## General Configuration / Execution

- You are working on Quepid, a Rails application. Follow [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) for human-facing development workflows and conventions.
- We run Quepid in Docker primarily, don't run Rails and other build tasks locally.
- To set up the environment use:
    `bin/setup_docker`.
- Follow [DEVELOPER_GUIDE.md — Running the app](DEVELOPER_GUIDE.md#4-running-the-app) for the established startup workflow (`bin/docker s` / `bin/docker q`). Start the server when needed without asking for confirmation; reuse it when running. Do not change developer scripts or Compose configuration to work around agent execution mistakes.
- Do not stop (you may restart) the dev server unless the user explicitly asks. Leave it running across tasks.
- **Check before starting Docker.** Inspect `docker compose ps -a app` and the configured host port. The existing wrapper uses `docker compose run`, so a healthy server may be named `quepid-app-run-*`; an empty `docker compose ps app` does not prove the server is stopped. Identify and reuse the actual running server container. Only when no server is running, start it with `bin/docker s` (keep the session running) or `bin/docker q` (detached), without asking for confirmation. Never invoke startup again just to run a command or test. Leave the server running across tasks.
    `lsof -nP -iTCP:${APP_PORT:-3000} -sTCP:LISTEN`.
  A port-3000 bind error is not permission to stop anything, retry, or create a throwaway app. Resolve the exact owner and report it.
- When a correction or lesson applies to how you work in this repo, fix it in the actual project file it belongs to (this file, a skill's `SKILL.md`, a doc) — not only in your own private memory, which no other session or person can see or review.
- **Complete requested batches, not convenient slices.** When the user says to do the next step in an execution plan, execute the entire first incomplete batch and its acceptance criteria. A preparatory subtask is not completion. Do not present partial work as done, offer a commit message, or move the plan forward until all gates pass. If a concrete blocker prevents completion, record the exact blocker and smallest safe prerequisite in the plan, report that the batch is incomplete, and stop at that boundary.
- **Work in meaningful batches, not conversational micro-slices.** When the user says “continue”, “do it”, or “do more”, keep working through the current end-to-end batch and its verification gates. Do not stop after one extracted method, helper, or test to ask for another instruction, provide a commit message, or imply completion. Give progress updates at meaningful boundaries; only hand back when the batch is complete, or when a concrete blocker has been recorded and reported.
- **Do not stage or unstage changes; ask before cherry-picking.** The user stages their own changes. `git cherry-pick` is permitted only after asking for and receiving approval for the specific commits, including its index changes. This exception does not authorize other index operations: no `git add`, `git rm`, `git mv`, `git reset`, `git restore --staged`, `git stash` or `git stash pop`, including to "undo" an accidental change to the index. Files may show up staged without you doing anything, because the editor or the user staged them. Leave them alone and don't comment on what is staged. If you need a file removed, delete it with plain `rm`. If you need to test old code, copy files to the scratchpad and back instead of stashing.
- **Commit messages must describe the staged patch.** Before proposing a commit message, inspect `git status --short`, `git diff --cached --stat`, and the full `git diff --cached` (including staged renames and deletions); do not infer the commit scope from the latest task or from uncommitted changes.
- **Run commands inside the existing server container.** Use `docker compose exec app` for the Compose service container, or `docker exec <actual-server-container-name>` for a server started by `bin/docker s` / `q`. For example, run Rails tests in that container rather than starting a new app-run container.
- For an authorized server image update, preserve the inspected startup command. Compose does not retain command overrides from a previous `run`; the dev server uses `foreman s -f Procfile.dev`. Reuse the wrapper startup command with `--no-deps` when dependency configuration has changed, so an app runtime update cannot also recreate a database service.
- Wait for tests and other commands in the server container to finish before restarting it; a restart terminates those checks.
- Keep `app` immediately after `docker compose exec` so the command matches the approved Docker execution rule. For environment overrides, use `docker compose exec app env KEY=value command ...`; do not put `-e KEY=value` before `app`.
- **Do not use `bin/docker r`, `b`, or `c` for agent commands when a server is running:** those wrappers create separate containers. Use `exec` in the actual server so installed tools remain available throughout the session.
- Container recreation between server sessions is acceptable; preserve host-mounted or volume-backed data. Do not pull images, rebuild Docker images, or run setup unnecessarily. Do not stop or replace a running server unless requested. A generated app-run name alone does not make a container a duplicate: identify which container is serving the app. If multiple servers exist, report their exact names and ask before stopping them.
    If Docker reports permission denied while connecting to its socket, rerun the same in-scope command once with the execution tool's elevated Docker-socket permission. Do not work around the failure with another container. If the elevated retry also fails, report the permission blocker and continue only with non-Docker checks that are safe and relevant.
    - **Can't reach the app.** In the running container the app is plain `http://localhost:3000`. In an `r` container `localhost` is itself, and the host is only reachable as `host.docker.internal` — which Rails rejects with a 403 "Blocked hosts" page, since its dev allow-list takes any bare IP but only a few names.
    - **Installs never stick.** `npx playwright install` and friends land in the throwaway container and vanish on exit, so the install appears to "never take" however many times it is rerun.
- After CSS or vendor JS changes make sure you rebuild:
    `docker compose exec app yarn build`              # full frontend build
    `docker compose exec app yarn build:css`          # core.css / application.css only
    `docker compose exec app yarn build:core`         # core case JS bundle
- In general, prefer using a single agent and not spawning sub-agents unless it will make a big difference. Even then, ask before spawning.

### Shared agent skills

- Repository skills use the portable Agent Skills format: one `<skill>/SKILL.md` with YAML front matter and instructions.
- The source of truth is `.agents/skills/`, the shared project skill directory used by Codex, Cursor, and Gemini; `.claude/skills` is a symlink to it for Claude Code.
- When adding or changing a skill, edit the file under `.agents/skills/` and keep its instructions tool-agnostic unless a tool-specific step is essential.


## Frontend

- The core case app uses Rails-rendered HTML, vanilla JS, StimulusJS, and Hotwire.
- Keep behavior in Stimulus/controllers and shared runtime modules while Rails owns static page structure and URLs.
- For Stimulus migrations, keep static page structure and copy in Rails ERB partials. JavaScript should own behavior, state, and genuinely dynamic repeated content only; do not put a mostly-static page or modal's HTML into `innerHTML` template strings. If a dynamic modal needs a shell, render the shell in ERB and populate its targets.


## Backend

- We are currently using Rails 8.1.4 and Ruby 4.0.7.
- Tests for Ruby are written in Minitest.
- Long-running work uses ActiveJob + SolidQueue, ActionCable pushes state to the frontend.
- Solr JSONP forces the case page to HTTP while the rest may be HTTPS. When touching `CoreController` or SSL config, make sure to take this into consideration.
- **Turbo navigation:** Drive is the default on ordinary Rails management/admin pages. Follow [DEVELOPER_GUIDE.md — Turbo navigation](DEVELOPER_GUIDE.md#turbo-navigation) for form responses, confirmations, caching, and opt-outs. The case workspace and standalone analytics retain full-page boundaries; see [Turbo on the case page](DEVELOPER_GUIDE.md#turbo-on-the-case-page) before changing either lifecycle.


## JavaScript

- Use yarn instead of npm for package management.


## Tests

### JavaScript

- Run JavaScript unit tests via `docker compose exec app yarn test:unit` (Vitest — specs in `test/javascript/`, mirroring `app/javascript/`, not colocated).
- Lint modern JS via `docker compose exec app yarn lint:js` or `docker compose exec app rails test:eslint` (see `docs/js_tooling.md`).
- **Vitest PR policy:** see DEVELOPER_GUIDE.md's "Vitest" section.
- **Property-based tests (fast-check):** when you add or materially change a pure `utils/` or `api/` function with a crisp invariant (round trip, aggregation, payload builder, ordering/concurrency), add or extend `test/javascript/utils/<module>_properties.test.js`. Follow `docs/js_tooling.md` — "Property-based tests". Before finishing one, temporarily break the code under test and confirm the property fails, then restore it. Pin any shrunk counterexample as a plain example test. Don't use them for controllers or DOM code, and don't loosen a failing property without understanding its counterexample.
- **Cross-language contracts (Ruby ↔ JS):** share a fixture under `test/fixtures/files/` read by both Minitest and Vitest rather than adding a Ruby property-testing gem. If you change `CsvExport` or the CSV import/export utilities, update `csv_round_trip_cases.json` and run both suites.

### Rails
- Run Rails tests via `docker compose exec app rails test`.
- Before a Rails suite or fixture-loading check, inspect running test processes in the server container. Do not run concurrent suites against the same test database; wait for the existing run or use a disposable database with an explicit `RAILS_ENV=test` and distinct `DB_NAME`, then remove only that database.
- Scratch Ruby checks that load `test_helper` must explicitly set `RAILS_ENV=test` in the container command and verify it before loading fixtures; the server container inherits `RAILS_ENV=development`.

### CSS
- Lint CSS via `docker compose exec app yarn lint:css` or `docker compose exec app rails test:stylelint` (config: `.stylelintrc.json`).

### E2E (Playwright)
- Run Playwright E2E tests via `docker compose exec app yarn test:e2e`, with `docker compose exec app npx playwright install chromium` once. Requires the app already running via `bin/docker s`. **`bin/docker r` cannot run these** — E2E needs the live server and the browser install has to persist, which is exactly what a throwaway container breaks.
- This is a separate, checked-in test suite under `test/playwright/` — not the same thing as the Playwright MCP interactive tool described below. See DEVELOPER_GUIDE.md's "Playwright E2E" section for env vars and full details.
- **Any spec that creates a row in the shared dev DB (a user, a team, a case) must delete it in a `test.afterAll`** — See DEVELOPER_GUIDE.md's "Playwright E2E" section for the cleanup pattern to copy.

### Manual testing tracker (`docs/manual-testing/`)

- Follow the timestamp rules in [DEVELOPER_GUIDE.md — Manual testing tracker](DEVELOPER_GUIDE.md#manual-testing-tracker). Preserve actual verification timestamps.

- Proactively offer a representative sample batch when browser verification spans many flows or would slow incremental development. Name the proposed sample and deferred coverage. Once sampling is authorized, carry out that batch without asking again on every commit; follow the sampling policy in DEVELOPER_GUIDE.md. Do not make a full Playwright sweep the default gate for each commit.

- When observed behavior differs from a manual scenario's expectation, compare it with the same surface on pre-deangularization `main` before classifying it or proposing a fix. Go back far enough to recover the Angular implementation (months if needed), record the baseline commit and source evidence, and distinguish migration regressions, pre-existing defects, and unsupported test expectations. Historical source inspection is not a live historical replay; state that limit explicitly.

- `docs/manual-testing/*.md` is the human-readable manual test script. - `docs/manual-testing/tracking.yml` tracks, per numbered scenario, when it was last actually driven end-to-end (via Playwright MCP or by hand), the result, and which source `paths` that scenario exercises.

- Before starting work that touches a tracked path, or when asked to do a manual testing pass: run `bin/manual_test_status` (plain `ruby`, no Docker/Rails boot needed) to see what's due — never run, stale (> `policy.default_max_age_days`, default 90), or whose `paths` changed (committed **or uncommitted**) since `last_run`. Use `--due-only` to filter, `--part 07` to scope to one part, `--paths-for 3.2` to see what a scenario tracks.
- After changing code, check whether any tracked `paths` match your diff (`bin/manual_test_status` will surface it as "uncommitted changes in ..."). Follow [DEVELOPER_GUIDE.md — Manual testing tracker](DEVELOPER_GUIDE.md#manual-testing-tracker) for representative browser sampling during incremental development; a full pass is not required on every commit. Record deferred coverage rather than implying it was verified.
- Age-expired scenarios (flagged solely because `last_run` is past `default_max_age_days`, with no path change involved) are also yours to act on, not just report: when a session touching this repo notices one via `bin/manual_test_status`, drive it through Playwright MCP and update `tracking.yml` in that same session — don't wait to be asked, and don't leave it sitting as a report for a human to run later.
- After running a scenario (pass or fail), update its entry in `tracking.yml`: `last_run` (today, UTC), `result` (`pass` / `pass_with_fixes` / `fail` / `blocked`), and `notes` on what was actually covered and what wasn't (partial coverage is normal — say so rather than implying the whole scenario was exhaustively verified; `tracking.yml`'s own header has the length guidance — brief for a clean pass, as long as it takes to be useful when the pass found and fixed something). Only set `last_run` for scenarios you actually exercised; leave others alone (`null` is honest and useful).
- Update the tracker before moving to another scenario. During a long scenario, record verified checkpoints as you go, explicitly label the coverage as partial/in progress and name pending checks; do not leave an older result in place until the whole sweep finishes. The result describes only the recorded coverage. Replace the checkpoint notes with the final coverage and outcome when finished.
- If a scenario's source moves or a new one is added, update `paths`/add an entry — the tracker is only as useful as its path mappings.
- **Feature parity, not just staleness:** the checks above only re-verify scenarios that *already exist*. When a PR adds, removes, or materially changes user-facing functionality, also update the prose itself, in the same PR:
    - add a new numbered scenario (with `paths`) for new functionality,
    - delete/mark obsolete the scenario for removed functionality,
    - and revise steps/expected-results for changed behavior.


## Documentation

- Documentation goes in the `docs` directory, not a toplevel `doc` directory.
- Keep provenance tags and the migration skill until remaining work is classified and closed. Archive completed plans only after their acceptance criteria pass; retain links to unresolved criteria and historical evidence.
- Every actionable item in `docs/todo/todo.md` must carry a provenance marker:
  `[MIGRATION]` for defects introduced by or required to complete AngularJS
  removal, `[MIGRATION-FOLLOWUP]` for related cleanup that is not necessarily a
  regression, and `[PREEXISTING]` for defects that predate the removal. When
  reviewing migration work, use these markers to keep pre-existing defects out
  of the migration-fix scope; preserve or update the marker when moving or
  splitting an item.
- To understand the data model used by Quepid, consult `./docs/data_mapping.md`.
- To understand how the application is built, consult `./docs/app_structure.md`.
- **Documentation audience:** shared development conventions belong in DEVELOPER_GUIDE.md, linked from AGENTS.md. Agent-specific execution, approval, scope and recovery rules belong in AGENTS.md or `.agents/skills/**/SKILL.md`, with links to relevant developer guidance.
- **State the rule, not the incident.** When you add a rule to a doc because something went wrong (a bug, a leak, a broken baseline), write the rule and, if genuinely non-obvious, *why* it holds — not a blow-by-blow of the specific occurrence (dates, counts, "this bit us on..."). Specifics like "16 leaked users" or a timestamp rot the moment the underlying state changes and read as clutter to a later reader who has no way to verify or care about that instance. Only keep instance detail when it's load-bearing — e.g. it teaches a non-obvious edge case the rule alone wouldn't convey.


## Code Style

- Instead of treating true/false parameters as strings in controller methods use our helper `archived = deserialize_bool_param(params[:archived])` to make them booleans.
- Never do $window.location.href= '/', do $window.location.href= caseTryNavSvc.getQuepidRootUrl();.
- Likewise urls generated should never start with / as we need relative links.
- In Ruby we say `credentials?` versus `has_credentials?` for predicates.
- Prefer BS5 spacing utilities over one-off margins.

### Agent checklist — match the linter for the file you touch

Quepid **does not** use one global JS style. Write **new** code to modern conventions (below); do not reformat older lines or unrelated sections just to normalize style.

**Modern JS** (`app/javascript/`) — `.prettierrc.json`; full tooling in `docs/js_tooling.md`:

- **Double quotes**, **no semicolons**, **no trailing commas** (`trailingComma: "none"`).
- Prettier pre-commit is limited to **`api/`, `utils/`, and the classic core scripts (`tour`)** (see `config/javascript_lint_scope.mjs`). Before committing there: `docker compose exec app yarn format:js:check` and `docker compose exec app yarn lint:js`.
- ESLint covers the wider modern tree (`controllers/`, `modules/`, entry bundles, etc.) and the JavaScript tests under `test/javascript/`; follow the conventions above when you add specs.
    - Pre-commit **still runs ESLint** on those paths — run it yourself before finishing: `docker compose exec app npx eslint app/javascript/path/to/file.js` or tree-wide `docker compose exec app yarn lint:js`.
    - Do **not** run Prettier outside `api/`/`utils/`/the classic core scripts for now (it would churn older single-quote files); hand-apply modern style to **new** lines you add.
- **Mixed-style files** (e.g. an older controller with single quotes): modern conventions on **new** code; when changing an existing line, match its surrounding style. Do not fall back to legacy habits (`var`, semicolons) on greenfield Stimulus/importmap code.
- **Importmap bare paths** — `import { apiFetch } from "api/fetch"`, not relative `../api/...`. Add new pins to `vitest.config.js` when tests import them.
- Use `const` or `let`, not `var`.

**Ruby** — `.rubocop.yml` (opposite comma rule from JS):

- **Multiline hashes require a trailing comma** (`Style/TrailingCommaInHashLiteral: comma`).
- Table-style hash alignment (`Layout/HashAlignment: table`).

**Stimulus / HTTP** — `DEVELOPER_GUIDE.md` § Stimulus HTTP conventions:

- Server-owned URLs (`data-*-url-value`, `formTarget.action`, or a `*-url-template-value` with a named placeholder for browser-only ids); JSON through the `api/json` verb helpers (`getJson`/`postJson`/`putJson`/`patchJson`/`deleteJson`), `apiFetch` only for non-JSON. See the guide section.
- `getQuepidRootUrl()` only when the server cannot pass the URL (e.g. redirect after import).

**Vitest** — `vi.resetModules()` + fresh `import()` for module singletons; `@hotwired/stimulus` is stubbed via `test/javascript/support/stimulus_stub.js`.

**Playwright** (`test/playwright/*.ts`) — TypeScript; not governed by `.prettierrc.json`.


## UI/UX and Styling

- We use .css, we do not use .scss.


## Bootstrap 5 JavaScript on `core` (BS5 CSS + patch sheets)

- The core case UI (`app/views/layouts/application.html.erb` case branch, `_case_head` / `_case_workspace`) loads **`core.css`**: npm **Bootstrap 5** first, then Quepid layers (`core-additions.css` — Quepid layout without Bootstrap-class selectors; **`bootstrap5-compat.css`** — all Bootstrap-class shims, navbar brand skin, modals, popovers, dev-panel chrome, etc.). The header's full-width layout is a markup change (`container` → `container-fluid`), not a `bootstrap5-compat.css` rule.
- The core Stimulus/runtime bundle and `bootstrap_globals` provide BS5 **`window.bootstrap`** for popovers, tooltips, dropdowns, accordion, tabs, modals, and similar.
- The rest of the UI loads BS5 via `application.css`. The two are separate stylesheet worlds. When you **add or change** BS5-driven UI on `core` (or more rules in `bootstrap5-compat.css`), use the existing core Bootstrap helpers/controllers as patterns and expect these traps:
- **Root `font-size` and rem-based BS5 defaults.** `core-additions.css` sets **`html { font-size: 87.5% }`** on `core` (1rem = 14px, Bootstrap 3's base), so every rem-based BS5 default renders smaller than upstream.
    - Where a BS5 widget needs an exact size, override the relevant **`--bs-*`** vars with **px** in compat CSS, and verify computed styles. Do not change root font-size casually without checking the whole **`core`** stack.
- **Earlier-layer rules can win on shared selectors** (e.g. `.popover { padding: 1px }` from an old patch while BS5 puts padding on `.popover-header` / `.popover-body`). Reset bleed-through properties explicitly in the compat CSS.
- **Verify visually.** Some of these traps produce *invisible-but-present* failures (popover element in DOM, `aria-describedby` set, but nothing visible). Static analysis won't catch them. Use Playwright MCP (or have the user screenshot DevTools' Computed panel for the popover element) and confirm `display`, `opacity`, `font-size`, and `transform` are sensible.


## UI changes — screenshots via Playwright MCP (`playwright` server)

If Playwright MCP reports that its browser/profile is already in use, do not
skip or defer required browser verification solely for that reason. Identify
the exact automation browser/profile and ask the user for permission to take
it over, explaining that recovery may interrupt its current automation session.
After approval, release only that browser session, reconnect Playwright MCP,
and complete the required verification. Never terminate unrelated browsers or
delete profile data. Reuse takeover permission within the authorized scope;
do not ask again for the same recovery. If permission is declined or recovery
still fails, record the concrete blocker and the remaining verification.

For any user-visible change, prove the behavior with Playwright MCP screenshots — never substitute prose or memory. App: `http://localhost:33000`; sign in with `quepid+realisticactivity@o19s.com` / `password`.

Apply the incremental sampling policy in [DEVELOPER_GUIDE.md — Manual testing tracker](DEVELOPER_GUIDE.md#manual-testing-tracker) to the flows captured below. Use the actual running server's configured host port when it differs from the example URL.

The Playwright MCP tools may be exposed as deferred tools rather than a direct namespace. In that case, discover `mcp__playwright__*` from the tool catalog and invoke them through the tool orchestrator; do not treat an empty computer-surface/browser inventory as proof that Playwright is unavailable. Start with `mcp__playwright__browser_tabs` (`action: "list"`), then use the browser snapshot/click/fill/screenshot tools for the required flow.

- **Before & after**: capture the affected flow before editing, then repeat the identical steps after. Capture every relevant state (modal open/closed, accordion expanded, error vs success, etc.). `browser_snapshot` is only for driving clicks; `browser_take_screenshot` is the proof.
- **Capturing a screenshot is not verifying it.** Before claiming two states match or differ, actually open and look at every before/after pair (Read tool or equivalent) — don't infer "identical" from the code diff not touching that template, and don't treat a console-log error as a substitute for looking at what the page actually rendered.
- **Frame big** (screenshots have come out too small): shoot the **full viewport**, not element crops.
    - Quepid modals scroll *internally*, so `fullPage:true` does NOT reach below their fold — instead `browser_resize` the viewport to roughly match the modal so it fills the frame, then screenshot the viewport.
    - Size to the content: a tall step (e.g. the wizard endpoint step) needs ~`820x2200`; a short step (e.g. wizard Finish) needs ~`900x760` — a tall viewport dwarfs a short modal. Narrower width = modal fills more of the frame.
- **Force hard-to-reach states** (e.g. a failed save) by intercepting the API with `browser_run_code_unsafe` + `page.route('**/api/...', ...)`.
    - Gotcha: `setTimeout` is undefined in that context — use `await page.waitForTimeout(ms)` for delays.
- **Save** under `.playwright-mcp/<topic>/` (gitignored) with clear `-before`/`-after` (+ state) names, e.g. `.playwright-mcp/share-case/migration-share-case-modal-after.png`. Topic folders keep this PR’s shots separate from older captures in the screenshot viewer (`yarn screenshots:view` / `node test/playwright/screenshot-viewer-server.mjs`).
  Use an absolute filename for `browser_take_screenshot` under that directory; relative filenames may resolve against the workspace instead of the configured MCP output directory.

### Before/after pairs — do not break the working tree

- Follow [DEVELOPER_GUIDE.md — Manual testing tracker](DEVELOPER_GUIDE.md#manual-testing-tracker) for initial migration and later regression-check baselines. For the [isolated historical instance](docs/legacy_comparison.md), keep both servers running; do not flip current sources or restore the shared development database.
- Capture **before** first, or keep existing **after** PNGs until matching befores exist — **never delete** the only half of a pair.
- Exactly three permanent Quepid instances exist: current (`bin/docker s`, :3000), historical (`bin/legacy`, :3001) and the diff baseline (`bin/ui_diff_up <ref>`, :3003: one worktree `../quepid-ui-diff-worktree`, one container `quepid_app_ui_diff`). For nonhistorical comparisons, point the diff baseline at the old ref (`.agents/skills/branch-ui-diff/SKILL.md`) and leave it running. Never create task-named worktrees, containers or `/tmp` checkouts for a baseline. Keep the primary branch and server on current sources throughout; do not flip primary sources or override browser scripts to replay old code.
- Select replay sources against the requested baseline, including both staged and unstaged changes (for example, `git diff HEAD`); plain `git diff` can omit changed sources. For an uncommitted pre-fix baseline, run `bin/ui_diff_up HEAD`, then copy the relevant current sources into `../quepid-ui-diff-worktree`, reverse only the fix there and rebuild assets with `docker exec quepid_app_ui_diff yarn build`. A later `bin/ui_diff_up` to a different ref, or `--reset`, discards those edits. Leave the primary index untouched.
- Use the relevant Playwright screenshot spec and `MIGRATION_SHOT_PHASE=before|after`, Playwright MCP, or a few manual shots — **not** a Docker orchestration script.

## Code reviews

When asked to review code, do not use subagents. Review the code in the conversation for bugs, errors, bad practices, regressions, lost functionality, and overengineering.

Review from these perspectives:

- modern Ruby on Rails, including Hotwire and Stimulus
- pragmatic engineering
- QA and regression risk

Report actionable findings first, ordered by severity, with file and line references when possible. If no issues are found, say so and summarize the verification performed.

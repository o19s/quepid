# Quepid agent instructions

## General Configuration / Execution

- You are working on Quepid, a Rails application. Also look at @DEVELOPER_GUIDE.md.
- We run Quepid in Docker primarily, don't run Rails and other build tasks locally.
- To set up the environment use:
    `bin/setup_docker`.
- To start Quepid use:
    `bin/docker s`
- Do not stop (you may restart) the dev server unless the user explicitly asks. Leave it running across tasks.
- **Check before starting Docker.** First run `docker compose ps app`. If `app` is running, use it with `docker compose exec app` and do not run `bin/docker s` again. If `app` is not running, check the published port before starting:
    `lsof -nP -iTCP:${APP_PORT:-3000} -sTCP:LISTEN`.
  A port-3000 bind error means the host port is occupied; it is not a reason to retry `bin/docker s`, stop an unknown process, or create more throwaway containers. Start Quepid on the alternate published port instead:
    `APP_PORT=33000 bin/docker s`
  Then use `http://localhost:33000` for browser/manual checks and set `QUEPID_BASE_URL=http://localhost:33000` for Playwright. Verify the chosen port responds before continuing. The app still listens on port 3000 inside Docker, so this does not change Rails' internal port or the nginx service link.
- When a correction or lesson applies to how you work in this repo, fix it in the actual project file it belongs to (this file, a skill's `SKILL.md`, a doc) — not only in your own private memory, which no other session or person can see or review.
- **Default to `docker compose exec app`, which runs the command IN the already-running app container.** So `rails console --environment=test` becomes `docker compose exec app rails console --environment=test`.
- **Use `bin/docker r` only when there is no running container to use** (the stack is down, or you deliberately want a clean one). `r` is `docker compose run --rm`: a NEW throwaway container with its own loopback and its own filesystem, so it silently breaks anything that needs the running dev server or that must persist installed state. Both failure modes look like app bugs rather than wrong-container mistakes:
    - **Can't reach the app.** In the running container the app is plain `http://localhost:3000`. In an `r` container `localhost` is itself, and the host is only reachable as `host.docker.internal` — which Rails rejects with a 403 "Blocked hosts" page, since its dev allow-list takes any bare IP but only a few names.
    - **Installs never stick.** `npx playwright install` and friends land in the throwaway container and vanish on exit, so the install appears to "never take" however many times it is rerun.
- After CSS or vendor JS changes make sure you rebuild:
    `docker compose exec app yarn build`              # full frontend build
    `docker compose exec app yarn build:css`          # core.css / application.css only
    `docker compose exec app yarn build:angular-vendor`  # BS5 + splainer-search bundle
- In general, prefer using a single agent and not spawning sub-agents unless it will make a big difference. Even then, ask before spawning.

### Shared agent skills

- Repository skills use the portable Agent Skills format: one `<skill>/SKILL.md` with YAML front matter and instructions.
- The source of truth is `.agents/skills/`, the shared project skill directory used by Codex, Cursor, and Gemini; `.claude/skills` is a symlink to it for Claude Code.
- When adding or changing a skill, edit the file under `.agents/skills/` and keep its instructions tool-agnostic unless a tool-specific step is essential.


## Frontend

- The core case app is built using AngularJS 1.8 but we are in the process of removing our AngularJS dependency.
- In place of AngularJS we are using vanilla JS and StimulusJS along with various components of Hotwire, our goal is to have a modern Rails stack application.
- **Angular → Stimulus on core:** per-surface equivalence — core matches Angular; Rails pages keep their prior UX. **Do not collapse surfaces.** Playbook: `angular-case-migration` skill (`.agents/skills/angular-case-migration/SKILL.md`) — DoD is phases 5–6, not Vitest + a modal screenshot.


## Backend

- We are currently using Rails 8.1.3 and Ruby 4.0.6.
- Tests for Ruby are written in Minitest.
- Long-running work uses ActiveJob + SolidQueue, ActionCable pushes state to the frontend.
- Solr JSONP forces the case page to HTTP while the rest may be HTTPS. When touching `CoreController` or SSL config, make sure to take this into consideration.
- **Turbo on the Angular case page** (Frames/Streams only, Drive off; never put Angular elements inside a Turbo Frame) — see DEVELOPER_GUIDE.md's "Turbo on the Angular case page" section before adding Hotwire to `core`.


## JavaScript

- Use yarn instead of npm for package management.


## Tests

### JavaScript

- Run JavaScript unit tests via `docker compose exec app yarn test:unit` (Vitest — specs in `test/javascript/`, mirroring `app/javascript/`, not colocated) or `docker compose exec app yarn test` (Karma — legacy Angular).
- Lint modern JS via `docker compose exec app yarn lint:js` or `docker compose exec app rails test:eslint` (see `docs/js_tooling.md`).
- **Vitest PR policy:** see DEVELOPER_GUIDE.md's "Vitest" section.

### Rails
- Run Rails tests via `docker compose exec app rails test`.

### CSS
- Lint CSS via `docker compose exec app yarn lint:css` or `docker compose exec app rails test:stylelint` (config: `.stylelintrc.json`).

### E2E (Playwright)
- Run Playwright E2E tests via `docker compose exec app yarn test:e2e`, with `docker compose exec app npx playwright install chromium` once. Requires the app already running via `bin/docker s`. **`bin/docker r` cannot run these** — E2E needs the live server and the browser install has to persist, which is exactly what a throwaway container breaks.
- This is a separate, checked-in test suite under `test/playwright/` — not the same thing as the Playwright MCP interactive tool described below. See DEVELOPER_GUIDE.md's "Playwright E2E" section for env vars and full details.
- **Any spec that creates a row in the shared dev DB (a user, a team, a case) must delete it in a `test.afterAll`** — See DEVELOPER_GUIDE.md's "Playwright E2E" section for the cleanup pattern to copy.

### Manual testing tracker (`docs/manual-testing/`)

- `docs/manual-testing/*.md` is the human-readable manual test script. - `docs/manual-testing/tracking.yml` tracks, per numbered scenario, when it was last actually driven end-to-end (via Playwright MCP or by hand), the result, and which source `paths` that scenario exercises.

- Before starting work that touches a tracked path, or when asked to do a manual testing pass: run `bin/manual_test_status` (plain `ruby`, no Docker/Rails boot needed) to see what's due — never run, stale (> `policy.default_max_age_days`, default 90), or whose `paths` changed (committed **or uncommitted**) since `last_run`. Use `--due-only` to filter, `--part 07` to scope to one part, `--paths-for 3.2` to see what a scenario tracks.
- After changing code, check whether any tracked `paths` match your diff (`bin/manual_test_status` will surface it as "uncommitted changes in ...") and actually drive the affected scenario(s) through Playwright MCP before considering the change done — don't just rely on automated tests for UI-facing changes.
- Age-expired scenarios (flagged solely because `last_run` is past `default_max_age_days`, with no path change involved) are also yours to act on, not just report: when a session touching this repo notices one via `bin/manual_test_status`, drive it through Playwright MCP and update `tracking.yml` in that same session — don't wait to be asked, and don't leave it sitting as a report for a human to run later.
- After running a scenario (pass or fail), update its entry in `tracking.yml`: `last_run` (today, UTC), `result` (`pass` / `pass_with_fixes` / `fail` / `blocked`), and `notes` on what was actually covered and what wasn't (partial coverage is normal — say so rather than implying the whole scenario was exhaustively verified; `tracking.yml`'s own header has the length guidance — brief for a clean pass, as long as it takes to be useful when the pass found and fixed something). Only set `last_run` for scenarios you actually exercised; leave others alone (`null` is honest and useful).
- If a scenario's source moves or a new one is added, update `paths`/add an entry — the tracker is only as useful as its path mappings.
- **Feature parity, not just staleness:** the checks above only re-verify scenarios that *already exist*. When a PR adds, removes, or materially changes user-facing functionality, also update the prose itself, in the same PR:
    - add a new numbered scenario (with `paths`) for new functionality,
    - delete/mark obsolete the scenario for removed functionality,
    - and revise steps/expected-results for changed behavior.
    - Angular→Stimulus migrations follow the same rule — see `angular-case-migration` skill phases 5–6.


## Documentation

- Documentation goes in the `docs` directory, not a toplevel `doc` directory.
- To understand the data model used by Quepid, consult `./docs/data_mapping.md`.
- To understand how the application is built, consult `./docs/app_structure.md`.
- **DEVELOPER_GUIDE.md is the primary human-facing doc; AGENTS.md is agent-only guidance.** When a rule applies to both, keep the full text in DEVELOPER_GUIDE.md and have AGENTS.md point to it — never the other way around. Skill files (`.agents/skills/**/SKILL.md`, exposed to Claude Code through `.claude/skills`) are agent-only too, so they may reference AGENTS.md directly.
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
- Prettier pre-commit is limited to **`api/` and `utils/`** (see `config/javascript_lint_scope.mjs`). Before committing there: `docker compose exec app yarn format:js:check` and `docker compose exec app yarn lint:js`.
- ESLint covers the wider modern tree (`controllers/`, `modules/`, entry bundles, etc.) but **ignores `*.test.js`** — follow the conventions above manually when you add specs.
    - Pre-commit **still runs ESLint** on those paths — run it yourself before finishing: `docker compose exec app npx eslint app/javascript/path/to/file.js` or tree-wide `docker compose exec app yarn lint:js`.
    - Do **not** run Prettier outside `api/`/`utils/` for now (it would churn older single-quote files); hand-apply modern style to **new** lines you add.
- **Mixed-style files** (e.g. an older controller with single quotes): modern conventions on **new** code; when changing an existing line, match its surrounding style. Do not fall back to legacy Angular habits (`var`, semicolons) on greenfield Stimulus/importmap code.
- **Importmap bare paths** — `import { apiFetch } from "api/fetch"`, not relative `../api/...`. Add new pins to `vitest.config.js` when tests import them.
- Use `const` or `let`, not `var`.

**Legacy Angular JS** (`app/assets/javascripts/`) — ESLint and Prettier run as advisory checks on staged files; their findings do not block commits while the Angular case app is being retired. Avoid reformatting it as part of modern JavaScript changes.

**Ruby** — `.rubocop.yml` (opposite comma rule from JS):

- **Multiline hashes require a trailing comma** (`Style/TrailingCommaInHashLiteral: comma`).
- Table-style hash alignment (`Layout/HashAlignment: table`).

**Stimulus / HTTP** — `DEVELOPER_GUIDE.md` § Stimulus HTTP conventions:

- Server-owned URLs (`data-*-url-value`, `formTarget.action`); `apiFetch` for mutating JSON.
- `getQuepidRootUrl()` only when the server cannot pass the URL (e.g. redirect after import).

**Vitest** — `vi.resetModules()` + fresh `import()` for module singletons; `@hotwired/stimulus` is stubbed via `app/javascript/test/stimulus_stub.js`.

**Playwright** (`test/playwright/*.ts`) — TypeScript; not governed by `.prettierrc.json`.


## UI/UX and Styling

- We use .css, we do not use .scss.


## Bootstrap 5 JavaScript on Angular `core` (BS5 CSS + patch sheets)

- The Angular case UI (`app/views/layouts/core.html.erb`) loads **`core.css`**: npm **Bootstrap 5** first, then Quepid layers (`core-additions.css` — Quepid layout without Bootstrap-class selectors; **`bootstrap5-compat.css`** — all Bootstrap-class shims, navbar brand skin, modals, popovers, dev-panel chrome, etc.). The header's full-width layout is a markup change (`container` → `container-fluid`), not a `bootstrap5-compat.css` rule.
- **`app/javascript/angular_app.js`** pins BS5 **`window.bootstrap`** for popovers, tooltips, dropdowns, accordion, tabs, modals (`$quepidModal`), and similar.
- The non-Angular UI loads BS5 via `application.css`. The two are separate stylesheet worlds. When you **add or change** BS5-driven UI on `core` (or more rules in `bootstrap5-compat.css`), use `app/assets/javascripts/directives/quepidPopover.js` and `quepidTooltip.js` as patterns and expect these traps:
- **Root `font-size` and rem-based BS5 defaults.** `bootstrap5-compat.css` comment blocks historically assumed **`html { font-size: 62.5% }`** (1rem = 10px); that rule is **not** set in-repo on `core` today (`core.html.erb` / `core-additions.css`).
    - If **computed** root `font-size` is not 16px, rem-based BS5 defaults may look wrong — override the relevant **`--bs-*`** vars with **px** in compat CSS when tuning widgets, and verify computed styles. Do not change root font-size casually without checking the whole **`core`** stack.
- **Earlier-layer rules can win on shared selectors** (e.g. `.popover { padding: 1px }` from an old patch while BS5 puts padding on `.popover-header` / `.popover-body`). Reset bleed-through properties explicitly in the compat CSS.
- **Verify visually.** Some of these traps produce *invisible-but-present* failures (popover element in DOM, `aria-describedby` set, but nothing visible). Static analysis won't catch them. Use Playwright MCP (or have the user screenshot DevTools' Computed panel for the popover element) and confirm `display`, `opacity`, `font-size`, and `transform` are sensible.


## UI changes — screenshots via Playwright MCP (`playwright` server)

For any user-visible change, prove the behavior with Playwright MCP screenshots — never substitute prose or memory. App: `http://localhost:33000`; sign in with `quepid+realisticactivity@o19s.com` / `password`.

- **Before & after**: capture the affected flow before editing, then repeat the identical steps after. Capture every relevant state (modal open/closed, accordion expanded, error vs success, etc.). `browser_snapshot` is only for driving clicks; `browser_take_screenshot` is the proof.
- **Capturing a screenshot is not verifying it.** Before claiming two states match or differ, actually open and look at every before/after pair (Read tool or equivalent) — don't infer "identical" from the code diff not touching that template, and don't treat a console-log error as a substitute for looking at what the page actually rendered.
- **Frame big** (screenshots have come out too small): shoot the **full viewport**, not element crops.
    - Quepid modals scroll *internally*, so `fullPage:true` does NOT reach below their fold — instead `browser_resize` the viewport to roughly match the modal so it fills the frame, then screenshot the viewport.
    - Size to the content: a tall step (e.g. the wizard endpoint step) needs ~`820x2200`; a short step (e.g. wizard Finish) needs ~`900x760` — a tall viewport dwarfs a short modal. Narrower width = modal fills more of the frame.
- **Force hard-to-reach states** (e.g. a failed save) by intercepting the API with `browser_run_code_unsafe` + `page.route('**/api/...', ...)`.
    - Gotcha: `setTimeout` is undefined in that context — use `await page.waitForTimeout(ms)` for delays.
- **Save** under `.playwright-mcp/<topic>/` (gitignored) with clear `-before`/`-after` (+ state) names, e.g. `.playwright-mcp/share-case/migration-share-case-modal-after.png`. Topic folders keep this PR’s shots separate from older captures in the screenshot viewer (`yarn screenshots:view` / `node test/playwright/screenshot-viewer-server.mjs`).

### Before/after pairs — do not break the working tree

- Capture **before** first, or keep existing **after** PNGs until matching befores exist — **never delete** the only half of a pair.
- To shoot pre-change UI: **save after sources aside**, flip **only** the files needed (often templates/modals), rebuild Angular (`yarn build:angular-vendor`, `build:angular-app`, `build:angular-templates`), capture, then **restore + rebuild in the same session** before anything else.
- **Never leave the repo on HEAD/pre-migration sources** after a before capture — verify migrated markup and bundles before finishing.
- Use `test/playwright/dom_migration_screenshots.spec.ts` + `MIGRATION_SHOT_PHASE=before|after`, Playwright MCP, or a few manual shots — **not** a Docker orchestration script.
- No viewer tooling, inventory docs, or unrelated edits while the tree is mid-flip.

## Code reviews

When asked to review code, do not use subagents. Review the code in the conversation for bugs, errors, bad practices, regressions, lost functionality, and overengineering.

Review from these perspectives:

- modern Ruby on Rails, including Hotwire and Stimulus
- pragmatic engineering
- QA and regression risk

Report actionable findings first, ordered by severity, with file and line references when possible. If no issues are found, say so and summarize the verification performed.

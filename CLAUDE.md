## ClaudeOnRails Configuration

You are working on Quepid, a Rails application. Review the ClaudeOnRails context file at @.claude-on-rails/context.md

We run Quepid in Docker primarily, don't run Rails and other build tasks locally..

To set up the envirnoment use:

`bin/setup_docker`.

To start rails:

`bin/docker s`

Do not stop (you may restart) the dev server unless the user explicitly asks. Leave it running across tasks.

Most commands you want to run you can just prefix with `bin/docker r bundle exec` so `rails console --environment=test` becomes `bin/docker r bundle exec rails console --environment=test`

Use npm instead of yarn for package management.

Run javascript tests via `bin/docker r npm test`.


Documentation goes in the `docs` directory, not a toplevel `doc` directory.

To understand the data model used by Quepid, consult `./docs/data_mapping.md`.

To understand how the application is built, consult `./docs/app_structure.md`.


Instead of treating true/false parameters as strings in controller methods use our helper `archived = deserialize_bool_param(params[:archived])` to make them booleans.

We use .css, we do not use .scss.

Never do $window.location.href= '/', do $window.location.href= caseTryNavSvc.getQuepidRootUrl();.

Likewise urls generated should never start with / as we need relative links.

In Ruby we say `credentials?` versus `has_credentials?` for predicates.

In JavaScript, use `const` or `let` instead of `var`. When writing multiline ternary expressions, keep `?` and `:` at the end of the line, not the start of the next line, to avoid JSHint "misleading line break" errors.

## UI changes — screenshots via Playwright MCP (`playwright` server)

For any user-visible change, prove the behavior with Playwright MCP screenshots — never substitute prose or memory. App: `http://localhost:33000`; sign in with `quepid+realisticactivity@o19s.com` / `password`.

- **Before & after**: capture the affected flow before editing, then repeat the identical steps after. Capture every relevant state (modal open/closed, accordion expanded, error vs success, etc.). `browser_snapshot` is only for driving clicks; `browser_take_screenshot` is the proof.
- **Frame big** (my screenshots have come out too small): shoot the **full viewport**, not element crops. Quepid modals scroll *internally*, so `fullPage:true` does NOT reach below their fold — instead `browser_resize` the viewport to roughly match the modal so it fills the frame, then screenshot the viewport. Size to the content: a tall step (e.g. the wizard endpoint step) needs ~`820x2200`; a short step (e.g. wizard Finish) needs ~`900x760` — a tall viewport dwarfs a short modal. Narrower width = modal fills more of the frame.
- **Force hard-to-reach states** (e.g. a failed save) by intercepting the API with `browser_run_code_unsafe` + `page.route('**/api/...', ...)`.
    - Gotcha: `setTimeout` is undefined in that context — use `await page.waitForTimeout(ms)` for delays.
- **Save** under `.playwright-mcp/` (gitignored) with clear `-before`/`-after` (+ state) names, e.g. `behavior-wizard-proxy-after-error.png`.

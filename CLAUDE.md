## ClaudeOnRails Configuration

You are working on Quepid, a Rails application. Review the ClaudeOnRails context file at @.claude-on-rails/context.md

We run Quepid in Docker primarily, don't run Rails and other build tasks locally..

To set up the envirnoment use:

`bin/setup_docker`.

To start rails:

`bin/docker s`

Most commands you want to run you can just prefix with `bin/docker r bundle exec` so `rails console --environment=test` becomes `bin/docker r bundle exec rails console --environment=test`

Use yarn instead of npm for package management.

Run javascript tests via `bin/docker r yarn test`.


Documentation goes in the `docs` directory, not a toplevel `doc` directory.

To understand the data model used by Quepid, consult `./docs/data_mapping.md`.

To understand how the application is built, consult `./docs/app_structure.md`.


Instead of treating true/false parameters as strings in controller methods use our helper `archived = deserialize_bool_param(params[:archived])` to make them booleans.

We use .css, we do not use .scss.

Never do $window.location.href= '/', do $window.location.href= caseTryNavSvc.getQuepidRootUrl();.

Likewise urls generated should never start with / as we need relative links.

In Ruby we say `credentials?` versus `has_credentials?` for predicates.

In JavaScript, use `const` or `let` instead of `var`. When writing multiline ternary expressions, keep `?` and `:` at the end of the line, not the start of the next line, to avoid JSHint "misleading line break" errors.

## Migrating angular-ui-bootstrap → native Bootstrap 5

The Angular case UI (`app/views/layouts/core.html.erb`) loads **Bootstrap 3** CSS via `core.css`. The non-Angular UI loads BS5 via `application.css`. They are separate stylesheet worlds. When migrating a uib directive (`uib-popover`, `uib-tooltip`, ...) to native `window.bootstrap.*` — see existing examples in `app/assets/javascripts/directives/quepidPopover.js` and `quepidTooltip.js` — expect these traps:

1. **BS5 component CSS is not loaded.** Port the needed rules from `node_modules/bootstrap/dist/css/bootstrap.css` into `app/assets/stylesheets/bootstrap5-compat.css` and include it in `buildCoreCSS()` in `build_css.js` *after* `bootstrap3-add.css` so cascade order favours BS5. Scope new collapse-style rules (e.g. `.accordion-collapse.collapse:not(.show)`) so they don't clobber BS3's `.collapse.in` ecosystem or `quepid-collapse`.

2. **`html { font-size: 62.5% }`** is set on the Angular UI (1rem = 10px). BS5's rem-based defaults render ~37% smaller than intended. Override the relevant CSS variables (`--bs-popover-font-size: 14px`, `--bs-tooltip-padding-x`, etc.) with **px values** in the compat CSS. Do not change the root font-size — BS3 depends on it.

3. **BS3's `.fade { opacity: 0 }` has no `.fade.show` counterpart in this bundle.** Pass `animation: false` in the BS5 component config so it never adds `.fade`. Do *not* port BS5's `.fade:not(.show)` rule — it would clobber BS3 modals/dropdowns that use `.fade.in`.

4. **BS3 properties leak through where BS5 has no rule on `.popover`/`.tooltip`/etc.** Example: BS3 `.popover { padding: 1px }` wins because BS5 puts padding on `.popover-header` / `.popover-body` instead. Reset bleed-through properties explicitly in the compat CSS.

5. **Verify visually before declaring done.** Two of the four traps above produce *invisible-but-present* failures (popover element in DOM, `aria-describedby` set, but nothing visible). Static analysis won't catch them. Use Playwright MCP (or have the user screenshot DevTools' Computed panel for the popover element) and confirm `display`, `opacity`, `font-size`, and `transform` are sensible.

Migration progress and per-component notes live in `docs/bootstrap_angular_plugins.md`.

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

## Bootstrap 5 JavaScript on Angular `core` (BS5 CSS + patch sheets)

The Angular case UI (`app/views/layouts/core.html.erb`) loads **`core.css`**: npm **Bootstrap 5** first, then Quepid layers (`core-additions.css` — Quepid layout without Bootstrap-class selectors; **`bootstrap5-compat.css`** — all Bootstrap-class shims, navbar brand skin, modals, popovers, fluid `.container`, dev-panel chrome, etc.). The historical **`bootstrap3-add.css`** layer has been retired — its navbar brand skin is now consolidated into `bootstrap5-compat.css`. **`app/javascript/angular_app.js`** pins BS5 **`window.bootstrap`** for popovers, tooltips, dropdowns, accordion, tabs, modals (`$quepidModal`), and similar — angular-ui-bootstrap is not in the tree. The non-Angular UI loads BS5 via `application.css`. The two are separate stylesheet worlds. When you **add or change** BS5-driven UI on `core` (or more rules in `bootstrap5-compat.css`), use `app/assets/javascripts/directives/quepidPopover.js` and `quepidTooltip.js` as patterns and expect these traps:

1. **BS5 component rules may be incomplete for a widget.** Port the needed rules from `node_modules/bootstrap/dist/css/bootstrap.css` into `app/assets/stylesheets/bootstrap5-compat.css` and include it in `buildCoreCSS()` in `build_css.js` *after* `core-additions.css` so cascade order favours BS5. Scope new collapse-style rules (e.g. `.accordion-collapse.collapse:not(.show)`) so they don't clobber legacy `.collapse.in` patterns or `quepid-collapse`.

2. **Root `font-size` and rem-based BS5 defaults.** `bootstrap5-compat.css` comment blocks historically assumed **`html { font-size: 62.5% }`** (1rem = 10px); that rule is **not** set in-repo on `core` today (`core.html.erb` / `core-additions.css`). If **computed** root `font-size` is not 16px, rem-based BS5 defaults may look wrong — override the relevant **`--bs-*`** vars with **px** in compat CSS when tuning widgets, and verify computed styles. Do not change root font-size casually without checking the whole **`core`** stack.

3. **Legacy `.fade` + `.in` vs BS5 `.fade.show`.** Pass `animation: false` in the BS5 component config so it never adds `.fade`. Do *not* port BS5's `.fade:not(.show)` rule — it would clobber modals/dropdowns that still use `.fade.in`.

4. **Earlier-layer rules can win on shared selectors** (e.g. `.popover { padding: 1px }` from an old patch while BS5 puts padding on `.popover-header` / `.popover-body`). Reset bleed-through properties explicitly in the compat CSS.

5. **Verify visually.** Some of these traps produce *invisible-but-present* failures (popover element in DOM, `aria-describedby` set, but nothing visible). Static analysis won't catch them. Use Playwright MCP (or have the user screenshot DevTools' Computed panel for the popover element) and confirm `display`, `opacity`, `font-size`, and `transform` are sensible.

More detail and markup examples: `docs/bootstrap_angular_plugins.md`. Per-component angular-ui-bootstrap inventory (historical): `docs/archived/bootstrap_angular_plugins_full.md`.

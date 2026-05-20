## General Configuration / Execution

- You are working on Quepid, a Rails application. Review the ClaudeOnRails context file at @.claude-on-rails/context.md
- We run Quepid in Docker primarily, don't run Rails and other build tasks locally.
- To set up the environment use:
    `bin/setup_docker`.
- To start Quepid use:
    `bin/docker s`
- Most commands you want to run you can just prefix with `bin/docker r bundle exec` so `rails console --environment=test` becomes `bin/docker r bundle exec rails console --environment=test`
- After CSS or vendor JS changes make sure you rebuild:
    `bin/docker r yarn build`              # full frontend build
    `bin/docker r yarn build:css`          # core.css / application.css only
    `bin/docker r yarn build:angular-vendor`  # BS5 + splainer-search bundle


## Frontend

- The core case app is built using AngularJS 1.8 but we are in the process of removing our AngularJS dependency.
- In place of AngularJS we are using vanilla JS and StimulusJS along with various components of Hotwire, our goal is to have a modern Rails stack application.


## Backend

- We are currently using Rails 8.1.3 and Ruby 4.0.1.
- Tests for Ruby are written in Minitest.
- Long-running work uses ActiveJob + SolidQueue, ActionCable pushes state to the frontend.
- Solr JSONP forces the case page to HTTP while the rest may be HTTPS. When touching `CoreController` or SSL config, make sure to take this into consideration.


## JavaScript

- Use yarn instead of npm for package management.


## Tests

- Run JavaScript tests via `bin/docker r yarn test`.
- Run Rails tests via `bin/docker r rails test`.
- Lint CSS via `bin/docker r yarn lint:css` or `bin/docker r rails test:stylelint` (config: `.stylelintrc.json`).


## Documentation

- Documentation goes in the `docs` directory, not a toplevel `doc` directory.
- To understand the data model used by Quepid, consult `./docs/data_mapping.md`.
- To understand how the application is built, consult `./docs/app_structure.md`.


## Code Style

- Instead of treating true/false parameters as strings in controller methods use our helper `archived = deserialize_bool_param(params[:archived])` to make them booleans.
- Never do $window.location.href= '/', do $window.location.href= caseTryNavSvc.getQuepidRootUrl();.
- Likewise urls generated should never start with / as we need relative links.
- In Ruby we say `credentials?` versus `has_credentials?` for predicates.
- In JavaScript, use `const` or `let` instead of `var`. When writing multiline ternary expressions, keep `?` and `:` at the end of the line, not the start of the next line, to avoid JSHint "misleading line break" errors.
- Prefer BS5 spacing utilities over one-off margins.


## UI/UX and Styling

- We use .css, we do not use .scss.


## Bootstrap 5 JavaScript on Angular `core` (BS5 CSS + patch sheets)

- The Angular case UI (`app/views/layouts/core.html.erb`) loads **`core.css`**: npm **Bootstrap 5** first, then Quepid layers (`core-additions.css` — Quepid layout without Bootstrap-class selectors; **`bootstrap5-compat.css`** — all Bootstrap-class shims, navbar brand skin, modals, popovers, fluid `.container`, dev-panel chrome, etc.).
- **`app/javascript/angular_app.js`** pins BS5 **`window.bootstrap`** for popovers, tooltips, dropdowns, accordion, tabs, modals (`$quepidModal`), and similar.
- The non-Angular UI loads BS5 via `application.css`. The two are separate stylesheet worlds. When you **add or change** BS5-driven UI on `core` (or more rules in `bootstrap5-compat.css`), use `app/assets/javascripts/directives/quepidPopover.js` and `quepidTooltip.js` as patterns and expect these traps:
- **Root `font-size` and rem-based BS5 defaults.** `bootstrap5-compat.css` comment blocks historically assumed **`html { font-size: 62.5% }`** (1rem = 10px); that rule is **not** set in-repo on `core` today (`core.html.erb` / `core-additions.css`). If **computed** root `font-size` is not 16px, rem-based BS5 defaults may look wrong — override the relevant **`--bs-*`** vars with **px** in compat CSS when tuning widgets, and verify computed styles. Do not change root font-size casually without checking the whole **`core`** stack.
- **Earlier-layer rules can win on shared selectors** (e.g. `.popover { padding: 1px }` from an old patch while BS5 puts padding on `.popover-header` / `.popover-body`). Reset bleed-through properties explicitly in the compat CSS.
- **Verify visually.** Some of these traps produce *invisible-but-present* failures (popover element in DOM, `aria-describedby` set, but nothing visible). Static analysis won't catch them. Use Playwright MCP (or have the user screenshot DevTools' Computed panel for the popover element) and confirm `display`, `opacity`, `font-size`, and `transform` are sensible.

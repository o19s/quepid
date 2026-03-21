## ClaudeOnRails Configuration

You are working on Quepid, a Rails application. Review the ClaudeOnRails context file at @.claude-on-rails/context.md

We run Quepid in Docker primarily, don't run Rails and other build tasks locally.

To set up the environment use:

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


## Stimulus / New UI Conventions

The new UI lives at `/case/:id/try/:try_number/new_ui` and uses Rails ERB + Stimulus controllers (no Angular). These rules apply to all code under `app/javascript/controllers/` and `app/javascript/modules/`.

### URLs and API calls

Always use `apiUrl()` from `modules/api_url` for building fetch URLs. Never construct URLs with `${rootUrl}/...` or hardcode a leading `/`. This ensures relative URLs when there is no root prefix, and correct joining when Quepid is mounted at a subpath.

```js
import { apiUrl, csrfToken } from "modules/api_url"
fetch(apiUrl(`api/cases/${caseId}/queries`), { headers: { "X-CSRF-Token": csrfToken() } })
```

### Stimulus controller patterns

- **Outlets for inter-controller communication**: Use `static outlets = ["other-controller"]` and call methods on `this.otherControllerOutlets`. Never use `this.application.getControllerForElementAndIdentifier()`.
- **Lifecycle cleanup**: If a controller starts async work (fetch, timers, observers), implement `disconnect()` to cancel it. Use `AbortController` for fetch requests.
- **Values syntax**: Use the verbose form with type and default: `static values = { queryId: { type: Number }, queryText: { type: String, default: "" } }`.
- **Public API**: Methods called by outlets from other controllers should be clearly named (`collapse()`, `expand()`, `rerunSearch()`). Keep `toggle()` as the user-facing action.

### CSS and styling

- Never use inline `style="..."` attributes in Stimulus controller JS (`renderResults`, etc.). Define CSS classes in a `.css` file under `app/assets/stylesheets/` and add it to `build_css.js`.
- Use semantic HTML (`<ol>` for ranked lists, `<li>` for list items, etc.).
- Escape values for the correct context: `_escapeHtml()` for text content, `_escapeAttr()` for HTML attributes (`src`, `href`).

### Testing

- Every Stimulus controller needs a Vitest test file at `test/javascript/controllers/<name>_controller.test.js`.
- Pure JS modules get tests at `test/javascript/modules/<name>.test.js`.
- `yarn test` runs both Angular (Karma) and Stimulus (Vitest) test suites.
- When adding a new module, add a resolve alias in `vitest.config.js` to map the importmap pin to the file path.
- Rails controller actions serving the new UI need tests in `test/controllers/` using `assert_select` for response assertions (not `assigns` or `assert_template` which require an extra gem).

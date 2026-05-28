## ClaudeOnRails Configuration

You are working on Quepid, a Rails application. Review the ClaudeOnRails context file at @.claude-on-rails/context.md

We run Quepid in Docker primarily, don't run Rails and other build tasks locally.

Assume Quepid is already up and running. Check first (for example, `docker compose ps` or a request to http://localhost) and only start it if it isn't:

`bin/setup_docker`.

To set up the environment use:

`bin/setup_docker`.

Most commands you want to run you can just prefix with `bin/docker r bundle exec` so `rails console --environment=test` becomes `bin/docker r bundle exec rails console --environment=test`

Use yarn instead of npm for package management.

Run javascript tests via `bin/docker r yarn test`.


Documentation goes in the `docs` directory, not a toplevel `doc` directory. When editing markdown, update only what changed -- avoid rewriting unrelated sections; we want minimal churn so the diff is clear.

To understand the data model used by Quepid, consult `./docs/data_mapping.md`.

To understand how the application is built, consult `./docs/app_structure.md`.


Instead of treating true/false parameters as strings in controller methods use our helper `archived = deserialize_bool_param(params[:archived])` to make them booleans.

We use .css, we do not use .scss.

Never do $window.location.href= '/', do $window.location.href= caseTryNavSvc.getQuepidRootUrl();.

Likewise urls generated should never start with / as we need relative links.

In Ruby we say `credentials?` versus `has_credentials?` for predicates.

In JavaScript, use `const` or `let` instead of `var`. When writing multiline ternary expressions, keep `?` and `:` at the end of the line, not the start of the next line, to avoid JSHint "misleading line break" errors.

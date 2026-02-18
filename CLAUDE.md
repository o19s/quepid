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

To understand how the application is built, consult `./docs/app_structure.md`. For a full docs index, see [docs/README.md](docs/README.md).

For full development setup (Docker, local, tests, troubleshooting), see [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md).


Instead of treating true/false parameters as strings in controller methods use our helper `archived = deserialize_bool_param(params[:archived])` to make them booleans.

We use .css, we do not use .scss.

For URL and navigation rules (never hardcode `/`; use `getQuepidRootUrl()` or `quepid_root_url`), see [docs/api_client.md](docs/api_client.md).

In Ruby we say `credentials?` versus `has_credentials?` for predicates.

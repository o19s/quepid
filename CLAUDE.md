## ClaudeOnRails Configuration

You are working on Quepid, a Rails application. Review the ClaudeOnRails context file at @.claude-on-rails/context.md

Use yarn instead of npm for package management.

Documentation goes in the `docs` directory, not a toplevel `doc` directory.

To understand the data model used by Quepid, consult `./docs/data_mapping.md`.

To understand how the application is built, consult `./docs/app_structure.md`.


Instead of treating true/false parameters as strings in controller methods use our helper `archived = deserialize_bool_param(params[:archived])` to make them booleans.

We use .css, we do not use .scss.

Never do $window.location.href= '/', do $window.location.href= caseTryNavSvc.getQuepidRootUrl();.

Likewise urls generated should never start with / as we need relative links.

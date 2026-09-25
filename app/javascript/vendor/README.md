# Vendored frontend libraries (AngularJS stack)

Third-party JavaScript that Quepid previously loaded from `package.json` now lives here so it can be edited in-repo alongside application code.

**Core Angular** (`angular`) remains installed from npm; other Angular-era packages listed below live under `app/javascript/vendor/`.

| Directory | Role |
|-----------|------|
| `angular-sanitize` | AngularJS satellite: `ngSanitize` |
| `angular-ui-ace/` | `ui.ace` |

JSON tree display no longer uses a vendored Angular directive — see `utils/json_explorer.js` and `app/assets/stylesheets/json-explorer.css` (copied to `builds/` by `build_css.js`).

**splainer-search** is loaded from npm (see root `package.json`) and bridged onto Angular DI in **`app/javascript/splainer_search_adapter.js`**.

Angular unit tests load **`angular-mocks`** from `node_modules/` (see Karma config).

Subdirectories retain upstream **`package.json` / license files** for version provenance where applicable.

Imports in `app/javascript/angular_app.js` point at **explicit file paths** rather than directory/package names — they intentionally do **not** go through each upstream `package.json`'s `main` field. This is so the source we ship is the source we edit. Don't replace these with bare-name imports without checking the bundle source.

To **restore a dependency to npm**, add it again in `package.json` and replace the `./vendor/...` import(s) in `app/javascript/angular_app.js` (and Karma or `build_css.js` paths if needed).

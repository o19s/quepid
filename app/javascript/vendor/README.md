# Vendored frontend libraries (AngularJS stack)

Third-party JavaScript that Quepid previously loaded from `package.json` now lives here so it can be edited in-repo alongside application code.

**Core Angular** (`angular`) remains installed from npm; other Angular-era packages listed below live under `app/javascript/vendor/`.

| Directory | Role |
|-----------|------|
| `angular-route`, `angular-sanitize` | AngularJS satellites: `ngRoute`, `ngSanitize` |
| `angular-countup` | `countUp` module |
| `angular-wizard/` | `mgo-angular-wizard` |
| `angular-ui-sortable/` | `ui.sortable` |
| `angular-utils-pagination/` | `angularUtils.directives.dirPagination` |
| `angular-timeago/` | `yaru22.angular-timeago` |
| `angular-csv-import/` | CSV import directives |
| `angular-flash/` | Flash alerts |
| `angular-ui-ace/` | `ui.ace` |
| `ng-json-explorer/` | `ngJsonExplorer` |
| `ng-tags-input/` | Tag input; CSS copied in `build_css.js` from `build/*.min.css` |
| `ngclipboard/` | Clipboard helper (used with npm `clipboard`) |

**splainer-search** is loaded from npm (see root `package.json`) and bridged onto Angular DI in **`app/javascript/splainer_search_angular_bridge.js`**.

Angular unit tests load **`angular-mocks`** from `node_modules/` (see Karma config).

Subdirectories retain upstream **`package.json` / license files** for version provenance where applicable.

Imports in `app/javascript/angular_app.js` point at **explicit file paths** rather than directory/package names — they intentionally do **not** go through each upstream `package.json`'s `main` field. This is so the source we ship is the source we edit. For example, `ng-tags-input`'s upstream `main` is the minified `build/ng-tags-input.min.js`; we import `build/ng-tags-input.js` (unminified) so the vendored copy stays readable. Don't "fix" these to bare-name imports.

To **restore a dependency to npm**, add it again in `package.json` and replace the `./vendor/...` import(s) in `app/javascript/angular_app.js` (and Karma or `build_css.js` paths if needed).

# Vendored frontend libraries

Third-party JavaScript that Quepid previously loaded from `package.json` now lives here so it can be edited in-repo alongside application code.

The remaining files here are legacy vendor assets retained for the active frontend bundles.

JSON tree display no longer uses a vendored Angular directive — see `utils/json_explorer.js` and `app/assets/stylesheets/json-explorer.css` (copied to `builds/` by `build_css.js`).

**splainer-search** is loaded from npm (see root `package.json`) and initialized in the framework-free case bundle by **`app/javascript/utils/splainer_search_runtime.js`**.

Subdirectories retain upstream **`package.json` / license files** for version provenance where applicable.

Imports in `app/javascript/core_vendor.js` point at **explicit file paths** rather than directory/package names — they intentionally do **not** go through each upstream `package.json`'s `main` field. This is so the source we ship is the source we edit. Don't replace these with bare-name imports without checking the bundle source.

To **restore a dependency to npm**, add it again in `package.json` and replace the `./vendor/...` import(s) in `app/javascript/core_vendor.js`.

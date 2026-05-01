# Vendored angular-ui-bootstrap

This tree is [angular-ui-bootstrap](https://github.com/angular-ui/bootstrap) **2.5.6**, vendored under the **MIT** license (see `LICENSE`).

- **`src/`** — directive and service modules (edit these to change behavior).
- **`template/`** — HTML snippets compiled to `*.html.js` `$templateCache` modules (edit `*.html`; when changing templates you must sync the corresponding `*.html.js` files, or regenerate them with the upstream `grunt html2js` task from the same package version).
- **`index.js`** — esbuild entry that imports modules in upstream build order and registers `ui.bootstrap` / `ui.bootstrap.tpls` exactly like `dist/ui-bootstrap-tpls.js`.

We use `*-nocss` entry points for components that ship optional inline CSS so styling continues to come from Quepid’s Bootstrap 3 stylesheet bundle, not from JavaScript-injected rules.

To drop the vendored copy and return to npm, restore the `angular-ui-bootstrap` dependency and `import 'angular-ui-bootstrap'` in `angular_app.js`.

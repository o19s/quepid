# How JavaScript reaches the browser

Quepid serves JavaScript through two mechanisms. Which one a page uses depends on its layout.

| Mechanism | What it is | Output |
|-----------|-----------|--------|
| **Importmap** (`importmap-rails`) | Browser-native ES modules. Source files under `app/javascript/` are served as-is (via Propshaft) and resolved by bare name from `config/importmap.rb`. No bundling step. | none |
| **esbuild bundles** (`jsbundling-rails`) | Source is bundled into IIFE scripts by [esbuild.config.js](../esbuild.config.js). | `app/assets/builds/*.js` (git-ignored) |

## Which layout uses what

| Layout | Pages | JavaScript loaded |
|--------|-------|-------------------|
| `application.html.erb`, `admin.html.erb` | Home, books, teams, admin, and other Rails pages | Importmap entry `application_modern` (Turbo, Stimulus, all controllers via `controllers/index.js`, Bootstrap, CodeMirror, vega) |
| `core.html.erb` | The case page (`/case/:id`) | Importmap for `vega_globals` and `bootstrap_globals`, then bundles `core_vendor.js` and `core_case.js`, then classic scripts `footer.js`, `tour.js`, `ace_config.js` |
| `analytics.html.erb` | Analytics dashboards | Importmap for `vega_globals`, then bundle `analytics.js` |

The case page is bundled because it depends on legacy UMD vendor libraries that need to be exposed as `window` globals, which esbuild handles in `core_vendor.js`.

## The bundles

All defined in [esbuild.config.js](../esbuild.config.js):

| Name | Entry | Output | Purpose |
|------|-------|--------|---------|
| `core-case` | `app/javascript/core_stimulus.js` | `core_case.js` | Case page: registers only the Stimulus controllers the case layout renders, plus runtime modules |
| `core-vendor` | `app/javascript/core_vendor.js` | `core_vendor.js` | Third-party code exposed as `window` globals (Ace, Sortable, Shepherd/Tether, URI.js, file-saver, splainer-search) |
| `analytics` | `app/javascript/analytics.js` | `analytics.js` | Analytics pages |

Source files are shared with the importmap, so **imports in shared code must be bare names** (`utils/flash`, `controllers/application`). The `core-case` and `core-vendor` bundles teach esbuild how to resolve those names through the `alias` maps in `esbuild.config.js`, and the importmap does the same in the browser through `config/importmap.rb`.

## Adding a module

Files under `controllers/`, `utils/`, `stores/` and `api/` are picked up automatically by `pin_all_from` in `config/importmap.rb`; do not add a `pin` line for them.

Top-level modules (for example `core_runtime.js`) and other directories (for example `modules/`) need an explicit `pin`. The bundles need an alias in `esbuild.config.js` only for a new top-level bare name, such as `modules`.

For a new npm package:

- **Rails pages:** `bin/importmap pin <package>`, which adds a pin to `config/importmap.rb`.
- **Case page:** import it from `core_vendor.js` (and assign it to `window` if legacy code needs the global), then rebuild.

## Commands

```bash
docker compose exec app yarn build                # CSS + all JS bundles
docker compose exec app yarn build:core           # core-case + core-vendor
docker compose exec app yarn build:analytics
docker compose exec app node esbuild.config.js core-case --watch   # one bundle, watching
```

With `bin/docker s`, `Procfile.dev` keeps `core_vendor`, `core_case` and CSS rebuilt on save; hard-refresh the browser afterward. Importmap-served files need no build, just a refresh.

In production, `jsbundling-rails` runs `yarn build` as part of `assets:precompile`.

## Gotchas

- **Edits to `controllers/`, `utils/` and similar affect both mechanisms.** A change that works on Rails pages (importmap, no build) can still need a `core-case` rebuild to show up on the case page.
- **Bundles are IIFEs, so top-level `var`/`function` do not become globals.** Legacy code that expects a global must be assigned to `window` explicitly, as `core_vendor.js` does.
- **`app/assets/builds/` is git-ignored.** A fresh checkout has no bundles until `yarn build` runs (`bin/setup_docker` does this).
- **Classic scripts** (`footer.js`, `tour.js`, `ace_config.js`) are plain `<script>` files included by the core layout. They are neither bundled nor importmapped.

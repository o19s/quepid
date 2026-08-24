# JavaScript tooling (lint, format, unit tests)

Quepid runs **two parallel JavaScript worlds** during the Angular → Hotwire migration:

| Tree | Role | Lint | Unit tests |
|------|------|------|------------|
| `app/assets/javascripts/` | Legacy Angular case app (esbuild → `app/assets/builds/`) | **JSHint** (`.jshintrc`) | **Karma + Jasmine** (`spec/javascripts/`) |
| `app/javascript/` | Importmap + Stimulus + Turbo (`application_modern.js`, controllers) | **ESLint + Prettier** (`eslint.config.mjs`, `.prettierrc.json`) | **Vitest** (`app/javascript/**/*.test.js`, `vitest.config.js`) |

Playwright E2E (`test/playwright/`) covers full-browser flows for both stacks; it is not a substitute for fast unit tests.

## ESLint + Prettier (`app/javascript`)

### Scope

Lint/format scope is defined once in **`config/javascript_lint_scope.mjs`** and used by:

- `eslint.config.mjs` (ignores + file globs) — **all** modern `app/javascript` except vendor/esbuild bridges
- `scripts/javascript_lint.mjs` + `scripts/filter_javascript_prettier_paths.mjs` — **Prettier only on `api/` and `utils/`** for now (avoids a mass reformat of controllers/modules in one PR)
- `scripts/filter_javascript_lint_paths.mjs` (ESLint pre-commit)
- `bin/eslint-staged` / `bin/prettier-staged`

That tree includes:

- `app/javascript/controllers/`, `api/`, `utils/`, `modules/`
- Entry bundles: `application.js`, `application_modern.js`, `bootstrap_globals.js`, `vega_globals.js`, `analytics.js`

**Excluded** (esbuild bridges / vendor — not importmap Stimulus):

- `app/javascript/vendor/**`
- `app/javascript/angular_app.js`, `quepid_app.js`, `jquery_bundle.js`, `splainer_search_adapter.js`

Importmap bare imports (`api/fetch`, `utils/quepid_root`, npm pins) are not Node-resolvable; we do not use `eslint-plugin-import`.

ESLint `no-unused-vars` and `no-console` are off during migration (unused `catch (e)`, Stimulus action params, debug `console.log`).

### Formatting conventions

Quepid's `app/javascript/` style is **double quotes**, no semicolons, 2-space indent (`.prettierrc.json`). Newer Stimulus controllers already follow that; a few older files still have single quotes from earlier edits — converge on double quotes when you touch them.

Prettier enforcement is limited to **`api/` and `utils/`** for now so this tooling PR does not reformat every controller and `modules/editor.js` at once. ESLint still covers the full modern tree. `.editorconfig` still applies (e.g. final newline).

`eslint-config-prettier` disables ESLint rules that conflict with Prettier; run both (`lint:js` + `format:js:check`) — formatting is not enforced through ESLint plugins.

### Commands

```bash
bin/docker r yarn lint:js              # ESLint (eslint.config.mjs)
bin/docker r yarn format:js:check      # Prettier check only
bin/docker r yarn format:js            # Prettier write (fix formatting)
bin/docker r rails test:eslint           # ESLint + Prettier check (CI-style)
bin/docker r rails test:frontend         # Vitest + Karma + JSHint + ESLint + Stylelint
```

After pulling these dependencies, run `bin/docker r yarn install` once.

### Pre-commit

`.githooks/pre-commit` (via `bin/install-git-hooks`) runs on staged files:

- `app/assets/javascripts/*.js` → JSHint
- `app/javascript/**/*.js` (scoped) → ESLint + Prettier

[pre-commit.com](https://pre-commit.com) hooks: `jshint-staged`, `eslint-staged`, `prettier-staged`, `stylelint-staged`.

### Editor

`.devcontainer/devcontainer.json` includes the ESLint and EditorConfig extensions. Point ESLint at the workspace `eslint.config.mjs`; Prettier uses `.prettierrc.json`.

## JSHint (legacy `app/assets/javascripts`)

Still the linter for the Angular asset tree. See `DEVELOPER_GUIDE.md` § JS Lint.

```bash
bin/docker r rails test:jshint
```

## Vitest (`app/javascript`)

Unit tests for the modern importmap stack. Legacy Angular specs remain on Karma (`spec/javascripts/`).

### Setup

- Config: `vitest.config.js` (`happy-dom`, import aliases for `api/fetch` and `utils/quepid_root`)
- Specs: `app/javascript/**/*.test.js` (colocated with source, e.g. `api/fetch.test.js`)
- Module-level singletons (one-time warn flags, cached state): use `vi.resetModules()` and a fresh `import()` in `beforeEach` so tests do not leak state across files.

### Commands

```bash
bin/docker r yarn test:unit           # run once
bin/docker r yarn test:unit:watch     # watch mode
bin/docker r rails test:vitest        # same as yarn test:unit (CI-style)
```

`rails test:frontend` runs Vitest **before** Karma so fast failures surface first.

Add new importmap bare imports to `vitest.config.js` `resolve.alias` when tests import them.

### PR policy

- **`api/` and `utils/`** — New or materially changed logic requires a colocated `*.test.js` in the **same PR**.
- **`controllers/`** — Add Vitest when you touch a controller for Angular migration or meaningful behavior change. Do not blanket-rewrite untested controllers for coverage alone.
- Run `bin/docker r yarn test:unit` before merging JS changes that add or update specs.

## Unit test strategy: Karma vs Vitest

### Current state

- **Vitest + happy-dom** — `app/javascript/**/*.test.js` (start with `api/fetch`, `utils/quepid_root`; add Stimulus controller tests as needed).
- **Karma + Jasmine + angular-mocks** — ~41 specs under `spec/javascripts/`, all Angular.
- Karma loads **pre-built esbuild bundles**; every `karma:run` runs `yarn build` first.

---

## Related docs

- [`DEVELOPER_GUIDE.md`](../DEVELOPER_GUIDE.md) — run commands, Karma, Playwright
- [`app_structure.md`](./app_structure.md) — frontend layout
- [`todo/angularjs_removal_inventory.md`](./todo/angularjs_removal_inventory.md) — migration scope

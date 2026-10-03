# JavaScript tooling (lint, format, unit tests)

Quepid has a modern JavaScript tree plus a small set of classic compatibility scripts:

| Tree | Role | Lint | Unit tests |
|------|------|------|------------|
| `app/javascript/tour.js` | Classic script still loaded by the core layout | **ESLint + Prettier (enforced)** | Browser/manual coverage |
| `app/javascript/` | Importmap + Stimulus + Turbo (`application_modern.js`, controllers) | **ESLint** (full modern tree); **Prettier** (`api/`, `utils/` only; classic core scripts above are also Prettier-enforced) | **Vitest** (`test/javascript/**/*.test.js`, `vitest.config.js`) |
| `test/javascript/`, `scripts/`, `lib/`, `db/scorers/`, `db/mapper_based_search_engines/` | Vitest specs, build/config tooling, and server-side JavaScript sandboxes | **ESLint** | Vitest specs where applicable |

Playwright E2E (`test/playwright/`) covers full-browser flows for both stacks; it is not a substitute for fast unit tests. Specs are TypeScript; `test/playwright/tsconfig.json` enables Node typings (`@types/node`) for `node:fs` / `node:path` imports.

## ESLint + Prettier

### Scope

Lint/format scope is defined once in **`config/javascript_lint_scope.mjs`** and used by:

- `eslint.config.mjs` (ignores + file globs) — **all** first-party JavaScript, with classic compatibility scripts using their legacy rules
- `scripts/javascript_lint.mjs` + `scripts/filter_javascript_prettier_paths.mjs` — **Prettier only on `api/`, `utils/`, and the classic core scripts** for now (avoids a mass reformat of controllers/modules in one PR)
- `scripts/filter_javascript_lint_paths.mjs` (ESLint pre-commit)
- `bin/eslint-staged` / `bin/prettier-staged`

That tree includes:

- `app/javascript/controllers/`, `api/`, `utils/`, `modules/`
- Entry bundles: `application.js`, `application_modern.js`, `core_stimulus.js`, `bootstrap_globals.js`, `vega_globals.js`, `analytics.js`

**Excluded** (esbuild bridges / vendor — not importmap Stimulus):

- `app/javascript/vendor/**`
- `app/javascript/core_vendor.js`, `app/javascript/utils/splainer_search_runtime.js`

Importmap bare imports (`api/fetch`, `utils/quepid_root`, npm pins) are not Node-resolvable; we do not use `eslint-plugin-import`.

ESLint `no-unused-vars` and `no-console` are off during migration (unused `catch (e)`, Stimulus action params, debug `console.log`). The server-side scorer and mapper files also disable rules that assume ordinary module scope because MiniRacer supplies their globals and evaluates user code in the same sandbox. Those files are still parsed and checked for standard syntax errors.

### Formatting conventions

Quepid's `app/javascript/` style is **double quotes**, **no semicolons**, **no trailing commas** (`trailingComma: "none"` in `.prettierrc.json`), 2-space indent. Write **new** code to these conventions; do not reformat older lines or unrelated sections just to normalize style.

**Trailing commas:** unlike many JS projects, Quepid does **not** use them in modern JS. Ruby is the opposite — RuboCop **requires** trailing commas on multiline hashes. See `CLAUDE.md` § Agent checklist.

**Prettier** is enforced on **`api/`, `utils/`, and the classic core scripts** (`tour`) only (via pre-commit and `yarn format:js*`). Do **not** run Prettier on `controllers/`, `modules/`, or entry bundles for now — whole-file Prettier would churn older single-quote files. Hand-apply modern style to **new** lines you add there.

**ESLint** covers the full modern tree under `app/javascript/`, Vitest JavaScript specs, build/config scripts, `lib/`, and DB scorer/mapper sources. Pre-commit runs ESLint on staged `controllers/`, `modules/`, etc.; run the full `yarn lint:js` command before finishing. Specs follow formatting conventions manually.

**Mixed-style files** (e.g. an older controller with single quotes): modern conventions on **new** code; when changing an existing line, match its surrounding style.

`.editorconfig` still applies (e.g. final newline).

`eslint-config-prettier` disables ESLint rules that conflict with Prettier; in `api/`/`utils/` run both (`lint:js` + `format:js:check`) — formatting is not enforced through ESLint plugins.

### Commands

```bash
bin/docker r yarn lint:js              # ESLint — first-party JavaScript scope
bin/docker r yarn format:js:check      # Prettier check — api/, utils/, classic core scripts
bin/docker r yarn format:js            # Prettier write — api/, utils/, classic core scripts
bin/docker r rails test:eslint         # ESLint + Prettier check (CI-style)
bin/docker r rails test:frontend       # Vitest + ESLint + Stylelint
```

Per-file ESLint (e.g. a controller outside the Prettier scope):

```bash
bin/docker r npx eslint app/javascript/controllers/foo_controller.js
```

Do not run `prettier --write` on paths outside `api/`/`utils/` unless you deliberately want a whole-file reformat.

After pulling these dependencies, run `bin/docker r yarn install` once.

Run Vitest and Stryker inside the container, not on the host. `node_modules/` is shared with the Linux container, so it holds Linux-only native bindings (e.g. `@rolldown/binding-linux-*`), and host runs fail with `Cannot find module './rolldown-binding.wasi.cjs'`. ESLint and Prettier have no native bindings and run either way. `docker exec quepid_app …` reuses the running app container, which is faster than `bin/docker r` for repeated Vitest/Stryker runs.

### Pre-commit

`.githooks/pre-commit` (via `bin/install-git-hooks`) runs on staged files:

- `app/javascript/**/*.js` (lint scope) → **ESLint** via `eslint-staged` + `filter_javascript_lint_paths.mjs`
- `app/javascript/api/**`, `app/javascript/utils/**`, and the classic core scripts (`tour`) → **Prettier** via `prettier-staged` + `filter_javascript_prettier_paths.mjs` (other modern paths are ESLint-only for now)

[pre-commit.com](https://pre-commit.com) hooks: `eslint-staged`, `prettier-staged`, `stylelint-staged`.

### Editor

`.devcontainer/devcontainer.json` includes the ESLint and EditorConfig extensions. Point ESLint at the workspace `eslint.config.mjs`; Prettier uses `.prettierrc.json`.

## Classic core scripts

`tour.js` is loaded directly by the core layout as a classic script because it still exposes and consumes browser globals. It is checked by blocking ESLint and Prettier (`lint:js`, `format:js:check`, pre-commit, CI), and its behavior should be verified through the affected core-page browser flow rather than duplicated in a separate module-test harness.

## Vitest (`app/javascript`)

Unit tests for the modern importmap stack.

### Setup

- Config: `vitest.config.js` (`happy-dom`, import aliases for `api/fetch` and `utils/quepid_root`)
- Specs: `test/javascript/**/*.test.js`, mirroring `app/javascript/` (not colocated), e.g. `test/javascript/api/fetch.test.js` tests `app/javascript/api/fetch.js`. Import the module under test by its bare importmap path (`api/fetch`, `utils/bs_modal`, `controllers/foo_controller`) via the `resolve.alias` entries in `vitest.config.js`, not a relative path back into `app/javascript/`.
- Module-level singletons (one-time warn flags, cached state): use `vi.resetModules()` and a fresh `import()` in `beforeEach` so tests do not leak state across files.

### Commands

```bash
bin/docker r yarn test:unit           # run once
bin/docker r yarn test:unit:watch     # watch mode
bin/docker r rails test:vitest        # same as yarn test:unit (CI-style)
```

Add new importmap bare imports to `vitest.config.js` `resolve.alias` when tests import them (controller specs use `app/javascript/test/stimulus_stub.js` for `@hotwired/stimulus`); `controllers/*` resolves via a wildcard alias, matching `pin_all_from` in `config/importmap.rb`, so individual controllers don't need their own entry.

### Controller test fixtures

Use `buildControllerFixture` from `test/javascript/support/controller_fixture.js`
for specs with repeated target/value setup. Pass `targets: { title: element }`
and `values: { url: "api/cases" }`; the builder supplies the singular target,
plural targets, presence flags, and value properties. An array supplies repeated
targets; `null` or an empty array represents an absent target. Use `element` for
an existing root and `overrides` for explicit instance state or method fakes.
Keep fixture-specific DOM construction and mutations in the spec.

The builder uses the existing Stimulus stub and does not invoke lifecycle hooks,
resolve ERB targets, or wire actions. Call lifecycle methods explicitly when
needed; browser tests cover the markup wiring. Leave small fixtures alone when
using the builder would add more ceremony than it removes.

### PR policy

- **`api/` and `utils/`** — New or materially changed logic requires a `*.test.js` in `test/javascript/` (mirroring the source path) in the **same PR**.
- **`controllers/`** — Add Vitest when you touch a controller for meaningful behavior change. Do not blanket-rewrite untested controllers for coverage alone.
- Run `bin/docker r yarn test:unit` before merging JS changes that add or update specs.

## StrykerJS mutation testing (`app/javascript/api`, `app/javascript/utils`)

Mutation testing checks whether Vitest specs actually fail when the code they cover is broken (a "mutant" — e.g. flipping `&&` to `||`, an `if (x)` to `if (true)`) — plain coverage only proves a line ran, not that a test would catch a change to it.

- Config: `stryker.config.mjs` (`vitest` test runner against `vitest.config.js`)
- Runs in **incremental mode** — results are cached in `tmp/stryker-tmp/incremental.json` (gitignored) and reused on the next run, so only mutants touched by changed files are re-tested. Delete that file (or the whole `tmp/stryker-tmp/` dir) to force a full run.
- Default scope: `app/javascript/api/**/*.js` and `app/javascript/utils/**/*.js` — the two directories with the strict "new logic needs a colocated test" PR policy above. `stores/` and nearly every controller also have specs, so run them on demand with `--mutate` (see below) rather than widening the default, which would make a full run much slower.
- Controller specs use the Stimulus stub (`app/javascript/test/stimulus_stub.js`) and call methods directly, so Stimulus never runs `connect()`/`disconnect()`, resolves targets/values from markup, or wires `data-action`. Lifecycle code shows up as `NoCoverage` unless the spec calls it itself; Playwright covers the wiring. Judge a controller by its actions and error paths, not its overall score.
- The classic core scripts are out of scope for mutation testing; browser verification covers their DOM and global-script behavior.

```bash
bin/docker r yarn test:mutation   # runs stryker, writes tmp/mutation-report/mutation-report.html
```

The incremental cache is only written when a run finishes, so a crash mid-run loses that run's results. To build results up in small pieces, narrow `--mutate` to a slice. The shared cache keeps results for files outside the slice so successive slices accumulate in the same `incremental.json` and a later full run reuses them:

```bash
bin/docker r yarn test:mutation --mutate "app/javascript/api/**/*.js"
bin/docker r yarn test:mutation --mutate "app/javascript/utils/core_*.js"
bin/docker r yarn test:mutation --mutate "app/javascript/controllers/import_*_controller.js" --ignoreStatic
```

**`--ignoreStatic`** — Stryker can't tell which tests cover module-level code (constant tables, top-level `new Set([...])`, and similar), so for each of those "static" mutants it reloads the module and re-runs the whole suite. When the planner warns that static mutants dominate the run (e.g. *"155 static mutants (7% of total) … estimated to take 94% of the time"*), add `--ignoreStatic` to skip them; they are reported as `Ignored` rather than tested. On one 16-file `utils/` slice this cut the estimate from about an hour to under two minutes. The trade-off is that mutations to module-level constants go unchecked, which is usually fine — they tend to be preset and lookup data.

```bash
bin/docker r yarn test:mutation --mutate "app/javascript/utils/query_service.js" --ignoreStatic
```

Survived/no-coverage mutants in the report point at either a missing test case or genuinely dead/defensive code — triage per file rather than chasing 100%.

## Unit test strategy

Unit tests are **Vitest + happy-dom** — `test/javascript/**/*.test.js` (shared modules plus Stimulus controller tests where behavior changes, e.g. `test/javascript/controllers/import_case_controller.test.js`).

---

## Related docs

- [`DEVELOPER_GUIDE.md`](../DEVELOPER_GUIDE.md) — run commands, Playwright
- [`app_structure.md`](./app_structure.md) — frontend layout
- [`todo/todo.md`](./todo/todo.md#frontend-cleanup-after-angular-removal) — frontend cleanup after Angular removal

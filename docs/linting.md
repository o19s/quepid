# JavaScript Linting and Formatting

Quepid uses **ESLint** and **Prettier** for JavaScript quality and style. These replace the legacy JSHint setup.

## Quick Reference

| Command | Description |
|---------|-------------|
| `yarn lint` | Run ESLint on all JS files |
| `yarn lint:fix` | Run ESLint with auto-fix |
| `yarn format` | Check Prettier formatting |
| `yarn format:fix` | Apply Prettier formatting |
| `bin/docker r bundle exec rake test:lint` | Run ESLint + Prettier (CI task) |

## Configuration

- **ESLint:** `eslint.config.mjs` (flat config)
- **Prettier:** `.prettierrc`, `.prettierignore`

## Standards (from JSHint migration)

Rules are aligned with the previous `.jshintrc`:

- **bitwise:** Disallow bitwise operators (`no-bitwise`)
- **curly:** Require braces for control flow (`curly`)
- **eqeqeq / eqnull:** Require `===` and `!==`, but allow `== null` for null/undefined checks (`eqeqeq` with `null: 'ignore'`)
- **latedef:** No use before declaration (`no-use-before-define`)
- **newcap:** Require `new` for constructors (`new-cap`)
- **noarg:** Disallow `arguments.callee` (`no-caller`)
- **strict:** Require strict mode (`strict`)
- **trailing:** No trailing spaces (`no-trailing-spaces`)
- **undef:** No undefined variables (`no-undef`)
- **unused:** No unused variables (`no-unused-vars`), with `^_` prefix allowed for intentionally unused
- **indent / quotmark / smarttabs:** Handled by Prettier (2 spaces, single quotes)

## Ignored Paths

ESLint ignores: `vendor/`, `node_modules/`, `app/assets/builds/`, `app/assets/javascripts/mode-json.js`, `db/scorers/`, `test/fixtures/`, `coverage/`, `public/javascripts/`, `lib/`, and `**/sortablejs.js`.

Prettier checks only: `app/javascript/`, `spec/javascripts/`, `build_*.js`, `vitest.config.js`, `eslint.config.mjs`.

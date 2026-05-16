# Stylelint

Quepid lints app-owned stylesheets under `app/assets/stylesheets/` with [Stylelint](https://stylelint.io/) using `stylelint-config-recommended` (see `stylelint.config.mjs`).

## Run

From the repo root (or via Docker per `CLAUDE.md`):

```bash
yarn lint:css
```

Equivalent Rake task:

```bash
bundle exec rake test:stylelint
```

`test:frontend` runs Karma, JSHint, and Stylelint together.

## Scope

- **Linted:** `app/assets/stylesheets/**/*.css`
- **Ignored:** concatenated bundles in `app/assets/builds/`, `node_modules/`, `vendor/`, and vendored JS under `app/javascript/vendor/` (`.stylelintignore`)

Custom element / directive tag names used in selectors (for example `tags-input`, `qscore-query`) are listed under `selector-type-no-unknown` → `ignoreTypes` in `stylelint.config.mjs` when adding new component-style tags.

## CI

CircleCI runs `yarn lint:css` after JSHint (see `.circleci/config.yml`).

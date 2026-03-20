# Pragmatic Engineer: Setup, Testing & Tooling Review

This document analyzes Quepid’s **current** development setup, testing strategy, CI, and tooling on **this branch**, with recommendations that match what the repo actually runs.

**Related docs:** [DEVELOPER_GUIDE.md](../../../../DEVELOPER_GUIDE.md) (repo root) for setup and commands; [code_review_findings.md](code_review_findings.md) for security and performance follow-ups.

---

## Current state summary

| Area | Status | Notes |
|------|--------|-------|
| **Local setup** | Solid | Docker-first; `bin/setup_docker` and `bin/docker` documented in DEVELOPER_GUIDE. |
| **Unit tests (Ruby)** | Good | Minitest under `test/`; broad API, model, and service coverage. |
| **Unit tests (JS)** | Good (legacy stack) | **Karma + Jasmine**; Angular specs under `spec/javascripts/`; config under `spec/karma/`. Runs `npm run build` then Karma (`lib/tasks/karma.rake`). Not Vitest. |
| **E2E / system tests** | Partial | `test/system/` includes real tests (e.g. `search_endpoints_test.rb`). `config/ci.rb` does **not** run system tests (commented step; note in file says they are disabled). |
| **CI pipeline (GitHub Actions)** | Gaps | `.github/workflows/test.yml` runs `bin/setup_docker` then **`bin/docker r rails test` only**. No Karma/JSHint, RuboCop, or security audits. |
| **Pre-commit hooks** | Optional | If `lefthook.yml` is present at the repo root, run `lefthook install` after setup; otherwise hooks are undefined here. |
| **Local CI** | Strong | `bin/ci` runs setup, RuboCop, bundler-audit, importmap audit, Brakeman, `rails test`, and `rails test:frontend` per `config/ci.rb`. Not wired to GitHub Actions. |
| **Documentation** | Good | DEVELOPER_GUIDE, `docs/app_structure.md`, migration docs under `docs/migration/`, Cursor rules. |

---

## 1. CI/CD pipeline

### Current state

**GitHub Actions** (`.github/workflows/test.yml`):

- Triggers on every push
- Runs `bin/setup_docker` then `bin/docker r rails test`
- **Does not run:** Karma/JSHint (`test:frontend`), RuboCop, Brakeman, bundler-audit, importmap audit

**Nightly** (`.github/workflows/nightly-build.yml`): Docker image build/push only—no test matrix.

**Local CI** (`config/ci.rb`, `bin/ci`):

- Setup (`bin/setup --skip-server`), RuboCop (`bin/rubocop`), security steps, `bin/rails test`, `bin/rails test:frontend`
- Optional `gh signoff` block is commented out
- **Label bug:** both Rails unit tests and frontend use the step title `'Tests: Rails'`; the second should read **Tests: Frontend** (or similar) for clarity

### Recommendations

| Priority | Recommendation | Effort |
|----------|----------------|--------|
| **P0** | Add **`rails test:frontend`** (Karma build + run + JSHint) to GitHub Actions so JS/lint regressions cannot merge silently. | Medium (build time in CI) |
| **P0** | Add **RuboCop** to GitHub Actions (`bin/docker r bin/rubocop` or `bundle exec rubocop`). | Low |
| **P1** | Align GHA with `config/ci.rb` over time (security audits, same ordering). | Medium |
| **P2** | Add **Brakeman** (and optionally bundler-audit / importmap audit) to GHA; fail on high/critical. | Low |
| **P3** | If the project later adopts **ESLint/Prettier** (e.g. post–Angular removal), add those tasks to CI; today the JS linter is **JSHint** via `test:jshint`. | — |

**Pragmatic approach:** Start with RuboCop + `test:frontend` in the existing push workflow; cache `node_modules`/build artifacts if runtime becomes painful.

---

## 2. Testing

### Unit tests

**Ruby (Minitest):**

- Location: `test/`
- Run: `bin/docker r rails test` (or `rv run bundle exec rails test` outside Docker, per DEVELOPER_GUIDE)

**JavaScript (Karma + Jasmine):**

- Specs: `spec/javascripts/` (Angular-focused)
- Config: `spec/karma/config/unit.js` (invoked from `lib/tasks/karma.rake`)
- Single run: `bin/docker r rails karma:run` or `bin/docker r yarn test` (see `package.json` → `rake karma:run`)
- Watch: `bin/docker r bin/rake karma:start` (per DEVELOPER_GUIDE)
- **Frontend rake task:** `rails test:frontend` runs `test:js` then **`test:jshint`** (`lib/tasks/quepid.rake`)

### Integration / E2E

**System tests (Capybara):**

- Location: `test/system/`
- Run: `bin/rails test:system` (not part of default `bin/ci` today)
- Example: `SearchEndpointsTest` — smoke-style flows for search endpoints UI

**Playwright:**

- `@playwright/test` and `playwright-core` are in `package.json` devDependencies; **no CI workflow** uses them yet

### Recommendations

| Priority | Recommendation | Effort |
|----------|----------------|--------|
| **P0** | Run **Karma + JSHint** in CI (see §1). | Medium |
| **P1** | Decide whether to enable **system tests** in `bin/ci` / GHA (or document manual/weekly runs); uncomment or add steps once stable. | Medium |
| **P2** | **Playwright:** adopt for cross-browser E2E only if needed; otherwise treat as optional dependency. | Medium |
| **P3** | Optional: a single **`rails test:all`**-style task that runs Ruby + `test:frontend` for ergonomics (DEVELOPER_GUIDE already lists both separately). | Low |

---

## 3. Linting & formatting

### Current state

- **Ruby:** RuboCop (Rails, Minitest, Capybara plugins in `.rubocop.yml`). Used in `bin/ci` via `bin/rubocop`.
- **JavaScript:** **JSHint** via `rails test:jshint` and `.jshintrc` — not ESLint/Prettier on this branch.

### Recommendations

| Priority | Recommendation | Effort |
|----------|----------------|--------|
| **P1** | Run **RuboCop** in CI; block merge on failures. | Low |
| **P2** | Run **`test:jshint`** (or full `test:frontend`) in CI. | Low–Medium |
| **P3** | Document `bundle exec rubocop --autocorrect-all` in CONTRIBUTING (DEVELOPER_GUIDE already mentions autocorrect). | Low |

---

## 4. Pre-commit hooks (Lefthook)

### Current state

- No hook definitions committed (`lefthook.yml` / `lefthook.yaml` absent).
- Docker setup attempts `lefthook install` when the CLI is installed; without config, that does not enforce RuboCop or tests on commit.

### Recommendations

| Priority | Recommendation | Effort |
|----------|----------------|--------|
| **P2** | Add **`lefthook.yml`** if the team wants staged-file RuboCop / related checks; document in CONTRIBUTING and mention `git commit --no-verify` for exceptions. | Low |
| **P3** | Optionally run **JSHint** or a subset of Karma on staged files (heavier; often better left to CI). | Medium |

---

## 5. Local development experience

### Strengths

- Clear Docker workflow (`bin/docker s`, `bin/docker r …`)
- `bin/ci` mirrors a fuller pipeline than GitHub Actions
- DEVELOPER_GUIDE covers Karma timeouts, RuboCop, and frontend commands

### Gaps

- **CI vs local:** GHA is a strict subset of `bin/ci`—easy to merge broken JS or style.
- **Two commands for “all automated checks”:** `rails test` and `rails test:frontend` (plus audits only in `bin/ci`).
- **`config/ci.rb`:** duplicate step label for frontend tests (see §1).

### Recommendations

| Priority | Recommendation | Effort |
|----------|----------------|--------|
| **P1** | Fix **`config/ci.rb`** step title for `test:frontend`. | Trivial |
| **P2** | Add a **“run full local CI”** callout to DEVELOPER_GUIDE: `bin/ci` before push. | Low |
| **P3** | Link this doc from DEVELOPER_GUIDE and/or [docs/migration/angularjs_elimination_plan.md](./angularjs_elimination_plan.md) “Related documentation.” | Trivial |

---

## 6. Security & dependency audits

### Current state

- `bin/ci` runs bundler-audit, importmap audit, and Brakeman
- None of these run in `.github/workflows/test.yml`

### Recommendations

| Priority | Recommendation | Effort |
|----------|----------------|--------|
| **P1** | Add **Brakeman** to GHA; fail on warn/error per policy. | Low |
| **P2** | Add **bundler-audit** and **importmap audit** to GHA. | Low |

---

## 7. Documentation

### Current state

- DEVELOPER_GUIDE: setup, Karma, RuboCop, `test:frontend`, debugging
- Migration notes under `docs/migration/` describe the **incremental Angular elimination plan** on `main`; [deangularjs_experimental_review.md](./deangularjs_experimental_review.md) compares against **`deangularjs-experimental`** (Vitest, server search, etc.) where relevant—not as current `main` runtime fact

### Recommendations

| Priority | Recommendation | Effort |
|----------|----------------|--------|
| **P2** | In DEVELOPER_GUIDE or tooling section, state explicitly that **GHA currently runs Ruby tests only** and point to `bin/ci` for parity. | Low |
| **P3** | The parent-folder `pragmatic_engineering_setup_review.md` is a **stub** that points here—edit only this `todo/` file. | — |

---

## 8. Prioritized action plan

### Immediate

1. **Add RuboCop to GitHub Actions**
2. **Add `rails test:frontend`** (Karma + JSHint) to GitHub Actions — expect longer runs due to `npm run build` before Karma

### Short term

3. **Add Brakeman** (then bundler-audit / importmap) to GHA
4. **Fix `config/ci.rb` step labels** for frontend vs Rails
5. **Optional:** `lefthook.yml` + docs if pre-commit enforcement is desired

### Medium term

6. Revisit **system tests** in CI when the suite is stable and fast enough
7. **Playwright:** wire up or trim unused devDependencies
8. **ESLint/Prettier:** evaluate when JS stack moves away from Angular/Karma/JSHint

---

## Appendix: Quick reference

| Task | Command |
|------|---------|
| Full local CI | `bin/ci` |
| Ruby tests | `bin/docker r rails test` |
| Frontend tests + JSHint | `bin/docker r rails test:frontend` |
| Karma single run | `bin/docker r rails karma:run` or `bin/docker r yarn test` |
| JSHint only | `bin/docker r rails test:jshint` |
| RuboCop | `bin/docker r bundle exec rubocop` (or `bin/docker r bin/rubocop`) |
| Install Lefthook CLI | `lefthook install` (only useful after adding `lefthook.yml`) |

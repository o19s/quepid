# Pragmatic Engineer: Setup, Testing & Tooling Review

This document analyzes Quepid’s **current** development setup, testing strategy, CI, and tooling on **this branch**, with recommendations that match what the repo actually runs.

---

- Docker-first: `bin/setup_docker`, `bin/docker` - see DEVELOPER_GUIDE.
- Unit Tests:
    - Ruby: minitest under `test/`
    - JS:
        - Karma + Jasmine for Angular
        - Vitest for Stimulus + Vanilla JS
- E2E / System Tests
    - `config/ci.rb` keeps system tests commented out by default.

## Current state summary

| Area | Status | Notes |
|------|--------|-------|
| **CI pipeline (GitHub Actions)** | Improved | `.github/workflows/test.yml`: `bin/setup_docker`, then **`bin/rubocop`**, **`rails test`**, **`rails test:frontend`** (all via `bin/docker r …`). Security audits / Brakeman: **§4**. |
| **Pre-commit hooks** | Present | Root **`lefthook.yml`**: parallel checks—**RuboCop on staged** Ruby files (`bin/docker r bin/rubocop --force-exclusion`, see [.github/CONTRIBUTING.md](../../.github/CONTRIBUTING.md)) plus Stimulus/JS guardrails (no `getControllerForElementAndIdentifier`, no `fetch(\`/\`…)` in controllers/modules, no inline `style="..."` in controllers). `bin/setup_docker` runs **`lefthook install`** when the CLI is installed. |
| **Local CI** | Partially aligned | `bin/ci` runs `config/ci.rb`: setup, RuboCop, security steps, `rails test`, **`rails test:frontend`**. Security step binaries and GHA parity: **§4**. |

---

## 1. CI/CD pipeline

### Current state

**GitHub Actions** (`.github/workflows/test.yml`):

- Triggers on every push
- After `bin/setup_docker`: **`bin/docker r bin/rubocop`**, **`bin/docker r rails test`**, **`bin/docker r rails test:frontend`**
- Does **not** run `config/ci.rb` security steps; details and missing `bin/` entry points are in **§4**

**Nightly** (`.github/workflows/nightly-build.yml`): Docker image build/push only—no test matrix.

**Local CI** (`config/ci.rb`, `bin/ci`):

- Setup (`bin/setup --skip-server`), RuboCop (`bin/rubocop`), security steps (`bin/bundler-audit`, `bin/importmap audit`, `bin/brakeman …`), `bin/rails test`, **`bin/rails test:frontend`** (Karma, JSHint, Vitest)

### Recommendations (remaining)

| Priority | Recommendation | Effort |
|----------|----------------|--------|
| **P1** | **Security:** add **`bin/bundler-audit`** / **`bin/brakeman`** (or `bundle exec …`), gems, align **`config/ci.rb`**, mirror in GHA — full context **§4**. | Medium |
| **P2** | **Parallel GHA jobs** or **Docker layer caching** if push workflow runtime grows painful (Karma build is heavy). | Medium |
| **P3** | If the project later adopts **ESLint/Prettier** (e.g. post–Angular removal), add those tasks to CI; today the Angular-era gate is **JSHint** via `test:jshint`, with **Vitest** for newer JS. | — |

---

## 2. Testing

### Integration / E2E

**System tests (Capybara):**

- Location: `test/system/`
- Run: `bin/rails test:system` (not part of default `bin/ci` today)
- Example: `SearchEndpointsTest` — smoke-style flows for search endpoints UI

**Playwright:**

- `@playwright/test` and `playwright-core` are devDependencies; **no product E2E suite in CI**. They support **manual / docs tooling** (e.g. scripts under `docs/scripts/` and [screenshot_automation.md](./screenshot_automation.md)).

### Recommendations

| Priority | Recommendation | Effort |
|----------|----------------|--------|
| **P1** | Decide whether to enable **system tests** in `bin/ci` / GHA (or document manual/weekly runs); uncomment or add steps once stable. | Medium |

---

## 3. Local development experience

**GHA vs `bin/ci`**, **system tests**, and **Playwright E2E** are covered in **§1**, **§2**, and **§4** (security steps are what diverge today).

---

## 4. Security & dependency audits

### Current state

- **`config/ci.rb`** lists **bundler-audit**, **importmap audit**, and **Brakeman** as local `bin/ci` steps.
- **`bin/importmap`** is committed and matches the importmap audit step.
- **`bin/bundler-audit`** and **`bin/brakeman`** are **not** present under **`bin/`** (and the **Gemfile** does not declare those gems on this tree)—so those steps will not run successfully until stubs and dependencies are added (or the steps are rewritten, e.g. `bundle exec brakeman`).
- **None of these run in `.github/workflows/test.yml` yet.**

### Recommendations

| Priority | Recommendation | Effort |
|----------|----------------|--------|
| **P1** | Add **real** Brakeman (and bundler-audit) integration: gems + **`bin/`** stubs or `bundle exec`, align **`config/ci.rb`**, then add the same to GHA. | Low–medium |
| **P2** | Add **importmap audit** to GHA (low risk once the pattern matches local). | Low |

---

## 5. Documentation

### Current state

- DEVELOPER_GUIDE: setup, Karma, Vitest, RuboCop, `test:frontend`, **`bin/ci`**, **GitHub Actions** testing section, debugging
- Migration notes under `docs/migration/` describe the **incremental Angular elimination plan** on `main`; [deangularjs_experimental_review.md](./deangularjs_experimental_review.md) compares against **`deangularjs-experimental`** where relevant

### Recommendations

| Priority | Recommendation | Effort |
|----------|----------------|--------|
| **P3** | Keep DEVELOPER_GUIDE in sync when CI steps change. | Low |

---

## 6. Prioritized action plan

### Short term

1. Execute **§4 P1** (Brakeman, bundler-audit, `bin/` or `bundle exec`, GHA) so **`config/ci.rb`** matches the repo.

### Medium term

2. Revisit **system tests** in CI when the suite is stable and fast enough (**§2**).
3. **Playwright:** optional **E2E job**, or keep deps for docs/scripts only (**§2**).

---

## Appendix: command reference

Use **[DEVELOPER_GUIDE.md](../../DEVELOPER_GUIDE.md#iii-run-tests)** (*III. Run Tests*) for the full command table (Ruby, Karma, Vitest, JSHint, ESLint/Prettier, RuboCop, `bin/ci`, GitHub Actions). **§4** in *this* doc tracks **`bin/ci` vs security stubs** and GHA gaps.

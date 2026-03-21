# Pragmatic Engineer: Setup, Testing & Tooling Review

This document analyzes Quepid’s **current** development setup, testing strategy, CI, and tooling on **this branch**, with recommendations that match what the repo actually runs.

**CI update:** On every push, **GitHub Actions** (`.github/workflows/test.yml`, `actions/checkout@v6`) runs `bin/setup_docker`, then RuboCop, `rails test`, and `rails test:frontend` (Karma, JSHint, Vitest via `yarn test:vitest`). The workflow does **not** run the **`config/ci.rb` security steps** (bundler-audit, importmap audit, Brakeman). Local **`bin/ci`** is supposed to run those steps after setup and RuboCop, but **`config/ci.rb` calls `bin/bundler-audit` and `bin/brakeman`, which are not in `bin/`**; only **`bin/importmap`** exists for the audit trio, and the **Gemfile** does not include Brakeman or bundler-audit—so **`bin/ci` will fail** at the first missing command until stubs and gems exist or the steps change. Gaps for **security in GHA**, **system tests**, and **Playwright product E2E** are spelled out below.

**Related docs:** [DEVELOPER_GUIDE.md](../../DEVELOPER_GUIDE.md) (repo root) — **authoritative** for setup, test commands, and CI summary; [angularjs_elimination_plan.md](./angularjs_elimination_plan.md) for core UI migration scope; [code_review_findings.md](code_review_findings.md) for security and performance follow-ups. This file focuses on **gaps and recommendations**, not duplicating the command reference.

---

- Docker-first: `bin/setup_docker`, `bin/docker` - see DEVELOPER_GUIDE.
- Unit Tests:
    - Ruby: minitest under `test/`
    - JS:
        - Karma + Jasmine for Angular
        - Vitest for Stimulus + Vanilla JS

## Current state summary

| Area | Status | Notes |
|------|--------|-------|
| **E2E / system tests** | Partial | `test/system/` includes tests (e.g. `search_endpoints_test.rb`). `config/ci.rb` keeps **system tests commented out** by default (comment documents the optional step). |
| **CI pipeline (GitHub Actions)** | Improved | `.github/workflows/test.yml`: `bin/setup_docker`, then **`bin/rubocop`**, **`rails test`**, **`rails test:frontend`** (all via `bin/docker r …`). **Security audits / Brakeman** are not in GHA yet (see §6). |
| **Pre-commit hooks** | Present | Root **`lefthook.yml`**: parallel checks on staged Stimulus/JS (no `getControllerForElementAndIdentifier`, no `fetch(\`/\`…)` in controllers/modules, no inline `style="..."` in controllers). `bin/setup_docker` runs **`lefthook install`** when the CLI is installed. |
| **Local CI** | Partially aligned | `bin/ci` runs `config/ci.rb`: setup, RuboCop, security steps, `rails test`, **`rails test:frontend`** (Karma, JSHint, Vitest). Security steps list **`bin/bundler-audit`** and **`bin/brakeman`**; those binaries are **not** in `bin/` today—see §1 and §6. |

---

## 1. CI/CD pipeline

### Current state

**GitHub Actions** (`.github/workflows/test.yml`):

- Triggers on every push
- After `bin/setup_docker`: **`bin/docker r bin/rubocop`**, **`bin/docker r rails test`**, **`bin/docker r rails test:frontend`**
- **Still does not run:** `config/ci.rb` security steps (bundler-audit, importmap audit, Brakeman). Local `bin/ci` lists the same steps, but two of the three **`bin/`** entry points are missing in-repo (see §6).

**Nightly** (`.github/workflows/nightly-build.yml`): Docker image build/push only—no test matrix.

**Local CI** (`config/ci.rb`, `bin/ci`):

- Setup (`bin/setup --skip-server`), RuboCop (`bin/rubocop`), security steps (`bin/bundler-audit`, `bin/importmap audit`, `bin/brakeman …`), `bin/rails test`, **`bin/rails test:frontend`** (Karma, JSHint, Vitest)
- **`bin/importmap`** exists; **`bin/bundler-audit`** and **`bin/brakeman`** are referenced in `config/ci.rb` but are **missing from `bin/`** in the repo—add stubs (and gems) or remove/skip those steps for `bin/ci` to pass end-to-end
- Optional `gh signoff` block is commented out

### Recommendations (remaining)

| Priority | Recommendation | Effort |
|----------|----------------|--------|
| **P1** | **Commit `bin/bundler-audit` and `bin/brakeman`** (or change `config/ci.rb` to `bundle exec …`) and add the gems; then add the same security steps to GHA. Today `config/ci.rb` already lists them, but the **`bin/` stubs are absent**, so local `bin/ci` is not reliably runnable as written. | Medium |
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

## 4. Pre-commit hooks (Lefthook)

### Current state

- **`lefthook.yml`** at the repo root defines **pre-commit** jobs (parallel): guardrails for Stimulus/controllers and shared modules—**no** RuboCop or test runners on commit.
- **`bin/setup_docker`** runs **`lefthook install`** when the `lefthook` CLI is on `PATH`; otherwise it skips with a message.

### Recommendations

| Priority | Recommendation | Effort |
|----------|----------------|--------|
| **P2** | Optionally extend **`lefthook.yml`** with staged **RuboCop** (or a narrow subset); document in CONTRIBUTING and mention `git commit --no-verify` for exceptions. | Low |
| **P3** | Optionally run **JSHint** or Karma on staged files (heavier; usually left to CI). | Medium |

---

## 5. Local development experience

### Strengths

- Clear Docker workflow (`bin/docker s`, `bin/docker r …`)
- **GHA** now covers RuboCop, Ruby tests, Karma + JSHint, and Vitest (see §1).
- DEVELOPER_GUIDE covers Karma timeouts, RuboCop, Vitest, `bin/ci`, and GHA.

### Gaps

- **GHA vs `bin/ci`:** **`bin/ci`** is intended to run **security** steps that **GHA omits**; in practice those steps need **`bin/bundler-audit`** and **`bin/brakeman`** to exist (they do not yet—see §1).
- **System tests** and **Playwright E2E** remain optional / manual (see §2).

### Recommendations

| Priority | Recommendation | Effort |
|----------|----------------|--------|
| **P3** | Link this doc from [docs/migration/angularjs_elimination_plan.md](./angularjs_elimination_plan.md) “Related documentation” if helpful. | Trivial |

---

## 6. Security & dependency audits

### Current state

- **`config/ci.rb`** lists **bundler-audit**, **importmap audit**, and **Brakeman** as local `bin/ci` steps.
- **`bin/importmap`** is committed and matches the importmap audit step.
- **`bin/bundler-audit`** and **`bin/brakeman`** are **not** present under **`bin/`** (and the **Gemfile** does not declare those gems on this tree)—so the first two security steps will not run successfully until stubs and dependencies are added (or the steps are rewritten, e.g. `bundle exec brakeman`).
- **None of these run in `.github/workflows/test.yml` yet.**

### Recommendations

| Priority | Recommendation | Effort |
|----------|----------------|--------|
| **P1** | Add **real** Brakeman (and bundler-audit) integration: gems + **`bin/`** stubs or `bundle exec`, align **`config/ci.rb`**, then add the same to GHA. | Low–medium |
| **P2** | Add **importmap audit** to GHA (low risk once the pattern matches local). | Low |

---

## 7. Documentation

### Current state

- DEVELOPER_GUIDE: setup, Karma, Vitest, RuboCop, `test:frontend`, **`bin/ci`**, **GitHub Actions** testing section, debugging
- Migration notes under `docs/migration/` describe the **incremental Angular elimination plan** on `main`; [deangularjs_experimental_review.md](./deangularjs_experimental_review.md) compares against **`deangularjs-experimental`** where relevant

### Recommendations

| Priority | Recommendation | Effort |
|----------|----------------|--------|
| **P3** | Keep DEVELOPER_GUIDE in sync when CI steps change. | Low |

---

## 8. Prioritized action plan

### Done (baseline CI)

1. **RuboCop** in GitHub Actions
2. **`rails test:frontend`** (Karma, JSHint, Vitest) in GitHub Actions and **`config/ci.rb`**
3. **`config/ci.rb`** accurate **system test** comment
4. **Vitest** `modules/*` aliases generated from `app/javascript/modules/*.js` (`vitest.config.js`); Stimulus specs can use **`waitForController`** in `test/javascript/support/stimulus_helpers.js` instead of fixed `setTimeout` sleeps
5. **Lefthook** `lefthook.yml` with Stimulus/JS guardrails; `lefthook install` from `bin/setup_docker` when CLI is available

### Short term

6. **Add `bin/bundler-audit` / `bin/brakeman`** (or equivalent) and gems so **`config/ci.rb`** matches the repo; then add **Brakeman**, **bundler-audit**, and **importmap audit** to GHA
7. **Optional:** extend **`lefthook.yml`** with RuboCop or other checks; document in CONTRIBUTING

### Medium term

8. Revisit **system tests** in CI when the suite is stable and fast enough
9. **Playwright:** optional **E2E job**, or keep deps for docs/scripts only
10. **ESLint/Prettier:** evaluate when JS stack moves away from Angular/Karma/JSHint

---

## Appendix: command reference

Use **[DEVELOPER_GUIDE.md](../../DEVELOPER_GUIDE.md#iii-run-tests)** (*III. Run Tests*) for the full command table (Ruby, Karma, Vitest, JSHint, ESLint/Prettier, RuboCop, `bin/ci`, GitHub Actions). **§6** in *this* doc still tracks **`bin/ci` vs security stubs** and GHA gaps.

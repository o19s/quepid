# Pragmatic Engineer: Setup, Testing & Tooling Review

This document provides a pragmatic analysis of Quepid's development setup, testing strategy, CI/CD pipeline, and tooling—with actionable recommendations to improve developer experience and code quality.

**Related docs:** [DEVELOPER_GUIDE.md](../DEVELOPER_GUIDE.md) for setup instructions; [docs/code_review_findings.md](code_review_findings.md) for security and code-quality findings.

---

## Current State Summary

| Area | Status | Notes |
|------|--------|-------|
| **Local setup** | ✅ Solid | Docker-first; `bin/setup_docker` works well. Local (non-Docker) path documented. |
| **Unit tests (Ruby)** | ✅ Good | Minitest; good coverage of API controllers, models, services. |
| **Unit tests (JS)** | ✅ Good | Vitest with Stimulus stubs; tests run from source, no build step. |
| **E2E / System tests** | ⚠️ Partial | Capybara/Playwright; some tests; rating flow now tested (Stimulus). |
| **CI pipeline** | ⚠️ Gaps | GitHub Actions runs only Rails tests; no frontend, lint, or security checks. |
| **Pre-commit hooks** | ✅ Good | Lefthook runs Rubocop + related tests on staged files. |
| **Local CI** | ✅ Strong | `bin/ci` runs full pipeline (lint, security, all tests). |
| **Documentation** | ✅ Good | DEVELOPER_GUIDE, app_structure, port docs, Cursor rules. |

---

## 1. CI/CD Pipeline

### Current State

**GitHub Actions** (`.github/workflows/test.yml`):

- Triggers on every push
- Runs `bin/setup_docker` then `bin/docker r rails test`
- **Does not run:** Vitest, ESLint/Prettier, Rubocop, Brakeman, bundler-audit, importmap audit

**Local CI** (`config/ci.rb`, `bin/ci`):

- Full pipeline: setup, Rubocop, security audits (bundler-audit, importmap, Brakeman), Rails tests, frontend tests
- Optional `gh signoff` for PR merge
- Not wired to GitHub Actions

### Recommendations

| Priority | Recommendation | Effort |
|----------|----------------|--------|
| **P0** | Add Vitest to GitHub Actions. PRs can merge with failing JS tests today. | Low |
| **P0** | Add Rubocop to GitHub Actions. Enforce style in CI; Lefthook is optional locally. | Low |
| **P1** | Run `bin/ci` (or equivalent steps) in CI so local and CI stay aligned. | Medium |
| **P2** | Add security checks (Brakeman, bundler-audit) to CI; fail on high/critical findings. | Low |
| **P3** | Add ESLint/Prettier to CI (replaces JSHint). | Low |

**Pragmatic approach:** Start by adding Vitest and Rubocop to the existing workflow. Both run quickly. Align CI with `config/ci.rb` over time.

---

## 2. Testing

### Unit Tests

**Ruby (Minitest):**

- Location: `test/`
- Run: `bin/docker r rails test` or `rv run bundle exec rails test` (local)
- Good coverage of API, models, services
- Related-tests hook maps `app/*.rb` → `test/*_test.rb`; runs on commit

**JavaScript (Vitest):**

- Location: `spec/javascripts/`
- Run: `bin/docker r yarn test:run` or `bin/docker r rails test:frontend`
- Stimulus controllers stubbed via `spec/javascripts/support/stimulus_stub.js`
- Path aliases mirror importmap for clean imports
- Related-tests hook runs `vitest related` for staged JS files

### Integration / E2E

**System tests (Capybara):**

- Location: `test/system/`
- Run: `bin/rails test:system` (not in default CI)
- `CoreWorkspaceTest` covers load, add query, export/clone modals, new case wizard
- Rating flow tested (Stimulus query-expand inline results)

**Playwright:**

- `@playwright/test` in devDependencies; no workflow wired yet

### Recommendations

| Priority | Recommendation | Effort |
|----------|----------------|--------|
| **P0** | Ensure Vitest runs in CI (see §1). | Low |
| **P1** | Add `rails test:frontend` to GitHub Actions (Vitest + ESLint/Prettier). | Low |
| ~~**P1**~~ | ~~Un-skip rating test when Stimulus rating UI is ready; keep as regression guard.~~ ✅ Done | — |
| **P2** | Add system tests to CI (e.g. weekly or on main) if stable; or document as manual. | Medium |
| **P2** | Consider Playwright for cross-browser E2E if needed; otherwise defer. | Medium |
| **P3** | Add `bin/rails test` as single entrypoint that runs Ruby + frontend (DEVELOPER_GUIDE notes "we should be able to"). | Low |

---

## 3. Linting & Formatting

### Current State

- **Ruby:** Rubocop with Rails, Minitest, Capybara plugins. Lefthook runs on staged `.rb` files.
- **JavaScript:** ESLint + Prettier via `rails test:lint` (replaces JSHint). See [docs/linting.md](../linting.md).

### Recommendations

| Priority | Recommendation | Effort |
|----------|----------------|--------|
| **P1** | Run Rubocop in CI; block merge on failures. | Low |
| **P2** | Add ESLint/Prettier to CI (run `rails test:lint`). | Low |
| **P3** | Add `rubocop -a` (autocorrect) to CONTRIBUTING or pre-commit docs. | Low |

---

## 4. Pre-commit Hooks (Lefthook)

### Current State

- Rubocop on staged `.rb` files
- Related-tests: maps staged Ruby → test files; runs Vitest `related` for staged JS
- Installed by `bin/setup` and `bin/setup_docker` when Lefthook available
- Bypass: `git commit --no-verify`

### Recommendations

| Priority | Recommendation | Effort |
|----------|----------------|--------|
| **P2** | Document Lefthook in CONTRIBUTING; note `--no-verify` for edge cases. | Low |
| **P3** | Consider adding ESLint/Prettier to pre-commit for staged JS. | Low |

---

## 5. Local Development Experience

### Strengths

- Docker-first setup; `bin/docker` wrapper is clear (`s`, `r`, `c`, `b`, etc.)
- `bin/ci` gives full local pipeline; developers can replicate CI
- Related-tests reduce feedback time on commit
- Cursor rules and Claude-on-Rails prompts support AI-assisted development

### Gaps

- Two commands for "all tests" (`rails test` + `rails test:frontend`); no single `rails test` that runs both
- Vitest "related" may not map all JS files (e.g. modules, utils) to tests; verify coverage
- `config/ci.rb` step order: `test:frontend` is labeled "Tests: Rails" (copy-paste artifact)

### Recommendations

| Priority | Recommendation | Effort |
|----------|----------------|--------|
| **P1** | Add `rails test:all` or extend `rails test` to run Ruby + frontend in one command. | Low |
| **P2** | Fix `config/ci.rb` step label: "Tests: Frontend" for `test:frontend`. | Trivial |
| **P3** | Extend related-tests mapping for `app/javascript/modules`, `utils`, `api` if needed. | Low |

---

## 6. Security & Dependency Audits

### Current State

- `bin/ci` runs: bundler-audit, importmap audit, Brakeman
- None of these run in GitHub Actions

### Recommendations

| Priority | Recommendation | Effort |
|----------|----------------|--------|
| **P1** | Add Brakeman to CI; fail on high/critical. | Low |
| **P2** | Add bundler-audit and importmap audit to CI; fail on known vulnerabilities. | Low |

---

## 7. Documentation

### Current State

- DEVELOPER_GUIDE: setup, tests, debugging, conventions
- docs/: app structure, port docs, data mapping, API client
- Cursor rules: project conventions, Ruby/Rails, frontend
- Code review findings: security, code quality, pragmatic notes

### Recommendations

| Priority | Recommendation | Effort |
|----------|----------------|--------|
| **P2** | Add "Run full CI locally" section to DEVELOPER_GUIDE: `bin/ci` before push. | Low |
| **P3** | Link this doc from DEVELOPER_GUIDE or docs index. | Trivial |

---

## 8. Prioritized Action Plan

### Immediate (Current Sprint)

1. **Add Vitest to GitHub Actions** — Prevent JS regressions from merging.
2. **Add Rubocop to GitHub Actions** — Enforce style in CI.

### Short-term (Next 1–2 Sprints)

3. **Add Brakeman to CI** — Catch security issues before merge.
4. **Unify test command** — `rails test` or `rails test:all` runs Ruby + frontend.
5. **Fix config/ci.rb labels** — Clarify "Tests: Frontend" step.

### Medium-term (Backlog)

6. **Add bundler-audit + importmap audit to CI** — Dependency vulnerability checks.
7. **ESLint/Prettier** — Migration from JSHint complete. See [docs/linting.md](../linting.md).
8. **Enable system tests in CI** — Rating flow migrated; Chrome/headless setup in CI remains.

---

## Appendix: Quick Reference

| Task | Command |
|------|---------|
| Full local CI | `bin/ci` |
| Ruby tests | `bin/docker r rails test` |
| Frontend tests | `bin/docker r rails test:frontend` |
| Rubocop | `bin/docker r bundle exec rubocop` |
| Vitest watch | `bin/docker r yarn test` |
| Vitest single run | `bin/docker r yarn test:run` |
| ESLint + Prettier | `bin/docker r bundle exec rake test:lint` |
| Install hooks | `lefthook install` |

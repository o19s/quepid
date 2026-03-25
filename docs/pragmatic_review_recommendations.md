# Pragmatic Engineering Review — Recommendations

_Review conducted 2026-03-25 against the `deangularjs-incremental` branch._

## P0: Do Before Next Release

### Add tests for critical untested JS modules

`editor.js` (417 lines, CodeMirror 6 integration), `settings_validator.js` (268 lines, wizard endpoint probing), and `wizard_settings.js` (296 lines, form state management) have zero test coverage. These are critical-path modules — if they break, users notice immediately.

**Action:** Add Vitest tests targeting core business logic paths. Use mocked fetch and CodeMirror APIs. Target 80% coverage on each.

**Effort:** 3–4 hours

### Add security scanning to CI

No `bundle audit`, `npm audit`, Dependabot, or Renovate. The CI pipeline checks tests and lint but not known vulnerabilities.

**Action:** Add `bundle audit` and `npm audit` steps to `.github/workflows/test.yml`.

**Effort:** 30 minutes

## P1: Next Sprint


### Enable automated dependency alerts

No Dependabot or Renovate configured. Vulnerable dependencies can go unnoticed.

**Action:** Add `.github/dependabot.yml` covering both `bundler` and `npm` ecosystems.

**Effort:** 30 minutes

## P2: Backlog

### Add structural parity test for query row HTML

`add_query_controller.js` builds query row HTML client-side (`buildQueryRowHtml()`) that must stay in sync with `_query_list_shell.html.erb`. A comment documents this, but nothing enforces it. If the partial changes without updating the JS, in-place query addition breaks silently.

**Action:** Add a test that renders both the ERB partial and the JS builder, then asserts structural equivalence (same data attributes, same target names). Alternatively, extract a shared template consumed by both.

**Effort:** 2 hours

### Audit the proxy endpoint for SSRF and add rate limiting

`/proxy/fetch` forwards requests to user-supplied URLs. Without strict allowlisting this is an SSRF vector. No rate limiting gem is present either — API endpoints are open to abuse.

**Action:** Verify URL validation on the proxy endpoint. Add `rack-attack` for rate limiting on API and proxy routes.

**Effort:** 2–3 hours

### Enforce code coverage thresholds in CI

SimpleCov is present but not gated. Coverage can regress silently.

**Action:** Set a minimum coverage threshold (60% for new code) in SimpleCov configuration and fail the CI build when it drops below.

**Effort:** 1 hour

### Expand Stimulus controller test coverage

24 of 44 controllers have tests (55%). Modal controllers, utility controllers, and advanced feature controllers (mapper wizard, import/export, snapshot comparison, tour) are untested.

**Action:** Prioritize tests for controllers that handle data mutation (import, export, bulk judgement) over display-only controllers.

**Effort:** Ongoing

### Document the mapper code execution trust model

`search_executor.js` runs user-supplied mapper code via `new Function(mapperCode)` without sandboxing. This is acceptable for an internal tool where only case owners can edit code, but the trust model should be explicit.

**Action:** Add a section to `docs/stimulus_and_modern_js_conventions.md` documenting why this is unsandboxed and what the blast radius is if a user account is compromised.

**Effort:** 30 minutes

## Not Worth Doing

These came up in the review but aren't worth the investment:

- **TypeScript migration** — The codebase is small enough that Vitest + JSDoc is sufficient. TS would be churn.
- **ViewComponent retrofit** — Partials work fine at current scale. Use components for new features only.
- **CSS preprocessor (SCSS/Tailwind)** — The plain CSS is readable and maintainable. Don't add tooling for its own sake.
- **D3 upgrade to v8** — v7.9.0 is stable and meets all current needs.
- **Cleaning up all 67 disabled RuboCop rules** — Normal for a legacy codebase. Address individually as files are touched.

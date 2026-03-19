# Review: `deangularjs-experimental` vs incremental migration on `main`

**Date:** 2026-03-19  
**Branches compared:** `main` (incremental Angular elimination plan) vs `deangularjs-experimental` (full rewrite, ~87 commits ahead of merge-base, ~10 on `main` not in experimental).

## Executive summary

`deangularjs-experimental` is a **completed** migration: Angular removed, **Rails + ViewComponents + Stimulus + Turbo Streams**, **server-side search** (`QuerySearchService` → `FetchService`), **two-tier scoring** (API + `MiniRacer` + background job), new layout (`core_modern`), Vitest/ESLint, visual-parity tooling, and a large **`docs/port/`** knowledge base.

**You should not merge the branch wholesale** if the goal is parity with the current [angularjs_elimination_plan](./angularjs_elimination_plan.md) (browser `splainer-search`, `/proxy/fetch` DevTools visibility, incremental vertical slices). The experimental stack **intentionally** trades those for CORS/credential simplicity—documented in its own `intentional_design_changes.md`.

**High-value pulls (low coupling):**

1. **`docs/port/`** (and related parity docs)—copy or cherry-pick as **reference** on `main`, not as runtime code.
2. **`test/visual_parity/`**—automation for screenshot/API comparison; adaptable to “Angular vs Stimulus slice” regression.
3. **Security / authorization commits**—audit `main` against experimental’s `010f3043`-style fixes (see [Security note](#security-note-main-vs-experimental)).

**Medium effort / optional:**

- **Vitest + ESLint/Prettier** (`c0e917ab` area)—aligns with the plan’s “pragmatic test migration”; cherry-pick conflicts with `yarn.lock` and current Karma pipeline.
- **Tour UX** (`4094bcfe`, `ab7ea23d`)—if `tour.js` structure still matches, small cherry-picks possible.
- **Vega-Lite for charts** (`8d4285f6`)—ideas for Phase 6, not a drop-in if `main` keeps D3/qgraph longer.

**Do not expect to reuse as-is:**

- **~60 Stimulus controllers + ~37 ViewComponents**—bound to experimental routes, Turbo frames, and **server search** responses; porting piecemeal costs more than rewriting slices on `main`’s architecture.
- **`QuerySearchService` / workspace search API**—directly conflicts with client-side proxy observability unless you add a debug/echo layer (see elimination plan DevTools section).

---

## What experimental is (architecture)

From **`docs/port/main_vs_deangularjs_experimental_comparison.md`** (on the branch):

| Area | `main` (Angular core) | `deangularjs-experimental` |
|------|------------------------|----------------------------|
| Workspace | Angular SPA (`MainCtrl`, templates) | ERB + ViewComponents + Stimulus + Turbo |
| Search | Browser `splainer-search` (+ optional `/proxy/fetch`) | **Server** `QuerySearchService` → `FetchService` |
| Scoring | Client `ScorerFactory` | **Server** `QueryScoreService` / jobs + `MiniRacer` |
| Layout | `core.html.erb` + BS3 modals | `core_modern` + BS5 |
| Build | Karma, Angular esbuild bundles | Vitest, ESLint, no Angular |

**Intentional product deltas** (from **`docs/port/intentional_design_changes.md`**):

- No per-query “tuning knobs” (`DevQueryParamsCtrl`).
- Case list sort by `updated_at` instead of last-viewed metadata.
- Judgements: automatic book sync vs manual “populate” (different model).
- Scorer CRUD moved to `/scorers` only (selection in workspace).
- Team/endpoint archive flows moved to Teams page.
- Client-side query pagination (all queries in DOM, URL `?page=`).

If `main`’s migration promises **full feature parity**, treat these as **explicit scope decisions**, not bugs, when comparing to experimental.

---

## Documentation on experimental worth pulling

These live under **`docs/port/`** on `deangularjs-experimental` (paths from `git diff main...deangularjs-experimental --stat -- docs/`):

| Doc | Why pull (as reference) |
|-----|-------------------------|
| `docs/port/main_vs_deangularjs_experimental_comparison.md` | Single best **decision record** (lost/changed features, architecture table). |
| `docs/port/intentional_design_changes.md` | Explains **why** behavior differs from Angular—useful when support asks “why did X change?” |
| `docs/port/angular_services_responsibilities_mapping.md` | Maps Angular services → new code paths—helps incremental migration ownership. |
| `docs/port/workspace_api_usage.md` | API contracts for experimental workspace (search/score Turbo)—compare to your Phase 0 API table. |
| `docs/port/turbo_streams_guide.md`, `turbo_frame_boundaries.md` | If Turbo streams are in scope for core; otherwise skim for patterns. |
| `docs/port/ui_consistency_patterns.md` | UX/CSS conventions for the new workspace. |
| `docs/port/view_component_conventions.md` | Only if team adopts ViewComponent (optional per elimination plan). |
| `docs/port/visual_parity.md`, `docs/deangularjs_parity_report.md`, `docs/workspace_parity_plan.md` | Parity methodology and results. |
| `docs/port/archives/*` | Historical port notes; optional. |
| `docs/css_variables.md`, `docs/linting.md` | Tangible DX improvements if you align tooling. |

**Recommendation:** Add a subtree on `main` such as `docs/migration/archive/deangularjs-experimental/` and **copy** these files from the branch (preserve dates/authors in commit message). Avoid rewriting `docs/app_structure.md` from experimental until core actually migrates.

---

## Tooling worth pulling

### Visual parity (`test/visual_parity/`)

On experimental: Playwright-based **capture**, **API compare**, **report** scripts (`capture_screenshots.mjs`, `compare_apis.mjs`, `generate_report.mjs`, `run_comparison.sh`). Used with `Procfile.vp` / nginx in commits like `30b2741d`.

**Use on `main`:** Run **before/after** each vertical slice (Angular vs new partial) for P0 pages; reuse comparison ideas even if Procfile differs.

### Vitest (`vitest.config.js`, `c0e917ab`)

Unit tests for **extracted pure JS** modules—matches the elimination plan’s testing strategy. **Cherry-pick cost:** `yarn.lock` and coexistence with Karma until Angular is gone; consider a **fresh** Vitest setup on `main` inspired by experimental’s config rather than a blind merge.

### ESLint / Prettier (`db1c4e50`)

Same story: valuable directionally; merge as its own PR if desired.

---

## Security note: `main` vs experimental

Experimental commit **`010f3043`** (“Fix IDOR vulnerabilities, XSS…”) includes, among other things:

- Scoping **`CasesController#set_case`** through **`current_user.cases_involved_with`** (and similar for teams, query doc pairs, AI judge prompts).
- Sanitization instead of raw `.html_safe` in places.
- Tests for authorization.

On **`main` today**, `CasesController` (Rails listing + archive/unarchive) uses:

```ruby
def set_case
  @case = Case.find_by(id: params[:id])
end
```

with **no** `cases_involved_with` scope before `archive` / `unarchive`. That is a **likely IDOR** (any authenticated user who can hit the route with another user’s case id). **This should be fixed on `main` independently of the Angular migration**, either by porting the experimental pattern or an equivalent authorization check.

Also compare **`main`** fixes that experimental may lack (e.g. **#1659** proxy 403, **#1677** book/case sync, **#1661** Charlie bugs)—a merge of experimental would need **forward-porting** those commits.

---

## Should we build here vs pull code?

| Pull wholesale experimental? | **No**—architectural and product goals diverge from the documented incremental plan. |
|------------------------------|--------------------------------------------------------------------------------------|
| Pull **visual parity** tooling? | **Yes**, with adaptation to Docker/Procfile on `main`. |
| Pull **QuerySearchService** workspace? | **Only** if product explicitly accepts server-side search + DevTools tradeoff; then treat as a **revised** plan, not “incremental parity.” |
| Pull **Stimulus controllers** one-by-one? | **Rarely**—tightly coupled to experimental HTML and APIs; use as **read-only reference** when implementing the same feature on `main`. |
| Cherry-pick **security** commits? | **Audit and port** fixes to `main` (see above); do not assume experimental is a superset of `main` security. |

---

## Related

- [angularjs_elimination_plan.md](./angularjs_elimination_plan.md) — canonical approach on `main` (vertical slices, client search parity, proxy DevTools).
- Branch tip for further inspection: `deangularjs-experimental` (also `origin/deangularjs-experimental`).

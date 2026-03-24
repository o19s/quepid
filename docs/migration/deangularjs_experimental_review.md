# Review: `deangularjs-experimental` vs incremental migration on `main`

**Date:** 2026-03-21  
**Branches compared:** `main` (incremental Angular elimination plan) vs `deangularjs-experimental` (full rewrite). Commit counts vs merge-base drift over time; as of this revision: **`deangularjs-experimental` ~87 commits ahead**, **`main` ~10 commits** not in experimental (`git merge-base main deangularjs-experimental` then `git rev-list --count <base>..<branch>`).

## Executive summary

`deangularjs-experimental` is a **completed** migration: Angular removed, **Rails + ViewComponents + Stimulus + Turbo Streams**, **server-side search** (`QuerySearchService` → `FetchService`), **two-tier scoring** (API + `MiniRacer` + background job), new layout (`core_modern`), Vitest/ESLint, visual-parity tooling, and a large **`docs/port/`** knowledge base.

**High-value pulls (low coupling):**

3. **Security / authorization commits**—audit `main` against experimental’s `010f3043`-style fixes (see [Security note](#security-note-main-vs-experimental)).

**Medium effort / optional:**

- **Tour UX** (`4094bcfe`, `ab7ea23d`)—if `tour.js` structure still matches, small cherry-picks possible.
- **Vega-Lite for charts** (`8d4285f6`)—ideas for Phase 6, not a drop-in if `main` keeps D3/qgraph longer.

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

**Note:** Rows above contrast **default** `/case/...` on `main` (Angular core) with experimental. The **`new_ui`** strangler URL on `main` is already **Rails + Stimulus** and is adding **browser-side** search modules (`search_executor`, etc.)—still **not** experimental’s server `QuerySearchService` stack.

**Intentional product deltas** (from **`docs/port/intentional_design_changes.md`** on the branch; on `main` the same themes are **section 2** in [intentional_design_changes.md](./intentional_design_changes.md) — candidates only, not default migration scope):

- No per-query “tuning knobs” (`DevQueryParamsCtrl`).
- Case list sort by `updated_at` instead of last-viewed metadata.
- Judgements: automatic book sync vs manual “populate” (different model).
- Scorer CRUD moved to `/scorers` only (selection in workspace).
- Team/endpoint archive flows moved to Teams page.
- Client-side query pagination (all queries in DOM, URL `?page=`).

---

## Documentation on experimental worth pulling

These live under **`docs/port/`** on `deangularjs-experimental` (paths from `git diff main...deangularjs-experimental --stat -- docs/`):

| Doc | Why pull (as reference) |
|-----|-------------------------|
| `docs/port/main_vs_deangularjs_experimental_comparison.md` | Single best **decision record** (lost/changed features, architecture table). |
| `docs/port/intentional_design_changes.md` | On the branch: why behavior differs from Angular. On `main`: [intentional_design_changes.md](./intentional_design_changes.md) — section 1 hardening, section 2 signed-off-only product ideas |
| `docs/css_variables.md`, `docs/linting.md` | Tangible DX improvements if you align tooling. |

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

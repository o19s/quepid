# Review: `deangularjs-experimental` vs incremental migration on `main`

**Date:** 2026-03-21

**High-value pulls (low coupling):**

3. **Security / authorization commits**—audit `main` against experimental’s `010f3043`-style fixes (see [Security note](#security-note-main-vs-experimental)).

**Medium effort / optional:**

- **Tour UX** (`4094bcfe`, `ab7ea23d`)—if `tour.js` structure still matches, small cherry-picks possible.
- **Vega-Lite for charts** (`8d4285f6`)—ideas for Phase 6, not a drop-in if `main` keeps D3/qgraph longer.

---

## What experimental is (architecture)

From **`docs/port/main_vs_deangularjs_experimental_comparison.md`** (on the branch):

**Intentional product deltas** (from **`docs/port/intentional_design_changes.md`** on the branch; on `main` the same themes are **section 2** in [intentional_design_changes.md](./intentional_design_changes.md) — candidates only, not default migration scope):

- No per-query “tuning knobs” (`DevQueryParamsCtrl`).
- Case list sort by `updated_at` instead of last-viewed metadata.
- Judgements: automatic book sync vs manual “populate” (different model).
- Scorer CRUD moved to `/scorers` only (selection in workspace).
- Team/endpoint archive flows moved to Teams page.
- Client-side query pagination (all queries in DOM, URL `?page=`).

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

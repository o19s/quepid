# Design notes: parity plan vs optional candidates

**Does not redefine migration scope.** Goals, P0 parity, and the browser search/scoring model are authoritative in [angularjs_elimination_plan.md](./angularjs_elimination_plan.md). Stack options: [rails_stimulus_migration_alternative.md](./rails_stimulus_migration_alternative.md), [old/react_migration_plan.md](./old/react_migration_plan.md).

This document only lists:

1. **Items we should align with** as we touch APIs or new UI (security and robustness).
2. **Product/UX ideas** that came up during **`deangularjs-experimental`** and similar discussions — implement **only** with explicit product sign-off / ADR; several **conflict with parity** if slipped in as “the migration default.”

---

## 1. Align as you implement (recommended)

These fit the parity migration and improve safety or resilience without requiring a product redesign.

### 1.1 Authorization: scope by user (IDOR hardening)

**Issue:** APIs must resolve cases, teams, books, and related records through **scopes the current user may access**, not unconstrained id lookups.

**Action:** Audit and fix as you migrate or refactor controllers; see [deangularjs_experimental_review.md](./deangularjs_experimental_review.md) for a concrete comparison with experimental fixes.

### 1.2 Rating deletion: tolerate “already gone”

**Issue:** Deleting a rating that was already removed can error; races (tabs, double clicks) get worse with more async UI.

**Action:** Prefer **no-op success** (or equivalent) for “delete missing rating” so the client can stay optimistic without surfacing 500s.

---

## 2. Consider only with explicit product sign-off (not default migration)

The following were **directions on `deangularjs-experimental`** or adjacent discussions. They are **not** part of the written parity plan. Adopting them changes behavior vs today’s Angular UI.

**Observability gate:** We are **not** planning to move **interactive** search (or, by the same principle, interactive scoring) **server-side** unless we can match **today’s DevTools / Network visibility** for search traffic—see [angularjs_elimination_plan.md § Browser DevTools visibility and `/proxy/fetch`](./angularjs_elimination_plan.md#browser-devtools-visibility-and-proxyfetch). Anything below that would hide per-engine requests behind a single Quepid API call needs an **explicit** ADR covering observability (debug tooling, echoed requests, etc.), not just a product preference.

| Candidate | What it would change vs Angular today | Parity impact |
|-----------|----------------------------------------|---------------|
| **Automatic book / judgement sync** | Legacy workspace uses explicit “populate judgements” / book push flows in places; experimental favored background sync. | **High** — elimination plan keeps judgements modal behavior in scope. |
| **Scorer CRUD only on `/scorers`** | Today, scorer create/edit/share can live in **workspace modals**. | **High** — would remove or shrink modal flows. |
| **Case list sort by `updated_at` only** | Today, **last viewed** can affect ordering users expect. | **Medium** — cases list / dropdown behavior changes. |
| **Heavy team/endpoint CRUD off modals** | Some flows are modal-based today; moving them is a product/IA choice. | **Medium** — depends which modals. |
| **Query list pagination model** | Angular uses paginated lists in places; experimental used “all queries in DOM + `?page=`” style patterns. | **Medium** — must match chosen parity for list UX. |
| **Server-primary interactive search** | Browser only calls a Quepid JSON API; Rails/`FetchService` talks to Solr/ES/OS. | **High** — **breaks** today’s Network-tab visibility of engine requests unless an ADR adds an equivalent (see observability gate above). |
| **Server-primary interactive scoring** | Experimental used API/job + MiniRacer-style paths for scores the workspace shows immediately; parity keeps **browser `ScorerFactory`** for that loop. | **High** — same **observability** expectation as search: not default unless we expose an equivalent transparency story (ADR). |

If product wants any row above, document it in an ADR or ticket and reconcile with [angularjs_ui_inventory.md](../angularjs_ui_inventory.md) / P0 checklist — do not treat this table as backlog for the default port.

---

## 3. Workspace capabilities: parity vs optional improvements

Most capabilities **already exist** in the Angular workspace and/or Rails JSON APIs; the port **rehouses** them. **Where today:** flows in [workspace_behavior.md](./workspace_behavior.md), services in [angular_services_responsibilities_mapping.md](./angular_services_responsibilities_mapping.md), endpoints in [workspace_api_usage.md](./workspace_api_usage.md), screenshots in [angularjs_ui_inventory.md](../angularjs_ui_inventory.md).

### Optional improvements (not required for “we had it before”)

| Theme | Notes |
|-------|-------|
| **Async export with progress** | Enhancement over direct download / client-assembled export. |
| **Unified documented contract** for query/results | Consolidation across proxy, snapshot search, and jobs — documentation effort. |
| **Richer field/schema discovery** | Roadmap UX; not a prerequisite for porting. |
| **Stronger pre-save endpoint checks** | Incremental hardening. |
| **Notes-only API shape** | Ergonomics; notes already updatable via existing APIs. |

Prioritize porting work against [angularjs_elimination_plan.md](./angularjs_elimination_plan.md).

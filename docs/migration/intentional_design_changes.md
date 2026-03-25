# Product/UX candidates (not default migration scope)

**Security and robustness items** (formerly Section 1) have been consolidated into [security_and_robustness.md](./security_and_robustness.md).

**Does not redefine migration scope.** Goals and P0 parity are authoritative in the elimination plan (see [old/](./old/)).

---

The following were **directions on `deangularjs-experimental`** or adjacent discussions. They are **not** part of the written parity plan. Adopting them changes behavior vs today's Angular UI. Implement **only** with explicit product sign-off / ADR.

**Observability gate:** We are **not** planning to move **interactive** search (or scoring) **server-side** unless we can match **today's DevTools / Network visibility** for search traffic. Anything that would hide per-engine requests behind a single Quepid API call needs an **explicit** ADR covering observability (debug tooling, echoed requests, etc.), not just a product preference.

| Candidate | What it would change vs Angular today | Parity impact |
|-----------|----------------------------------------|---------------|
| **Automatic book / judgement sync** | Legacy workspace uses explicit "populate judgements" / book push flows; experimental favored background sync. | **High** — elimination plan keeps judgements modal behavior in scope. |
| **Scorer CRUD only on `/scorers`** | Today, scorer create/edit/share can live in **workspace modals**. | **High** — would remove or shrink modal flows. |
| **Case list sort by `updated_at` only** | Today, **last viewed** can affect ordering users expect. | **Medium** — cases list / dropdown behavior changes. |
| **Heavy team/endpoint CRUD off modals** | Some flows are modal-based today; moving them is a product/IA choice. | **Medium** — depends which modals. |
| **Query list pagination model** | Angular uses paginated lists in places; experimental used "all queries in DOM + `?page=`" style patterns. | **Medium** — must match chosen parity for list UX. |
| **Server-primary interactive search** | Browser only calls a Quepid JSON API; Rails/`FetchService` talks to Solr/ES/OS. | **High** — **breaks** today's Network-tab visibility of engine requests unless an ADR adds an equivalent. |
| **Server-primary interactive scoring** | Experimental used API/job + MiniRacer-style paths for scores; parity keeps **browser `ScorerFactory`** for that loop. | **High** — same **observability** expectation as search. |

If product wants any row above, document it in an ADR or ticket — do not treat this table as backlog for the default port.

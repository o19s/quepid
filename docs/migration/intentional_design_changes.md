# Intentional design changes from Angular

This document records **deliberate** differences between the legacy Angular workspace and the Rails + Stimulus target—not regressions. Treat items below as **agreed direction** unless a ticket or ADR explicitly revises them. Revisit quarterly so “target” text still matches what ships.

**Non-goals:** Recreating every Angular shortcut or modal flow when a dedicated page or server-driven flow is clearer; matching legacy behavior when it conflicted with security or maintainability (called out per item).

---

## 1. Book / judgement sync: automatic, not manual push

**Angular:** Users could explicitly push ratings from the workspace into a Book (including a bulk “populate judgements” style flow).

**Target / migrated:** Ratings flow toward Books **automatically** in the background when users rate in the workspace. No manual “push” step. Pulling aggregated judgements back into the Case can remain an explicit action (e.g. refresh from book).

**Why:** The old two-way model made conflicts hard to reason about when ratings changed after a push. A clearer split: Book as judgement authority, Case as live search workspace; per-rating sync avoids “forgot to push.”

---

## 2. Scorer management on a dedicated page

**Angular:** Full scorer CRUD lived in workspace modals.

**Target / migrated:** **Selection** of a scorer stays in the workspace; **create / edit / clone / delete / share** live on a dedicated scorers area (consistent with scorers living outside the legacy core UI elsewhere in the app).

**Why:** Editing shared scorers inside one case’s modal is cramped and misleading. A dedicated page supports testing, previews, and editing without blocking the workspace.

---

## 3. Case list sort by recency of change, not last opened

**Angular:** Case list could reflect “last viewed” so merely opening a case floated it to the top.

**Target / migrated:** Prefer sorting by **actual change** (e.g. `updated_at`-style semantics) rather than last-open metadata.

**Why:** Last-viewed sort was confusing — opening a case reordered the list even when nothing substantive changed.

---

## 4. Heavy CRUD moved out of workspace modals

**Angular:** Some team and endpoint workflows lived in workspace modals.

**Target / migrated:** Complex flows live on **dedicated pages** (e.g. teams, endpoints) instead of modal cramming. Same principle as **§2** (scorers).

**Why:** Modals are poor homes for multi-step admin; separate pages scale better for permissions, deep links, and testing.

---

## 5. Query list pagination: client-side over full list

**Angular:** Paginated query list (e.g. ~15 per page).

**Target / migrated:** Keep a **client-side** pagination model over the full query set: filter/sort on the full list, then paginate; optionally persist page in the URL. Match product needs for “expand all” vs collapse-heavy workflows for huge cases.

**Why:** Avoids server round-trips for page flips while still not rendering thousands of rows visible at once. Case-level score reconciliation still follows **§6** (background evaluation), not the pagination model alone.

---

## 6. Scoring: immediate feedback + background full evaluation

**Angular:** Scoring ran synchronously in the browser against loaded results.

**Target / migrated:** Use a **two-tier** model:

1. **Immediate:** Per-query feedback as soon as the user acts—**server-authoritative** for persisted scores (API response or Turbo Stream updates the UI); avoid relying on the browser as the only source of scored state.
2. **Background:** A job or async pass reconciles the **whole case** and refreshes aggregate case-level scores; notify the UI when that pass completes (e.g. Turbo Streams).

**Why:** When results are not fully resident in the browser, browser-only scoring does not fit. Users still expect fast per-query feedback and **eventual consistency** for case-level numbers.

---

## 7. Authorization: scope by user (IDOR hardening)

**Angular / risk:** In a SPA, clients can still call APIs with identifiers; historically, some patterns resolved records by id without consistently tying the lookup to **the current user’s** allowed associations.

**Target / migrated:** Load cases, teams, books, and related records through **scopes the user is allowed to see**, not global lookups.

**Why:** The UI may hide other users’ ids, but APIs remain callable; server-side scoping is the backstop.

---

## 8. Rating deletion: tolerate “already gone”

**Angular:** Deleting a missing rating could error.

**Target / migrated:** Treat “delete rating that isn’t there” as a **no-op success** (or equivalent soft behavior) so races (tabs, streams, double clicks) do not surface as hard failures.

**Why:** Live updates make duplicate or stale deletes more likely; graceful behavior beats 500s.

---

## Workspace capabilities: parity vs optional improvements

Several items were previously labeled “new” or “no Angular equivalent.” **Most already exist** in the legacy Angular UI and/or Rails APIs and jobs. The migration task is usually to **rehouse** them in Rails views, Stimulus, and Turbo—not to invent the feature from scratch.

Prioritize against [angularjs_elimination_plan.md](../angularjs_elimination_plan.md) and the roadmap.

### Already in Quepid today (preserve / port)

Indicative locations only; search the codebase as the source of truth.

| Capability | Where it lives today |
|------------|----------------------|
| **Case export** (CSV, detailed, snapshot-linked, TREC, RRE, JSON case dump, information-need template, …) | Angular `export_case` + `caseCSVSvc`; `api/export/...` |
| **Case import** (CSV hash, RRE, LTR; information-need CSV) | Angular `importRatingsSvc`; `Api::V1::Import::RatingsController`; `Api::V1::Import::Queries::InformationNeedsController` |
| **Query notes** (and information need on queries) | `Api::V1::Queries::NotesController`; queries API / model (`notes`, `information_need`) |
| **Snapshots from current results** | `querySnapshotSvc` (`addSnapshot`, …); `Api::V1::SnapshotsController` and related snapshot APIs |
| **Server-side search execution & engine parsing** | `ProxyController` for proxied search; `Api::V1::Snapshots::SearchController`; `RunCaseEvaluationJob`; `FetchService` (e.g. Solr response shaping)—**browser-side** extractors also exist for some flows (e.g. explain) |
| **Endpoint configuration & basic validation** | Settings / wizard flows (e.g. JSON validation for ES/OS query DSL); `SearchEndpoint` model validations; mapper wizard save path |

### Optional improvements (consolidation / UX—not required for baseline parity)

| Theme | Notes |
|-------|--------|
| **Heavier / async export** | Much export today is client-assembled or direct download. Moving large exports to **background jobs with progress** would be an enhancement, not a prerequisite for “we had export before.” |
| **Unified query & results contract** | Behavior is **split** across proxy, Angular-built search URLs, snapshot search endpoints, and evaluation jobs. Defining **one documented API** for the Rails workspace is **consolidation**, not a brand-new capability. |
| **Field discovery** | Today, field specs are often **typed or configured** per engine; richer **schema introspection** in the UI may still be roadmap where free-typing remains common. |
| **Stronger pre-save endpoint checks** | Reachability or smoke-test before save **varies by flow**; tightening this is incremental hardening. |
| **Dedicated notes-only API** | Notes already have an update path; splitting “notes only” vs generic `PATCH` query is **API ergonomics**, not greenfield functionality. |

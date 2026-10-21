# Todo

**Last updated:** 2026-10-19

Outstanding migration work and follow-ups for the AngularJS-removal branch.
`[PREEXISTING]` bugs, hardening and cleanup are in
[after-angular-removal.md](after-angular-removal.md). When something is fixed, remove its entry — do not add a completed section or keep resolved items for history.

Items requiring unresolved team decisions retain a **Decision needed** note.

Every actionable item carries a provenance marker: `[MIGRATION]` means it was
introduced by or is required to complete AngularJS removal, `[MIGRATION-FOLLOWUP]`
means it is related cleanup but not necessarily a migration regression, and
`[PREEXISTING]` means it predates the AngularJS removal. Use these markers when
choosing migration work; do not treat pre-existing defects as migration regressions.
The pre-migration baseline is `be9b319a` (`main` before the Bootstrap 3→5 and
AngularJS-removal work began). Later `main` commits already include migration
changes, so don't use them to decide provenance.

Ratings appear as `P2 I3 C1` beside each item.

| Rating | 0 | 1 | 2 | 3 |
| --- | --- | --- | --- | --- |
| **P — Priority** (lower is more urgent) | Critical | High | Normal | Opportunistic |
| **I — Simplification impact** (higher is more benefit) | Little or no code reduction | Local simplification | Removes duplication or complexity across several paths | Substantial reduction in wrappers, code, or maintenance burden |
| **C — Complexity / risk** (lower is easier and safer) | Trivial, isolated edit | Small change with limited regression risk | Several interacting paths or meaningful behavioral risk | Broad change, sensitive data/security contracts, or unresolved design decisions |

## [MIGRATION] Sign-off gate for landing the AngularJS removal

From the [engineering review](../manual-testing/engineering-review-cleanup.md#l1-land-the-branch-before-further-refactoring-migration-followup).

**Scope freeze:** until this gate passes, the branch takes only parity fixes,
work toward the gate, and fixes for failures the gate turns up. Restructuring
(stylesheet splits, markup moves, renames, collapsing runtime layers) waits
until after landing and goes to `main` as ordinary PRs; it is tracked in
[after-angular-removal.md](after-angular-removal.md). A change to an owner file
reopens any closed checklist row that relies on it.

The branch lands when all of these hold on one commit:

- Every row in the [Angular parity checklist](../manual-testing/angular-parity-checklist.md)
  is closed: each item is ticked, marked N/A, or linked to a decision. Losses
  without a decision are recorded as tagged entries in this file.
- No other `[MIGRATION]` entries remain in this file, and every entry titled
  "before merge" is resolved or reclassified with evidence. Delete this section
  when the branch lands.
- `bin/manual_test_status --due-only` lists nothing in parts 03–07 (case
  management, the core workbench, endpoints and the case wizard).
- These pass in the server container: `yarn test:unit`, `rails test`,
  `yarn lint:js`, `yarn lint:css`, `bundle exec rubocop`, `yarn test:visual`, and
  the full local `yarn test:e2e` run (not in CI).

---

### [MIGRATION-FOLLOWUP] P2 I0 C2 — Case list lost Legacy row actions and details (inherited from main)

1. **Row actions.** Legacy rows offered Rename (inline), Delete (modal "Delete This Case — You're about to delete this case forever! …"), Archive, Export (the export modal) and Share. The list now has Share and Archive only. Rename, Delete and Export remain in the case workbench (header double-click, toolbar). Dropped all three in `aa076cb3` ("Good by angular /cases listing UI!", inside #1642): that commit deleted Legacy's `case_listing.html` and added the Rails list with Share and Archive only. Neither the PR description nor the commit says whether this was intended.
  - **Needs Eric's review:** confirm it was deliberate, or restore them. Delete matters most, because cleaning up cases now means opening each one in the workbench.
2. **Archive confirmation copy.** Legacy: "Archive This Case for Later? You're about to put this case into deep freeze. You'll be able to unarchive it later through the \"Archived Cases\" filter …". Now the shared Confirm modal: "Confirm Archive <case>?". Replaced it in `aa076cb3` (inside #1642) with a generic modal titled "Confirm" that asks `Archive <case>?`. This branch later rewired that confirm (`1e700a37`, `42cb7bf9`, `2608ea7b`) but kept his wording. Neither the PR description nor the commit says whether dropping Legacy's explanation was intended.
  - **Needs Eric's review:** confirm it was deliberate, or add back the sentence on where archived cases go and how to unarchive them.
3. **View filter.** Legacy's All / My Cases / Shared With Me Cases / Archived Cases buttons became a Team select plus an Archived checkbox, so "mine" and "shared with me" cannot be filtered. Legacy also had a per-page number box, a "Loading Your Cases" spinner and a notice when there are more than 30 cases; the list is now server-paginated. Legacy's "No cases to show!" is gone too: Current shows "Create your first case by clicking New Case above." only when nothing is filtered, and an empty table otherwise. Built the new filters (search, Archived checkbox, Team select) and the `pagy` paging in `aa076cb3` (inside #1642); later commits on main only tuned search and queries. This was a redesign rather than a gap, but nothing records that losing "Mine" and "Shared with me" was intended.
  - **Needs Eric's review:** confirm it was deliberate, or add an owner filter.
4. **Row details.** The unrated frog beside the score (title "Hop to it! There are unrated results!"), the full-precision score (`0.490414`, now `0.464`) and the relative last-run time ("about 2 hours ago", now "17 Oct 14:16") are gone. The nightly icon (now in Last Run By) and team links in the Teams column are still there (re-checked live 2026-10-19). Left all three out in `aa076cb3` (inside #1642); the Rails row has used `number_with_precision(…, precision: 3)` and `l(…, format: :short)` since then. He added the nightly icon back in #1750 (`8699bbac`), so these may be omissions too.
  - **Needs Eric's review:** confirm it was deliberate, or restore them.

---

### [MIGRATION-FOLLOWUP] P2 I0 C1 — `SearchResultsController` view-state predicates disagree

`isResultsView` treats any falsy value as the default view while `renderState`
defaults only `undefined`. Define the valid state values, fix with a test, and
only then collapse to one predicate.

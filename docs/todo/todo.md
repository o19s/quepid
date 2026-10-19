# Todo

**Last updated:** 2026-10-19

Outstanding migration work and follow-ups for the AngularJS-removal branch.
`[PREEXISTING]` bugs, hardening and cleanup are in
[after-angular-removal.md](after-angular-removal.md). When something is fixed, remove its entry — do not add a completed section or keep resolved items for history.

Items requiring unresolved team decisions retain a **Decision needed** note. A security label, implementation difficulty, or ordinary technical choice alone does not require team agreement.

Every actionable item carries a provenance marker: `[MIGRATION]` means it was
introduced by or is required to complete AngularJS removal, `[MIGRATION-FOLLOWUP]`
means it is related cleanup but not necessarily a migration regression, and
`[PREEXISTING]` means it predates the AngularJS removal. Use these markers when
choosing migration work; do not treat pre-existing defects as migration regressions.
The pre-migration baseline is `be9b319a` (`main` before the Bootstrap 3→5 and
AngularJS-removal work began). Later `main` commits already include migration
changes, so don't use them to decide provenance.

Ratings appear as `P2 I3 C1` beside each item. Reviewed 2026-10-08 from a
pragmatic Rails/Hotwire perspective against the described scope and current
source; revise them when implementation reveals more. Ratings include the full
fix and verification, not just the smallest extraction. Deferral and decision
notes remain in force regardless of priority.

| Rating | 0 | 1 | 2 | 3 |
| --- | --- | --- | --- | --- |
| **P — Priority** (lower is more urgent) | Critical | High | Normal | Opportunistic |
| **I — Simplification impact** (higher is more benefit) | Little or no code reduction | Local simplification | Removes duplication or complexity across several paths | Substantial reduction in wrappers, code, or maintenance burden |
| **C — Complexity / risk** (lower is easier and safer) | Trivial, isolated edit | Small change with limited regression risk | Several interacting paths or meaningful behavioral risk | Broad change, sensitive data/security contracts, or unresolved design decisions |

Impact measures expected reduction in code and maintenance complexity, not
user benefit or security importance; an urgent bug can be `P0 I0`. Complexity
includes verification effort and regression risk, not just lines changed.
Choose by priority first, then favor higher impact and lower complexity within
a priority tier. For example, `P2 I3 C1` offers more simplification for less risk
than `P2 I1 C3`. Group ratings summarize scope; nested items have their own estimates.
Individual ratings take precedence over historical priority labels on sections.
Confirmed cross-account writes remain critical; data loss and inconsistent scores
take precedence over optional DRY work. No tests or browser flows were rerun for
this ranking review.

Source audit: 2026-10-05 against `4bf88e5b` and the working tree. This review
checked current implementations, recent changes and existing tests/verification
records; it did not rerun browser flows or tests. Historical observations below
are retained only where the current source still supports the unresolved issue.
Browser coverage and actual verification timestamps live in
`docs/manual-testing/tracking.yml`.
Line numbers may drift — re-check cited files before fixing.

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

### [MIGRATION-FOLLOWUP] P1 I0 C2 — Classify the required-proxy wizard failure before merge

Manual scenario 7.13 retains an unresolved failure: new-engine Finish selected an
archived endpoint with dummy credentials and search failed; explicit endpoint
selection worked. Reproduce with controlled endpoint fixtures and distinguish
inherited lookup behavior from a regression in the new required-proxy flow.
The historical application lacks this flag; its absence alone proves neither
parity nor regression. Do not change endpoint reuse semantics without that evidence.

## [MIGRATION-FOLLOWUP] P2 — Product bugs

### [MIGRATION-FOLLOWUP] P3 I0 C1 — Annotation list display changes with no recorded decision

Found closing rows [23](../manual-testing/angular-parity-checklist.md#row-23) (`annotations.html`), [24](../manual-testing/angular-parity-checklist.md#row-24) (`annotation.html`) and [26](../manual-testing/angular-parity-checklist.md#row-26) (`_update.html`). Owners: `_annotation.html.erb`, `_edit_annotation_modal.html.erb`, `annotations_controller.js`. Create, edit, delete (no confirmation on either), reload persistence and the graph markers match Legacy (replayed on Legacy :3001 and Current :3000 with equivalent cases, 2026-10-17). The Annotations tab intro rewording is kept ([NOT-DOING](NOT-DOING.md#angular-parity-changes-kept-after-the-2026-10-17-review)). Scenario 5.4 describes the behaviours below but records no decision to depart from Legacy.

1. **Score is rounded to two decimals.** Current shows `Score: 0.53`; Legacy showed the raw float (`0.5572889180924896` right after creating, `0.557289` after reload).
2. **"Try No" shows the try number.** Current shows `1`; Legacy showed `score.try_id`, the database id of the try (`154`). Legacy looks wrong here.
3. **Relative time wording.** Current shows "1 second ago" or "now"; Legacy showed "less than a minute ago" (`timeAgo` filter, removed in `6656949e`).
4. **Empty state and disabled Create.** Current shows "No annotations yet." under Existing Annotations and disables Create until a case score exists (the "Can't create a new annotation until searches have been run!" flash is kept). Legacy showed an empty list and the flash only.
5. **Edit Annotation footer order.** Current shows Cancel before Update; Legacy showed Update then Cancel.

**Fix direction:** 1, 2 and 4 look like improvements; keep them and add the line to scenario 5.4 as a decision. 3 and 5 are cosmetic; either restore or keep. Not decided here because each is a copy or flow change, not a plain restoration.

---

### [MIGRATION-FOLLOWUP] P2 I0 C1 — Core workbench behaviour changes with no recorded decision

Found closing the core workbench rows of the [parity checklist](../manual-testing/angular-parity-checklist.md). Each was replayed on Legacy (:3001) and Current (:3000) on 2026-10-17 unless it says source only. None has a NOT-DOING entry or a user-approved decision; where a scenario describes the new behaviour, that is noted.

1. **A missing or unshared case id is a bare 404.** Row [30](../manual-testing/angular-parity-checklist.md#row-30). Legacy loaded an empty workspace with "Could not retrieve case N. Confirm that the case has been shared with you via a team you are a member of!". Current renders the generic Rails 404 ("The page you were looking for doesn't exist"). Scenario 4.17 and a `CoreController` comment describe the 404 (no embedded workspace data, no case created by a GET); neither records the lost explanation. Recommended: keep the 404 and add the sharing hint to it, or record the decision.
2. **Embedded media detection differs.** Row [31](../manual-testing/angular-parity-checklist.md#row-31), source only. Legacy matched the extension anywhere in the value (so `clip.mp3#t=5` embedded) and rendered nothing when no extension matched. Current uses the last path segment before `?` and shows the raw value as text when nothing matches. Recommended: keep the text fallback; accept the fragment case or match the extension before `#` as well.
3. **Query Options modal handles invalid JSON differently.** Rows [22](../manual-testing/angular-parity-checklist.md#row-22) and [48](../manual-testing/angular-parity-checklist.md#row-48). Legacy closed the modal on **Set Options** and then flashed "Please provide a valid JSON object." (the edit was lost). Current keeps the modal open with the same flash, so the text can be fixed. A query with no options opens as `{}` on Current; Legacy opened a blank editor. Both look like improvements. Recommended: keep and record.
4. **The Matches popover stays open behind the Debug and Expand modals.** Rows [33](../manual-testing/angular-parity-checklist.md#row-33), [38](../manual-testing/angular-parity-checklist.md#row-38) and [43](../manual-testing/angular-parity-checklist.md#row-43). On Legacy the popover (outside-click trigger) closed once the modal opened. On Current it stays open, so after the modal closes the next click on **Matches** closes it instead of reopening it. Recommended: close the popover when Debug or Expand opens. Not done here because the popover helper is shared with the rating popover.
5. **The Import modal lost the "Header" checkbox and validates CSV rows differently.** Rows [5](../manual-testing/angular-parity-checklist.md#row-5) and [44](../manual-testing/angular-parity-checklist.md#row-44). Legacy's uploader showed a "Header" checkbox next to each CSV file chooser; Current has none and always treats the first line as the header. Legacy rejected only lines with more than three (ratings) or two (information needs) columns, and listed the offending lines under the preview; Current requires every line to match the header's column count and reports "CSV format error: line N: expected X columns but found Y." Both changes look deliberate but have no recorded decision. Recommended: keep Current's validation and record it; restore the checkbox only if headerless files matter.
6. **A failed import keeps the Import modal open.** Row [5](../manual-testing/angular-parity-checklist.md#row-5). Legacy closed the modal and flashed the error; Current flashes the same error (prefixes restored in this pass) and leaves the modal open for a retry. Looks like an improvement; recorded for completeness.

---

### [MIGRATION-FOLLOWUP] P2 I0 C2 — Case list lost Legacy row actions and details (inherited from main)

Found closing the ported-on-main rows [59](../manual-testing/angular-parity-checklist.md#row-59) (`cases/index.html`), [60](../manual-testing/angular-parity-checklist.md#row-60) (`case_listing.html`), [65](../manual-testing/angular-parity-checklist.md#row-65), [73](../manual-testing/angular-parity-checklist.md#row-73) and [75](../manual-testing/angular-parity-checklist.md#row-75). Legacy's `/cases` (the only management page that was AngularJS at `8ceb99e9`) was replayed against main (:3003, `776c68b5`) and Current (:3000) on 2026-10-17. Main's Rails list, from `e52cec3a` (#1642, "Migrate teams, scorers and case listings away from angularjs"), is what Current has: the branch did not change it (live text and controls are identical on main and Current). The PR is the only decision on record; none of the losses below is named in a NOT-DOING entry or scenario.

1. **Row actions.** Legacy rows offered Rename (inline), Delete (modal "Delete This Case — You're about to delete this case forever! …"), Archive, Export (the export modal) and Share. The list now has Share and Archive only. Rename, Delete and Export remain in the case workbench (header double-click, toolbar).
2. **Archive confirmation copy.** Legacy: "Archive This Case for Later? You're about to put this case into deep freeze. You'll be able to unarchive it later through the \"Archived Cases\" filter …". Now the shared Confirm modal: "Confirm Archive <case>?".
3. **View filter.** Legacy's All / My Cases / Shared With Me Cases / Archived Cases buttons became a Team select plus an Archived checkbox, so "mine" and "shared with me" cannot be filtered. Legacy also had a per-page number box, a "Loading Your Cases" spinner and a notice when there are more than 30 cases; the list is now server-paginated.
4. **Row details.** The unrated frog beside the score (title "Hop to it! There are unrated results!"), the nightly icon beside the title, team links in the Teams column (now "—"), the full-precision score (`0.490414`, now `0.464`) and the relative last-run time ("about 2 hours ago", now "17 Oct 14:16") are gone.

5. **The paste-JSON import page is gone.** Legacy served `/cases/import` ("Case Import — Visit any case at /cases/caseId?export=true, paste the JSON here…"), reachable by URL only. Main and Current return a routing 404 there; the file-based **Import Case from JSON** modal covers the same job.

Everything else on the page matches: the Import case from JSON and Import snapshots modals (the snapshot modal also has the ISO-timestamp note from `795b2474`), the Share modal, the archived list with **Unarchive case**, and every column.

**Fix direction:** 4 (frog, nightly icon, team links) are plain restorations if wanted; 1 to 3 are product calls. Not changed here: the branch inherited them, they pre-date it, and restoring them reaches into main's Rails pages.

---

## [MIGRATION-FOLLOWUP] Consolidated DRY review

### [MIGRATION-FOLLOWUP] P2 I0 C1 — `SearchResultsController` view-state predicates disagree

`isResultsView` treats any falsy value as the default view while `renderState`
defaults only `undefined`. Define the valid state values, fix with a test, and
only then collapse to one predicate.

## [MIGRATION-FOLLOWUP] Developer Experience Review

A review of Quepid's tooling, structure and architecture from four perspectives: software architect, pragmatic engineer, modern Rails/Hotwire engineer, and engineering leadership. The focus is readability, maintainability and ease of use.

**Reviewed:** October 5, 2026. This snapshot includes the current working tree, including pending changes. Findings come from source, configuration and documentation inspection; no builds, test suites or browser flows were run for this documentation update. File counts describe source files, not runtime classes or test coverage.

### [MIGRATION-FOLLOWUP] P3 I0 C2 — Patch upstream Stimulus LSP controller detection

Submit an upstream [stimulus-parser](https://github.com/marcoroth/stimulus-parser)
patch to resolve Rails importmap paths (`controllers/...`) and mixin inheritance
such as `extends withStatusMessages(Controller)` and
`extends withDestructiveForm(CoreModalControllerBase)`. Verify controller
discovery, inherited actions, targets and values against Quepid's shared bases
and ordinary `extends Controller` classes. Stimulus LSP 1.1.2's bundled parser
misses these controllers; `.stimulus-lsp/config.json` temporarily suppresses
`stimulus.controller.invalid` for the affected identifiers. Remove those ignores
once an extension release detects them correctly.

Also patch [Stimulus LSP](https://github.com/marcoroth/stimulus-lsp) to exclude
Bootstrap's `data-bs-target` from Stimulus target validation; it currently
reports a nonexistent `bs` controller. Verify Bootstrap targets produce no
Stimulus diagnostics while real Stimulus target validation still works, then
remove the temporary `data-bs-target` entry from `ignoredAttributes` in the
same config.

### [MIGRATION-FOLLOWUP] Execution guidance

Follow [AGENTS.md](../../AGENTS.md) for behavior-preserving scope and [DEVELOPER_GUIDE.md](../../DEVELOPER_GUIDE.md) for verification. Unit tests cover state and command contracts; browser checks cover rendering, lifecycle, Bootstrap and Turbo behavior.

This review supplies priorities, not a migration acceptance plan or proof that outstanding defects are fixed. Concrete defects and their provenance remain in the preceding items and in [after-angular-removal.md](after-angular-removal.md).

Start with CI parity and documentation drift; pursue structural changes where they reduce an observed maintenance cost. A wholesale runtime rewrite, controller-wide refactor, forced importmap/esbuild consolidation or deletion of migration evidence is outside these recommendations.

Deliberately deferred or declined items live in [NOT-DOING.md](NOT-DOING.md).

## Someday

### [MIGRATION-FOLLOWUP] P3 I1 C2 — Evaluate modern screenshot comparison and review options

Consider replacing the screenshot viewer's custom per-channel comparison with
[Pixelmatch](https://github.com/mapbox/pixelmatch) (open source, ISC license),
evaluating perceptual thresholds, antialiasing filtering, configurable diff
colors, contextual diff backgrounds and optional masks. Evaluate
[Percy-style review controls](https://www.browserstack.com/docs/test-companion/visual-analysis):
stacked before/after overlay, adjustable tint strength and optional diagnostic
panels alongside the existing side-by-side, slider and actual-size views.

**Future evaluation only:** preserve original screenshots and capture history;
keep manifest region detection and viewer highlighting consistent. Compare
representative text, color, spacing and layout changes before choosing defaults,
so noise filtering does not conceal meaningful regressions. See
[Screenshot capture and diffing](../screenshot_review.md).

Revisit when rendering noise slows screenshot reviews or automated visual
regression coverage expands.

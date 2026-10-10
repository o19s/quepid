# Screenshot capture and diffing

This guide is authoritative for shared screenshot capture and comparison workflows.
For agent-specific browser permissions and recovery, follow
[AGENTS.md — UI changes](../AGENTS.md#ui-changes--screenshots-via-playwright-mcp-playwright-server).

## Comparison baselines

The initial parity comparison of a migrated core surface uses the pre-deangularization
AngularJS / Bootstrap 3 baseline against current code, including uncommitted changes.
Use the [isolated historical instance](legacy_comparison.md), confirm the surface
retains both AngularJS and Bootstrap 3, and compare equivalent fixtures. A recent
`main`, merge-base or pre-fix checkout does not establish migration parity. Later
focused regression checks may use a pre-fix baseline from `bin/ui_diff_up` (the permanent
diff-baseline instance on port 3003); record its baseline and coverage as a supplement to
the initial historical comparison.

- The historical instance's schema, runtime and seed data are independent; do not use `bin/ui_diff_db_sync` for historical comparisons.
- For the [isolated historical instance](legacy_comparison.md), keep both servers running; do not flip current sources or restore the shared development database.
- Capture **before** first, or keep existing **after** PNGs until matching befores exist — **never delete** the only half of a pair.
- **Manual-testing passes pair affected scenarios with the diff baseline.** For each scenario that `ruby bin/branch_ui_scenarios` lists (its tracked paths changed since the merge-base with `main`, committed or not), capture the same states on the diff baseline (`bin/ui_diff_up`, :3003) as `*-before.png` beside the current server's `*-after.png`, in one topic folder per pass. Unaffected scenarios need only the current-server shots. Finish with `yarn screenshots:view` and inspect every pair; its numbered boxes (`diff.regions` in `test/playwright/screenshot-manifest.json`) locate changes but don't replace looking. Explain each boxed difference in the tracker notes as intended, regression or state mismatch, and recapture mismatches. Migration-parity checks still use the historical instance instead.
- Exactly three permanent Quepid instances exist: current (`bin/docker s`, :3000), historical (`bin/legacy`, :3001) and the diff baseline (`bin/ui_diff_up <ref>`, :3003: one worktree `../quepid-ui-diff-worktree`, one container `quepid_app_ui_diff`, and its own database and job worker; `bin/ui_diff_db_sync` refreshes that database from the dev database). For nonhistorical comparisons, point the diff baseline at the old ref (see [Branch comparison workflow](#branch-comparison-workflow)) and leave it running. Never create task-named worktrees, containers or `/tmp` checkouts for a baseline. Keep the primary branch and server on current sources throughout; do not flip primary sources or override browser scripts to replay old code.
- Select replay sources against the requested baseline, including both staged and unstaged changes (for example, `git diff HEAD`); plain `git diff` can omit changed sources. For an uncommitted pre-fix baseline, run `bin/ui_diff_up HEAD`, then copy the relevant current sources into `../quepid-ui-diff-worktree`, reverse only the fix there and rebuild assets with `docker exec quepid_app_ui_diff yarn build`. A later `bin/ui_diff_up` to a different ref, or `--reset`, discards those edits. Leave the primary index untouched.
- Use the relevant Playwright screenshot spec and `MIGRATION_SHOT_PHASE=before|after`, Playwright MCP, or a few manual shots — **not** a Docker orchestration script.

## Branch comparison workflow

**Ordinary branch comparisons:** "before" is **`main`**, not some other point on this branch — both
`bin/branch_ui_scenarios` and `bin/ui_diff_up` default `BASE_REF` to `git merge-base HEAD main`
(never `HEAD~1` or an arbitrary earlier commit on the same branch). "After" is **the current
branch as it stands right now, including uncommitted changes** — that's just the live dev server
at `:3000`, which serves the working directory directly; `bin/docker s`'s `Procfile.dev` already
runs `yarn build:*:watch` processes, so uncommitted JS/CSS edits show up live with no rebuild step,
and Rails/ERB changes are read live too. Never narrow this to "last commit vs. uncommitted diff" —
the point is to show everything this branch changes relative to `main`, committed or not.
For an explicitly scoped regression recheck, load the requested pre-fix baseline
into the diff-baseline worktree instead (see [Comparison baselines](#comparison-baselines)); document its source, and
don't `--reset` or switch refs while someone else's uncommitted baseline is loaded.

The [branch comparison skill](../.agents/skills/branch-ui-diff/SKILL.md#steps)
orchestrates affected-scenario discovery, baseline startup, database synchronization
and replay using these conventions.

## Capture and verification

- **Before & after**: capture the affected flow before editing, then repeat the identical steps after. Capture every relevant state (modal open/closed, accordion expanded, error vs success, etc.). `browser_snapshot` is only for driving clicks; `browser_take_screenshot` is the proof.
- Wait for loading, numeric count animations and CSS transitions to finish before capturing a completed state; a success flash can appear before the screen settles. Use matching viewport dimensions for comparable states; full-page images with different heights remain visual evidence but cannot use pixel overlays or the slider.
- **Capturing a screenshot is not verifying it.** Before claiming two states match or differ, actually open and look at every before/after pair (Read tool or equivalent) — don't infer "identical" from the code diff not touching that template, and don't treat a console-log error as a substitute for looking at what the page actually rendered.
- **Frame big** (screenshots have come out too small): shoot the **full viewport**, not element crops.
    - Quepid modals scroll *internally*, so `fullPage:true` does NOT reach below their fold — instead `browser_resize` the viewport to roughly match the modal so it fills the frame, then screenshot the viewport.
    - Size to the content: a tall step (e.g. the wizard endpoint step) needs ~`820x2200`; a short step (e.g. wizard Finish) needs ~`900x760` — a tall viewport dwarfs a short modal. Narrower width = modal fills more of the frame.
- **Force hard-to-reach states** (e.g. a failed save) by intercepting the API with `browser_run_code_unsafe` + `page.route('**/api/...', ...)`.
    - Gotcha: `setTimeout` is undefined in that context — use `await page.waitForTimeout(ms)` for delays.
- **Save** under `.playwright-mcp/<topic>/` (gitignored) with clear `-before`/`-after` (+ state) names, e.g. `.playwright-mcp/share-case/migration-share-case-modal-after.png`. Topic folders keep this PR’s shots separate from older captures in the screenshot viewer (`yarn screenshots:view` / `node test/playwright/screenshot-viewer-server.mjs`).
  Use an absolute filename for `browser_take_screenshot` under that directory; relative filenames may resolve against the workspace instead of the configured MCP output directory.

If content legitimately differs because the scenario advanced state (e.g. "Continue Judging" landing on a different query/doc pair each run), say so explicitly rather than silently calling it a match. Only after inspecting the captures, report a before/after pairing per scenario/state (paths to the PNGs) with what you actually saw, and call out anything that looked wrong on either side, plus any scenario you skipped because it looked mutating or ambiguous.

Many boxes, or one covering most of the page, usually means mismatched data, scroll or session state. Account for every box as an intended change, regression, or state mismatch to recapture.

## Screenshot viewer

**Ad-hoc screenshot review** (Playwright MCP captures, migration proofs, etc.) land in `.playwright-mcp/` (gitignored). Topic folders and `*-before.png` / `*-after.png` pairs remain available in the viewer's Archive for explicit branch/migration comparisons. Routine captures use [Screen capture history](#screen-capture-history).

```bash
yarn screenshots:view
# if host Node engines block yarn: node test/playwright/screenshot-viewer-server.mjs
```

Opens `http://localhost:3456/test/playwright/screenshot-viewer.html` — the default view groups current screens by application area; Archive groups older captures by folder. Manifest generation diffs each pair's pixels (±8 per channel, `test/playwright/png-diff.mjs`) and records **changed regions**: padded boxes, in screenshot pixels, around each cluster of changes, under each pair's `diff.regions` in `test/playwright/screenshot-manifest.json`. The viewer draws the numbered boxes on both images in side-by-side, slider and actual-size views (click a screenshot for actual size), lists their coordinates, and adds a tinted overlay and diff map. Sidebar badges: `byte =` (identical files), `pixel =` (same image, different PNG encoding), `N boxes` (changed), `size ≠` (different dimensions). Boxes locate changes; they don't replace looking at both images. Diffs are cached in `.playwright-mcp/.diff-cache.json` by file size and mtime. Regenerate the manifest: `node test/playwright/generate-screenshot-manifest.mjs`. The server binds to `127.0.0.1` and serves only viewer assets and screenshot images. Override the port with `SCREENSHOT_VIEWER_PORT`; external sharing requires explicitly setting `SCREENSHOT_VIEWER_HOST`. For `dom_migration_screenshots.spec.ts`, set `MIGRATION_SHOT_PHASE=before|after` to pick the phase; group a run's shots by saving them into a topic subfolder as described above. (`share_case.spec.ts` also keeps ordinary checked-in `toHaveScreenshot()` baselines for the sharing surface.)

## Screen capture history

Each branch has one entry per stable scenario/state ID. The left image switches between Previous (the last recorded relevant source version) and Legacy (the historical Angular/Bootstrap 3 instance); Current stays on the right. A first capture has no Previous. Legacy remains fixed once recorded; explicitly mark screens absent only after checking the historical implementation. History links retain every recorded version. Existing folder captures lack source provenance and remain in Archive; do not infer their code versions from timestamps.

The viewer defaults to Previous. An empty Previous does not mean Legacy is missing: select the Legacy tab and check `screenshots:status` before reporting a gap. Keep supplemental Base comparisons in Archive; they do not become Previous or Legacy. If an explicitly authorized supplemental historical ref supplies additional coverage, give it separate state IDs and record its ref without replacing the primary Legacy evidence or absence record.

Link each captured state in its scenario's `tracking.yml` entry before recording:

```yaml
screenshots:
  login-form: "1.2/login-form"
```

The recorder resolves `--scenario` / `--state` through this mapping. IDs remain stable;
image filenames and source versions belong only in the local history registry, not
in the tracker. Before capturing, run inside the existing server container:

```bash
docker compose exec app yarn screenshots:record --scenario 1.2 --state login-form --check
```

When `needsCapture` is true, drive that state on the current server with Playwright MCP, inspect the screenshot, then record it using the `source` returned by the check:

```bash
docker compose exec app yarn screenshots:record --scenario 1.2 --state login-form --image .playwright-mcp/accounts/login-form.png --source <fingerprint>
```

The recorder hashes scenario `paths`, including staged, unstaged and untracked source content; file timestamps and unrelated commits do not advance history. Add `--path` for shared layouts, styles, runtime or other dependencies missing from the scenario's mapping. Previously recorded dependencies are retained when checking or recording a linked state. For a screen outside the manual tracker, provide `--id`, `--title`, `--area` and repeated `--path` values instead. Keep state IDs, viewport, fixture data, scroll and interaction steps stable; use a separate ID for a different state. This mapping is a dependency heuristic, not proof that every possible source dependency is covered.

For delayed registration, pass `--captured-at <UTC timestamp>` and, when attaching Legacy, `--legacy-captured-at <UTC timestamp>`. These preserve capture times; they do not establish the image’s source version. Reuse older-version evidence through its existing history entry rather than registering it as current code.

Share an ID across scenarios only when their state and source dependencies agree. Otherwise use separate IDs. When reusing an existing image, retain its actual capture time, source provenance and originating history entry; registration time is not capture time. Never invent Previous history to fill an empty comparison.

Use `yarn screenshots:status` (or `node test/playwright/screenshot-status.mjs`) to resolve linked screenshots to their Current, Previous and Legacy file locations. `--scenario 1.2` scopes the report, `--due-only` lists missing/stale Current captures, and `--json` provides machine-readable results. Freshness uses source content independently of `last_run`: retesting without a code change does not replace images. Missing or corrupt local files are reported even if source is unchanged; integrity is checked against the recorded filename hash. Restore the original bytes without advancing history. The recorder can restore Current; restore Previous and Legacy files at their recorded paths. A first capture's Previous is `not_recorded`; Legacy distinguishes `not_recorded`, `missing`, `corrupt` and explicitly `absent`. The manifest includes these resolutions under `screenshots` and uses the current tracker dependencies to flag stale captures.

Unchanged source leaves stored images untouched. Changed source appends a version and makes the preceding Current the new Previous; the recorder rejects source changes between preparation and recording. The viewer labels unrecaptured source changes `capture due`. It never captures automatically. Add `--legacy-image <file> --legacy-ref <commit>` after driving the same state on the historical instance, or `--legacy-absent --legacy-ref <commit>` after confirming it did not exist. Legacy can also be attached to an existing current capture without advancing its history. Never record the current server's image as Legacy or promote a baseline-server capture as Current.

Regenerate the manifest after recording and refresh the viewer. Histories live under `.playwright-mcp/.screen-history/`, so they survive commits but are local to this checkout; a renamed branch starts a separate history. Focused tooling checks: `docker compose exec app node --test test/playwright/screen-history.test.mjs`.

## Completing a screenshot batch

Keep a fixture ledger with the server/database, IDs and identifying attributes of records created for the batch. Reuse those fixtures and running servers throughout; do not synchronize databases after their fixture states have diverged for the replay.

Before declaring the requested batch complete:

- Reconcile every captured image, including intermediate and earlier captures in the session, with a stable history entry or an explicit Archive entry. Open and inspect all distinct images; byte-identical copies may share an inspection. Record unrecoverable overwritten captures and remaining gaps explicitly. Loading, error and mismatched-state captures must not stand in for completed-state evidence.
- Run unscoped `screenshots:status`, regenerate the manifest and check the viewer's Current, Previous and Legacy resolutions. Resolve unexpected missing/stale images and record supported absence separately from coverage that remains unrecorded. Update tracker links and actual coverage as each scenario finishes, following the [manual testing tracker](../DEVELOPER_GUIDE.md#manual-testing-tracker).
- Remove only fixtures identified by the ledger. Check ownership and dependencies before deleting, remove dependent fixture records in a safe order, and verify both fixture removal and preservation of unrelated records. Restore temporary configuration exactly; leave the app servers running.

Report incomplete coverage and concrete blockers without claiming a full pass. Retain the image audit and cleanup evidence with the local capture artifacts so the next session can reconcile the batch.


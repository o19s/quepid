---
name: branch-ui-diff
description: >-
  Screenshots the UI before/after a branch's changes, without touching the
  working tree. Finds which manual-testing scenarios are affected by the
  branch's diff, points the permanent diff-baseline instance (:3003, one git
  worktree, its own copy of the dev database, sharing the live dev server's
  keycloak/ollama) at the old ref, then
  uses Playwright MCP (headed) to capture each affected scenario against the
  old instance ("before") and the current dev server ("after"). Use when
  asked for visual before/after proof of a branch's changes, or to sanity-check
  a PR's UI impact before opening it. Also use for comparison galleries of
  proposed UI changes.
---

# Branch UI diff (before/after screenshots)

Follow [AGENTS.md — Before/after pairs](../../../AGENTS.md#beforeafter-pairs--do-not-break-the-working-tree)
for baseline selection: initial migration comparisons require the historical
AngularJS / Bootstrap 3 baseline; a pre-fix baseline in the diff-baseline instance is for focused regression rechecks.
For historical comparisons, use
[the isolated historical instance](../../../docs/legacy_comparison.md) instead
of this workflow. Its schema, runtime and seed data are independent; do not use
`bin/ui_diff_db_sync` for historical comparisons.

Proves what a branch actually changed on screen, by running **two Quepid instances at once**
on the **same data** — the branch's base ref on one port, the current code on another — instead of the older approach of
flipping files in place and rebuilding (fragile, and __not__ how this skill works: see
`bin/ui_diff_up`/`bin/ui_diff_down` and `bin/branch_ui_scenarios`).

**Ordinary branch comparisons:** "before" is **`main`**, not some other point on this branch — both
`bin/branch_ui_scenarios` and `bin/ui_diff_up` default `BASE_REF` to `git merge-base HEAD main`
(never `HEAD~1` or an arbitrary earlier commit on the same branch). "After" is **the current
branch as it stands right now, including uncommitted changes** — that's just the live dev server
at `:3000`, which serves the working directory directly; `bin/docker s`'s `Procfile.dev` already
runs `yarn build:*:watch` processes, so uncommitted JS/CSS edits show up live with no rebuild step,
and Rails/ERB changes are read live too. Never narrow this to "last commit vs. uncommitted diff" —
the point is to show everything this branch changes relative to `main`, committed or not.
For an explicitly scoped regression recheck, load the requested pre-fix baseline
into the diff-baseline worktree instead (see AGENTS.md); document its source, and
don't `--reset` or switch refs while someone else's uncommitted baseline is loaded.

**Data:** the old instance has its own database, `quepid_ui_diff_development` for MySQL/PostgreSQL
or `tmp/ui_diff/storage/development.sqlite3` for SQLite, a copy of the dev
database made by `bin/ui_diff_db_sync` (bin/ui_diff_up makes the first copy), with an empty job
queue and its own Solid Queue worker. Writes on :3003 never reach the dev database, and the old
code runs its own background jobs. Both instances share the database service, Keycloak and Ollama.
The copy keeps the dev database's schema: if the branch adds migrations, the old code runs against
the newer schema; that's accepted risk, not a bug — flag it in the summary if a page errors, don't
try to work around it by re-migrating. Uploaded files (Active Storage) live in each checkout, so
the copy's attachments may be missing on :3003.

**Concurrency guardrail:** `bin/ui_diff_db_sync` replaces the *entire* copy, including anything
someone set up on :3003, and restarts the container. Before syncing, check `ListAgents` for other
active sessions on this machine; if one might be using the baseline, ask first.

**The Playwright MCP browser is a single shared instance, not one per agent.** If you delegate
scenario batches to multiple subagents, running them **in parallel makes them hijack each other's
navigation**. Always run Playwright-driving batches **sequentially** — launch one, wait for it to
finish, launch the next. Only non-Playwright work (e.g. reading tracking.yml, editing docs)
is safe to parallelize.

## Comparison galleries

For a requested gallery, read [Comparison gallery workflow](references/comparison-gallery.md).
It covers proposed alternatives as well as branch changes, isolated variants,
matching highlight boxes, and an interactive, portable review artifact.
For proposals without an existing diff, use its candidate/state mapping instead
of the branch-diff scenario discovery below.

## Steps

1. **Confirm the dev server is up.** This skill never stops it. If
   `http://localhost:3000` isn't responding, run `bin/docker s` first.

2. **Find affected scenarios.**
   ```
   ruby bin/branch_ui_scenarios [--base REF] --json
   ```
   Default base is the merge-base with `main`. Read the `scenarios` array: each entry has
   `id`, `title`, `file` (the `docs/manual-testing/<file>` doc), and `matched_paths`. If empty,
   report that no tracked manual-testing scenario matches this diff and stop — ask the user
   whether to add `paths` coverage for what changed, or name a scenario/page manually.

3. **Filter out what's already been verified against this same base, before asking the user to
   scope anything.** `bin/branch_ui_scenarios` does pure path-matching against the diff — it does
   NOT know whether a scenario was already screenshot-compared old-vs-new. That history lives in
   `docs/manual-testing/tracking.yml`. For each matched scenario, check its `last_run`/`notes`.

   **Compare each path's file mtime against `last_run`** — `last_run` already exists in `tracking.yml`:
   ```
   ls -la <path>                                    # for a file
   find <path> -type f -newermt "<last_run value>"   # for a directory-style path — ls -la on a
                                                      # directory only reflects entries added/
                                                      # removed directly inside it, NOT edits to
                                                      # existing files within it or its
                                                      # subdirectories, so it silently misses
                                                      # real changes. -newermt takes the ISO
                                                      # timestamp directly, no reference file
                                                      # needed; prints any file changed after it.
   ```
   `last_run` is a full UTC timestamp (`YYYY-MM-DDTHH:MM:SSZ`) for
   any scenario recorded after this rule existed — compare at that precision, not just by date, so
   two events on the same calendar day (e.g. this morning's sweep vs. an edit made this afternoon)
   compare correctly. Older bare-date entries (`YYYY-MM-DD`, no time — from before this rule) only
   support date-level precision; `bin/manual_test_status` treats those as the *end* of that UTC day
   (see its header comment), so do the same by hand here. If every path is covered as of its `last_run` timestamp,
   and its `notes` say something like "branch-ui-diff sweep" / "re-verified against main" (i.e. an
   explicit old-vs-new comparison already happened) **for this same base ref**, treat it as already
   covered — do not re-run it. If any path's mtime is newer, it's a genuine gap, re-run it.

   A git-ref/commit-date comparison (what `bin/manual_test_status`'s "code changed since last_run"
   check does) is exact but only works for *committed* history — it can't see anything about
   uncommitted work. mtime can occasionally misfire in the other direction (a
   `git checkout`/`stash`/rebase can bump many files' mtimes without changing their content) — that
   just costs an unnecessary rerun of one scenario, which is a fine tradeoff for staying simple.

   - `bin/manual_test_status` uses modification times for dirty files. For clean files, both
     modification and commit times must be newer than `last_run` to flag a code change.
     Committing the same files tested after their last edit therefore keeps verification current.
     See `DEVELOPER_GUIDE.md` § Manual testing tracker for limitations; preserve actual test times.
   - A scenario whose last verification predates the sweep (an older `last_run` with no
     branch-ui-diff-style note) has NOT had an old-vs-new comparison yet — it's a genuine gap.
   Report the split to the user: e.g. "88 scenarios matched; 42 already have an explicit
   before/after comparison on record from `<date>`; 46 don't." This is cheap (one YAML read plus
   an `ls -la` per path) and skips potentially hours of redundant Playwright work.

4. **Scope the run.** Of what's left after filtering, this can still match many scenarios. Don't
   silently run all of them — tell the user how many are genuinely uncovered and, unless they said
   "all", ask which ones to actually shoot (or pick the ones most central to the stated task).

5. **Bring up the old-code instance:**
   ```
   ./bin/ui_diff_up [BASE_REF] [PORT]     # PORT defaults to 3003 (3001 is bin/legacy's)
   ```
   The diff baseline is one of three permanent instances (current :3000, `bin/legacy` :3001, this
   one :3003). The command is idempotent: if `quepid_app_ui_diff` is already serving that ref it
   returns at once. Otherwise it checks the single sibling worktree (`../quepid-ui-diff-worktree`)
   out at the base ref, recreates that one container (detached, `restart: unless-stopped`, joined
   to the same `mysql`/`keycloak`/`ollama` containers as the primary stack, using its own database
   and job worker; the first run copies the dev database), and runs
   `yarn build` **only if the ref changed**. When it switches refs it prints the ref it replaced;
   if another session may be using the baseline, check before switching. It blocks (up to ~6 min
   on a cold build) until `http://localhost:<PORT>` responds, or prints `docker logs` and exits
   non-zero — read that log if it fails, don't just retry blindly. `--reset` discards local edits
   in the worktree (e.g. a pre-fix baseline) and rebuilds. Never create another worktree or
   container for a baseline.

6. **For each in-scope scenario**, open its doc section (`docs/manual-testing/<file>`, heading
   `### <id> <title>`) and read its **Steps** — drive only the golden path, not every edge case,
   unless the user asked for edge cases too. For each meaningfully different state in those steps
   (page loaded, modal open, success/error state, etc.):
   - Navigate the **old** instance (`http://localhost:<PORT>`) with Playwright MCP (headed),
     `browser_take_screenshot` each state, save under
     `.playwright-mcp/branch-ui-diff/<scenario-id>-<state>-before.png`.
   - Repeat the identical steps against the **current** dev server (`http://localhost:3000`),
     saving `...-after.png`.
   - Follow the existing screenshot conventions in `CLAUDE.md` (`browser_resize` to fit modals,
     full viewport shots, not element crops).
   - Log in with `quepid+realisticactivity@o19s.com` / `password` on both instances — they're
     separate sessions, so both need their own login.

6b. **Mutating scenarios** (steps that create/delete/archive/clone/import/rename/share-unshare
   anything) need no bracketing on the old side: its writes stay in the copy. The "after" pass
   writes to the dev database like any manual testing. Both sides must start from the same data,
   though: if an earlier pass changed either database in a way the scenario can see (a case
   created on one side only, a renamed fixture), run `bin/ui_diff_db_sync` first so the copy
   matches the dev database again. Record when the copy was made if the data matters.

7. **Leave it running.** The baseline is permanent; don't stop it after a comparison. Only on
   request:
   ```
   ./bin/ui_diff_down            # stops the container, leaves the worktree
   ./bin/ui_diff_down --remove-worktree   # also deletes the worktree entirely
   ```

8. **Actually look at every pair before reporting anything.** Run `yarn screenshots:view` (or
   `node test/playwright/screenshot-viewer-server.mjs`) to regenerate the manifest; each changed
   pair's `diff.regions` in `test/playwright/screenshot-manifest.json` lists numbered boxes, in
   screenshot pixels, around every cluster of changed pixels, and the viewer draws them on both
   images. Use them to find what to look at, and account for every box: intended change,
   regression, or a state mismatch to recapture. Many boxes, or one covering most of the page,
   usually means mismatched data, scroll or session state. Capturing a screenshot is not the
   same as verifying it. For each scenario/state, open both the `-before.png` and `-after.png`
   with the Read tool (or equivalent) and look at them — don't infer "identical" or "no visual
   diff" from the fact that the underlying template/controller wasn't in the diff, and don't rely
   on console-log text alone (e.g. an API error logged to console still needs the screenshot
   opened to confirm what the *page* actually showed). If content legitimately differs because the
   scenario advanced state (e.g. "Continue Judging" landing on a different query/doc pair each
   run), say so explicitly rather than silently calling it a match. Only after this pass, report a
   before/after pairing per scenario/state (paths to the PNGs) with what you actually saw, and call
   out anything that looked wrong on either side, plus any scenario you skipped because it looked
   mutating or ambiguous.

## When *not* to use this

- Pure backend/API changes with no template/JS/CSS diff — `bin/branch_ui_scenarios` will
  correctly report no matches; don't force screenshots.
- Another session is actively using the baseline right now (see the concurrency guardrail
  above) — coordinate or wait rather than switching its ref or syncing its database under them.

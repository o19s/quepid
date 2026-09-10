---
name: branch-ui-diff
description: >-
  Screenshots the UI before/after a branch's changes, without touching the
  working tree. Finds which manual-testing scenarios are affected by the
  branch's diff, spins up a throwaway old-code instance in a git worktree on
  its own port (sharing the live dev server's mysql/keycloak/ollama), then
  uses Playwright MCP (headed) to capture each affected scenario against the
  old instance ("before") and the current dev server ("after"). Use when
  asked for visual before/after proof of a branch's changes, or to sanity-check
  a PR's UI impact before opening it.
---

# Branch UI diff (before/after screenshots)

Proves what a branch actually changed on screen, by running **two Quepid instances at once**
against the **same backend** (mysql/keycloak/ollama from the live `bin/docker s` stack) — the
branch's base ref on one port, the current code on another — instead of the older approach of
flipping files in place and rebuilding (fragile, and __not__ how this skill works: see
`bin/ui_diff_up`/`bin/ui_diff_down` and `bin/branch_ui_scenarios`).

**What gets compared:** "before" is **`main`**, not some other point on this branch — both
`bin/branch_ui_scenarios` and `bin/ui_diff_up` default `BASE_REF` to `git merge-base HEAD main`
(never `HEAD~1` or an arbitrary earlier commit on the same branch). "After" is **the current
branch as it stands right now, including uncommitted changes** — that's just the live dev server
at `:3000`, which serves the working directory directly; `bin/docker s`'s `Procfile.dev` already
runs `yarn build:*:watch` processes, so uncommitted JS/CSS edits show up live with no rebuild step,
and Rails/ERB changes are read live too. Never narrow this to "last commit vs. uncommitted diff" —
the point is to show everything this branch changes relative to `main`, committed or not.

**Known, accepted tradeoff:** both instances share one MySQL database. Fine for read-only
navigation. If a scenario's steps *mutate* data (create/delete/archive/clone/share/import/...),
snapshot and restore around it — see step 6b — rather than letting the mutation bleed into the
other pass. If the branch changes migrations, the base-ref (old) instance runs against an
already-migrated-to-head schema; that's accepted risk, not a bug — flag it in the summary if a
page errors, don't try to work around it by re-migrating.

**Concurrency guardrail:** `bin/ui_diff_db_restore` overwrites the *entire* shared dev database
back to a snapshot — including anything anyone else did in the meantime. Before taking a snapshot
or restoring, check `ListAgents` for other active sessions on this machine; if one might be
exercising the same dev stack (e.g. running its own manual-testing pass), ask before proceeding —
don't silently blow away someone else's in-progress work. This happened once already: coordinate.

**The Playwright MCP browser is a single shared instance, not one per agent.** If you delegate
scenario batches to multiple subagents, running them **in parallel makes them hijack each other's
navigation** — screenshots land on the wrong page, mid-flow state gets clobbered, and it can look
exactly like an unrelated concurrent session (it isn't: check `ps` for a single `playwright-mcp`
process before assuming a stranger is involved). This happened once already: always run
Playwright-driving batches **sequentially** — launch one, wait for it to finish, launch the next.
Only non-Playwright work (e.g. reading tracking.yml, editing docs) is safe to parallelize.

## Steps

1. **Confirm the dev server is up.** This skill never stops it (per `CLAUDE.md`). If
   `http://localhost:3000` isn't responding, tell the user to run `bin/docker s` first.

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

   **Compare each path's file mtime against `last_run`** — simplest option, no new bookkeeping
   needed since `last_run` already exists in `tracking.yml`:
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
   `last_run` is a full UTC timestamp (`YYYY-MM-DDTHH:MM:SSZ`, per `tracking.yml`'s header) for
   any scenario recorded after this rule existed — compare at that precision, not just by date, so
   two events on the same calendar day (e.g. this morning's sweep vs. an edit made this afternoon)
   compare correctly. Older bare-date entries (`YYYY-MM-DD`, no time — from before this rule) only
   support date-level precision; `bin/manual_test_status` treats those as the *end* of that UTC day
   (see its header comment), so do the same by hand here: a same-day mtime on a bare-date entry
   still counts as covered, don't flag it. If every path is covered as of its `last_run` timestamp,
   and its `notes` say something like "branch-ui-diff sweep" / "re-verified against main" (i.e. an
   explicit old-vs-new comparison already happened) **for this same base ref**, treat it as already
   covered — do not re-run it. If any path's mtime is newer, it's a genuine gap, re-run it.

   A git-ref/commit-date comparison (what `bin/manual_test_status`'s "code changed since last_run"
   check does) is exact but only works for *committed* history — it can't see anything about
   uncommitted work, which is exactly the state this whole branch was in during the 2026-09-08/09
   sweep, so it wasn't an option here. mtime can occasionally misfire in the other direction (a
   `git checkout`/`stash`/rebase can bump many files' mtimes without changing their content) — that
   just costs an unnecessary rerun of one scenario, which is a fine tradeoff for staying simple.
   What mtime should NOT be trusted for is the opposite direction (assuming unchanged when it's
   actually stale) — a real edit reliably bumps mtime, so this is rarely a problem in practice.

   - `bin/manual_test_status` will still list such a scenario as "DUE" if its paths are currently
     *uncommitted* — that flag means "not yet committed," not "not yet verified." Don't confuse
     the two: read the actual `notes`/`last_run`, don't just trust the DUE list to mean unverified.
   - A scenario whose last verification predates the sweep (an older `last_run` with no
     branch-ui-diff-style note) has NOT had an old-vs-new comparison yet — it's a genuine gap.
   Report the split to the user: e.g. "88 scenarios matched; 42 already have an explicit
   before/after comparison on record from `<date>`; 46 don't." This is cheap (one YAML read plus
   an `ls -la` per path) and skips potentially hours of redundant Playwright/DB-snapshot work. This
   happened once already — a full re-run duplicated a sweep from the day before that was sitting
   uncommitted in `tracking.yml` the whole time.

4. **Scope the run.** Of what's left after filtering, this can still match many scenarios. Don't
   silently run all of them — tell the user how many are genuinely uncovered and, unless they said
   "all", ask which ones to actually shoot (or pick the ones most central to the stated task).

5. **Bring up the old-code instance:**
   ```
   ./bin/ui_diff_up [BASE_REF] [PORT]     # PORT defaults to 3001
   ```
   This creates/reuses a sibling git worktree (`../quepid-ui-diff-worktree`) at the base ref,
   installs deps and runs `yarn build` in it **only if the base ref changed since last time**,
   and starts a second `app` container joined to the same `mysql`/`keycloak`/`ollama` containers
   as the primary stack. It blocks (up to ~6 min on a cold build) until `http://localhost:<PORT>`
   responds, or prints the server log and exits non-zero on failure — read that log if it fails,
   don't just retry blindly.

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
     separate sessions against the same DB, so both need their own login.

6b. **Mutating scenarios** (steps that create/delete/archive/clone/import/rename/share-unshare
   anything, not just view/filter it): bracket **each side's pass** in a snapshot/restore so the
   two runs never see each other's writes and the DB ends up clean:
   ```
   ./bin/ui_diff_db_snapshot          # dump quepid_development
   #  ... drive the old instance (before), screenshot ...
   ./bin/ui_diff_db_restore           # undo whatever that pass just did
   #  ... drive the current dev server (after), screenshot ...
   ./bin/ui_diff_db_restore           # undo that pass too, leave the DB as found
   ```
   Only one snapshot slot exists (`tmp/ui_diff/db_snapshot.sql`) — don't interleave a second
   mutating scenario's snapshot/restore inside this bracket. Read-only scenarios don't need this;
   only bracket the ones that actually write.

7. **Tear down** when done:
   ```
   ./bin/ui_diff_down            # stops the old container, leaves the worktree for next time
   ./bin/ui_diff_down --remove-worktree   # also deletes the worktree entirely
   ```
   Default to leaving the worktree (fast re-run next time) unless the user asks for full cleanup.

8. **Actually look at every pair before reporting anything.** Capturing a screenshot is not the
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
- Another session is actively using the same dev stack right now (see the concurrency guardrail
  above) — coordinate or wait rather than snapshotting/restoring out from under them.

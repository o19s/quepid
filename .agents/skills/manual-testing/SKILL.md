---
name: manual-testing
description: >-
  Runs and records Quepid's manual testing scenarios (docs/manual-testing/).
  Finds due scenarios with bin/manual_test_status, proposes a representative
  sample, drives scenarios end-to-end (Playwright MCP or by hand), compares
  divergent behavior against pre-deangularization main, and updates
  tracking.yml with the coverage actually verified. Use when asked for a
  manual testing pass, when bin/manual_test_status reports due or age-expired
  scenarios, or when browser-verifying a change against its scenarios.
---

# Manual testing tracker

The always-on triggers (when to run `bin/manual_test_status`, age-expired scenarios, feature parity) live in [AGENTS.md — Manual testing tracker](../../../AGENTS.md#manual-testing-tracker-docsmanual-testing). This skill holds the procedure.

## Files

- `docs/manual-testing/*.md` is the human-readable manual test script. - `docs/manual-testing/tracking.yml` tracks, per numbered scenario, when it was last actually driven end-to-end (via Playwright MCP or by hand), the result, and which source `paths` that scenario exercises.
- See [the manual testing guide](../../../docs/manual-testing/README.md) for scenarios and coverage recording, and `tracking.yml`'s own header for field rules.

## Finding what's due

- Run `bin/manual_test_status` (plain `ruby`, no Docker/Rails boot needed). Use `--due-only` to filter, `--part 07` to scope to one part, `--paths-for 3.2` to see what a scenario tracks.
- Follow the timestamp rules in [DEVELOPER_GUIDE.md — Manual testing tracker](../../../DEVELOPER_GUIDE.md#manual-testing-tracker). Preserve actual verification timestamps.

## Sampling

- Proactively offer a representative sample batch when browser verification spans many flows or would slow incremental development. Name the proposed sample and deferred coverage. Once sampling is authorized, carry out that batch without asking again on every commit; follow the sampling policy in DEVELOPER_GUIDE.md. Do not make a full Playwright sweep the default gate for each commit.

## When behavior differs from a scenario

- When observed behavior differs from a manual scenario's expectation, compare it with the same surface on pre-deangularization `main` before classifying it or proposing a fix. Go back far enough to recover the Angular implementation (months if needed), record the baseline commit and source evidence, and distinguish migration regressions, pre-existing defects, and unsupported test expectations. Historical source inspection is not a live historical replay; state that limit explicitly.
- For a live replay, use the [historical comparison instance](../../../docs/legacy_comparison.md) (`bin/legacy up`, :3001) rather than flipping the dev server's sources.

## Driving scenarios

- Drive the mutating path, not just the open modal, on a disposable case or clone. Open-modal-only coverage is acceptable only when the mutating path is blocked; say so in `notes`.

## Recording results

- After running a scenario (pass or fail), update its entry in `tracking.yml`: `last_run` (today, UTC), `result` (`pass` / `pass_with_fixes` / `fail` / `blocked`), and `notes` on what was actually covered and what wasn't (partial coverage is normal — say so rather than implying the whole scenario was exhaustively verified; `tracking.yml`'s own header has the length guidance — brief for a clean pass, as long as it takes to be useful when the pass found and fixed something). Only set `last_run` for scenarios you actually exercised; leave others alone (`null` is honest and useful).
- Update the tracker before moving to another scenario. During a long scenario, record verified checkpoints as you go, explicitly label the coverage as partial/in progress and name pending checks; do not leave an older result in place until the whole sweep finishes. The result describes only the recorded coverage. Replace the checkpoint notes with the final coverage and outcome when finished.
- If a scenario's source moves or a new one is added, update `paths`/add an entry — the tracker is only as useful as its path mappings.

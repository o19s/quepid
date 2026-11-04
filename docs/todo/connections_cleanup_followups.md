# Connections branch: cleanup noticed, not fixed

**Last updated:** 2026-11-04

Found while running `/simplify` against `feature/connections` (PR #1859) and its follow-up
commits. Each was judged too broad, too low-value, or too risky to fix inline as part of that
review; recorded here so the duplication doesn't just get re-discovered and re-litigated next
time someone touches these files. When something is fixed, remove its entry — do not add a
completed section or keep resolved items for history.

Ratings appear as `P2 I3 C1` beside each item, same scale as [todo.md](todo.md):

| Rating | 0 | 1 | 2 | 3 |
| --- | --- | --- | --- | --- |
| **P — Priority** (lower is more urgent) | Critical | High | Normal | Opportunistic |
| **I — Simplification impact** (higher is more benefit) | Little or no code reduction | Local simplification | Removes duplication or complexity across several paths | Substantial reduction in wrappers, code, or maintenance burden |
| **C — Complexity / risk** (lower is easier and safer) | Trivial, isolated edit | Small change with limited regression risk | Several interacting paths or meaningful behavioral risk | Broad change, sensitive data/security contracts, or unresolved design decisions |

### P2 I2 C2 — `apply_team_ids` is the same method, copy-pasted three times

`EmbeddersController#apply_team_ids`, `AiJudgesController#apply_team_ids` and
`ConnectionsController#apply_team_ids` all do the identical "only touch teams the submitting user
belongs to" dance (kept vs. selected, filtered by the user's own `current_user.teams`), each with
a comment pointing at one of the others ("Same rule as X#apply_team_ids") acknowledging the
duplication rather than fixing it. No shared concern exists for any of the three.
`ConnectionsController` layers a communal-connection early-return (clear teams outright) on top
of the same base logic.

Fix: extract a small controller concern (e.g. `TeamAssignable`) providing
`apply_team_ids(record, team_ids)` against `current_user`, included by all three controllers.
`ConnectionsController`'s communal early-return can stay a one-line override.

### P3 I1 C2 — `check(event)` Stimulus actions share a boilerplate skeleton

`connection_form_controller.js#check` and `embedder_form_controller.js#check` both: build
`FormData`, strip `_method`, call `setButtonLoading(true)`, clear `checkResultTarget`, `apiFetch`
POST, parse JSON, throw on `!response.ok`, render success/error into `checkResultTarget`,
`finally` reset the button. Only the success-rendering body differs (a status-colored alert vs. a
vector/dimensions preview), so the shared scaffolding — not the whole method — is a real
~15-line duplication per controller.

Fix: a shared `runCheck(checkUrl, formData, { checkResultTarget, checkButtonTarget, onSuccess })`
helper (alongside the already-extracted `app/javascript/utils/button_loading.js`), taking only
the result-rendering as a callback. Skipped during the `/simplify` pass because the
result-rendering genuinely differs and a shared-skeleton refactor on a live "Check connection"
feature deserves its own look, not a drive-by.

### P3 I1 C1 — the service/provider help-panel toggle is duplicated

`connection_form_controller.js#refresh` and `embedder_form_controller.js#refresh` both run the
identical "show only the help panel whose dataset key matches the selected value" loop, differing
only in the dataset key (`service` vs. `provider`). Trivial on its own; only worth doing if the
`check()` extraction above happens anyway and this rides along as a second tiny export from the
same utils file.

### P3 I1 C1 — `Connection`'s two "deferred parse error on a synthetic text field" ivars

`retry_statuses_text=` and `extra_headers_text=` both: clear a dedicated `@..._error` ivar, parse
user-typed text, stash a message in that ivar on failure, and surface it later from a `validate`
callback. Two parallel one-off ivars for the same shape. Only worth collapsing into something
like a shared `@text_attribute_errors` hash if a third synthetic text field shows up later —
right now it would trade two clearly-named ivars for a small registry, which isn't obviously
simpler for just two cases.

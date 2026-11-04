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

### P3 I1 C1 — the service/provider help-panel toggle is duplicated

`connection_form_controller.js#refresh` and `embedder_form_controller.js#refresh` both run the
identical "show only the help panel whose dataset key matches the selected value" loop, differing
only in the dataset key (`service` vs. `provider`). Trivial on its own, and now that
`check()`'s shared scaffolding moved into `app/javascript/utils/run_check.js` and
`app/javascript/utils/dom.js`, this could ride along as a second tiny export from the same utils
file.

### P3 I1 C1 — `Connection`'s two "deferred parse error on a synthetic text field" ivars

`retry_statuses_text=` and `extra_headers_text=` both: clear a dedicated `@..._error` ivar, parse
user-typed text, stash a message in that ivar on failure, and surface it later from a `validate`
callback. Two parallel one-off ivars for the same shape. Only worth collapsing into something
like a shared `@text_attribute_errors` hash if a third synthetic text field shows up later —
right now it would trade two clearly-named ivars for a small registry, which isn't obviously
simpler for just two cases.

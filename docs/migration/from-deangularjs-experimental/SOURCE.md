# Provenance

This directory is a snapshot of **`docs/port`** from the Git branch **`deangularjs-experimental`** (`origin`), copied under `docs/migration/` so porting notes sit with the rest of the migration documentation.

| | |
|---|---|
| **Imported from** | `origin/deangularjs-experimental`:`docs/port` |
| **Branch tip (at import)** | `ab7ea23d7fda41b26b5eee1e43484aa5e1a9d24e` |
| **Import date** | 2026-03-19 |

Note: the branch uses the singular path **`docs/port`**; there is no **`docs/ports`** on that branch.

To refresh from the latest experimental branch after `git fetch origin deangularjs-experimental`:

```bash
git archive origin/deangularjs-experimental docs/port \
  | tar -x --strip-components=2 -C docs/migration/from-deangularjs-experimental
```

Update this file after a refresh (new SHA, date). Resolve conflicts with any intentional local edits in this tree.

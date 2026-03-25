# Remaining Work: Post-Angular Cleanup

Angular has been fully removed. The Stimulus-based UI is the sole case workspace
served at `/case/:id`. What remains is minor polish.

---

## 1. Known Functional Gaps (minor)

| Gap | Severity | Notes |
|-----|----------|-------|
| Share case modal on action bar | Low | The link exists in `_action_bar.html.erb` but isn't wired to `share-case` controller. Already works on the `/cases` page. |
| Solr "render template" tab in explain modal | Low | Edge case for Solr template queries; needs `searcher.renderTemplate()` equivalent. |

---

## 2. CSS / Visual Polish

- **BS3→BS5 visual pass**: `query_workspace.css` carries BS3 compatibility aliases
  (`pull-left`, `list-inline`, `btn-default`, etc.) for Rails partials that still use
  BS3 class names. Audit and migrate partials to BS5 classes, then remove the aliases.

---

## 3. Cleanup

| Item | Notes |
|------|-------|
| Remove debug `console.log()` statements | Present in `import_case_controller`, `import_snapshot_controller`, `prompt_form_controller`, `mapper_wizard_controller`, `user_activity_controller`, `share_case_controller`, `share_search_endpoint_controller`. |
| `bulk_judgement_controller.js` — use `apiUrl()` | Fetch calls use bare relative paths (`books/${id}/judge/bulk/...`) instead of the `apiUrl()` wrapper. |
| Visual parity test tooling | `capture_screenshots.mjs` still has "new-ui" variant infrastructure that was used for Angular/Stimulus comparison. Now that there's only one UI, simplify the variant logic. |
| Migration docs | Comments in controllers referencing "Angular parity" can be cleaned up over time. The `docs/migration/` directory can be archived once the project is stable. |

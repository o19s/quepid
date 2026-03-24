# Remaining Work: Angular Elimination Roadmap

The new Stimulus-based UI (`/case/:id/new_ui`) has **feature parity for Phases 0–9** — that's the hard part done. What remains falls into three buckets.

---

## 2. Phase 2 Leftovers — Two items

| Item | What's needed |
|------|---------------|
| **East pane (`paneSvc`)** | A `resizable_pane_controller.js` already exists and works, but it currently bridges to Angular via jQuery `.trigger('toggleEast')`. Once Angular is removed, strip the jQuery bridge and rely solely on Stimulus actions/events. `paneSvc` itself (70 lines, 1 consumer in `mainCtrl`) can be deleted. |
| **`broadcastSvc`** | Already fully replaced in Stimulus with native `CustomEvent` dispatches (`query-options-saved`, `query-moved-away`, `show-query-explain`, etc.). The Angular-side `broadcastSvc` (9 consumers) gets deleted along with the rest of the Angular code. |

---

## 3. Phase 10 — The Big Removal (decommission Angular)

This is where the bulk of the remaining work lives. Here's the concrete deletion/migration scope.

### Code to delete

| Category | Count | Location |
|----------|-------|----------|
| Angular controllers | 28 files | `app/assets/javascripts/controllers/` |
| Angular services | 26 files | `app/assets/javascripts/services/` |
| Angular components | 23 dirs (with templates) | `app/assets/javascripts/components/` |
| Directives | 11 files | `app/assets/javascripts/directives/` |
| Factories | 7 files | `app/assets/javascripts/factories/` |
| Filters | 5 files | `app/assets/javascripts/filters/` |
| HTML templates | ~38 files | Inside component dirs |
| Karma specs | 28 files | `spec/javascripts/angular/` |
| Build scripts | 2 files | `build_angular_app.js`, `build_templates.js` |
| Build artifacts | ~16 MB | `angular_app.js`, `quepid_angular_app.js`, `angular_templates.js` + maps |
| **Total** | **~185 files, ~14,500 LOC** | |

### NPM dependencies to remove (19 packages)

- `angular` + 6 core modules (`-animate`, `-cookies`, `-resource`, `-route`, `-sanitize`)
- 12 Angular plugins (`angular-ui-bootstrap`, `angular-wizard`, `ng-tags-input`, etc.)
- `angular-mocks`, `karma`, `karma-chrome-launcher`, `karma-jasmine`

### Layout consolidation

- `core.html.erb` → merge into or replace with `core_new_ui.html.erb`
- Remove `ng-app="QuepidApp"` from `<body>`
- Drop the 3 Angular `<script>` tags and the inline `configurationSvc` bootstrap
- Remove `_header_core_app.html.erb` (legacy BS3 header)
- **Bootstrap 3 → 5**: Angular core loads `core.css` (BS3); new UI loads `core_new_ui.css` (BS5-only). Need a visual pass to ensure shared CSS layers (`panes.css`, `style.css`) work cleanly without BS3.

### Route change

- Current: `/case/:id` → Angular, `/case/:id/new_ui` → Stimulus
- After: `/case/:id` routes directly to the Stimulus layout; `/new_ui` route removed

### Build pipeline

- Remove `build:angular-vendor`, `build:angular-app`, `build:angular-templates` from `package.json` scripts
- Simplify the `build` script to CSS + jQuery (if still needed) + admin + analytics
- Decide whether jQuery stays (some non-Angular code may still use it)

### Testing

- Delete Karma config (`spec/karma/config/unit.js`) and mockBackend
- Vitest already covers the Stimulus controllers (17 test files)
- Consider whether any Angular Karma tests cover edge cases not yet in Vitest

---

## 4. Known Functional Gaps (minor)

| Gap | Severity | Notes |
|-----|----------|-------|
| Solr "render template" tab in explain modal | Low | Edge case for Solr template queries; needs `searcher.renderTemplate()` equivalent |
| Per-doc match breakdown always-on | Low | Intentional — new UI uses explicit toggle; can add user setting later |
| Share case modal on new_ui | Low | Already works on `/cases` page; just not wired in the action bar yet |

---

## Suggested Order of Operations

1. **Wire the share case modal** on new_ui (small gap closure)
2. **Strip the jQuery bridge** from `resizable_pane_controller.js`
3. **Flip the route** — make `/case/:id` serve the Stimulus layout
4. **Delete Angular code** in one large PR (or a few grouped PRs by category)
5. **Remove npm dependencies** and build scripts
6. **BS3→BS5 visual pass** on shared CSS
7. **Update docs** (`DEVELOPER_GUIDE.md`, `docs/app_structure.md`, AI context)

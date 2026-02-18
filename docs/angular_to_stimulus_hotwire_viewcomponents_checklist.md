# Angular to Stimulus, Hotwire, and ViewComponents Migration Checklist

**Status:** Migration is **complete**. All Angular code has been removed. 36 ViewComponents and 50 Stimulus controllers are in production on the `deangularjs-experimental` branch. See [per_component_migration_checklist.md](per_component_migration_checklist.md) for the full component inventory.

## Phase 3: ViewComponent Patterns — ✅ Complete

### 3.3 Components wired into workspace

The following components are **wired** into the core try page:

- **QueryListComponent** — renders per query row: QscoreQuery, MoveQuery, QueryOptions, QueryExplain, DeleteQuery. Selection via `?query_id=`; sortable when `Rails.application.config.query_list_sortable` is true.
- **ResultsPaneComponent** — shows selected query context, query notes (information need), and placeholder for search results.
- **AnnotationsComponent** — case-level annotations panel; rendered in core/show.
- **FrogReportComponent** — rating stats; rendered in core/show toolbar.
- **DiffComponent** — snapshot diff; rendered in core/show toolbar.

- **MatchesComponent** — document cards in results pane; wired via DocumentCardComponent and search API HTML format.
- **AnnotationComponent** — single-annotation edit within annotations list; wired in AnnotationsComponent; create returns Turbo Stream with AnnotationComponent.

---

## Phase 4: Component-by-Component Migration — ✅ Complete

All 25 original Angular components plus 8 new components have been migrated. See [per_component_migration_checklist.md](per_component_migration_checklist.md) for the full list with ViewComponent and Stimulus controller mappings.

### 4.2 Per-Component Checklist Template (reference)

**Template (apply per component):**

- [ ] **Analyze Angular implementation**
  - [ ] Read directive, controller, templates
  - [ ] List all service dependencies
  - [ ] List all API calls
  - [ ] List all DOM events and user interactions

- [ ] **Design replacement** (Option A: server-centric)
  - [ ] ViewComponent: what markup? what props?
  - [ ] Stimulus: what actions? what minimal UI state? (prefer server over client)
  - [ ] Turbo Frame: is this region dynamically updated? (prefer yes for Option A)
  - [ ] Server: new controller action? or use existing API? (prefer server-rendered responses)

- [ ] **Implement**
  - [ ] Create ViewComponent
  - [ ] Create Stimulus controller (if needed)
  - [ ] Create/update Rails view or partial
  - [ ] Wire up `data-controller` and `data-action`
  - [ ] Ensure URLs use `getQuepidRootUrl()` or Rails helpers — see [api_client.md](api_client.md)

- [ ] **Test**
  - [ ] Manual verification
  - [ ] E2E test if critical path
  - [ ] Unit test for ViewComponent (optional)

## Phase 9: Quality & Polish — In Progress

### 9.1 Accessibility

- [ ] **Keyboard navigation** — ensure modals, lists, buttons are keyboard-accessible
- [ ] **ARIA attributes** — modals, live regions for score updates
- [ ] **Focus management** — modal open/close, Turbo Frame updates

### 9.2 Performance

- [ ] **Minimize JS** — Stimulus controllers should be small
- [ ] **Asset size** — verify no duplicate libraries (e.g. Bootstrap once)

---

## Quick Reference: Migration Pattern

```
Angular Component          →    Rails Replacement
─────────────────────────────────────────────────────────
Directive + Controller     →    ViewComponent + Stimulus
Template (.html)           →    ViewComponent template (.html.erb)
Modal template             →    Shared partial or ModalComponent
Service ($http)            →    Rails controller action or fetch()
$scope / bindings          →    data-* attributes, Turbo Frame
ng-click                   →    data-action="click->controller#method"
ng-if / ng-show            →    Server-rendered or Stimulus toggle
```
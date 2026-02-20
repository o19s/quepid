# Plan: Workspace Visual Parity — Single-Column Expand-in-Place Layout

## Context

The `deangularjs-experimental` branch redesigned the case workspace into a two-panel layout (query list left, results pane right), diverging visually from the Angular `deangularjs` branch. The user wants **visual parity with the Angular layout** while keeping the ViewComponent/Stimulus/Turbo architecture. The Angular layout uses a single full-width column where each query row expands in-place to show its search results.

The "Tune Relevance" settings panel should be a sliding right-side panel (matching Angular's `.pane_east`), not the current collapsible card in the header.

## Approach

Four phases, each independently testable. The first phase extracts reusable utilities from the 748-line `results_pane_controller.js` so the later phases can share that logic without duplication.

---

## Phase 1: Extract Utilities from `results_pane_controller.js`

**No visual change. All tests pass after this phase.**

### 1a. Create `app/javascript/utils/results_fetcher.js`
Extract from `results_pane_controller.js` lines 301-363 (fetch) and 482-525 (parse):
- `fetchResultsHtml({ caseId, tryNumber, queryId, pageSize, start, diffSnapshotIds, showOnlyRated })` → returns Response
- `parseResultsHtml(htmlText)` → returns `{ numFound, headerEl, cards[], loadMoreEl }`

### 1b. Create `app/javascript/utils/rating_popover.js`
Extract from `results_pane_controller.js` lines 131-188 and `query_expand_controller.js` lines 165-199:
- `toggleRatingPopover(popoverMap, triggerEl, docId, scale, labels)` — shows/hides Bootstrap popover
- `buildRatingPopoverContent(docId, scale, labels)` — builds DOM for popover content
- `disposePopovers(popoverMap)` — cleanup helper

### 1c. Create `app/javascript/utils/bulk_rating.js`
Extract from `results_pane_controller.js` lines 414-479:
- `bulkRate(caseId, queryId, docIds, rating)`
- `bulkClear(caseId, queryId, docIds)`
- `collectVisibleDocIds(container)` — gets `data-doc-id` from `.document-card` elements

### 1d. Create `app/javascript/utils/detail_modal.js`
Extract from `results_pane_controller.js` lines 538-717:
- `openDetailModal({ triggerEl, modalEl, targetEls, caseId, tryNumber, queryId })`
- `fetchDetailFields(caseId, tryNumber, queryId, docId)`

### 1e. Refactor existing controllers to use utilities
- `results_pane_controller.js` — replace inline implementations with calls to new utils (shrinks from ~748 to ~250 lines)
- `query_expand_controller.js` — replace duplicate rating popover with `rating_popover.js`

### Files created
- `app/javascript/utils/results_fetcher.js` (new)
- `app/javascript/utils/rating_popover.js` (new)
- `app/javascript/utils/bulk_rating.js` (new)
- `app/javascript/utils/detail_modal.js` (new)

### Files modified
- `app/javascript/controllers/results_pane_controller.js` — use extracted utils
- `app/javascript/controllers/query_expand_controller.js` — use `rating_popover.js`

---

## Phase 2: Layout Restructure (Header + Toolbar + Single Column)

**Visual change: workspace goes from two-panel to single-column. Queries still show lightweight 5-result preview when expanded.**

### 2a. Restructure `app/views/core/show.html.erb`

Current structure:
```
div.core-workspace
  div.d-flex (header: everything in one row)
  div.mb-3 (AddQueryComponent)
  turbo_frame "workspace_content"
    div.workspace-panels-row
      div.workspace-panel.west → QueryListComponent
      div.workspace-resizer
      div.workspace-panel.east → ResultsPaneComponent
```

New structure matching Angular:
```
div.core-workspace
  div#case-header (score blocks left, case/try/scorer names right)
  div#case-actions (toolbar: ul.list-inline of all action buttons)
  div#query-container (full-width)
    div.query-controls-row (AddQueryComponent left, filter/sort/count right)
    ul (query rows from QueryListComponent)
  div.tune-relevance-panel (sliding right panel with SettingsPanelComponent)
```

Specific changes:
1. **Case header** (`div#case-header`): Left side renders `QscoreCaseComponent` (sparkline + score badge). Right side: case name (inline-edit), " -- ", try name (inline-edit), " -- ", scorer name. Badges (PUBLIC, ARCHIVED) and nightly toggle.
2. **Toolbar** (`div#case-actions`): New row below header containing `ul.list-inline` with all action components as `<li>` items in this order: ScorerPanelComponent trigger, JudgementsComponent, TakeSnapshotComponent, DiffComponent, ImportRatingsComponent, ShareCaseComponent, CloneCaseComponent, DeleteCaseOptionsComponent, ExportCaseComponent, "Tune Relevance" toggle button.
3. **Remove** `turbo_frame_tag "workspace_content"`, `.workspace-panels-row`, all panel divs, the resizer div.
4. **Remove** `ResultsPaneComponent` render call entirely.
5. **Remove** `selected_query_id`, `selected_query` variable computation (lines 155-159).
6. **QueryListComponent** rendered full-width with no panel wrapper.
7. **SettingsPanelComponent** moved into a new `div.tune-relevance-panel` at the end of `.core-workspace`, toggled by the toolbar button.
8. **Keep** ScorerPanelComponent, ChartPanelComponent as collapsible details accessible from toolbar area.
9. **Keep** one shared detail modal (from `ResultsPaneComponent` template) in `show.html.erb` for document detail viewing.
10. **Keep** annotations panel collapse at the bottom.

### 2b. Integrate AddQueryComponent + filter controls into one row

Keep filter controls inside `QueryListComponent` but render them in a top row alongside `AddQueryComponent` using a ViewComponent slot. The `query-list` Stimulus controller needs its targets co-located.

Modify `app/components/query_list_component.html.erb`:
- Add a slot `with_add_query` that renders in the controls row
- Layout: `div.d-flex` with add-query slot on left, filter/sort/count on right
- Below: the `<ul>` query list

Modify `app/components/query_list_component.rb`:
- Remove `selected_query_id` param and `selected?` method
- Add `renders_one :add_query` slot

### 2c. Modify `_query_row.html.erb`
- Remove the `<a>` link with `data-turbo-frame="workspace_content"` (lines 24-28)
- Replace with a `<span>` that triggers `query-expand#toggle` on click (query text click = expand)
- Remove `selected` highlighting (no selected state needed)
- Remove `fw-bold` conditional class

### 2d. Tune Relevance sliding panel
Add to bottom of `show.html.erb`:
```erb
<div class="tune-relevance-panel" data-controller="tune-relevance" data-tune-relevance-target="panel">
  <div class="tune-relevance-panel__header">
    <h5>Tune Relevance</h5>
    <button data-action="click->tune-relevance#close">×</button>
  </div>
  <%= render SettingsPanelComponent.new(...) %>
</div>
```

### 2e. New controller: `app/javascript/controllers/tune_relevance_controller.js`
Simple toggle controller (~30 lines):
- `toggle()` — adds/removes `.tune-relevance-panel--open` class
- `close()` — removes the open class
- Escape key closes

### 2f. CSS changes: `app/assets/stylesheets/core-workspace.css`

**Remove** (all panel/resizer rules, lines 8-115):
- `.workspace-panels-row`, `.workspace-panel`, `.workspace-panel.west`, `.workspace-panel.east`
- `.workspace-panel--collapsed.*`, `.workspace-panel__toggle`, `.workspace-panel__header`
- `.workspace-panel__content`, `.workspace-resizer`

**Add**:
- `#case-header` — flex row, align-items center
- `#case-actions` — padding, border-bottom
- `#case-actions .list-inline` — horizontal list
- `#query-container` — white background, border-top, full width
- `.tune-relevance-panel` — fixed right, full height, dark bg (#2d2d2d), color (#eee), transform translateX(100%), transition, z-index 1050, width 400px
- `.tune-relevance-panel--open` — transform translateX(0)

**Keep**: `.query-expand-chevron`, `.query-inline-results` rules (enhanced in Phase 3)

### Files modified
- `app/views/core/show.html.erb` — major restructure
- `app/components/query_list_component.rb` — remove selected_query_id, add slot
- `app/components/query_list_component.html.erb` — integrate add-query + controls row
- `app/views/core/queries/_query_row.html.erb` — remove turbo-frame link
- `app/assets/stylesheets/core-workspace.css` — remove panel CSS, add new layout CSS

### Files created
- `app/javascript/controllers/tune_relevance_controller.js` (new, ~30 lines)

### Files removed
- `app/javascript/controllers/workspace_panels_controller.js` (103 lines)
- `app/javascript/controllers/workspace_resizer_controller.js` (159 lines)

---

## Phase 3: Full Inline Results Per Query

**Visual change: expanding a query shows full results (10 results, rating popovers, bulk rate bar, notes, load more, detail modal) instead of the lightweight 5-result preview.**

### 3a. Expand `_query_row.html.erb` inline results area

Replace the empty `div.query-inline-results` (line 62) with full results template:
- Per-query toolbar: "Score All" bulk rate buttons + action buttons (Copy, Notes, Explain, Missing Docs, Options, Move, Delete)
- Notes form (collapsible)
- Loading indicator
- Error message
- Results container (populated by Stimulus)
- Pass additional locals: `scorer_scale`, `scale_with_labels`

### 3b. Enhance `query_expand_controller.js`

Grow from ~228 lines to ~350-400 lines using extracted utilities:

**New values**: `scaleLabels` (Object), `pageSize` (Number, default 10)
**New targets**: `resultsContainer`, `loadingIndicator`, `errorMessage`, `errorText`, `notesSection`, `resultCount`

**Changed methods**:
- `_fetchPreview()` → `_fetchResults()` — uses `fetchResultsHtml()` from utils, page size 10
- `_renderPreview()` → `_renderResults()` — uses `parseResultsHtml()`, renders to `resultsContainerTarget`
- `_handleInlineClick()` — expanded for detail modal, load more, rated-only toggle
- `_showInlineRatingPopover()` → uses `toggleRatingPopover()` from utils

**New methods**:
- `bulkRate(event)` — calls util, then `_fetchResults()`
- `bulkClear()` — calls util, then `_fetchResults()`
- `copyQuery()` — clipboard
- `toggleNotes()` — toggles `notesSectionTarget`
- `_loadMore()` — paginated fetch
- `_openDetailModal(triggerEl)` — uses shared modal from `utils/detail_modal.js`
- `_handleDiffChanged(event)` — re-fetches with diff snapshot IDs

### 3c. Shared detail modal
One `#document-detail-modal` in `show.html.erb`. Each `query_expand_controller` locates it via `document.getElementById()`.

### 3d. Result count display
Add `<span data-query-expand-target="resultCount">` next to score badge. Updated after fetch with numFound.

### 3e. Remove two-panel components
- Delete `app/components/results_pane_component.rb`
- Delete `app/components/results_pane_component.html.erb`
- Delete `app/javascript/controllers/results_pane_controller.js`

### Files modified
- `app/views/core/queries/_query_row.html.erb` — add full inline results area
- `app/javascript/controllers/query_expand_controller.js` — major enhancement
- `app/views/core/show.html.erb` — add shared detail modal
- `app/components/query_list_component.rb` — pass scorer_scale, scale_with_labels to query rows

### Files removed
- `app/components/results_pane_component.rb`
- `app/components/results_pane_component.html.erb`
- `app/javascript/controllers/results_pane_controller.js`

---

## Phase 4: Polish and Visual Parity

### 4a. CSS styling to match Angular
- `.sub-results` background: `#f7f7f7`
- Query score badge: 90px wide, colored background, white text, left-rounded corners
- Case score badge: min-height 80px, font-size 22px
- Rating buttons: colored background per scale value

### 4b. Expand All / Collapse All behavior
Add staggered fetch (50ms between queries) to avoid hammering the API.

### 4c. Tune Relevance panel theming
- Dark background (#2d2d2d), light text (#eee)
- Section headers with gradient background
- Close on Escape key

### 4d. Toolbar button layout polish
- Icon + text label for each action
- Horizontal spacing with `list-inline` padding

---

## Verification

### Automated
- `bin/docker r bundle exec rails test` — all Ruby tests
- `bin/docker r yarn test` — all JS tests
- Add Vitest tests for new utility modules

### Manual
- [ ] Expand/collapse individual query — shows full results with rating badges
- [ ] Rate a document inline — popover appears, rating persists, score badge updates
- [ ] Bulk rate all documents in an expanded query
- [ ] Load more results pagination within an expanded query
- [ ] Detail modal opens from any expanded query (shared modal)
- [ ] Sort/filter/pagination in query list works
- [ ] Drag-to-reorder queries
- [ ] Expand All / Collapse All
- [ ] Tune Relevance panel slides open/closed
- [ ] Diff mode — compare snapshots shows diff badges
- [ ] Notes form — toggle, edit, save
- [ ] Export, Share, Clone, Delete, Import, Snapshot actions all accessible from toolbar

### Visual parity
- Re-run `test/visual_parity/run_comparison.sh` to capture new screenshots
- Compare workspace screenshot against `deangularjs` branch

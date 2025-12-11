# Quepid Angular Components

## QScore Component Refactoring

The original `qscore` component has been **removed** and replaced with two focused components to simplify maintenance and improve clarity:

- `qscore-case` - For case-level/average query scoring with full features
- `qscore-query` - For individual query scoring with minimal features

## Components

### qscore-case
**Purpose**: Case-level scoring display with graph support and diff functionality
**Used in**: Case headers, average query displays

**Features**:
- Graph display via `qgraph` component
- Diff score comparison
- Full annotation support
- Score labels and custom styling
- Background color customization

**Bindings**:
- `annotations` - Array of annotations for graph display
- `diff-label` - Label for diff display
- `full-diff-name` - Full name for diff tooltip
- `max-score` - Maximum possible score
- `scorable` - Object containing score data
- `score-label` - Label to display with score
- `scores` - Array of historical scores for graph
- `show-diff` - Boolean to show/hide diff display

**Example Usage**:
```html
<qscore-case
  annotations="annotations"
  class="case-score"
  diff-label="queries.selectedDiffName()"
  full-diff-name="queries.fullDiffName()"
  max-score="maxScore || 1"
  scorable="queries.avgQuery"
  score-label="getScorer().name"
  scores="scores"
  show-diff="queries.selectedDiff() !== null"
>
</qscore-case>
```

### qscore-query
**Purpose**: Simple individual query scoring display
**Used in**: Search results, individual query displays

**Features**:
- Basic score display
- Minimal styling
- No graph or diff support

**Bindings**:
- `max-score` - Maximum possible score
- `scorable` - Object containing score data
- `show-diff` - Boolean (currently unused but kept for compatibility)

**Example Usage**:
```html
<!-- Single query display -->
<qscore-query
  class="results-score"
  max-score="maxScore || 100"
  scorable="query"
  show-diff="displayed.results == displayed.resultsView.diff"
>
</qscore-query>

<!-- Snapshot comparison (dual display) -->
<qscore-query
  class="results-score"
  max-score="maxScore || 100"
  scorable="query"
  show-diff="displayed.results == displayed.resultsView.diff"
>
</qscore-query>
<qscore-query
  ng-if="displayed.results == displayed.resultsView.diff && query.diff"
  class="results-score diff-score"
  max-score="maxScore || 100"
  scorable="query.diff"
  show-diff="false"
>
</qscore-query>
```

## Migration Completed

The migration from the original `qscore` component to the two specialized components has been completed:

### Updated Files:
- `app/assets/templates/views/queriesLayout.html` - Now uses `qscore-case`
- `app/assets/templates/views/searchResults.html` - Now uses `qscore-query`
- `app/assets/stylesheets/qscore.css` - Updated to support new components

### Removed Files:
- `app/assets/javascripts/components/qscore/qscore_controller.js` ❌
- `app/assets/javascripts/components/qscore/qscore_directive.js` ❌
- `app/assets/javascripts/components/qscore/qscore.html` ❌
- `app/assets/javascripts/filters/chooseScoreClass.js` ❌ (no longer needed)

### Moved Files:
- `qscore_service.js` → `app/assets/javascripts/services/qscore_service.js` ✅

## Shared Service

The `qscoreSvc` service is shared between both components and provides:
- `scoreToColor(score, maxScore)` - Converts scores to color values for styling

## Benefits Achieved

1. **🎯 Clearer Intent**: Each component has a specific, focused purpose
2. **⚡ Better Performance**: Lighter components with only necessary features
3. **🛠️ Easier Maintenance**: Focused responsibilities make debugging simpler
4. **🔒 Type Safety**: More predictable component behavior with reduced binding complexity
5. **📦 Reduced Complexity**: No unused bindings, conditional logic, or dynamic CSS classes
6. **🧹 Cleaner Code**: Eliminated scoreType property and chooseScoreClass filter
7. **🎯 Better Snapshot Comparison**: Individual queries now show both current and snapshot scores side-by-side

## File Structure

```
app/assets/javascripts/
├── components/
│   ├── qscore_case/               # Case-level scoring
│   │   ├── qscore_case_controller.js
│   │   ├── qscore_case_directive.js
│   │   └── qscore_case.html
│   └── qscore_query/              # Individual query scoring
│       ├── qscore_query_controller.js
│       ├── qscore_query_directive.js
│       └── qscore_query.html
└── services/
    └── qscore_service.js          # Shared scoring service
```

## Additional Optimizations

### Eliminated Dynamic Styling
Since each component now has a fixed purpose, we removed the dynamic `scoreType` property and hardcoded the appropriate CSS classes:

- **qscore-case**: Always uses `header-rating` CSS class
- **qscore-query**: Always uses `overall-rating` CSS class

This eliminated:
- The `scoreType` controller property from both components
- The `chooseScoreClass` Angular filter (no longer needed)
- Dynamic CSS class determination at runtime

### Bundle Size Reduction
- JavaScript bundle: **514.1KB → 510.1KB** (4KB reduction)
- Templates: **107 → 106** templates
- Removed unused filter and controller properties
```


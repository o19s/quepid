# Quepid Angular Components

## QScore Component Strategy

The Quepid application uses a **unified snapshot strategy** with two focused qscore components that handle both single and multiple snapshot scenarios consistently:

- `qscore-case` - For case-level/average query scoring with full features
- `qscore-query` - For individual query scoring with minimal features

Both components now support **multiple snapshot display** using the same underlying architecture and styling.

## Components

### qscore-case
**Purpose**: Case-level scoring display with graph support and snapshot comparison
**Used in**: Case headers, average query displays

**Features**:
- Graph display via `qgraph` component
- Multiple snapshot comparison
- Full annotation support
- Score labels and custom styling
- Background color customization
- Handles both query objects (with `currentScore`) and searcher objects (with `diffScore`)

**Bindings**:
- `annotations` - Array of annotations for graph display
- `max-score` - Maximum possible score
- `scorable` - Object containing score data (query or searcher)
- `score-label` - Label to display with score
- `scores` - Array of historical scores for graph

**Example Usage**:
```html
<!-- Single case score -->
<qscore-case
  annotations="annotations"
  class="case-score"
  max-score="maxScore || 1"
  scorable="queries.avgQuery"
  score-label="getScorer().name"
  scores="scores"
>
</qscore-case>

<!-- Snapshot comparison -->
<qscore-case
  ng-if="queries.selectedDiff() !== null && queries.avgQuery.diff"
  class="case-score diff-score"
  max-score="maxScore || 1"
  scorable="queries.avgQuery.diff"
  score-label="queries.fullDiffName()"
  scores="[]"
  annotations="[]"
>
</qscore-case>
```

### qscore-query
**Purpose**: Individual query scoring display with snapshot support
**Used in**: Search results, individual query displays, multi-snapshot comparisons

**Features**:
- Consistent score display styling
- Supports both single and multiple snapshots
- Works with query objects (`currentScore`) and searcher objects (`diffScore`)
- Minimal styling optimized for query-level display

**Bindings**:
- `max-score` - Maximum possible score
- `scorable` - Object containing score data (query or searcher)
- `show-diff` - Boolean (maintained for compatibility)

**Example Usage**:
```html
<!-- Single query display -->
<qscore-query
  class="results-score"
  max-score="maxScore || 100"
  scorable="query"
  show-diff="false"
>
</qscore-query>

<!-- Multi-snapshot display -->
<qscore-query
  class="results-score multi-diff-score"
  max-score="maxScore || 100"
  scorable="searcher"
  show-diff="false"
>
</qscore-query>
```

## Unified Snapshot Strategy

### Single Snapshot Comparison
- Uses side-by-side qscore components (existing behavior)
- Current score + diff score displayed together
- Consistent styling and interaction patterns

### Multiple Snapshot Comparison
- **New**: Uses the same qscore components in column layout
- Current score + multiple snapshot scores in organized display
- **No more separate template** - reuses existing qscore component architecture
- Consistent styling across all snapshot scenarios

## Data Object Support

Both components now intelligently handle different types of scorable objects:

### Query Objects (Original)
```javascript
{
  currentScore: {
    score: 0.85,
    backgroundColor: "#color" // optional
  }
}
```

### Searcher Objects (Multi-Diff)
```javascript
{
  diffScore: {
    score: 0.72,
    backgroundColor: "#color" // optional
  },
  name: function() { return "Snapshot Name"; },
  numFound: 1234
}
```

### Direct Score Objects (Fallback)
```javascript
{
  score: 0.90,
  backgroundColor: "#color" // optional
}
```

## Benefits of Unified Strategy

1. **🎯 Consistent User Experience**: Same visual styling and behavior across all snapshot scenarios
2. **⚡ Code Reuse**: No duplicate score display logic - multi-diff now uses qscore components
3. **🛠️ Easier Maintenance**: Single place to update scoring logic and styling
4. **🔒 Type Safety**: Robust handling of different scorable object types
5. **📦 Reduced Complexity**: Eliminated separate multi-diff score display implementation
6. **🎨 Consistent Styling**: All scores use the same color coding and visual design
7. **🚀 Performance Optimized**: Uses targeted watches to avoid expensive deep object comparisons

## Performance Optimizations

The enhanced controllers use **targeted Angular watches** for optimal performance:

### Single Snapshot Performance
- **Same as original**: Watches only `ctrl.scorable.currentScore` 
- **No performance impact**: Existing single snapshot behavior unchanged
- **Minimal overhead**: Only watches the specific score property that changes

### Multi-Snapshot Performance  
- **Targeted watching**: Adds only `ctrl.scorable.diffScore` watch for searcher objects
- **Avoids deep comparison**: Does not watch entire query/searcher objects
- **Efficient updates**: Only triggers when actual score values change

### Watch Strategy
```javascript
// Original behavior - lightweight and fast
$scope.$watch('ctrl.scorable.currentScore', function() { ... }, true);

// Multi-diff support - only adds one targeted watch  
$scope.$watch('ctrl.scorable.diffScore', function() { ... }, true);
```

This approach avoids the expensive deep object watching that would occur if we watched the entire `ctrl.scorable` object.

## File Structure

```
app/assets/javascripts/
├── components/
│   ├── qscore_case/               # Case-level scoring (enhanced)
│   │   ├── qscore_case_controller.js    # Handles multiple scorable types
│   │   ├── qscore_case_directive.js
│   │   └── qscore_case.html
│   └── qscore_query/              # Individual query scoring (enhanced)
│       ├── qscore_query_controller.js   # Handles multiple scorable types
│       ├── qscore_query_directive.js
│       └── qscore_query.html
└── services/
    └── qscore_service.js          # Shared scoring service
```

## Template Usage

### Single Diff (Existing)
- `app/assets/templates/views/queriesLayout.html` - Case-level side-by-side
- `app/assets/templates/views/searchResults.html` - Query-level side-by-side

### Multi-Diff (Improved)
- `app/assets/templates/views/queryMultiDiffResults.html` - Now uses qscore-query components

## Shared Service

The `qscoreSvc` service is shared between both components and provides:
- `scoreToColor(score, maxScore)` - Converts scores to color values for styling

## Migration Benefits

### Before
- **Single snapshots**: Used qscore components ✅
- **Multiple snapshots**: Reimplemented score display in template ❌
- **Result**: Inconsistent styling and duplicate code

### After  
- **Single snapshots**: Uses qscore components ✅
- **Multiple snapshots**: Uses qscore components ✅  
- **Result**: Consistent styling and unified code architecture

## Styling Classes

Both components maintain their distinct CSS styling:
- **qscore-case**: Uses `header-rating` CSS class
- **qscore-query**: Uses `overall-rating` CSS class

Additional classes for multi-diff context:
- **multi-diff-score**: Applied to qscore components in multi-diff templates
- **snapshot-score**: Applied to snapshot qscore components for visual distinction
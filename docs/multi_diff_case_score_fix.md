# Multi-Diff Case Score Fix Documentation

## Problem Description

In the multi-snapshot comparison UI, the `qscore-case` rendered scores for each snapshot appeared to be incorrect. The case-level scores should represent the average of all query scores within each snapshot, but instead were showing individual query scores or incorrect values.

## Root Cause

The issue was in the `avgQuery.multiDiff` implementation in `queriesCtrl.js`. The case-level multiDiff object was returning individual searcher objects from query-level multiDiffs, but these searchers only contained scores for individual queries, not case-level averages.

Specifically:

1. The `qscore-case` components in `queriesLayout.html` were using `searcher in queries.avgQuery.multiDiff.getSearchers()`
2. Each `searcher` object had a `diffScore` property containing individual query scores
3. What was needed was case-level scores that averaged all query scores for each snapshot

## Solution Implementation

### 1. Modified `avgQuery.multiDiff` Structure

In `app/assets/javascripts/controllers/queriesCtrl.js`, the case-level multiDiff object was enhanced with:

- `_caseSearchers`: Array to store case-level searcher objects with averaged scores
- `_calculateCaseScores()`: Method to compute average scores across all queries for each snapshot
- Updated `getSearchers()` to return case-level searchers instead of query-level ones

### 2. Case-Level Score Calculation

The `_calculateCaseScores()` method:

1. Identifies all snapshots from individual query multiDiffs
2. For each snapshot position, creates a case-level searcher object
3. Calculates the average score across all queries for that snapshot:
   - Excludes non-rated queries (`--`, `zsr`, `null`, `undefined`)
   - Handles mixed rated/unrated scenarios properly
   - Sets score to `--` if no queries have valid ratings
4. Adds proper `currentScore` getter for qscore-case compatibility
5. Includes background color calculation using `qscoreSvc.scoreToColor()`

### 3. Integration with Scoring System

- Added case-level score recalculation to the `scoring-complete` event listener
- Ensured scores update automatically when individual query scores change
- Added debug logging for troubleshooting

### 4. Dependencies Updated

- Added `qscoreSvc` dependency to `QueriesCtrl` for color calculation

## Code Changes

### Files Modified

1. **`app/assets/javascripts/controllers/queriesCtrl.js`**
   - Enhanced `avgQuery.multiDiff` with case-level scoring logic
   - Added `_calculateCaseScores()` method
   - Updated scoring-complete listener
   - Added qscoreSvc dependency

### Key Methods Added

```javascript
_calculateCaseScores: function() {
  // Creates case-level searcher objects with averaged scores
  // Handles score aggregation across all queries for each snapshot
  // Provides qscore-case component compatibility
}
```

### Data Structure

Each case-level searcher object contains:

```javascript
{
  name: function() { return "Snapshot Name"; },
  version: function() { return snapshotVersion; },
  diffScore: { 
    score: averageScore,        // Averaged across all queries
    allRated: boolean,          // True if all queries rated
    backgroundColor: colorValue  // Computed color for display
  },
  currentScore: getter         // Returns diffScore for qscore compatibility
}
```

## Testing

### Manual Testing

Since the fix involves UI components and real-time score calculations, testing should be done manually:

### Expected Behavior

- **Query 1**: Snapshot A = 0.8, Snapshot B = 0.6
- **Query 2**: Snapshot A = 0.6, Snapshot B = 0.8
- **Query 3**: Snapshot A = --, Snapshot B = 0.9

**Case-level scores should be:**
- Snapshot A: (0.8 + 0.6) / 2 = 0.7 (excludes unrated Query 3)
- Snapshot B: (0.6 + 0.8 + 0.9) / 3 = 0.77

### Testing Steps

1. Create a case with multiple queries
2. Create 2-3 snapshots with different results
3. Rate queries with different scores per snapshot
4. Enable multi-diff comparison ("Multiple Snapshots")
5. Verify case-level qscore-case components show averaged scores
6. Check browser console for debug messages

## Debug Features

Added console logging for troubleshooting:

```
"Case searcher 0 (Snapshot Name) average score: 0.75 from 3 queries"
```

This helps verify that:
- Correct number of queries are being processed
- Scores are being calculated properly
- Unrated queries are being excluded

## Compatibility

- **Backward Compatible**: No breaking changes to existing APIs
- **Component Compatible**: Works with existing qscore-case components
- **Service Compatible**: Integrates with existing scoring services

## Performance Considerations

- Case-level scores recalculated only when needed (on scoring-complete events)
- Efficient aggregation using single-pass calculation
- Minimal memory overhead with getter properties

## Future Enhancements

1. **Caching**: Cache case-level scores to avoid recalculation
2. **Incremental Updates**: Update only changed snapshot scores
3. **Weighted Averages**: Support query-specific weights in averaging
4. **Statistics**: Add min/max/stddev metrics alongside averages

## Troubleshooting

### Common Issues

1. **Scores not updating**: Check browser console for "Case searcher" debug messages
2. **Incorrect averages**: Verify that individual query scores are properly set
3. **Missing scores**: Ensure queries have valid diffScore properties
4. **Color issues**: Check that qscoreSvc dependency is properly injected

### Debug Checklist

- [ ] Individual query multiDiffs are created successfully
- [ ] Query-level scores are calculated and stored in diffScore
- [ ] Case-level _calculateCaseScores() is being called
- [ ] Case searchers have proper score values and currentScore getters
- [ ] qscore-case components are receiving case searcher objects as scorable

## Related Files

- `app/assets/templates/views/queriesLayout.html` - qscore-case template usage
- `app/assets/javascripts/components/qscore_case/qscore_case_controller.js` - Score component
- `app/assets/javascripts/services/multiDiffResultsSvc.js` - Individual query multiDiff logic
- `app/assets/javascripts/services/qscore_service.js` - Color calculation service

## Conclusion

This fix ensures that multi-snapshot comparison case-level scores properly represent the average performance across all queries for each snapshot, providing users with accurate case-level insights in the multi-diff UI.
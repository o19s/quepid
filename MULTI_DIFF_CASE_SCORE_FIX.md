# Multi-Diff Case Score Fix Summary

## Issue
The qscore-case rendered scores for each snapshot in the multi-snapshot comparison UI were incorrect. They should display the average of all query scores within each snapshot (case-level average), but were showing individual query scores instead.

## Root Cause
In `queriesCtrl.js`, the `avgQuery.multiDiff.getSearchers()` method was returning individual query-level searchers with `diffScore` properties containing scores for single queries, rather than case-level searchers with averaged scores across all queries.

## Solution
Modified the `avgQuery.multiDiff` object in `app/assets/javascripts/controllers/queriesCtrl.js` to:

1. **Added case-level score calculation**: New `_calculateCaseScores()` method that:
   - Aggregates scores across all queries for each snapshot
   - Excludes unrated queries (`--`, `zsr`, `null`, `undefined`) from averages
   - Handles edge cases (all unrated queries → `--`)
   - Calculates proper background colors using `qscoreSvc.scoreToColor()`

2. **Created case-level searcher objects**: Each with:
   - `diffScore`: Contains averaged score and metadata
   - `currentScore` getter: For qscore-case component compatibility
   - `name()` and `version()` methods: Copied from template searchers

3. **Integrated with scoring system**: 
   - Added case-level score recalculation to `scoring-complete` event listener
   - Added `qscoreSvc` dependency for color calculation
   - Added debug logging for troubleshooting

## Files Changed
- `app/assets/javascripts/controllers/queriesCtrl.js` - Main fix implementation
- `docs/multi_diff_case_score_fix.md` - Detailed documentation (new)

## Expected Behavior
**Before**: Each snapshot showed individual query scores or incorrect values
**After**: Each snapshot shows the average score of all queries within that snapshot

### Example:
- Query 1: Snapshot A = 0.8, Snapshot B = 0.6  
- Query 2: Snapshot A = 0.6, Snapshot B = 0.8
- Query 3: Snapshot A = --, Snapshot B = 0.9 (unrated)

**Case-level scores:**
- Snapshot A: (0.8 + 0.6) / 2 = 0.7 (excludes unrated)
- Snapshot B: (0.6 + 0.8 + 0.9) / 3 = 0.77

## Testing
Check for debug messages: `"Case searcher X (name) average score: Y from Z queries"`

## Compatibility
- Fully backward compatible
- No breaking changes to existing APIs
- Works with existing qscore-case components
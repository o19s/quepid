# Snapshot Searcher Refactoring Documentation

## Overview

This document describes the refactoring of Quepid's snapshot loading mechanism to use the same patterns and interfaces as normal search results loading. The goal is to make the code more consistent, maintainable, and easier to understand.

## Problem Statement

Previously, Quepid had two different approaches for handling search results:

1. **Normal Search Results**: Used searcher objects from splainer-search with a consistent interface
2. **Snapshot Results**: Used a different "fetcher" pattern in `diffResultsSvc` with different interfaces and methods

This inconsistency made the codebase harder to maintain and understand, as developers had to learn and work with two different patterns for essentially the same concept: loading and displaying search results.

## Solution Architecture

### Unified Searcher Interface

We created a `SnapshotSearcher` class that implements the same interface as normal searchers from splainer-search. This allows both live search results and snapshot results to be handled using identical patterns.

#### Key Interface Methods

Both normal searchers and snapshot searchers now provide:

- `.search()` - Executes the search (returns a Promise)
- `.docs` - Array of result documents  
- `.numFound` - Total number of results found
- `.type` - Searcher type identifier
- `.version()` - Version for change tracking
- `.pager()` - Pagination support
- `.name()` - Display name for the searcher

### New Components

#### 1. SnapshotSearcherSvc (`snapshotSearcherSvc.js`)

A new service that creates `SnapshotSearcher` instances with the same interface as normal searchers.

```javascript
// Creates a searcher from a snapshot
snapshotSearcherSvc.createSearcherFromSnapshot(snapshotId, query, settings);

// The returned searcher works identically to normal searchers
searcher.search().then(function() {
  console.log('Results:', searcher.docs.length);
  console.log('Total found:', searcher.numFound);
});
```

#### 2. Enhanced QueriesSvc

Added methods to create searchers from snapshots using the same patterns:

```javascript
// New method alongside existing createSearcherFromSettings
queriesSvc.createSearcherFromSnapshot(snapshotId, query, settings);
```

#### 3. Query Object Enhancements

Added new method to Query objects for searching with snapshots:

```javascript
query.searchFromSnapshot(snapshotId)
  .then(function() {
    // Query now behaves exactly like a normal search
    // but uses snapshot data instead of live search engine data
    console.log('Snapshot results loaded:', query.docs.length);
  });
```

## Usage Patterns

### Pattern 1: Traditional Diff Mode (Backward Compatible)

The existing diff functionality continues to work but now uses the unified searcher interface internally:

```javascript
// Set up side-by-side comparison
diffResultsSvc.setDiffSetting(snapshotId);
diffResultsSvc.createQueryDiff(query);

// Access diff results (existing interface preserved)
var diffDocs = query.diff.docs();
var diffName = query.diff.name();
```

### Pattern 2: Primary Snapshot Search (New)

Replace live search entirely with snapshot data using the same interface:

```javascript
// Switch query to use snapshot as primary searcher
query.searchFromSnapshot(snapshotId)
  .then(function() {
    // Query now uses snapshot data but behaves identically
    // to a normal search query
    
    // Same interface as live search:
    console.log('Results:', query.docs.length);
    console.log('Searcher type:', query.searcher.type); // 'snapshot'
    console.log('Total found:', query.numFound);
    
    // All existing query methods work the same way
    query.paginate(); // If supported
    var score = query.currentScore;
    var rated = query.ratedDocs;
  });
```

## Benefits

### 1. Code Consistency

Both live and snapshot results use the same patterns:
- Same method names and signatures
- Same data structures and interfaces  
- Same error handling patterns
- Same pagination and filtering logic

### 2. Reduced Complexity

Developers only need to learn one pattern instead of two different approaches for handling search results.

### 3. Easier Testing

The unified interface makes it easier to write tests that work with both live and snapshot data.

### 4. Future Extensibility

New searcher types can be added using the same interface pattern.

## Migration Guide

### For New Features

Use the new unified interface for any new snapshot-related functionality:

```javascript
// Good: Uses unified interface
var searcher = snapshotSearcherSvc.createSearcherFromSnapshot(id, query, settings);
searcher.search().then(function() {
  processResults(searcher.docs);
});

// Avoid: Creating custom fetcher patterns
```

### For Existing Code

The existing diff interface remains backward compatible, but consider migrating to the unified approach for better maintainability.

### Controller Updates

Controllers can now handle both search types uniformly:

```javascript
// Same code works for both live and snapshot results
function processSearchResults(query) {
  var docs = query.docs;
  var numFound = query.numFound;
  var searcherType = query.searcher.type; // 'solr', 'es', 'snapshot', etc.
  
  // Process results the same way regardless of source
  displayResults(docs, numFound);
}
```

## Example Implementation

See `SnapshotSearchExampleCtrl` for a complete working example that demonstrates:

1. Switching between live, snapshot, and diff modes
2. Using the unified interface for all modes
3. Displaying results consistently regardless of source
4. Debug tools for comparing different approaches

## Technical Details

### SnapshotSearcher Implementation

The `SnapshotSearcher` class:

1. **Initialization**: Loads documents from snapshot data via `snapshot.getSearchResults()`
2. **Normalization**: Uses `normalDocsSvc.explainDoc()` to normalize documents (same as live search)
3. **Rating Integration**: Creates rateable documents using `query.ratingsStore.createRateableDoc()`
4. **Promise Interface**: `.search()` returns a Promise for consistency (resolves immediately since data is pre-loaded)

### Integration Points

- **Ratings**: Snapshot results integrate with the existing ratings system
- **Scoring**: Works with existing scoring and ranking logic
- **Filtering**: Supports filtering by rated/unrated status
- **UI Components**: Works with existing result display components

## Future Enhancements

### Potential Improvements

1. **Lazy Loading**: Load snapshot data on-demand rather than pre-loading
2. **Caching**: Add intelligent caching for frequently accessed snapshots  
3. **Pagination**: Add pagination support for large snapshots
4. **Search Within Snapshots**: Add ability to filter/search within snapshot results
5. **Hybrid Mode**: Combine live and snapshot results in various ways

### Performance Considerations

- Snapshot searchers load data synchronously from pre-cached snapshots
- Memory usage should be monitored for cases with many large snapshots
- Consider implementing cleanup/disposal methods for unused searchers

## Backward Compatibility

All existing functionality continues to work without changes:

- `diffResultsSvc` maintains its existing API
- Unified diff interface provides consistent behavior across all snapshot comparisons
- Existing controllers and views require no updates
- All current diff functionality remains intact

The refactoring is additive - it provides new unified interfaces while preserving existing ones.
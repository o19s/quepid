# Unified Snapshot Comparison Implementation Summary

This document summarizes the implementation of the unified snapshot comparison feature for Quepid, which allows users to compare current search results against 1-3 snapshots through a single, streamlined interface.

## Overview

The feature replaces the old separate single and multiple snapshot comparison interfaces with a unified system that supports both single and multiple snapshot comparisons through one interface, providing a comprehensive view of search performance evolution across different time periods.

## Files Created/Modified

### New Services
- **`app/assets/javascripts/services/multiDiffResultsSvc.js`**
  - Core service managing multiple snapshot comparisons
  - Handles up to 3 snapshots simultaneously
  - Provides compatibility wrapper for existing diff interface
  - Manages searcher initialization and scoring

### New Controllers
- **`app/assets/javascripts/components/diff/multi_diff_modal_instance_controller.js`**
  - Modal controller for selecting multiple snapshots
  - Handles validation of snapshot selections
  - Supports both single and multi-snapshot modes
  - Prevents duplicate snapshot selection

- **`app/assets/javascripts/controllers/queryMultiDiffResults.js`**
  - Controller for rendering multi-snapshot comparison results
  - Manages document tuple creation for side-by-side comparison
  - Handles visual difference highlighting

### New Templates
- **`app/assets/javascripts/components/diff/_multi_modal.html`**
  - Modal interface for snapshot selection
  - Dynamic snapshot selection with add/remove functionality
  - Validation and error messaging
  - Support for both single and multi-snapshot modes

- **`app/assets/templates/views/queryMultiDiffResults.html`**
  - Main comparison view template
  - Side-by-side result display (current + up to 3 snapshots)
  - Summary statistics and export controls
  - Responsive design for mobile devices

### New Directives
- **`app/assets/javascripts/components/multidiff/query_multi_diff_results_directive.js`**
  - Directive for multi-diff results component
  - Links controller and template

### Modified Files

#### Services
- **`app/assets/javascripts/services/queriesSvc.js`**
  - Added multiDiffResultsSvc dependency
  - Added `setMultiDiffSetting()` method
  - Integrated multi-diff creation in query lifecycle

- **`app/assets/javascripts/services/queryViewSvc.js`**
  - Added `enableMultiDiff()` and `isMultiDiffEnabled()` methods
  - Added multiDiffSettings state management
  - Updated reset functionality

#### Controllers
- **`app/assets/javascripts/components/diff/diff_controller.js`**
  - Added `promptMulti()` method for multi-snapshot modal
  - Added multiDiffResultsSvc dependency
  - Enhanced result handling for both single and multi-diff modes

- **`app/assets/javascripts/controllers/searchResults.js`**
  - Added multiDiffResultsSvc dependency
  - Added multi-diff view switching logic
  - Updated result view enumeration

#### Templates
- **`app/assets/javascripts/components/diff/diff.html`**
  - Converted to dropdown menu
  - Added "Multiple Snapshots" option

- **`app/assets/templates/views/searchResults.html`**
  - Added multi-diff results view section
  - Integrated QueryMultiDiffResultsCtrl

## Key Features

### Multi-Snapshot Selection
- Support for 2-3 snapshot comparisons
- Duplicate snapshot prevention
- Dynamic add/remove snapshot functionality
- Processing status checking

### Side-by-Side Comparison
- Current results vs multiple snapshots
- Position-based comparison
- Visual difference highlighting:
  - Yellow border: Different positions
  - Red border: Missing from snapshot
  - Green border: New in current results

### Export Functionality
- CSV export with position-based columns
- JSON export with structured metadata
- Suitable for external analysis tools

### Responsive Design
- Mobile-friendly layout
- Collapsible columns on small screens
- Optimized for various viewport sizes

## Technical Architecture

### Service Integration
```
multiDiffResultsSvc
├── Manages multiple snapshot settings
├── Creates searchers for each snapshot
├── Provides unified interface for multiple diffs
└── Maintains compatibility with existing diff system

queryViewSvc
├── Tracks multi-diff enabled state
├── Manages multi-diff settings
└── Coordinates with single diff functionality

queriesSvc
├── Integrates multi-diff into query lifecycle
├── Handles multi-diff creation for new queries
└── Manages scoring for multiple searchers
```

### Data Flow
1. User selects multiple snapshots via modal
2. multiDiffResultsSvc creates searchers for each snapshot
3. Each searcher executes search independently
4. Results are combined into document tuples
5. UI renders side-by-side comparison
6. Export functionality provides data extraction

### Performance Considerations
- Parallel snapshot search execution
- Lazy loading of comparison data
- Efficient document tuple generation
- Memory-conscious result caching

## Testing

### Unit Tests
- **`spec/javascripts/angular/services/multiDiffResultsSvc_spec.js`**
  - Comprehensive service testing
  - Edge case handling
  - Mock integration testing

### Integration Tests
- **`test/integration/multi_diff_integration_test.js`**
  - Browser console test runner
  - Service availability verification
  - UI component testing
  - End-to-end workflow validation

## Documentation
- **`docs/multi_snapshot_comparison.md`**
  - User guide and feature documentation
  - Best practices and troubleshooting
  - Technical architecture overview

## Usage Instructions

1. Navigate to query results page
2. Click "Compare snapshots" dropdown
3. Select "Multiple Snapshots"
4. Choose 2-3 different snapshots
5. Click "Update Comparison Settings"
6. View side-by-side comparison
7. Export results as needed

## Future Enhancement Opportunities

1. **Statistical Analysis**
   - Significance testing between snapshots
   - Trend analysis and visualization
   - Automated change detection

2. **Performance Optimization**
   - Caching strategies for frequently compared snapshots
   - Incremental loading for large result sets
   - Background processing for heavy comparisons

3. **UI/UX Improvements**
   - Drag-and-drop snapshot reordering
   - Collapsible/expandable result sections
   - Advanced filtering and sorting options

4. **Integration Enhancements**
   - API endpoints for programmatic access
   - Webhook notifications for significant changes
   - Integration with external analytics tools

## Compatibility

- Maintains full backward compatibility with single snapshot diffs
- No breaking changes to existing API
- Progressive enhancement approach
- Graceful degradation for older browsers

## Dependencies

- **Required Services**: querySnapshotSvc, snapshotSearcherSvc, diffResultsSvc
- **Framework**: AngularJS 1.x with UI Bootstrap components
- **Styling**: CSS Flexbox support for optimal layout
- **Browser Support**: Modern browsers with ES5+ JavaScript support

## Implementation Benefits

- **Simplified UX**: Single entry point eliminates user confusion
- **Progressive Disclosure**: Start simple, add complexity as needed  
- **Consistent Backend**: Unified modal logic reduces maintenance burden
- **Optimized Performance**: Smart routing uses appropriate display for selection count
- **Future-Proof**: Extensible architecture supports additional comparison features

This implementation provides a solid foundation for snapshot comparison functionality while improving usability and maintainability compared to the previous dual-interface approach.
# Multi-Snapshot Comparison Feature

The multi-snapshot comparison feature allows you to compare your current search results against 2-3 snapshots simultaneously, providing a comprehensive view of how your search performance has evolved across different points in time.

## Overview

This feature extends Quepid's existing single snapshot comparison functionality to support multiple snapshots at once. Instead of comparing against just one previous snapshot, you can now see how your current results stack up against multiple historical baselines.

## How to Use

### Accessing Multi-Snapshot Comparison

1. Navigate to your case's query results page
2. Look for the "Compare snapshots" dropdown in the query controls
3. Select "Multiple Snapshots" from the dropdown menu

### Setting Up Multi-Snapshot Comparison

1. In the comparison modal, select "Multiple Snapshots (select 2-3)"
2. Use the dropdown menus to select 2-3 different snapshots
3. Each snapshot must be unique - you cannot compare against the same snapshot multiple times
4. Click "Update Comparison Settings" to apply your selection

### Understanding the Multi-Snapshot View

The multi-snapshot view displays results in a side-by-side format:

- **Column 1**: Current search results
- **Columns 2-4**: Results from each selected snapshot (up to 3)

Each column shows:
- The snapshot name and identifier
- Search results at each position
- Document scores and metadata
- Visual indicators for differences

### Visual Indicators

The system automatically highlights differences between current and snapshot results:

- **Yellow border**: Document appears in different positions across snapshots
- **Red border**: Document is missing from a snapshot (was present before)  
- **Green border**: New document that wasn't in the snapshot

### Summary Statistics

At the bottom of the comparison view, you'll see summary statistics including:
- Total number of results for current search and each snapshot
- Overall scores for each comparison
- Export options for further analysis

## Export Functionality

You can export your multi-snapshot comparison data in two formats:

### CSV Export
Generates a spreadsheet-friendly format with columns for:
- Position in results
- Current result details (ID, title, URL, score)
- Each snapshot's result at that position

### JSON Export
Provides a structured data format including:
- Query information and timestamp
- Snapshot names and metadata
- Complete result data for programmatic analysis

## Technical Architecture

### Services

- **multiDiffResultsSvc**: Core service managing multiple snapshot comparisons
- **MultiDiffModalInstanceCtrl**: Controller for the snapshot selection modal
- **QueryMultiDiffResultsCtrl**: Controller for rendering comparison results

### Templates

- **_multi_modal.html**: Modal for selecting multiple snapshots
- **queryMultiDiffResults.html**: Main comparison view template

### Integration Points

The multi-diff functionality integrates with existing Quepid services:
- Uses existing `querySnapshotSvc` for snapshot management
- Leverages `snapshotSearcherSvc` for search execution
- Maintains compatibility with existing single-snapshot diff functionality

## Best Practices

### Snapshot Selection

- Choose snapshots from different time periods to see evolution over time
- Compare against key milestone snapshots (e.g., before/after major changes)
- Limit to 3 snapshots maximum to maintain readability

### Performance Considerations

- Multi-snapshot comparisons require more processing time
- Each additional snapshot increases query execution time
- Consider system load when running comparisons on large query sets

### Analysis Workflow

1. Start with single-snapshot comparisons to identify major changes
2. Use multi-snapshot view to understand trends across time
3. Export data for deeper statistical analysis if needed
4. Focus on queries showing significant variations across snapshots

## Troubleshooting

### Common Issues

**"Snapshot is currently being processed"**
- Wait for snapshot processing to complete before using in comparisons
- Check snapshot status in the snapshots management area

**"No valid snapshots found"**
- Ensure selected snapshots exist and are accessible
- Verify you have permission to access the selected snapshots

**Performance Issues**
- Reduce number of snapshots being compared
- Check if snapshots contain large result sets
- Consider running comparisons during off-peak hours

### Error Handling

The system gracefully handles various error conditions:
- Invalid or deleted snapshots are automatically excluded
- Network failures during snapshot loading are reported
- Partial data loading is supported (some snapshots may load while others fail)

## API Integration

For programmatic access to multi-snapshot comparison data, the export functionality provides structured data that can be consumed by external analysis tools.

The JSON export format is particularly suitable for:
- Statistical analysis tools (R, Python pandas)
- Business intelligence dashboards
- Custom reporting solutions
- Integration with other search analytics platforms

## Future Enhancements

Planned improvements include:
- Statistical significance testing between snapshots
- Trend analysis and visualization
- Automated alerting for significant changes
- Integration with A/B testing frameworks

---

For technical implementation details, see the source code in:
- `app/assets/javascripts/services/multiDiffResultsSvc.js`
- `app/assets/javascripts/components/diff/`
- `app/assets/javascripts/controllers/queryMultiDiffResults.js`

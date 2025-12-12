# Snapshot Comparison Feature

The unified snapshot comparison feature allows you to compare your current search results against 1-3 snapshots through a single, streamlined interface, providing a comprehensive view of how your search performance has evolved across different points in time.

## Overview

This feature replaces the old separate single and multiple snapshot comparison interfaces with a unified system. You can now easily compare against one snapshot for simple comparisons or select multiple snapshots for more comprehensive analysis, all through the same intuitive interface.

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

### Understanding the Comparison Views

The system automatically chooses the best display format based on your selection:

**Single Snapshot (1 selected):** Classic two-column side-by-side view
- **Column 1**: Current search results  
- **Column 2**: Selected snapshot results

**Multiple Snapshots (2-3 selected):** Multi-column comparison view
- **Column 1**: Current search results
- **Columns 2-4**: Results from each selected snapshot

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

## Technical Architecture

### Services

- **multiDiffResultsSvc**: Core service managing snapshot comparisons (both single and multiple)
- **DiffModalInstanceCtrl**: Unified controller for all snapshot selection
- **QueryMultiDiffResultsCtrl**: Controller for rendering multi-snapshot comparison results
- **diffResultsSvc**: Legacy service for single snapshot comparisons (still used internally)

### Templates

- **_modal.html**: Unified modal for selecting 1-3 snapshots
- **queryMultiDiffResults.html**: Multi-snapshot comparison view template
- **queryMultiDiffResults.html**: Unified comparison view template (handles both single and multiple snapshots)

### Integration Points

The unified snapshot functionality integrates with existing Quepid services:
- Uses existing `querySnapshotSvc` for snapshot management
- Leverages `snapshotSearcherSvc` for search execution
- Uses unified multi-diff display for both single and multiple snapshot comparisons

## Best Practices

### Snapshot Selection

- **Start Simple:** Begin with 1 snapshot for basic before/after comparisons
- **Add Gradually:** Add more snapshots (up to 3 total) for trend analysis
- **Choose Strategically:** Select snapshots from different time periods or key milestones
- **Maintain Clarity:** Limit to 3 snapshots maximum to keep results readable

### Performance Considerations

- **Single snapshots:** Fast, streamlined performance using unified interface
- **Multiple snapshots:** Require more processing time per additional snapshot
- **System load:** Consider server capacity when running multi-snapshot comparisons on large query sets
- **Progressive selection:** Start with fewer snapshots and add more as needed

### Analysis Workflow

1. **Quick Checks:** Use single snapshot comparisons for fast before/after analysis
2. **Trend Analysis:** Add additional snapshots to understand changes over time
3. **Deep Dive:** Export multi-snapshot data for statistical analysis (when using 2+ snapshots)
4. **Focus Areas:** Identify queries with significant variations across snapshots for further investigation

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

For programmatic access to multi-snapshot comparison data, you can use Quepid's API endpoints to retrieve structured data that can be consumed by external analysis tools.

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

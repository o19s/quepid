# Screenshot Automation for Core Case Evaluation Manual

This document describes how to automatically capture the screenshots referenced in
[`core_case_evaluation_manual.md`](core_case_evaluation_manual.md) using Playwright.

## Decision Process

### Why Playwright?

We evaluated three approaches for capturing the 16 screenshots specified in
[`core_case_evaluation_manual_screenshots.md`](core_case_evaluation_manual_screenshots.md):

| Approach | Pros | Cons |
|----------|------|------|
| **Manual (browser DevTools)** | No tooling needed | Tedious, hard to reproduce, inconsistent sizing |
| **Capybara + Selenium** (existing in `test/system/`) | Already in project, runs in Docker | Screenshot API is limited (no element clips, no easy modal targeting); tied to test framework |
| **Playwright** | Built-in `screenshot()` with element targeting and clip regions; `waitForSelector` for modals/popovers; runs standalone against the dev server | Requires Node + Playwright install (already present via `package.json`) |

**Decision:** Playwright. It offers the most control over capturing specific UI states
(dropdowns open, modals visible, popovers active, east pane tabs selected) and produces
consistent, reproducible screenshots.

### Sample Data

The screenshots require a populated Quepid instance. We use the existing Thor task:

```bash
bin/docker r bundle exec thor sample_data
```

This creates the **"User with Realistic Activity in Quepid"** account
(`quepid+realisticactivity@o19s.com` / `password`) with:

- Multiple cases (SOLR, ES, SearchAPI, "10s of Queries", Typeahead variants)
- 20+ queries with ratings in the "10s of Queries" case
- 30 tries with score history (sparkline data)
- Team membership (OSC team)
- A "Book of Ratings" with judgements
- Multiple search endpoints (Solr, ES, SearchAPI)

This user is an admin, so all UI elements (including admin-only features) are visible.

### Search Endpoint Availability

The sample data points to external Solr/ES endpoints at `quepid-solr.dev.o19s.com` and
`quepid-elasticsearch.dev.o19s.com`. If these are unreachable, queries will show errors
instead of results. For screenshots that need actual search results (05, 06), you may need
to either:

1. Ensure the external endpoints are reachable, or
2. Create a local Solr/ES instance and update the search endpoints, or
3. Use the "Static" endpoint type with pre-loaded data.

Screenshots of UI chrome (header, modals, actions bar, east pane) work regardless of
endpoint availability.

## Prerequisites

1. **Docker environment running:**
   ```bash
   bin/docker s
   ```

2. **Sample data loaded:**
   ```bash
   bin/docker r bundle exec thor sample_data
   ```

3. **Playwright installed** (already in `package.json`):
   ```bash
   yarn install
   npx playwright install chromium
   ```

## Running the Screenshot Script

```bash
node docs/scripts/capture_screenshots.js
```

The script will:
1. Launch a Chromium browser (headed or headless depending on `HEADED` env var)
2. Log in as the realistic activity user
3. Navigate to the "10s of Queries" case (the most populated case)
4. Capture each screenshot by manipulating the UI into the required state
5. Save PNGs to `docs/images/core_case_evaluation_manual/`

### Options

| Env Variable | Default | Description |
|-------------|---------|-------------|
| `HEADED` | `false` | Set to `true` to watch the browser |
| `BASE_URL` | `http://localhost:3000` | Quepid base URL |
| `SCREENSHOT_DIR` | `docs/images/core_case_evaluation_manual` | Output directory |

Example:
```bash
HEADED=true BASE_URL=http://localhost:3000 node docs/scripts/capture_screenshots.js
```

## Screenshot Inventory

See [`core_case_evaluation_manual_screenshots.md`](core_case_evaluation_manual_screenshots.md)
for the full specification. The script captures:

| # | Filename | UI State Required |
|---|----------|-------------------|
| 1 | `01_full_layout.png` | Main view, east pane closed |
| 2 | `02_header_relevancy_cases.png` | Relevancy Cases dropdown open |
| 3 | `03_case_header_and_actions.png` | Case header + actions bar (clipped) |
| 4 | `04_query_list_controls.png` | Query list with controls visible |
| 5 | `05_query_expanded.png` | One query row expanded with results |
| 6 | `06_rating_popover.png` | Rating popover open on a result |
| 7 | `07_east_pane_query_tab.png` | East pane open, Query tab selected |
| 8 | `08_east_pane_tuning_knobs.png` | East pane, Tuning Knobs tab |
| 9 | `09_east_pane_settings.png` | East pane, Settings tab |
| 10 | `10_east_pane_history.png` | East pane, History tab |
| 11 | `11_east_pane_annotations.png` | East pane, Annotations tab |
| 12 | `12_snapshot_modal.png` | Create Snapshot modal open |
| 13 | `13_diff_modal.png` | Diff/Compare modal open |
| 14 | `14_select_scorer_modal.png` | Select Scorer modal open |
| 15 | `15_delete_options_modal.png` | Delete Case options modal open |
| 16 | `16_loading_bootstrapping.png` | Loading/bootstrapping state (optional) |

## Wizard Screenshots

A second script walks through the **case creation wizard** and captures each step:

```bash
node docs/scripts/capture_wizard_screenshots.js
```

This script:
1. Creates a fresh user (or resets `screenshots@example.com`) so the wizard triggers
2. Walks through all 6 wizard steps using the TMDB Solr demo endpoint
3. Captures screenshots at each step
4. Then re-captures the main screenshots (01-16) for consistency

| Filename | Wizard Step |
|----------|-------------|
| `wizard_01_welcome.png` | Welcome/home page (Rails) — "Create Your First Relevancy Case" |
| `wizard_02_doug_welcome.png` | Step 1: Doug's welcome message |
| `wizard_03_name_case.png` | Step 2: Name Your Case |
| `wizard_04_search_endpoint.png` | Step 3: Accordion (collapsed) |
| `wizard_04b_engine_selection.png` | Step 3: Engine selection (Solr, ES, OpenSearch, etc.) with demo URL |
| `wizard_05_display_fields.png` | Step 4: Title, ID, and additional display fields |
| `wizard_06_add_queries.png` | Step 5: Add search queries |
| `wizard_07_finish.png` | Step 6: Finish |

**Note:** The wizard auto-detects the TMDB demo settings when the Solr demo URL is used,
pre-populating field specs and query parameters. The TMDB demo endpoints at
`quepid-solr.dev.o19s.com` must be reachable for screenshots 05 (expanded results) and
06 (rating popover) to show actual search results.

### Resetting the wizard user

Before re-running the wizard script, reset the user:

```bash
bin/docker r bundle exec rails runner tmp/reset_screenshot_user.rb
```

## Updating Screenshots

When the UI changes, re-run the script to regenerate all screenshots:

```bash
node docs/scripts/capture_screenshots.js
```

If only specific screenshots need updating, comment out the others in the script or
add a filter (e.g., pass screenshot numbers as arguments).

## Troubleshooting

- **Login fails:** Ensure sample data has been loaded (`thor sample_data`).
- **Blank/loading screenshots:** Increase wait times in the script; AngularJS may need
  more time to bootstrap on slower machines.
- **Missing search results:** The external Solr/ES endpoints may be unreachable. Check
  network connectivity or use a local search engine.
- **Modal not appearing:** AngularJS modals use `uib-modal`; ensure the click target
  selector is correct and the animation has completed.

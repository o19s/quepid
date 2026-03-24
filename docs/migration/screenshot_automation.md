# Screenshot Automation for Core Case Evaluation Manual

This document describes how to automatically capture the screenshots referenced in
[`core_case_evaluation_manual.md`](core_case_evaluation_manual.md) using Playwright.

**UI stack:** The core case screen mixes the legacy **AngularJS** workspace with a migrating **Rails + Stimulus** shell (`core_new_ui`, `app/views/core/*`). Selectors in the scripts target both; refresh captures when either side changes.

**Migration context:** Parity work is guided by [angularjs_elimination_plan.md](./angularjs_elimination_plan.md). Broader **Angular vs migrated slice** comparison uses `test/visual_parity/` (Playwright + HTML report); see [deangularjs_experimental_review.md](./deangularjs_experimental_review.md) and [`test/visual_parity/run_comparison.sh`](../../test/visual_parity/run_comparison.sh).

**Related:** Output assets and stable filenames are summarized in [`docs/images/core_case_evaluation_manual/README.md`](../images/core_case_evaluation_manual/README.md).

## Decision Process

### Why Playwright?

We evaluated three approaches for capturing the 16 screenshots specified in
[`core_case_evaluation_manual_screenshots.md`](core_case_evaluation_manual_screenshots.md):

| Approach | Pros | Cons |
|----------|------|------|
| **Manual (browser DevTools)** | No tooling needed | Tedious, hard to reproduce, inconsistent sizing |
| **Capybara + Selenium** (existing in `test/system/`) | Already in project, runs in Docker | Screenshot API is limited (no element clips, no easy modal targeting); tied to test framework |
| **Playwright** | Built-in `screenshot()` with element targeting and clip regions; `waitForSelector` for modals/popovers; runs standalone against the dev server | Requires Node + Playwright browser install (see `package.json` devDependencies) |

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

1. **Node:** `package.json` requires **Node 20+** (`engines.node`).

2. **Docker environment running (Rails app):**
   ```bash
   bin/docker s
   ```

3. **Sample data loaded:**
   ```bash
   bin/docker r bundle exec thor sample_data
   ```

4. **JavaScript dependencies and Chromium for Playwright:**
   ```bash
   bin/docker r yarn install
   npx playwright install chromium
   ```
   The repo declares `@playwright/test` and `playwright-core` in `package.json`; the `playwright` package is available via the lockfile for scripts that `require('playwright')`. The capture scripts fall back to `playwright-core` if needed.

## Running the main script (`capture_screenshots.js`)

From the repository root (host Node is typical for Playwright driving `localhost:3000`):

```bash
node docs/scripts/capture_screenshots.js
```

The script will:
1. Launch Chromium (headed or headless depending on `HEADED`)
2. Log in as the realistic activity user
3. Navigate to the "10s of Queries" case (the most populated case)
4. Capture each screenshot by manipulating the UI into the required state
5. Save PNGs to `docs/images/core_case_evaluation_manual/` (see **Part A** in the screenshot guide)

`capture_screenshots.js` uses a **2× device scale** for sharper PNGs (`deviceScaleFactor: 2`).

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

## Supplemental capture scripts (`docs/scripts/`)

Besides the main 01–16 flow, the repo keeps **additional Node scripts** for extended figures (Part B), one-off fixes, and inventory gaps. All use the same env conventions (`BASE_URL`, `SCREENSHOT_DIR`, `HEADED`) unless noted.

| Script | Purpose |
|--------|---------|
| [`capture_gap_screenshots.js`](../scripts/capture_gap_screenshots.js) | Gap analysis figures (e.g. annotations list, pagination, Vega, query diff) described in [angularjs_ui_inventory.md](./angularjs_ui_inventory.md) |
| [`capture_remaining.js`](../scripts/capture_remaining.js) | Announcements, teams, scorers, archive confirm, home dashboard, query diff, etc. |
| [`capture_remaining2.js`](../scripts/capture_remaining2.js) | Teams detail, scorer edit, announcement banner, query diff variants |
| [`capture_remaining3.js`](../scripts/capture_remaining3.js) | Further modal / admin-adjacent captures |
| [`capture_remaining4.js`](../scripts/capture_remaining4.js) | Scorer form / compare snapshots / query diff follow-ups |
| [`capture_fixes.js`](../scripts/capture_fixes.js) | Footer, custom headers, settings accordions, healthcheck |

Run any of them the same way: `node docs/scripts/<name>.js`.

## Visual parity tooling (`test/visual_parity/`)

Separate from the manual asset pipeline, **visual parity** captures many labeled pages for **branch or UI variant comparison** (screenshots + API shape diff + HTML report). Entry point:

```bash
./test/visual_parity/run_comparison.sh --help
```

Captures use ES modules: [`test/visual_parity/capture_screenshots.mjs`](../../test/visual_parity/capture_screenshots.mjs) (imports `chromium` from `@playwright/test`). Output goes under `test/visual_parity/screenshots/` (not `docs/images/`). See comments in `run_comparison.sh` for `PLAYWRIGHT_BROWSERS_PATH` and Docker prerequisites.

## Screenshot Inventory

See [`core_case_evaluation_manual_screenshots.md`](core_case_evaluation_manual_screenshots.md)
for the full specification. The main script captures **Part A** (core figures):

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
| 13 | `13_diff_modal.png` | Compare snapshots modal open |
| 14 | `14_select_scorer_modal.png` | Select Scorer modal open |
| 15 | `15_delete_options_modal.png` | Delete Case options modal open |
| 16 | `16_loading_bootstrapping.png` | Loading/bootstrapping state (optional) |

**Part B** and additional filenames (`17`–`80`, wizard shots, etc.) are listed in the same guide and [`docs/images/core_case_evaluation_manual/README.md`](../images/core_case_evaluation_manual/README.md).

## Wizard Screenshots

[`docs/scripts/capture_wizard_screenshots.js`](../scripts/capture_wizard_screenshots.js) walks through the **case creation wizard** (TMDB Solr demo), then recaptures key figures (including 01 and search-dependent shots) using that case’s results.

```bash
node docs/scripts/capture_wizard_screenshots.js
```

This script:
1. Logs in as `screenshots@example.com` / `password` (expects a **fresh** wizard experience; see below)
2. Walks through wizard steps using the TMDB Solr demo endpoint
3. Captures wizard step PNGs and additional states (on success, `wizard_04b_endpoint_validated.png`; otherwise `wizard_04b_endpoint_result.png` may be produced)
4. Recaptures main screenshots (e.g. 01, 05, 06) with TMDB-backed results where possible

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
`quepid-solr.dev.o19s.com` must be reachable for screenshots that show actual search results.

### Resetting the wizard user

The wizard script expects `screenshots@example.com` to behave like a **new user** (welcome + wizard). If that user already completed the wizard, delete the user and re-run, or create a different test user in Thor and change `WIZARD_EMAIL` / `WIZARD_PASSWORD` in the script.

Example (destroys the user so the next run can sign up again):

```bash
bin/docker r bundle exec rails runner "User.find_by(email: 'screenshots@example.com')&.destroy"
```

## Updating Screenshots

When the UI changes, re-run the appropriate script(s) to regenerate PNGs:

```bash
node docs/scripts/capture_screenshots.js
```

If only specific screenshots need updating, comment out the others in the script or
adjust the flow manually—most scripts do not expose CLI filters (the visual parity `capture_screenshots.mjs` supports `--only` / `--exclude`; see its header comment).

## Troubleshooting

- **Login fails:** Ensure sample data has been loaded (`bin/docker r bundle exec thor sample_data`).
- **Blank/loading screenshots:** Increase wait times in the script; the Angular workspace and/or Stimulus-driven shell may need more time on slower machines or cold caches.
- **Missing search results:** The external Solr/ES endpoints may be unreachable. Check
  network connectivity or use a local search engine.
- **Modal not appearing:** Modals may be **Angular UI Bootstrap** (`uib-modal`, `.modal.in`) or **Bootstrap 5** (`.modal.show`). Confirm selectors in the script match the current markup and that animations have finished.
- **Playwright cannot find Chromium:** Run `npx playwright install chromium` from the repo root; if browsers are stored in a custom location, set `PLAYWRIGHT_BROWSERS_PATH` (see `test/visual_parity/run_comparison.sh`).

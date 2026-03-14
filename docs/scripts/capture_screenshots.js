/**
 * Screenshot Automation for Core Case Evaluation Manual
 *
 * Captures the 16 screenshots specified in:
 *   docs/core_case_evaluation_manual_screenshots.md
 *
 * Usage:
 *   node docs/scripts/capture_screenshots.js
 *
 * Environment variables:
 *   HEADED=true        - Run with visible browser window
 *   BASE_URL=http://…  - Quepid URL (default: http://localhost:3000)
 *   SCREENSHOT_DIR=…   - Output directory (default: docs/images/core_case_evaluation_manual)
 *
 * Prerequisites:
 *   - Docker running with `bin/docker s`
 *   - Sample data loaded with `bin/docker r bundle exec thor sample_data`
 *   - `npx playwright install chromium`
 */

// Try multiple locations for playwright
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  try {
    ({ chromium } = require('playwright-core'));
  } catch {
    console.error('Playwright not found. Install with: yarn add --dev playwright');
    console.error('Or: npm install playwright-core');
    process.exit(1);
  }
}
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const HEADED = process.env.HEADED === 'true';
const SCREENSHOT_DIR = path.resolve(
  process.env.SCREENSHOT_DIR || 'docs/images/core_case_evaluation_manual'
);

// Login credentials for the realistic activity user (from sample_data.thor)
const LOGIN_EMAIL = 'quepid+realisticactivity@o19s.com';
const LOGIN_PASSWORD = 'password';

// Helper: wait for AngularJS to finish digest cycles
async function waitForAngular(page, timeout = 15000) {
  try {
    await page.waitForFunction(() => {
      const el = document.querySelector('[ng-app]') || document.querySelector('body');
      if (!window.angular) return true;
      const injector = window.angular.element(el).injector();
      if (!injector) return true;
      const $http = injector.get('$http');
      const $rootScope = injector.get('$rootScope');
      return $http.pendingRequests.length === 0 && !$rootScope.$$phase;
    }, { timeout });
  } catch {
    // Timeout is OK — best effort wait for Angular
  }
}

// Helper: short pause for animations/transitions
function pause(ms = 500) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper: save screenshot with logging
async function screenshot(page, filename, options = {}) {
  const filepath = path.join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: filepath, ...options });
  console.log(`  ✓ ${filename}`);
}

// Helper: screenshot of a specific element
async function screenshotElement(page, selector, filename) {
  const el = page.locator(selector).first();
  await el.waitFor({ state: 'visible', timeout: 10000 });
  const filepath = path.join(SCREENSHOT_DIR, filename);
  await el.screenshot({ path: filepath });
  console.log(`  ✓ ${filename}`);
}

// Helper: close any open modal
async function closeModal(page) {
  // Try multiple approaches to close the modal
  // 1. Click cancel/close button
  for (const selector of [
    '.modal.in .modal-footer .btn-default',
    '.modal.in .btn-core-close',
    '.modal.in .modal-header button.close',
    '.modal.in button:has-text("Cancel")',
  ]) {
    try {
      const btn = page.locator(selector).first();
      if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
        await btn.click();
        await pause(800);
        // Check if modal is gone
        const modalStillOpen = await page.locator('.modal.in').isVisible({ timeout: 500 }).catch(() => false);
        if (!modalStillOpen) return;
      }
    } catch { /* try next */ }
  }
  // 2. Press Escape
  await page.keyboard.press('Escape');
  await pause(800);
  // 3. Click the modal backdrop
  try {
    const backdrop = page.locator('.modal-backdrop');
    if (await backdrop.isVisible({ timeout: 500 }).catch(() => false)) {
      await backdrop.click({ force: true });
      await pause(500);
    }
  } catch { /* ignore */ }
}

// Helper: close east pane if open
async function closeEastPane(page) {
  const eastPane = page.locator('.pane_east');
  try {
    const isVisible = await eastPane.isVisible({ timeout: 1000 });
    if (isVisible) {
      const box = await eastPane.boundingBox();
      if (box && box.width > 10) {
        await page.locator('#tune-relevance-link a, a:has-text("Tune Relevance")').first().click();
        await pause(500);
      }
    }
  } catch {
    // East pane not visible, that's fine
  }
}

// Helper: open east pane if closed
async function openEastPane(page) {
  // Check if east pane tabs are already visible
  const tabArea = page.locator('#queryParamsArea');
  try {
    const isVisible = await tabArea.isVisible({ timeout: 1000 });
    if (isVisible) {
      return; // Already open
    }
  } catch {
    // Not visible
  }
  await page.locator('a:has-text("Tune Relevance")').first().click();
  await pause(1500);
  await waitForAngular(page);
}

// East pane tab IDs (from devQueryParams.html)
const EAST_PANE_TABS = {
  'Query':       '#developerTab',
  'Knobs':       '#curatorTab',
  'Settings':    '#engineTab',
  'History':     '#historyTab',
  'Annotations': '#annotationsTab',
};

// Helper: click an east pane tab by name
async function clickEastPaneTab(page, tabName) {
  await openEastPane(page);
  const tabId = EAST_PANE_TABS[tabName];
  if (tabId) {
    await page.locator(tabId).click();
  } else {
    // Fallback: try text match on nav-tabs li
    await page.locator(`#queryParamsArea .nav-tabs li:has-text("${tabName}")`).first().click();
  }
  await pause(800);
  await waitForAngular(page);
}

async function main() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  console.log('Launching browser...');
  const browser = await chromium.launch({
    headless: !HEADED,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,  // Retina-quality screenshots
  });

  const page = await context.newPage();

  // ─────────────────────────────────────────────
  // LOGIN
  // ─────────────────────────────────────────────
  console.log('Logging in...');
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');

  // Fill login form
  await page.locator('#login input.email').fill(LOGIN_EMAIL);
  await page.locator('#login input.password').fill(LOGIN_PASSWORD);
  await page.locator('#login input.login').click();

  // Wait for redirect to the main app
  await page.waitForURL(/\/case\//, { timeout: 30000 }).catch(() => {
    // May redirect to cases list instead
  });
  await page.waitForLoadState('networkidle');
  await pause(2000);

  // Navigate to the "10s of Queries" case (most populated)
  // First, find it via the cases list
  console.log('Navigating to the populated case...');

  // Try to find the case via the Relevancy Cases dropdown
  await page.goto(BASE_URL + '/cases');
  await page.waitForLoadState('networkidle');
  await pause(1000);

  // Click on "10s of Queries" case link
  const caseLink = page.locator('a:has-text("10s of Queries")').first();
  if (await caseLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    await caseLink.click();
  } else {
    // Fallback: just use whatever case we're on
    console.log('  Could not find "10s of Queries" case, using current case');
    await page.goto(BASE_URL);
  }

  await page.waitForLoadState('networkidle');
  await pause(3000);
  await waitForAngular(page);

  // Wait for queries to load
  await page.waitForSelector('.results-list-element, #query-container', { timeout: 30000 }).catch(() => {
    console.log('  Warning: query list did not appear in time');
  });
  await pause(2000);

  // ─────────────────────────────────────────────
  // SCREENSHOT 1: Full layout (east pane closed)
  // ─────────────────────────────────────────────
  console.log('Capturing screenshots...');

  await closeEastPane(page);
  await pause(500);
  await screenshot(page, '01_full_layout.png', { fullPage: false });

  // ─────────────────────────────────────────────
  // SCREENSHOT 2: Header with Relevancy Cases dropdown open
  // ─────────────────────────────────────────────
  // Click the Relevancy Cases dropdown toggle
  const casesDropdown = page.locator('a.dropdown-toggle:has-text("Relevancy Cases"), a:has(.nav-label:has-text("Relevancy Cases"))').first();
  await casesDropdown.click();
  await pause(800);
  await screenshot(page, '02_header_relevancy_cases.png', { fullPage: false });

  // Close dropdown by pressing Escape
  await page.keyboard.press('Escape');
  await pause(500);
  // Click the dropdown again to toggle it closed if still open
  try {
    const dropdownOpen = page.locator('.dropdown.open, .dropdown.show').first();
    if (await dropdownOpen.isVisible({ timeout: 500 }).catch(() => false)) {
      await casesDropdown.click();
      await pause(300);
    }
  } catch { /* already closed */ }

  // ─────────────────────────────────────────────
  // SCREENSHOT 3: Case header and case actions bar
  // ─────────────────────────────────────────────
  try {
    // Capture just the case header + actions area
    const caseHeader = page.locator('#case-header').first();
    const caseActions = page.locator('#case-actions').first();

    const headerBox = await caseHeader.boundingBox();
    const actionsBox = await caseActions.boundingBox();

    if (headerBox && actionsBox) {
      const clipY = headerBox.y;
      const clipHeight = (actionsBox.y + actionsBox.height) - headerBox.y + 10;
      await screenshot(page, '03_case_header_and_actions.png', {
        clip: { x: 0, y: clipY, width: 1440, height: clipHeight },
      });
    } else {
      await screenshot(page, '03_case_header_and_actions.png');
    }
  } catch {
    await screenshot(page, '03_case_header_and_actions.png');
  }

  // ─────────────────────────────────────────────
  // SCREENSHOT 4: Query list with controls (collapsed rows)
  // ─────────────────────────────────────────────
  // First collapse all queries
  const collapseAll = page.locator('a:has-text("Collapse all"), button:has-text("Collapse all")').first();
  if (await collapseAll.isVisible({ timeout: 2000 }).catch(() => false)) {
    await collapseAll.click();
    await pause(500);
  }

  try {
    await screenshotElement(page, '#query-container, .results', '04_query_list_controls.png');
  } catch {
    await screenshot(page, '04_query_list_controls.png');
  }

  // ─────────────────────────────────────────────
  // SCREENSHOT 5: Expanded query with results and toolbar
  // ─────────────────────────────────────────────
  // Click first query row to expand it
  const firstQueryHeader = page.locator('.result-header').first();
  if (await firstQueryHeader.isVisible({ timeout: 3000 }).catch(() => false)) {
    await firstQueryHeader.click();
    await pause(2000);
    await waitForAngular(page);
  }

  // Screenshot the expanded query area
  try {
    // Find the first expanded query's sub-results
    const expandedQuery = page.locator('.sub-results:visible').first();
    if (await expandedQuery.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Get bounding box of the query header + expanded content
      const queryRow = expandedQuery.locator('..').first();
      await screenshotElement(page, 'search-results:has(.sub-results:visible)', '05_query_expanded.png');
    } else {
      await screenshot(page, '05_query_expanded.png');
    }
  } catch {
    await screenshot(page, '05_query_expanded.png');
  }

  // ─────────────────────────────────────────────
  // SCREENSHOT 6: Rating popover
  // ─────────────────────────────────────────────
  // Click a rating button on one of the search results to open the popover
  const ratingBtn = page.locator('.col-ratings .single-rating .btn, .col-ratings .btn').first();
  if (await ratingBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await ratingBtn.click();
    await pause(800);

    // Wait for popover to appear
    await page.waitForSelector('.ratingContainer, .popover', { timeout: 5000 }).catch(() => {});

    // Take a focused screenshot around the rating area
    try {
      const popover = page.locator('.popover:visible, .ratingContainer:visible').first();
      const popoverBox = await popover.boundingBox();
      const ratingBox = await ratingBtn.boundingBox();

      if (popoverBox && ratingBox) {
        const clipX = Math.max(0, ratingBox.x - 50);
        const clipY = Math.max(0, Math.min(ratingBox.y, popoverBox.y) - 30);
        const clipWidth = Math.max(popoverBox.x + popoverBox.width, ratingBox.x + ratingBox.width) - clipX + 80;
        const clipHeight = Math.max(popoverBox.y + popoverBox.height, ratingBox.y + ratingBox.height) - clipY + 50;
        await screenshot(page, '06_rating_popover.png', {
          clip: { x: clipX, y: clipY, width: clipWidth, height: clipHeight },
        });
      } else {
        await screenshot(page, '06_rating_popover.png');
      }
    } catch {
      await screenshot(page, '06_rating_popover.png');
    }

    // Close popover by clicking elsewhere
    await page.locator('body').click({ position: { x: 700, y: 100 } });
    await pause(300);
  } else {
    console.log('  ⚠ Could not find rating button for screenshot 06');
    await screenshot(page, '06_rating_popover.png');
  }

  // ─────────────────────────────────────────────
  // SCREENSHOT 7: East pane - Query tab (Query Sandbox)
  // ─────────────────────────────────────────────
  await clickEastPaneTab(page, 'Query');
  await pause(500);
  try {
    await screenshotElement(page, '.pane_east', '07_east_pane_query_tab.png');
  } catch {
    await screenshot(page, '07_east_pane_query_tab.png');
  }

  // ─────────────────────────────────────────────
  // SCREENSHOT 8: East pane - Tuning Knobs tab
  // ─────────────────────────────────────────────
  await clickEastPaneTab(page, 'Knobs');
  await pause(500);
  try {
    await screenshotElement(page, '.pane_east', '08_east_pane_tuning_knobs.png');
  } catch {
    await screenshot(page, '08_east_pane_tuning_knobs.png');
  }

  // ─────────────────────────────────────────────
  // SCREENSHOT 9: East pane - Settings tab
  // ─────────────────────────────────────────────
  await clickEastPaneTab(page, 'Settings');
  await pause(500);
  try {
    await screenshotElement(page, '.pane_east', '09_east_pane_settings.png');
  } catch {
    await screenshot(page, '09_east_pane_settings.png');
  }

  // ─────────────────────────────────────────────
  // SCREENSHOT 10: East pane - History tab
  // ─────────────────────────────────────────────
  await clickEastPaneTab(page, 'History');
  await pause(500);
  try {
    await screenshotElement(page, '.pane_east', '10_east_pane_history.png');
  } catch {
    await screenshot(page, '10_east_pane_history.png');
  }

  // ─────────────────────────────────────────────
  // SCREENSHOT 11: East pane - Annotations tab
  // ─────────────────────────────────────────────
  await clickEastPaneTab(page, 'Annotations');
  await pause(500);
  try {
    await screenshotElement(page, '.pane_east', '11_east_pane_annotations.png');
  } catch {
    await screenshot(page, '11_east_pane_annotations.png');
  }

  // Close east pane for the modal screenshots
  await closeEastPane(page);
  await pause(300);

  // ─────────────────────────────────────────────
  // SCREENSHOT 12: Create snapshot modal
  // ─────────────────────────────────────────────
  const snapshotLink = page.locator('a:has-text("Create snapshot")').first();
  if (await snapshotLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    await snapshotLink.click();
    await pause(1000);
    await page.waitForSelector('.modal.in, .modal.show', { timeout: 5000 }).catch(() => {});

    try {
      await screenshotElement(page, '.modal.in .modal-content, .modal.show .modal-content', '12_snapshot_modal.png');
    } catch {
      await screenshot(page, '12_snapshot_modal.png');
    }

    await closeModal(page);
  } else {
    console.log('  ⚠ Could not find "Create snapshot" link for screenshot 12');
  }

  // ─────────────────────────────────────────────
  // SCREENSHOT 13: Diff modal
  // ─────────────────────────────────────────────
  const diffLink = page.locator('a:has-text("Compare snapshots"), a:has-text("Diff")').first();
  if (await diffLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    await diffLink.click();
    await pause(1000);
    await page.waitForSelector('.modal.in, .modal.show', { timeout: 5000 }).catch(() => {});

    try {
      await screenshotElement(page, '.modal.in .modal-content, .modal.show .modal-content', '13_diff_modal.png');
    } catch {
      await screenshot(page, '13_diff_modal.png');
    }

    await closeModal(page);
  } else {
    console.log('  ⚠ Could not find "Diff" link for screenshot 13');
  }

  // ─────────────────────────────────────────────
  // SCREENSHOT 14: Select scorer modal
  // ─────────────────────────────────────────────
  const scorerLink = page.locator('a:has-text("Select scorer")').first();
  if (await scorerLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    await scorerLink.click();
    await pause(1000);
    await page.waitForSelector('.modal.in, .modal.show', { timeout: 5000 }).catch(() => {});

    try {
      await screenshotElement(page, '.modal.in .modal-content, .modal.show .modal-content', '14_select_scorer_modal.png');
    } catch {
      await screenshot(page, '14_select_scorer_modal.png');
    }

    await closeModal(page);
  } else {
    console.log('  ⚠ Could not find "Select scorer" link for screenshot 14');
  }

  // ─────────────────────────────────────────────
  // SCREENSHOT 15: Delete case options modal
  // ─────────────────────────────────────────────
  const deleteLink = page.locator('a:has-text("Delete"), delete-case-options a').first();
  if (await deleteLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    await deleteLink.click();
    await pause(1000);
    await page.waitForSelector('.modal.in, .modal.show', { timeout: 5000 }).catch(() => {});

    try {
      await screenshotElement(page, '.modal.in .modal-content, .modal.show .modal-content', '15_delete_options_modal.png');
    } catch {
      await screenshot(page, '15_delete_options_modal.png');
    }

    await closeModal(page);
  } else {
    console.log('  ⚠ Could not find "Delete" link for screenshot 15');
  }

  // ─────────────────────────────────────────────
  // SCREENSHOT 16: Loading/bootstrapping (optional)
  // ─────────────────────────────────────────────
  // This one is tricky - we need to catch the loading state.
  // Navigate to the case URL again and capture quickly before queries resolve.
  console.log('  Attempting loading state capture (screenshot 16)...');
  const currentUrl = page.url();
  await page.goto(currentUrl);
  // Capture immediately during load
  await pause(200);
  await screenshot(page, '16_loading_bootstrapping.png');
  // Wait for page to fully load again
  await page.waitForLoadState('networkidle');
  await pause(2000);

  // ─────────────────────────────────────────────
  // DONE
  // ─────────────────────────────────────────────
  console.log('\nDone! Screenshots saved to: ' + SCREENSHOT_DIR);

  await browser.close();
}

main().catch(err => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});

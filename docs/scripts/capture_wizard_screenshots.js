/**
 * Wizard Walkthrough & Improved Screenshots
 *
 * Walks through the case creation wizard using the TMDB Solr demo,
 * then recaptures screenshots that need actual search results (05, 06).
 *
 * Usage:
 *   node docs/scripts/capture_wizard_screenshots.js
 */

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  try {
    ({ chromium } = require('playwright-core'));
  } catch {
    ({ chromium } = require('/tmp/pw-install/node_modules/playwright-core'));
  }
}
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const HEADED = process.env.HEADED === 'true';
const SCREENSHOT_DIR = path.resolve(
  process.env.SCREENSHOT_DIR || 'docs/images/core_case_evaluation_manual'
);

const WIZARD_EMAIL = 'screenshots@example.com';
const WIZARD_PASSWORD = 'password';
const MAIN_EMAIL = 'quepid+realisticactivity@o19s.com';
const MAIN_PASSWORD = 'password';

function pause(ms = 500) {
  return new Promise(r => setTimeout(r, ms));
}

async function waitForAngular(page, timeout = 15000) {
  try {
    await page.waitForFunction(() => {
      const el = document.querySelector('[ng-app]') || document.querySelector('body');
      if (!window.angular) return true;
      const inj = window.angular.element(el).injector();
      if (!inj) return true;
      return inj.get('$http').pendingRequests.length === 0 && !inj.get('$rootScope').$$phase;
    }, { timeout });
  } catch {}
}

async function shot(page, filename, opts = {}) {
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, filename), ...opts });
  console.log(`  ✓ ${filename}`);
}

async function shotEl(page, sel, filename) {
  const el = page.locator(sel).first();
  await el.waitFor({ state: 'visible', timeout: 10000 });
  await el.screenshot({ path: path.join(SCREENSHOT_DIR, filename) });
  console.log(`  ✓ ${filename}`);
}

async function closeModal(page) {
  for (const sel of ['.modal.in .modal-footer .btn-default', '.modal.in button.close', '.modal.in .btn-core-close']) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
        await btn.click({ force: true });
        await pause(800);
        if (!(await page.locator('.modal.in').isVisible({ timeout: 500 }).catch(() => false))) return;
      }
    } catch {}
  }
  await page.keyboard.press('Escape');
  await pause(800);
}

async function main() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: !HEADED });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await context.newPage();

  // ═══════════════════════════════════════════════
  // PART 1: WIZARD WALKTHROUGH
  // ═══════════════════════════════════════════════
  console.log('\n=== Part 1: Wizard Walkthrough ===');

  // Login as fresh user
  console.log('Logging in as fresh user...');
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  await page.locator('#login input.email').fill(WIZARD_EMAIL);
  await page.locator('#login input.password').fill(WIZARD_PASSWORD);
  await page.locator('#login input.login').click();
  await page.waitForLoadState('networkidle');
  await pause(2000);

  // Fresh user sees welcome page
  console.log('Step 0: Welcome page');
  await shot(page, 'wizard_01_welcome.png');

  // Click "Create Your First Relevancy Case" — this creates a case and redirects with showWizard=true
  const createBtn = page.locator('input[value="Create Your First Relevancy Case"]').first();
  if (await createBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await createBtn.click();
  } else {
    await page.goto(BASE_URL + '/cases/new');
  }
  await page.waitForLoadState('networkidle');
  await pause(3000);
  await waitForAngular(page);

  // Wait for the AngularJS wizard modal
  console.log('Waiting for wizard modal...');
  await page.waitForSelector('.modal.in #wizard', { timeout: 15000 });
  await pause(1000);

  // ── Step 1: Welcome (Doug) ──
  console.log('Step 1: Welcome (Doug)');
  try { await shotEl(page, '.modal.in .modal-content', 'wizard_02_doug_welcome.png'); }
  catch { await shot(page, 'wizard_02_doug_welcome.png'); }

  // Click "Continue" (wz-next button)
  await page.locator('#step-one button[wz-next]').click();
  await pause(800);

  // ── Step 2: Name Your Case ──
  console.log('Step 2: Name Your Case');
  await page.locator('input[ng-model="pendingWizardSettings.caseName"]').fill('TMDB Movie Search');
  await pause(300);
  try { await shotEl(page, '.modal.in .modal-content', 'wizard_03_name_case.png'); }
  catch { await shot(page, 'wizard_03_name_case.png'); }

  await page.locator('#step-two button[wz-next]').click();
  await pause(1000);

  // ── Step 3: Connect to Search Endpoint ──
  console.log('Step 3: Search Endpoint');
  await pause(500);

  // Screenshot the initial accordion state
  try { await shotEl(page, '.modal.in .modal-content', 'wizard_04_search_endpoint.png'); }
  catch { await shot(page, 'wizard_04_search_endpoint.png'); }

  // Expand "Create a new Search Endpoint" accordion by clicking its heading
  await page.locator('text=Create a new Search Endpoint').first().click();
  await pause(1500);
  await waitForAngular(page);

  // Screenshot showing engine selection (Solr, ES, OpenSearch, etc.)
  try { await shotEl(page, '.modal.in .modal-content', 'wizard_04b_engine_selection.png'); }
  catch { await shot(page, 'wizard_04b_engine_selection.png'); }

  // Solr should be default selected. Fill URL if needed.
  const urlInput = page.locator('input[ng-model="pendingWizardSettings.searchUrl"]');
  if (await urlInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    const currentUrl = await urlInput.inputValue();
    if (!currentUrl || !currentUrl.includes('tmdb')) {
      await urlInput.fill('http://quepid-solr.dev.o19s.com:8985/solr/tmdb/select');
      await pause(500);
    }
  }

  // Scroll down in the modal to find the Continue button
  await page.locator('.modal.in .modal-body').evaluate(el => el.scrollTop = el.scrollHeight);
  await pause(500);

  // Click "Continue" which validates the endpoint — use force since it may be partially occluded
  const continueBtn3 = page.locator('#step-three button.continue:not(.btn-danger)').first();
  await continueBtn3.scrollIntoViewIfNeeded();
  await continueBtn3.click({ force: true, timeout: 10000 });
  await pause(3000);
  await waitForAngular(page);

  // Check if validation succeeded
  const successMsg = page.locator('.alert-success:has-text("Quepid can search this")');
  if (await successMsg.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('  Endpoint validated successfully!');
    try { await shotEl(page, '.modal.in .modal-content', 'wizard_04b_endpoint_validated.png'); }
    catch { await shot(page, 'wizard_04b_endpoint_validated.png'); }
  } else {
    console.log('  Endpoint validation may have failed — checking for error');
    try { await shotEl(page, '.modal.in .modal-content', 'wizard_04b_endpoint_result.png'); }
    catch { await shot(page, 'wizard_04b_endpoint_result.png'); }

    // Try skip validation if endpoint unreachable
    const skipBtn = page.locator('button:has-text("Skip Validation")');
    if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('  Skipping validation...');
      await skipBtn.click();
      await pause(1000);
    }
  }

  // Should now be on Step 4 (Fields) after successful validation
  await pause(1000);

  // ── Step 4: Display Fields ──
  console.log('Step 4: Display Fields');
  // Title and ID fields may be auto-populated from demo detection
  const titleField = page.locator('input[ng-model="pendingWizardSettings.titleField"]');
  if (await titleField.isVisible({ timeout: 3000 }).catch(() => false)) {
    const val = await titleField.inputValue();
    if (!val) await titleField.fill('title');
  }

  const idField = page.locator('input[ng-model="pendingWizardSettings.idField"]');
  if (await idField.isVisible({ timeout: 2000 }).catch(() => false)) {
    const val = await idField.inputValue();
    if (!val) await idField.fill('id');
  }

  try { await shotEl(page, '.modal.in .modal-content', 'wizard_05_display_fields.png'); }
  catch { await shot(page, 'wizard_05_display_fields.png'); }

  // Click Continue (this one uses ng-click="validateFieldSpec()")
  const fieldContinue = page.locator('#step-four button.continue').first();
  await fieldContinue.click();
  await pause(2000);
  await waitForAngular(page);

  // ── Step 5: Add Queries ──
  console.log('Step 5: Add Queries');

  const queryTextInput = page.locator('#step-five input[ng-model="pendingWizardSettings.text"]');
  const addQueryBtn = page.locator('#step-five input[value="Add Query"]');

  if (await queryTextInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    for (const q of ['star wars', 'batman', 'romantic comedy']) {
      await queryTextInput.fill(q);
      await addQueryBtn.click();
      await pause(300);
    }
  }

  try { await shotEl(page, '.modal.in .modal-content', 'wizard_06_add_queries.png'); }
  catch { await shot(page, 'wizard_06_add_queries.png'); }

  // Click Continue (wz-next)
  await page.locator('#step-five button[wz-next]').click();
  await pause(1000);

  // ── Step 6: Finish ──
  console.log('Step 6: Finish');
  try { await shotEl(page, '.modal.in .modal-content', 'wizard_07_finish.png'); }
  catch { await shot(page, 'wizard_07_finish.png'); }

  // Click Finish
  await page.locator('#step-six button[wz-next]').click();
  await pause(5000);
  await waitForAngular(page);

  // Wait for case to load with results
  console.log('Waiting for results to load...');
  await page.waitForSelector('.results-list-element, #query-container', { timeout: 30000 }).catch(() => {});
  await pause(5000);
  await waitForAngular(page);

  // ═══════════════════════════════════════════════
  // PART 2: RECAPTURE SCREENSHOTS WITH SEARCH RESULTS
  // ═══════════════════════════════════════════════
  console.log('\n=== Part 2: Screenshots with search results ===');

  // Full layout with actual TMDB results
  await shot(page, '01_full_layout.png', { fullPage: false });

  // Expand first query to show results
  const firstQuery = page.locator('.result-header').first();
  if (await firstQuery.isVisible({ timeout: 5000 }).catch(() => false)) {
    await firstQuery.click();
    await pause(3000);
    await waitForAngular(page);
  }

  // Screenshot 05: Expanded query with TMDB movie results
  await shot(page, '05_query_expanded.png', { fullPage: false });

  // Screenshot 06: Rating popover
  const ratingBtn = page.locator('.sub-results .col-ratings .btn, .search-result .col-ratings .btn').first();
  if (await ratingBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    // Scroll the rating button into view
    await ratingBtn.scrollIntoViewIfNeeded();
    await pause(300);
    await ratingBtn.click();
    await pause(1000);

    await page.waitForSelector('.popover:visible, .ratingContainer:visible', { timeout: 5000 }).catch(() => {});

    try {
      const popover = page.locator('.popover:visible').first();
      const pBox = await popover.boundingBox();
      const rBox = await ratingBtn.boundingBox();

      if (pBox && rBox) {
        const x = Math.max(0, Math.min(rBox.x, pBox.x) - 80);
        const y = Math.max(0, Math.min(rBox.y, pBox.y) - 50);
        const right = Math.max(pBox.x + pBox.width, rBox.x + rBox.width) + 250;
        const bottom = Math.max(pBox.y + pBox.height, rBox.y + rBox.height) + 80;
        await shot(page, '06_rating_popover.png', { clip: { x, y, width: right - x, height: bottom - y } });
      } else {
        await shot(page, '06_rating_popover.png');
      }
    } catch {
      await shot(page, '06_rating_popover.png');
    }
    await page.keyboard.press('Escape');
    await pause(300);
  } else {
    console.log('  ⚠ No rating buttons visible');
    await shot(page, '06_rating_popover.png');
  }

  // ═══════════════════════════════════════════════
  // PART 3: MAIN USER SCREENSHOTS (populated data)
  // ═══════════════════════════════════════════════
  console.log('\n=== Part 3: Main user screenshots ===');

  await page.goto(BASE_URL + '/logout');
  await page.waitForLoadState('networkidle');
  await pause(500);
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  await page.locator('#login input.email').fill(MAIN_EMAIL);
  await page.locator('#login input.password').fill(MAIN_PASSWORD);
  await page.locator('#login input.login').click();
  await page.waitForLoadState('networkidle');
  await pause(2000);
  await waitForAngular(page);

  // Navigate to 10s of Queries case
  await page.goto(BASE_URL + '/cases');
  await page.waitForLoadState('networkidle');
  await pause(1000);
  const caseLink = page.locator('a:has-text("10s of Queries")').first();
  if (await caseLink.isVisible({ timeout: 5000 }).catch(() => false)) await caseLink.click();
  await page.waitForLoadState('networkidle');
  await pause(3000);
  await waitForAngular(page);
  await page.waitForSelector('.results-list-element', { timeout: 30000 }).catch(() => {});
  await pause(2000);

  // 02: Header dropdown
  await page.locator('a.dropdown-toggle:has-text("Relevancy Cases")').first().click();
  await pause(800);
  await shot(page, '02_header_relevancy_cases.png');
  await page.keyboard.press('Escape');
  await pause(500);

  // 03: Case header + actions
  try {
    const hBox = await page.locator('#case-header').first().boundingBox();
    const aBox = await page.locator('#case-actions').first().boundingBox();
    if (hBox && aBox) {
      await shot(page, '03_case_header_and_actions.png', {
        clip: { x: 0, y: hBox.y, width: 1440, height: (aBox.y + aBox.height) - hBox.y + 10 }
      });
    }
  } catch { await shot(page, '03_case_header_and_actions.png'); }

  // 04: Query list collapsed
  const collapseAll = page.locator('a:has-text("Collapse all")').first();
  if (await collapseAll.isVisible({ timeout: 2000 }).catch(() => false)) { await collapseAll.click(); await pause(500); }
  try { await shotEl(page, '#query-container, .results', '04_query_list_controls.png'); }
  catch { await shot(page, '04_query_list_controls.png'); }

  // East pane tabs 07-11
  await page.locator('a:has-text("Tune Relevance")').first().click();
  await pause(1500);
  await waitForAngular(page);

  const TABS = [
    ['#developerTab', '07_east_pane_query_tab.png'],
    ['#curatorTab', '08_east_pane_tuning_knobs.png'],
    ['#engineTab', '09_east_pane_settings.png'],
    ['#historyTab', '10_east_pane_history.png'],
    ['#annotationsTab', '11_east_pane_annotations.png'],
  ];
  for (const [tabId, filename] of TABS) {
    await page.locator(tabId).click();
    await pause(800);
    await waitForAngular(page);
    try { await shotEl(page, '.pane_east', filename); }
    catch { await shot(page, filename); }
  }

  // Close east pane
  await page.locator('a:has-text("Tune Relevance")').first().click();
  await pause(500);

  // Modals 12-15
  const MODALS = [
    ['a:has-text("Create snapshot")', '12_snapshot_modal.png'],
    ['a:has-text("Compare snapshots")', '13_diff_modal.png'],
    ['a:has-text("Select scorer")', '14_select_scorer_modal.png'],
    ['delete-case-options a', '15_delete_options_modal.png'],
  ];
  for (const [trigger, filename] of MODALS) {
    const link = page.locator(trigger).first();
    if (await link.isVisible({ timeout: 3000 }).catch(() => false)) {
      await link.click();
      await pause(1000);
      await page.waitForSelector('.modal.in', { timeout: 5000 }).catch(() => {});
      try { await shotEl(page, '.modal.in .modal-content', filename); }
      catch { await shot(page, filename); }
      await closeModal(page);
      await pause(500);
    }
  }

  // 16: Loading
  const currentUrl = page.url();
  await page.goto(currentUrl);
  await pause(300);
  await shot(page, '16_loading_bootstrapping.png');

  console.log('\nDone! All screenshots saved to: ' + SCREENSHOT_DIR);
  await browser.close();
}

main().catch(err => { console.error('Failed:', err); process.exit(1); });

/**
 * Capture remaining screenshots that require specific setup:
 * - 34: Announcement notification banner (create announcement, then view as user)
 * - 35: Teams page
 * - 50: Scorer edit form (code, scale, labels)
 * - 51: Communal scorer edit with warning banners
 * - 52: Archive/Unarchive case confirm modal
 * - 57: Home page with case summary cards & prophet trends
 * - 60: Query diff results side-by-side (AngularJS, needs 2+ snapshots)
 */
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('playwright-core'));
}
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SCREENSHOT_DIR = path.resolve(
  process.env.SCREENSHOT_DIR || 'docs/images/core_case_evaluation_manual'
);

const LOGIN_EMAIL = 'quepid+realisticactivity@o19s.com';
const LOGIN_PASSWORD = 'password';

function pause(ms = 500) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
  } catch {}
}

async function screenshot(page, filename, options = {}) {
  const filepath = path.join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: filepath, ...options });
  console.log(`  ✓ ${filename}`);
}

async function screenshotElement(page, selector, filename) {
  const el = page.locator(selector).first();
  if (await el.isVisible({ timeout: 5000 }).catch(() => false)) {
    const filepath = path.join(SCREENSHOT_DIR, filename);
    await el.screenshot({ path: filepath });
    console.log(`  ✓ ${filename}`);
    return true;
  }
  console.log(`  ⚠ Not visible: ${selector}`);
  return false;
}

async function main() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: process.env.HEADED !== 'true',
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // ── Login ──
  console.log('Logging in...');
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  await page.locator('#login input.email').fill(LOGIN_EMAIL);
  await page.locator('#login input.password').fill(LOGIN_PASSWORD);
  await page.locator('#login input.login').click();
  await page.waitForURL(/\/case\/|\//, { timeout: 30000 }).catch(() => {});
  await page.waitForLoadState('networkidle');
  await pause(3000);

  // ═══════════════════════════════════════════════
  // 57: Home page with case summary cards & prophet trends
  // ═══════════════════════════════════════════════
  console.log('\n--- 57: Home page with case summaries ---');
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  await pause(3000);
  // Wait for turbo frames to load (prophet charts)
  await page.waitForSelector('turbo-frame[complete], turbo-frame[src]', { timeout: 10000 }).catch(() => {});
  await pause(3000);
  await screenshot(page, '57_home_dashboard.png');

  // ═══════════════════════════════════════════════
  // 34: Announcement notification banner
  // First create an announcement via admin, then view it
  // ═══════════════════════════════════════════════
  console.log('\n--- 34: Announcement notification ---');
  await page.goto(BASE_URL + '/admin/announcements/new');
  await page.waitForLoadState('networkidle');
  await pause(1000);

  // Fill in the announcement form
  const textField = page.locator('textarea[name="announcement[text]"], input[name="announcement[text]"], #announcement_text, trix-editor').first();
  if (await textField.isVisible({ timeout: 3000 }).catch(() => false)) {
    const tagName = await textField.evaluate(el => el.tagName.toLowerCase());
    if (tagName === 'trix-editor') {
      await textField.click();
      await page.keyboard.type('Welcome to the new version of Quepid! Check out the improved search evaluation features.');
    } else {
      await textField.fill('Welcome to the new version of Quepid! Check out the improved search evaluation features.');
    }
    await pause(500);

    // Screenshot the announcement creation form
    await screenshot(page, '34a_admin_announcement_form.png');

    // Submit the form
    const submitBtn = page.locator('input[type="submit"], button[type="submit"]').first();
    await submitBtn.click();
    await page.waitForLoadState('networkidle');
    await pause(1000);

    // Now publish the announcement
    const publishBtn = page.locator('a:has-text("Publish"), button:has-text("Publish")').first();
    if (await publishBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await publishBtn.click();
      await page.waitForLoadState('networkidle');
      await pause(1000);
    }

    // Now go to home page to see the announcement banner
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await pause(2000);
    await screenshot(page, '34_announcement_banner.png');

    // Clean up: unpublish/delete the announcement
    await page.goto(BASE_URL + '/admin/announcements');
    await page.waitForLoadState('networkidle');
    await pause(1000);
    const unpublishBtn = page.locator('a:has-text("Unpublish"), button:has-text("Unpublish")').first();
    if (await unpublishBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await unpublishBtn.click();
      await page.waitForLoadState('networkidle');
      await pause(500);
    }
    // Delete the announcement we created
    const deleteBtn = page.locator('a:has-text("Delete"), button:has-text("Delete")').first();
    if (await deleteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      page.once('dialog', dialog => dialog.accept());
      await deleteBtn.click();
      await page.waitForLoadState('networkidle');
      await pause(500);
    }
  } else {
    console.log('  ⚠ Could not find announcement text field');
  }

  // ═══════════════════════════════════════════════
  // 35: Teams page
  // ═══════════════════════════════════════════════
  console.log('\n--- 35: Teams page ---');
  await page.goto(BASE_URL + '/teams');
  await page.waitForLoadState('networkidle');
  await pause(1000);
  // Click into a team if available
  const teamLink = page.locator('a[href*="/teams/"]').first();
  if (await teamLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    await teamLink.click();
    await page.waitForLoadState('networkidle');
    await pause(1000);
    await screenshot(page, '35_team_details.png');
  } else {
    await screenshot(page, '35_team_details.png');
  }

  // ═══════════════════════════════════════════════
  // 50: Scorer edit form
  // ═══════════════════════════════════════════════
  console.log('\n--- 50: Scorer edit form ---');
  await page.goto(BASE_URL + '/scorers');
  await page.waitForLoadState('networkidle');
  await pause(1000);

  // Find an Edit link for a scorer
  const editScorerLink = page.locator('a:has-text("Edit")').first();
  if (await editScorerLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    await editScorerLink.click();
    await page.waitForLoadState('networkidle');
    await pause(1000);
    await screenshot(page, '50_scorer_edit_form.png');

    // Check if this is a communal scorer (has the warning banner)
    const warningBanner = page.locator('.alert-warning:has-text("communal scorer")');
    const infoBanner = page.locator('.alert-info:has-text("communal scorer")');
    if (await warningBanner.isVisible({ timeout: 2000 }).catch(() => false) ||
        await infoBanner.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log('  Found communal scorer - capturing warning banners');
      await screenshot(page, '51_communal_scorer_edit.png');
    }
  } else {
    console.log('  ⚠ No Edit link found on scorers page');
  }

  // ═══════════════════════════════════════════════
  // 51: Communal scorer edit (if not already captured above)
  // Navigate directly to a communal scorer
  // ═══════════════════════════════════════════════
  console.log('\n--- 51: Communal scorer edit ---');
  await page.goto(BASE_URL + '/scorers');
  await page.waitForLoadState('networkidle');
  await pause(1000);

  // Look for communal scorers tab or filter
  const communalTab = page.locator('a:has-text("Communal"), button:has-text("Communal")').first();
  if (await communalTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await communalTab.click();
    await pause(1000);
  }

  // Try to find and click edit on a communal scorer
  const communalEditLinks = page.locator('a[href*="/scorers/"][href*="edit"], a:has-text("Edit")');
  const count = await communalEditLinks.count();
  for (let i = 0; i < count; i++) {
    const link = communalEditLinks.nth(i);
    const href = await link.getAttribute('href');
    if (href && href.includes('/scorers/') && href.includes('edit')) {
      await link.click();
      await page.waitForLoadState('networkidle');
      await pause(1000);

      const hasWarning = await page.locator('.alert-warning:has-text("communal")').isVisible({ timeout: 2000 }).catch(() => false);
      if (hasWarning) {
        console.log('  Found communal scorer edit page with warning');
        await screenshot(page, '51_communal_scorer_edit.png');
        break;
      }
      // Go back and try next
      await page.goBack();
      await page.waitForLoadState('networkidle');
      await pause(500);
    }
  }

  // If we still don't have 51, check if file exists
  if (!fs.existsSync(path.join(SCREENSHOT_DIR, '51_communal_scorer_edit.png'))) {
    console.log('  ⚠ No communal scorer found to edit - using first scorer edit as fallback');
  }

  // ═══════════════════════════════════════════════
  // 52: Archive/Unarchive case confirm modal
  // ═══════════════════════════════════════════════
  console.log('\n--- 52: Archive case confirm modal ---');
  await page.goto(BASE_URL + '/cases');
  await page.waitForLoadState('networkidle');
  await pause(1000);

  // Find an archive button (folder-check icon)
  const archiveBtn = page.locator('button[title="Archive case"], button[aria-label="Archive case"]').first();
  if (await archiveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await archiveBtn.click();
    await pause(1000);

    // The confirm-delete controller should show a Bootstrap modal
    const modal = page.locator('#confirmDeleteModal');
    if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
      await screenshot(page, '52_archive_case_confirm.png');

      // Cancel - don't actually archive
      const cancelBtn = modal.locator('button:has-text("Cancel")');
      if (await cancelBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await cancelBtn.click();
        await pause(500);
      }
    } else {
      console.log('  ⚠ Confirm modal did not appear');
    }
  } else {
    console.log('  ⚠ No archive button found on cases page');
  }

  // ═══════════════════════════════════════════════
  // 60: Query diff results (AngularJS) - need to open diff modal with data
  // ═══════════════════════════════════════════════
  console.log('\n--- 60: Query diff results ---');
  // Navigate to the populated case
  await page.goto(BASE_URL + '/cases');
  await page.waitForLoadState('networkidle');
  await pause(1000);
  const caseLink = page.locator('a:has-text("10s of Queries")').first();
  if (await caseLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    await caseLink.click();
  }
  await page.waitForLoadState('networkidle');
  await pause(3000);
  await waitForAngular(page);
  await pause(2000);

  // Open the diff/compare modal - look for the compare/diff button
  const diffBtn = page.locator('button[title*="iff"], button[title*="ompare"], a[title*="iff"], a[title*="ompare"]').first();
  if (await diffBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await diffBtn.click();
    await pause(2000);
    await waitForAngular(page);
    await pause(1000);

    // Try to select two snapshots and run the diff
    const snapshotSelects = page.locator('select');
    const selectCount = await snapshotSelects.count();
    if (selectCount >= 2) {
      // Select first option in first dropdown
      const firstSelect = snapshotSelects.nth(0);
      const options1 = await firstSelect.locator('option').allTextContents();
      console.log('  Snapshot options:', options1.slice(0, 5));
      if (options1.length > 1) {
        await firstSelect.selectOption({ index: 1 });
        await pause(500);
      }
      // Select second option in second dropdown
      const secondSelect = snapshotSelects.nth(1);
      const options2 = await secondSelect.locator('option').allTextContents();
      if (options2.length > 2) {
        await secondSelect.selectOption({ index: 2 });
        await pause(500);
      }

      // Click compare/diff button in the modal
      const compareBtn = page.locator('.modal button:has-text("Compare"), .modal button:has-text("Diff"), .modal input[value="Compare"]').first();
      if (await compareBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await compareBtn.click();
        await pause(3000);
        await waitForAngular(page);
        await pause(2000);
        await screenshot(page, '60_query_diff_results.png');
      } else {
        console.log('  ⚠ No compare button in modal');
        await screenshot(page, '60_query_diff_results.png');
      }
    }

    // Close the modal
    const closeBtn = page.locator('.modal button.close, .modal [data-dismiss="modal"], .modal .btn-close').first();
    if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await closeBtn.click();
      await pause(500);
    }
  } else {
    console.log('  ⚠ Diff/Compare button not found');
  }

  console.log('\nDone!');
  await browser.close();
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});

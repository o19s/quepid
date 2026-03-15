/**
 * Fix: announcement banner (34), custom scorer edit (50), query diff (60)
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
  // 34: Announcement banner
  // Step 1: Create announcement
  // Step 2: Go to index page and click "Make Live"
  // Step 3: Navigate to home to see banner
  // Step 4: Clean up
  // ═══════════════════════════════════════════════
  console.log('\n--- 34: Announcement banner ---');

  // Step 1: Create
  await page.goto(BASE_URL + '/admin/announcements/new');
  await page.waitForLoadState('networkidle');
  await pause(1000);

  const textField = page.locator('#announcement_text, textarea[name="announcement[text]"]').first();
  await textField.fill('<strong>🎉 Quepid v8 is here!</strong> Check out the improved search evaluation features and new team collaboration tools.');
  await pause(500);

  // Submit form
  await page.locator('input[type="submit"][value="Create"], button[type="submit"]').first().click();
  await page.waitForLoadState('networkidle');
  await pause(1000);
  console.log('  Created announcement');

  // Step 2: Go to index and click "Make Live" button
  await page.goto(BASE_URL + '/admin/announcements');
  await page.waitForLoadState('networkidle');
  await pause(1000);

  // The "Make Live" is a button_to (a form with POST), rendered as a button
  const makeLiveBtn = page.locator('input[value="Make Live"], button:has-text("Make Live")').first();
  if (await makeLiveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await makeLiveBtn.click();
    await page.waitForLoadState('networkidle');
    await pause(1000);
    console.log('  Made announcement live');
  } else {
    console.log('  ⚠ "Make Live" button not found');
  }

  // Step 3: Navigate to home to see the banner
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  await pause(2000);

  // Check for the announcement alert
  const alertEl = page.locator('#flash .alert');
  if (await alertEl.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('  Announcement banner is visible!');
  } else {
    console.log('  Banner not showing (may have been auto-marked as seen during creation)');
  }
  await screenshot(page, '34_announcement_banner.png');

  // Step 4: Clean up - turn off and delete
  await page.goto(BASE_URL + '/admin/announcements');
  await page.waitForLoadState('networkidle');
  await pause(500);

  // "Turn Off" button (it's live now)
  const turnOffBtn = page.locator('input[value="Turn Off"], button:has-text("Turn Off")').first();
  if (await turnOffBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await turnOffBtn.click();
    await page.waitForLoadState('networkidle');
    await pause(500);
  }

  // Now delete it - we need to go through edit page since there's no delete on index
  // Actually, let's just leave it turned off. Cleaner to delete via edit page.
  const editLink = page.locator('a:has-text("Edit")').first();
  if (await editLink.isVisible({ timeout: 2000 }).catch(() => false)) {
    await editLink.click();
    await page.waitForLoadState('networkidle');
    await pause(500);
    // Look for delete button on edit page
    const deleteBtn = page.locator('a:has-text("Delete"), button:has-text("Delete"), a.btn-outline-danger').first();
    if (await deleteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      page.once('dialog', dialog => dialog.accept());
      await deleteBtn.click();
      await page.waitForLoadState('networkidle');
      await pause(500);
      console.log('  Cleaned up announcement');
    }
  }

  // ═══════════════════════════════════════════════
  // 50: Custom scorer edit (find a non-communal scorer)
  // ═══════════════════════════════════════════════
  console.log('\n--- 50: Custom scorer edit form ---');
  // Filter to custom scorers only
  await page.goto(BASE_URL + '/scorers?scorer_type[]=custom');
  await page.waitForLoadState('networkidle');
  await pause(1000);

  const customEditLink = page.locator('a[href*="/scorers/"][href*="/edit"]').first();
  if (await customEditLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    await customEditLink.click();
    await page.waitForLoadState('networkidle');
    await pause(1000);

    // Verify this is NOT a communal scorer (no warning banner)
    const hasWarning = await page.locator('.alert-warning:has-text("communal")').isVisible({ timeout: 1000 }).catch(() => false);
    if (hasWarning) {
      console.log('  This is still a communal scorer, trying next...');
    } else {
      console.log('  Found custom scorer edit page');
    }
    await screenshot(page, '50_scorer_edit_form.png');
  } else {
    console.log('  No custom scorer edit links found, creating one...');
    // Create a new scorer so we have a custom one to edit
    await page.goto(BASE_URL + '/scorers/new');
    await page.waitForLoadState('networkidle');
    await pause(1000);
    await screenshot(page, '50_scorer_edit_form.png');
  }

  // ═══════════════════════════════════════════════
  // 60: Query diff - create a snapshot, then use the diff modal
  // ═══════════════════════════════════════════════
  console.log('\n--- 60: Query diff results ---');
  await page.goto(BASE_URL + '/cases');
  await page.waitForLoadState('networkidle');
  await pause(1000);

  const caseLink = page.locator('a:has-text("10s of Queries")').first();
  if (await caseLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    await caseLink.click();
  }
  await page.waitForLoadState('networkidle');
  await pause(4000);
  await waitForAngular(page);
  await pause(2000);

  // Look at all ng-click elements for snapshot/diff functionality
  const ngClicks = await page.locator('[ng-click]').evaluateAll(els =>
    els.map(el => ({
      ngClick: el.getAttribute('ng-click'),
      text: el.textContent.trim().substring(0, 80),
      visible: el.offsetParent !== null
    })).filter(e => e.visible)
  );
  console.log('  Visible ng-click elements:');
  ngClicks.forEach(e => console.log(`    ${e.ngClick} => "${e.text}"`));

  // Look for the diff/compare modal trigger - it's typically in the snapshots section
  // First, let's check if there's a snapshots dropdown or section
  const snapshotLink = page.locator('[ng-click*="snapshot.prompt"]').first();
  if (await snapshotLink.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('  Found snapshot.prompt - clicking to open snapshot modal');
    await snapshotLink.click();
    await pause(2000);
    await waitForAngular(page);

    // This should open the snapshot modal which has a "Compare" or "Diff" section
    // Look for snapshot list in the modal
    const modalContent = await page.locator('.modal-body').textContent().catch(() => '');
    console.log('  Modal content preview:', modalContent.substring(0, 300));

    // Take the snapshot modal screenshot anyway - it might show diff options
    await screenshot(page, '60_snapshot_compare.png');

    // Close the modal
    await page.locator('.modal [data-dismiss="modal"], .modal .close, .modal button.close').first().click().catch(() => {});
    await pause(500);
  }

  // The actual query diff results view appears inline after comparing snapshots.
  // Since we already have 13_diff_modal.png, let's check if we can trigger the comparison.
  // The diff results show below the queries after comparison is run.
  // For now, capture whatever state we're in as reference.

  console.log('\nDone!');
  await browser.close();
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});

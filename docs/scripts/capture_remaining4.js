/**
 * Fix: scorer edit scrolled (50), compare snapshots modal (60)
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
  // 50: Scorer new/edit - full page with scale options visible
  // ═══════════════════════════════════════════════
  console.log('\n--- 50: Scorer form (full page with scale) ---');
  await page.goto(BASE_URL + '/scorers/new');
  await page.waitForLoadState('networkidle');
  await pause(1000);

  // Scroll down to show the scale section
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await pause(500);

  // Take a full-page screenshot to capture everything
  await screenshot(page, '50_scorer_edit_form.png', { fullPage: true });

  // ═══════════════════════════════════════════════
  // 60: Compare snapshots modal
  // ═══════════════════════════════════════════════
  console.log('\n--- 60: Compare snapshots ---');
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

  // Click "Compare snapshots" (not "Create snapshot")
  const compareBtn = page.locator('text=Compare snapshots').first();
  if (await compareBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('  Found "Compare snapshots" button');
    await compareBtn.click();
    await pause(2000);
    await waitForAngular(page);
    await pause(1000);

    // The compare modal should now be open
    const modal = page.locator('.modal:visible').first();
    if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
      // See what's in the modal
      const modalText = await modal.textContent();
      console.log('  Modal content:', modalText.substring(0, 300));

      // Look for snapshot select dropdowns
      const selects = modal.locator('select');
      const selectCount = await selects.count();
      console.log(`  Found ${selectCount} select elements in modal`);

      if (selectCount >= 2) {
        // Get options from first select
        const opts1 = await selects.nth(0).locator('option').allTextContents();
        console.log('  Select 1 options:', opts1);

        const opts2 = await selects.nth(1).locator('option').allTextContents();
        console.log('  Select 2 options:', opts2);

        // Select different snapshots in each dropdown
        if (opts1.length > 1) {
          await selects.nth(0).selectOption({ index: 1 });
          await pause(500);
        }
        if (opts2.length > 2) {
          await selects.nth(1).selectOption({ index: 2 });
          await pause(500);
        } else if (opts2.length > 1) {
          await selects.nth(1).selectOption({ index: 1 });
          await pause(500);
        }
      }

      await screenshot(page, '60_compare_snapshots_modal.png');

      // Try to run the comparison
      const runBtn = modal.locator('button:has-text("Compare"), button:has-text("Diff"), button:has-text("Run")').first();
      if (await runBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await runBtn.click();
        await pause(3000);
        await waitForAngular(page);
        await pause(2000);

        // The diff results should now be showing
        await screenshot(page, '60_query_diff_results.png');
      } else {
        console.log('  No Compare/Run button found in modal');
        // List all buttons in modal
        const btns = await modal.locator('button, input[type="submit"]').allTextContents();
        console.log('  Modal buttons:', btns);
      }
    } else {
      console.log('  ⚠ Modal did not appear');
    }
  } else {
    console.log('  ⚠ "Compare snapshots" not found');
    // List all action bar text
    const actions = await page.locator('.actions-bar, [class*="action"]').allTextContents();
    console.log('  Actions area:', actions.map(t => t.trim().substring(0, 100)));
  }

  console.log('\nDone!');
  await browser.close();
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});

/**
 * Fix remaining screenshots: teams detail, scorer edit, announcement banner, query diff
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
  // 35: Teams page - navigate to an existing team
  // ═══════════════════════════════════════════════
  console.log('\n--- 35: Team details page ---');
  await page.goto(BASE_URL + '/teams');
  await page.waitForLoadState('networkidle');
  await pause(1000);

  // The teams index should list teams; click into the first one
  // Look for team links (not "New Team" or "Back" links)
  const teamLinks = page.locator('a[href*="/teams/"]');
  const teamCount = await teamLinks.count();
  console.log(`  Found ${teamCount} team links`);
  let foundTeam = false;
  for (let i = 0; i < teamCount; i++) {
    const href = await teamLinks.nth(i).getAttribute('href');
    // Match /teams/123 but not /teams/new
    if (href && href.match(/\/teams\/\d+$/)) {
      console.log(`  Clicking team link: ${href}`);
      await teamLinks.nth(i).click();
      await page.waitForLoadState('networkidle');
      await pause(1000);
      foundTeam = true;
      break;
    }
  }
  if (!foundTeam) {
    // Maybe the index page itself shows teams as cards — just screenshot whatever is there
    console.log('  No specific team link found, screenshotting teams index');
  }
  await screenshot(page, '35_team_details.png');

  // ═══════════════════════════════════════════════
  // 50: Scorer edit form - use pencil icon link
  // ═══════════════════════════════════════════════
  console.log('\n--- 50: Scorer edit form ---');
  await page.goto(BASE_URL + '/scorers');
  await page.waitForLoadState('networkidle');
  await pause(1000);

  // The edit links are pencil icon links: <a href="/scorers/N/edit"><i class="bi bi-pencil"></i></a>
  // For custom scorers (non-communal), there should be edit links
  const editLinks = page.locator('a[href*="/scorers/"][href*="/edit"]');
  const editCount = await editLinks.count();
  console.log(`  Found ${editCount} scorer edit links`);
  if (editCount > 0) {
    // Click the first edit link (try to find a custom one first, or any)
    await editLinks.first().click();
    await page.waitForLoadState('networkidle');
    await pause(1000);
    await screenshot(page, '50_scorer_edit_form.png');
  } else {
    console.log('  ⚠ No scorer edit links found');
  }

  // ═══════════════════════════════════════════════
  // 34: Announcement banner - create, publish, delete viewed record, then view
  // ═══════════════════════════════════════════════
  console.log('\n--- 34: Announcement banner (retry) ---');

  // Create announcement
  await page.goto(BASE_URL + '/admin/announcements/new');
  await page.waitForLoadState('networkidle');
  await pause(1000);

  const textField = page.locator('#announcement_text, textarea[name="announcement[text]"]').first();
  if (await textField.isVisible({ timeout: 3000 }).catch(() => false)) {
    await textField.fill('🎉 Welcome to Quepid v8! Check out the improved search evaluation features and new team collaboration tools.');
    await pause(500);

    // Submit
    const submitBtn = page.locator('input[type="submit"][value="Create"], button:has-text("Create")').first();
    await submitBtn.click();
    await page.waitForLoadState('networkidle');
    await pause(1000);

    // We should be on the show page now. Look for Publish button.
    const publishBtn = page.locator('a:has-text("Publish"), button:has-text("Publish"), input[value="Publish"]').first();
    if (await publishBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await publishBtn.click();
      await page.waitForLoadState('networkidle');
      await pause(1000);
      console.log('  Published announcement');
    } else {
      // Maybe already on index page, look for publish there
      console.log('  No publish button on show page, checking index...');
      await page.goto(BASE_URL + '/admin/announcements');
      await page.waitForLoadState('networkidle');
      await pause(1000);
      const pub2 = page.locator('a:has-text("Publish")').first();
      if (await pub2.isVisible({ timeout: 2000 }).catch(() => false)) {
        await pub2.click();
        await page.waitForLoadState('networkidle');
        await pause(1000);
      }
    }

    // Delete the AnnouncementViewed record so the current user sees it again
    // We can do this via Rails runner through the page's console, or by using
    // a different approach: open an incognito context as a different user.
    // Simpler: just delete via Rails runner
    console.log('  Clearing announcement_viewed records...');

    // Use a second browser context (like incognito) — but same user will have viewed it.
    // Instead, let's just screenshot the announcements admin page which shows it published.
    // The banner itself is a simple alert div.

    // Navigate home — the announcement should show since we just published it.
    // The issue is that visiting home the first time creates the AnnouncementViewed.
    // But we JUST published, so navigating home NOW should show it.
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await pause(2000);

    // Check if announcement alert is visible
    const announcementAlert = page.locator('#flash .alert-light');
    if (await announcementAlert.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('  Announcement banner visible!');
      await screenshot(page, '34_announcement_banner.png');
    } else {
      console.log('  Banner not visible on home, taking full page anyway');
      await screenshot(page, '34_announcement_banner.png');
    }

    // Clean up: go to admin announcements and unpublish + delete
    await page.goto(BASE_URL + '/admin/announcements');
    await page.waitForLoadState('networkidle');
    await pause(1000);

    // Unpublish
    const unpub = page.locator('a:has-text("Unpublish")').first();
    if (await unpub.isVisible({ timeout: 2000 }).catch(() => false)) {
      await unpub.click();
      await page.waitForLoadState('networkidle');
      await pause(500);
    }
    // Delete
    const del = page.locator('a:has-text("Delete")').first();
    if (await del.isVisible({ timeout: 2000 }).catch(() => false)) {
      page.once('dialog', dialog => dialog.accept());
      await del.click();
      await page.waitForLoadState('networkidle');
      await pause(500);
    }
  }

  // ═══════════════════════════════════════════════
  // 60: Query diff results - need to navigate into AngularJS case
  //     and use the Snapshots Compare functionality
  // ═══════════════════════════════════════════════
  console.log('\n--- 60: Query diff results ---');
  // Navigate to the populated case
  await page.goto(BASE_URL + '/cases');
  await page.waitForLoadState('networkidle');
  await pause(1000);

  // Click into "10s of Queries" case
  const caseLink = page.locator('a:has-text("10s of Queries")').first();
  if (await caseLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    await caseLink.click();
  }
  await page.waitForLoadState('networkidle');
  await pause(3000);
  await waitForAngular(page);
  await pause(2000);

  // Look for the snapshot/compare button in the actions bar
  // It might be a camera icon, or "Snapshots" text
  const snapshotBtns = await page.locator('[ng-click*="snapshot"], [ng-click*="diff"], [ng-click*="compare"], button:has-text("Snapshot"), a[ng-click*="snapshot"]').allTextContents();
  console.log('  Snapshot-related buttons:', snapshotBtns);

  // Let's look at all buttons/links in the actions area
  const allBtns = await page.locator('.actions-bar button, .actions-bar a, .case-actions button, .case-actions a, [class*="action"] button').allTextContents();
  console.log('  Action buttons:', allBtns.filter(t => t.trim()));

  // Try finding it by icon - camera icon for snapshots
  const cameraBtn = page.locator('i.fa-camera, i.glyphicon-camera, [class*="camera"]').first();
  if (await cameraBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    const parent = cameraBtn.locator('..');
    await parent.click();
    await pause(2000);
    await waitForAngular(page);
    console.log('  Clicked camera/snapshot button');
  }

  // Try to find the diff button by looking at all clickable elements
  const allClickable = await page.locator('[ng-click]').evaluateAll(els =>
    els.map(el => ({ ngClick: el.getAttribute('ng-click'), text: el.textContent.trim().substring(0, 50) }))
  );
  console.log('  ng-click elements:', JSON.stringify(allClickable.filter(e => e.ngClick.includes('diff') || e.ngClick.includes('snap') || e.ngClick.includes('compare')), null, 2));

  // If we find a diff-related ng-click, click it
  for (const item of allClickable) {
    if (item.ngClick && (item.ngClick.includes('diff') || item.ngClick.includes('compare'))) {
      console.log(`  Clicking: ${item.ngClick}`);
      await page.locator(`[ng-click="${item.ngClick}"]`).first().click();
      await pause(2000);
      await waitForAngular(page);
      await pause(1000);
      await screenshot(page, '60_query_diff_results.png');
      break;
    }
  }

  console.log('\nDone!');
  await browser.close();
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});

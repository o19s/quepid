/**
 * Fix screenshots: footer, custom headers, settings accordions, healthcheck
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
  await page.waitForURL(/\/case\//, { timeout: 30000 }).catch(() => {});
  await page.waitForLoadState('networkidle');
  await pause(3000);
  await waitForAngular(page);
  await pause(2000);

  // ═══════════════════════════════════════════════
  // FIX 38: Footer - need to find it on a page that has one
  // ═══════════════════════════════════════════════
  console.log('\n--- Fixing 38: Footer ---');
  // The footer appears on Rails pages (admin, books, cases list, etc.)
  // Let's try the admin page which we know has it visible
  await page.goto(BASE_URL + '/admin');
  await page.waitForLoadState('networkidle');
  await pause(1000);

  // Scroll to the very bottom
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await pause(500);

  const footer = page.locator('footer.footer, footer').first();
  if (await footer.isVisible({ timeout: 3000 }).catch(() => false)) {
    await screenshotElement(page, 'footer.footer, footer', '38_footer.png');
  } else {
    // Try cases page
    await page.goto(BASE_URL + '/cases');
    await page.waitForLoadState('networkidle');
    await pause(1000);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await pause(500);
    const footer2 = page.locator('footer.footer, footer').first();
    if (await footer2.isVisible({ timeout: 3000 }).catch(() => false)) {
      await screenshotElement(page, 'footer.footer, footer', '38_footer.png');
    } else {
      // Take the bottom of whatever page we're on
      console.log('  Footer not found as element, capturing bottom of page');
      await screenshot(page, '38_footer.png', {
        clip: { x: 0, y: 700, width: 1440, height: 200 }
      });
    }
  }

  // ═══════════════════════════════════════════════
  // FIX 58: Healthcheck - the /healthcheck returns plain text
  // ═══════════════════════════════════════════════
  console.log('\n--- Fixing 58: Healthcheck ---');
  // Healthcheck returns a simple response - let's just capture it with the URL bar context
  await page.goto(BASE_URL + '/healthcheck');
  await page.waitForLoadState('networkidle');
  await pause(1000);
  // Get the page content to see what it returns
  const healthContent = await page.content();
  console.log('  Healthcheck content length:', healthContent.length);
  const bodyText = await page.locator('body').textContent();
  console.log('  Healthcheck body text:', bodyText.substring(0, 200));
  await screenshot(page, '58_healthcheck.png');

  // ═══════════════════════════════════════════════
  // Navigate to populated case for Settings screenshots
  // ═══════════════════════════════════════════════
  console.log('\n--- Navigating to case for Settings fixes ---');
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

  // Open east pane
  const tuneLink = page.locator('a:has-text("Tune Relevance")').first();
  if (await tuneLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    const tabArea = page.locator('#queryParamsArea');
    if (!(await tabArea.isVisible({ timeout: 1000 }).catch(() => false))) {
      await tuneLink.click();
      await pause(1500);
    }
  }

  // ═══════════════════════════════════════════════
  // FIX 53: Custom Headers - scroll to bottom of Settings tab
  // ═══════════════════════════════════════════════
  console.log('\n--- Fixing 53: Custom Headers ---');
  await page.locator('#engineTab').click();
  await pause(1000);
  await waitForAngular(page);
  await pause(500);

  // The settings tab has accordion sections. We need to scroll DOWN within
  // the east pane to find Custom Headers which is below Escape Queries.
  // Let's try clicking/expanding the headers section.

  // First, let's see what accordion headers exist
  const accordionHeaders = await page.locator('#queryParamsArea .panel-heading, #queryParamsArea h4, #queryParamsArea .settings-header').allTextContents();
  console.log('  Accordion headers found:', accordionHeaders);

  // Try scrolling within the east pane's settings area
  // The dev-body or tab-pane is the scrollable container
  await page.evaluate(() => {
    // Try multiple possible scrollable containers
    const containers = [
      document.querySelector('.dev-body'),
      document.querySelector('#queryParamsArea .tab-content'),
      document.querySelector('#queryParamsArea'),
      document.querySelector('.pane_east'),
      document.querySelector('.tab-pane.active'),
    ];
    for (const c of containers) {
      if (c) {
        c.scrollTop = c.scrollHeight;
        console.log('Scrolled:', c.className, 'scrollHeight:', c.scrollHeight);
      }
    }
  });
  await pause(1000);

  // Check if Custom Headers text is visible now
  const customHeadersText = page.locator('text=Custom Headers').first();
  if (await customHeadersText.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('  Found Custom Headers text!');
    await customHeadersText.scrollIntoViewIfNeeded();
    await pause(500);
    await screenshotElement(page, '#queryParamsArea', '53_custom_headers_editor.png');
  } else {
    console.log('  Custom Headers not visible, trying to expand it...');
    // Maybe it's an accordion that needs clicking. Look for clickable headers
    // after Escape Queries
    const escapeQueries = page.locator('text=Escape Queries').first();
    if (await escapeQueries.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('  Found Escape Queries, scrolling past it');
      await escapeQueries.scrollIntoViewIfNeeded();
      await pause(500);
      // Scroll a bit more
      await page.evaluate(() => {
        const containers = [
          document.querySelector('.dev-body'),
          document.querySelector('.tab-pane.active'),
          document.querySelector('#queryParamsArea'),
        ];
        for (const c of containers) {
          if (c) c.scrollTop += 300;
        }
      });
      await pause(500);
    }

    // Check again
    const ch2 = page.locator('text=Custom Headers').first();
    if (await ch2.isVisible({ timeout: 2000 }).catch(() => false)) {
      await screenshotElement(page, '#queryParamsArea', '53_custom_headers_editor.png');
    } else {
      // Screenshot the bottom of the settings pane anyway to see what's there
      console.log('  Still not visible. Taking settings bottom screenshot');
      await screenshotElement(page, '#queryParamsArea', '53_custom_headers_editor.png');
    }
  }

  // ═══════════════════════════════════════════════
  // FIX 55: Settings with accordions expanded
  // Show the full settings with more accordions open
  // ═══════════════════════════════════════════════
  console.log('\n--- Fixing 55: Settings with accordions ---');

  // Scroll back to top of settings
  await page.evaluate(() => {
    const containers = [
      document.querySelector('.dev-body'),
      document.querySelector('.tab-pane.active'),
      document.querySelector('#queryParamsArea'),
    ];
    for (const c of containers) {
      if (c) c.scrollTop = 0;
    }
  });
  await pause(500);

  // Try expanding the "Evaluate Nightly?" and "Escape Queries" accordions
  // by clicking their + icons
  const nightlyHeader = page.locator('text=Evaluate Nightly').first();
  if (await nightlyHeader.isVisible({ timeout: 2000 }).catch(() => false)) {
    await nightlyHeader.click();
    await pause(500);
  }

  const escapeHeader = page.locator('text=Escape Queries').first();
  if (await escapeHeader.isVisible({ timeout: 2000 }).catch(() => false)) {
    await escapeHeader.click();
    await pause(500);
  }

  // Now screenshot showing the accordions in various states
  await screenshotElement(page, '#queryParamsArea', '55_field_picking_settings.png');

  // ═══════════════════════════════════════════════
  // BONUS: Settings scrolled to show Nightly/Escape/CustomHeaders area
  // ═══════════════════════════════════════════════
  console.log('\n--- Capturing settings bottom section ---');
  // Scroll to middle of settings to show Nightly and below
  await page.evaluate(() => {
    const containers = [
      document.querySelector('.dev-body'),
      document.querySelector('.tab-pane.active'),
      document.querySelector('#queryParamsArea'),
    ];
    for (const c of containers) {
      if (c) c.scrollTop = c.scrollHeight / 2;
    }
  });
  await pause(500);
  await screenshotElement(page, '#queryParamsArea', '56_settings_nightly_escape.png');

  console.log('\nDone!');
  await browser.close();
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});

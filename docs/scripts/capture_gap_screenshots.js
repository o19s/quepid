/**
 * Capture gap screenshots identified in the AngularJS UI inventory.
 *
 * Targets missing screenshots:
 *   61: Annotation list with existing annotations
 *   62: Pagination controls (using 20-query case)
 *   63: Detailed document modal with JSON explorer
 *   64: Debug matches / stacked chart with explain
 *   66: Query diff results side-by-side columns
 *   68: Vega visualization ("Visualize your tries")
 *
 * Usage:
 *   node docs/scripts/capture_gap_screenshots.js
 *
 * Prerequisites:
 *   - Docker running with `bin/docker s`
 *   - Sample data loaded with `bin/docker r bundle exec thor sample_data`
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
const HEADED = process.env.HEADED === 'true';
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

async function closeModal(page) {
  for (const selector of [
    '.modal.in button:has-text("Close")',
    '.modal.in .modal-footer .btn-default',
    '.modal.in .modal-header button.close',
    '.modal.in button:has-text("Cancel")',
  ]) {
    try {
      const btn = page.locator(selector).first();
      if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
        await btn.click();
        await pause(800);
        const still = await page.locator('.modal.in').isVisible({ timeout: 500 }).catch(() => false);
        if (!still) return;
      }
    } catch {}
  }
  await page.keyboard.press('Escape');
  await pause(800);
}

// Navigate to a case and wait for queries to load
async function navigateToCase(page, caseName) {
  await page.goto(BASE_URL + '/cases');
  await page.waitForLoadState('networkidle');
  await pause(1000);

  const caseLink = page.locator(`a:has-text("${caseName}")`).first();
  if (await caseLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    await caseLink.click();
  } else {
    console.log(`  ⚠ Could not find case "${caseName}"`);
    return false;
  }

  await page.waitForLoadState('networkidle');
  await pause(3000);
  await waitForAngular(page);

  // Wait for the query list to appear
  await page.waitForSelector('.results-list-element, add-query, #query-container', { timeout: 30000 }).catch(() => {
    console.log('  ⚠ Query list did not appear in time');
  });
  await pause(3000);
  await waitForAngular(page);
  return true;
}

// Open east pane
async function openEastPane(page) {
  const tuneLink = page.locator('a:has-text("Tune Relevance")').first();
  if (await tuneLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    // Check if east pane is already open
    const tabArea = page.locator('.pane_east .nav-tabs');
    const isOpen = await tabArea.isVisible({ timeout: 1000 }).catch(() => false);
    if (!isOpen) {
      await tuneLink.click();
      await pause(1500);
      await waitForAngular(page);
    }
    return true;
  }
  return false;
}

// Close east pane
async function closeEastPane(page) {
  const tabArea = page.locator('.pane_east .nav-tabs');
  const isOpen = await tabArea.isVisible({ timeout: 1000 }).catch(() => false);
  if (isOpen) {
    await page.locator('a:has-text("Tune Relevance")').first().click();
    await pause(500);
  }
}

// Expand the first query row
async function expandFirstQuery(page) {
  // Click the chevron or the query row to expand
  const chevron = page.locator('.results-list-element .fa-chevron-down, .results-list-element .bi-chevron-down').first();
  if (await chevron.isVisible({ timeout: 3000 }).catch(() => false)) {
    await chevron.click();
    await pause(2000);
    await waitForAngular(page);
    return true;
  }
  // Try clicking the query text area
  const queryRow = page.locator('.results-list-element').first();
  if (await queryRow.isVisible({ timeout: 2000 }).catch(() => false)) {
    await queryRow.click();
    await pause(2000);
    await waitForAngular(page);
    return true;
  }
  return false;
}

async function main() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: !HEADED });
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
  await page.waitForLoadState('networkidle');
  await pause(3000);
  console.log('  Logged in. URL:', page.url());

  // ═══════════════════════════════════════════════
  // 61: Annotation list with existing annotations
  // ═══════════════════════════════════════════════
  console.log('\n--- 61: Annotation with items ---');
  try {
    if (await navigateToCase(page, '10s of Queries')) {
      if (await openEastPane(page)) {
        // Click Annotations tab (tabs are <li> elements, not <a>)
        const annotTab = page.locator('#annotationsTab, .nav-tabs li:has-text("Annotations")').first();
        if (await annotTab.isVisible({ timeout: 3000 }).catch(() => false)) {
          await annotTab.click();
          await pause(1000);
          await waitForAngular(page);

          // Create an annotation so we have one visible
          const messageInput = page.locator('.pane_east textarea').first();
          if (await messageInput.isVisible({ timeout: 3000 }).catch(() => false)) {
            await messageInput.fill('Baseline config — default Solr edismax params give us 0.66 AP@10.');
            await pause(300);

            const createBtn = page.locator('.pane_east button:has-text("Create")').first();
            if (await createBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
              await createBtn.click();
              await pause(2000);
              await waitForAngular(page);
            }
          }

          // Screenshot the annotations tab
          await screenshotElement(page, '.pane_east', '61_annotation_list_with_items.png');
        } else {
          console.log('  ⚠ Annotations tab not found');
        }
      }
    }
  } catch (e) {
    console.log(`  ⚠ Failed: ${e.message}`);
  }

  // ═══════════════════════════════════════════════
  // 62: Pagination controls
  // ═══════════════════════════════════════════════
  console.log('\n--- 62: Pagination controls ---');
  try {
    // The "10s of Queries" case has 20 queries - should show pagination if page size < 20
    if (await navigateToCase(page, '10s of Queries')) {
      await closeEastPane(page);
      await pause(1000);

      // Look for pagination
      const pagination = page.locator('[dir-pagination-controls], .pagination').first();
      if (await pagination.isVisible({ timeout: 5000 }).catch(() => false)) {
        await screenshotElement(page, '[dir-pagination-controls], .pagination', '62_pagination_controls.png');
      } else {
        // Scroll to bottom to check
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await pause(1000);
        const pag2 = page.locator('[dir-pagination-controls], .pagination').first();
        if (await pag2.isVisible({ timeout: 2000 }).catch(() => false)) {
          await screenshotElement(page, '[dir-pagination-controls], .pagination', '62_pagination_controls.png');
        } else {
          console.log('  ⚠ Pagination not visible (all queries fit on one page)');
        }
      }
    }
  } catch (e) {
    console.log(`  ⚠ Failed: ${e.message}`);
  }

  // ═══════════════════════════════════════════════
  // 63: Detailed document modal with all fields / JSON
  // ═══════════════════════════════════════════════
  console.log('\n--- 63: Detailed document modal (View All Fields) ---');
  try {
    if (await navigateToCase(page, '10s of Queries')) {
      await closeEastPane(page);
      await expandFirstQuery(page);

      // Find a document title link to click
      // Look for the linked title in search results
      const docLink = page.locator('.result-title a, .doc-title, h4 a[href]').first();
      if (await docLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await docLink.click();
        await pause(2000);
        await waitForAngular(page);

        // Modal should be open
        const modal = page.locator('.modal.in');
        if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
          // Click "View All Fields" to show JSON explorer
          const viewAll = page.locator('.modal.in a:has-text("View All Fields"), .modal.in button:has-text("View All Fields")').first();
          if (await viewAll.isVisible({ timeout: 2000 }).catch(() => false)) {
            await viewAll.click();
            await pause(2000);
            await waitForAngular(page);
          }
          await screenshotElement(page, '.modal.in .modal-content', '63_detailed_doc_all_fields.png');
          await closeModal(page);
        } else {
          console.log('  ⚠ Detailed doc modal did not open');
        }
      } else {
        console.log('  ⚠ No document title link found');
      }
    }
  } catch (e) {
    console.log(`  ⚠ Failed: ${e.message}`);
  }

  // ═══════════════════════════════════════════════
  // 66: Query diff results side-by-side
  // ═══════════════════════════════════════════════
  console.log('\n--- 66: Query diff results ---');
  try {
    if (await navigateToCase(page, '10s of Queries')) {
      await closeEastPane(page);

      // First, take a snapshot
      console.log('  Creating snapshot...');
      const snapLink = page.locator('a:has-text("Create snapshot")').first();
      if (await snapLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await snapLink.click();
        await pause(1500);

        const modal = page.locator('.modal.in');
        if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
          const nameInput = page.locator('.modal.in input[type="text"]').first();
          if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await nameInput.fill('Gap Capture Snapshot');
          }
          const takeBtn = page.locator('.modal.in button:has-text("Take Snapshot")').first();
          if (await takeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await takeBtn.click();
            await pause(5000);
            await waitForAngular(page);
          }
          // Close the modal if still open
          await closeModal(page);
          await pause(1000);
        }
      }

      // Now click Compare snapshots
      console.log('  Opening diff comparison...');
      const diffLink = page.locator('a:has-text("Compare snapshots")').first();
      if (await diffLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await diffLink.click();
        await pause(1500);
        await waitForAngular(page);

        const modal2 = page.locator('.modal.in');
        if (await modal2.isVisible({ timeout: 3000 }).catch(() => false)) {
          // Select snapshot from dropdown
          const dropdown = page.locator('.modal.in select').first();
          if (await dropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
            const options = dropdown.locator('option');
            const optCount = await options.count();
            for (let i = 1; i < optCount; i++) {
              const val = await options.nth(i).getAttribute('value');
              const text = await options.nth(i).textContent();
              if (val && val !== '' && !val.startsWith('?')) {
                console.log(`  Selecting snapshot: ${text.trim()}`);
                await dropdown.selectOption({ index: i });
                break;
              }
            }
            await pause(500);
          }

          // Click Update Comparison Settings
          const updateBtn = page.locator('.modal.in button:has-text("Update Comparison")').first();
          if (await updateBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await updateBtn.click();
            await pause(3000);
            await waitForAngular(page);
          } else {
            await closeModal(page);
          }
        }
      }

      // Now expand a query to see diff columns
      await pause(2000);
      await waitForAngular(page);
      await expandFirstQuery(page);
      await pause(2000);

      // Take screenshot
      await screenshot(page, '66_query_diff_results.png');

      // Clear the comparison
      const clearDiffLink = page.locator('a:has-text("Compare snapshots")').first();
      if (await clearDiffLink.isVisible({ timeout: 2000 }).catch(() => false)) {
        await clearDiffLink.click();
        await pause(1000);
        const clearBtn = page.locator('.modal.in button:has-text("Clear Comparison")').first();
        if (await clearBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await clearBtn.click();
          await pause(1000);
        }
        await closeModal(page);
      }
    }
  } catch (e) {
    console.log(`  ⚠ Failed: ${e.message}`);
  }

  // ═══════════════════════════════════════════════
  // 68: Vega visualization ("Visualize your tries")
  // ═══════════════════════════════════════════════
  console.log('\n--- 68: Vega visualization ---');
  try {
    if (await navigateToCase(page, '10s of Queries')) {
      if (await openEastPane(page)) {
        // Click History tab
        const histTab = page.locator('#historyTab, .nav-tabs li:has-text("History")').first();
        if (await histTab.isVisible({ timeout: 3000 }).catch(() => false)) {
          await histTab.click();
          await pause(1000);
          await waitForAngular(page);

          // Click "Visualize your tries"
          const vizLink = page.locator('a:has-text("Visualize your tries")').first();
          if (await vizLink.isVisible({ timeout: 3000 }).catch(() => false)) {
            // This might open a new page/route
            const [newPage] = await Promise.all([
              context.waitForEvent('page', { timeout: 5000 }).catch(() => null),
              vizLink.click(),
            ]);

            if (newPage) {
              await newPage.waitForLoadState('networkidle').catch(() => {});
              await pause(3000);
              const filepath = path.join(SCREENSHOT_DIR, '68_vega_visualization.png');
              await newPage.screenshot({ path: filepath });
              console.log(`  ✓ 68_vega_visualization.png`);
              await newPage.close();
            } else {
              // It might navigate in the same page or show inline
              await pause(3000);
              await screenshot(page, '68_vega_visualization.png');
            }
          } else {
            console.log('  ⚠ "Visualize your tries" link not found');
          }
        }
      }
    }
  } catch (e) {
    console.log(`  ⚠ Failed: ${e.message}`);
  }

  // ═══════════════════════════════════════════════
  // Done
  // ═══════════════════════════════════════════════
  console.log('\n--- Done ---');
  await browser.close();
  console.log('Screenshots saved to:', SCREENSHOT_DIR);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

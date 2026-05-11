import { test, expect, Page } from '@playwright/test';

// Golden-path smoke suite for the Angular case UI (core.html.erb).
// Each test ends in a baseline screenshot so the BS3 -> BS5 migration's
// per-template PRs have a regression net for "invisible-but-present"
// failures (CLAUDE.md trap #5: popover element exists, aria-describedby set,
// but display/opacity/transform are wrong — Capybara assert_selector won't
// catch this, a pixel diff will).

const CASE_ID = Number(process.env.QUEPID_E2E_CASE_ID ?? 1);

async function gotoCase(page: Page, query: string = ''): Promise<void> {
  const suffix = query ? `?${query}` : '';
  await page.goto(`/case/${CASE_ID}${suffix}`);
  // Angular boots after the layout renders. Wait for the Angular case-name
  // element to exist as the booted-marker.
  await page.waitForSelector('li.ui-sortable-handle, .modal.show', { timeout: 20_000 });
}

async function expandFirstQuery(page: Page): Promise<void> {
  // Idempotent: only click toggle if the query isn't already expanded. Prevents
  // a future "queries default-expanded" change from collapsing them here.
  if (await page.locator('search-result').count() > 0) return;
  const toggle = page.locator('li.ui-sortable-handle .toggleSign[ng-click="query.toggle()"]').first();
  await toggle.click();
  await page.waitForSelector('search-result', { timeout: 15_000 });
}

// Async UI bits whose visibility/content is timing-dependent. Mask in every
// screenshot so the post-search "All queries finished successfully!" flash
// (set by mainCtrl.js after background jobs land) doesn't cause flaky diffs.
function dynamicRegions(page: Page) {
  return [page.locator('#flash-messages')];
}

/**
 * Full-viewport assertions over expanded query + result list: typography, scrollbars,
 * and layout nudge pixel diffs just past the global 1% cap after CSS changes; modal-only
 * shots typically stay tighter. Bump baselines (`yarn test:e2e:update-baselines`) after big
 * visual intent changes — this slack is mostly OS/Chromium rounding, not carte blanche.
 */
function expandedCaseScreenshotOpts(page: Page) {
  return {
    mask: dynamicRegions(page),
    maxDiffPixelRatio: 0.025,
  };
}

test.describe('core layout golden paths', () => {
  test('open case', async ({ page }) => {
    await gotoCase(page);
    await expandFirstQuery(page);
    await expect(page).toHaveScreenshot('open-case.png', expandedCaseScreenshotOpts(page));
  });

  test('explain modal — switch tabs', async ({ page }) => {
    await gotoCase(page);
    await expandFirstQuery(page);

    await page.getByRole('button', { name: 'Explain Query', exact: true }).first().click();

    // Modal tab IDs from app/assets/javascripts/components/query_explain/_modal.html
    await expect(page.locator('#query-explain-tab-params')).toBeVisible();
    await page.locator('#query-explain-tab-parsing').click();
    await expect(page.locator('#query-explain-pane-parsing')).toBeVisible();

    await expect(page).toHaveScreenshot('explain-modal-parsing-tab.png', { mask: dynamicRegions(page) });
  });

  test('open wizard', async ({ page }) => {
    // wizardCtrl.js triggers the modal when ?showWizard=true is in the URL.
    await gotoCase(page, 'showWizard=true');
    const modal = page.locator('.modal.show').first();
    await expect(modal).toBeVisible();
    await expect(modal).toContainText(/Name Your Case|Wizard/i);
    await expect(page).toHaveScreenshot('wizard-open.png', { mask: dynamicRegions(page) });
  });

  test('query results render', async ({ page }) => {
    // Asserts that a query under this case loads its top-N results when
    // expanded. expandFirstQuery() waits for `search-result` elements to
    // exist — if the query failed to execute, that wait would time out.
    await gotoCase(page);
    await expandFirstQuery(page);
    const results = page.locator('search-result');
    await expect(results).not.toHaveCount(0);
    await expect(results.first()).toBeVisible();
    await expect(page).toHaveScreenshot('query-results.png', expandedCaseScreenshotOpts(page));
  });

  test('leave a judgement', async ({ page }) => {
    await gotoCase(page);
    await expandFirstQuery(page);

    // Per app/assets/templates/views/searchResult.html, each result has a
    // .single-rating popover trigger. Click the first one to open the
    // ratings popover (views/ratings/popover.html).
    await page.locator('search-result .single-rating').first().click();
    await expect(page.locator('.popover, [class*="popover"]').first()).toBeVisible({ timeout: 5_000 });

    await expect(page).toHaveScreenshot('judgement-popover.png', expandedCaseScreenshotOpts(page));
  });

  test('take a snapshot', async ({ page }) => {
    await gotoCase(page);
    // queriesLayout.html:94 — <a ng-click="snapshot.prompt()">Create snapshot</a>
    await page.getByText('Create snapshot', { exact: false }).first().click();
    await expect(page.locator('.modal.show').first()).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveScreenshot('snapshot-modal.png', { mask: dynamicRegions(page) });
  });
});

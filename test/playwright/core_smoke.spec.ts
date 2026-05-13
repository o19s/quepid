import { test, expect } from '@playwright/test';
import {
  dynamicRegions,
  expandFirstQuery,
  expandedCaseScreenshotOpts,
  gotoCase,
} from './angular_case_helpers';

// Golden-path smoke suite for the Angular case UI (core.html.erb).
// Each test ends in a baseline screenshot so the BS3 -> BS5 migration's
// per-template PRs have a regression net for "invisible-but-present"
// failures (CLAUDE.md trap #5: popover element exists, aria-describedby set,
// but display/opacity/transform are wrong — Capybara assert_selector won't
// catch this, a pixel diff will).

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

    await expect(page).toHaveScreenshot('explain-modal-parsing-tab.png', expandedCaseScreenshotOpts(page));
  });

  test('open wizard', async ({ page }) => {
    // wizardCtrl.js triggers the modal when ?showWizard=true is in the URL.
    await gotoCase(page, 'showWizard=true');
    const modal = page.locator('.modal.show').first();
    await expect(modal).toBeVisible();
    await expect(modal).toContainText(/Name Your Case|Wizard/i);
    await expect(page).toHaveScreenshot('wizard-open.png', expandedCaseScreenshotOpts(page));
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
    await expect(page).toHaveScreenshot('snapshot-modal.png', {
      mask: dynamicRegions(page),
      maxDiffPixelRatio: 0.065,
    });
  });
});

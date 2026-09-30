import { test, expect } from '@playwright/test';
import {
  dynamicRegions,
  expandFirstQuery,
  expandedCaseScreenshotOpts,
  gotoCase,
  headerDropdownMenu,
  resetCompletedCaseWizard,
} from './case_helpers';

/**
 * One focused tour per major core-layout surface. Each spec loads the
 * page, screenshots, then exercises modal, dropdown, popover, and form-field
 * focus (same case shell), with a screenshot after each step — migration net for
 * BS5 popover/tooltip/modal regressions (see CLAUDE.md trap #5).
 *
 * Baselines: `yarn test:e2e:update-baselines` (Docker: `bin/docker r yarn test:e2e:update-baselines`).
 * Narrow 768×900 subset: `core_pages_narrow_viewport.spec.ts` (Playwright project `chromium-narrow`).
 */

test.describe('Core pages — interaction screenshots', () => {
  test('cases list — header case picker & filters', async ({ page }) => {
    await gotoCase(page);
    await expandFirstQuery(page);
    await expect(page).toHaveScreenshot('cases-list-01-case-loaded.png', expandedCaseScreenshotOpts(page));

    await page.locator('#header').getByRole('button', { name: /Relevancy Cases/i }).click();
    const relevancyMenu = headerDropdownMenu(page, 'Relevancy Cases');
    await expect(relevancyMenu).toBeVisible();
    await expect(page).toHaveScreenshot('cases-list-02-relevancy-cases-dropdown.png', {
      mask: dynamicRegions(page),
      maxDiffPixelRatio: 0.025,
    });

    await page.keyboard.press('Escape');

    await page.locator('#queries-filter').focus();
    await expect(page).toHaveScreenshot('cases-list-03-query-filter-focused.png', expandedCaseScreenshotOpts(page));

    await page.locator('#header').getByRole('button', { name: /Books/i }).click();
    const booksMenu = headerDropdownMenu(page, 'Books');
    await expect(booksMenu).toBeVisible();
    await expect(booksMenu).toContainText('RECENT BOOKS');
    await expect(page).toHaveScreenshot('cases-list-04-books-dropdown.png', {
      mask: dynamicRegions(page),
      maxDiffPixelRatio: 0.025,
    });

    await page.keyboard.press('Escape');

    await page.getByText('Share case', { exact: true }).click();
    await expect(page.locator('.modal.show')).toContainText(/Share Case/i);
    await expect(page).toHaveScreenshot('cases-list-05-share-case-modal.png', expandedCaseScreenshotOpts(page));

    await page.locator('.modal.show').locator('.btn-close').click();
    await expect(page.locator('.modal.show')).toHaveCount(0);

    await page.locator('search-result .single-rating').first().click();
    await expect(page.locator('.popover, [class*="popover"]').first()).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveScreenshot('cases-list-06-judgement-popover.png', expandedCaseScreenshotOpts(page));
  });

  test('query editor — options & explain modals, notes field', async ({ page }) => {
    await gotoCase(page);
    await expandFirstQuery(page);
    await expect(page).toHaveScreenshot('query-editor-01-query-expanded.png', expandedCaseScreenshotOpts(page));

    await page.getByRole('button', { name: 'Set Options', exact: true }).first().click();
    await expect(page.locator('.modal.show')).toContainText('Query Options');
    await expect(page).toHaveScreenshot('query-editor-02-query-options-modal.png', expandedCaseScreenshotOpts(page));

    await page.locator('.modal.show').getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.locator('.modal.show')).toHaveCount(0);

    await page.getByRole('button', { name: 'Explain Query', exact: true }).first().click();
    await expect(page.locator('#query-explain-tab-params')).toBeVisible();
    await expect(page).toHaveScreenshot('query-editor-03-explain-modal.png', expandedCaseScreenshotOpts(page));

    await page.locator('.modal.show').locator('.btn-core-close').first().click();
    await expect(page.locator('.modal.show')).toHaveCount(0);

    await page.getByRole('button', { name: 'Toggle Notes', exact: true }).first().click();
    await page.locator('textarea[data-query-notes-target="notes"]:visible').first().focus();
    await expect(page).toHaveScreenshot('query-editor-04-notes-focused.png', expandedCaseScreenshotOpts(page));

    await page.locator('search-result .single-rating').first().click();
    await expect(page.locator('.popover, [class*="popover"]').first()).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveScreenshot('query-editor-05-judgement-popover.png', expandedCaseScreenshotOpts(page));
    await page.keyboard.press('Escape');

    await page.locator('#header').getByRole('button', { name: /Relevancy Cases/i }).click();
    await expect(headerDropdownMenu(page, 'Relevancy Cases')).toBeVisible();
    await expect(page).toHaveScreenshot('query-editor-06-relevancy-cases-dropdown.png', {
      mask: dynamicRegions(page),
      maxDiffPixelRatio: 0.025,
    });
  });

  test('rating UI — judgement popover & snapshot modal', async ({ page }) => {
    await gotoCase(page);
    await expandFirstQuery(page);
    await expect(page).toHaveScreenshot('rating-ui-01-results-visible.png', expandedCaseScreenshotOpts(page));

    await page.locator('#header').getByRole('button', { name: /Relevancy Cases/i }).click();
    await expect(headerDropdownMenu(page, 'Relevancy Cases')).toBeVisible();
    await expect(page).toHaveScreenshot('rating-ui-02-relevancy-cases-dropdown.png', {
      mask: dynamicRegions(page),
      maxDiffPixelRatio: 0.025,
    });
    await page.keyboard.press('Escape');

    await page.locator('search-result .single-rating').first().click();
    await expect(page.locator('.popover, [class*="popover"]').first()).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveScreenshot('rating-ui-03-judgement-popover.png', expandedCaseScreenshotOpts(page));

    await page.keyboard.press('Escape');

    await page.locator('a[data-controller="take-snapshot-core"]').click();
    await expect(page.locator('#takeSnapshotModal.show')).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveScreenshot('rating-ui-04-snapshot-modal.png', {
      mask: dynamicRegions(page),
      maxDiffPixelRatio: 0.05,
    });

    const snapshotModal = page.locator('#takeSnapshotModal.show');
    await snapshotModal.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.locator('.modal.show')).toHaveCount(0);

    await page.locator('#queries-filter').focus();
    await expect(page).toHaveScreenshot('rating-ui-05-query-filter-focused.png', expandedCaseScreenshotOpts(page));
  });

  test('scorer config — select scorer modal', async ({ page }) => {
    await gotoCase(page);
    await expandFirstQuery(page);
    await expect(page).toHaveScreenshot('scorer-config-01-before-scorer-modal.png', expandedCaseScreenshotOpts(page));

    await page.locator('a[data-controller="pick-scorer-core"]').click();
    await expect(page.locator('#pickScorerModal.show')).toContainText(/How would you like to score/i);
    await expect(page).toHaveScreenshot('scorer-config-02-pick-scorer-modal.png', expandedCaseScreenshotOpts(page));

    const picker = page.locator('#pickScorerModal.show');
    const firstScorer = picker.locator('.list-group-item').first();
    await firstScorer.click();
    await expect(page).toHaveScreenshot('scorer-config-03-scorer-highlighted.png', expandedCaseScreenshotOpts(page));

    await picker.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.locator('.modal.show')).toHaveCount(0);

    await page.locator('search-result .single-rating').first().click();
    await expect(page.locator('.popover, [class*="popover"]').first()).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveScreenshot('scorer-config-04-judgement-popover.png', expandedCaseScreenshotOpts(page));
    await page.keyboard.press('Escape');

    await page.locator('#header').getByRole('button', { name: /Books/i }).click();
    await expect(headerDropdownMenu(page, 'Books')).toBeVisible();
    await expect(page).toHaveScreenshot('scorer-config-05-books-dropdown.png', {
      mask: dynamicRegions(page),
      maxDiffPixelRatio: 0.025,
    });
    await page.keyboard.press('Escape');

    await page.locator('#queries-filter').focus();
    await expect(page).toHaveScreenshot('scorer-config-06-filter-focused.png', expandedCaseScreenshotOpts(page));
  });

  test('wizard — welcome, name, endpoint steps', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('cases');
    await resetCompletedCaseWizard(page);
    await gotoCase(page, 'showWizard=true', 6);
    const modal = page.locator('.modal.show').first();
    const continueButton = modal.getByRole('button', { name: /^Continue$/i }).filter({ visible: true });
    // Steps stay hidden until the wizard has loaded; wait for a real heading, not just the modal.
    await expect(modal.getByRole('heading', { name: /Welcome To Quepid/i })).toBeVisible({ timeout: 15_000 });
    // The modal can be ready before the case behind it has loaded; wait so the backdrop is stable.
    await expect(page.locator('.results-list-element li').first()).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveScreenshot('wizard-01-welcome-step.png', expandedCaseScreenshotOpts(page));

    await continueButton.click();
    await expect(modal.getByRole('heading', { name: /Name Your Case/i })).toBeVisible();
    await expect(page).toHaveScreenshot('wizard-02-name-step.png', expandedCaseScreenshotOpts(page));

    const nameInput = modal.getByLabel('New Case Name:');
    await nameInput.focus();
    await expect(page).toHaveScreenshot('wizard-03-case-name-focused.png', expandedCaseScreenshotOpts(page));

    await nameInput.fill('Playwright wizard tour');
    await continueButton.click();
    await expect(modal.getByRole('heading', { name: /What Search Endpoint/i })).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveScreenshot('wizard-04-endpoint-step.png', expandedCaseScreenshotOpts(page));

    // Don't close the wizard: on this shared fixture case the ✕ and Cancel both offer to
    // delete the case. Reloading the case page below dismisses it without finishing.
    await gotoCase(page, '', 6);
    await expandFirstQuery(page);

    await page.locator('#header').getByRole('button', { name: /Relevancy Cases/i }).click();
    await expect(headerDropdownMenu(page, 'Relevancy Cases')).toBeVisible();
    await expect(page).toHaveScreenshot('wizard-05-relevancy-cases-dropdown.png', {
      // expandFirstQuery() above leaves a real, live search result expanded
      // in the background -- irrelevant to this screenshot's actual subject
      // (the dropdown) and not deterministic between runs, so mask it too.
      mask: [...dynamicRegions(page), page.locator('search-result')],
      maxDiffPixelRatio: 0.025,
    });
    await page.keyboard.press('Escape');

    await page.locator('search-result .single-rating').first().click();
    await expect(page.locator('.popover, [class*="popover"]').first()).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveScreenshot('wizard-06-judgement-popover.png', {
      // Keep the expanded result visible here: the judgement popover is
      // rendered inside that result, so masking the whole <search-result>
      // would mask the very UI this screenshot is meant to prove.
      mask: dynamicRegions(page),
      maxDiffPixelRatio: 0.025,
    });
    await page.keyboard.press('Escape');

    await page.getByText('Share case', { exact: true }).click();
    await expect(page.locator('.modal.show')).toContainText(/Share Case/i);
    await expect(page).toHaveScreenshot('wizard-07-share-case-modal.png', expandedCaseScreenshotOpts(page));
    await page.locator('.modal.show').locator('.btn-close').click();
    await expect(page.locator('.modal.show')).toHaveCount(0);

    await page.locator('#queries-filter').focus();
    await expect(page).toHaveScreenshot('wizard-08-query-filter-focused.png', expandedCaseScreenshotOpts(page));
  });
});

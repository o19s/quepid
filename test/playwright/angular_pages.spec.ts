import { test, expect } from '@playwright/test';
import {
  CASE_ID,
  dynamicRegions,
  expandFirstQuery,
  expandedCaseScreenshotOpts,
  gotoCase,
} from './angular_case_helpers';

/**
 * One focused tour per major Angular (core layout) surface. Each spec loads the
 * page, screenshots, then exercises modal, dropdown, popover, and form-field
 * focus (same case shell), with a screenshot after each step — migration net for
 * BS5 popover/tooltip/modal regressions (see CLAUDE.md trap #5).
 *
 * Baselines: `yarn test:e2e:update-baselines` (Docker: `bin/docker r yarn test:e2e:update-baselines`).
 */

test.describe('Angular pages — interaction screenshots', () => {
  test('cases list — header case picker & filters', async ({ page }) => {
    await gotoCase(page);
    await expandFirstQuery(page);
    await expect(page).toHaveScreenshot('cases-list-01-case-loaded.png', expandedCaseScreenshotOpts(page));

    await page.locator('#header').getByRole('button', { name: /Relevancy Cases/i }).click();
    const relevancyMenu = page.locator('#header li.dropdown').nth(0).locator('.dropdown-menu');
    await expect(relevancyMenu).toBeVisible();
    await expect(page).toHaveScreenshot('cases-list-02-relevancy-cases-dropdown.png', {
      mask: dynamicRegions(page),
      maxDiffPixelRatio: 0.025,
    });

    await page.keyboard.press('Escape');

    await page.locator('#queries-filter').focus();
    await expect(page).toHaveScreenshot('cases-list-03-query-filter-focused.png', expandedCaseScreenshotOpts(page));

    await page.locator('#header').getByRole('button', { name: /Books/i }).click();
    const booksMenu = page.locator('#header li.dropdown').nth(1).locator('.dropdown-menu');
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

    await page.locator('.modal.show').locator('.btn-core-close').first().click();
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
    await page.locator('#notes').focus();
    await expect(page).toHaveScreenshot('query-editor-04-notes-focused.png', expandedCaseScreenshotOpts(page));

    await page.locator('search-result .single-rating').first().click();
    await expect(page.locator('.popover, [class*="popover"]').first()).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveScreenshot('query-editor-05-judgement-popover.png', expandedCaseScreenshotOpts(page));
    await page.keyboard.press('Escape');

    await page.locator('#header').getByRole('button', { name: /Relevancy Cases/i }).click();
    await expect(page.locator('#header li.dropdown').nth(0).locator('.dropdown-menu')).toBeVisible();
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
    await expect(page.locator('#header li.dropdown').nth(0).locator('.dropdown-menu')).toBeVisible();
    await expect(page).toHaveScreenshot('rating-ui-02-relevancy-cases-dropdown.png', {
      mask: dynamicRegions(page),
      maxDiffPixelRatio: 0.025,
    });
    await page.keyboard.press('Escape');

    await page.locator('search-result .single-rating').first().click();
    await expect(page.locator('.popover, [class*="popover"]').first()).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveScreenshot('rating-ui-03-judgement-popover.png', expandedCaseScreenshotOpts(page));

    await page.keyboard.press('Escape');

    await page.getByText('Create snapshot', { exact: false }).first().click();
    await expect(page.locator('.modal.show').first()).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveScreenshot('rating-ui-04-snapshot-modal.png', {
      mask: dynamicRegions(page),
      maxDiffPixelRatio: 0.05,
    });

    const snapshotModal = page.locator('.modal.show').filter({ hasText: /Take a Snapshot/i });
    await snapshotModal.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.locator('.modal.show')).toHaveCount(0);

    await page.locator('#queries-filter').focus();
    await expect(page).toHaveScreenshot('rating-ui-05-query-filter-focused.png', expandedCaseScreenshotOpts(page));
  });

  test('scorer config — select scorer modal', async ({ page }) => {
    await gotoCase(page);
    await expandFirstQuery(page);
    await expect(page).toHaveScreenshot('scorer-config-01-before-scorer-modal.png', expandedCaseScreenshotOpts(page));

    await page.getByText('Select scorer', { exact: true }).click();
    await expect(page.locator('.modal.show')).toContainText(/How would you like to score/i);
    await expect(page).toHaveScreenshot('scorer-config-02-pick-scorer-modal.png', expandedCaseScreenshotOpts(page));

    const picker = page.locator('.modal.show').first();
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
    await expect(page.locator('#header li.dropdown').nth(1).locator('.dropdown-menu')).toBeVisible();
    await expect(page).toHaveScreenshot('scorer-config-05-books-dropdown.png', {
      mask: dynamicRegions(page),
      maxDiffPixelRatio: 0.025,
    });
    await page.keyboard.press('Escape');

    await page.locator('#queries-filter').focus();
    await expect(page).toHaveScreenshot('scorer-config-06-filter-focused.png', expandedCaseScreenshotOpts(page));
  });

  test('wizard — welcome, name step, accordion', async ({ page }) => {
    await gotoCase(page, 'showWizard=true');
    const modal = page.locator('.modal.show').first();
    await expect(modal).toBeVisible();
    await expect(modal).toContainText(/Welcome To Quepid|Name Your Case|Wizard/i);
    await expect(page).toHaveScreenshot('wizard-01-welcome-step.png', expandedCaseScreenshotOpts(page));

    await modal.getByRole('button', { name: /^Continue$/i }).filter({ visible: true }).click();
    await expect(modal).toContainText('Name Your Case');
    await expect(page).toHaveScreenshot('wizard-02-name-step.png', expandedCaseScreenshotOpts(page));

    const nameInput = modal.locator('input[ng-model="pendingWizardSettings.caseName"]');
    // Wizard steps may leave prior-step fields in the DOM with display:none; call DOM focus
    // so we target the Name-step field without Playwright's visible-element checks (focus() has no force).
    await nameInput.evaluate((el: HTMLElement) => el.focus());
    await expect(page).toHaveScreenshot('wizard-03-case-name-focused.png', expandedCaseScreenshotOpts(page));

    await nameInput.fill('Playwright wizard tour', { force: true });
    await expect(modal.getByRole('heading', { name: /What Search Endpoint/i })).toBeVisible({ timeout: 15_000 });
    await modal.getByRole('button', { name: 'Create a new Search Endpoint' }).click();
    await expect(page).toHaveScreenshot('wizard-04-endpoint-accordion.png', expandedCaseScreenshotOpts(page));

    // Wizard body has no standalone popover; close and exercise modal/dropdown/popover/form on the case shell.
    await page.locator('#wizard').getByRole('button', { name: 'Close', exact: true }).click();
    // Wizard uses BS3-style $quepidModal; dismiss can leave `.modal.show` briefly during hide.
    await page.keyboard.press('Escape');
    await expect(page.locator('.modal.show')).toHaveCount(0, { timeout: 10_000 });

    await page.goto(`/case/${CASE_ID}`);
    await page.waitForSelector('li.ui-sortable-handle, .modal.show', { timeout: 20_000 });
    await expandFirstQuery(page);

    await page.locator('#header').getByRole('button', { name: /Relevancy Cases/i }).click();
    await expect(page.locator('#header li.dropdown').nth(0).locator('.dropdown-menu')).toBeVisible();
    await expect(page).toHaveScreenshot('wizard-05-relevancy-cases-dropdown.png', {
      mask: dynamicRegions(page),
      maxDiffPixelRatio: 0.025,
    });
    await page.keyboard.press('Escape');

    await page.locator('search-result .single-rating').first().click();
    await expect(page.locator('.popover, [class*="popover"]').first()).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveScreenshot('wizard-06-judgement-popover.png', expandedCaseScreenshotOpts(page));
    await page.keyboard.press('Escape');

    await page.getByText('Share case', { exact: true }).click();
    await expect(page.locator('.modal.show')).toContainText(/Share Case/i);
    await expect(page).toHaveScreenshot('wizard-07-share-case-modal.png', expandedCaseScreenshotOpts(page));
    await page.locator('.modal.show').locator('.btn-core-close').first().click();
    await expect(page.locator('.modal.show')).toHaveCount(0);

    await page.locator('#queries-filter').focus();
    await expect(page).toHaveScreenshot('wizard-08-query-filter-focused.png', expandedCaseScreenshotOpts(page));
  });
});

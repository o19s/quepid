import { test, expect } from '@playwright/test';
import {
  CASE_ID,
  dynamicRegions,
  expandFirstQuery,
  expandedCaseScreenshotOpts,
  gotoCase,
} from './angular_case_helpers';

/**
 * Reflow smoke at **768×900** (see `chromium-narrow` in `playwright.config.ts`).
 * Catches grid/gutter and header layout regressions that often pass at 1280×900 alone.
 *
 * Subset of `angular_pages.spec.ts`: **wizard accordion first on a bare `?showWizard=true` load**, then cases
 * list + dropdown + share modal — avoids flaky wizard steps when MySQL wizard state was touched by shell steps earlier in the tour.
 *
 * Baselines: `yarn test:e2e:update-baselines` (Docker: `bin/docker r yarn test:e2e:update-baselines`).
 */
test.describe('Angular core — narrow viewport slice (768×900)', () => {
  test('wizard endpoint accordion + cases list reflow', async ({ page }) => {
    await page.goto(`/case/${CASE_ID}?showWizard=true`);
    await page.waitForSelector('li.ui-sortable-handle, .modal.show', { timeout: 20_000 });
    const modal = page.locator('.modal.show').first();
    await expect(modal).toBeVisible();

    await modal.getByRole('button', { name: /^Continue$/i }).filter({ visible: true }).click();
    await expect(modal).toContainText('Name Your Case');

    const nameInput = modal.locator('input[ng-model="pendingWizardSettings.caseName"]');
    await nameInput.evaluate((el: HTMLElement) => el.focus());
    await nameInput.fill('Playwright narrow tour', { force: true });
    await expect(modal.getByRole('heading', { name: /What Search Endpoint/i })).toBeVisible({ timeout: 15_000 });
    await modal.getByRole('button', { name: 'Create a new Search Endpoint' }).click();
    await expect(page).toHaveScreenshot('narrow-01-wizard-endpoint-accordion.png', expandedCaseScreenshotOpts(page));

    await page.locator('#wizard').getByRole('button', { name: 'Close', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.modal.show')).toHaveCount(0, { timeout: 10_000 });

    await gotoCase(page);
    await expandFirstQuery(page);
    await expect(page).toHaveScreenshot('narrow-02-case-loaded.png', expandedCaseScreenshotOpts(page));

    await page.locator('#header').getByRole('button', { name: /Relevancy Cases/i }).click();
    const relevancyMenu = page.locator('#header li.dropdown').nth(0).locator('.dropdown-menu');
    await expect(relevancyMenu).toBeVisible();
    await expect(page).toHaveScreenshot('narrow-03-relevancy-dropdown.png', {
      mask: dynamicRegions(page),
      maxDiffPixelRatio: 0.025,
    });
    await page.keyboard.press('Escape');

    await page.getByText('Share case', { exact: true }).click();
    await expect(page.locator('.modal.show')).toContainText(/Share Case/i);
    await expect(page).toHaveScreenshot('narrow-04-share-case-modal.png', expandedCaseScreenshotOpts(page));
    await page.locator('.modal.show').locator('.btn-core-close').first().click();
    await expect(page.locator('.modal.show')).toHaveCount(0);
  });
});

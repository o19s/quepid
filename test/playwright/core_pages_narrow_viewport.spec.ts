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
 * Reflow smoke at **768×900** (see `chromium-narrow` in `playwright.config.ts`).
 * Catches grid/gutter and header layout regressions that often pass at 1280×900 alone.
 *
 * Subset of `core_pages.spec.ts`: **wizard endpoint step on a `?showWizard=true` load**, then cases
 * list + dropdown + share modal.
 *
 * Baselines: `yarn test:e2e:update-baselines` (Docker: `bin/docker r yarn test:e2e:update-baselines`).
 */
test.describe('Core case — narrow viewport slice (768×900)', () => {
  test('wizard endpoint step + cases list reflow', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('cases');
    await resetCompletedCaseWizard(page);
    await gotoCase(page, 'showWizard=true', 6);
    const modal = page.locator('.modal.show').first();
    const continueButton = modal.getByRole('button', { name: /^Continue$/i }).filter({ visible: true });
    await expect(modal.getByRole('heading', { name: /Welcome To Quepid/i })).toBeVisible({ timeout: 15_000 });

    await continueButton.click();
    await expect(modal.getByRole('heading', { name: /Name Your Case/i })).toBeVisible();
    await modal.getByLabel('New Case Name:').fill('Playwright narrow tour');
    await continueButton.click();
    await expect(modal.getByRole('heading', { name: /What Search Endpoint/i })).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveScreenshot('narrow-01-wizard-endpoint-step.png', expandedCaseScreenshotOpts(page));

    // Don't close the wizard: on this shared fixture case the ✕ and Cancel both offer to
    // delete the case. Reloading the case page below dismisses it without finishing.
    await gotoCase(page, '', 6);
    await expandFirstQuery(page);
    // This step is really just scene-setting for the dropdown/share-modal
    // shots below -- expandFirstQuery() leaves a real, live search result
    // expanded that isn't deterministic between runs, so mask it too.
    await expect(page).toHaveScreenshot('narrow-02-case-loaded.png', {
      mask: [...dynamicRegions(page), page.locator('search-result')],
      maxDiffPixelRatio: 0.025,
    });

    // Below the `lg` breakpoint the header's nav now lives behind a collapsed
    // `.navbar-collapse` (see 16.2 in docs/manual-testing/tracking.yml) — open the
    // toggler before the nav links are clickable.
    await page.locator('#header .navbar-toggler').click();
    await page.locator('#header').getByRole('button', { name: /Relevancy Cases/i }).click();
    const relevancyMenu = headerDropdownMenu(page, 'Relevancy Cases');
    await expect(relevancyMenu).toBeVisible();
    await expect(page).toHaveScreenshot('narrow-03-relevancy-dropdown.png', {
      mask: dynamicRegions(page),
      maxDiffPixelRatio: 0.025,
    });
    await page.keyboard.press('Escape');

    await page.getByText('Share case', { exact: true }).click();
    await expect(page.locator('.modal.show')).toContainText(/Share Case/i);
    await expect(page).toHaveScreenshot('narrow-04-share-case-modal.png', expandedCaseScreenshotOpts(page));
    await page.locator('.modal.show').locator('.btn-close').click();
    await expect(page.locator('.modal.show')).toHaveCount(0);
  });
});

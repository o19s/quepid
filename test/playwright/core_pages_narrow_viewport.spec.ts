import { test, expect } from '@playwright/test';
import {
  expandFirstQuery,
  gotoCase,
  headerDropdownMenu,
  resetCompletedCaseWizard,
} from './case_helpers';

/**
 * Reflow smoke at **768×900** (see `chromium-narrow` in `playwright.config.ts`).
 * Catches grid/gutter and header layout regressions that often pass at 1280×900 alone.
 *
 * Subset of `core_pages.spec.ts`: **wizard endpoint step on a `?showWizard=true` load**, then cases
 * list + collapsed-nav dropdown + share modal. Pixel baselines for the narrow layout live in
 * `visual_smoke.spec.ts` (`yarn test:visual`).
 */
test.describe('Core case — narrow viewport slice (768×900)', () => {
  test('wizard endpoint step + cases list reflow', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('cases');
    await resetCompletedCaseWizard(page);
    await gotoCase(page, 'showWizard=true');
    const modal = page.locator('.modal.show').first();
    const continueButton = modal.getByRole('button', { name: /^Continue$/i }).filter({ visible: true });
    await expect(modal.getByRole('heading', { name: /Welcome To Quepid/i })).toBeVisible({ timeout: 15_000 });

    await continueButton.click();
    await expect(modal.getByRole('heading', { name: /Name Your Case/i })).toBeVisible();
    await modal.getByLabel('New Case Name:').fill('Playwright narrow tour');
    await continueButton.click();
    await expect(modal.getByRole('heading', { name: /What Search Endpoint/i })).toBeVisible({ timeout: 15_000 });

    // Don't close the wizard: the ✕ and Cancel both offer to delete the case, and CASE_ID is
    // the shared fixture most specs use. Reloading the case page below dismisses it without finishing.
    await gotoCase(page);
    await expandFirstQuery(page);

    // Below the `lg` breakpoint the header's nav now lives behind a collapsed
    // `.navbar-collapse` (see 16.2 in docs/manual-testing/tracking.yml) — open the
    // toggler before the nav links are clickable.
    await page.locator('#header .navbar-toggler').click();
    await page.locator('#header').getByRole('button', { name: /Relevancy Cases/i }).click();
    const relevancyMenu = headerDropdownMenu(page, 'Relevancy Cases');
    await expect(relevancyMenu).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByText('Share case', { exact: true }).click();
    await expect(page.locator('.modal.show')).toContainText(/Share Case/i);
    await page.locator('.modal.show').locator('.btn-close').click();
    await expect(page.locator('.modal.show')).toHaveCount(0);
  });
});

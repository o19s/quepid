import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expandFirstQuery, gotoCase } from './case_helpers';

/**
 * Pragmatic a11y guard when the BS3/BS5 modal stack changes: run axe on the open
 * Explain Query dialog only (not a full WCAG program).
 *
 * `color-contrast` is disabled — legacy theme noise; we care about structure/ARIA/focus
 * class regressions from framework swaps.
 */
test.describe('Core case — modal a11y (axe)', () => {
  test('Explain Query modal has no critical/serious axe violations (modal scope)', async ({ page }) => {
    await gotoCase(page);
    await expandFirstQuery(page);

    await page.getByRole('button', { name: 'Explain Query', exact: true }).first().click();
    await expect(page.locator('#query-explain-tab-params')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include('.modal.show')
      .disableRules(['color-contrast'])
      .analyze();

    const impactful = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(impactful, JSON.stringify(impactful, null, 2)).toEqual([]);
  });

  // Bootstrap only handles Escape while focus is inside the modal. A failed move
  // disables the footer button mid-request, dropping focus to <body>; the
  // document-level fallback in utils/bs_modal.js must still close the modal.
  test('Move Query modal closes on Escape after focus falls to the body', async ({ page }) => {
    await gotoCase(page);
    await page.route('**/api/cases/*/queries/**', (route) =>
      route.request().method() === 'GET' ? route.continue() : route.fulfill({ status: 500, json: {} }),
    );
    await expandFirstQuery(page);

    await page.getByRole('button', { name: 'Move Query', exact: true }).first().click();
    const modal = page.locator('#moveQueryModal');
    await modal.locator('.list-group-item').first().click();
    await modal.locator('[data-move-query-core-target="submitButton"]').click();
    await expect(page.getByText('Unable to move query.')).toBeVisible();
    await expect(modal).toBeVisible();
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);

    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
  });
});

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expandFirstQuery, gotoCase } from './angular_case_helpers';

/**
 * Pragmatic a11y guard when the BS3/BS5 modal stack changes: run axe on the open
 * Explain Query dialog only (not a full WCAG program).
 *
 * `color-contrast` is disabled — legacy theme noise; we care about structure/ARIA/focus
 * class regressions from framework swaps.
 */
test.describe('Angular core — modal a11y (axe)', () => {
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
});

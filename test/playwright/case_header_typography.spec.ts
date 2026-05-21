import { test, expect } from '@playwright/test';
import { gotoCase } from './angular_case_helpers';

/**
 * Case header title typography (#case-header h1). BS5 reboot fluid headings
 * rendered the case name and metadata too small vs legacy BS3 (PR #1703).
 *
 * Markup uses BS5 utilities (fs-1 on the h1, fs-6 on the smalls); this spec
 * pins the rendered relationship rather than a single px value, so BS5 RFS
 * minor bumps don't break it.
 */

test.describe('case header typography', () => {
  test('case title h1 stays on the BS5 heading scale and dominates its subtitle', async ({ page }) => {
    await gotoCase(page);

    const title = page.locator('#case-header h1');
    const subtitle = page.locator('#case-header h1 > small').first();

    await expect(title).toBeVisible();
    await expect(subtitle).toBeVisible();

    const titlePx = await title.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    const subtitlePx = await subtitle.evaluate(el => parseFloat(getComputedStyle(el).fontSize));

    // fs-1 is 2.5rem (40px) at >=1200px, scales down to ~33px via RFS.
    expect(titlePx, 'h1 font-size (px) — expected BS5 fs-1 scale').toBeGreaterThanOrEqual(32);

    // Subtitle (fs-6 = 1rem) must read as clearly secondary copy, not heading.
    expect(subtitlePx, 'subtitle font-size (px) — expected BS5 fs-6 scale').toBeLessThan(titlePx * 0.6);
  });
});

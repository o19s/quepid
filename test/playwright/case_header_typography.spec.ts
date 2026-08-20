import { test, expect } from '@playwright/test';
import { gotoCase } from './angular_case_helpers';

/**
 * Case header title typography (#case-header h1). BS5 reboot fluid headings
 * rendered the case name and metadata too small vs legacy BS3 (PR #1703).
 *
 * The h1 uses BS5's `fs-1` utility. The `<small>` subtitles don't carry a
 * `fs-*` class at all — their size comes from `.results-control h1 small {
 * font-size: 0.875em }` in core-additions.css, deliberately relative to the
 * h1's own font-size so it survives stackedChart.css's unscoped
 * `small { font-size: 11px }` leak (which would otherwise flatten the
 * subtitle to a fixed size regardless of the heading). This spec pins that
 * ratio rather than a single px value, so BS5 RFS minor bumps don't break it.
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

    // Subtitle must read as clearly secondary copy, not heading.
    expect(subtitlePx, 'subtitle must be smaller than the title').toBeLessThan(titlePx);

    // Pin the 0.875em ratio so a regression to a fixed px size (e.g. the
    // stackedChart.css `small` leak returning) gets caught even though the
    // absolute px values move with RFS.
    expect(subtitlePx / titlePx, 'subtitle/title font-size ratio — expected core-additions.css\'s 0.875em rule').toBeCloseTo(0.875, 1);
  });
});

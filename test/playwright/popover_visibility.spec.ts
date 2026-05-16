import { test, expect } from '@playwright/test';
import { expandFirstQuery, gotoCase } from './angular_case_helpers';

/**
 * CLAUDE.md — Migrating angular-ui-bootstrap → native BS5, trap #5:
 * the popover node can exist in the DOM with `aria-describedby` set while
 * remaining unpainted (e.g. `display: none` / `opacity: 0` from BS3 `.fade`
 * or cascade clashes). Screenshot diffs in an empty region can miss that.
 *
 * This spec fails fast on that class of regression without relying on pixels.
 */

test.describe('BS3↔BS5 popover paint (trap #5)', () => {
  test('judgement popover tip is visible in computed style', async ({ page }) => {
    await gotoCase(page);
    await expandFirstQuery(page);

    const trigger = page.locator('search-result .single-rating').first();
    await trigger.click();

    await expect(trigger).toHaveAttribute('aria-describedby', /\S+/, { timeout: 5_000 });
    const tipId = await trigger.getAttribute('aria-describedby');
    expect(tipId, 'Bootstrap should link trigger to tip via aria-describedby').toBeTruthy();

    const paint = await page.evaluate((id: string) => {
      const el = document.getElementById(id);
      if (!el) {
        return { ok: false as const, reason: 'missing-element' };
      }
      const s = getComputedStyle(el);
      const opacity = parseFloat(s.opacity || '0');
      return {
        ok: true as const,
        display: s.display,
        opacity,
      };
    }, tipId!);

    if (!paint.ok) {
      throw new Error(`Popover tip #${tipId} not found while aria-describedby is set`);
    }

    const { display, opacity } = paint;

    expect(
      display,
      'getComputedStyle(display) must not be "none" (invisible-but-present tip)',
    ).not.toBe('none');

    expect(opacity, 'getComputedStyle(opacity) must be > 0').toBeGreaterThan(0);
  });
});

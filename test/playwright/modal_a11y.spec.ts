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

for (const [name, id] of [['Export', 'exportCaseModal'], ['Compare snapshots', 'diffModal'], ['Judgements', 'judgementsModal']]) {
  test(`${name} has labeled selects and ordered headings`, async ({ page }) => {
    if (id === 'judgementsModal') await page.goto('case/6');
    else await gotoCase(page);
    await page.getByRole('link', { name, exact: true }).click();
    const modal = page.locator(`#${id}`);
    await expect(modal).toBeVisible();
    if (id === 'diffModal') {
      await modal.getByRole('button', { name: 'Add Snapshot' }).click();
      await expect(modal.getByLabel('Snapshot 1:', { exact: true })).toBeVisible();
      await expect(modal.getByLabel('Snapshot 2:', { exact: true })).toBeVisible();
    }
    if (id === 'judgementsModal') {
      await modal.getByText('Book of Ratings', { exact: true }).click();
      await expect(modal.getByRole('heading', { name: 'Case Integration', level: 3 })).toBeVisible();
    }
    if (id === 'exportCaseModal') await expect(modal.getByLabel('API snapshot')).toBeVisible();
    const results = await new AxeBuilder({ page }).include(`#${id}`)
      .withRules(['select-name', 'heading-order']).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
    await modal.getByRole('button', { name: 'Close', exact: true }).focus();
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab');
      // Chromium may move focus to BODY at its browser-chrome boundary.
      // Background interactive controls must never receive focus.
      await expect.poll(() => modal.evaluate(el => ({
        allowed: el.contains(document.activeElement) || document.activeElement === document.body,
        focused: document.activeElement?.outerHTML.slice(0, 200)
      }))).toMatchObject({ allowed: true });
    }
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
  });
}

test('Sort buttons can be reached and activated by keyboard', async ({ page }) => {
  await gotoCase(page);
  const sort = page.getByRole('group', { name: 'sort', exact: true });
  await page.getByRole('link', { name: 'Collapse all', exact: true }).focus();
  for (const name of ['Manual', 'Name', 'Modified', 'Score', 'Errors']) {
    await page.keyboard.press('Tab');
    const button = sort.getByRole('button', { name: new RegExp(`^${name}`) });
    await expect(button).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Space');
    await expect(button).toHaveAttribute('aria-pressed', 'true');
  }
  await sort.getByRole('button', { name: /^Manual/ }).click();
});

test('Scores and ratings convey their state without color', async ({ page }) => {
  await gotoCase(page);
  await expect(page.locator('[data-controller="qscore-case"] .score-state')).toContainText('of ');
  await expect(page.locator('[data-controller="qscore-query"] .score-state').first()).toContainText('of ');
  await expandFirstQuery(page);
  const badge = page.locator('search-result .single-rating button').first();
  await expect(badge).toContainText('Unrated');
  await badge.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.popover .ratingNum').first()).toBeVisible();
  const choices = page.locator('.popover .ratingNum');
  expect(await choices.count()).toBeGreaterThan(0);
  for (const choice of await choices.all()) {
    await expect(choice).toHaveAttribute('type', 'button');
    await expect(choice).toHaveText(/\d/);
  }
  try {
    await choices.filter({ hasText: /^1/ }).first().focus();
    await page.keyboard.press('Enter');
    await expect(badge).toContainText('1');
    await page.reload();
    await expandFirstQuery(page);
    await expect(badge).toContainText('1');
  } finally {
    await badge.click();
    await page.locator('.popover .reset').click();
    await expect(badge).toContainText('Unrated');
  }
});

for (const width of [1280, 768]) {
  test(`Long labeled rating scale keeps every control inside its popover at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoCase(page);
    await expandFirstQuery(page);
    const rating = page.locator('search-result .single-rating').first();
    // Exercise a supported custom scale without changing the shared case/scorer.
    await rating.evaluate(el => {
      el.setAttribute('data-rating-popover-scale-value', JSON.stringify(
        Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, {
          color: 'green', showScaleLabels: true, label: 'Unacceptable'
        }]))
      ));
    });
    await rating.getByRole('button').click();
    const popover = page.locator('.popover');
    await expect(popover.locator('.ratingNum')).toHaveCount(10);
    await expect(popover.getByRole('button', { name: 'RESET', exact: true })).toBeVisible();
    await expect.poll(() => popover.evaluate(el => {
      const bounds = el.getBoundingClientRect();
      return Array.from(el.querySelectorAll('button')).every(button => {
        const rect = button.getBoundingClientRect();
        return rect.left >= bounds.left && rect.right <= bounds.right &&
          rect.top >= bounds.top && rect.bottom <= bounds.bottom;
      });
    })).toBe(true);
    const first = await popover.locator('.ratingNum').first().boundingBox();
    const reset = await popover.locator('.reset').boundingBox();
    expect(reset!.y).toBeGreaterThan(first!.y);
    await rating.getByRole('button').click();
    await expect(popover).toHaveCount(0);
  });
}

import { test, expect } from '@playwright/test';
import { expandFirstQuery, gotoCase } from './case_helpers';

test('a document event action delivers once and follows a controller reconnect', async ({ page }) => {
  await gotoCase(page);
  const toolbar = page.locator('#case-actions');
  // Count calls on the prototype, passing through to the real handler: a reconnect builds a new
  // instance, and repeated frame.src writes collapse into one request, so requests can't count deliveries.
  await toolbar.evaluate(element => {
    const controller = (window as any).Stimulus.getControllerForElementAndIdentifier(element, 'case-toolbar');
    const prototype = Object.getPrototypeOf(controller);
    const handle = prototype.handleHeaderStale;
    (window as any).headerStaleCalls = 0;
    prototype.handleHeaderStale = function (...args: unknown[]) {
      (window as any).headerStaleCalls += 1;
      return handle.apply(this, args);
    };
  });
  const calls = () => page.evaluate(() => (window as any).headerStaleCalls);
  const isConnected = () => toolbar.evaluate(element =>
    Boolean((window as any).Stimulus.getControllerForElementAndIdentifier(element, 'case-toolbar')));
  const dispatchStale = () => page.evaluate(() => document.dispatchEvent(new CustomEvent('quepid:case-header-stale')));

  // The real handler still runs: it re-fetches the header frame.
  const refetched = page.waitForResponse(response => /\/case\/\d+\/header(\/try\/\d+)?$/.test(new URL(response.url()).pathname));
  await dispatchStale();
  await refetched;
  expect(await calls()).toBe(1);

  // Detached, the event must reach nothing.
  await toolbar.evaluate(element => element.setAttribute('data-controller', ''));
  await expect.poll(isConnected).toBe(false);
  await dispatchStale();
  expect(await calls()).toBe(1);

  // Reattached, it is delivered once again.
  await toolbar.evaluate(element => element.setAttribute('data-controller', 'case-toolbar'));
  await expect.poll(isConnected).toBe(true);
  await dispatchStale();
  expect(await calls()).toBe(2);
});

test('generated result and match-explain controls route through declared actions', async ({ page }) => {
  // Live-Solr case 6 returns explain data, so its results render hot-match bars.
  await gotoCase(page, '', 6);
  await expandFirstQuery(page);

  await page.locator('search-result').first().locator('.subTitle button').click();
  await expect(page.locator('.modal.show')).toBeVisible();
  await page.locator('.modal.show').getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('.modal.show')).toHaveCount(0);

  const bar = page.locator('search-result .match-explain-bar').first();
  await expect(bar).toBeVisible();
  await bar.click();
  await expect(page.locator('.modal.show [data-match-explain-modal-target="json"]')).toBeVisible();
  // This modal has no close button; Bootstrap ignores Esc until its fade-in ends.
  await expect(async () => {
    await page.keyboard.press('Escape');
    await expect(page.locator('.modal.show')).toHaveCount(0, { timeout: 1_000 });
  }).toPass();

  // Live results rarely have more than three hot matches; give one row five so it renders the toggle.
  const explain = page.locator('search-result [data-controller="match-explain"]').first();
  await explain.evaluate(element => {
    const data = JSON.parse(element.getAttribute('data-match-explain-data-value')!);
    data.hots = [1, 2, 3, 4, 5].map(i => ({ description: `term ${i}`, percentage: 100 - i * 10 }));
    element.setAttribute('data-match-explain-data-value', JSON.stringify(data));
  });
  const toggle = explain.locator('.match-explain-toggle');
  await expect(toggle).toHaveText('Show 2 More');
  await toggle.click();
  await expect(toggle).toHaveText('Show Less');
  await expect(explain.locator('.match-explain-more')).toHaveClass(/show/);
  await toggle.click();
  await expect(toggle).toHaveText('Show 2 More');
});

test('missing-document rating actions stay inside the dynamic modal', async ({ page }) => {
  // Answer rating writes so the shared case's ratings never change.
  const writes: string[] = [];
  await page.route(/\/api\/cases\/\d+\/queries\/\d+\/.*ratings/, route => {
    writes.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
    return route.fulfill({ json: {} });
  });
  await gotoCase(page, '', 6);
  await expandFirstQuery(page);
  await page.getByRole('button', { name: 'Missing Documents', exact: true }).first().click();
  const root = page.locator('.modal.show [data-controller="missing-documents"]');
  await expect(root.locator('textarea')).toBeVisible();
  // Score All rates the loaded rated-docs list, so wait for it before dispatching.
  await expect(root.locator('search-result').first()).toBeVisible();

  // Each event reaches only missing-documents, which rates the whole listed set in one bulk call.
  await root.evaluate(element => element.dispatchEvent(new CustomEvent('rating-popover:rate', { bubbles: true, detail: { rating: 1 } })));
  await expect.poll(() => writes).toEqual([expect.stringMatching(/^PUT .*\/bulk\/ratings$/)]);
  await root.evaluate(element => element.dispatchEvent(new CustomEvent('rating-popover:reset', { bubbles: true })));
  await expect.poll(() => writes).toEqual([
    expect.stringMatching(/^PUT .*\/bulk\/ratings$/),
    expect.stringMatching(/^POST .*\/bulk\/ratings\/delete$/)
  ]);
});

test('query pagination actions move between first and last pages', async ({ page }) => {
  await gotoCase(page);
  const pagination = page.locator('[data-queries-list-target="pagination"]');
  await expect(pagination).toContainText('Page 1 of 2');
  await expect(pagination.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
  await pagination.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(pagination).toContainText('Page 2 of 2');
  await expect(pagination.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  await pagination.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(pagination).toContainText('Page 1 of 2');
});

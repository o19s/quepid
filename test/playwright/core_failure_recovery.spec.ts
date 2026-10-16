import { test, expect } from '@playwright/test';
import { CASE_ID } from './case_helpers';

// Read the existing static fixture. All destructive/settings writes are fulfilled
// in the browser; this spec creates no records in the shared development DB.
test('core delete failures keep the workspace and permit a second attempt', async ({ page }) => {
  await page.route('**/api/**', async route => {
    if (['PUT', 'POST', 'DELETE'].includes(route.request().method())) return route.fulfill({ status: 204 });
    return route.continue();
  });
  let attempts = 0;
  await page.route(new RegExp(`/cases/${CASE_ID}(?:/(?:archive|queries))?$`), async route => {
    attempts++;
    await route.fulfill({ status: 500, json: { error: 'Recovery fixture server failure' } });
  });
  await page.goto(`case/${CASE_ID}`);
  await expect(page.locator('.results-list-element').first()).toBeVisible();
  const workspace = page.url();
  const modal = page.locator('#deleteCaseOptionsModal');
  for (const [option, label] of [['Delete All Queries', 'Delete All Queries'], ['Archive Case', 'Archive'], ['Delete Case', 'Delete']]) {
    for (let retry = 0; retry < 2; retry++) {
      await page.getByRole('button', { name: 'Delete', exact: true }).click();
      await modal.getByRole('button', { name: option, exact: true }).first().click();
      await modal.getByRole('button', { name: label, exact: true }).last().click();
      await expect(page.locator('#flash-messages .flash.show').filter({ hasText: 'Recovery fixture server failure' })).toBeVisible();
      await expect(page.locator('.modal-backdrop')).toHaveCount(0);
      expect(page.url()).toBe(workspace);
    }
  }
  expect(attempts).toBe(6);
});

test('a persistent wrapped search error leaves Rerun reachable', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 720 });
  // Model the same persistent book-sync error channel used by a population409.
  // The real 409 -> 204/persistence path is covered by the manual scenario12.8.
  await page.route('**/api/**', async route => {
    if (['PUT', 'POST', 'DELETE'].includes(route.request().method())) return route.fulfill({ status: 204 });
    return route.continue();
  });
  let attempts = 0;
  await page.route(`**/api/cases/${CASE_ID}/tries`, async route => {
    if (route.request().method() !== 'POST') return route.continue();
    attempts++;
    await route.fulfill({ status: 409, json: { error: 'Settings retry reached server' } });
  });
  await page.goto(`case/${CASE_ID}`);
  await expect(page.locator('.results-list-element').first()).toBeVisible();
  await page.getByRole('button', { name: 'Tune Relevance', exact: true }).click();
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('flash:show', { detail: {
    type: 'error', target: 'search-error',
    message: "Book auto-sync could not submit all new results. Retry the search after the book's current job finishes."
  } })));
  const rerun = page.getByRole('button', { name: 'Rerun My Searches!', exact: true });
  await expect.poll(async () => {
    const button = await rerun.boundingBox();
    const banner = await page.locator('#flash-messages').boundingBox();
    return !!button && !!banner && button.y + button.height <= banner.y;
  }).toBe(true);
  await rerun.click();
  await expect(page.locator('#flash-messages .flash.show').filter({ hasText: 'Settings retry reached server' })).toBeVisible();
  await rerun.click();
  await expect.poll(() => attempts).toBe(2);
  await expect(page.locator('.flash.show').filter({ hasText: 'Book auto-sync' })).toBeVisible();
});

for (const [option, label] of [['Delete All Queries', 'Delete All Queries'], ['Archive Case', 'Archive'], ['Delete Case', 'Delete']]) {
  test(`${option} navigates to sign-in when the session expires`, async ({ page }) => {
    await page.route('**/api/**', async route => {
      if (['PUT', 'POST', 'DELETE'].includes(route.request().method())) return route.fulfill({ status: 204 });
      return route.continue();
    });
    await page.goto(`case/${CASE_ID}`);
    await expect(page.locator('.results-list-element').first()).toBeVisible();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    const modal = page.locator('#deleteCaseOptionsModal');
    await modal.getByRole('button', { name: option, exact: true }).first().click();
    await page.context().clearCookies();
    await modal.getByRole('button', { name: label, exact: true }).last().click();
    await expect(page).toHaveURL(/\/sessions\/new$/);
    await expect(page.locator('#login')).toBeVisible();
  });
}

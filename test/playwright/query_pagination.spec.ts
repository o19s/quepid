import { test, expect } from '@playwright/test';
import { gotoCase } from './case_helpers';

test('numbered query pages retain Bootstrap states and keyboard navigation', async ({ page }) => {
  await page.route('**/api/cases/*/scores', route => route.request().method() === 'PUT'
    ? route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    : route.fallback());
  await gotoCase(page);
  const nav = page.getByRole('navigation', { name: 'Query pages' });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Previous page', exact: true })).toBeDisabled();
  await expect(nav.locator('[aria-current="page"]')).toHaveText('1');
  await nav.getByRole('button', { name: 'Page 2', exact: true }).click();
  await expect(nav.locator('[aria-current="page"]')).toHaveText('2');
  await nav.getByRole('button', { name: 'Previous page', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(nav.locator('[aria-current="page"]')).toHaveText('1');
});

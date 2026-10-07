import { test, expect } from '@playwright/test';
import { apiHeaders, createDisposableCase, deleteCaseViaApi } from './case_helpers';
import { playwrightBaseURL } from './env';

let caseId: number | undefined;

test.afterAll(async ({ browser }) => {
  if (!caseId) return;
  const page = await browser.newPage({
    baseURL: playwrightBaseURL(),
    storageState: 'test/playwright/.auth/user.json'
  });
  try {
    await page.goto('cases');
    await deleteCaseViaApi(page, caseId);
  } finally {
    await page.close();
  }
});

test('disposable case helpers establish CSRF and surface failed deletion', async ({ page }) => {
  caseId = await createDisposableCase(page, 'Helpers');
  const id = caseId;
  const headers = await apiHeaders(page, { 'X-Requested-With': 'XMLHttpRequest' });
  expect(headers['X-CSRF-Token']).not.toBe('');
  expect(headers['X-Requested-With']).toBe('XMLHttpRequest');
  const created = await page.request.get(`api/cases/${id}`, { headers });
  expect(created.ok()).toBeTruthy();
  expect((await created.json()).case_name).toMatch(/^Playwright Helpers Scratch /);

  await deleteCaseViaApi(page, id);
  caseId = undefined;
  const deleted = await page.request.get(`api/cases/${id}`, { headers });
  expect(deleted.status()).toBe(404);
  await expect(deleteCaseViaApi(page, id)).rejects.toThrow(`Case ${id} cleanup failed: 404`);
});

import { test, expect, type Page } from '@playwright/test';
import { apiHeaders, createDisposableCase, deleteCaseViaApi } from './case_helpers';

/**
 * The case toolbar's Import modal against a disposable case: the validation and failure copy Legacy
 * showed, and a successful import. Everything runs on a case created here and deleted afterwards.
 */

let caseId: number;

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ storageState: 'test/playwright/.auth/user.json' });
  const page = await context.newPage();
  caseId = await createDisposableCase(page, 'Import-Ratings');
  const response = await page.request.post(`api/cases/${caseId}/queries`, {
    data: { query: { query_text: 'star wars' } },
    headers: await apiHeaders(page, { 'Content-Type': 'application/json' })
  });
  expect(response.ok()).toBeTruthy();
  await context.close();
});

test.afterAll(async ({ browser }) => {
  if (!caseId) return;
  const context = await browser.newContext({ storageState: 'test/playwright/.auth/user.json' });
  const page = await context.newPage();
  await page.goto('cases');
  await deleteCaseViaApi(page, caseId);
  await context.close();
});

async function openImport(page: Page, tab?: string) {
  await page.goto(`case/${caseId}`);
  await page.locator('#case-actions').getByRole('button', { name: 'Import', exact: true }).click();
  const modal = page.locator('.modal.show');
  await expect(modal).toBeVisible();
  if (tab) await modal.getByRole('tab', { name: tab, exact: true }).click();
  return modal;
}

const csv = (name: string, body: string) => ({ name, mimeType: 'text/csv', buffer: Buffer.from(body) });

test('a CSV with the wrong headers is refused with the Legacy wording', async ({ page }) => {
  const modal = await openImport(page);
  await modal.locator('input[type=radio][value=csv]').check();
  await modal.locator('input[type=file]').first().setInputFiles(csv('bad.csv', 'q,d,r\nfoo,1,2\n'));
  await expect(modal.locator('[data-import-ratings-core-target="alert"]')).toContainText(
    'Headers mismatch! Please make sure you have the correct headers in your file (check for correct spelling and capitalization): query,docid,rating'
  );
  await expect(modal.getByRole('button', { name: 'Import', exact: true })).toBeDisabled();
});

test('a failed information-needs import names the format and keeps the modal open', async ({ page }) => {
  const modal = await openImport(page, 'Information Needs');
  await modal.locator('input[type=radio][value=information_needs]').check();
  await modal.locator('input[type=file]').filter({ visible: true }).first()
    .setInputFiles(csv('needs.csv', 'query,information_need\nnot in this case,"x"\n'));
  await modal.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.locator('#flash-messages')).toContainText('Unable to import information needs from CSV.');
  await expect(modal).toBeVisible();
});

test('a ratings CSV imports and says so', async ({ page }) => {
  const modal = await openImport(page);
  await modal.locator('input[type=radio][value=csv]').check();
  await modal.locator('input[type=file]').first().setInputFiles(csv('ratings.csv', 'query,docid,rating\nstar wars,3574597,3\n'));
  await modal.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.locator('#flash-messages')).toContainText('Successfully imported ratings from CSV.');
  await expect(page.locator('.modal.show')).toHaveCount(0);
});

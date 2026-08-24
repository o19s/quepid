import { test, expect, type Page } from '@playwright/test';

/**
 * Smoke coverage for Stimulus-driven pages (application layout).
 * Complements the Angular core Playwright suite in angular_pages.spec.ts.
 */

async function firstBookId(page: Page): Promise<string> {
  await page.goto('books');

  const firstBookLink = page.locator('table tbody tr td:nth-child(2) a').first();
  await expect(firstBookLink).toBeVisible({ timeout: 15_000 });

  const href = await firstBookLink.getAttribute('href');
  const bookId = href?.match(/\/books\/(\d+)/)?.[1];
  expect(bookId).toBeTruthy();

  return bookId as string;
}

async function gotoBulkJudgePage(page: Page): Promise<string> {
  const bookId = await firstBookId(page);
  await page.goto(`books/${bookId}/judge/bulk`);
  await expect(page.locator('[data-controller="bulk-judgement"]')).toBeVisible();
  return bookId;
}

test.describe('Stimulus pages', () => {
  test('cases index exposes quepid root URL and import case modal', async ({ page }) => {
    await page.goto('cases');

    const rootUrl = await page.locator('body').getAttribute('data-quepid-root-url');
    expect(rootUrl).toBeTruthy();

    await page.getByRole('button', { name: 'Import Case from JSON' }).click();

    const modal = page.locator('#importCaseModal');
    await expect(modal).toBeVisible();
    await expect(modal).toHaveAttribute('data-controller', 'import-case');
  });

  test('import case redirects to root-prefixed case URL on success', async ({ page }) => {
    await page.route('**/api/import/cases**', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ case_id: 4242 }),
        });
        return;
      }

      await route.continue();
    });

    await page.goto('cases');
    const rootUrl = (await page.locator('body').getAttribute('data-quepid-root-url')) ?? '';

    await page.getByRole('button', { name: 'Import Case from JSON' }).click();

    await page.locator('#caseJsonFile').setInputFiles({
      name: 'case.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ case_name: 'Playwright import test' })),
    });

    await page.locator('#import-case-submit').click();
    await expect(page.locator('#import-case-alert')).toContainText(/successfully/i);

    const expectedPath = `${rootUrl}/case/4242`;
    await page.waitForURL(
      (url) => url.href === expectedPath || url.pathname.endsWith('/case/4242'),
      { timeout: 5000 },
    );
  });

  test('bulk judgement page loads Stimulus controller', async ({ page }) => {
    await gotoBulkJudgePage(page);
    await expect(page.getByRole('heading', { name: /Bulk Judgements/i })).toBeVisible();
  });

  test('bulk judgement saves rating via routed API', async ({ page }) => {
    let saveBody: Record<string, unknown> | null = null;
    let saveCsrfHeader: string | undefined;

    await page.route('**/judge/bulk/save**', async (route) => {
      if (route.request().method() === 'POST') {
        saveBody = route.request().postDataJSON() as Record<string, unknown>;
        saveCsrfHeader = route.request().headers()['x-csrf-token'];
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'success', judgement_id: 1 }),
        });
        return;
      }

      await route.continue();
    });

    const bookId = await gotoBulkJudgePage(page);

    const ratingLabel = page
      .locator('[data-controller="bulk-judgement"] .rating-buttons-container label')
      .first();
    await expect(ratingLabel).toBeVisible({ timeout: 15_000 });
    await ratingLabel.click();

    await expect.poll(() => saveBody).not.toBeNull();
    expect(saveBody).toMatchObject({
      query_doc_pair_id: expect.any(String),
      rating: expect.any(String),
    });
    expect(Number(saveBody!.query_doc_pair_id)).toBeGreaterThan(0);

    const pageCsrfToken = await page.evaluate(() => {
      return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
    });
    expect(saveCsrfHeader).toBe(pageCsrfToken);
    expect(saveCsrfHeader).toBeTruthy();

    await expect(page.locator('[id^="status_"]').filter({ hasText: 'Saved' }).first()).toBeVisible({
      timeout: 5000,
    });

    expect(page.url()).toContain(`/books/${bookId}/judge/bulk`);
  });

  test('mapper wizard loads Stimulus controller', async ({ page }) => {
    await page.goto('search_endpoints/mapper_wizard');

    await expect(page.locator('[data-controller="mapper-wizard"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Mapper Wizard' })).toBeVisible();
  });
});

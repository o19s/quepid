import { test, expect, type Page } from '@playwright/test';

/**
 * Book import/export end-to-end coverage (Books::ImportController /
 * Books::ExportController).
 *
 * Import parses an uploaded JSON (or zipped JSON) file into a brand-new
 * Book synchronously enough to validate, then persists the Book and queues
 * `ImportBookJob` to load its query_doc_pairs/judgements. Export queues
 * `ExportBookJob`, which attaches a downloadable Active Storage blob to the
 * Book. Both jobs run via SolidQueue and complete in well under our poll
 * timeout in this environment, so we poll book state via reloads instead of
 * a fixed sleep.
 *
 * The JSON shape below mirrors test/services/book_importer_test.rb's
 * `data` fixture (name/scale/scale_with_labels/query_doc_pairs, each pair
 * optionally carrying judgements keyed by user_email). We use the seeded
 * Playwright login's own email so the import succeeds without needing
 * `force_create_users`.
 */

const IMPORT_EMAIL = process.env.QUEPID_E2E_EMAIL ?? 'quepid+realisticactivity@o19s.com';

function importJson(name: string) {
  return {
    name,
    scale: [0, 1],
    scale_with_labels: { '0': 'Not Relevant', '1': 'Relevant' },
    query_doc_pairs: [
      {
        query_text: 'dog',
        doc_id: 'pw-doc-123',
        judgements: [{ rating: 1.0, unrateable: false, user_email: IMPORT_EMAIL }]
      },
      { query_text: 'dog', doc_id: 'pw-doc-234' }
    ]
  };
}

async function apiHeaders(page: Page) {
  const csrf = await page.evaluate(() =>
    document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? ''
  );
  return { Accept: 'application/json', 'X-CSRF-Token': csrf, 'X-Requested-With': 'XMLHttpRequest' };
}

/**
 * BooksController#destroy redirects to the books index on success.
 * APIRequestContext follows redirects by default, which for this
 * XHR-style request doesn't reliably resolve as 2xx — disable
 * redirect-following and accept any non-error status, matching what the
 * destroy action itself returned.
 */
async function deleteBook(page: Page, bookId: number) {
  const response = await page.request.delete(`books/${bookId}`, {
    headers: await apiHeaders(page),
    maxRedirects: 0
  });
  expect(response.status()).toBeLessThan(400);
}

/** Uploads `json` on the Import Book form and returns the new Book's id. */
async function importBook(page: Page, json: Record<string, unknown>): Promise<number> {
  await page.goto('books/import/new');
  await expect(page.getByRole('heading', { name: 'Import Book', level: 1 })).toBeVisible();

  await page.locator('input[type="file"]#book_import_file').setInputFiles({
    name: 'book.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(json))
  });
  await page.getByRole('button', { name: 'Upload' }).click();

  await page.waitForURL(/\/books\/\d+$/, { timeout: 10_000 });
  await expect(page.locator('#flash')).toContainText(/successfully created/i);

  const bookId = Number(page.url().match(/\/books\/(\d+)$/)?.[1]);
  expect(bookId).toBeGreaterThan(0);
  return bookId;
}

test.describe('Book import/export', () => {
  test('imports a JSON file and creates a book with the right query doc pairs', async ({ page }) => {
    const name = `Playwright Import ${Date.now()}`;
    const bookId = await importBook(page, importJson(name));

    try {
      // ImportBookJob runs asynchronously — poll the show page until the
      // "currently being processed" banner clears and the query count lands.
      await expect(async () => {
        await page.goto(`books/${bookId}`);
        await expect(page.getByText(/consists of 1 queries/i)).toBeVisible();
        await expect(page.getByText(/currently being processed/i)).toHaveCount(0);
      }).toPass({ timeout: 15_000 });

      await expect(page.getByRole('heading', { name: new RegExp(name) })).toBeVisible();

      // Two query_doc_pairs were imported for the single "dog" query.
      await page.goto(`books/${bookId}/query_doc_pairs`);
      await expect(page.locator('table tbody tr')).toHaveCount(2);
      await expect(page.getByRole('cell', { name: 'pw-doc-123' })).toBeVisible();
      await expect(page.getByRole('cell', { name: 'pw-doc-234' })).toBeVisible();

      // The one judgement supplied for pw-doc-123 was attributed to the
      // importing (seeded) user.
      await page.goto(`books/${bookId}/judgements?filtered=1&q=doc_id:pw-doc-123`);
      const row = page.locator('table tbody tr').first();
      await expect(row).toBeVisible();
      await expect(row.getByRole('cell', { name: '1.0' })).toBeVisible();
    } finally {
      await deleteBook(page, bookId);
    }
  });

  test('rejects an invalid JSON file without creating a book', async ({ page }) => {
    await page.goto('books/import/new');

    await page.locator('input[type="file"]#book_import_file').setInputFiles({
      name: 'not-quite.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{ this is not valid JSON')
    });
    await page.getByRole('button', { name: 'Upload' }).click();

    // ImportController#create re-renders :new (200, not a redirect) with
    // the book's validation errors when JSON parsing fails.
    await expect(page).toHaveURL(/\/books\/import/);
    await expect(page.locator('#error_explanation')).toContainText(/Invalid JSON file/i);
  });

  test('exports a book as a downloadable JSON file', async ({ page }) => {
    const name = `Playwright Export ${Date.now()}`;
    const bookId = await importBook(page, importJson(name));

    try {
      await page.goto(`books/${bookId}/export`);
      await expect(page.getByRole('heading', { name: 'Export Data' })).toBeVisible();

      await page.getByRole('button', { name: 'Export' }).click();

      // ExportController#update redirects back to the book show page with a
      // "queued" notice; ExportBookJob then attaches export_file async.
      await page.waitForURL(`**/books/${bookId}`, { timeout: 10_000 });
      await expect(page.locator('#flash')).toContainText(/queued up export/i);

      const exportLink = page.getByRole('link', { name: /Book Exported as JSON file/i });
      await expect(async () => {
        await page.reload();
        await expect(exportLink).toBeVisible();
      }).toPass({ timeout: 15_000 });

      // Confirm the export is a real, fetchable file rather than just a
      // visible link — full ZIP/JSON content verification is out of scope
      // here since it duplicates BookExporter's own service-level tests.
      const href = await exportLink.getAttribute('href');
      expect(href).toBeTruthy();
      const download = await page.request.get(href as string);
      expect(download.ok()).toBeTruthy();
    } finally {
      await deleteBook(page, bookId);
    }
  });
});

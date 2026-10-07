import { test, expect, type Page } from '@playwright/test';
import { apiHeaders, gotoCase } from './case_helpers';

/**
 * Saving book settings in the judgements modal must reconfigure book sync for
 * the open page. The runtime used to learn about it only on case load, so a
 * newly linked book received no query/doc pairs (and an unlinked one kept
 * receiving them) until reload.
 *
 * Pinned to live-Solr case 6: the static fixture case can't add queries, and
 * adding one is the simplest way to run a search that syncs. Case 6 is shared
 * with a team that owns the book. `PUT api/books/:id/populate` is stubbed so
 * the book's data is never written. Cleanup restores the case's book settings
 * and deletes the added queries.
 */

const CASE_ID = 6;
const BOOK_ID = Number(process.env.QUEPID_E2E_BOOK_ID || 1);

async function saveBookSettings(page: Page, bookId: number | '', syncPairs: boolean) {
  await page.locator('[data-bs-target="#judgementsModal"]:visible').first().click();
  const modal = page.locator('#judgementsModal');
  await expect(modal).toBeVisible();
  await modal.locator(`[data-judgements-core-book-id-param="${bookId}"]`).click();
  const pairs = modal.locator('[data-judgements-core-target="autoPopulateBookPairs"]');
  if (await pairs.isVisible()) await pairs.setChecked(syncPairs);
  const judgements = modal.locator('[data-judgements-core-target="autoPopulateCaseJudgements"]');
  if (await judgements.isVisible()) await judgements.setChecked(false);
  await modal.locator('[data-action="click->judgements-core#save"]').click();
  await expect(modal).toBeHidden({ timeout: 15_000 });
}

test.describe('judgements modal: book sync settings', () => {
  const addedQueryIds: number[] = [];
  let populates: string[] = [];

  test.beforeEach(async ({ page }) => {
    populates = [];
    await page.route(/\/api\/books\/\d+\/populate/, async (route) => {
      populates.push(new URL(route.request().url()).pathname.replace(/.*\/api\//, 'api/'));
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
  });

  test.afterEach(async ({ page }) => {
    const headers = await apiHeaders(page, { 'Content-Type': 'application/json' });
    const responses = [
      await page.request.put(`api/cases/${CASE_ID}`, {
        data: { book_id: null, auto_populate_book_pairs: false, auto_populate_case_judgements: false },
        headers
      })
    ];
    for (const queryId of addedQueryIds.splice(0)) {
      responses.push(await page.request.delete(`api/cases/${CASE_ID}/queries/${queryId}`, { headers }));
    }
    expect(responses.filter((r) => !r.ok()).map((r) => `${r.status()} ${r.url()}`)).toEqual([]);
  });

  /** Adds a query (which searches and syncs it) and returns the populate calls it made. */
  async function addQuery(page: Page, text: string): Promise<string[]> {
    populates = [];
    const created = page.waitForResponse(
      (r) => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith(`/api/cases/${CASE_ID}/queries`)
    );
    await page.locator('#add-query').fill(text);
    await page.locator('#add-query-submit').click();
    const json = await (await created).json();
    addedQueryIds.push(Number(json.query.query_id));
    // The add finishes only after search, scoring and book sync, so every
    // populate request has been made once the spinner hides.
    await expect(page.locator('[data-add-query-target="spinner"]')).toBeHidden({ timeout: 30_000 });
    await expect(page.getByText('Query added successfully.')).toBeVisible();
    return populates;
  }

  test('follows saved settings without a page reload', async ({ page }) => {
    await gotoCase(page, '', CASE_ID);

    await saveBookSettings(page, BOOK_ID, true);
    expect(await addQuery(page, `book sync on ${Date.now()}`)).toEqual([`api/books/${BOOK_ID}/populate`]);

    await saveBookSettings(page, BOOK_ID, false);
    expect(await addQuery(page, `book sync off ${Date.now()}`)).toEqual([]);

    await saveBookSettings(page, '', false);
    expect(await addQuery(page, `book unlinked ${Date.now()}`)).toEqual([]);
  });
});

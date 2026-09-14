import { test, expect, type Page } from '@playwright/test';

/**
 * Single-item judging flow (JudgementsController#new/#create), the
 * book/:book_id/judge UI at app/views/judgements/_form.html.erb.
 *
 * Mirrors the fixtures/flows covered server-side in
 * test/controllers/judgements_controller_test.rb, but drives the actual
 * rating buttons rendered by generate_rating_buttons instead of posting
 * form params directly.
 *
 * Book id 1 ("Of Ratings") is the seeded account's only Book with a large,
 * mostly-unrated pool of query_doc_pairs, so `/books/1/judge` reliably
 * finds one left to judge. We record the query_doc_pair id from the
 * hidden field before rating so we can look the judgement back up (and
 * delete it afterward, leaving the pool exactly as we found it for
 * repeated runs).
 */

const BOOK_ID = Number(process.env.QUEPID_E2E_JUDGING_BOOK_ID || 1);

async function apiHeaders(page: Page) {
  const csrf = await page.evaluate(() =>
    document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? ''
  );
  return { Accept: 'application/json', 'X-CSRF-Token': csrf, 'X-Requested-With': 'XMLHttpRequest' };
}

/**
 * JudgementsController#destroy redirects to book_judge_path on success.
 * APIRequestContext follows redirects by default, and the redirect target
 * (the next judge form, or a full "you've judged everything" redirect
 * chain) doesn't always resolve as a plain 200 for an XHR-style request —
 * so we disable redirect-following and treat any 2xx/3xx as success,
 * matching what the destroy action itself actually returned.
 */
async function deleteJudgement(page: Page, bookId: number, judgementId: string) {
  const response = await page.request.delete(`books/${bookId}/judgements/${judgementId}`, {
    headers: await apiHeaders(page),
    maxRedirects: 0
  });
  expect(response.status()).toBeLessThan(400);
}

test.describe('Single-item judging', () => {
  test('submitting a rating records a judgement and advances to the next pair', async ({ page }) => {
    await page.goto(`books/${BOOK_ID}/judge`);

    const queryDocPairId = await page.locator('#judgement_query_doc_pair_id').getAttribute('value');
    expect(Number(queryDocPairId)).toBeGreaterThan(0);

    // _form.html.erb renders one rating button per scorer scale value
    // (e.g. "Irrelevant" / "Relevant" for this book's 0/1 scale), each
    // wired to rate(value, key) which sets the hidden rating field and
    // submits the form.
    const ratingButton = page.getByRole('button', { name: 'Relevant', exact: true });
    await expect(ratingButton).toBeVisible({ timeout: 10_000 });
    await ratingButton.click();

    // JudgementsController#create redirects to book_judge_path — same URL,
    // now showing either the next unrated pair or the "all judged" state.
    await expect(page).toHaveURL(new RegExp(`/books/${BOOK_ID}/judge$`));
    await expect(page.locator('#judgement_query_doc_pair_id')).not.toHaveValue(queryDocPairId as string, {
      timeout: 10_000
    });

    // Confirm the judgement landed against the query_doc_pair we rated,
    // attributed to the signed-in user, with the rating we clicked.
    await page.goto(`books/${BOOK_ID}/judgements?filtered=1&q=query_doc_pair_id:${queryDocPairId}`);
    const rows = page.locator('table tbody tr');
    const newRow = rows.filter({ has: page.getByText('User With Realistic Activity In Quepid') });
    await expect(newRow).toHaveCount(1);
    await expect(newRow.getByRole('cell', { name: '1.0' })).toBeVisible();

    const judgementLink = newRow.locator('a').first();
    const judgementHref = await judgementLink.getAttribute('href');
    const judgementId = judgementHref?.match(/judgements\/(\d+)\/edit/)?.[1];
    expect(judgementId).toBeTruthy();

    // Clean up so re-running this spec always finds an unrated pair again.
    await deleteJudgement(page, BOOK_ID, judgementId as string);
  });

  test('marking a pair "I Can\'t Tell" records it as unrateable', async ({ page }) => {
    await page.goto(`books/${BOOK_ID}/judge`);

    const queryDocPairId = await page.locator('#judgement_query_doc_pair_id').getAttribute('value');
    expect(Number(queryDocPairId)).toBeGreaterThan(0);

    await page.getByRole('button', { name: "I Can't Tell" }).click();
    const modal = page.locator('#explanationModal');
    await expect(modal).toBeVisible();

    await modal.locator('textarea').fill('Playwright: cannot judge this pair.');
    await modal.getByRole('button', { name: 'Skip Judging' }).click();

    await expect(page).toHaveURL(new RegExp(`/books/${BOOK_ID}/judge$`));

    await page.goto(`books/${BOOK_ID}/judgements?filtered=1&compact=&q=query_doc_pair_id:${queryDocPairId}&unrateable=1`);
    const row = page.locator('table tbody tr').first();
    await expect(row).toBeVisible();

    const judgementLink = row.locator('a').first();
    const judgementHref = await judgementLink.getAttribute('href');
    const judgementId = judgementHref?.match(/judgements\/(\d+)\/edit/)?.[1];
    expect(judgementId).toBeTruthy();

    await deleteJudgement(page, BOOK_ID, judgementId as string);
  });
});

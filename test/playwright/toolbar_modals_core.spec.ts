import { test, expect, type Page } from '@playwright/test';
import { playwrightBaseURL } from './env';

/**
 * Behavioral coverage for the Stimulus core-toolbar modals migrated off
 * Core toolbar: pick-scorer-core, take-snapshot-core, judgements-core.
 *
 * Uses a disposable case per test (same pattern as
 * delete_and_clone_case_options.spec.ts) so mutate paths never touch shared
 * demo fixtures. Each case id is tracked below and deleted in a single
 * test.afterAll (see teams.spec.ts) rather than a per-test try/finally, so a
 * test that crashes/times out before its own cleanup still doesn't leak a
 * row into the shared dev DB.
 */

let pickScorerCaseId: number | undefined;
let takeSnapshotCaseId: number | undefined;
let judgementsCaseId: number | undefined;

test.afterAll(async ({ browser }) => {
  const caseIds = [pickScorerCaseId, takeSnapshotCaseId, judgementsCaseId].filter(
    (id): id is number => id !== undefined
  );
  if (caseIds.length === 0) return;

  const page: Page = await browser.newPage({
    baseURL: playwrightBaseURL(),
    storageState: 'test/playwright/.auth/user.json'
  });
  try {
    // apiHeaders() reads the CSRF token from the current document's meta tag —
    // without a navigation first, this page is still blank and every delete
    // below goes out with an empty token (and used to fail silently).
    await page.goto('cases');
    for (const caseId of caseIds) {
      await deleteCaseViaApi(page, caseId);
    }
  } finally {
    await page.close();
  }
});

async function apiHeaders(page: Page) {
  const csrf = await page.evaluate(() =>
    document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? ''
  );
  return { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-Token': csrf };
}

async function createDisposableCase(page: Page, label: string): Promise<number> {
  await page.goto('cases');
  await page.waitForSelector('body', { timeout: 15_000 });

  const response = await page.request.post('api/cases', {
    data: { case_name: `Playwright ${label} Scratch ${Date.now()}` },
    headers: await apiHeaders(page)
  });
  expect(response.ok()).toBeTruthy();
  const json = await response.json();
  const caseId = Number(json.case_id);
  expect(caseId).toBeGreaterThan(0);
  return caseId;
}

async function deleteCaseViaApi(page: Page, caseId: number) {
  const response = await page.request.delete(`api/cases/${caseId}`, { headers: await apiHeaders(page) });
  // Assert like every other cleanup in this suite: a silent failure here
  // (e.g. an empty CSRF token nulling the session) would let this exact
  // case leak right back in on the next run with no signal.
  expect(response.ok()).toBeTruthy();
}

async function shareCaseWithFirstTeam(page: Page, caseId: number): Promise<number | null> {
  const teamsResponse = await page.request.get('/api/teams', { headers: await apiHeaders(page) });
  expect(teamsResponse.ok()).toBeTruthy();
  const teams = (await teamsResponse.json()).teams || [];
  if (teams.length === 0) return null;

  const teamId = Number(teams[0].id);
  const share = await page.request.post(`/api/teams/${teamId}/cases`, {
    data: { id: caseId },
    headers: await apiHeaders(page)
  });
  expect(share.ok()).toBeTruthy();
  return teamId;
}

async function gotoCase(page: Page, caseId: number) {
  await page.goto(`case/${caseId}/try/1`);
  await page.waitForSelector('#case-actions', { timeout: 20_000 });
}

test.describe('core toolbar: pick-scorer-core / take-snapshot-core / judgements-core', () => {
  test('select scorer retries a failed save, persists and reopens selected', async ({ page }) => {
    const caseId = await createDisposableCase(page, 'Pick-Scorer');
    pickScorerCaseId = caseId;

    await gotoCase(page, caseId);
    await page.locator('a[data-bs-target="#pickScorerModal"]').click();

    const modal = page.locator('#pickScorerModal.show');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText(/How would you like to score/i);

    const option = modal.locator('.list-group-item').first();
    await expect(option).toBeVisible({ timeout: 10_000 });
    await option.click();
    const scorerName = (await option.textContent())!.trim();

    await page.route(`**/api/cases/${caseId}/scorers/*`, route => route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Scorer save rejected for retry test' })
    }), { times: 1 });
    await modal.getByRole('button', { name: 'Select Scorer', exact: true }).click();
    await expect(modal.locator('[data-pick-scorer-core-target="alert"]')).toContainText('Scorer save rejected for retry test');
    await expect(modal.getByRole('button', { name: 'Select Scorer', exact: true })).toBeEnabled();
    await expect(modal.locator('.list-group-item.active')).toHaveText(scorerName);

    const saved = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/cases/${caseId}/scorers/`) &&
        response.request().method() === 'PUT',
      { timeout: 15_000 }
    );
    await modal.getByRole('button', { name: 'Select Scorer', exact: true }).click();
    const response = await saved;
    expect(response.ok()).toBeTruthy();
    await expect(modal).toBeHidden({ timeout: 10_000 });
    await page.reload();
    await page.locator('a[data-bs-target="#pickScorerModal"]').click();
    await expect(modal.locator('.list-group-item.active')).toHaveText(scorerName);
  });

  test('take snapshot creates via bridge and lists in compare picker', async ({ page }) => {
    test.setTimeout(90_000);
    const caseId = await createDisposableCase(page, 'Take-Snapshot');
    takeSnapshotCaseId = caseId;

    await gotoCase(page, caseId);
    await page.locator('a[data-bs-target="#takeSnapshotModal"]').click();

    const modal = page.locator('#takeSnapshotModal.show');
    await expect(modal).toBeVisible();
    const snapshotName = `PW toolbar snapshot ${Date.now()}`;
    await modal.locator('#snapshotName').fill(snapshotName);

    const snapshotSaved = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/cases/${caseId}/snapshots`) &&
        response.request().method() === 'POST',
      { timeout: 45_000 }
    );
    await modal.getByRole('button', { name: 'Take Snapshot', exact: true }).click();
    const snapshotResponse = await snapshotSaved;
    expect(snapshotResponse.ok()).toBeTruthy();
    await expect(modal).toBeHidden({ timeout: 30_000 });

    await page.getByText('Compare snapshots', { exact: false }).first().click();
    const compareModal = page.locator('.modal.show').filter({ hasText: /Compare Your Search Results/i });
    await expect(compareModal).toBeVisible();
    await expect(compareModal.locator('select').first().locator('option', { hasText: snapshotName })).toHaveCount(
      1,
      { timeout: 15_000 }
    );
    await compareModal.getByRole('button', { name: 'Cancel', exact: true }).click();
    // Deleting the disposable case in afterAll removes its snapshots too.
  });

  test('judgements book choices cancel, retry, persist, navigate and disconnect', async ({ page }) => {
    const caseId = await createDisposableCase(page, 'Judgements');
    judgementsCaseId = caseId;
    const teamId = await shareCaseWithFirstTeam(page, caseId);

    await gotoCase(page, caseId);
    await page.locator('a[data-bs-target="#judgementsModal"]').click();

    const modal = page.locator('#judgementsModal.show');
    await expect(modal).toBeVisible();

    if (!teamId) {
      await expect(modal.locator('[data-judgements-core-target="noTeams"]')).toBeVisible({
        timeout: 15_000
      });
      return;
    }

    await expect(modal.locator('[data-judgements-core-target="loading"]')).toBeHidden({
      timeout: 20_000
    });

    const bookItems = modal.locator('[data-judgements-core-target="bookList"] .list-group-item');
    const bookCount = await bookItems.count();
    if (bookCount <= 1) {
      // Only the "None" row — team has no books; empty-state path is enough.
      await expect(modal.locator('[data-judgements-core-target="noBooks"]')).toBeVisible();
      return;
    }

    // Skip "None"; pick the first real book.
    const bookId = await bookItems.nth(1).getAttribute('data-judgements-core-book-id-param');
    await bookItems.nth(1).click();
    const saveButton = modal.locator('[data-judgements-core-target="saveButton"]');
    await expect(saveButton).toBeVisible();
    await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(modal).toBeHidden();
    await page.locator('a[data-bs-target="#judgementsModal"]').click();
    await expect(modal.locator('[data-judgements-core-target="loading"]')).toBeHidden();
    await expect(modal.locator('.list-group-item.active')).toHaveAttribute('data-judgements-core-book-id-param', '');
    await expect(saveButton).toBeHidden();

    // View must navigate without selecting or saving the book.
    await modal.locator(`[data-judgements-core-book-id-param="${bookId}"]`).getByRole('link', { name: 'View' }).click();
    await page.waitForURL(new RegExp(`/books/${bookId}$`));
    await gotoCase(page, caseId);
    await page.locator('a[data-bs-target="#judgementsModal"]').click();
    await expect(modal.locator('[data-judgements-core-target="loading"]')).toBeHidden();
    await expect(modal.locator('.list-group-item.active')).toHaveAttribute('data-judgements-core-book-id-param', '');
    await modal.locator(`[data-judgements-core-book-id-param="${bookId}"]`).click();
    await modal.locator('[data-judgements-core-target="autoPopulateBookPairs"]').uncheck();
    await modal.locator('[data-judgements-core-target="autoPopulateCaseJudgements"]').uncheck();

    let failSave = true;
    await page.route(`**/api/cases/${caseId}`, async route => {
      if (route.request().method() === 'PUT' && failSave) {
        failSave = false;
        await route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ error: 'Book save verification failure' }) });
      } else await route.continue();
    });
    await saveButton.click();
    await expect(modal.locator('[data-judgements-core-target="error"]')).toContainText('Book save verification failure');
    await expect(modal.locator('.list-group-item.active')).toHaveAttribute('data-judgements-core-book-id-param', bookId!);
    await expect(saveButton).toBeEnabled();
    await expect(modal.getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled();

    const saved = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/cases/${caseId}`) &&
        response.request().method() === 'PUT',
      { timeout: 15_000 }
    );
    await saveButton.click();
    const response = await saved;
    expect(response.ok()).toBeTruthy();
    await expect(modal).toBeHidden({ timeout: 15_000 });

    // Reopening must read persisted settings and keep the selected-case owner
    // synchronized, rather than relying on the toolbar's old dataset.
    await page.locator('a[data-bs-target="#judgementsModal"]').click();
    await expect(modal.locator('[data-judgements-core-target="loading"]')).toBeHidden();
    await expect(modal.locator('[data-judgements-core-target="bookList"] .list-group-item.active')).toHaveCount(1);
    await expect(modal.locator('.list-group-item.active')).toHaveAttribute('data-judgements-core-book-id-param', bookId!);
    await expect(saveButton).toBeHidden();
    await modal.locator('[data-judgements-core-book-id-param=""]').click();
    await expect(modal.locator('[data-judgements-core-target="integration"]')).toBeHidden();
    await saveButton.click();
    await expect(modal).toBeHidden();
    await page.reload();
    await page.locator('a[data-bs-target="#judgementsModal"]').click();
    await expect(modal.locator('[data-judgements-core-target="loading"]')).toBeHidden();
    await expect(modal.locator('.list-group-item.active')).toHaveAttribute('data-judgements-core-book-id-param', '');
    await expect(saveButton).toBeHidden();
    const persisted = await (await page.request.get(`api/cases/${caseId}`)).json();
    expect(persisted.book_id).toBeNull();
    expect(persisted.auto_populate_book_pairs).toBe(false);
    expect(persisted.auto_populate_case_judgements).toBe(false);

    await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(modal).toBeHidden();
    await page.route(`**/api/teams/${teamId}/books`, route => route.fulfill({
      status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Book list verification failure' })
    }));
    await page.locator('a[data-bs-target="#judgementsModal"]').click();
    await expect(modal.locator('[data-judgements-core-target="error"]')).toContainText('Book list verification failure');
    await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(modal).toBeHidden();
    await page.unroute(`**/api/teams/${teamId}/books`);
    await page.locator('a[data-bs-target="#judgementsModal"]').click();
    await expect(modal.locator('[data-judgements-core-target="bookPicker"]')).toBeVisible();
    await expect(modal.locator('[data-judgements-core-target="error"]')).toBeHidden();
    await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(modal).toBeHidden();
    await page.route(`**/api/teams/${teamId}/books`, route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ books: [] })
    }));
    await page.locator('a[data-bs-target="#judgementsModal"]').click();
    await expect(modal.locator('[data-judgements-core-target="noBooks"]')).toBeVisible();
    await expect(modal.locator('[data-judgements-core-target="bookPicker"]')).toBeHidden();
    await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(modal).toBeHidden();
    await page.unroute(`**/api/teams/${teamId}/books`);
    await page.unroute(`**/api/cases/${caseId}`);
    await page.route(`**/api/cases/${caseId}`, async route => {
      const response = await route.fetch();
      const data = await response.json();
      await route.fulfill({ response, json: { ...data, teams: [] } });
    });
    await page.locator('a[data-bs-target="#judgementsModal"]').click();
    await expect(modal.locator('[data-judgements-core-target="noTeams"]')).toBeVisible();
    await expect(modal.locator('[data-judgements-core-target="bookPicker"]')).toBeHidden();
  });
});

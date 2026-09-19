import { test, expect, type Page } from '@playwright/test';
import { playwrightBaseURL } from './env';

/**
 * Behavioral coverage for the Stimulus core-toolbar modals migrated off
 * Angular: pick-scorer-core, take-snapshot-core, judgements-core.
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
  test('select scorer saves via API and closes the modal', async ({ page }) => {
    const caseId = await createDisposableCase(page, 'Pick-Scorer');
    pickScorerCaseId = caseId;

    await gotoCase(page, caseId);
    await page.locator('a[data-controller="pick-scorer-core"]').click();

    const modal = page.locator('#pickScorerModal.show');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText(/How would you like to score/i);

    const option = modal.locator('.list-group-item').first();
    await expect(option).toBeVisible({ timeout: 10_000 });
    await option.click();

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
  });

  test('take snapshot creates via bridge and lists in compare picker', async ({ page }) => {
    test.setTimeout(90_000);
    const caseId = await createDisposableCase(page, 'Take-Snapshot');
    takeSnapshotCaseId = caseId;

    await gotoCase(page, caseId);
    await page.locator('a[data-controller="take-snapshot-core"]').click();

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

  test('judgements modal links a book and saves settings', async ({ page }) => {
    const caseId = await createDisposableCase(page, 'Judgements');
    judgementsCaseId = caseId;
    const teamId = await shareCaseWithFirstTeam(page, caseId);

    await gotoCase(page, caseId);
    await page.locator('a[data-controller="judgements-core"]').click();

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
    await bookItems.nth(1).click();
    const saveButton = modal.locator('[data-judgements-core-target="saveButton"]');
    await expect(saveButton).toBeVisible();

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
  });
});

import { test, expect, type Page } from '@playwright/test';
import { playwrightBaseURL } from './env';
import { CASE_ID, apiHeaders, deleteCaseViaApi } from './case_helpers';

// Both flows mutate only disposable clones; cleanup also runs after a failed test.
const caseIds: number[] = [];
async function cloneCase(page: Page) {
  await page.goto(`case/${CASE_ID}`);
  const sourceResponse = await page.request.get(`api/cases/${CASE_ID}`, { headers: await apiHeaders(page, { 'Content-Type': 'application/json' }) });
  expect(sourceResponse.ok()).toBeTruthy();
  const source = await sourceResponse.json();
  const tryNumber = Number(source.last_try_number);
  expect(source.tries.some((item: { try_number: number }) => Number(item.try_number) === tryNumber)).toBeTruthy();
  const response = await page.request.post('api/clone/cases', {
    headers: await apiHeaders(page, { 'Content-Type': 'application/json' }),
    data: { case_id: CASE_ID, case_name: `Catalog templates ${Date.now()}`, clone_queries: true,
      clone_ratings: true, preserve_history: false, try_number: tryNumber }
  });
  expect(response.ok()).toBeTruthy();
  const id = Number((await response.json()).case_id);
  caseIds.push(id);
  await page.goto(`case/${id}/try/1`);
  await expect(page.locator('#case-actions')).toBeVisible();
  return id;
}
const failure = { status: 500, contentType: 'application/json', body: '{"error":"forced catalog failure"}' };

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage({ baseURL: playwrightBaseURL(), storageState: 'test/playwright/.auth/user.json' });
  try {
    await page.goto('cases');
    for (const id of caseIds) {
      await deleteCaseViaApi(page, id);
    }
  } finally { await page.close(); }
});

test('snapshot rows preserve warnings, apply/clear and delete failure/retry', async ({ page }) => {
  test.setTimeout(120_000);
  const id = await cloneCase(page);
  await expect(page.locator('.search-feedback:visible')).toHaveCount(0, { timeout: 40_000 });
  await page.getByText('Create snapshot', { exact: true }).click();
  await page.locator('#takeSnapshotModal input[type=text]').fill('Catalog snapshot');
  await page.getByRole('button', { name: 'Take Snapshot', exact: true }).click();
  await expect(page.locator('#takeSnapshotModal')).toBeHidden({ timeout: 40_000 });
  const modal = page.locator('#diffModal');
  const open = async () => {
    await page.getByText('Compare snapshots', { exact: false }).first().click();
    await expect(modal).toBeVisible();
    await expect(modal.locator('[data-diff-core-target=progress]')).toBeHidden();
  };
  const listUrl = `**/api/cases/${id}/snapshots?shallow=true`;
  await page.route(listUrl, route => route.fulfill(failure));
  await open();
  await expect(modal.locator('.alert-danger')).toContainText('Could not load');
  await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.unroute(listUrl);
  await open();
  const snapshotId = await modal.locator('select option').nth(1).getAttribute('value') as string;
  await modal.locator('select').selectOption(snapshotId);
  for (let i = 0; i < 4; i++) await modal.getByRole('button', { name: 'Add Snapshot', exact: true }).click();
  await expect(modal.locator('select')).toHaveCount(5);
  await expect(modal.getByRole('button', { name: 'Add Snapshot', exact: true })).toBeHidden();
  await modal.locator('select').nth(1).selectOption(snapshotId);
  await expect(modal.locator('[data-diff-core-target=warning]')).toBeVisible();
  await modal.getByRole('button', { name: 'Remove this snapshot selection', exact: true }).nth(1).click();
  await expect(modal.locator('select')).toHaveCount(4);
  await expect(modal.locator('[data-diff-core-target=warning]')).toBeHidden();
  const itemUrl = `**/api/cases/${id}/snapshots/${snapshotId}**`;
  await page.route(itemUrl, route => route.fulfill(failure));
  await modal.getByRole('button', { name: 'Update Comparison Settings', exact: true }).click();
  await expect(modal.locator('.alert-danger')).toContainText('Could not fetch');
  await expect(modal.locator('select').first()).toHaveValue(snapshotId);
  await page.unroute(itemUrl);
  await modal.getByRole('button', { name: 'Update Comparison Settings', exact: true }).click();
  await expect(modal).toBeHidden();
  await expect(page.locator('.diff-score').first()).toBeVisible();
  await expect(page.locator('[data-controller="diff-case-scores"] .case-score').first()).toBeVisible();
  await open();
  await expect(modal.locator('select').first()).toHaveValue(snapshotId);
  await modal.getByRole('button', { name: 'Delete this snapshot', exact: true }).click();
  await modal.locator('[data-action="click->diff-core#cancelDelete"]').click();
  await expect(modal.locator('[data-diff-core-target=deleteWarning]')).toBeHidden();
  await modal.getByRole('button', { name: 'Clear Comparison View', exact: true }).click();
  await expect(modal).toBeHidden();
  await expect(page.locator('.diff-score')).toHaveCount(0);
  await open();
  await modal.locator('select').selectOption(snapshotId);
  await modal.getByRole('button', { name: 'Delete this snapshot', exact: true }).click();
  await page.route(itemUrl, route => route.fulfill(failure));
  await modal.locator('[data-action="click->diff-core#confirmDelete"]').click();
  await expect(modal.locator('.alert-danger')).toContainText('Could not delete');
  await expect(modal.locator('select')).toHaveValue(snapshotId);
  await expect(modal.locator('[data-diff-core-target=deleteWarning]')).toBeVisible();
  await page.unroute(itemUrl);
  await modal.locator('[data-action="click->diff-core#confirmDelete"]').click();
  await expect(modal.locator('select')).toHaveValue('');
  await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
  await open();
  await expect(modal.locator('option')).toHaveCount(1);
});

test('core sharing preserves selections, errors, persistence and empty states', async ({ page }) => {
  test.setTimeout(90_000);
  const id = await cloneCase(page);
  const modal = page.locator('#shareCaseModal');
  const open = async () => {
    await page.getByText('Share case', { exact: true }).click();
    await expect(modal).toBeVisible();
    await expect(modal.locator('[data-share-case-core-target=loading]')).toBeHidden();
  };
  const cancel = async () => { await modal.getByRole('button', { name: 'Cancel', exact: true }).click(); };
  await page.route('**/api/teams', route => route.fulfill(failure));
  await open();
  await expect(modal.locator('.alert-danger')).toContainText('Unable to load');
  await expect(modal.locator('[data-share-case-core-target=emptyShareable]')).toBeHidden();
  await cancel();
  await page.unroute('**/api/teams');
  await page.route('**/api/teams', route => route.fulfill({ contentType: 'application/json', body: '{"teams":[]}' }));
  await open();
  await expect(modal.locator('[data-share-case-core-target=emptyShareable]')).toBeVisible();
  await cancel();
  await page.unroute('**/api/teams');
  await open();
  const team = modal.locator('#share-case-shareable-list button').first();
  const teamId = await team.getAttribute('data-team-id');
  await team.click();
  await team.click();
  await expect(modal.locator('#share-case-submit')).toBeHidden();
  await team.click();
  await cancel();
  await open();
  await expect(modal.locator('#share-case-submit')).toBeHidden();
  await team.click();
  const shareUrl = `**/api/teams/${teamId}/cases`;
  await page.route(shareUrl, route => route.fulfill(failure));
  await modal.locator('#share-case-submit').click();
  await expect(modal.locator('.alert-danger')).toBeVisible();
  await expect(team).toHaveClass(/active/);
  await page.unroute(shareUrl);
  await modal.locator('#share-case-submit').click();
  const shared = modal.locator(`#share-case-shared-list button[data-team-id="${teamId}"]`);
  await expect(shared).toBeVisible();
  await cancel();
  await page.reload();
  await open();
  await expect(shared).toBeVisible();
  await expect(modal.locator('[data-share-case-core-target=emptyShareable]')).toBeHidden();
  await shared.click();
  const unshareUrl = `**/api/teams/${teamId}/cases/${id}`;
  await page.route(unshareUrl, route => route.fulfill(failure));
  await modal.locator('#unshare-case-submit').click();
  await expect(modal.locator('.alert-danger')).toBeVisible();
  await expect(shared).toHaveClass(/active/);
  await page.unroute(unshareUrl);
  await modal.locator('#unshare-case-submit').click();
  await expect(shared).toHaveCount(0);
  await cancel();
  await page.reload();
  await open();
  await expect(shared).toHaveCount(0);
  await expect(team).toBeVisible();
  await cancel();
  // Management pages retain their select/form UI on the same disposable case.
  await page.goto(`cases?q=${id}`);
  await page.locator(`button[data-share-case-id-value="${id}"]`).click();
  await expect(page.locator('#shareCaseModal select#share-case-team')).toBeVisible();
  await expect(page.locator('#share-case-submit')).toBeDisabled();
  await expect(page.locator('#unshare-case-submit')).toBeDisabled();
});

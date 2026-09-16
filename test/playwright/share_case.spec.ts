import { test, expect, type Page } from '@playwright/test';
import { dynamicRegions } from './angular_case_helpers';

/**
 * Permanent regression coverage for case sharing: the Stimulus
 * `share-case-core` modal on the core case toolbar, the judgements-modal
 * bridge into it, and the Rails cases-index/teams `share-case` modal.
 *
 * This supersedes two transitional specs:
 *  - The "share-case" tests that used to live in dom_migration_screenshots.spec.ts
 *    were written to screenshot-diff the AngularJS share-case UI against its
 *    Stimulus replacement while both existed side by side. Commit 9eebf95c
 *    deleted the Angular share_case component entirely (app/assets/javascripts/
 *    components/share_case/*), so there is no more "before" to diff against —
 *    these are now ordinary baseline screenshots (`toHaveScreenshot`), not a
 *    migration diff.
 *  - share_case_smoke.spec.ts was an explicitly-labeled "one-off" smoke test
 *    for the full share -> unshare click flow. Its coverage is folded into
 *    the "sharing then unsharing" test below.
 */

/** Case with a team the seeded user belongs to (fresh seed: case 1, one user team). */
const SHARE_CASE_ID = Number(process.env.QUEPID_E2E_SHARE_CASE_ID || 1);

async function gotoCase(page: Page, caseId = SHARE_CASE_ID) {
  await page.goto(`case/${caseId}`);
  await page.waitForSelector('#case-actions, .results-list-element li, .modal.show', { timeout: 20_000 });
}

async function gotoCasesIndex(page: Page) {
  await page.goto('cases');
  await page.waitForSelector('table tbody tr', { timeout: 20_000 });
}

async function apiHeaders(page: Page) {
  if (!page.url().includes('/case/')) {
    await page.goto(`case/${SHARE_CASE_ID}`);
    await page.waitForSelector('#case-actions', { timeout: 20_000 });
  }
  const csrf = await page.evaluate(() =>
    document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? ''
  );
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrf
  };
}

async function fetchTeams(page: Page): Promise<Array<{ id: number; name: string }>> {
  const teamsResponse = await page.request.get('/api/teams', { headers: await apiHeaders(page) });
  expect(teamsResponse.ok()).toBeTruthy();
  const payload = await teamsResponse.json();
  return Array.isArray(payload.teams) ? payload.teams : [];
}

async function shareCaseWithTeam(page: Page, caseId: number, teamId: number) {
  const headers = await apiHeaders(page);
  const response = await page.request.post(`/api/teams/${teamId}/cases`, {
    data: { id: caseId },
    headers
  });
  expect(response.ok()).toBeTruthy();
}

async function unshareCaseFromTeam(page: Page, caseId: number, teamId: number) {
  const headers = await apiHeaders(page);
  const response = await page.request.delete(`/api/teams/${teamId}/cases/${caseId}`, {
    headers
  });
  expect(response.ok() || response.status() === 204).toBeTruthy();
}

async function shareCaseWithAllTeams(page: Page, caseId: number) {
  const teams = await fetchTeams(page);
  for (const team of teams) {
    await shareCaseWithTeam(page, caseId, team.id);
  }
}

async function unshareAllTeamsFromCase(page: Page, caseId: number) {
  const teams = await fetchTeams(page);
  for (const team of teams) {
    await unshareCaseFromTeam(page, caseId, team.id);
  }
}

async function openCasesIndexShareModalForCase(page: Page, caseId: number) {
  await gotoCasesIndex(page);
  const shareBtn = page.locator(`button[data-share-case-id-value="${caseId}"]`);
  await expect(shareBtn).toBeVisible({ timeout: 15_000 });
  await shareBtn.click();
  const modal = page.locator('#shareCaseModal.show, .modal.show').first();
  await expect(modal).toContainText(/Share Case/i);
  return modal;
}

async function openCoreShareModal(page: Page) {
  await page.getByText('Share case', { exact: true }).click();
  const modal = page.locator('#shareCaseModal.show, .modal.show').first();
  await expect(modal).toContainText(/Share Case/i);
  await expect(modal.locator('[data-share-case-core-target="loading"]')).toBeHidden({ timeout: 15_000 });
  return modal;
}

/** Mask async flash copy so screenshots stay stable across runs. */
function shareCaseScreenshotOpts(page: Page) {
  return { mask: dynamicRegions(page), maxDiffPixelRatio: 0.025 };
}

test.describe('core case toolbar: share-case modal (share-case-core Stimulus controller)', () => {
  test('share case button is visible in the toolbar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoCase(page);
    await page.locator('#case-actions, [data-bs-target="#shareCaseModal"]').first().scrollIntoViewIfNeeded();
    await expect(page.getByText('Share case', { exact: true })).toBeVisible();
    await expect(page).toHaveScreenshot('share-case-toolbar.png', shareCaseScreenshotOpts(page));
  });

  test('modal lists a shareable team when one exists', async ({ page }) => {
    await unshareAllTeamsFromCase(page, SHARE_CASE_ID);
    await page.setViewportSize({ width: 900, height: 900 });
    await gotoCase(page);
    const modal = await openCoreShareModal(page);

    const shareable = modal.locator('#share-case-shareable-list [data-team-id]');
    expect(
      await shareable.count(),
      'seed data must include at least one team the current user belongs to, not already sharing this case'
    ).toBeGreaterThan(0);

    await page.setViewportSize({ width: 900, height: 820 });
    await expect(page).toHaveScreenshot('share-case-modal-with-shareable.png', shareCaseScreenshotOpts(page));
  });

  test('selecting a shareable team enables the share submit button', async ({ page }) => {
    await unshareAllTeamsFromCase(page, SHARE_CASE_ID);
    await page.setViewportSize({ width: 900, height: 900 });
    await gotoCase(page);
    const modal = await openCoreShareModal(page);

    const shareableItems = modal.locator('#share-case-shareable-list [data-team-id]');
    expect(
      await shareableItems.count(),
      'seed data must include at least one team not already sharing this case'
    ).toBeGreaterThan(0);

    await shareableItems.first().click();
    await expect(modal.locator('#share-case-submit')).toBeVisible();

    await page.setViewportSize({ width: 900, height: 820 });
    await expect(page).toHaveScreenshot('share-case-modal-shareable-selected.png', shareCaseScreenshotOpts(page));
  });

  test('modal shows an empty state once every team already shares the case', async ({ page }) => {
    await shareCaseWithAllTeams(page, SHARE_CASE_ID);
    await page.setViewportSize({ width: 900, height: 900 });
    await gotoCase(page, SHARE_CASE_ID);
    const modal = await openCoreShareModal(page);

    await expect(modal.locator('#share-case-shareable-list [data-team-id]')).toHaveCount(0);
    await expect(modal.locator('[data-share-case-core-target="emptyShareable"]')).toBeVisible();

    await page.setViewportSize({ width: 900, height: 820 });
    await expect(page).toHaveScreenshot('share-case-modal-no-shareable.png', shareCaseScreenshotOpts(page));

    await unshareAllTeamsFromCase(page, SHARE_CASE_ID);
  });

  test('selecting a shared team enables the unshare submit button', async ({ page }) => {
    await shareCaseWithAllTeams(page, SHARE_CASE_ID);
    await page.setViewportSize({ width: 900, height: 900 });
    await gotoCase(page, SHARE_CASE_ID);
    const modal = await openCoreShareModal(page);

    const shared = modal.locator('#share-case-shared-list .list-group-item-success').first();
    await expect(shared).toBeVisible();
    await shared.click();
    await expect(modal.locator('#unshare-case-submit')).toBeVisible();

    await page.setViewportSize({ width: 900, height: 820 });
    await expect(page).toHaveScreenshot('share-case-modal-unshare-selected.png', shareCaseScreenshotOpts(page));

    await unshareAllTeamsFromCase(page, SHARE_CASE_ID);
  });

  test('sharing then unsharing a case updates the toolbar team lists', async ({ page }) => {
    const teams = await fetchTeams(page);
    expect(
      teams.length,
      'seed data must include at least one team the current user belongs to for share-case coverage'
    ).toBeGreaterThan(0);

    // Start from a known "not shared" state so the flow below is deterministic
    // regardless of what earlier tests/runs left behind.
    await unshareAllTeamsFromCase(page, SHARE_CASE_ID);

    await gotoCase(page, SHARE_CASE_ID);
    const modal = await openCoreShareModal(page);

    const shareable = modal.locator('#share-case-shareable-list [data-team-id]');
    await expect(shareable.first()).toBeAttached({ timeout: 5_000 });
    const teamId = await shareable.first().getAttribute('data-team-id');
    const teamName = (await shareable.first().textContent())?.trim() ?? '';

    await shareable.first().click();
    await expect(modal.locator('#share-case-submit')).toBeVisible();
    await modal.locator('#share-case-submit').click();
    await expect(modal.locator('.alert-success')).toContainText('shared', { timeout: 10_000 });
    await expect(modal.locator(`#share-case-shared-list [data-team-id="${teamId}"]`)).toBeVisible();

    const shared = modal.locator('#share-case-shared-list [data-team-id]').filter({ hasText: teamName });
    await shared.first().click();
    await expect(modal.locator('#unshare-case-submit')).toBeVisible();
    await modal.locator('#unshare-case-submit').click();
    await expect(modal.locator('.alert-success')).toContainText('unshared', { timeout: 10_000 });

    await modal.getByRole('button', { name: 'Cancel' }).click();
    await expect(modal).toBeHidden({ timeout: 5_000 });
  });

  test('judgements modal "share case" link opens the core share modal', async ({ page }) => {
    await unshareAllTeamsFromCase(page, SHARE_CASE_ID);
    await page.setViewportSize({ width: 900, height: 900 });
    await gotoCase(page, SHARE_CASE_ID);
    await page.locator('judgements').getByText('Judgements', { exact: true }).click();
    const judgementsModal = page.locator('.modal.show').first();
    await expect(judgementsModal).toBeVisible();
    const shareCaseLink = judgementsModal.getByText('share case', { exact: true });
    await expect(shareCaseLink).toBeVisible({ timeout: 15_000 });
    await shareCaseLink.click();
    await expect(judgementsModal).toBeHidden({ timeout: 10_000 });

    const shareModal = page.locator('#shareCaseModal.show');
    await expect(shareModal).toBeVisible();
    await expect(shareModal.locator('[data-share-case-core-target="loading"]')).toBeHidden({
      timeout: 15_000
    });
    await expect(shareModal.locator('#share-case-shareable-list [data-team-id]').first()).toBeAttached({
      timeout: 5_000
    });
  });
});

test.describe('cases index: share-case modal (Rails select + form POST)', () => {
  test('defaults to disabled submit buttons', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    const modal = await openCasesIndexShareModalForCase(page, SHARE_CASE_ID);

    // Rails index/teams: <select> + always-visible disabled footers (not core list-group).
    const teamSelect = modal.locator('select#share-case-team');
    await expect(teamSelect).toBeVisible();
    await expect(teamSelect.locator('option').first()).toHaveText(/Select a team/i);
    await expect(modal.locator('#share-case-submit')).toBeVisible();
    await expect(modal.locator('#unshare-case-submit')).toBeVisible();
    await expect(modal.locator('#share-case-submit')).toBeDisabled();
    await expect(modal.locator('#unshare-case-submit')).toBeDisabled();

    await page.setViewportSize({ width: 900, height: 820 });
    await expect(page).toHaveScreenshot('share-case-rails-modal-default.png', shareCaseScreenshotOpts(page));
  });

  test('enables the share submit button once a team is selected', async ({ page }) => {
    await unshareAllTeamsFromCase(page, SHARE_CASE_ID);
    await page.setViewportSize({ width: 900, height: 900 });
    const modal = await openCasesIndexShareModalForCase(page, SHARE_CASE_ID);

    const teamSelect = modal.locator('#share-case-team');
    const options = teamSelect.locator('option');
    expect(await options.count()).toBeGreaterThan(1);
    const value = await options.nth(1).getAttribute('value');
    expect(value, 'seed data must give the share team <select> at least one selectable team option').toBeTruthy();

    await teamSelect.selectOption(value as string);
    await expect(modal.locator('#share-case-submit')).toBeEnabled();

    await page.setViewportSize({ width: 900, height: 820 });
    await expect(page).toHaveScreenshot('share-case-rails-modal-team-selected.png', shareCaseScreenshotOpts(page));
  });

  test('enables the unshare submit button once a shared team is selected', async ({ page }) => {
    await shareCaseWithAllTeams(page, SHARE_CASE_ID);
    await page.setViewportSize({ width: 900, height: 900 });
    const modal = await openCasesIndexShareModalForCase(page, SHARE_CASE_ID);

    const shared = modal.locator('#share-case-shared-list [data-team-id]').first();
    expect(
      await shared.count(),
      'seed data must include at least one team already sharing this case for the unshare-selected flow'
    ).toBeGreaterThan(0);

    await shared.click();
    await expect(modal.locator('#unshare-case-submit')).toBeEnabled();

    await page.setViewportSize({ width: 900, height: 820 });
    await expect(page).toHaveScreenshot('share-case-rails-modal-unshare-selected.png', shareCaseScreenshotOpts(page));

    await unshareAllTeamsFromCase(page, SHARE_CASE_ID);
  });
});

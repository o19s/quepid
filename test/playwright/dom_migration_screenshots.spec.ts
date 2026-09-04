import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/** Set MIGRATION_SHOT_PHASE=before|after (default after). */
const PHASE = process.env.MIGRATION_SHOT_PHASE === 'before' ? 'before' : 'after';
/** Case with teams for share-case shots (fresh seed: case 1, one user team). */
const SHARE_CASE_ID = Number(process.env.QUEPID_E2E_SHARE_CASE_ID || 1);
/** Case with queries in DB for hit-count / annotations (seed: case 5 has 20 queries). */
const QUERIES_CASE_ID = Number(process.env.QUEPID_E2E_QUERIES_CASE_ID || 5);
/**
 * Topic subfolder under `.playwright-mcp/` so the screenshot viewer can group
 * this PR's shots separately from older captures. Override with MIGRATION_SHOT_TOPIC.
 * Share-case tests default to `share-case/` even when the env var is unset.
 */
const TOPIC = process.env.MIGRATION_SHOT_TOPIC || '';

async function gotoCase(page: import('@playwright/test').Page, caseId = SHARE_CASE_ID) {
  await page.goto(`case/${caseId}`);
  await page.waitForSelector('#case-actions, .results-list-element li, .modal.show', { timeout: 20_000 });
}

async function expandFirstQuery(page: import('@playwright/test').Page) {
  if ((await page.locator('search-result').count()) > 0) return;
  const toggle = page.locator('.results-list-element li .toggleSign, .results-list-element li [ng-click*="toggle"]').first();
  await expect(toggle).toBeVisible({ timeout: 20_000 });
  await toggle.click();
  await page.waitForSelector('search-result', { timeout: 15_000 });
}

async function apiHeaders(page: import('@playwright/test').Page) {
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

async function shareCaseWithTeam(page: import('@playwright/test').Page, caseId: number, teamId: number) {
  const headers = await apiHeaders(page);
  const response = await page.request.post(`/api/teams/${teamId}/cases`, {
    data: { id: caseId },
    headers
  });
  expect(response.ok()).toBeTruthy();
}

async function unshareCaseFromTeam(page: import('@playwright/test').Page, caseId: number, teamId: number) {
  const headers = await apiHeaders(page);
  const response = await page.request.delete(`/api/teams/${teamId}/cases/${caseId}`, {
    headers
  });
  expect(response.ok() || response.status() === 204).toBeTruthy();
}

async function shareCaseWithAllTeams(page: import('@playwright/test').Page, caseId: number) {
  const headers = await apiHeaders(page);
  const teamsResponse = await page.request.get('/api/teams', { headers });
  expect(teamsResponse.ok()).toBeTruthy();
  const payload = await teamsResponse.json();
  const teams = Array.isArray(payload.teams) ? payload.teams : [];
  for (const team of teams) {
    await shareCaseWithTeam(page, caseId, team.id);
  }
}

async function ensureCaseSharedWithOneTeam(page: import('@playwright/test').Page, caseId: number) {
  const headers = await apiHeaders(page);
  const teamsResponse = await page.request.get('/api/teams', { headers });
  expect(teamsResponse.ok()).toBeTruthy();
  const payload = await teamsResponse.json();
  const teams = Array.isArray(payload.teams) ? payload.teams : [];
  if (teams.length === 0) {
    test.skip(true, 'No teams available for judgements/share setup');
  }
  await shareCaseWithTeam(page, caseId, teams[0].id);
}

async function gotoCasesIndex(page: import('@playwright/test').Page) {
  await page.goto('cases');
  await page.waitForSelector('table tbody tr', { timeout: 20_000 });
}

async function unshareAllTeamsFromCase(page: import('@playwright/test').Page, caseId: number) {
  const headers = await apiHeaders(page);
  const teamsResponse = await page.request.get('/api/teams', { headers });
  expect(teamsResponse.ok()).toBeTruthy();
  const payload = await teamsResponse.json();
  const teams = Array.isArray(payload.teams) ? payload.teams : [];
  for (const team of teams) {
    await unshareCaseFromTeam(page, caseId, team.id);
  }
}

async function openCasesIndexShareModalForCase(page: import('@playwright/test').Page, caseId: number) {
  await gotoCasesIndex(page);
  const shareBtn = page.locator(`button[data-share-case-id-value="${caseId}"]`);
  await expect(shareBtn).toBeVisible({ timeout: 15_000 });
  await shareBtn.click();
  const modal = page.locator('#shareCaseModal.show, .modal.show').first();
  await expect(modal).toContainText(/Share Case/i);
  return modal;
}

async function shot(page: import('@playwright/test').Page, stem: string, topic = TOPIC) {
  const dir = path.join(__dirname, '../../.playwright-mcp', topic);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `migration-${stem}-${PHASE}.png`);
  await page.screenshot({ path: file, fullPage: false, mask: [page.locator('#flash-messages')] });
  console.log(`wrote ${file}`);
}

async function openHelpPopover(page: import('@playwright/test').Page, modal: import('@playwright/test').Locator) {
  const help = modal.locator('.bi-question-circle-fill').first();
  await help.scrollIntoViewIfNeeded();
  const popoverBody = page.locator('.popover.show .popover-body, .popover-body').first();

  // After: bs-static-popover (hover). Before: quepid-popover + mouseenter → BS5 hover focus.
  await help.hover({ force: true });
  try {
    await expect(popoverBody).toBeVisible({ timeout: 2_000 });
  } catch {
    await help.focus();
    try {
      await expect(popoverBody).toBeVisible({ timeout: 2_000 });
    } catch {
      await help.evaluate((el) => {
        const bs = (window as Window & { bootstrap?: { Popover: { getInstance: (e: Element) => { show: () => void } | null; new (e: Element): { show: () => void } } } }).bootstrap;
        if (!bs?.Popover) return;
        const inst = bs.Popover.getInstance(el) ?? new bs.Popover(el);
        inst.show();
      });
    }
  }
  await expect(popoverBody).toBeVisible({ timeout: 8_000 });
}

test.describe(`DOM migration shots (${PHASE})`, () => {
  test('hit count', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await gotoCase(page, QUERIES_CASE_ID);
    await expandFirstQuery(page);
    await shot(page, 'hit-count');
  });

  test('share-case toolbar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoCase(page);
    await page.locator('#case-actions, [data-bs-target="#shareCaseModal"]').first().scrollIntoViewIfNeeded();
    await expect(page.getByText('Share case', { exact: true })).toBeVisible();
    await shot(page, 'share-case-toolbar', 'share-case');
  });

  test('share-case modal with shareable', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await gotoCase(page);
    await page.getByText('Share case', { exact: true }).click();
    const modal = page.locator('#shareCaseModal.show, .modal.show').first();
    await expect(modal).toContainText(/Share Case/i);
    await expect(modal.locator('[data-share-case-core-target="loading"]')).toBeHidden({ timeout: 15_000 });
    // Requires at least one team not yet sharing this case (Angular list-group parity).
    await expect(modal.locator('#share-case-shareable-list [data-team-id]').first()).toBeAttached({
      timeout: 5_000
    });
    await page.setViewportSize({ width: 900, height: 820 });
    await shot(page, 'share-case-modal-with-shareable', 'share-case');
  });

  test('share-case modal shareable selected', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await gotoCase(page);
    await page.getByText('Share case', { exact: true }).click();
    const modal = page.locator('#shareCaseModal.show, .modal.show').first();
    await expect(modal).toContainText(/Share Case/i);
    await expect(modal.locator('[data-share-case-core-target="loading"]')).toBeHidden({ timeout: 15_000 });
    const shareableItems = modal.locator('#share-case-shareable-list [data-team-id]');
    if ((await shareableItems.count()) === 0) {
      test.skip(true, 'No unshared team available for shareable-selected shot');
    }
    await shareableItems.first().click();
    await expect(modal.locator('#share-case-submit')).toBeVisible();
    await page.setViewportSize({ width: 900, height: 820 });
    await shot(page, 'share-case-modal-shareable-selected', 'share-case');
  });

  test('share-case modal no shareable', async ({ page }) => {
    await shareCaseWithAllTeams(page, SHARE_CASE_ID);
    await page.setViewportSize({ width: 900, height: 900 });
    await gotoCase(page, SHARE_CASE_ID);
    await page.getByText('Share case', { exact: true }).click();
    const modal = page.locator('#shareCaseModal.show, .modal.show').first();
    await expect(modal).toContainText(/Share Case/i);
    await expect(modal.locator('[data-share-case-core-target="loading"]')).toBeHidden({ timeout: 15_000 });
    await expect(modal.locator('#share-case-shareable-list [data-team-id]')).toHaveCount(0);
    await expect(modal.locator('[data-share-case-core-target="emptyShareable"]')).toBeVisible();
    await page.setViewportSize({ width: 900, height: 820 });
    await shot(page, 'share-case-modal-no-shareable', 'share-case');
    const teamsResponse = await page.request.get('/api/teams', { headers: await apiHeaders(page) });
    const payload = await teamsResponse.json();
    const teams = Array.isArray(payload.teams) ? payload.teams : [];
    if (teams.length > 0) {
      await unshareCaseFromTeam(page, SHARE_CASE_ID, teams[0].id);
    }
  });

  test('share-case modal unshare selected', async ({ page }) => {
    await shareCaseWithAllTeams(page, SHARE_CASE_ID);
    await page.setViewportSize({ width: 900, height: 900 });
    await gotoCase(page, SHARE_CASE_ID);
    await page.getByText('Share case', { exact: true }).click();
    const modal = page.locator('#shareCaseModal.show, .modal.show').first();
    await expect(modal).toContainText(/Share Case/i);
    await expect(modal.locator('[data-share-case-core-target="loading"]')).toBeHidden({ timeout: 15_000 });
    const shared = modal.locator('#share-case-shared-list .list-group-item-success').first();
    await expect(shared).toBeVisible();
    await shared.click();
    await expect(modal.locator('#unshare-case-submit')).toBeVisible();
    await page.setViewportSize({ width: 900, height: 820 });
    await shot(page, 'share-case-modal-unshare-selected', 'share-case');
    const teamsResponse = await page.request.get('/api/teams', { headers: await apiHeaders(page) });
    const payload = await teamsResponse.json();
    const teams = Array.isArray(payload.teams) ? payload.teams : [];
    if (teams.length > 0) {
      await unshareCaseFromTeam(page, SHARE_CASE_ID, teams[0].id);
    }
  });

  test('share-case rails modal default', async ({ page }) => {
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
    await shot(page, 'share-case-rails-modal-default', 'share-case-rails');
  });

  test('share-case rails modal team selected', async ({ page }) => {
    await unshareAllTeamsFromCase(page, SHARE_CASE_ID);
    await page.setViewportSize({ width: 900, height: 900 });
    const modal = await openCasesIndexShareModalForCase(page, SHARE_CASE_ID);
    const teamSelect = modal.locator('#share-case-team');
    const options = teamSelect.locator('option');
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThan(1);
    const value = await options.nth(1).getAttribute('value');
    if (!value) {
      test.skip(true, 'Share team select has no shareable option value');
    }
    await teamSelect.selectOption(value);
    await expect(modal.locator('#share-case-submit')).toBeEnabled();
    await page.setViewportSize({ width: 900, height: 820 });
    await shot(page, 'share-case-rails-modal-team-selected', 'share-case-rails');
  });

  test('share-case rails modal unshare selected', async ({ page }) => {
    await ensureCaseSharedWithOneTeam(page, SHARE_CASE_ID);
    await page.setViewportSize({ width: 900, height: 900 });
    const modal = await openCasesIndexShareModalForCase(page, SHARE_CASE_ID);
    const shared = modal.locator('#share-case-shared-list [data-team-id]').first();
    if ((await shared.count()) === 0) {
      test.skip(true, 'No shared team on cases index row for unshare-selected shot');
    }
    await shared.click();
    await expect(modal.locator('#unshare-case-submit')).toBeEnabled();
    await page.setViewportSize({ width: 900, height: 820 });
    await shot(page, 'share-case-rails-modal-unshare-selected', 'share-case-rails');
  });

  test('judgements share case opens core modal', async ({ page }) => {
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

  test('clone-case popover', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await gotoCase(page);
    await page.locator('clone-case a').click();
    const modal = page.locator('.modal.show').first();
    await expect(modal).toBeVisible();
    await page.setViewportSize({ width: 900, height: 760 });
    await openHelpPopover(page, modal);
    await shot(page, 'clone-case-popover');
  });

  test('judgements popover', async ({ page }) => {
    await ensureCaseSharedWithOneTeam(page, SHARE_CASE_ID);
    await page.setViewportSize({ width: 900, height: 900 });
    await gotoCase(page, SHARE_CASE_ID);
    await page.locator('judgements').getByText('Judgements', { exact: true }).click();
    const modal = page.locator('.modal.show').first();
    await expect(modal).toBeVisible();
    await expect(modal.getByLabel('Help').first()).toBeVisible({ timeout: 15_000 });
    await page.setViewportSize({ width: 900, height: 820 });
    await openHelpPopover(page, modal);
    await shot(page, 'judgements-popover');
  });

  test('import-ratings popover', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await gotoCase(page);
    await page.locator('import-ratings a').click();
    const modal = page.locator('.modal.show').first();
    await expect(modal).toBeVisible();
    await page.setViewportSize({ width: 900, height: 900 });
    await openHelpPopover(page, modal);
    await shot(page, 'import-ratings-popover');
  });

  test('annotation timeAgo', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoCase(page, QUERIES_CASE_ID);
    await page.getByText('Tune Relevance', { exact: false }).click();
    await page.locator('#annotationsTab').click();
    if ((await page.locator('.annotations-time').count()) === 0) {
      await page.locator('#annotations textarea, annotations textarea').first().fill('Migration screenshot annotation');
      await page.getByRole('button', { name: 'Create', exact: true }).click();
    }
    await expect(page.locator('.annotations-time').first()).toBeVisible({ timeout: 10_000 });
    await shot(page, 'annotation-timeago');
  });
});

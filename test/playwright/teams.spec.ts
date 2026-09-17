import { test, expect, type Page } from '@playwright/test';
import { playwrightBaseURL } from './env';

// Coverage for team management (TeamsController): index listing, create, add/remove
// member, and sharing a case with a team. Tests run serially (playwright.config.ts:
// workers:1, fullyParallel:false) and later tests depend on the team created in the
// first "create" test via the module-scoped `newTeamId` below.
//
// MEMBER_EMAIL is a real seeded user (see db/seeds.rb) in the shared dev DB, not a
// fixture — it exists independently of the team this spec creates.

const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const NEW_TEAM_NAME = `Playwright Team ${uniqueSuffix}`;
const MEMBER_EMAIL = 'quepid+admin@o19s.com';
const MEMBER_FULLNAME = 'Admin User';

let newTeamId: string;

/**
 * The team created below (and the case-share it picks up in the last test)
 * used to be left behind in the shared dev DB with no teardown. Every run
 * added another "Playwright Team <timestamp>" row that never went away, so
 * the team list other specs render (e.g. share_case.spec.ts's "select a
 * team to share this case with" list) grew a little on every run, eventually
 * changing that modal's height enough to break its screenshot baselines.
 * Delete it once this file's tests are done, however they ended.
 */
test.afterAll(async ({ browser }) => {
  if (!newTeamId) return;

  const page: Page = await browser.newPage({
    baseURL: playwrightBaseURL(),
    storageState: 'test/playwright/.auth/user.json'
  });
  try {
    await page.goto('teams');
    const csrf = await page.evaluate(() =>
      document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? ''
    );
    const response = await page.request.delete(`api/teams/${newTeamId}`, {
      headers: { Accept: 'application/json', 'X-CSRF-Token': csrf }
    });
    // Assert like every other cleanup in this suite: a silent failure here
    // (e.g. an empty CSRF token nulling the session) would let this exact
    // team leak right back in on the next run with no signal.
    expect(response.ok()).toBeTruthy();
  } finally {
    await page.close();
  }
});

test.describe('team management', () => {
  test('teams index lists existing teams', async ({ page }) => {
    await page.goto('teams');
    await expect(page.getByRole('heading', { name: 'Teams' })).toBeVisible();

    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test('create a new team lands on its show page', async ({ page }) => {
    await page.goto('teams/new');
    await page.locator('#team_name').fill(NEW_TEAM_NAME);
    await page.getByRole('button', { name: 'Create Team' }).click();

    await expect(page).toHaveURL(/\/teams\/\d+$/);
    await expect(page.getByRole('heading', { name: `Team: ${NEW_TEAM_NAME}` })).toBeVisible();
    await expect(page.locator('#flash')).toContainText('Team created.');

    newTeamId = page.url().match(/\/teams\/(\d+)$/)?.[1] ?? '';
    expect(newTeamId).toBeTruthy();
  });

  test('add a member to the team by email', async ({ page }) => {
    await page.goto(`teams/${newTeamId}`);

    await page.locator('#email').fill(MEMBER_EMAIL);
    await page.getByRole('button', { name: 'Add user' }).click();

    await expect(page).toHaveURL(new RegExp(`/teams/${newTeamId}$`));
    await expect(page.locator('#flash')).toContainText('added to the team');
    await expect(page.locator('.list-group-item', { hasText: MEMBER_EMAIL })).toBeVisible();
  });

  test('remove a member from the team', async ({ page }) => {
    await page.goto(`teams/${newTeamId}`);

    const memberRow = page.locator('.list-group-item', { hasText: MEMBER_EMAIL });
    await expect(memberRow).toBeVisible();

    await memberRow.getByRole('button', { name: 'Remove member' }).click();

    const modal = page.locator('#confirmDeleteModal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.confirm-delete-message')).toContainText(MEMBER_FULLNAME);
    await modal.locator('.confirm-delete-confirm').click();

    await expect(page).toHaveURL(new RegExp(`/teams/${newTeamId}$`));
    await expect(page.locator('#flash')).toContainText('removed from the team');
    await expect(page.locator('.list-group-item', { hasText: MEMBER_EMAIL })).toHaveCount(0);
  });

  test('share a case with the team from the cases index', async ({ page }) => {
    await page.goto('cases');

    const shareButton = page.getByRole('button', { name: 'Share', exact: true }).first();
    await expect(shareButton).toBeVisible();
    const caseRow = shareButton.locator('xpath=ancestor::tr');
    const caseName = (await caseRow.locator('td').nth(1).innerText()).trim();

    await shareButton.click();
    const modal = page.locator('#shareCaseModal');
    await expect(modal).toBeVisible();

    await modal.locator('#share-case-team').selectOption({ label: NEW_TEAM_NAME });
    await modal.locator('#share-case-submit').click();

    await expect(page).toHaveURL(/\/cases(\?.*)?$/);
    await expect(page.locator('#flash')).toContainText('shared with');

    await page.goto(`teams/${newTeamId}`);
    await expect(page.getByRole('link', { name: caseName, exact: true })).toBeVisible();
  });
});

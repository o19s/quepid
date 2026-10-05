import { test, expect, type Page } from '@playwright/test';
import { playwrightBaseURL } from './env';

let createdTeamId: string | undefined;
const teamName = `Playwright Drive ${Date.now()}`;

async function settled(page: Page) {
  await expect(page.locator('html')).not.toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('html')).not.toHaveAttribute('data-turbo-preview', '');
}

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage({
    baseURL: playwrightBaseURL(),
    storageState: 'test/playwright/.auth/user.json'
  });
  try {
    await page.goto('teams');
    // Discover by unique name too, so a timeout before recording the id cannot leak a row.
    const csrf = await page.locator('meta[name="csrf-token"]').getAttribute('content') ?? '';
    const headers = { Accept: 'application/json', 'X-CSRF-Token': csrf };
    if (!createdTeamId) {
      const response = await page.request.get('api/teams', { headers });
      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      createdTeamId = body.teams?.find((team: { name: string }) => team.name === teamName)?.id?.toString();
    }
    if (createdTeamId) {
      const response = await page.request.delete(`api/teams/${createdTeamId}`, { headers });
      expect(response.ok()).toBeTruthy();
    }
  } finally {
    await page.close();
  }
});

test('Drive handles invalid and successful forms without replacing the JS environment', async ({ page }) => {
  await page.goto('teams');
  await page.evaluate(() => { (window as any).driveProbe = 'alive'; });
  await page.locator('a[href$="/teams/new"]').click();
  await expect(page).toHaveURL(/\/teams\/new$/);
  await settled(page);
  const invalidResponse = page.waitForResponse(response => response.request().method() === 'POST' && /\/teams$/.test(new URL(response.url()).pathname));
  await page.getByRole('button', { name: 'Create Team', exact: true }).click();
  expect((await invalidResponse).status()).toBe(422);
  await expect(page.locator('input.is-invalid')).toBeVisible();
  expect(await page.evaluate(() => (window as any).driveProbe)).toBe('alive');
  await page.getByLabel('Name', { exact: true }).fill(teamName);
  const successResponse = page.waitForResponse(response => response.request().method() === 'POST' && /\/teams$/.test(new URL(response.url()).pathname));
  await page.getByRole('button', { name: 'Create Team', exact: true }).click();
  expect((await successResponse).status()).toBe(303);
  await expect(page).toHaveURL(/\/teams\/\d+$/);
  createdTeamId = page.url().match(/\/teams\/(\d+)$/)![1];
  await settled(page);
  expect(await page.evaluate(() => (window as any).driveProbe)).toBe('alive');
});

test('CodeMirror survives repeated Drive visits and history restoration', async ({ page }) => {
  await page.goto('scorers');
  await page.locator('a[href$="/scorers/new"]').click();
  await expect(page).toHaveURL(/\/scorers\/new$/);
  await settled(page);
  await expect(page.locator('.cm-editor')).toHaveCount(1);
  await page.locator('.cm-content').click();
  await page.keyboard.type('return 0.42');
  await expect.poll(() => page.locator('textarea').inputValue()).toBe('return 0.42');
  await page.getByRole('link', { name: 'Teams', exact: true }).first().click();
  await expect(page).toHaveURL(/\/teams$/);
  await settled(page);
  await page.goBack();
  await expect(page).toHaveURL(/\/scorers\/new$/);
  await settled(page);
  await expect(page.locator('.cm-editor')).toHaveCount(1);
  await expect(page.locator('.cm-content')).toHaveText('return 0.42');
  await page.goForward();
  await expect(page).toHaveURL(/\/teams$/);
  await settled(page);
  await page.goBack();
  await settled(page);
  await expect(page.locator('.cm-editor')).toHaveCount(1);
});

test('archive confirmation cancels without issuing a write', async ({ page }) => {
  await page.goto('books/1');
  let writes = 0;
  page.on('request', request => {
    if (request.method() !== 'GET' && /\/books\/1\/archive$/.test(new URL(request.url()).pathname)) writes++;
  });
  let dialogs = 0;
  page.on('dialog', async dialog => {
    dialogs++;
    expect(dialog.message()).toBe('Are you sure you want to archive this book?');
    await dialog.dismiss();
  });
  await page.getByRole('button', { name: 'Archive', exact: true }).click();
  await expect.poll(() => dialogs).toBe(1);
  expect(writes).toBe(0);
  await expect(page).toHaveURL(/\/books\/1$/);
});

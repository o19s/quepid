import { test, expect, type Page, type Locator } from '@playwright/test';
import { CASE_ID, expandFirstQuery } from './case_helpers';

// Reuses the existing static-search fixture; no writes to cases, ratings or wizard state.
// Keep content visible: scores, result fields and flashes are part of the visual contract.
async function shot(page: Page, name: string, target?: Locator) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
  });
  await page.mouse.move(0, 0);
  await expect(target || page).toHaveScreenshot(`${name}.png`);
}

async function core(page: Page, wizard = false) {
  const response = await page.request.get(`api/cases/${CASE_ID}`);
  expect(response.ok(), 'The static visual fixture must be available').toBeTruthy();
  const fixture = await response.json();
  expect(fixture.case_name).toBe('E2E Static Fixture (10s of Queries)');
  expect(fixture.queries_count).toBe(20);
  // The cases API returns tries in descending try_number order.
  expect(fixture.tries[0]?.search_engine, 'Visual captures require static search on the latest try').toBe('static');
  await page.goto(`case/${CASE_ID}${wizard ? '?showWizard=true' : ''}`);
  await expect(page.locator('.results-list-element li').first()).toBeVisible();
  // Unlike the older helper, never swallow a readiness timeout.
  await expect(page.locator('.search-feedback:visible')).toHaveCount(0, { timeout: 20_000 });
  if (!wizard) {
    await expandFirstQuery(page);
    await expect(page.locator('search-result').first()).toBeVisible();
  }
}

async function closeModal(page: Page) {
  const modal = page.locator('.modal.show');
  const cancel = modal.getByRole('button', { name: 'Cancel', exact: true });
  if (await cancel.count()) await cancel.click();
  else await modal.locator('.btn-close').first().click();
  await expect(modal).toHaveCount(0);
}

// The account's teams are shared dev-DB state; serve a fixed catalog (one shared, one not).
async function openShareCase(page: Page) {
  await page.route(`**/cases/${CASE_ID}/modal_catalogs/sharing`, route => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: `<div data-share-catalog>
      <div data-catalog-list="shareable"><button type="button" class="list-group-item list-group-item-action" data-team-id="900001" data-team-order="0" data-share-case-core-team-id-param="900001" data-action="click->share-case-core#selectShareTeam">Visual Team A</button></div>
      <div data-catalog-list="shared"><button type="button" class="list-group-item list-group-item-action list-group-item-success" data-team-id="900002" data-team-order="1" data-share-case-core-team-id-param="900002" data-action="click->share-case-core#selectSharedTeam">Visual Team B</button></div>
    </div>`
  }));
  await page.getByText('Share case', { exact: true }).click();
  const modal = page.locator('.modal.show');
  await expect(modal).toContainText(/Share Case/i);
  await expect(modal).toContainText('Visual Team A');
  await expect(modal).toContainText('Visual Team B');
}

test.beforeEach(async ({ page, baseURL }) => {
  await page.clock.setFixedTime(new Date('2026-01-15T12:00:00Z'));

  // Score calculation is real; its background persistence belongs to behavioral E2E.
  await page.route('**/api/cases/*/scores', route => route.request().method() === 'PUT'
    ? route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    : route.fallback());
  // Visual tests must never silently fall back to a live external search engine.
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === new URL(baseURL!).origin ? route.fallback() : route.abort();
  });
});

test('core workspace and widgets', async ({ page }) => {
  await core(page);
  await shot(page, 'core-workspace');
  await shot(page, 'core-results', page.locator('.sub-results:visible').first());
  await page.locator('#queries-filter').fill('visual-no-match');
  await expect(page.locator('.results-list-element li')).toHaveCount(0);
  await shot(page, 'core-empty-filter');
  await page.locator('#queries-filter').fill('');
  await expandFirstQuery(page);

  await page.getByRole('button', { name: 'Set Options', exact: true }).first().click();
  await expect(page.locator('#queryOptionsModal')).toBeVisible();
  await expect(page.locator('#queryOptionsModal .cm-content')).toBeVisible();
  await shot(page, 'core-query-options');
  await closeModal(page);

  await page.getByRole('button', { name: 'Explain Query', exact: true }).first().click();
  await expect(page.locator('#query-explain-tab-params')).toBeVisible();
  await shot(page, 'core-explain');
  await closeModal(page);

  await page.locator('search-result .single-rating').first().click();
  await expect(page.locator('.popover').first()).toBeVisible();
  await shot(page, 'core-rating-popover');
  await page.locator('search-result .single-rating').first().click();
  await expect(page.locator('.popover')).toHaveCount(0);

  await page.locator('a[data-bs-target="#pickScorerModal"]').click();
  await expect(page.locator('#pickScorerModal.show')).toBeVisible();
  await shot(page, 'core-scorer');
  await closeModal(page);

  await page.locator('a[data-bs-target="#takeSnapshotModal"]').click();
  await expect(page.locator('#takeSnapshotModal.show')).toBeVisible();
  await shot(page, 'core-snapshot');
  await closeModal(page);

  await openShareCase(page);
  await shot(page, 'core-share-case');
  await closeModal(page);

  await page.getByRole('button', { name: 'Toggle Notes', exact: true }).first().click();
  const notes = page.locator('textarea[data-query-notes-target="notes"]:visible').first();
  await expect(notes).toBeVisible();
  await shot(page, 'core-query-notes');
});

test('wizard name and endpoint forms', async ({ page }) => {
  await core(page, true);
  const modal = page.locator('.modal.show');
  // User history selects Welcome or Name; navigate to Name without modifying it.
  const welcome = modal.getByRole('heading', { name: /Welcome To Quepid/i });
  await expect(modal.getByRole('heading', { name: /Welcome To Quepid|Name Your Case/i })).toBeVisible();
  if (await welcome.isVisible()) await modal.getByRole('button', { name: /^Continue$/i }).filter({ visible: true }).click();
  await expect(modal.getByRole('heading', { name: /Name Your Case/i })).toBeVisible();
  await modal.getByLabel('New Case Name:').fill('Visual regression fixture');
  await shot(page, 'wizard-name', modal.locator('.modal-dialog'));
  await modal.getByRole('button', { name: /^Continue$/i }).filter({ visible: true }).click();
  await expect(modal.getByRole('heading', { name: /What Search Endpoint/i })).toBeVisible();
  await shot(page, 'wizard-endpoint', modal.locator('.modal-dialog'));
  // No Finish/Cancel: neither persist nor delete the shared fixture.
});

test('Rails forms and empty lists', async ({ page }) => {
  for (const [url, heading, name] of [
    ['teams/new', 'New Team', 'rails-team-form'],
    ['books/new', 'Create a Book', 'rails-book-form'],
    ['search_endpoints/new', 'New Search Endpoint', 'rails-endpoint-form'],
    ['search_endpoints/mapper_wizard', 'Mapper Wizard', 'rails-mapper']
  ]) {
    await page.goto(url);
    await expect(page.getByRole('heading', { name: new RegExp(heading + '$') })).toBeVisible();
    if (url === 'search_endpoints/new') await expect(page.locator('.cm-editor').first()).toBeVisible();
    await shot(page, name);
  }
  await page.goto('books?q=visual-no-match');
  await expect(page.locator('table tbody tr')).toHaveCount(0);
  await shot(page, 'rails-books-empty');
  await page.goto('cases');
  await page.getByRole('button', { name: 'Import Case from JSON' }).click();
  await expect(page.locator('#importCaseModal')).toBeVisible();
  await shot(page, 'rails-case-import', page.locator('#importCaseModal .modal-dialog'));
});

test('admin dashboard and user form', async ({ page }) => {
  await page.goto('sessions/new');
  const login = page.locator('form#login');
  await login.locator('#user_email').fill(process.env.QUEPID_E2E_ADMIN_EMAIL || 'quepid+admin@o19s.com');
  await login.locator('#user_password').fill(process.env.QUEPID_E2E_ADMIN_PASSWORD || 'password');
  await login.locator('input[type="submit"]').click();
  await expect(page).not.toHaveURL(/sessions\/new/);
  await page.goto('admin');
  await expect(page.getByRole('heading', { name: 'Admin Settings', exact: true })).toBeVisible();
  await shot(page, 'admin-home');
  await page.goto('admin/users/new');
  await expect(page.getByRole('heading', { name: 'New User', exact: true })).toBeVisible();
  await shot(page, 'admin-user-form');
});

test('narrow core and Rails form', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await core(page);
  await shot(page, 'narrow-core');
  await openShareCase(page);
  await shot(page, 'narrow-share-case');
  await closeModal(page);
  await page.goto('teams/new');
  await expect(page.getByRole('heading', { name: 'New Team', exact: true })).toBeVisible();
  await shot(page, 'narrow-team-form');
});

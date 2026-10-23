import { test, expect, type Page } from '@playwright/test';
import { gotoCase, CASE_ID, apiHeaders, deleteCaseViaApi } from './case_helpers';

// Reuse keeps the two surfaces' distinct navigation contracts and footer placement.
const createdCases = new Set<number>();

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto('cases');
  for (const id of createdCases) {
    await deleteCaseViaApi(page, id);
  }
  await page.close();
});

async function openMenu(page: Page, surface: string, label: string) {
  const item = page.locator(`${surface} li.dropdown`).filter({ has: page.locator('.nav-label', { hasText: label }) });
  await item.locator('.dropdown-toggle').click();
  await expect(item.locator('turbo-frame li').first()).toBeVisible();
  return item;
}

for (const width of [1280, 768]) {
  test(`navigation contracts at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoCase(page);
    if (width < 992) await page.locator('#header .navbar-toggler').click();

    await expect(page.locator('#header #dropdown_cases')).toHaveAttribute('src', /dropdown\/cases_core$/);
    await expect(page.locator('#header #dropdown_books')).toHaveAttribute('src', /dropdown\/books_core$/);
    const cases = await openMenu(page, '#header', 'Relevancy Cases');
    await expect(cases.locator('small')).toHaveCount(0);
    await expect(cases.locator('turbo-frame a').first()).toHaveAttribute('data-turbo', 'false');
    await expect(cases.locator('turbo-frame a').first()).toHaveAttribute('target', '_self');
    await page.keyboard.press('Escape');

    const books = await openMenu(page, '#header', 'Books');
    const create = books.locator('a.btn-success');
    const href = await create.getAttribute('href');
    const url = new URL(href!, page.url());
    expect(url.searchParams.get('origin_case_id')).toBe(String(CASE_ID));
    expect(url.searchParams.get('scorer_id')).toMatch(/^\d+$/);
    await create.click();
    await expect(page).toHaveURL(url.href);
    await expect(page.getByRole('heading', { name: /Create a Book/ })).toBeVisible();

    await page.goto('cases');
    await expect(page.locator('body > footer code')).toBeVisible();
    if (width < 992) await page.locator('body > nav .navbar-toggler').click();
    await expect(page.locator('nav #dropdown_cases')).toHaveAttribute('src', /dropdown\/cases$/);
    await expect(page.locator('nav #dropdown_books')).toHaveAttribute('src', /dropdown\/books$/);
    const managementCases = await openMenu(page, 'body > nav', 'Relevancy Cases');
    await expect(managementCases.locator('small')).toHaveCount(0);
    // Already on /cases, so the URL can't show the Turbo visit finished; wait for its body swap.
    await page.evaluate(() => { document.body.dataset.e2eBeforeVisit = 'true'; });
    await managementCases.getByRole('link', { name: 'View all cases' }).click();
    await expect(page.locator('body[data-e2e-before-visit]')).toHaveCount(0);
    await expect(page).toHaveURL(/\/cases$/);
    if (width < 992) await page.locator('body > nav .navbar-toggler').click();
    await page.locator('body > nav').getByRole('link', { name: 'Teams', exact: true }).click();
    await expect(page).toHaveURL(/\/teams$/);
  });
}

// "Create a case" is a Turbo link on management pages; the case page's turbo-visit-control
// reload must land on the created case without replaying the case-creating GET.
test('management "Create a case" creates exactly one case and opens its wizard', async ({ page }) => {
  await page.goto('cases');
  let createRequests = 0;
  page.on('request', request => {
    if (request.method() === 'GET' && new URL(request.url()).pathname.endsWith('/cases/new')) createRequests += 1;
  });
  page.on('framenavigated', frame => {
    if (frame !== page.mainFrame()) return;
    const match = new URL(frame.url()).pathname.match(/\/case\/(\d+)\/try\//);
    if (match) createdCases.add(Number(match[1]));
  });
  const cases = await openMenu(page, 'body > nav', 'Relevancy Cases');
  await cases.getByRole('link', { name: 'Create a case' }).click();
  await expect(page).toHaveURL(/\/case\/\d+\/try\/1\?showWizard=true$/);
  await expect(page.getByRole('dialog', { name: 'Create a Quepid case' })).toBeVisible();
  expect(createRequests).toBe(1);
});

test('case header launches the new-case wizard and keeps its footer in the pane', async ({ page }) => {
  await gotoCase(page);
  await expect(page.locator('.pane_main footer')).toHaveCount(1);
  await expect(page.locator('body > footer')).toHaveCount(0);
  const cases = await openMenu(page, '#header', 'Relevancy Cases');
  // Record the created id on navigation so afterAll also cleans up a failed wizard assertion.
  page.on('framenavigated', frame => {
    if (frame !== page.mainFrame()) return;
    const url = new URL(frame.url());
    const match = url.pathname.match(/\/case\/(\d+)\/try\//);
    if (match && url.searchParams.get('showWizard') === 'true') createdCases.add(Number(match[1]));
  });
  await cases.getByRole('link', { name: 'Create a case' }).click();
  await expect(page).toHaveURL(/\/case\/\d+\/try\/1\?showWizard=true$/);
  await expect(page.getByRole('dialog', { name: 'Create a Quepid case' })).toBeVisible();
});

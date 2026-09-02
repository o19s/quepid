import { test, expect } from '@playwright/test';

// Regression coverage for scorer and search-endpoint management (Rails CRUD
// surfaces under ScorersController / SearchEndpointsController). Previously
// untested by the Playwright suite.

test.describe('scorers management', () => {
  test('index lists existing scorers and a new one appears after creation', async ({ page }) => {
    await page.goto('scorers');
    await expect(page.getByRole('heading', { name: 'Scorer Options' })).toBeVisible();

    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });
    expect(await rows.count()).toBeGreaterThan(0);

    const scorerName = `Playwright Scorer ${Date.now()}`;

    await page.getByRole('link', { name: '+ Add New' }).click();
    await expect(page).toHaveURL(/\/scorers\/new/);

    await page.locator('#scorer_name').fill(scorerName);
    await page.getByRole('button', { name: 'Save' }).click();

    // ScorersController#create redirects to edit_scorer_path with a notice.
    await expect(page).toHaveURL(/\/scorers\/\d+\/edit/);
    await expect(page.locator('#flash')).toContainText('Scorer created.');

    // Pagination/ordering could push the new scorer off page 1 — filter by
    // name via the index's `q` search param to find it deterministically.
    await page.goto(`scorers?q=${encodeURIComponent(scorerName)}`);
    await expect(page.locator('table tbody tr', { hasText: scorerName })).toBeVisible();
  });
});

test.describe('search endpoints management', () => {
  test('index lists existing endpoints, creates one, then archiving hides it from the default listing', async ({ page }) => {
    await page.goto('search_endpoints');
    await expect(page.getByRole('heading', { name: 'Search Endpoints' })).toBeVisible();

    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });
    expect(await rows.count()).toBeGreaterThan(0);

    const endpointName = `Playwright Endpoint ${Date.now()}`;

    await page.getByRole('link', { name: 'New Search Endpoint' }).click();
    await expect(page).toHaveURL(/\/search_endpoints\/new/);

    await page.locator('#search_endpoint_name').fill(endpointName);
    await page.locator('#search_endpoint_search_engine').selectOption('solr');
    await page.locator('#search_endpoint_endpoint_url').fill('http://localhost:8983/solr/collection1/select');
    await page.locator('#search_endpoint_api_method').selectOption('GET');
    await page.locator('.actions input[type="submit"]').click();

    // SearchEndpointsController#create responds with the new resource's show page.
    await expect(page).toHaveURL(/\/search_endpoints\/\d+$/);
    await expect(page.getByRole('heading', { name: new RegExp(endpointName) })).toBeVisible();

    const endpointUrl = page.url();
    const endpointId = endpointUrl.match(/\/search_endpoints\/(\d+)$/)?.[1];
    expect(endpointId).toBeTruthy();

    // Confirm it shows in the default (non-archived) listing before archiving.
    await page.goto(`search_endpoints?q=${encodeURIComponent(endpointName)}`);
    await expect(page.locator('table tbody tr', { hasText: endpointName })).toBeVisible();

    await page.goto(`search_endpoints/${endpointId}/edit`);
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Archive' }).click();

    await expect(page).toHaveURL(/\/search_endpoints$/);
    await expect(page.locator('#flash')).toContainText('Search Endpoint was archived.');

    // Default listing (archived unchecked) must no longer include it.
    await page.goto(`search_endpoints?q=${encodeURIComponent(endpointName)}`);
    await expect(page.locator('table tbody tr', { hasText: endpointName })).toHaveCount(0);

    // But it is still findable when explicitly including archived endpoints.
    await page.goto(`search_endpoints?q=${encodeURIComponent(endpointName)}&archived=true`);
    await expect(page.locator('table tbody tr', { hasText: endpointName })).toBeVisible();
  });
});

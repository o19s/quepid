import { test, expect } from '@playwright/test';
import { apiHeaders, CASE_ID, deleteCaseViaApi } from './case_helpers';
import { playwrightBaseURL } from './env';

test.describe('Rails-provided workspace bootstrap', () => {
  let caseId: number;
  let latestTry: number;
  let searchUrl: URL;
  let proxyEndpointId: number | undefined;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    try {
      await page.goto('cases');
      const headers = await apiHeaders(page);
      const sourceResponse = await page.request.get(`api/cases/${CASE_ID}`);
      expect(sourceResponse.ok()).toBeTruthy();
      const source = await sourceResponse.json();
      const response = await page.request.post('api/clone/cases', {
        headers,
        data: {
          case_id: CASE_ID,
          case_name: `Playwright Bootstrap ${Date.now()}`,
          try_number: source.last_try_number,
          preserve_history: false,
          clone_queries: true,
          clone_ratings: true
        }
      });
      expect(response.ok()).toBeTruthy();
      caseId = Number((await response.json()).case_id);
      const duplicate = await page.request.post(`api/clone/cases/${caseId}/tries/1`, { headers });
      expect(duplicate.ok()).toBeTruthy();
      const clonedTry = await duplicate.json();
      latestTry = Number(clonedTry.try_number);
      searchUrl = new URL(clonedTry.search_url, playwrightBaseURL());
      proxyEndpointId = clonedTry.proxy_requests ? Number(clonedTry.search_endpoint_id) : undefined;
    } finally {
      await page.close();
    }
  });

  test.afterAll(async ({ browser }) => {
    if (!caseId) return;
    const page = await browser.newPage();
    try {
      await page.goto('cases');
      await deleteCaseViaApi(page, caseId);
    } finally {
      await page.close();
    }
  });

  test('direct links and reload use page data and preserve every history try', async ({ page }) => {
    const redundantRequests: string[] = [];
    await page.route(/\/api\/(users\/current|cases\/\d+)$/, async route => {
      redundantRequests.push(route.request().url());
      await route.abort();
    });

    for (const tryNo of [latestTry, 1]) {
      const response = await page.goto(`case/${caseId}/try/${tryNo}`);
      expect(response?.headers()['cache-control']).toContain('no-store');
      await expect(page.locator('#case-actions')).toBeVisible();
      await expect(page.locator('.results-list-element li').first()).toBeVisible();
      await expect(page.locator('#case-header')).toContainText(`Try ${tryNo}`);
      const data = JSON.parse(await page.locator('body').getAttribute('data-core-bootstrap-initial-value') ?? '{}');
      expect(data.case.case_id).toBe(caseId);
      expect(data.case.tries.map((item: { try_number: number }) => item.try_number).sort()).toEqual([1, latestTry].sort());
      expect(data.case.scores).toBeUndefined();
      expect(data.case.last_score).toBeUndefined();
      expect(data.case.tries.every((item: { search_endpoint?: unknown }) => item.search_endpoint === undefined)).toBeTruthy();
      await page.reload();
      await expect(page.locator('#case-actions')).toBeVisible();
      await expect(page.locator('#case-header')).toContainText(`Try ${tryNo}`);
    }
    await page.getByRole('link', { name: 'Tune Relevance', exact: true }).click();
    await page.getByRole('button', { name: 'History', exact: true }).click();
    await expect(page.locator('.history-list .try-history-item')).toHaveCount(2);
    await page.locator(`.history-list [data-try-no="${latestTry}"]`).click();
    await page.waitForURL(new RegExp(`/case/${caseId}/try/${latestTry}`));
    await expect(page.locator('#case-actions')).toBeVisible();
    expect(redundantRequests).toEqual([]);
  });

  test('invalid tries fail visibly; a valid visit recovers and missing cases return 404', async ({ page }) => {
    await page.goto(`case/${caseId}/try/999999`);
    await expect(page.getByText(`Could not load case ${caseId} due to try number 999999 not existing`)).toBeVisible();
    await expect(page.locator('#case-actions')).toBeHidden();
    await page.goto(`case/${caseId}`);
    await expect(page.locator('#case-actions')).toBeVisible();
    await expect(page.locator('#case-header')).toContainText(`Try ${latestTry}`);
    const missing = await page.goto('case/999999999');
    expect(missing?.status()).toBe(404);
    expect(await page.locator('body').getAttribute('data-core-bootstrap-initial-value')).toBeNull();
  });

  test('customer-engine errors preserve the booted workspace and reload recovers', async ({ page }) => {
    const proxyUrl = new URL('proxy/fetch', playwrightBaseURL());
    await page.route(url => {
      if (proxyEndpointId !== undefined) {
        return url.origin === proxyUrl.origin && url.pathname === proxyUrl.pathname &&
          url.searchParams.get('search_endpoint_id') === String(proxyEndpointId);
      }
      const endpointPath = searchUrl.pathname.replace(/\/$/, '');
      return url.origin === searchUrl.origin &&
        (url.pathname === searchUrl.pathname || url.pathname.startsWith(`${endpointPath}/`));
    }, route => route.abort());
    await page.goto(`case/${caseId}/try/${latestTry}`);
    await expect(page.locator('#case-actions')).toBeVisible();
    await expect(page.getByText('Some queries failed to resolve!', { exact: true })).toBeVisible();
    await page.unrouteAll();
    await page.reload();
    await expect(page.getByText('All queries finished successfully!', { exact: true })).toBeVisible();
  });
});

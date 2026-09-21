import { test, expect, type Page } from '@playwright/test';

/**
 * E2E coverage for the core-case-shell migration: `ngRoute` was removed,
 * `MainCtrl` now bootstraps from `configurationSvc` (seeded server-side)
 * instead of `$routeParams`, and `caseTryNavSvc.navigateTo()`/`notFound()`
 * do a real `$window.location.assign()` instead of an in-SPA `$location`
 * route change. See docs/todo/angularjs_removal_inventory.md's shell
 * migration parity table.
 *
 * Uses disposable cases created via the API (same pattern as
 * delete_and_clone_case_options.spec.ts) so it never touches shared
 * fixture data.
 */

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
  await page.request.delete(`api/cases/${caseId}`, { headers: await apiHeaders(page) });
}

async function gotoCase(page: Page, caseId: number) {
  await page.goto(`case/${caseId}/try/1`);
  await page.waitForSelector('#case-actions', { timeout: 20_000 });
}

test.describe('core case shell: boot without ngRoute', () => {
  test('loading a case page boots the workbench with no console errors', async ({ page }) => {
    const caseId = await createDisposableCase(page, 'Shell-Boot');
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    try {
      await gotoCase(page, caseId);

      await expect(page.locator('#case-actions')).toBeVisible();
      await expect(page.locator('h1')).toContainText('Current case');
      expect(consoleErrors).toEqual([]);
    } finally {
      await deleteCaseViaApi(page, caseId);
    }
  });

  test('switching case via the header dropdown does a real page navigation', async ({ page }) => {
    const caseAId = await createDisposableCase(page, 'Shell-Nav-A');
    const caseBId = await createDisposableCase(page, 'Shell-Nav-B');

    try {
      // Visit B first so it appears in the header's "recent cases" dropdown,
      // then land on A as the starting point for the switch.
      await gotoCase(page, caseBId);
      await gotoCase(page, caseAId);

      await page.getByRole('button', { name: /Relevancy Cases/ }).click();
      const recentCases = page.locator('.dropdown-menu', { hasText: 'RECENT CASES' }).first();
      await expect(recentCases).toBeVisible();

      // caseTryNavSvc.navigateTo() now calls $window.location.assign() --
      // wait for an actual new-document load, not just a URL/DOM change,
      // to prove this isn't an in-SPA route swap.
      const loadEvent = page.waitForEvent('load', { timeout: 15_000 });
      await recentCases.getByRole('link').filter({ hasText: /Shell-Nav-B/ }).click();
      await loadEvent;

      await page.waitForURL(new RegExp(`/case/${caseBId}/`), { timeout: 15_000 });
      await expect(page.locator('#case-actions')).toBeVisible();
    } finally {
      await deleteCaseViaApi(page, caseAId);
      await deleteCaseViaApi(page, caseBId);
    }
  });
});

test.describe('core case shell: 404 handling without the Angular 404 route', () => {
  test('bare /case loads a workbench instead of the old dead-code "Not Found" page', async ({ page }) => {
    // Bare /case falls back to the user's own most-recent case server-side
    // (CoreController#index) -- assert it boots a real workbench rather
    // than asserting which specific case, since "most recent" depends on
    // shared account state this test doesn't own.
    const caseId = await createDisposableCase(page, 'Shell-Bare-Case');

    try {
      await gotoCase(page, caseId); // register as most-recently-viewed
      await page.goto('case');

      await expect(page.locator('#case-actions')).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText('Not found', { exact: false })).toHaveCount(0);
    } finally {
      await deleteCaseViaApi(page, caseId);
    }
  });

  test('an unrouted path still 404s via Rails, not an Angular route', async ({ page }) => {
    const response = await page.goto('case/1/try/1/some/unrouted/garbage');
    expect(response?.status()).toBe(404);
  });
});

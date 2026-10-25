import { test, expect, type Page } from '@playwright/test';
import { createDisposableCase, deleteCaseViaApi, waitForSearchSettled } from './case_helpers';

/**
 * E2E coverage for the core-case-shell migration: `ngRoute` was removed,
 * `core-bootstrap` now bootstraps from server-rendered case/try values through
 * client runtimes, and recent-case links do a full document navigation
 * instead of an in-SPA route change. See the core UI implementation reference
 * for the shell migration parity table.
 *
 * Uses disposable cases created via the API (same pattern as
 * delete_and_clone_case_options.spec.ts) so it never touches shared
 * fixture data.
 */

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
      await expect(page.getByRole('heading', { name: /Current case/ })).toBeVisible();
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

      // Wait for an actual new-document load, not just a URL/DOM change,
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

test.describe('core case shell: 404 handling without a client-side 404 route', () => {
  test('bare /case loads the most recent case instead of the old dead-code "Not Found" page', async ({ page }) => {
    // Bare /case falls back server-side (CoreController#set_case_or_bootstrap) to the
    // newest non-archived case the user is involved with, which is the one just created.
    const caseId = await createDisposableCase(page, 'Shell-Bare-Case');
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    try {
      await page.goto('case');

      await expect(page.locator('#case-actions')).toBeVisible({ timeout: 20_000 });
      // The fallback renders in place (the URL stays /case), so identify the case from the page.
      await expect(page).toHaveURL(/\/case$/);
      await expect(page.locator(`[data-qscore-case-case-id-value="${caseId}"]`)).toHaveCount(1);
      await expect(page.getByText('Not found', { exact: false })).toHaveCount(0);
      await waitForSearchSettled(page);
      expect(consoleErrors).toEqual([]);
    } finally {
      await deleteCaseViaApi(page, caseId);
    }
  });

  test('a missing case id is a 404 that explains sharing, offers ways on, and boots no workspace', async ({ page }) => {
    const response = await page.goto('case/987654321/try/1');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: "Case 987654321 isn't available" })).toBeVisible();
    await expect(page.getByText("hasn't been shared with a team you belong to")).toBeVisible();
    for (const name of ['View all cases', 'View your teams', 'Create a case']) {
      await expect(page.getByRole('main').getByRole('link', { name, exact: true })).toBeVisible();
    }
    await expect(page.locator('#case-actions')).toHaveCount(0);
  });

  test('an unrouted path still 404s via Rails, not a client-side route', async ({ page }) => {
    const response = await page.goto('case/1/try/1/some/unrouted/garbage');
    expect(response?.status()).toBe(404);
  });
});

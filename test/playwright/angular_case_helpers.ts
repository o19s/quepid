import { Page } from '@playwright/test';

/**
 * Shared navigation and screenshot helpers for the Angular case UI (`core` layout).
 * Used by core_smoke, angular_pages, angular_pages_narrow_viewport, modal_a11y, and popover_visibility.
 */
function readCaseId(): number {
  const raw = process.env.QUEPID_E2E_CASE_ID;
  if (raw === undefined || raw === '') return 1;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`QUEPID_E2E_CASE_ID must be a positive integer; got ${JSON.stringify(raw)}`);
  }
  return n;
}

export const CASE_ID = readCaseId();

export async function gotoCase(page: Page, query: string = ''): Promise<void> {
  const suffix = query ? `?${query}` : '';
  await page.goto(`/case/${CASE_ID}${suffix}`);
  await page.waitForSelector('li.ui-sortable-handle, .modal.show', { timeout: 20_000 });
}

/** Expand the first query row unless results are already visible. */
export async function expandFirstQuery(page: Page): Promise<void> {
  if (await page.locator('search-result').count() > 0) return;
  const toggle = page.locator('li.ui-sortable-handle .toggleSign[ng-click="query.toggle()"]').first();
  await toggle.click();
  await page.waitForSelector('search-result', { timeout: 15_000 });
}

/** Mask async flash copy so screenshots stay stable across runs. */
export function dynamicRegions(page: Page) {
  return [page.locator('#flash-messages')];
}

export function expandedCaseScreenshotOpts(page: Page) {
  // Align with migration-tour specs: mask flash + allow small font/layout drift.
  // Playwright config defaults expect.toHaveScreenshot.maxDiffPixelRatio to 0.01;
  // bare `{ mask: dynamicRegions(page) }` alone keeps 0.01 and is often too strict.
  return {
    mask: dynamicRegions(page),
    maxDiffPixelRatio: 0.025,
  };
}

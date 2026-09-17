import { Page } from '@playwright/test';

/**
 * Shared navigation and screenshot helpers for the Angular case UI (`core` layout).
 * Used by core_smoke, angular_pages, angular_pages_narrow_viewport, modal_a11y, and popover_visibility.
 */
// The one case in the shared dev DB known to have a working search endpoint, existing queries,
// and a last score ("10s of Queries") — the single source of truth for every spec that needs
// "a case with real data" (this file's CASE_ID, plus SNAPSHOT_CASE_ID in
// snapshots_and_annotations.spec.ts and QUERIES_CASE_ID in dom_migration_screenshots.spec.ts,
// which both import this instead of hardcoding their own copy of the same number). Case IDs here
// are just whatever the shared dev DB currently has at that row, not a fixed fixture — id 1 has
// drifted between "10s of Queries" and "SOLR CASE" (near-empty) over this DB's history, which
// desyncs old committed baselines from freshly regenerated ones even though nothing UI-relevant
// changed. If the shared dev DB's case 5 ever stops being "10s of Queries", update this one
// constant rather than hunting down every hardcoded copy. See DEVELOPER_GUIDE.md's Playwright E2E
// section.
export const DEFAULT_RICH_CASE_ID = 5;

function readCaseId(): number {
  const raw = process.env.QUEPID_E2E_CASE_ID;
  if (raw === undefined || raw === '') return DEFAULT_RICH_CASE_ID;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`QUEPID_E2E_CASE_ID must be a positive integer; got ${JSON.stringify(raw)}`);
  }
  return n;
}

export const CASE_ID = readCaseId();

export async function gotoCase(page: Page, query: string = ''): Promise<void> {
  const suffix = query ? `?${query}` : '';
  await page.goto(`case/${CASE_ID}${suffix}`);
  await page.waitForSelector('.results-list-element li, .modal.show', { timeout: 20_000 });
}

/** Expand the first query row unless results are already visible. */
export async function expandFirstQuery(page: Page): Promise<void> {
  if (await page.locator('search-result').count() > 0) return;
  const toggle = page.locator('.results-list-element li .toggleSign[ng-click="query.toggle()"]').first();
  await toggle.click();
  await page.waitForSelector('search-result', { timeout: 15_000 });
}

/** Mask async flash copy so screenshots stay stable across runs. */
export function dynamicRegions(page: Page) {
  return [page.locator('#flash-messages')];
}

/**
 * Header nav dropdown menu (e.g. "Relevancy Cases", "Books"), found by its
 * toggle button's own label text rather than list position. `#header li.dropdown`
 * has no id/data-* attribute distinguishing the case picker from the books
 * picker from the account menu, and previously these were addressed via
 * `.nth(0)` / `.nth(1)` — brittle, since a reordered or added dropdown would
 * silently point tests at the wrong menu. Filtering by the toggle text (unique
 * to each dropdown's `<li>`, including its menu contents) is stable instead.
 */
export function headerDropdownMenu(page: Page, toggleLabel: string) {
  return page.locator('#header li.dropdown').filter({ hasText: toggleLabel }).locator('.dropdown-menu');
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

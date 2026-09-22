import { expect, Page } from '@playwright/test';

/**
 * Shared navigation and screenshot helpers for the Angular case UI (`core` layout).
 * Used by core_smoke, angular_pages, angular_pages_narrow_viewport, modal_a11y, and popover_visibility.
 */
// The one case in the shared dev DB known to have a working search endpoint, existing queries,
// and a last score — the single source of truth for every spec that needs "a case with real
// data" (this file's CASE_ID, plus SNAPSHOT_CASE_ID in snapshots_and_annotations.spec.ts and
// QUERIES_CASE_ID in dom_migration_screenshots.spec.ts, which both import this instead of
// hardcoding their own copy of the same number).
//
// "E2E Static Fixture (10s of Queries)" (case 219) is a clone of case 6 ("10s of Queries") —
// same 20 queries and ratings, but its try's search endpoint is Quepid's own `static` engine,
// pointing at a snapshot of case 6's results (`/api/cases/219/snapshots/35/search`) instead of
// the real external `quepid-solr.dev.o19s.com` host case 6 (and case 1, case 5 before it) used.
// That external dependency was the root cause of most Playwright screenshot flakiness in this
// suite: JSONP round-trips to a shared, uncontrolled third-party-ish host, contended further
// whenever several specs (or several manual full-suite runs) hit it back-to-back, occasionally
// pushed total page-settle time past even generous waits, and its live results genuinely
// varied run to run (see dynamicRegions()'s scorable-content masks below, still needed for
// masking even on a static case, just no longer for genuine live-search variance). Static
// search has zero network dependency and always returns the same 20 queries' same captured
// top-10 docs — deterministic by construction, not by discipline.
//
// Case IDs here are just whatever the shared dev DB currently has at that row, not a fixed
// fixture in the Rails-test-suite sense — if this case or its snapshot/search-endpoint ever
// gets deleted, recreate it the same way (clone a real case → take a snapshot with "Record
// Document Fields?" checked → create a `static` SearchEndpoint pointing at
// `/api/cases/:id/snapshots/:snapshot_id/search` → point the clone's try at it) rather than
// reverting to a live external engine. See DEVELOPER_GUIDE.md's Playwright E2E section.
export const DEFAULT_RICH_CASE_ID = 219;

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

export async function gotoCase(page: Page, query: string = '', caseId: number = CASE_ID): Promise<void> {
  const suffix = query ? `?${query}` : '';
  await page.goto(`case/${caseId}${suffix}`);
  await page.waitForSelector('.results-list-element li, .modal.show', { timeout: 20_000 });
  // `.search-feedback` matches *two* elements (a "Bootstrapping Queries" div
  // and a separate "Updating Queries: X / Y" div, both `ng-show`) -- while
  // either is visible it occupies real layout space, so whether one happened
  // to still be up shifts everything below it, which no amount of
  // pixel-masking can fix (it's a layout difference, not a content one).
  // `page.waitForSelector(selector, {state: 'hidden'})` only tracks the
  // *first* matched element, so it resolved as soon as the (fast)
  // bootstrapping div hid even while the searching div was still up --
  // asserting the visible-locator count reaches 0 covers both. A live-Solr
  // case (e.g. case 6, still used deliberately by core_smoke.spec.ts's
  // explain-modal test) needs real headroom for 20 queries against a real
  // external host; the default static fixture settles almost immediately,
  // but the wait is harmless there too.
  await expect(page.locator('.search-feedback:visible')).toHaveCount(0, { timeout: 40_000 }).catch(() => {});
}

/** Expand the first query row unless results are already visible. */
export async function expandFirstQuery(page: Page): Promise<void> {
  if (await page.locator('search-result').count() > 0) return;
  const toggle = page.locator('.results-list-element li .toggleSign[data-action="click->query-row#toggle"]').first();
  await toggle.click();
  await page.waitForSelector('search-result', { timeout: 15_000 });
}

/**
 * Mask content that legitimately varies run to run so screenshots stay
 * stable. Beyond async flash copy, this includes anything derived from a
 * live search against a real external engine (case 6's try, for one, points
 * at `quepid-solr.dev.o19s.com` directly) -- score badges, per-query result
 * counts, and the unrated-count bubble all reflect that live search's
 * current result set, which is not deterministic between runs (network
 * conditions, index changes, even browser-CORS-driven partial failures).
 * None of the specs using this helper are actually testing those values;
 * they're testing a modal, a toolbar, or an accordion that happens to render
 * on top of/next to a real case's query list.
 */
export function dynamicRegions(page: Page) {
  return [
    page.locator('#flash-messages'),
    page.locator('.case-score, .results-score, .total-results, .notification-bubble, .scorable-score')
  ];
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

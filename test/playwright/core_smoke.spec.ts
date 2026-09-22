import { test, expect } from '@playwright/test';
import {
  CASE_ID,
  dynamicRegions,
  expandFirstQuery,
  expandedCaseScreenshotOpts,
  gotoCase,
} from './angular_case_helpers';

// Golden-path smoke suite for the Angular case UI (core.html.erb).
// Each test ends in a baseline screenshot so the BS3 -> BS5 migration's
// per-template PRs have a regression net for "invisible-but-present"
// failures (CLAUDE.md trap #5: popover element exists, aria-describedby set,
// but display/opacity/transform are wrong — Capybara assert_selector won't
// catch this, a pixel diff will).

test.describe('core layout golden paths', () => {
  test('open case', async ({ page }) => {
    await gotoCase(page);
    await expandFirstQuery(page);
    await expect(page).toHaveScreenshot('open-case.png', expandedCaseScreenshotOpts(page));
  });

  test('explain modal — switch tabs', async ({ page }) => {
    // Deliberately pinned to live-Solr case 6, not the suite's default static
    // fixture (case 219): the "Parsing" tab renders Solr's debug/explain
    // payload, which a static/snapshot search endpoint never captures or
    // replays (see angular_case_helpers.ts's DEFAULT_RICH_CASE_ID comment).
    // Static search would leave this tab permanently empty, silently losing
    // its value as a regression net for that pane's rendering. Accepting the
    // small residual live-network flake risk for this one test only.
    await gotoCase(page, '', 6);
    await expandFirstQuery(page);

    await page.getByRole('button', { name: 'Explain Query', exact: true }).first().click();

    // Modal tab IDs from app/assets/javascripts/components/query_explain/_modal.html
    await expect(page.locator('#query-explain-tab-params')).toBeVisible();
    await page.locator('#query-explain-tab-parsing').click();
    await expect(page.locator('#query-explain-pane-parsing')).toBeVisible();

    await expect(page).toHaveScreenshot('explain-modal-parsing-tab.png', expandedCaseScreenshotOpts(page));
  });

  test('open wizard', async ({ page }) => {
    // wizardCtrl.js triggers the modal when ?showWizard=true is in the URL.
    await gotoCase(page, 'showWizard=true');
    const modal = page.locator('.modal.show').first();
    await expect(modal).toBeVisible();
    await expect(modal).toContainText(/Name Your Case|Wizard/i);
    await expect(page).toHaveScreenshot('wizard-open.png', expandedCaseScreenshotOpts(page));
  });

  test('query results render', async ({ page }) => {
    // Asserts that a query under this case loads its top-N results when
    // expanded. expandFirstQuery() waits for `search-result` elements to
    // exist — if the query failed to execute, that wait would time out.
    await gotoCase(page);
    await expandFirstQuery(page);
    const results = page.locator('search-result');
    await expect(results).not.toHaveCount(0);
    await expect(results.first()).toBeVisible();
    await expect(page).toHaveScreenshot('query-results.png', expandedCaseScreenshotOpts(page));
  });

  test('query row header renders through Stimulus', async ({ page }) => {
    await gotoCase(page);

    const row = page.locator('[data-controller="query-row"]').first();
    await expect(row).toBeVisible();
    await expect(row).toHaveAttribute('data-query-row-state-value', /\S/);
    await expect(row.locator('[data-query-row-target="text"]')).toContainText(/\S/);
    await expect(row.locator('[data-query-row-target="resultLabel"]')).toHaveText(/Result(s)?/);
    await expect(row.locator('[data-query-row-target="resultCount"]')).toHaveText(/\d+/);
    await expect(row.locator('[data-query-row-target="query"]'))
      .toHaveAttribute('data-bs-tooltip-title-value', /Info Need:/);
  });

  test('leave a judgement', async ({ page }) => {
    await gotoCase(page);
    await expandFirstQuery(page);

    // Per app/assets/templates/views/searchResult.html, each result has a
    // .single-rating popover trigger. Click the first one to open the
    // ratings popover (views/ratings/popover.html).
    await page.locator('search-result .single-rating').first().click();
    await expect(page.locator('.popover, [class*="popover"]').first()).toBeVisible({ timeout: 5_000 });

    await expect(page).toHaveScreenshot('judgement-popover.png', expandedCaseScreenshotOpts(page));
  });

  test.describe('rating a result', () => {
    // Restoring the shared static case's rating through the popover UI in a
    // try/finally isn't reliable: a real regression in this flow (score never
    // updates) fails via expect.poll, but a hung .click() can still run out
    // the whole test timeout, and Playwright doesn't guarantee a try/finally
    // inside the test body finishes unwinding once that happens. A
    // test.afterEach does run even then (same reasoning as
    // toolbar_modals_core.spec.ts's afterAll comment), so cleanup goes
    // through a direct API call instead of the UI, keyed off the query/doc
    // identity and rating captured from Angular scope before any mutation.
    let restoreState: { queryId: number; docId: string; rating: number | null } | undefined;

    test.afterEach(async ({ page }) => {
      if (!restoreState) return;
      const { queryId, docId, rating } = restoreState;
      restoreState = undefined;

      const csrf = await page.evaluate(() =>
        document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? ''
      );
      const headers = { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-Token': csrf };
      const url = `api/cases/${CASE_ID}/queries/${queryId}/ratings`;

      // Assert rather than ignore: a silent failure here (e.g. an empty CSRF
      // token nulling the session) would leave the shared case's rating
      // mutated for the next run instead of raising anything.
      const response = rating === null
        ? await page.request.delete(url, { data: { rating: { doc_id: docId } }, headers })
        : await page.request.put(url, { data: { rating: { doc_id: docId, rating } }, headers });
      expect(response.ok()).toBeTruthy();
    });

    test('rating updates the query score, case score, and rating badge', async ({ page }) => {
      await gotoCase(page);
      await expandFirstQuery(page);

      const queryScore = page.locator('.qscore-query-badge').first();
      const caseScore = page.locator('[data-controller="qscore-case"]').first();
      const resultRating = page.locator('search-result .single-rating').first();

      await expect(queryScore).not.toHaveText('?');
      await expect(caseScore).not.toHaveText('?');

      // Read query/doc identity and the actual rating value (not its
      // formatted display text) via Angular scope, before any mutation, so
      // afterEach can restore it precisely regardless of how this test ends.
      restoreState = await resultRating.evaluate((el) => {
        const scope = (window as any).angular.element(el).scope();
        return {
          queryId: scope.query.queryId as number,
          docId:   scope.doc.id as string,
          rating:  (scope.doc.hasRating() ? scope.doc.getRating() : null) as number | null,
        };
      });

      // Reset first so the following positive rating is a known mutation even
      // when the shared static case already has a rating on this document.
      await resultRating.click();
      await expect(page.locator('.popover').last()).toBeVisible();
      await page.locator('.popover').last().locator('.reset').click();
      await expect(page.locator('.popover')).toHaveCount(0);

      const scoreBeforeRating = await queryScore.textContent();
      const caseScoreBeforeRating = await caseScore.textContent();
      const badgeColorBeforeRating = await resultRating.locator('span.btn').evaluate((el) => getComputedStyle(el).backgroundColor);

      await resultRating.click();
      const ratingOption = page.locator('.popover').last().locator('.ratingNum').last();
      await expect(ratingOption).toBeVisible();
      await ratingOption.click();
      await expect(page.locator('.popover')).toHaveCount(0);

      await expect.poll(async () => (await queryScore.textContent())?.trim()).not.toBe(scoreBeforeRating?.trim());
      await expect.poll(async () => (await caseScore.textContent())?.trim()).not.toBe(caseScoreBeforeRating?.trim());
      await expect.poll(async () => await resultRating.locator('span.btn').evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(badgeColorBeforeRating);
    });
  });

  test('take a snapshot', async ({ page }) => {
    await gotoCase(page);
    // queriesLayout.html — Stimulus take-snapshot-core toolbar trigger
    await page.locator('a[data-controller="take-snapshot-core"]').click();
    await expect(page.locator('#takeSnapshotModal.show, .modal.show').first()).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveScreenshot('snapshot-modal.png', {
      mask: dynamicRegions(page),
      maxDiffPixelRatio: 0.065,
    });
  });
});

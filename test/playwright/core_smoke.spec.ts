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
    await expect(results.first().locator('.subTitle')).toContainText(/\S/);
    await expect(results.first().locator('.result-rank')).toHaveText(/Rank: #1/);
    await expect(results.first().locator('.single-rating')).toBeVisible();

    const expandedResults = page.locator('.sub-results:visible').first();
    await expect(expandedResults.locator('[data-search-results-target="footer"]')).toBeVisible();
    await expect(expandedResults.locator('[data-search-results-target="nextPage"]')).toHaveCount(1);
    await expect(expandedResults.locator('[data-angular-bridge]')).toHaveCount(0);
    await expect(page).toHaveScreenshot('query-results.png', expandedCaseScreenshotOpts(page));
  });

  test('detailed document modal uses the Stimulus results path', async ({ page }) => {
    await gotoCase(page);
    await expandFirstQuery(page);

    const result = page.locator('search-result').first();
    await result.locator('.subTitle a').click();

    const modal = page.locator('.modal.show').filter({ hasText: 'Detailed Document View of doc:' }).last();
    await expect(modal).toBeVisible();
    await expect(modal.locator('.detailed-doc-all-fields')).toBeHidden();

    await modal.getByRole('link', { name: 'View All Fields' }).click();
    await expect(modal.locator('.detailed-doc-all-fields')).toBeVisible();
    await expect(modal.getByRole('link', { name: 'Hide All Fields' })).toBeVisible();

    await modal.getByRole('button', { name: 'Close' }).click();
    await expect(modal).toBeHidden();
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
    await expect(row.locator('[data-query-row-target="toggle"]'))
      .toHaveClass(/bi-caret-down-fill/);

    await row.locator('h2.results-title').click();
    await expect(row.locator('[data-query-row-target="toggle"]'))
      .toHaveClass(/bi-caret-up-fill/);
  });

  test('query list controls bridge through Stimulus', async ({ page }) => {
    await gotoCase(page);

    const queryList = page.locator('#query-container');
    const rows = queryList.locator('ul.results-list-element > li');
    await expect(rows.first()).toBeVisible();

    await page.locator('#queries-filter').fill('this-query-does-not-exist');
    await expect(rows).toHaveCount(0);

    await page.locator('#queries-filter').fill('');
    await expect(rows.first()).toBeVisible();

    await queryList.locator('a[data-sort-field="query"]').click();
    await expect(queryList).toHaveAttribute('data-queries-list-sort-name-value', 'query');

    await expandFirstQuery(page);
    await queryList.getByRole('link', { name: 'Collapse all', exact: true }).click();
    await expect(queryList.locator('.sub-results:visible')).toHaveCount(0);
  });

  test('move query modal is Stimulus-owned and submits through the Angular state adapter', async ({ page }) => {
    let moveRequest: { url: string; body: string } | undefined;
    await page.route('**/api/cases/*/queries/*', async route => {
      if (route.request().method() !== 'PUT') {
        await route.continue();
        return;
      }

      moveRequest = {
        url: route.request().url(),
        body: route.request().postData() || ''
      };
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await gotoCase(page);
    await expandFirstQuery(page);

    const row = page.locator('.results-list-element li').first();
    await row.getByRole('button', { name: 'Move Query', exact: true }).click();

    const modal = page.locator('#moveQueryModal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Move Query to Another Case');

    const targetCase = modal.locator('.move-query-cases-list button').first();
    await expect(targetCase).toBeVisible();
    const targetName = await targetCase.textContent();
    await targetCase.click();
    await expect(modal.getByRole('button', { name: `Move to ${targetName}`, exact: true })).toBeEnabled();
    await modal.getByRole('button', { name: `Move to ${targetName}`, exact: true }).click();

    await expect(page.locator('#flash-messages')).toContainText('Query moved successfully!');
    expect(moveRequest?.url).toMatch(/\/api\/cases\/\d+\/queries\/\d+$/);
    expect(moveRequest?.body).toContain('other_case_id');
  });

  test('delete query persists through the Stimulus controller', async ({ page }) => {
    let deleteRequest: string | undefined;
    await page.route('**/api/cases/*/queries/*', async route => {
      if (route.request().method() !== 'DELETE') {
        await route.continue();
        return;
      }

      deleteRequest = route.request().url();
      await route.fulfill({ status: 204 });
    });

    await gotoCase(page, '', 6);
    await expandFirstQuery(page);

    const row = page.locator('.results-list-element li').first();
    const queryText = (await row.locator('[data-query-row-target="text"]').textContent())?.trim();
    expect(queryText).toBeTruthy();
    await page.once('dialog', dialog => {
      expect(dialog.message()).toBe('Are you absolutely sure you want to delete?');
      void dialog.accept();
    });
    await row.getByRole('button', { name: 'Delete Query', exact: true }).click();

    await expect.poll(() => deleteRequest).toMatch(/\/api\/cases\/\d+\/queries\/\d+$/);
    await expect(page.locator('[data-query-row-target="text"]', { hasText: queryText })).toHaveCount(0);
  });

  test('add query reports a persistence failure', async ({ page }) => {
    await page.route('**/api/cases/6/queries*', async route => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'forced add-query failure' })
      });
    });

    await gotoCase(page, '', 6);
    await page.locator('#add-query').fill('forced add-query failure');
    await page.locator('#add-query-submit').click();

    await expect(page.locator('#flash-messages')).toContainText('forced add-query failure');
    await expect(page.locator('#add-query')).toBeFocused();
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

      // Read query/doc identity and the snapshot rating before any mutation, so
      // afterEach can restore it precisely regardless of how this test ends.
      restoreState = await resultRating.evaluate((el) => {
        const result = el.closest('search-result') as HTMLElement;
        return {
          queryId: Number(result.dataset.queryId),
          docId: result.dataset.docId as string,
          rating: result.dataset.rating ? Number(result.dataset.rating) : null,
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

  test('browse query opens the Stimulus curl modal', async ({ page }) => {
    await gotoCase(page, '', 6);
    await expandFirstQuery(page);

    const browse = page.locator('a[data-controller="browse-query"]').first();
    await expect(browse).toBeVisible();
    await browse.click();

    const modal = page.locator('.modal.show').last();
    await expect(modal).toContainText('Browse Results on Solr');
    await expect(modal.locator('.browse-query-curl')).toContainText('curl ');
    await expect(modal.getByRole('button', { name: 'Copy curl command' })).toBeVisible();
    await expect(modal.getByRole('link', { name: 'Open URL directly' })).toBeVisible();
  });
});

import { test, expect, type Page } from '@playwright/test';
import {
  CASE_ID,
  cloneRichCase,
  deleteCaseViaApi,
  expandFirstQuery,
  gotoCase,
} from './case_helpers';

// Golden-path smoke suite for the core case UI (case branch of application.html.erb).
// Assertions are behavioural (toBeVisible checks real visibility, which catches
// CLAUDE.md trap #5's "present but invisible" popovers). Pixel baselines for these
// states live in visual_smoke.spec.ts (`yarn test:visual`).

test.describe('core layout golden paths', () => {
  const disposableCaseIds: number[] = [];
  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    try {
      await page.goto('cases');
      for (const id of disposableCaseIds) await deleteCaseViaApi(page, id);
    } finally {
      await page.close();
    }
  });

  test('open case', async ({ page }) => {
    await gotoCase(page);
    await expect(page.locator('.results-list-element li')).not.toHaveCount(0);
    await expect(page.locator('[data-queries-list-target="count"]')).not.toHaveText('0');
    await expandFirstQuery(page);
    await expect(page.locator('search-result').first()).toBeVisible();
  });

  test('explain modal — switch tabs', async ({ page }) => {
    // Deliberately pinned to live-Solr case 6, not the suite's default static
    // fixture (case 219): the "Parsing" tab renders Solr's debug payload, which
    // a static search endpoint never returns (see case_helpers.ts's
    // DEFAULT_RICH_CASE_ID comment).
    await gotoCase(page, '', 6);
    await expandFirstQuery(page);

    await page.getByRole('button', { name: 'Explain Query', exact: true }).first().click();

    // Tab and pane ids from the query-explain template in shared/_dynamic_modal_templates.html.erb.
    await expect(page.locator('#query-explain-tab-params')).toBeVisible();
    await page.locator('#query-explain-tab-parsing').click();
    const parsing = page.locator('#query-explain-pane-parsing');
    await expect(parsing).toBeVisible();
    await expect(parsing).toContainText('parsedquery');
  });

  test('open wizard', async ({ page }) => {
    // wizard-launcher Stimulus controller triggers the legacy modal when ?showWizard=true is in the URL.
    await gotoCase(page, 'showWizard=true');
    await expect(page.locator('[data-controller~="wizard-launcher"][data-wizard-launcher-auto-value="true"]')).toHaveCount(1);
    const modal = page.locator('.modal.show').first();
    await expect(modal).toBeVisible();
    await expect(modal).toContainText(/Name Your Case|Wizard/i);
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
  });

  test('frog report is Stimulus-owned', async ({ page }) => {
    await gotoCase(page);
    await page.getByRole('button', { name: 'Report', exact: true }).click();

    const modal = page.locator('.modal.show').last();
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('The Frog Pond Report: E2E Static Fixture');
    await expect(modal.locator('#chart1 svg')).toHaveCount(1);
    await expect(modal.locator('[data-controller="frog-report"]')).toHaveCount(1);
    await expect(page.locator('frog-report')).toHaveCount(0);

    await modal.locator('.btn-close').click();
    await expect(modal).toBeHidden();
  });

  test('missing documents finder is Stimulus-owned', async ({ page }) => {
    await gotoCase(page, '', 6);
    await expandFirstQuery(page);

    await page.getByRole('button', { name: 'Missing Documents', exact: true }).first().click();
    const modal = page.locator('.modal.show').last();
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Find and Rate Missing Documents');
    await expect(modal.locator('[data-controller="missing-documents"]')).toHaveCount(1);
    await expect(modal.locator('textarea')).toBeVisible();
  });

  test('query options saves through the Stimulus modal', async ({ page }) => {
    const caseId = await cloneRichCase(page, 'Query Options');
    disposableCaseIds.push(caseId);
    await gotoCase(page, '', caseId);
    await expandFirstQuery(page);
    await page.getByRole('button', { name: 'Set Options', exact: true }).first().click();

    const modal = page.locator('#queryOptionsModal');
    await expect(modal).toBeVisible();
    await modal.locator('.cm-content').fill('not json');
    await modal.getByRole('button', { name: 'Set Options', exact: true }).click();
    await expect(modal).toBeVisible();
    await expect(page.locator('.flash:visible')).toContainText('Please provide a valid JSON object.');

    await modal.locator('.cm-content').fill('{"boost": 2}');
    await modal.getByRole('button', { name: 'Set Options', exact: true }).click();
    await expect(modal).toBeHidden();
    await expect(page.locator('.flash:visible')).toContainText('Query options saved successfully.');

    await gotoCase(page, '', caseId);
    await expandFirstQuery(page);
    await page.getByRole('button', { name: 'Set Options', exact: true }).first().click();
    await expect(modal.locator('.cm-content')).toContainText('"boost"');
    await expect(modal.locator('.cm-content')).toContainText('2');
  });

  test('detailed document modal uses the Stimulus results path', async ({ page }) => {
    await gotoCase(page);
    await expandFirstQuery(page);

    const result = page.locator('search-result').first();
    await result.locator('.subTitle button').click();

    const modal = page.locator('.modal.show').filter({ hasText: 'Detailed Document View of doc:' }).last();
    await expect(modal).toBeVisible();
    await expect(modal.locator('.detailed-doc-all-fields')).toBeHidden();

    await modal.getByRole('tab', { name: 'All Fields (JSON)' }).click();
    await expect(modal.locator('.detailed-doc-all-fields')).toBeVisible();
    await expect(modal.getByRole('tab', { name: 'All Fields (JSON)' })).toHaveAttribute('aria-selected', 'true');
    await expect(modal.locator('#detailed-document-pane-formatted')).toBeHidden();

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

    await queryList.locator('button[data-queries-list-target="sortLink"][data-sort-field="query"]').click();
    await expect(queryList).toHaveAttribute('data-queries-list-sort-name-value', 'query');

    await expandFirstQuery(page);
    await queryList.getByRole('button', { name: 'Collapse all', exact: true }).click();
    await expect(queryList.locator('.sub-results:visible')).toHaveCount(0);
  });

  test('query capabilities survive reload and options saves update the live owner once', async ({ page }) => {
    let saves = 0;
    await page.route('**/api/**/queries/*/options', async route => {
      if (route.request().method() !== 'PUT') return route.continue();
      saves += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await gotoCase(page);
    await page.reload();
    await expandFirstQuery(page);
    await page.getByRole('button', { name: 'Set Options', exact: true }).first().click();
    const modal = page.locator('.modal.show');
    await modal.locator('.cm-content').fill('{"workspace_probe": 17}');
    await modal.getByRole('button', { name: 'Set Options', exact: true }).click();
    await expect(modal).toHaveCount(0);
    await expect(page.getByText('Query options saved successfully.', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Set Options', exact: true }).first().click();
    await expect(modal.locator('.cm-content')).toContainText('workspace_probe');
    expect(saves).toBe(1);
    await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.reload();
    await expandFirstQuery(page);
    await page.getByRole('button', { name: 'Set Options', exact: true }).first().click();
    await expect(modal.locator('.cm-content')).not.toContainText('workspace_probe');
  });

  test('move query modal is Stimulus-owned and submits through the query API seam', async ({ page }) => {
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
    const caseId = await cloneRichCase(page, 'Delete Query');
    disposableCaseIds.push(caseId);
    await gotoCase(page, '', caseId);

    const row = page.locator('.results-list-element li').first();
    const queryText = (await row.locator('[data-query-row-target="text"]').textContent())?.trim();
    expect(queryText).toBeTruthy();
    const queryCount = page.locator('[data-queries-list-target="count"]');
    const countBefore = (await queryCount.textContent())?.trim();
    await expandFirstQuery(page);
    const deleteButton = row.getByRole('button', { name: 'Delete Query', exact: true });
    const confirmation = page.locator('#confirmModal');
    await deleteButton.click();
    await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(confirmation).toBeHidden();
    await expect(deleteButton).toBeFocused();
    await expect(queryCount).toHaveText(countBefore!);

    await deleteButton.click();
    await expect(confirmation).toHaveAccessibleName('Confirm');
    await expect(confirmation).toHaveAccessibleDescription('Are you absolutely sure you want to delete?');
    await confirmation.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(confirmation).toBeHidden();
    await expect(page.locator('[data-query-row-target="text"]', { hasText: queryText })).toHaveCount(0);
    await expect(queryCount).not.toHaveText(countBefore!);

    await gotoCase(page, '', caseId);
    await expect(page.locator('[data-query-row-target="text"]').first()).toBeVisible();
    await expect(page.locator('[data-query-row-target="text"]', { hasText: queryText })).toHaveCount(0);
    await expect(queryCount).not.toHaveText(countBefore!);
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

    // Each Stimulus-rendered search-result has a
    // .single-rating popover trigger. Click the first one to open the
    // ratings popover (views/ratings/popover.html).
    await page.locator('search-result .single-rating').first().click();
    await expect(page.locator('.popover, [class*="popover"]').first()).toBeVisible({ timeout: 5_000 });
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
    // identity and rating captured from the live case state before any mutation.
    let restoreState: { queryId: number; docId: string; rating: number | null } | undefined;

    // Resolves once nothing inside the expanded result lists has changed for
    // quietMs, including when nothing changes at all.
    async function waitForResultsToSettle(page: Page, quietMs = 500): Promise<void> {
      await page.evaluate((quiet) => new Promise<void>((resolve) => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const restart = () => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            observer.disconnect();
            resolve();
          }, quiet);
        };
        const observer = new MutationObserver(restart);
        document.querySelectorAll('[data-search-results-target="results"]')
          .forEach((list) => observer.observe(list, { childList: true, subtree: true }));
        restart();
      }), quietMs);
    }

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
      const visiblePopover = () => page.locator('.popover:visible').last();
      await expect(visiblePopover()).toBeVisible();
      // One rating publishes several store changes (the rating itself, then
      // async scoring and the case summary), and each one re-renders the
      // affected rows' rating controls. A popover opened on a control that is
      // about to be replaced disappears mid-click, so wait until the lists
      // stop changing.
      const resetSaved = page.waitForResponse((response) =>
        response.url().includes('/ratings') && response.request().method() === 'DELETE');
      await visiblePopover().locator('.reset').click();
      await expect(page.locator('.popover:visible')).toHaveCount(0);
      await resetSaved;
      await waitForResultsToSettle(page);

      const scoreBeforeRating = await queryScore.textContent();
      const caseScoreBeforeRating = await caseScore.textContent();
      const badgeColorBeforeRating = await resultRating.locator('button').evaluate((el) => getComputedStyle(el).backgroundColor);

      await resultRating.click();
      const ratingOption = visiblePopover().locator('.ratingNum').last();
      await expect(ratingOption).toBeVisible();
      await ratingOption.click();
      await expect(page.locator('.popover:visible')).toHaveCount(0);

      await expect.poll(async () => (await queryScore.textContent())?.trim()).not.toBe(scoreBeforeRating?.trim());
      await expect.poll(async () => (await caseScore.textContent())?.trim()).not.toBe(caseScoreBeforeRating?.trim());
      await expect.poll(async () => await resultRating.locator('button').evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(badgeColorBeforeRating);
    });
  });

  test('browse query opens the Stimulus curl modal', async ({ page }) => {
    await gotoCase(page, '', 6);
    await expandFirstQuery(page);

    const browse = page.locator('button[data-controller="browse-query"]').first();
    await expect(browse).toBeVisible();
    await browse.click();

    const modal = page.locator('.modal.show').last();
    await expect(modal).toContainText('Browse Results on Solr');
    await expect(modal.locator('.browse-query-curl')).toContainText('curl ');
    await expect(modal.getByRole('button', { name: 'Copy curl command' })).toBeVisible();
    await expect(modal.getByRole('link', { name: 'Open URL directly' })).toBeVisible();
  });
});

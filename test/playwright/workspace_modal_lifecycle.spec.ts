import { test, expect } from '@playwright/test';
import { gotoCase, expandFirstQuery } from './case_helpers';

// All forced state is confined to the current document or routed responses.
// These flows do not create persistent rows or change book settings.
test.describe('Workspace modal lifecycle', () => {
  test('detail view resets on reopen and cleans up Close, Escape and backdrop dismissal', async ({ page }) => {
    await gotoCase(page);
    await expandFirstQuery(page);
    for (const dismissal of ['close', 'escape', 'backdrop']) {
      await page.locator('search-result .subTitle a').first().click();
      const modal = page.locator('.modal.show');
      await expect(modal).toContainText('Detailed Document View of doc:');
      await expect(modal.locator('.detailed-doc-all-fields')).toBeHidden();
      await modal.getByRole('link', { name: 'View All Fields', exact: true }).click();
      await expect(modal.locator('.detailed-doc-all-fields')).toBeVisible();
      await modal.getByRole('link', { name: 'Hide All Fields', exact: true }).click();
      await expect(modal.locator('.detailed-doc-all-fields')).toBeHidden();
      if (dismissal === 'close') await modal.getByRole('button', { name: 'Close', exact: true }).click();
      if (dismissal === 'escape') await page.keyboard.press('Escape');
      if (dismissal === 'backdrop') await modal.click({ position: { x: 5, y: 5 } });
      await expect(page.locator('.modal.show, .modal-backdrop')).toHaveCount(0);
      await expect(page.locator('body')).not.toHaveClass(/modal-open/);
      await expect(page.locator('[data-controller="dynamic-modal"]')).toHaveCount(0);
    }
  });

  test('query template errors retry, superseded responses lose, and closed requests stay closed', async ({ page }) => {
    await gotoCase(page);
    await expandFirstQuery(page);
    await page.evaluate(() => {
      const app = (window as any).Stimulus;
      const list = app.getControllerForElementAndIdentifier(document.querySelector('#query-container'), 'queries-list');
      const explainData = list.explainData.bind(list);
      list.explainData = (id: number) => ({ ...explainData(id), supportsTemplate: true });
      const pending: any[] = [];
      (window as any).modalTemplateResponses = pending;
      list.renderQueryTemplate = () => new Promise(resolve => pending.push(resolve));
    });
    const open = () => page.getByRole('button', { name: 'Explain Query', exact: true }).first().click();
    const template = page.locator('.modal.show .query-explain-template');
    await open();
    await page.locator('#query-explain-tab-template').click();
    await expect(template).toContainText('Rendering query template');
    await page.evaluate(() => (window as any).modalTemplateResponses.shift()({ error: true }));
    await expect(template).toContainText('Unable to render the query template.');
    await page.locator('#query-explain-tab-params').click();
    await page.locator('#query-explain-tab-template').click();
    await page.locator('#query-explain-tab-parsing').click();
    await page.locator('#query-explain-tab-template').click();
    await page.evaluate(() => (window as any).modalTemplateResponses.pop()({ isTemplatedQuery: true, renderedQueryTemplate: 'latest' }));
    await expect(template).toContainText('latest');
    await page.evaluate(() => (window as any).modalTemplateResponses.shift()({ error: true }));
    await expect(template).toContainText('latest');
    await page.locator('#query-explain-tab-params').click();
    await page.locator('#query-explain-tab-template').click();
    await page.evaluate(() => { (window as any).closedTemplateTab = document.querySelector('#query-explain-tab-template'); });
    await page.locator('.modal.show .modal-footer [data-bs-dismiss="modal"]').click();
    await expect(page.locator('.modal.show, .modal-backdrop')).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).bootstrap.Tab.getInstance((window as any).closedTemplateTab))).toBeNull();
    await open();
    await page.evaluate(() => (window as any).modalTemplateResponses.shift()({ isTemplatedQuery: true, renderedQueryTemplate: 'obsolete' }));
    await page.locator('#query-explain-tab-template').click();
    await expect(template).toContainText('Rendering query template');
    await expect(template).not.toContainText('obsolete');
    // Full-document navigation while this last request remains pending.
    await page.goto('cases');
    await expect(page.locator('.modal.show, .modal-backdrop')).toHaveCount(0);
    await gotoCase(page);
    await expect(page.locator('.modal.show, .modal-backdrop')).toHaveCount(0);
  });

  test('Frog Report retries refresh errors and isolates late refresh/chart completion', async ({ page }) => {
    await gotoCase(page);
    await page.evaluate(() => {
      const app = (window as any).Stimulus;
      const bootstrap = app.getControllerForElementAndIdentifier(document.querySelector('[data-controller~="core-bootstrap"]'), 'core-bootstrap');
      Object.assign(bootstrap.capabilities.core.case.selected(), { bookId: 1, bookName: 'Lifecycle test book' });
    });
    let fail = true;
    await page.route('**/books/1/cases/*/refresh*', route => route.fulfill({
      status: fail ? 500 : 200, contentType: 'application/json', body: '{}'
    }));
    const open = () => page.getByRole('button', { name: 'Report', exact: true }).click();
    const refresh = page.getByRole('button', { name: /Refresh ratings from book/ });
    await open();
    await expect(page.locator('#chart1 svg')).toHaveCount(1);
    await refresh.click();
    await expect(page.locator('[data-frog-report-target="error"]')).toBeVisible();
    await expect(refresh).toBeEnabled();
    fail = false;
    await refresh.click();
    await expect(page.locator('.flash:visible')).toContainText('Ratings have been refreshed.');
    await expect(refresh).toBeEnabled();
    await page.evaluate(() => {
      const app = (window as any).Stimulus;
      const controller = app.getControllerForElementAndIdentifier(document.querySelector('.modal.show [data-controller="frog-report"]'), 'frog-report');
      const original = (window as any).vegaEmbed;
      const pending: any[] = [];
      (window as any).modalChartResponses = pending;
      (window as any).vegaEmbed = (...args: any[]) => new Promise(resolve => {
        pending.push(async () => {
          const result = await original(...args);
          const finalize = result.finalize.bind(result);
          result.finalize = () => { if (args[1].data[0].values.some((value: any) => value.category === 'obsolete')) (window as any).obsoleteChartFinalized = true; finalize(); };
          resolve(result);
        });
      });
      controller.renderChart([{ category: 'obsolete', amount: 99 }]);
    });
    await page.locator('.modal.show .modal-footer [data-bs-dismiss="modal"]').click();
    await expect(page.locator('.modal.show, .modal-backdrop')).toHaveCount(0);
    await open();
    await page.evaluate(async () => {
      const pending = (window as any).modalChartResponses;
      await pending.pop()();
      await pending.shift()();
    });
    await expect(page.locator('#chart1 svg')).toHaveCount(1);
    await expect(page.locator('#chart1')).not.toContainText('obsolete');
    await expect.poll(() => page.evaluate(() => (window as any).obsoleteChartFinalized)).toBe(true);
  });
  test('nested debug backdrop closes only the inner modal and retains the finder scroll lock', async ({ page }) => {
    test.setTimeout(60_000);
    // This flow needs the rated-document lookup and explain payload from Solr.
    await gotoCase(page, '', 6);
    await expandFirstQuery(page);
    await page.getByRole('button', { name: 'Missing Documents', exact: true }).first().click();
    const outer = page.locator('.modal.show').filter({ hasText: 'Find and Rate Missing Documents' });
    await expect(outer.locator('.match-explain-bar').first()).toBeVisible();
    for (let i = 0; i < 2; i++) {
      await page.evaluate(() => {
        (window as any).nestedModalShown = false;
        document.addEventListener('shown.bs.modal', function shown(event) {
          if (!(event.target as Element).classList.contains('doc-detailed-explain-modal')) return;
          (window as any).nestedModalShown = true;
          document.removeEventListener('shown.bs.modal', shown);
        });
      });
      await outer.locator('.match-explain-bar').first().click();
      const inner = page.locator('.doc-detailed-explain-modal.show');
      await expect(inner).toContainText('Debug Explain for');
      await expect(page.locator('.modal.show, .modal-backdrop')).toHaveCount(4);
      // Wait for the opening transition before dismissing via the backdrop.
      await expect.poll(() => page.evaluate(() => (window as any).nestedModalShown)).toBe(true);
      await inner.click({ position: { x: 5, y: 5 } });
      await expect(page.locator('.doc-detailed-explain-modal')).toHaveCount(0);
      await expect(outer).toBeVisible();
      await expect(page.locator('.modal-backdrop')).toHaveCount(1);
      await expect(page.locator('body')).toHaveClass(/modal-open/);
    }
    await outer.locator('.modal-footer [data-bs-dismiss="modal"]').click();
    await expect(page.locator('.modal.show, .modal-backdrop')).toHaveCount(0);
  });

});

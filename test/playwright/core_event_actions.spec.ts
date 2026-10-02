import { test, expect } from '@playwright/test';
import { expandFirstQuery, gotoCase } from './case_helpers';

const CASE_ID = Number(process.env.QUEPID_E2E_EDITABLE_CASE_ID || 2);

test('core event actions deliver once and follow controller reconnects', async ({ page }) => {
  await page.goto(`case/${CASE_ID}`);
  await expect(page.locator('[data-case-toolbar-target="actions"]')).toBeVisible();

  await page.evaluate(() => {
    const app = (window as any).Stimulus;
    // Removing a child controller identifier can make the query renderer replace its shell.
    // Freeze that renderer while testing action ownership on the same nodes.
    const queryList = document.querySelector('[data-controller~="queries-list"]')!;
    app.getControllerForElementAndIdentifier(queryList, 'queries-list').render = () => {};
    const probes = [
      { selector: '[data-controller="case-toolbar"]', id: 'case-toolbar', method: 'handleHeaderStale', event: 'quepid:case-header-stale' },
      { selector: '[data-controller="case-toolbar"]', id: 'case-toolbar', method: 'handleCaseRenamed', event: 'quepid:case-renamed' },
      { selector: '[data-controller="case-toolbar"]', id: 'case-toolbar', method: 'handleScorerSelected', event: 'pick-scorer:selected' },
      { selector: '[data-controller="case-toolbar"]', id: 'case-toolbar', method: 'handleBootstrapReady', event: 'core-bootstrap:ready' },
      { selector: '[data-controller="qgraph"]', id: 'qgraph', method: 'handleScorePersisted', event: 'case-score:persisted' },
      { selector: '[data-controller="qgraph"]', id: 'qgraph', method: 'handleAnnotationsChanged', event: 'annotations:changed' },
      { selector: '[data-controller="add-query"]', id: 'add-query', method: 'refreshQueryState', event: 'queries-state:changed' },
      { selector: '[data-controller="add-query"]', id: 'add-query', method: 'complete', event: 'add-query:complete' },
      { selector: '[data-controller="qscore-case"]', id: 'qscore-case', method: 'handleDiffsRefreshed', event: 'query-diffs:refreshed' },
      { selector: '[data-controller="qscore-case"]', id: 'qscore-case', method: 'handleScorerSelected', event: 'pick-scorer:selected' },
      { selector: '#shareCaseModal', id: 'share-case-core', method: 'openFromExternal', event: 'quepid:open-share-case-core' },
      { selector: '#wizardModal', id: 'wizard', method: 'open', event: 'wizard:open' },
      { selector: '[data-controller~="snapshot-bridge"]', id: 'snapshot-bridge', method: 'selectionRequest', event: 'diff:selection-request' },
      { selector: '[data-controller~="snapshot-bridge"]', id: 'snapshot-bridge', method: 'apply', event: 'diff:apply' },
      { selector: '[data-controller~="snapshot-bridge"]', id: 'snapshot-bridge', method: 'clear', event: 'diff:clear' },
      { selector: '[data-controller~="snapshot-bridge"]', id: 'snapshot-bridge', method: 'delete', event: 'diff:delete' },
      { selector: '[data-controller~="snapshot-bridge"]', id: 'snapshot-bridge', method: 'create', event: 'take-snapshot:create' },
      { selector: '[data-controller="pane"]', id: 'pane', method: 'toggle', event: 'toggleEast' },
      { selector: '[data-controller="pane"]', id: 'pane', method: 'resize', event: 'resize' },
      { selector: '[data-controller="search-results"]', id: 'search-results', method: 'handleRating', event: 'rating-popover:rate' },
      { selector: '[data-controller="search-results"]', id: 'search-results', method: 'handleRating', event: 'rating-popover:reset' },
      { selector: '[data-controller="search-results"]', id: 'search-results', method: 'handleQueryToggle', event: 'query-row:toggle' },
      { selector: '[data-controller="search-results"]', id: 'search-results', method: 'handleShowDocument', event: 'search-result:show-document' },
      { selector: '[data-controller="search-results"]', id: 'search-results', method: 'closeNotes', event: 'query-notes:close' },
      { selector: '[data-controller~="query-command-bridge"]', id: 'query-command-bridge', method: 'handleQueryRemovalCompleted', event: 'query-command:delete-completed' },
      { selector: '[data-controller~="query-command-bridge"]', id: 'query-command-bridge', method: 'handleQueryRemovalCompleted', event: 'query-command:move-completed' },
      { selector: '[data-controller~="queries-list"]', id: 'queries-list', method: 'handleQueryToggle', event: 'query-row:toggle' },
      { selector: '[data-controller~="queries-list"]', id: 'queries-list', method: 'handleQueryDeleteCompleted', event: 'query-command:delete-completed' },
      { selector: '[data-controller~="queries-list"]', id: 'queries-list', method: 'handleQueryMoveCompleted', event: 'query-command:move-completed' },
      { selector: '[data-controller~="queries-list"]', id: 'queries-list', method: 'refreshListState', event: 'queries-state:changed' },
      { selector: '[data-flash-channel-value="main"]', id: 'flash', method: 'onDocumentShow', event: 'flash:show' },
      { selector: '[data-flash-channel-value="main"]', id: 'flash', method: 'onDocumentHide', event: 'flash:hide' },
      { selector: '[data-flash-channel-value="search-error"]', id: 'flash', method: 'onDocumentShow', event: 'flash:show' },
      { selector: '[data-flash-channel-value="search-error"]', id: 'flash', method: 'onDocumentHide', event: 'flash:hide' }
    ].map(probe => {
      const element = document.querySelector(probe.selector)!;
      const controller = app.getControllerForElementAndIdentifier(element, probe.id);
      // Rehydration can replace query rows; keep the lifecycle probe's DOM stable.
      if (probe.id === 'snapshot-bridge') controller.bootstrapSnapshots = async () => {};
      const state = { ...probe, element, controller, count: 0, originalControllers: element.getAttribute("data-controller") };
      const previous = controller[probe.method];
      controller[probe.method] = (event: Event) => {
        if (event.type === probe.event) state.count += 1;
        else if (['handleRating', 'handleQueryRemovalCompleted'].includes(probe.method)) previous.call(controller, event);
      };
      return state;
    });
    (window as any).eventActionProbes = probes;
  });

  const dispatch = async () => page.evaluate(() => {
    const probes = (window as any).eventActionProbes;
    const dispatched = new Set<string>();
    for (const probe of probes) {
      const target = probe.event === 'resize' ? window :
        ['add-query:complete', 'wizard:open', 'rating-popover:rate', 'rating-popover:reset', 'query-row:toggle', 'search-result:show-document', 'query-notes:close'].includes(probe.event) ? probe.element : document;
      const key = target === document || target === window ? probe.event : `${probe.id}:${probe.event}`;
      if (dispatched.has(key)) continue;
      dispatched.add(key);
      target.dispatchEvent(new CustomEvent(probe.event));
    }
    return probes.map((probe: any) => probe.count);
  });
  expect(await dispatch()).toEqual(Array(34).fill(1));

  await page.evaluate(() => {
    for (const probe of (window as any).eventActionProbes) probe.element.setAttribute('data-controller', probe.element.getAttribute('data-controller').split(' ').filter((id: string) => id !== probe.id).join(' '));
  });
  await expect.poll(() => page.evaluate(() => {
    const app = (window as any).Stimulus;
    return (window as any).eventActionProbes.every((probe: any) =>
      !app.getControllerForElementAndIdentifier(probe.element, probe.id));
  })).toBe(true);
  expect(await dispatch()).toEqual(Array(34).fill(1));

  await page.evaluate(() => {
    for (const probe of (window as any).eventActionProbes) probe.element.setAttribute('data-controller', probe.originalControllers);
  });
  await expect.poll(() => page.evaluate(() => {
    const app = (window as any).Stimulus;
    return (window as any).eventActionProbes.filter((probe: any) =>
      !app.getControllerForElementAndIdentifier(probe.element, probe.id)).map((probe: any) => ({ id: probe.id, event: probe.event, attached: probe.element.isConnected }));
  })).toEqual([]);
  expect(await dispatch()).toEqual(Array(34).fill(2));
});

test('generated result and match-explain controls route through declared actions', async ({ page }) => {
  // Live-Solr case 6 returns explain data, so its results render hot-match bars.
  await gotoCase(page, '', 6);
  await expandFirstQuery(page);

  await page.locator('search-result').first().locator('.subTitle a').click();
  await expect(page.locator('.modal.show')).toBeVisible();
  await page.locator('.modal.show').getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('.modal.show')).toHaveCount(0);

  const bar = page.locator('search-result .match-explain-bar').first();
  await expect(bar).toBeVisible();
  await bar.click();
  await expect(page.locator('.modal.show [data-modal-target="json"]')).toBeVisible();
  // This modal has no close button; Bootstrap ignores Esc until its fade-in ends.
  await expect(async () => {
    await page.keyboard.press('Escape');
    await expect(page.locator('.modal.show')).toHaveCount(0, { timeout: 1_000 });
  }).toPass();

  // Live results rarely have more than three hot matches; give one row five so it renders the toggle.
  const explain = page.locator('search-result [data-controller="match-explain"]').first();
  await explain.evaluate(element => {
    const data = JSON.parse(element.getAttribute('data-match-explain-data-value')!);
    data.hots = [1, 2, 3, 4, 5].map(i => ({ description: `term ${i}`, percentage: 100 - i * 10 }));
    element.setAttribute('data-match-explain-data-value', JSON.stringify(data));
  });
  const toggle = explain.locator('.match-explain-toggle');
  await expect(toggle).toHaveText('Show 2 More');
  await toggle.click();
  await expect(toggle).toHaveText('Show Less');
  await expect(explain.locator('.match-explain-more')).toHaveClass(/show/);
  await toggle.click();
  await expect(toggle).toHaveText('Show 2 More');
});

test('missing-document rating actions stay inside the dynamic modal', async ({ page }) => {
  await gotoCase(page, '', 6);
  await expandFirstQuery(page);
  await page.getByRole('button', { name: 'Missing Documents', exact: true }).first().click();
  const root = page.locator('.modal.show [data-controller="missing-documents"]');
  await expect(root.locator('textarea')).toBeVisible();
  await root.evaluate(element => {
    const controller = (window as any).Stimulus.getControllerForElementAndIdentifier(element, 'missing-documents');
    controller.rate = (event: Event) => {
      const previous = Number((element as HTMLElement).dataset.ratingCalls || 0);
      (element as HTMLElement).dataset.ratingCalls = String(previous + 1);
      (element as HTMLElement).dataset.ratingEvent = event.type;
    };
    element.dispatchEvent(new CustomEvent('rating-popover:rate', { bubbles: true, detail: { rating: 1 } }));
  });
  await expect(root).toHaveAttribute('data-rating-calls', '1');
  await root.evaluate(element => element.dispatchEvent(new CustomEvent('rating-popover:reset', { bubbles: true })));
  await expect(root).toHaveAttribute('data-rating-calls', '2');
  await expect(root).toHaveAttribute('data-rating-event', 'rating-popover:reset');
});

test('query pagination actions move between first and last pages', async ({ page }) => {
  await gotoCase(page);
  const pagination = page.locator('[data-queries-list-target="pagination"]');
  await expect(pagination).toContainText('Page 1 of 2');
  await expect(pagination.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
  await pagination.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(pagination).toContainText('Page 2 of 2');
  await expect(pagination.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  await pagination.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(pagination).toContainText('Page 1 of 2');
});

import { test, expect } from '@playwright/test';
import { gotoCase, expandFirstQuery } from './case_helpers';

// These regressions use existing seed rows and intercept writes; no DB rows are created.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/cases/*/scores', async route => {
    if (route.request().method() === 'PUT') await route.fulfill({ json: {} });
    else await route.continue();
  });
});

for (const status of [200, 500]) {
  test(`Query Options keeps the reopened query intact after ${status}`, async ({ page }) => {
    let finish!: () => void;
    let started!: () => void;
    const pending = new Promise<void>(resolve => { finish = resolve; });
    const requested = new Promise<void>(resolve => { started = resolve; });
    let savedQueryId = '';
    await page.route('**/api/cases/*/queries/*/options', async route => {
      if (route.request().method() !== 'PUT') return route.continue();
      savedQueryId = route.request().url().match(/queries\/(\d+)\/options/)![1];
      started();
      await pending;
      await route.fulfill({ status, json: {} });
    });
    await gotoCase(page);
    const toggles = page.locator('.results-list-element li .toggleSign[data-action="click->query-row#toggle"]');
    await toggles.nth(0).click();
    await toggles.nth(1).click();
    await page.evaluate(() => {
      (window as any).savedOptions = [];
      document.addEventListener('query-options:saved', event => {
        (window as any).savedOptions.push((event as CustomEvent).detail);
      });
    });
    const modal = page.locator('#queryOptionsModal');
    await page.getByRole('button', { name: 'Set Options', exact: true }).first().click();
    await modal.locator('.cm-content').fill('{"boost":2}');
    await modal.getByRole('button', { name: 'Set Options', exact: true }).click();
    await requested;
    await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(modal).toBeHidden();
    await page.getByRole('button', { name: 'Set Options', exact: true }).nth(1).click();
    const reopenedText = await modal.locator('.cm-content').innerText();
    // Wait for Bootstrap's show transition before releasing the earlier save.
    await modal.evaluate(element => new Promise<void>(resolve => {
      const instance = (window as any).bootstrap.Modal.getInstance(element);
      if (!instance._isTransitioning) resolve();
      else element.addEventListener('shown.bs.modal', () => resolve(), { once: true });
    }));
    finish();
    if (status === 200) {
      await expect.poll(() => page.evaluate(() => (window as any).savedOptions)).toEqual([
        { queryId: savedQueryId, options: { boost: 2 } }
      ]);
    } else {
      await expect.poll(() => page.evaluate(() => {
        const element = document.querySelector('#queryOptionsModal');
        return (window as any).Stimulus.getControllerForElementAndIdentifier(element, 'query-options-core').saving;
      })).toBe(false);
      expect(await page.evaluate(() => (window as any).savedOptions)).toEqual([]);
    }
    await expect(modal).toBeVisible();
    await expect(modal.locator('.cm-content')).toHaveText(reopenedText);
    await expect(modal.getByRole('button', { name: 'Set Options', exact: true })).toBeEnabled();
  });
}

for (const operation of ['search', 'reset', 'paginate']) {
  test(`Missing Documents recovers after failed ${operation}`, async ({ page }) => {
    await gotoCase(page, '', 6);
    await expandFirstQuery(page);
    await page.getByRole('button', { name: 'Missing Documents', exact: true }).first().click();
    const root = page.locator('.modal.show [data-controller="missing-documents"]');
    const search = root.locator('input[type="submit"]');
    await expect(search).toBeEnabled();
    await root.evaluate((element, action) => {
      const controller = (window as any).Stimulus.getControllerForElementAndIdentifier(element, 'missing-documents');
      controller.adapter.defaultList = false;
      controller.adapter.numFound = controller.adapter.docs.length + 10;
      controller.render();
      const method = action === 'reset' ? 'resetToRated' : action;
      let fail = true;
      controller.adapter[method] = async () => {
        if (fail) { fail = false; throw new Error('Simulated search-engine failure'); }
      };
    }, operation);
    const button = operation === 'search' ? search : root.locator(`[data-missing-documents-target="${operation === 'reset' ? 'resetButton' : 'next'}"]`);
    await button.click();
    await expect(root.locator('[data-missing-documents-target="status"]')).toContainText('Please try again.');
    await expect(search).toBeEnabled();
    await expect(root.locator('[data-missing-documents-target="spinner"]')).toBeHidden();
    await button.click();
    await expect(root.locator('[data-missing-documents-target="status"]')).not.toContainText('Please try again.');
  });
}

test('new team shows blank and duplicate validation errors with the entered name', async ({ page }) => {
  await page.goto('teams/new');
  await page.getByRole('button', { name: 'Create Team' }).click();
  await expect(page.locator('#error_explanation')).toContainText("Name can't be blank");
  await page.locator('#team_name').fill('OSC');
  await page.getByRole('button', { name: 'Create Team' }).click();
  await expect(page.locator('#error_explanation')).toContainText('Name has already been taken');
  await expect(page.locator('#team_name')).toHaveValue('OSC');
});

test('book pairs import without a file requests an upload', async ({ page }) => {
  const bookId = process.env.QUEPID_E2E_BOOK_ID || '1';
  await page.goto(`books/import/${bookId}/edit`);
  await page.getByRole('button', { name: 'Upload', exact: true }).first().click();
  const errors = page.locator('#error_explanation_query_doc_pairs');
  await expect(errors).toContainText('You must select the file to be imported first.');
  await expect(errors).not.toContainText('Invalid JSON');
});

// Read-only seed case; snapshot/export responses are intercepted, so these tests
// create no shared database rows and exercise native browser downloads.
for (const format of ['Basic', 'TREC']) {
  test(`snapshot selection preserves ${format} through the download`, async ({ page }) => {
    await page.route('**/api/cases/6/snapshots?*', route => route.fulfill({
      json: { snapshots: [{ id: 9999, name: 'Format regression', time: '2026-10-07T21:10:00Z' }] }
    }));
    const expectedFormat = format === 'TREC' ? 'trec_snapshot' : 'basic_snapshot';
    const content = format === 'TREC' ? '1 0 doc1 1\n' : 'query,docid,rating\nheart,doc1,1\n';
    let requestedFormat = '';
    await page.route('**/api/export/ratings/6.*?*', async route => {
      const params = new URL(route.request().url()).searchParams;
      requestedFormat = params.get('file_format') || '';
      expect(params.get('snapshot_id')).toBe('9999');
      await route.fulfill({ body: content, contentType: format === 'TREC' ? 'text/plain' : 'text/csv' });
    });
    await gotoCase(page, '', 6);
    await page.getByRole('link', { name: 'Export', exact: true }).click();
    const modal = page.getByRole('dialog');
    await modal.getByRole('radio', { name: format, exact: true }).check();
    await modal.locator('[data-export-case-core-target="basicSnapshotSelect"]').selectOption('9999');
    await expect(modal.getByRole('radio', { name: format, exact: true })).toBeChecked();
    const downloadPromise = page.waitForEvent('download');
    await modal.getByRole('button', { name: 'Export', exact: true }).click();
    const download = await downloadPromise;
    expect(requestedFormat).toBe(expectedFormat);
    expect(download.suggestedFilename()).toContain(expectedFormat);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks).toString()).toBe(content);
  });
}

test('Solr Missing Documents accepts a plain ID query and retains original explain context', async ({ page }) => {
  await gotoCase(page, '', 6);
  await expandFirstQuery(page);
  const originalQuery = await page.locator('.results-list-element h2').first().innerText();
  const requests: URL[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.searchParams.get('explainOther') === 'id:l_15577') requests.push(url);
  });
  await page.getByRole('button', { name: 'Missing Documents', exact: true }).first().click();
  const modal = page.getByRole('dialog');
  await expect(modal.locator('textarea')).toHaveValue('');
  await modal.locator('textarea').fill('id:l_15577');
  await modal.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(modal).toContainText('Legislative summaries.');
  await expect(modal).toContainText('1 matching document.');
  expect(requests.length).toBeGreaterThan(0);
  expect(requests[0].searchParams.get('q')).toBe(originalQuery.trim());
  await modal.getByRole('button', { name: 'Reset to All Rated Docs' }).click();
  await expect(modal).toContainText('Already Rated Documents');
  await expect(modal.locator('textarea')).toHaveValue('');
});

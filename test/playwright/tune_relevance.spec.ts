import { test, expect, type Page } from '@playwright/test';
import { apiHeaders, createDisposableCase, deleteCaseViaApi } from './case_helpers';

const EDITABLE_CASE_ID = Number(process.env.QUEPID_E2E_EDITABLE_CASE_ID || 2);

test('query edits survive knob extraction and tab changes', async ({ page }) => {
  await page.goto(`case/${EDITABLE_CASE_ID}`);
  await page.getByRole('button', { name: 'Tune Relevance', exact: true }).click();
  const editor = page.locator('#query-params-editor .cm-content');
  const template = '{"query":{"multi_match":{"query":"#$query##","fields":["title^##titleBoost##"]}}}';
  await editor.fill(template);
  await expect(editor).toHaveText(template);
  await page.locator('[data-tune-relevance-tab-param="curator"]').click();
  await expect(page.locator('[data-tune-relevance-target="curatorVars"]')).toContainText('titleBoost');
  await page.locator('[data-tune-relevance-target="curatorVars"] input').fill('8');
  await page.locator('[data-tune-relevance-tab-param="developer"]').click();
  await expect(editor).toHaveText(template);
  await page.locator('[data-tune-relevance-tab-param="curator"]').click();
  await expect(page.locator('[data-tune-relevance-target="curatorVars"] input')).toHaveValue('8');
});

test('engine settings sections, endpoint suggestions and background evaluation', async ({ page }) => {
  await page.route(`**/api/cases/${EDITABLE_CASE_ID}/search_endpoints`, route => route.fulfill({
    json: { search_endpoints: [{ search_endpoint_id: 987654, name: 'Routing test endpoint', search_engine: 'solr' }] }
  }));
  await page.goto(`case/${EDITABLE_CASE_ID}`);
  await page.getByRole('button', { name: 'Tune Relevance', exact: true }).click();
  await expect(page.locator('[data-tune-relevance-target="endpointSelect"] option[value="987654"]')).toBeAttached();

  await page.locator('[data-tune-relevance-tab-param="engineSettings"]').click();
  // Search Endpoints, Evaluate Nightly and Escape Queries start collapsed, as they did in the Angular drawer.
  for (const section of ['search', 'nightly', 'escape']) {
    await expect(page.locator(`[data-tune-relevance-target="sectionBody"][data-section-body="${section}"]`)).toBeHidden();
  }
  await page.locator('.dev-header[data-tune-relevance-section-param="search"]').click();
  await page.locator('.dev-header[data-tune-relevance-section-param="nightly"]').click();

  const wrapper = page.locator('[data-tune-relevance-target="endpointSelect"] + .ts-wrapper');
  const endpointSearch = wrapper.locator('input');
  const suggestions = wrapper.locator('.option');
  await wrapper.locator('.ts-control').click();
  await expect(suggestions).toHaveCount(1);
  await expect(suggestions.locator('img')).toHaveAttribute('src', 'images/solr-icon.png');
  await endpointSearch.fill('routing');
  await expect(suggestions).toContainText('Routing test endpoint');
  await page.keyboard.press('Escape');
  await expect(wrapper.locator('.ts-dropdown')).toBeHidden();
  await wrapper.locator('.ts-control').click();
  await endpointSearch.fill('Routing test');
  await suggestions.click();
  await expect(page.locator('[data-tune-relevance-target="endpointSelect"]')).toHaveValue('987654');
  await expect(page.locator('[data-tune-relevance-target="endpointName"]')).toHaveText('Routing test endpoint');

  const fieldsHeader = page.locator('.dev-header[data-tune-relevance-section-param="fields"]');
  const fieldsBody = page.locator('[data-tune-relevance-target="sectionBody"][data-section-body="fields"]');
  await fieldsHeader.click();
  await expect(fieldsBody).toHaveClass(/d-none/);
  await fieldsHeader.click();
  await expect(fieldsBody).not.toHaveClass(/d-none/);

  // Answer the job-queue POST so no background evaluation is queued against the shared case.
  let evaluationRequests = 0;
  await page.route(`**/api/cases/${EDITABLE_CASE_ID}/run_evaluation**`, route => {
    evaluationRequests += 1;
    return route.fulfill({ json: {} });
  });
  await page.locator('[data-tune-relevance-target~="runEvaluation"]').click();
  await expect(page).not.toHaveURL(/\/case\//);
  expect(evaluationRequests).toBe(1);
});

test.describe('try management on a disposable case', () => {
  let caseId: number | undefined;

  test.afterAll(async ({ browser }) => {
    if (caseId === undefined) return;
    const page = await browser.newPage();
    await page.goto('cases');
    await deleteCaseViaApi(page, caseId);
    await page.close();
  });

  test('nightly persists, and tries can be duplicated, renamed and deleted', async ({ page }) => {
    caseId = await createDisposableCase(page, 'Tune Relevance');
    const historyRows = page.locator('[data-tune-relevance-target="historyList"] li');
    const modal = page.locator('[data-tune-relevance-target="tryModal"]');

    const openTuneRelevance = async (tab: string) => {
      await page.getByRole('button', { name: 'Tune Relevance', exact: true }).click();
      await page.locator(`[data-tune-relevance-tab-param="${tab}"]`).click();
    };
    const openTryDetails = async (tryNo: string) => {
      const row = historyRows.and(page.locator(`[data-try-no="${tryNo}"]`));
      await row.hover();
      await row.locator('[data-try-details]').click();
      await expect(modal).toBeVisible();
    };

    await page.goto(`case/${caseId}`);
    await openTuneRelevance('engineSettings');
    await page.locator('.dev-header[data-tune-relevance-section-param="nightly"]').click();
    const nightly = page.locator('[data-tune-relevance-target~="nightly"]');
    await expect(nightly).not.toBeChecked();
    const nightlySaved = page.waitForResponse(response =>
      response.url().includes(`/api/cases/${caseId}`) && response.request().method() === 'PUT');
    await nightly.check();
    expect((await nightlySaved).ok()).toBeTruthy();

    await page.reload();
    await openTuneRelevance('engineSettings');
    await expect(nightly).toBeChecked();

    await page.locator('[data-tune-relevance-tab-param="history"]').click();
    await expect(historyRows).toHaveCount(1);
    const activeTryNo = (await historyRows.first().getAttribute('data-try-no'))!;
    await openTryDetails(activeTryNo);
    // The only try can never be deleted.
    await expect(modal.locator('[data-tune-relevance-target="tryDelete"]')).toBeDisabled();

    await modal.getByRole('button', { name: 'Duplicate' }).click();
    await expect(modal).toBeHidden();
    await expect(historyRows).toHaveCount(2);
    const duplicateTryNo = (await historyRows.first().getAttribute('data-try-no'))!;
    expect(duplicateTryNo).not.toBe(activeTryNo);
    // Duplicating does not switch the active try.
    await expect(page).not.toHaveURL(new RegExp(`/try/${duplicateTryNo}\\b`));

    await openTryDetails(duplicateTryNo);
    await modal.locator('[data-tune-relevance-target="tryRenameAction"]').click();
    const renamed = `Renamed try ${Date.now()}`;
    await modal.locator('[data-tune-relevance-target="tryNameInput"]').fill(renamed);
    await modal.locator('[data-tune-relevance-target="tryRenameForm"] button[type="submit"]').click();
    // As in the Angular modal, a rename stays in the modal, back on the read-only title, without a flash.
    await expect(modal.locator('[data-tune-relevance-target="tryTitle"]')).toHaveText(renamed);
    await expect(modal.locator('[data-tune-relevance-target="tryRenameForm"]')).toBeHidden();
    await expect(modal).toBeVisible();
    await expect(page.locator('#flash-messages')).not.toContainText('renamed');
    await expect(historyRows.and(page.locator(`[data-try-no="${duplicateTryNo}"]`))).toContainText(renamed);
    await modal.getByRole('button', { name: 'Dismiss' }).last().click();
    await expect(modal).toBeHidden();

    // Without a try in the URL the case opens on its newest try, so pin the original one.
    await page.goto(`case/${caseId}/try/${activeTryNo}`);
    await openTuneRelevance('history');
    await expect(historyRows.and(page.locator(`[data-try-no="${duplicateTryNo}"]`))).toContainText(renamed);

    // The active try cannot be deleted while it is selected.
    await openTryDetails(activeTryNo);
    await modal.locator('[data-tune-relevance-target="tryDelete"]').click();
    await expect(modal).toBeHidden();
    await expect(page.locator('#flash-messages')).toContainText('You can not delete the currently active try');
    await expect(historyRows).toHaveCount(2);

    await openTryDetails(duplicateTryNo);
    page.once('dialog', dialog => dialog.accept());
    await modal.locator('[data-tune-relevance-target="tryDelete"]').click();
    await expect(modal).toBeHidden();
    await expect(historyRows).toHaveCount(1);

    await page.reload();
    await openTuneRelevance('history');
    await expect(historyRows).toHaveCount(1);
    await expect(historyRows.first()).toHaveAttribute('data-try-no', activeTryNo);
  });
});

/**
 * The drawer against a disposable case with its own endpoint and try, so nothing here touches shared
 * fixtures. The case has no queries, so the endpoint URL is never contacted. `page.route` is used only to
 * inject failures or to fake the endpoint list, never to replace the behaviour under test.
 */
test.describe('drawer on a disposable case with its own endpoint', () => {
  let caseId: number;
  let endpointIds: number[] = [];

  const flash = (page: Page) => page.locator('#flash-messages');
  const drawer = (page: Page) => page.locator('#dev-settings');
  const tab = (page: Page, name: string) => page.locator(`[data-tune-relevance-tab-param="${name}"]`);
  const historyRows = (page: Page) => page.locator('[data-tune-relevance-target="historyList"] li');
  const modal = (page: Page) => page.locator('[data-tune-relevance-target="tryModal"]');

  async function createEndpoint(page: Page, attrs: Record<string, unknown> = {}): Promise<{ id: number; name: string }> {
    const name = `Playwright Tune Endpoint ${Date.now()}-${endpointIds.length}`;
    const response = await page.request.post('api/search_endpoints', {
      headers: await apiHeaders(page, { 'Content-Type': 'application/json' }),
      data: { search_endpoint: { name, endpoint_url: 'http://tune.invalid/solr/select', search_engine: 'solr', api_method: 'GET', ...attrs } }
    });
    expect(response.ok(), `endpoint create: ${response.status()}`).toBeTruthy();
    const created = await response.json();
    const id = Number(created.search_endpoint_id ?? created.id);
    expect(id).toBeGreaterThan(0);
    endpointIds.push(id);
    return { id, name };
  }

  async function createTry(page: Page, endpointId: number, attrs: Record<string, unknown> = {}): Promise<number> {
    const response = await page.request.post(`api/cases/${caseId}/tries`, {
      headers: await apiHeaders(page, { 'Content-Type': 'application/json' }),
      data: { try: { search_endpoint_id: endpointId, query_params: 'q=#$query##', field_spec: 'id:id title:title', number_of_rows: 10, ...attrs } }
    });
    expect(response.ok(), `try create: ${response.status()}`).toBeTruthy();
    const tryNo = Number((await response.json()).try_number);
    expect(tryNo).toBeGreaterThan(0);
    return tryNo;
  }

  /** Opens the drawer on a tab, whether or not it is already open (the toolbar button toggles it). */
  async function openDrawer(page: Page, name: string) {
    if (!(await drawer(page).isVisible())) await page.getByRole('button', { name: 'Tune Relevance', exact: true }).click();
    await tab(page, name).click();
  }

  async function gotoTry(page: Page, tryNo: number, tabName: string) {
    await page.goto(`case/${caseId}/try/${tryNo}`);
    await openDrawer(page, tabName);
  }

  async function openTryDetails(page: Page, tryNo: number) {
    const row = historyRows(page).and(page.locator(`[data-try-no="${tryNo}"]`));
    await row.hover();
    await row.locator('[data-try-details]').click();
    await expect(modal(page)).toBeVisible();
  }

  test.beforeEach(async ({ page }) => {
    caseId = await createDisposableCase(page, 'Tune Drawer');
    endpointIds = [];
  });

  test.afterEach(async ({ page }) => {
    await page.goto('cases');
    if (caseId) await deleteCaseViaApi(page, caseId);
    for (const id of endpointIds) {
      const response = await page.request.delete(`api/search_endpoints/${id}`, { headers: await apiHeaders(page) });
      expect(response.ok(), `endpoint ${id} cleanup failed: ${response.status()}`).toBeTruthy();
    }
  });

  test('tabs show one panel at a time and Rerun only on the editable tabs', async ({ page }) => {
    const endpoint = await createEndpoint(page);
    const tryNo = await createTry(page, endpoint.id);
    await gotoTry(page, tryNo, 'developer');
    await expect(drawer(page).locator('[data-tune-relevance-target="tab"]')).toHaveText(
      ['Query', 'Tuning Knobs', 'Settings', 'History', 'Annotations']);

    const editable: Record<string, boolean> = { developer: true, curator: true, engineSettings: true, history: false, annotations: false };
    for (const [name, canRerun] of Object.entries(editable)) {
      await tab(page, name).click();
      await expect(tab(page, name)).toHaveClass(/active/);
      for (const other of Object.keys(editable)) {
        await expect(page.locator(`[data-tune-panel="${other}"]`)).toBeVisible({ visible: other === name });
      }
      await expect(page.locator('#query-sandbox-action')).toBeVisible({ visible: canRerun });
    }
  });

  test('the query tab warns about a Solr parameter typo as you type', async ({ page }) => {
    const endpoint = await createEndpoint(page);
    const tryNo = await createTry(page, endpoint.id);
    await gotoTry(page, tryNo, 'developer');
    const warning = page.locator('[data-tune-relevance-target="queryWarning"]');
    await expect(warning).toBeHidden();
    await page.locator('#query-params-editor .cm-content').fill('q=foo&deftype=edismax');
    await expect(warning).toHaveText('Your query params contain deftype, you probably meant defType.');
    await page.locator('#query-params-editor .cm-content').fill('q=foo&defType=edismax');
    await expect(warning).toBeHidden();
  });

  test('Tuning Knobs explains the tab until the query has a knob', async ({ page }) => {
    const endpoint = await createEndpoint(page);
    const tryNo = await createTry(page, endpoint.id);
    await gotoTry(page, tryNo, 'curator');
    const intro = page.locator('[data-tune-relevance-target="knobsIntro"]');
    await expect(intro).toHaveText("What's this tab do? Knobs allow you to fine tune your search! Define variables in your query template with ##, such as this boost: title^##titleBoost##. Play with the values in this tab. Submit to rerun with the new values!");
    await expect(page.locator('[data-tune-panel="curator"] .tip')).toHaveText('Add and remove knobs from here by editing your query.');
    await tab(page, 'developer').click();
    await page.locator('#query-params-editor .cm-content').fill('q=#$query##&qf=title^##titleBoost##');
    await tab(page, 'curator').click();
    await expect(intro).toBeHidden();
    await expect(page.locator('[data-tune-panel="curator"] .tip')).toBeVisible();
    // A knob removed from the query stays on the try, so the intro stays hidden, as in the Angular drawer.
    await tab(page, 'developer').click();
    await page.locator('#query-params-editor .cm-content').fill('q=#$query##');
    await tab(page, 'curator').click();
    await expect(page.locator('[data-tune-relevance-target="curatorVars"] input')).toHaveCount(0);
    await expect(intro).toBeHidden();
  });

  test('a knob value input widens to show a long value', async ({ page }) => {
    const endpoint = await createEndpoint(page);
    const tryNo = await createTry(page, endpoint.id, { query_params: 'q=#$query##&qf=title^##titleBoost##' });
    await gotoTry(page, tryNo, 'curator');
    const knob = page.locator('[data-tune-relevance-target="curatorVars"] input');
    const width = async () => knob.evaluate(input => input.getBoundingClientRect().width);
    await knob.fill('1');
    const short = await width();
    await knob.fill('123456789012345');
    expect(await width()).toBeGreaterThan(short);
    expect(await knob.evaluate(input => input.scrollWidth <= input.clientWidth)).toBe(true);
  });

  test('a Static endpoint has no query settings or knobs to edit', async ({ page }) => {
    const endpoint = await createEndpoint(page, { search_engine: 'static', endpoint_url: 'http://tune.invalid/api/cases/1/snapshots/1/search' });
    const tryNo = await createTry(page, endpoint.id);
    await gotoTry(page, tryNo, 'developer');
    await expect(page.locator('[data-tune-relevance-target="staticEngineMessage"]')).toBeVisible();
    await expect(page.locator('[data-tune-relevance-target="editorShell"]')).toBeHidden();
    await tab(page, 'curator').click();
    await expect(page.locator('[data-tune-relevance-target="staticKnobsMessage"]')).toBeVisible();
  });

  test('Displayed Fields discovers candidates using the wizard smoke-test query', async ({ page }) => {
    const endpoint = await createEndpoint(page);
    const tryNo = await createTry(page, endpoint.id);
    const requests: URL[] = [];
    await page.route('http://tune.invalid/**', route => {
      requests.push(new URL(route.request().url()));
      return route.fulfill({
        headers: {
          'access-control-allow-origin': new URL(page.url()).origin,
          'access-control-allow-credentials': 'true',
          'access-control-allow-headers': '*'
        },
        json: { response: { numFound: 1, start: 0, docs: [{ id: '1', title: 'A', title_bidirect: 'B', poster_path: '/poster.jpg' }] } }
      });
    });
    await gotoTry(page, tryNo, 'engineSettings');
    const fields = page.locator('[data-tune-relevance-target="fieldSpec"]');
    const wrapper = page.locator('[data-tune-relevance-target="fieldSpec"] + .ts-wrapper');
    await wrapper.locator('.ts-control').click();
    const input = wrapper.locator('input');
    await input.fill('tit');
    await expect(wrapper.locator('.option')).toHaveText(['title', 'title_bidirect']);
    expect(requests.some(url => url.searchParams.get('q') === '*:*' && url.searchParams.get('fl') === '*')).toBeTruthy();
    await expect(fields).toHaveValue('id:id,title:title');
    await input.fill('thumb:pos');
    await expect(wrapper.locator('.option')).toHaveText(['thumb:poster_path']);
    await wrapper.locator('.option').click();
    await expect(fields).toHaveValue('id:id,title:title,thumb:poster_path');
  });

  test('Rerun saves a new try with the form values, which survive a reload', async ({ page }) => {
    const endpoint = await createEndpoint(page);
    const tryNo = await createTry(page, endpoint.id, { query_params: 'q=#$query##&qf=title^##titleBoost##', field_spec: 'id:id title:title overview cast' });
    await gotoTry(page, tryNo, 'curator');
    await expect(page.locator('[data-tune-relevance-target="curatorVars"] .slider-wrap')).toHaveCount(1);
    await page.locator('[data-tune-relevance-target="curatorVars"] input').fill('7');
    await tab(page, 'engineSettings').click();
    const fields = page.locator('[data-tune-relevance-target="fieldSpec"] + .ts-wrapper');
    await fields.locator('.ts-control').click();
    const input = fields.locator('input');
    await input.press('ControlOrMeta+a');
    await input.press('Backspace');
    for (const value of ['id:id', 'title:title', 'overview']) {
      await input.fill(value);
      await input.press('Enter');
    }
    await page.locator('[data-tune-relevance-target="numberOfRows"]').fill('25');
    await page.locator('.dev-header[data-tune-relevance-section-param="escape"]').click();
    await page.locator('#escape-queries-checkbox').uncheck();
    await page.locator('#query-sandbox-action').click();
    await expect(page).toHaveURL(new RegExp(`/case/${caseId}/try/${tryNo + 1}\\b`));

    await page.reload();
    await openDrawer(page, 'engineSettings');
    await expect(page.locator('[data-tune-relevance-target="fieldSpec"]')).toHaveValue('id:id,title:title,overview');
    await expect(page.locator('[data-tune-relevance-target="numberOfRows"]')).toHaveValue('25');
    await page.locator('.dev-header[data-tune-relevance-section-param="escape"]').click();
    await expect(page.locator('#escape-queries-checkbox')).not.toBeChecked();
    await tab(page, 'curator').click();
    await expect(page.locator('[data-tune-relevance-target="curatorVars"] input')).toHaveValue('7');
  });

  test('JSON field definitions remain whole and persist after editing another field', async ({ page }) => {
    const first = '{"type":"thumb","name":"poster_path"}';
    const second = '{"type":"thumb","name":"backdrop_path"}';
    const endpoint = await createEndpoint(page);
    const tryNo = await createTry(page, endpoint.id, { field_spec: `id:id title:title ${first} ${second} overview` });
    await gotoTry(page, tryNo, 'engineSettings');
    const items = page.locator('[data-tune-relevance-target="fieldSpec"] + .ts-wrapper .item');
    await expect(items).toHaveCount(5);
    await expect(items.nth(2)).toContainText(first);
    await expect(items.nth(3)).toContainText(second);
    await items.filter({ hasText: /^overview/ }).locator('.remove').click();
    await page.locator('#query-sandbox-action').click();
    await expect(page).toHaveURL(new RegExp(`/case/${caseId}/try/${tryNo + 1}\\b`));
    await page.reload();
    await openDrawer(page, 'engineSettings');
    await expect(items).toHaveCount(4);
    await expect(items.nth(2)).toContainText(first);
    await expect(items.nth(3)).toContainText(second);
    const response = await page.request.get(`api/cases/${caseId}/tries/${tryNo + 1}`);
    expect(response.ok()).toBeTruthy();
    const saved = await response.json();
    expect(saved.field_spec).toBe(`id:id, title:title, ${first}, ${second}`);
  });

  test('Rerun rejects an out-of-range result count, and reports a failed save so the user can retry', async ({ page }) => {
    const endpoint = await createEndpoint(page);
    const tryNo = await createTry(page, endpoint.id);
    await gotoTry(page, tryNo, 'engineSettings');
    await page.locator('[data-tune-relevance-target="numberOfRows"]').fill('101');
    await page.locator('#query-sandbox-action').click();
    await expect(flash(page)).toContainText('Number of Results to Show must be between 1 and 100.');
    await expect(page).toHaveURL(new RegExp(`/try/${tryNo}\\b`));

    await page.locator('[data-tune-relevance-target="numberOfRows"]').fill('12');
    const failSave = (route: import('@playwright/test').Route) =>
      route.request().method() === 'POST' ? route.fulfill({ status: 500, json: { error: 'boom' } }) : route.continue();
    await page.route(`**/api/cases/${caseId}/tries**`, failSave);
    await page.locator('#query-sandbox-action').click();
    await expect(flash(page).locator('.alert-danger, .alert-error, .alert').first()).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/try/${tryNo}\\b`));
    await expect(page.locator('[data-tune-relevance-target="numberOfRows"]')).toHaveValue('12');
    await expect(page.locator('#query-sandbox-action')).toBeEnabled();

    await page.unroute(`**/api/cases/${caseId}/tries**`, failSave);
    await page.locator('#query-sandbox-action').click();
    await expect(page).toHaveURL(new RegExp(`/try/${tryNo + 1}\\b`));
  });

  test('history rows go to their try, and the ... button opens the details instead', async ({ page }) => {
    const endpoint = await createEndpoint(page);
    const first = await createTry(page, endpoint.id, { query_params: 'q=#$query##&qf=title^##boost##' });
    const second = await createTry(page, endpoint.id, { query_params: 'q=#$query##&qf=body' });
    await gotoTry(page, second, 'history');
    const row = historyRows(page).and(page.locator(`[data-try-no="${first}"]`));
    await expect(row).toContainText(endpoint.name);

    await openTryDetails(page, first);
    await expect(page).toHaveURL(new RegExp(`/try/${second}\\b`));
    await expect(modal(page).locator('[data-tune-relevance-target="tryQueryParams"]')).toHaveText('q=#$query##&qf=title^##boost##');
    await expect(modal(page).locator('[data-tune-relevance-target="tryEndpointLink"]')).toHaveText(endpoint.name);
    await expect(modal(page).locator('[data-tune-relevance-target="tryFieldSpec"]')).toHaveText('id:id title:title');
    await expect(modal(page).locator('[data-tune-relevance-target="tryVariables"]')).toContainText('##boost##');
    await modal(page).getByRole('button', { name: 'Dismiss' }).last().click();
    await expect(modal(page)).toBeHidden();

    await row.click();
    await expect(page).toHaveURL(new RegExp(`/try/${first}\\b`));
  });

  test('a blank try name is not saved, and failed rename, duplicate and delete are reported', async ({ page }) => {
    const endpoint = await createEndpoint(page);
    const first = await createTry(page, endpoint.id);
    const second = await createTry(page, endpoint.id);
    await gotoTry(page, second, 'history');

    let renames = 0;
    page.on('request', request => { if (request.method() === 'PUT' && request.url().includes(`/tries/${first}`)) renames += 1; });
    await openTryDetails(page, first);
    await modal(page).locator('[data-tune-relevance-target="tryRenameAction"]').click();
    await modal(page).locator('[data-tune-relevance-target="tryNameInput"]').fill('   ');
    await modal(page).locator('[data-tune-relevance-target="tryRenameForm"] button[type="submit"]').click();
    await expect(modal(page)).toBeVisible();
    expect(renames).toBe(0);

    const failing = (route: import('@playwright/test').Route) => route.request().method() === 'GET'
      ? route.continue() : route.fulfill({ status: 500, json: { error: 'boom' } });
    await page.route(`**/api/cases/${caseId}/tries**`, failing);
    await page.route(`**/api/clone/cases/${caseId}/tries/**`, failing);
    await modal(page).locator('[data-tune-relevance-target="tryNameInput"]').fill('Will not save');
    await modal(page).locator('[data-tune-relevance-target="tryRenameForm"] button[type="submit"]').click();
    await expect(flash(page)).toContainText('Unable to rename try.');
    await modal(page).getByRole('button', { name: 'Duplicate' }).click();
    await expect(flash(page)).toContainText('Unable to duplicate try.');
    page.once('dialog', dialog => dialog.accept());
    await modal(page).locator('[data-tune-relevance-target="tryDelete"]').click();
    await expect(flash(page)).toContainText('Unable to delete try.');
    await page.unroute(`**/api/cases/${caseId}/tries**`, failing);
    await page.unroute(`**/api/clone/cases/${caseId}/tries/**`, failing);
    // The case's own default Try 1 plus the two created here.
    await expect(historyRows(page)).toHaveCount(3);
  });

  test('a cancelled delete keeps the try', async ({ page }) => {
    const endpoint = await createEndpoint(page);
    const first = await createTry(page, endpoint.id);
    const second = await createTry(page, endpoint.id);
    await gotoTry(page, second, 'history');
    await openTryDetails(page, first);
    let asked = '';
    page.once('dialog', dialog => { asked = dialog.message(); return dialog.dismiss(); });
    await modal(page).locator('[data-tune-relevance-target="tryDelete"]').click();
    await expect.poll(() => asked).toContain(`Try ${first}`);
    await expect(historyRows(page)).toHaveCount(3);
  });

  test('endpoint details name the endpoint and link to it and to troubleshooting', async ({ page }) => {
    const endpoint = await createEndpoint(page);
    const tryNo = await createTry(page, endpoint.id);
    await gotoTry(page, tryNo, 'engineSettings');
    await expect(page.locator('[data-tune-relevance-target="endpointName"]')).toHaveText(endpoint.name);
    await expect(page.locator('[data-tune-relevance-target="endpointUrl"]')).toHaveText('http://tune.invalid/solr/select');
    await expect(page.locator('[data-tune-relevance-target="endpointMoreLink"]')).toHaveAttribute('href', `search_endpoints/${endpoint.id}`);
    const troubleshooting = page.locator('[data-tune-relevance-target="troubleshootingLink"]');
    await expect(troubleshooting).toContainText('Troubleshooting Solr and Quepid');
    await expect(troubleshooting).toHaveAttribute('href', /^https?:\/\//);
  });

  test('an archived endpoint is flagged', async ({ page }) => {
    const endpoint = await createEndpoint(page, { archived: true });
    const tryNo = await createTry(page, endpoint.id);
    await gotoTry(page, tryNo, 'engineSettings');
    await expect(page.locator('[data-tune-relevance-target="endpointArchived"]')).toContainText('This search endpoint has been archived');
  });

  test('choosing an endpoint on the other protocol replaces Rerun with a reload button', async ({ page }) => {
    const endpoint = await createEndpoint(page);
    const tryNo = await createTry(page, endpoint.id);
    // The case's list only holds endpoints shared with its teams, so serve one on the other protocol.
    await page.route(`**/api/cases/${caseId}/search_endpoints`, route => route.fulfill({ json: { search_endpoints: [
      { search_endpoint_id: 900001, name: 'Other protocol', search_engine: 'solr', endpoint_url: 'https://tune.invalid/solr/select', api_method: 'GET' }
    ] } }));
    await gotoTry(page, tryNo, 'engineSettings');
    await expect(page.locator('[data-tune-relevance-target="tlsWarning"]')).toBeHidden();
    await expect(page.locator('#query-sandbox-action')).toBeVisible();

    await page.locator('.dev-header[data-tune-relevance-section-param="search"]').click();
    const endpointWrapper = page.locator('[data-tune-relevance-target="endpointSelect"] + .ts-wrapper');
    await endpointWrapper.locator('.ts-control').click();
    await endpointWrapper.locator('input').fill('Other protocol');
    await endpointWrapper.locator('.option').filter({ hasText: 'Other protocol' }).click();
    const warning = page.locator('[data-tune-relevance-target="tlsWarning"]');
    await expect(warning).toBeVisible();
    await expect(page.locator('[data-tune-relevance-target="tlsProtocol"]')).toHaveText('https');
    await expect(page.locator('#query-sandbox-action')).toBeHidden();
    // Endpoint Details explains why, and links to the endpoint's edit page, as the Angular drawer did.
    const explanation = page.locator('[data-tune-relevance-target="tlsExplanation"]');
    await expect(explanation).toContainText('You have specified a search engine url that is on a different protocol ( https ) than Quepid is on.');
    await expect(explanation.getByRole('link', { name: 'swap to the proxied connection' })).toHaveAttribute('href', 'search_endpoints/900001/edit');

    await page.route(/^https:\/\//, route => route.abort());
    const reload = page.waitForRequest(request => request.url().startsWith('https://') && request.url().includes('showWizard=false'));
    await warning.getByRole('button').click();
    expect((await reload).url()).toContain(`/case/${caseId}/try/${tryNo}`);
  });

  test('the endpoint picker says so when there are none, and suggests every match', async ({ page }) => {
    const endpoint = await createEndpoint(page);
    const tryNo = await createTry(page, endpoint.id);
    const stub = (search_endpoints: unknown[]) => page.route(`**/api/cases/${caseId}/search_endpoints`, route => route.fulfill({ json: { search_endpoints } }));

    await stub([]);
    await gotoTry(page, tryNo, 'engineSettings');
    await page.locator('.dev-header[data-tune-relevance-section-param="search"]').click();
    // One searchable selector stays available even with no shared endpoints.
    await expect(page.locator('[data-section-body="search"]')).toContainText('Pick Shared Endpoints:');
    await expect(page.locator('[data-tune-relevance-target="endpointEmpty"]')).toHaveText(
      'You do not have any search endpoints shared with this case. Share the case with a team first.');
    await expect(page.locator('[data-tune-relevance-target="endpointSelect"] + .ts-wrapper')).toBeVisible();

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await stub(Array.from({ length: 12 }, (_, i) => ({ search_endpoint_id: 900000 + i, name: `Prod ${i}`, search_engine: 'solr' })));
    await page.reload();
    await openDrawer(page, 'engineSettings');
    await page.locator('.dev-header[data-tune-relevance-section-param="search"]').click();
    await expect(page.locator('[data-tune-relevance-target="endpointEmpty"]')).toBeHidden();
    const wrapper = page.locator('[data-tune-relevance-target="endpointSelect"] + .ts-wrapper');
    await wrapper.locator('.ts-control').click();
    await wrapper.locator('input').fill('prod');
    await expect(wrapper.locator('.option')).toHaveCount(12);
    await wrapper.locator('input').fill('Prod 3');
    await expect(wrapper.locator('.option')).toHaveText(['Prod 3']);
    await wrapper.locator('input').fill('zzz');
    await expect(wrapper.locator('.option')).toHaveCount(0);
    await expect(wrapper.locator('.no-results')).toBeVisible();
  });

  test('settings sections keep the Angular order, with help on Evaluate Nightly and Escape Queries', async ({ page }) => {
    const endpoint = await createEndpoint(page);
    const tryNo = await createTry(page, endpoint.id);
    await gotoTry(page, tryNo, 'engineSettings');
    const headers = page.locator('[data-tune-panel="engineSettings"] .dev-header');
    expect((await headers.allInnerTexts()).map(text => text.trim())).toEqual([
      'Endpoint Details', 'Displayed Fields', 'Number of Results to Show', 'Evaluate Nightly?', 'Escape Queries', 'Search Endpoints']);

    for (const [section, help] of [
      ['nightly', 'Run all the queries every night and store the results and the scores as a snapshot.'],
      ['escape', '(advanced) -- If your queries use Solr|Elasticsearch|OpenSearch query syntax (like text:law) then disable this feature']
    ]) {
      await page.locator(`.dev-header[data-tune-relevance-section-param="${section}"]`).click();
      await page.locator(`[data-section-body="${section}"] .setting-help`).hover();
      await expect(page.locator('.tooltip')).toHaveText(help);
      await page.mouse.move(0, 0);
      await expect(page.locator('.tooltip')).toHaveCount(0);
    }
  });

  test('history rows are shaded by search URL and list their knobs on hover', async ({ page }) => {
    const first = await createEndpoint(page);
    const second = await createEndpoint(page, { endpoint_url: 'http://tune.invalid/solr/other' });
    const knobbed = await page.request.post(`api/cases/${caseId}/tries`, {
      headers: await apiHeaders(page, { 'Content-Type': 'application/json' }),
      data: { try: { search_endpoint_id: first.id, query_params: 'q=#$query##&qf=title^##boost##', field_spec: 'id:id title:title' }, curator_vars: { boost: 3 } }
    });
    expect(knobbed.ok()).toBeTruthy();
    const knobbedTryNo = Number((await knobbed.json()).try_number);
    const otherTryNo = await createTry(page, second.id);
    await gotoTry(page, otherTryNo, 'history');

    const row = (tryNo: number) => historyRows(page).and(page.locator(`[data-try-no="${tryNo}"]`));
    const background = (tryNo: number) => row(tryNo).evaluate(element => getComputedStyle(element).backgroundColor);
    // The case's default Try 1 has no endpoint URL, so the three tries use three different shades.
    expect(new Set([await background(1), await background(knobbedTryNo), await background(otherTryNo)]).size).toBe(3);
    await row(knobbedTryNo).hover();
    expect(await background(knobbedTryNo)).not.toBe('rgb(85, 85, 85)');
    await expect(row(knobbedTryNo)).toHaveAttribute('title', 'http://tune.invalid/solr/select\nboost=3\n');
    await expect(row(otherTryNo)).toHaveAttribute('title', 'http://tune.invalid/solr/other\n');
  });

  test('a try on the other protocol keeps the case toolbar and explains the mismatch', async ({ page }) => {
    const endpoint = await createEndpoint(page, { endpoint_url: 'https://tune.invalid/solr/select' });
    const tryNo = await createTry(page, endpoint.id);
    await page.goto(`case/${caseId}/try/${tryNo}`);
    await expect(flash(page)).toContainText('Blocked Request: mixed-content');
    for (const action of ['Select scorer', 'Judgements', 'Clone', 'Export', 'Tune Relevance']) {
      await expect(page.getByRole('button', { name: action, exact: true }).or(page.getByRole('link', { name: action, exact: true })).first()).toBeVisible();
    }
    await openDrawer(page, 'engineSettings');
    await expect(page.locator('[data-tune-relevance-target="endpointName"]')).toHaveText(endpoint.name);
    await expect(page.locator('[data-tune-relevance-target="tlsExplanation"]')).toBeVisible();
    await expect(page.locator('[data-tune-relevance-target="tlsWarning"]')).toBeVisible();
    // Switching tabs keeps Reload in place of Rerun, and neither shows on tabs without Rerun.
    for (const [name, reload] of [['developer', true], ['curator', true], ['history', false], ['engineSettings', true]] as const) {
      await tab(page, name).click();
      await expect(page.locator('[data-tune-relevance-target="tlsWarning"]')).toBeVisible({ visible: reload });
      await expect(page.locator('#query-sandbox-action')).toBeHidden();
    }
  });

  test('a failed background evaluation is reported and the button recovers', async ({ page }) => {
    const endpoint = await createEndpoint(page);
    const tryNo = await createTry(page, endpoint.id);
    await page.route(`**/api/cases/${caseId}/run_evaluation**`, route => route.fulfill({ status: 500, json: { error: 'boom' } }));
    await gotoTry(page, tryNo, 'engineSettings');
    await page.locator('.dev-header[data-tune-relevance-section-param="nightly"]').click();
    const run = page.locator('[data-tune-relevance-target~="runEvaluation"]');
    await run.click();
    await expect(flash(page)).toContainText('Unable to queue evaluation.');
    await expect(run).toBeEnabled();
    await expect(run).toHaveText('Rerun My Searches Now in the Background!');
    await expect(page).toHaveURL(new RegExp(`/case/${caseId}/`));
  });
});

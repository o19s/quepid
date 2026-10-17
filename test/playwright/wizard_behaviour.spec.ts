import { test, expect, type Locator, type Page, type Route } from '@playwright/test';
import { apiHeaders, createDisposableCase, deleteCaseViaApi, resetCompletedCaseWizard } from './case_helpers';

/**
 * Behaviour of the case-creation wizard (Stimulus `wizard` controller, app/views/shared/_wizard_modal.html.erb)
 * against the running app. wizard_completion.spec.ts walks the happy path; this covers the rules around it:
 * validation and troubleshooting, engine-specific controls, mapper endpoints, static CSV import, field
 * suggestions, and Finish.
 *
 * Every test runs the wizard on a disposable case (Finish renames and fills the current case, so a shared one
 * would be corrupted) and creates any endpoint it needs through the API. A third-party search engine is
 * stubbed with `page.route` where a test needs a known response, since the wizard asks the browser to call
 * it directly. The one thing the live app cannot show is the instance-wide required-proxy policy, which is
 * server configuration: CoreControllerTest covers it.
 */

const ENGINE_URL = 'http://wizard.invalid/solr/tmdb/select';
const DISCOVERED_FIELDS = ['id', 'title', 'body', 'year', 'poster_path', 'cast'];

// The wizard asks the browser to call the engine directly, with credentials, so the stub answers CORS
// preflights and echoes the page's origin.
const cors = (route: Route) => ({
  'access-control-allow-origin': route.request().headers()['origin'] ?? '*',
  'access-control-allow-credentials': 'true',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*'
});

const solrResponse = {
  responseHeader: { status: 0, QTime: 1, params: {} },
  response: {
    numFound: 1, start: 0,
    docs: [{ id: '1', title: 'Star Wars', body: 'A long time ago', year: 1977, poster_path: '/sw.jpg', cast: 'Mark Hamill' }]
  }
};

test.describe('Case creation wizard behaviour', () => {
  let caseId: number;
  let draftDeleted: boolean;
  let endpointIds: number[];

  const modal = (page: Page) => page.locator('.modal.show').first();
  const wizard = (page: Page) => page.locator('#wizardModal');
  const field = (page: Page, name: string) => page.locator(`[data-wizard-target="${name}"]`);
  const when = (page: Page, state: string) => wizard(page).locator(`[data-wizard-when="${state}"]`);
  const next = (page: Page) => modal(page).getByRole('button', { name: /^Continue$/i }).filter({ visible: true });
  const engine = (page: Page, name: string) => wizard(page).locator(`input[name="wizardEngine"][value="${name}"]`).check({ force: true });
  const ping = (page: Page) => wizard(page).locator("button[data-wizard-target~='pingButton']").click();
  const alert = (page: Page) => wizard(page).locator('.alert:visible, [role="alert"]:visible');

  async function createEndpoint(page: Page, attrs: Record<string, unknown>): Promise<{ id: number; name: string }> {
    const name = `Playwright Wizard Endpoint ${Date.now()}-${endpointIds.length}`;
    const response = await page.request.post('api/search_endpoints', {
      headers: await apiHeaders(page, { 'Content-Type': 'application/json' }),
      data: { search_endpoint: { name, endpoint_url: ENGINE_URL, search_engine: 'solr', api_method: 'GET', ...attrs } }
    });
    expect(response.ok(), `endpoint create: ${response.status()}`).toBeTruthy();
    const created = await response.json();
    const id = Number(created.search_endpoint_id ?? created.id);
    endpointIds.push(id);
    expect(id).toBeGreaterThan(0);
    return { id, name };
  }

  /** Answers the stubbed engine for the browser, so no external search engine is involved. */
  async function stubEngine(page: Page, handler: (route: Route) => unknown = route => route.fulfill({
    json: solrResponse, headers: cors(route)
  })) {
    await page.route('http://wizard.invalid/**', handler);
  }

  /** Opens the wizard on the disposable case and moves from Welcome to the Endpoint step. */
  async function toEndpointStep(page: Page) {
    await page.goto(`case/${caseId}/try/1?showWizard=true`);
    await expect(modal(page)).toBeVisible({ timeout: 15_000 });
    await expect(modal(page).getByRole('heading', { name: /Welcome To Quepid/i })).toBeVisible({ timeout: 15_000 });
    await next(page).click();
    const name = modal(page).getByLabel('New Case Name:');
    await name.evaluate((el: HTMLElement) => el.focus());
    await name.fill(`Playwright Wizard Behaviour ${Date.now()}`, { force: true });
    await next(page).click();
    await expect(modal(page).getByRole('heading', { name: /What Search Endpoint/i })).toBeVisible({ timeout: 15_000 });
  }

  async function useStubbedSolr(page: Page) {
    await field(page, 'searchUrl').fill(ENGINE_URL);
    await page.locator('#wizardApiMethod').selectOption('GET');
  }

  async function toFieldsStep(page: Page) {
    await toEndpointStep(page);
    await useStubbedSolr(page);
    await next(page).click();
    await expect(modal(page).getByRole('heading', { name: /How Should We Display/i })).toBeVisible({ timeout: 20_000 });
  }

  async function chooseTitleAndId(page: Page) {
    await page.locator('#wizardTitleField').fill('title');
    await page.locator('#wizardIdField').fill('id');
  }

  async function addQueryAndFinish(page: Page, query = 'star wars') {
    await chooseTitleAndId(page);
    await next(page).click();
    await expect(modal(page).getByRole('heading', { name: /Add Your Search Queries/i })).toBeVisible();
    await modal(page).getByPlaceholder('Search query').fill(query);
    await modal(page).getByRole('button', { name: 'Add Query', exact: true }).click();
    await next(page).click();
    await expect(modal(page).getByRole('heading', { name: "That's It!" })).toBeVisible();
  }

  test.beforeEach(async ({ page }) => {
    caseId = await createDisposableCase(page, 'Wizard Behaviour');
    draftDeleted = false;
    endpointIds = [];
    await resetCompletedCaseWizard(page);
  });

  test.afterEach(async ({ page }) => {
    try {
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await page.goto('cases');
      if (!draftDeleted) await deleteCaseViaApi(page, caseId);
      for (const id of endpointIds) {
        const response = await page.request.delete(`api/search_endpoints/${id}`, { headers: await apiHeaders(page) });
        expect(response.ok(), `endpoint ${id} cleanup failed: ${response.status()}`).toBeTruthy();
      }
    } finally {
      await resetCompletedCaseWizard(page);
    }
  });

  test('pings without advancing, then continues to the discovered field choices', async ({ page }) => {
    await stubEngine(page);
    await toEndpointStep(page);
    await useStubbedSolr(page);
    await ping(page);
    await expect(wizard(page).locator('.alert-success:visible')).toBeVisible();
    await expect(modal(page).getByRole('heading', { name: /What Search Endpoint/i })).toBeVisible();

    await next(page).click();
    await expect(modal(page).getByRole('heading', { name: /How Should We Display/i })).toBeVisible({ timeout: 20_000 });
    const discovered = await page.locator('#wizardSearchFields option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value));
    expect(discovered.sort()).toEqual([...DISCOVERED_FIELDS].sort());
    await chooseTitleAndId(page);
    await next(page).click();
    await expect(modal(page).getByRole('heading', { name: /Add Your Search Queries/i })).toBeVisible();
  });

  for (const name of ['solr', 'es', 'os', 'searchapi']) {
    test(`shows ${name} troubleshooting on a connection failure and hides the proxy hints once proxying`, async ({ page }) => {
      await stubEngine(page, route => route.abort('failed'));
      await toEndpointStep(page);
      await engine(page, name);
      await field(page, 'searchUrl').fill(ENGINE_URL);
      await ping(page);

      const panel = wizard(page).locator('[data-wizard-when="url-invalid"]').first();
      await expect(panel).toBeVisible({ timeout: 20_000 });
      for (const other of ['solr', 'es', 'os', 'searchapi']) {
        await expect(panel.locator(`[data-wizard-when="${other}"]`)).toBeVisible({ visible: other === name });
      }
      const hints = panel.locator(`[data-wizard-when="${name}"] [data-wizard-when="no-proxy"]`);
      const proxy = page.locator('#wizardProxy');
      // The proxy hints show only while requests are not proxied (Search API starts out proxied).
      const proxiedAtStart = await proxy.isChecked();
      await expect(hints.first()).toBeVisible({ visible: !proxiedAtStart });
      if (name === 'solr') await page.locator('#wizardApiMethod').selectOption('GET'); // JSONP cannot be proxied
      await proxy.check({ force: true });
      await ping(page);
      await expect(panel).toBeVisible({ timeout: 30_000 });
      await expect(hints.filter({ visible: true })).toHaveCount(0);
    });
  }

  test('replaces connection troubleshooting with TLS guidance on a protocol mismatch', async ({ page }) => {
    await stubEngine(page, route => route.abort('failed'));
    await toEndpointStep(page);
    await field(page, 'searchUrl').fill(ENGINE_URL);
    await ping(page);
    await expect(wizard(page).locator('[data-wizard-when="url-invalid"]').first()).toBeVisible({ timeout: 20_000 });

    await field(page, 'searchUrl').fill('https://wizard.invalid/solr/select');
    await expect(field(page, 'tlsWarning')).toBeVisible();
    await expect(wizard(page).locator('[data-wizard-when="url-invalid"]').first()).toBeHidden();
    await expect(wizard(page).locator('[data-wizard-target~="endpointContinue"]')).toBeHidden();
  });

  test('offers Skip Validation only after a connection failure, and skipping moves on to the fields', async ({ page }) => {
    await stubEngine(page, route => route.abort('failed'));
    await toEndpointStep(page);
    await useStubbedSolr(page);
    const skip = field(page, 'skipButton');
    await expect(skip).toBeHidden();
    await ping(page);
    await expect(skip).toBeVisible({ timeout: 20_000 });
    await expect(when(page, 'mapper-invalid')).toBeHidden();
    await skip.click();
    await expect(modal(page).getByRole('heading', { name: /How Should We Display/i })).toBeVisible();
  });

  const WORKING_MAPPER = 'numberOfResultsMapper = function (data) { return data.results.length };\n'
    + 'docsMapper = function (data) { return data.results };';

  async function chooseExistingSearchApi(page: Page, endpoint: { name: string }) {
    await page.locator('#wizardEndpoint').selectOption({ label: endpoint.name });
    await page.locator('#wizardQueryParams').fill('q=#$query##');
  }

  test('stops on a mapper that fails on the API response, without offering Skip Validation', async ({ page }) => {
    const failing = await createEndpoint(page, {
      search_engine: 'searchapi', endpoint_url: 'http://wizard.invalid/api', test_query: 'star wars',
      mapper_code: 'numberOfResultsMapper = function (data) { return data.results.length };\ndocsMapper = function () { throw new Error("boom") };'
    });
    await stubEngine(page, route => route.fulfill({ json: { results: [{ id: '1', title: 'Star Wars' }] }, headers: cors(route) }));
    await toEndpointStep(page);
    await chooseExistingSearchApi(page, failing);
    await next(page).click();
    await expect(when(page, 'mapper-invalid')).toBeVisible({ timeout: 20_000 });
    await expect(field(page, 'mapperMessage')).toContainText('docsMapper');
    await expect(field(page, 'skipButton')).toBeHidden();
    await expect(modal(page).getByRole('heading', { name: /What Search Endpoint/i })).toBeVisible();
  });

  for (const [label, mapperCode, message] of [
    ['has no numberOfResultsMapper', 'docsMapper = function (data) { return data.results };', 'You need to define a "numberOfResultsMapper"'],
    ['has no docsMapper', 'numberOfResultsMapper = function (data) { return 1 };', 'You need to define a "docsMapper"'],
    ['is not valid JavaScript', 'this is not javascript', 'Mapper code evaluation failed']
  ] as const) {
    test(`rejects a mapper that ${label}`, async ({ page }) => {
      const broken = await createEndpoint(page, { search_engine: 'searchapi', endpoint_url: 'http://wizard.invalid/api', test_query: 'star wars', mapper_code: mapperCode });
      await stubEngine(page, route => route.fulfill({ json: { results: [{ id: '1', title: 'Star Wars' }] }, headers: cors(route) }));
      await toEndpointStep(page);
      await chooseExistingSearchApi(page, broken);
      await next(page).click();
      await expect(when(page, 'mapper-invalid')).toBeVisible({ timeout: 20_000 });
      await expect(field(page, 'mapperMessage')).toContainText(message);
      await expect(modal(page).getByRole('heading', { name: /What Search Endpoint/i })).toBeVisible();
    });
  }

  test('offers the fields a working mapper finds in the API response', async ({ page }) => {
    const working = await createEndpoint(page, { search_engine: 'searchapi', endpoint_url: 'http://wizard.invalid/api', test_query: 'star wars', mapper_code: WORKING_MAPPER });
    await stubEngine(page, route => route.fulfill({
      json: { results: [{ id: '1', title: 'Star Wars', body: 'A long time ago', year: 1977 }] }, headers: cors(route)
    }));
    await toEndpointStep(page);
    await chooseExistingSearchApi(page, working);
    await next(page).click();
    await expect(modal(page).getByRole('heading', { name: /How Should We Display/i })).toBeVisible({ timeout: 20_000 });
    const discovered = await page.locator('#wizardSearchFields option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value));
    expect(discovered.sort()).toEqual(['body', 'id', 'title', 'year']);
  });

  test('requires a mapper for a new generic API, but permits an existing endpoint', async ({ page }) => {
    const existing = await createEndpoint(page, { search_engine: 'searchapi', mapper_code: 'var nothing = 1', test_query: 'star wars' });
    await toEndpointStep(page);
    await engine(page, 'searchapi');
    await expect(when(page, 'mapper-required')).toBeVisible();
    await expect(wizard(page).locator('[data-wizard-target~="endpointContinue"]')).toBeHidden();
    await expect(wizard(page).locator("button[data-wizard-target~='pingButton']")).toBeVisible();

    await page.locator('#wizardEndpoint').selectOption({ label: existing.name });
    await expect(when(page, 'mapper-required')).toBeHidden();
    await expect(wizard(page).locator('[data-wizard-target~="endpointContinue"]')).toBeVisible();
  });

  test('requires a test query before continuing with an existing Search API endpoint', async ({ page }) => {
    const untested = await createEndpoint(page, { search_engine: 'searchapi', mapper_code: 'var nothing = 1', test_query: '' });
    await toEndpointStep(page);
    await page.locator('#wizardEndpoint').selectOption({ label: untested.name });
    const proceed = wizard(page).locator('[data-wizard-target~="endpointContinue"]');
    await expect(when(page, 'test-query-required')).toBeVisible();
    await expect(proceed).toBeDisabled();
    await expect(wizard(page).locator("button[data-wizard-target~='pingButton']")).toBeEnabled();
    await page.locator('#wizardTestQuery').fill('shirts');
    await expect(when(page, 'test-query-required')).toBeHidden();
    await expect(proceed).toBeEnabled();
  });

  test('fills a header template for the chosen type, and shows an existing endpoint\'s headers as Custom', async ({ page }) => {
    const keyed = await createEndpoint(page, { custom_headers: '{"X-Key":"1"}' });
    await toEndpointStep(page);
    const headers = field(page, 'customHeaders');
    await expect(page.locator('#wizardHeaderType')).toHaveValue('None');
    await expect(headers).toHaveJSProperty('readOnly', true);
    await page.locator('#wizardHeaderType').selectOption('API Key');
    await expect(headers).toHaveValue('{\n  "Authorization": "ApiKey XXX"\n}');
    await expect(headers).toHaveJSProperty('readOnly', false);
    await page.locator('#wizardHeaderType').selectOption('Custom');
    await expect(headers).toHaveValue('{\n "KEY": "VALUE"\n}');
    await page.locator('#wizardHeaderType').selectOption('None');
    await expect(headers).toHaveValue('');
    await expect(headers).toHaveJSProperty('readOnly', true);

    await page.locator('#wizardEndpoint').selectOption({ label: keyed.name });
    await expect(page.locator('#wizardHeaderType')).toHaveValue('Custom');
    await expect(headers).toHaveValue(/X-Key/);
    await expect(headers).toHaveJSProperty('readOnly', false);
  });

  test('submits the case name and adds a query on Enter', async ({ page }) => {
    await stubEngine(page);
    await page.goto(`case/${caseId}/try/1?showWizard=true`);
    await expect(modal(page).getByRole('heading', { name: /Welcome To Quepid/i })).toBeVisible({ timeout: 15_000 });
    await next(page).click();
    const name = modal(page).getByLabel('New Case Name:');
    await name.evaluate((el: HTMLElement) => el.focus());
    await name.fill('Enter test', { force: true });
    await name.press('Enter');
    await expect(modal(page).getByRole('heading', { name: /What Search Endpoint/i })).toBeVisible();
    await useStubbedSolr(page);
    await next(page).click();
    await expect(modal(page).getByRole('heading', { name: /How Should We Display/i })).toBeVisible({ timeout: 20_000 });
    await chooseTitleAndId(page);
    await next(page).click();
    const query = modal(page).getByPlaceholder('Search query');
    await query.fill('star wars');
    await query.press('Enter');
    await expect(modal(page).getByRole('heading', { name: /Add Your Search Queries/i })).toBeVisible();
    await expect(field(page, 'queryList')).toContainText('star wars');
  });

  test('deletes the draft case before opening the Mapper Wizard', async ({ page }) => {
    await toEndpointStep(page);
    await engine(page, 'searchapi');
    await wizard(page).locator('[data-action="wizard#goToMapperWizard"]').click();
    await expect(page).toHaveURL(/\/search_endpoints\/mapper_wizard/, { timeout: 20_000 });
    const response = await page.request.get(`api/cases/${caseId}`, { headers: await apiHeaders(page) });
    expect(response.ok()).toBe(false);
    draftDeleted = true;
  });

  test('keeps Continue disabled for a Static endpoint until its CSV is imported', async ({ page }) => {
    await toEndpointStep(page);
    await engine(page, 'static');
    const proceed = wizard(page).locator('[data-wizard-target~="endpointContinue"]');
    await expect(proceed).toBeDisabled();
    await expect(field(page, 'staticFile')).toBeVisible();
    await expect(field(page, 'searchUrl')).toBeHidden();

    await wizard(page).locator('input[type="file"]').setInputFiles({
      name: 'static.csv', mimeType: 'text/csv',
      buffer: Buffer.from('Query Text,Doc ID,Doc Position,title\nstar wars,1,1,Star Wars\n')
    });
    await expect(proceed).toBeEnabled({ timeout: 20_000 });
    const snapshots = await page.request.get(`api/cases/${caseId}/snapshots`, { headers: await apiHeaders(page) });
    expect((await snapshots.json()).snapshots).toHaveLength(1);
  });

  test('shows URL and auth guidance only for engines that support it, and warns about static sharing', async ({ page }) => {
    await createEndpoint(page, { search_engine: 'static', endpoint_url: 'http://wizard.invalid/api/cases/1/snapshots/1/search' });
    await toEndpointStep(page);
    await expect(when(page, 'static-endpoints')).toBeVisible();
    await expect(field(page, 'urlFormat')).toHaveText('http(s?)://yourdomain.com:8983/<index>/select');
    await expect(field(page, 'basicAuth')).toBeVisible();
    for (const name of ['algolia', 'vectara']) {
      await engine(page, name);
      await expect(field(page, 'basicAuth')).toBeHidden();
    }
    await engine(page, 'solr');
    await expect(field(page, 'basicAuth')).toBeVisible();
  });

  test('offers the API method only for Solr', async ({ page }) => {
    await toEndpointStep(page);
    const apiMethod = page.locator('#wizardApiMethod');
    await expect(apiMethod).toBeVisible();
    await expect(apiMethod.locator('option')).toHaveText(['JSONP', 'GET']);
    for (const name of ['es', 'os', 'vectara', 'algolia', 'searchapi']) {
      await engine(page, name);
      await expect(apiMethod, name).toBeHidden();
    }
    await engine(page, 'solr');
    await expect(apiMethod).toBeVisible();
  });

  test('fills the Solr curl command and troubleshooting links from the entered settings', async ({ page }) => {
    await toEndpointStep(page);
    await field(page, 'searchUrl').fill(ENGINE_URL);
    await field(page, 'basicAuth').fill('u:p');
    await page.locator('#wizardProxy').check({ force: true });
    await expect(field(page, 'curlAuth')).toHaveText('-u u:p ');
    await expect(field(page, 'endpointLink').first()).toHaveAttribute('href', /\/proxy\/fetch\?url=http:\/\/wizard\.invalid\/solr\/tmdb\/select$/);
    await expect(field(page, 'wikiLink').first()).toHaveAttribute('href', /^https?:\/\//);
  });

  test('adds a clicked discovered field once, and filters suggestions while preserving modifiers', async ({ page }) => {
    await stubEngine(page);
    await toFieldsStep(page);
    await chooseTitleAndId(page);
    const suggestions = field(page, 'fieldSuggestions');
    const items = suggestions.locator('> *');
    await expect(items).toHaveCount(4);
    expect((await items.allInnerTexts()).sort()).toEqual(['body', 'cast', 'poster_path', 'year']);
    const fields = page.locator('#wizardAdditionalFields');
    await items.filter({ hasText: /^year$/ }).click();
    await expect(fields).toHaveValue('year');
    await expect(suggestions).not.toContainText('year');

    await fields.focus();
    await fields.fill('cast, thumb:pos');
    await expect(suggestions).toHaveText('thumb:poster_path');
    await suggestions.locator('> *').first().click();
    await expect(fields).toHaveValue(/cast, thumb:poster_path/);
    await fields.fill('cast, thumb:poster_path, ');
    await expect(items).toHaveText(['body', 'year']);
    // Moving on to another field tidies the trailing separator.
    await page.locator('#wizardTitleField').fill('title');
    await expect(fields).toHaveValue('cast, thumb:poster_path');
  });

  test('keeps Finish disabled while queries and onboarding save, then closes the wizard', async ({ page }) => {
    await stubEngine(page);
    await toFieldsStep(page);
    await addQueryAndFinish(page);
    let release: () => void = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route(`**/api/bulk/cases/${caseId}/queries`, async route => { await gate; await route.continue(); });
    const finish = field(page, 'finishButton');
    await finish.click();
    await expect(finish).toBeDisabled();
    await expect(modal(page)).toBeVisible();
    release();
    await expect(page.locator('.modal.show')).toHaveCount(0, { timeout: 30_000 });
    await expect(page.getByText('star wars', { exact: false }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('keeps the wizard open after a failed query save, and Finish can retry', async ({ page }) => {
    await stubEngine(page);
    await toFieldsStep(page);
    await addQueryAndFinish(page);
    const failing = (route: Route) => route.fulfill({ status: 500, json: { error: 'query save failed' } });
    await page.route(`**/api/bulk/cases/${caseId}/queries`, failing);
    const finish = field(page, 'finishButton');
    await finish.click();
    await expect(alert(page).first()).toBeVisible({ timeout: 20_000 });
    await expect(finish).toBeEnabled();
    await expect(modal(page)).toBeVisible();

    await page.unroute(`**/api/bulk/cases/${caseId}/queries`, failing);
    await finish.click();
    await expect(page.locator('.modal.show')).toHaveCount(0, { timeout: 30_000 });
  });
});

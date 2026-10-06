import { test, expect } from '@playwright/test';
import { createServer, Server } from 'node:http';
import { apiHeaders } from './case_helpers';

let server: Server;
let judgeId: string | undefined;
let bookId: number | undefined;
let caseId: number | undefined;
let providerUrl: string;
let requests = 0;
let delay = 200;
let failProvider = false;
const name = `Book activity E2E ${Date.now()}`;

test.beforeAll(async () => {
  // Runs inside the existing app container, so the worker reaches this local
  // deterministic provider too. No external credentials or model are needed.
  server = createServer(async (req, res) => {
    for await (const _chunk of req) { /* consume request */ }
    requests++;
    await new Promise(resolve => setTimeout(resolve, delay));
    res.writeHead(failProvider ? 401 : 200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(failProvider ? { error: { message: 'Provider unavailable' } } : {
      choices: [{ message: { content: JSON.stringify({ judgment: 3, explanation: 'Fixture relevance' }) } }]
    }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing provider address');
  providerUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async ({ browser }) => {
  const context = await browser.newContext({ storageState: 'test/playwright/.auth/user.json' });
  const page = await context.newPage();
  const errors: unknown[] = [];
  const attempt = async (action: () => Promise<void>) => { try { await action(); } catch (error) { errors.push(error); } };
  try {
    await page.goto('books');
    const headers = await apiHeaders(page);
    if (bookId && judgeId) await attempt(async () => {
      const response = await page.request.patch(`books/${bookId}/cancel_judge_judy/${judgeId}`, { headers: { ...headers, Accept: 'text/html' } });
      expect(response.ok()).toBeTruthy();
    });
    // Drain the pending provider response before removing its persisted records.
    await new Promise(resolve => setTimeout(resolve, delay + 500));
    for (const url of [caseId && `api/cases/${caseId}`, bookId && `api/books/${bookId}`, judgeId && `ai_judges/${judgeId}`].filter(Boolean)) {
      await attempt(async () => {
        const response = await page.request.delete(url as string, { headers: { ...headers, Accept: String(url).startsWith('api/') ? 'application/json' : 'text/html' } });
        expect(response.ok()).toBeTruthy();
      });
    }
  } finally {
    await context.close();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
  if (errors.length) throw new AggregateError(errors, 'Book activity cleanup failed');
});

test('automatic judging, live activity, cancellation, synchronization and recovery', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('ai_judges/new');
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByRole('tab', { name: 'JSON', exact: true }).click();
  await page.locator('textarea[name="user[options]"]').fill(JSON.stringify({ judge_options: {
    llm_provider: 'ollama', llm_service_url: providerUrl, llm_model: 'fixture', llm_timeout: 20
  } }));
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForURL(/\/ai_judges\/\d+$/);
  judgeId = page.url().split('/').at(-1);
  const headers = await apiHeaders(page);
  const createdBook = await page.request.post('api/books', { headers, data: { book: { name } } });
  expect(createdBook.ok()).toBeTruthy();
  bookId = (await createdBook.json()).book_id;
  const createdCase = await page.request.post('api/cases', { headers, data: { case_name: name } });
  expect(createdCase.ok()).toBeTruthy();
  caseId = (await createdCase.json()).case_id;
  const query = await page.request.post(`api/cases/${caseId}/queries`, { headers, data: { query: { query_text: 'star wars' } } });
  expect(query.ok()).toBeTruthy();
  const linked = await page.request.put(`api/cases/${caseId}`, { headers, data: { book_id: bookId, auto_populate_case_judgements: true } });
  expect(linked.ok()).toBeTruthy();

  await page.goto(`books/${bookId}/edit`);
  await page.getByLabel('Rating Scale', { exact: true }).selectOption({ label: '0,1,2,3 (Poor, Fair...)' });
  await page.locator(`input[name="book[ai_judge_ids][]"][value="${judgeId}"]`).check();
  await page.locator(`#auto_run_${judgeId}`).check();
  await page.getByLabel('Rank Depth', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Update Book', exact: true }).click();
  await page.waitForURL(`**/books/${bookId}`);
  await page.goto(`books/${bookId}/edit`);
  await expect(page.locator(`#auto_run_${judgeId}`)).toBeChecked();
  await expect(page.getByLabel('Rank Depth', { exact: true })).toHaveValue('2');
  await page.goto(`books/${bookId}`);

  const populate = async (prefix: string, size: number) => {
    const response = await page.request.put(`api/books/${bookId}/populate`, { headers, data: {
      case_id: caseId, query_doc_pairs: Array.from({ length: size }, (_, i) => ({
        query_text: 'star wars', doc_id: `${prefix}-${i}`, position: i + 1, document_fields: { title: 'Star Wars' }
      }))
    } });
    expect(response.status()).toBe(204);
  };
  const count = page.locator(`#judge-count-${judgeId}`);
  await populate('auto', 3);
  await expect(count).toHaveText('2', { timeout: 20000 });
  const ratings = async () => (await (await page.request.get(`api/cases/${caseId}/queries`, { headers })).json()).queries[0].ratings;
  await expect.poll(async () => Object.keys(await ratings()).length).toBe(2);
  expect((await ratings())['auto-2']).toBeUndefined();
  await page.reload();
  await expect(count).toHaveText('2');
  await expect(page.locator(`#linked-cases-list a[href*="/case/${caseId}/"]`)).toBeVisible();

  // Save after disabling auto-run, then manually start a slow run and cancel it.
  await page.goto(`books/${bookId}/edit`);
  await page.locator(`#auto_run_${judgeId}`).uncheck();
  await page.getByLabel('Rank Depth', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Update Book', exact: true }).click();
  await page.waitForURL(`**/books/${bookId}`);
  await populate('cancel', 6);
  delay = 1200;
  const previousRequests = requests;
  await page.locator(`#judge-status-${judgeId} button[title="Judge documents"]`).click();
  const modal = page.locator(`#unleash_modal_${judgeId}`);
  await modal.getByLabel('Judge All Pairs', { exact: true }).check();
  await modal.getByRole('button', { name: 'Unleash the Kraken!!', exact: true }).click();
  await page.locator('#successModal').getByRole('button', { name: 'Close', exact: true }).click();
  await expect.poll(() => requests).toBeGreaterThan(previousRequests);
  await expect(page.locator(`#judge-status-${judgeId}`)).toHaveAttribute('data-actively-judging', 'true');
  page.once("dialog", dialog => dialog.accept());
  await page.locator(`#judge-status-${judgeId} button[title="Cancel judging"]`).click();
  await expect(page.getByText(/has been cancelled\./)).toBeVisible();
  await expect(page.locator(`#judge-status-${judgeId}`)).toHaveAttribute('data-actively-judging', 'false');
  await page.waitForTimeout(1800);
  const stoppedAt = await count.innerText();
  await page.waitForTimeout(1600);
  await expect(count).toHaveText(stoppedAt);
  expect(Number(stoppedAt)).toBeLessThan(9);

  // Human first activity is also pushed to an already-open overview.
  const overview = await page.context().newPage();
  await overview.goto(`books/${bookId}`);
  const me = await (await page.request.get('api/users/current', { headers })).json();
  const pairs = await (await page.request.get(`api/books/${bookId}/query_doc_pairs`, { headers })).json();
  const pair = (pairs.query_doc_pairs || pairs)[0];
  const pairId = pair.query_doc_pair_id || pair.id;
  const saved = await page.request.post(`books/${bookId}/judge/bulk/save`, { headers, data: { query_doc_pair_id: pairId, rating: 3 } });
  expect(saved.ok()).toBeTruthy();
  await expect(overview.locator(`#judge-count-${me.id}`)).toHaveText('1');
  await overview.close();

  // Provider failure retains unrateable evidence; another manual run recovers.
  delay = 100;
  failProvider = true;
  await page.request.patch(`books/${bookId}/run_judge_judy/${judgeId}`, { headers: { ...headers, Accept: 'text/html' }, data: { number_of_pairs: 1 } });
  await expect.poll(() => requests).toBeGreaterThan(previousRequests + 1);
  await page.goto(`books/${bookId}/judgements?filtered=true&unrateable=true`);
  await expect(page.locator('main')).toContainText('BOOM:', { timeout: 15000 });
  await page.goto(`books/${bookId}`);
  await expect(count).toHaveText(String(Number(stoppedAt) + 1));
  const ratingsBeforeRetry = Object.keys(await ratings()).length;
  failProvider = false;
  const retry = await page.request.patch(`books/${bookId}/run_judge_judy/${judgeId}`, { headers: { ...headers, Accept: 'text/html' }, data: { number_of_pairs: 1 } });
  expect(retry.ok()).toBeTruthy();
  await expect(count).toHaveText(String(Number(stoppedAt) + 2));
  await expect.poll(async () => Object.keys(await ratings()).length).toBeGreaterThan(ratingsBeforeRetry);
  await page.reload();
  await expect(count).toHaveText(String(Number(stoppedAt) + 2));
});

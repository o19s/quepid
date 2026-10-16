import { test, expect } from '@playwright/test';
import { createServer, Server } from 'node:http';
import { apiHeaders } from './case_helpers';

let server: Server;
let providerUrl: string;
let judgeId: string | undefined;
let bookId: number | undefined;
let mode = 'success';
let calls = 0;
let requestBody: any;
const name = `Provider E2E ${Date.now()}`;

test.beforeAll(async () => {
  server = createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    requestBody = JSON.parse(raw);
    calls++;
    res.setHeader('Content-Type', 'application/json');
    if (mode === 'error') { res.statusCode = 401; res.end('{"error":"Fixture key rejected"}'); return; }
    if (mode === 'refusal' && calls === 1) { res.statusCode = 529; res.end('{}'); return; }
    res.end(JSON.stringify({ model: 'jev-fixture', answers: { relevance: {
      type: 'score', score: 1.6, confidence: mode === 'low' ? 0.2 : 0.9,
      probabilities: { '0': 0.05, '1': 0.15, '2': 0.8 }
    } } }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No fixture provider address');
  providerUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async ({ browser }) => {
  const errors: unknown[] = [];
  const context = await browser.newContext({ storageState: 'test/playwright/.auth/user.json' });
  try {
    const page = await context.newPage();
    await page.goto('ai_judges');
    const headers = await apiHeaders(page);
    for (const url of [bookId && `api/books/${bookId}`, judgeId && `ai_judges/${judgeId}`].filter(Boolean)) {
      try {
        const result = await page.request.delete(url as string, { headers: { ...headers,
          Accept: String(url).startsWith('api/') ? 'application/json' : 'text/html' } });
        expect(result.ok()).toBeTruthy();
      } catch (error) { errors.push(error); }
    }
  } finally {
    await context.close();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
  if (errors.length) throw new AggregateError(errors, 'Provider fixture cleanup failed');
});

test('provider switching, image preference persistence, scale gating and Jev transport', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('ai_judges/new');
  await page.getByLabel('Name', { exact: true }).fill(name);
  const images = page.getByLabel('Judge with images');
  await expect(images).toBeChecked();
  await page.getByLabel('Llm Provider', { exact: true }).selectOption('typesafe_jev');
  await expect(images).toBeDisabled();
  await expect(images).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Run Prompt', exact: true })).toBeDisabled();
  await expect(page.locator('#judge_options_llm_model')).toHaveJSProperty('readOnly', true);
  await expect(page.getByLabel('Judging instructions')).toHaveValue(/Judge how well/);
  await page.getByRole('tab', { name: 'JSON', exact: true }).click();
  const jsonOptions = page.locator('textarea[name="user[options]"]');
  const jsonConfig = JSON.parse(await jsonOptions.inputValue());
  jsonConfig.judge_options.llm_provider = 'openai';
  await jsonOptions.fill(JSON.stringify(jsonConfig));
  await expect(page.getByRole('button', { name: 'Run Prompt', exact: true })).toBeEnabled();
  await jsonOptions.fill('{"judge_options":{"llm_provider":"openai"}}');
  await page.getByRole('tab', { name: 'Structured Fields', exact: true }).click();
  await expect(page.locator('#judge_options_llm_service_url')).toHaveValue('https://api.openai.com');
  await expect(page.locator('#judge_options_llm_model')).toHaveValue('gpt-4o');
  await expect(page.locator('#judge_options_llm_timeout')).toHaveValue('30');
  await page.getByRole('tab', { name: 'JSON', exact: true }).click();
  expect(JSON.parse(await jsonOptions.inputValue()).judge_options.llm_service_url).toBe('https://api.openai.com');
  jsonConfig.judge_options.llm_provider = 'typesafe_jev';
  await jsonOptions.fill(JSON.stringify(jsonConfig));
  await expect(page.getByRole('button', { name: 'Run Prompt', exact: true })).toBeDisabled();
  await page.getByRole('tab', { name: 'Structured Fields', exact: true }).click();
  await page.getByLabel('Minimum confidence', { exact: true }).fill('0.9');
  await page.getByRole('tab', { name: 'JSON', exact: true }).click();
  const withoutConfidence = JSON.parse(await jsonOptions.inputValue());
  delete withoutConfidence.judge_options.jev_min_confidence;
  await jsonOptions.fill(JSON.stringify(withoutConfidence));
  await page.getByRole('tab', { name: 'Structured Fields', exact: true }).click();
  await expect(page.getByLabel('Minimum confidence', { exact: true })).toHaveValue('');
  await page.getByRole('tab', { name: 'JSON', exact: true }).click();
  expect(JSON.parse(await jsonOptions.inputValue()).judge_options.jev_min_confidence).toBe('');
  await page.getByRole('tab', { name: 'Structured Fields', exact: true }).click();
  await page.getByLabel('Minimum confidence', { exact: true }).fill('0.5');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForURL(/\/ai_judges\/\d+$/);
  judgeId = page.url().split('/').at(-1);
  await page.reload();
  await expect(page.getByLabel('Minimum confidence', { exact: true })).toHaveValue('0.5');
  await page.getByLabel('Llm Provider', { exact: true }).selectOption('openai');
  await expect(images).toBeChecked();
  await images.uncheck();
  await page.getByLabel('Llm Provider', { exact: true }).selectOption('ollama');
  const saved = page.waitForResponse(r => r.url().endsWith(`/ai_judges/${judgeId}`) && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await saved).status()).toBe(303);
  await page.waitForLoadState('networkidle');
  await page.reload();
  await page.getByLabel('Llm Provider', { exact: true }).selectOption('openai');
  await expect(images).not.toBeChecked();

  const headers = await apiHeaders(page);
  const created = await page.request.post('api/books', { headers, data: { book: { name } } });
  expect(created.ok()).toBeTruthy();
  bookId = (await created.json()).book_id;
  await page.goto(`books/${bookId}/edit`);
  await page.getByLabel('Rating Scale', { exact: true }).selectOption({ label: '0,1,2,3 (Poor, Fair...)' });
  await page.getByRole('button', { name: 'Update Book', exact: true }).click();
  await page.waitForURL(`**/books/${bookId}`);
  await page.goto(`ai_judges/${judgeId}/edit?book_id=${bookId}`);
  await page.getByLabel('Llm Provider', { exact: true }).selectOption('typesafe_jev');
  await page.getByLabel('Minimum confidence', { exact: true }).fill('0.5');
  await page.getByRole('tab', { name: 'JSON', exact: true }).click();
  const options = page.locator('textarea[name="user[options]"]');
  const config = JSON.parse(await options.inputValue());
  config.judge_options.llm_service_url = providerUrl;
  await options.fill(JSON.stringify(config));
  await page.getByRole('tab', { name: 'Structured Fields', exact: true }).click();
  const run = page.getByRole('button', { name: 'Run Prompt', exact: true });
  await expect(run).toBeEnabled();
  const result = page.locator('[data-ai-judge-wizard-target="ratingInfo"]');
  await run.click();
  await expect(result).toContainText('Jev rated 2');
  expect(requestBody.questions.relevance.criteria).toHaveLength(4);
  expect(requestBody.state).not.toHaveProperty('messages');
  expect(requestBody.questions.relevance.instructions).toContain('Judge how well');
  mode = 'low';
  await run.click();
  await expect(page.locator('[data-ai-judge-wizard-target="unrateable"]')).toBeVisible();
  await expect(result).toContainText('confidence 0.2');
  mode = 'error';
  await run.click();
  await expect(result).toContainText('BOOM: Runtime Error: LLM API Error: 401');
  await expect(run).toBeEnabled();
  mode = 'refusal'; calls = 0;
  await run.click();
  await expect(result).toContainText('Jev rated 2');
  expect(calls).toBe(2);
  await page.reload();
  await expect(page.getByLabel('Llm Provider', { exact: true })).toHaveValue('ollama');
});

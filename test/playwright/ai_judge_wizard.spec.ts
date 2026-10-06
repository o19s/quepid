import { test, expect } from '@playwright/test';
import { apiHeaders } from './case_helpers';

let judgeId: string | undefined;
let bookId: number | undefined;
let caseId: number | undefined;
const name = `AI ownership E2E ${Date.now()}`;

test.afterAll(async ({ browser }) => {
  const context = await browser.newContext({ storageState: 'test/playwright/.auth/user.json' });
  const page = await context.newPage();
  const errors: unknown[] = [];
  try {
    await page.goto('ai_judges');
    const headers = await apiHeaders(page);
    try {
      if (!bookId) {
        const listing = await page.request.get('api/books?owned=true', { headers });
        expect(listing.ok()).toBeTruthy();
        bookId = (await listing.json()).all_books.find((book: { name: string }) => book.name === name)?.book_id;
      }
    } catch (error) { errors.push(error); }
    for (const url of [caseId && `api/cases/${caseId}`, bookId && `api/books/${bookId}`, judgeId && `ai_judges/${judgeId}`].filter(Boolean)) {
      try {
        const response = await page.request.delete(url as string, { headers: { ...headers, Accept: String(url).startsWith("ai_judges/") ? "text/html" : "application/json" } });
        expect(response.ok()).toBeTruthy();
      } catch (error) { errors.push(error); }
    }
  } finally { await context.close(); }
  if (errors.length) throw new AggregateError(errors, 'AI judge fixture cleanup failed');
});

test('tests drafts, handles errors, saves via Turbo, and selects owned books without teams', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('ai_judges/new');
  const failedSave = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/ai_judges'));
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await failedSave).status()).toBe(422);
  await expect(page.locator('main')).toContainText("Name can't be blank");
  await page.getByLabel('Name', { exact: true }).fill(name);
  await expect(page.locator('[data-ai-judge-wizard-target="step2"]')).toBeVisible();
  // Local provider is keyless; no remote LLM credentials are needed to save.
  await page.getByLabel('Llm Provider', { exact: true }).selectOption('ollama');
  await expect(page.getByLabel('Judge with images')).toBeDisabled();
  let fail = true;
  let testedOptions: Record<string, unknown> | undefined;
  await page.route('**/ai_judges/*/test_prompt**', async route => {
    testedOptions = route.request().postDataJSON().judge_options;
    await route.fulfill(fail ? { status: 422, json: { error: 'Provider unavailable' } } : { json: { rating: 0, explanation: 'Draft rating' } });
  });
  await page.getByRole('button', { name: 'Run Prompt', exact: true }).click();
  await expect(page.locator('[data-ai-judge-wizard-target="status"]')).toContainText('Provider unavailable');
  await expect(page.getByRole('button', { name: 'Run Prompt', exact: true })).toBeEnabled();
  await page.getByRole('tab', { name: 'JSON', exact: true }).click();
  await page.locator('textarea[name="user[options]"]').fill('{bad');
  await page.getByRole('button', { name: 'Run Prompt', exact: true }).click();
  await expect(page.locator('[data-ai-judge-wizard-target="status"]')).toContainText('Error:');
  const options = { llm_provider: 'ollama', llm_service_url: 'http://ollama:31434', llm_model: 'qwen3:0.6b', llm_timeout: 30, llm_include_images: false };
  await page.locator('textarea[name="user[options]"]').fill(JSON.stringify({ judge_options: options }));
  fail = false;
  await page.getByRole('button', { name: 'Run Prompt', exact: true }).click();
  await expect(page.locator('[data-ai-judge-wizard-target="ratingInfo"]')).toContainText('Draft rating');
  expect(testedOptions).toEqual(options);
  await page.locator('input[name="user[team_ids][]"][type=checkbox]').uncheck();
  const saved = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/ai_judges'));
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await saved).status()).toBe(303);
  await page.waitForURL(/\/ai_judges\/\d+$/);
  judgeId = page.url().split('/').at(-1);
  await page.reload();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue(name);
  await expect(page.getByLabel('Llm Provider', { exact: true })).toHaveValue('ollama');
  await page.getByLabel('System prompt').fill('Unsaved draft change');
  await page.getByRole('button', { name: 'Run Prompt', exact: true }).click();
  await expect(page.locator('[data-ai-judge-wizard-target="ratingInfo"]')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('System prompt')).not.toHaveValue('Unsaved draft change');
  await page.getByRole('link', { name: 'Back to AI Judges', exact: true }).click();
  await expect(page.locator('tr').filter({ hasText: name })).toContainText('You');

  const headers = await apiHeaders(page);
  const createdBook = await page.request.post('api/books', { headers, data: { book: { name } } });
  expect(createdBook.ok()).toBeTruthy();
  bookId = (await createdBook.json()).book_id;
  const createdCase = await page.request.post('api/cases', { headers, data: { case_name: name } });
  expect(createdCase.ok()).toBeTruthy();
  caseId = (await createdCase.json()).case_id;
  await page.goto(`books/${bookId}/edit`);
  await page.getByLabel('Rating Scale', { exact: true }).selectOption({ label: '0,1,2,3 (Poor, Fair...)' });
  await page.locator(`input[type=checkbox][value="${judgeId}"][name="book[ai_judge_ids][]"]`).check();
  await page.getByRole('button', { name: 'Update Book', exact: true }).click();
  await page.waitForURL(`**/books/${bookId}`);
  await page.goto(`books/${bookId}/edit`);
  await expect(page.locator(`input[type=checkbox][value="${judgeId}"][name="book[ai_judge_ids][]"]`)).toBeChecked();
  await expect(page.locator('main')).toContainText(name);
  await page.goto(`case/${caseId}`);
  await page.getByRole('link', { name: 'Judgements', exact: true }).click();
  const modal = page.locator('#judgementsModal');
  await expect(modal.locator('[data-judgements-core-target="bookPicker"]')).toBeVisible();
  await modal.locator('[data-judgements-core-target="item"]').filter({ hasText: name }).click();
  await modal.locator('[data-judgements-core-target="autoPopulateCaseJudgements"]').uncheck();
  await modal.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(modal).toBeHidden();
  const savedCase = await (await page.request.get(`api/cases/${caseId}`, { headers })).json();
  expect(savedCase.book_id).toBe(bookId);
  expect(savedCase.teams).toEqual([]);
  expect((await page.request.delete(`api/cases/${caseId}`, { headers })).ok()).toBeTruthy();
  caseId = undefined;
  expect((await page.request.delete(`api/books/${bookId}`, { headers })).ok()).toBeTruthy();
  bookId = undefined;
  await page.goto('ai_judges');
  await page.locator('tr').filter({ hasText: name }).getByRole('button', { name: 'Delete', exact: true }).click();
  const confirmation = page.locator('#confirmDeleteModal');
  await expect(confirmation).toContainText(name);
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(confirmation).toBeHidden();
  await page.locator('tr').filter({ hasText: name }).getByRole('button', { name: 'Delete', exact: true }).click();
  await confirmation.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.locator('tr').filter({ hasText: name })).toHaveCount(0);
  judgeId = undefined;
});

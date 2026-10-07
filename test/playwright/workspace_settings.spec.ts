import { test, expect } from '@playwright/test';
import { apiHeaders, deleteCaseViaApi } from './case_helpers';

const SOURCE_CASE_ID = Number(process.env.QUEPID_E2E_SOLR_CASE_ID || 6);

test.describe('Workspace tuning drafts and saved tries', () => {
  let caseId: number;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    try {
      await page.goto('cases');
      const sourceResponse = await page.request.get(`api/cases/${SOURCE_CASE_ID}`);
      expect(sourceResponse.ok()).toBeTruthy();
      const source = await sourceResponse.json();
      const response = await page.request.post('api/clone/cases', {
        headers: await apiHeaders(page),
        data: {
          case_id: SOURCE_CASE_ID,
          case_name: `Playwright Settings ${Date.now()}`,
          try_number: source.last_try_number,
          preserve_history: false,
          clone_queries: true,
          clone_ratings: true
        }
      });
      expect(response.ok()).toBeTruthy();
      caseId = Number((await response.json()).case_id);
    } finally {
      await page.close();
    }
  });

  test.afterAll(async ({ browser }) => {
    if (!caseId) return;
    const page = await browser.newPage();
    try {
      await page.goto('cases');
      await deleteCaseViaApi(page, caseId);
    } finally {
      await page.close();
    }
  });

  test('save failure/retry retains existing tuning, history and ancestry behavior', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto(`case/${caseId}/try/1`);
    await expect(page.locator('#case-actions')).toBeVisible();
    await page.getByRole('link', { name: 'Tune Relevance', exact: true }).click();
    const editor = page.locator('#query-params-editor .cm-content');
    const original = await editor.innerText();
    const draft = `${original}&testBoost=##draftBoost##`;
    await editor.fill(draft);
    await page.getByRole('button', { name: 'Tuning Knobs', exact: true }).click();
    await page.locator('[data-tune-relevance-target="curatorVars"] .slider-wrap')
      .filter({ hasText: /^draftBoost:$/ }).locator('input').fill('8');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const rows = page.locator('[data-tune-relevance-target="numberOfRows"]');
    await rows.fill('12');

    let submissions = 0;
    let submitted: any;
    await page.route(`**/api/cases/${caseId}/tries`, async route => {
      submissions++;
      submitted = route.request().postDataJSON();
      await new Promise(resolve => setTimeout(resolve, 300));
      await route.fulfill({ status: 503, json: { error: 'Settings save unavailable' } });
    });
    const save = page.locator('[data-tune-relevance-target~="saveButton"]');
    await save.click();
    await expect(save).toBeDisabled();
    // Exercise the handler guard as well as the disabled HTML button.
    await save.evaluate(button => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await expect(page.getByText('Settings save unavailable', { exact: true })).toBeVisible();
    expect(submissions).toBe(1);
    await expect(save).toBeEnabled();
    await expect(rows).toHaveValue('12');
    expect(page.url()).toContain(`/case/${caseId}/try/1`);
    await page.getByRole('button', { name: 'Query', exact: true }).click();
    await expect(editor).toHaveText(draft);

    await page.unroute(`**/api/cases/${caseId}/tries`);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await save.click();
    await page.waitForURL(new RegExp(`/case/${caseId}/try/2$`));
    await expect(page.locator('[data-tune-panel="engineSettings"]')).toBeVisible();
    await expect(rows).toHaveValue('12');
    await expect(page.locator('#case-header')).toContainText('Try 2');
    expect(submitted).toMatchObject({
      parent_try_number: 1,
      try: { query_params: draft, number_of_rows: '12' },
      curator_vars: { draftBoost: '8' }
    });
    const saved = await (await page.request.get(`api/cases/${caseId}/tries/2`)).json();
    expect(saved.query_params).toBe(draft);
    expect(saved.number_of_rows).toBe(12);
    expect(saved.curator_vars.draftBoost).toBe(8);
    await page.reload();
    await page.getByRole('link', { name: 'Tune Relevance', exact: true }).click();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(rows).toHaveValue('12');
    await expect(page.locator('#case-actions')).toBeVisible();
    await expect(page.locator('.results-list-element li').first()).toBeVisible();

    // History mutations retain the original reload behavior for unfinished form fields.
    await rows.fill('23');
    await page.getByRole('button', { name: 'History', exact: true }).click();
    const history = page.locator('[data-tune-relevance-target="historyList"]');
    const modal = page.locator('[data-tune-relevance-target="tryModal"]');
    const details = (tryNo: number) => history.locator(`[data-try-no="${tryNo}"] [data-try-details]`);
    await history.locator('[data-try-no="1"]').hover();
    await details(1).click();
    await modal.getByRole('button', { name: 'Rename', exact: true }).click();
    await modal.locator('[data-tune-relevance-target="tryNameInput"]').fill('Original settings');
    await modal.locator('button[type="submit"]').click();
    await expect(modal).toBeHidden();
    await expect(history).toContainText('Original settings');
    await history.locator('[data-try-no="1"]').hover();
    await details(1).click();
    await page.route(`**/api/clone/cases/${caseId}/tries/1`, route =>
      route.fulfill({ status: 503, json: { error: 'Unavailable' } }));
    await modal.getByRole('button', { name: 'Duplicate', exact: true }).click();
    await expect(page.getByText('Unable to duplicate try.', { exact: true })).toBeVisible();
    await expect(modal).toBeVisible();
    await page.unroute(`**/api/clone/cases/${caseId}/tries/1`);
    await modal.getByRole('button', { name: 'Duplicate', exact: true }).click();
    await expect(modal).toBeHidden();
    await expect(history.locator('.try-history-item')).toHaveCount(3);
    await history.locator('[data-try-no="3"]').hover();
    await details(3).click();
    page.once('dialog', dialog => dialog.accept());
    await modal.locator('[data-tune-relevance-target="tryDelete"]').click();
    await expect(modal).toBeHidden();
    await expect(history.locator('.try-history-item')).toHaveCount(2);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(rows).toHaveValue('12');

    await page.getByRole('button', { name: 'History', exact: true }).click();
    await history.locator('[data-try-no="1"] [data-try-name]').click();
    await page.waitForURL(new RegExp(`/case/${caseId}/try/1$`));
    await expect(page.locator('[data-tune-panel="history"]')).toBeVisible();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await rows.fill('15');
    const request = page.waitForRequest(req => req.url().endsWith(`/api/cases/${caseId}/tries`) && req.method() === 'POST');
    await page.locator('[data-tune-relevance-target~="saveButton"]').click();
    const payload = (await request).postDataJSON();
    expect(payload.parent_try_number).toBe(1);
    await page.waitForURL(new RegExp(`/case/${caseId}/try/3$`));
    await expect(rows).toHaveValue('15');
    await expect(page.locator('#case-header')).toContainText('Try 3');
    await page.getByRole('button', { name: 'History', exact: true }).click();
    await expect(history.locator('.try-history-item')).toHaveCount(3);
  });
});

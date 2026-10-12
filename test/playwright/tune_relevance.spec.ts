import { test, expect } from '@playwright/test';
import { createDisposableCase, deleteCaseViaApi } from './case_helpers';

const EDITABLE_CASE_ID = Number(process.env.QUEPID_E2E_EDITABLE_CASE_ID || 2);

test('query edits survive knob extraction and tab changes', async ({ page }) => {
  await page.goto(`case/${EDITABLE_CASE_ID}`);
  await page.getByRole('link', { name: 'Tune Relevance', exact: true }).click();
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
  await page.getByRole('link', { name: 'Tune Relevance', exact: true }).click();
  await expect(page.locator('[data-tune-relevance-target="endpointSelect"] option[value="987654"]')).toBeAttached();

  await page.locator('[data-tune-relevance-tab-param="engineSettings"]').click();
  // Search Endpoints, Evaluate Nightly and Escape Queries start collapsed, as they did in the Angular drawer.
  for (const section of ['search', 'nightly', 'escape']) {
    await expect(page.locator(`[data-tune-relevance-target="sectionBody"][data-section-body="${section}"]`)).toBeHidden();
  }
  await page.locator('.dev-header[data-tune-relevance-section-param="search"]').click();
  await page.locator('.dev-header[data-tune-relevance-section-param="nightly"]').click();

  // Choosing a suggestion only changes the unsaved settings, so nothing persists.
  await page.locator('[data-tune-relevance-target="endpointSearch"]').fill('Routing test');
  await page.locator('[data-tune-relevance-target="endpointSuggestions"] button').click();
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
      await page.getByRole('link', { name: 'Tune Relevance', exact: true }).click();
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

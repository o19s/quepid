import { test, expect } from '@playwright/test';

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

test('generated endpoint and history controls route through Stimulus', async ({ page }) => {
  await page.route(`**/api/cases/${EDITABLE_CASE_ID}/search_endpoints`, route => route.fulfill({
    json: { search_endpoints: [{ search_endpoint_id: 987654, name: 'Routing test endpoint', search_engine: 'solr' }] }
  }));
  await page.goto(`case/${EDITABLE_CASE_ID}`);
  await page.getByRole('link', { name: 'Tune Relevance', exact: true }).click();
  await expect(page.locator('[data-tune-relevance-target="historyList"] li').first()).toBeAttached();

  await expect(page.locator('[data-tune-relevance-target="endpointSelect"] option[value="987654"]')).toBeAttached();

  // Keep this routing check in the browser without saving endpoint changes or navigating away.
  await page.evaluate(() => {
    const root = document.querySelector('[data-controller="tune-relevance"]') as HTMLElement;
    const controller = (window as any).Stimulus.getControllerForElementAndIdentifier(root, 'tune-relevance');
    controller.selectEndpoint = (endpoint: { id: number }) => { root.dataset.selectedEndpoint = String(endpoint.id); };
    controller.capability.navigation.goToTry = (tryNo: number) => { root.dataset.navigatedTry = String(tryNo); };
    // Stimulus resolves action methods at dispatch time, so these stubs record
    // routing for handlers that would otherwise persist changes.
    const calls: string[] = (window as any).__tuneActionCalls = [];
    for (const name of ['save', 'updateNightly', 'runEvaluation', 'renameTry', 'duplicateTry', 'deleteTry']) {
      controller[name] = () => { calls.push(name); };
    }
  });
  const actionCalls = () => page.evaluate(() => (window as any).__tuneActionCalls);

  const root = page.locator('[data-controller="tune-relevance"]');
  await page.locator('[data-tune-relevance-tab-param="engineSettings"]').click();
  await page.locator('[data-tune-relevance-target="endpointSearch"]').fill('Routing test');
  await page.locator('[data-tune-relevance-target="endpointSuggestions"] button').click();
  await expect(root).toHaveAttribute('data-selected-endpoint', '987654');

  const fieldsHeader = page.locator('.dev-header[data-tune-relevance-section-param="fields"]');
  const fieldsBody = page.locator('[data-tune-relevance-target="sectionBody"][data-section-body="fields"]');
  await fieldsHeader.click();
  await expect(fieldsBody).toHaveClass(/d-none/);
  await fieldsHeader.click();
  await expect(fieldsBody).not.toHaveClass(/d-none/);
  await page.locator('[data-tune-relevance-target~="nightly"]').click();
  await page.locator('[data-tune-relevance-target~="runEvaluation"]').click();
  await page.locator('[data-tune-relevance-target~="saveButton"]').click();
  expect(await actionCalls()).toEqual(['updateNightly', 'runEvaluation', 'save']);

  await page.locator('[data-tune-relevance-tab-param="history"]').click();
  const row = page.locator('[data-tune-relevance-target="historyList"] li').first();
  const tryNo = await row.getAttribute('data-try-no');
  await row.locator('[data-try-name]').click();
  await expect(root).toHaveAttribute('data-navigated-try', tryNo!);
  await root.evaluate(element => { delete (element as HTMLElement).dataset.navigatedTry; });
  await row.hover();
  await row.locator('[data-try-details]').click();
  const modal = page.locator('[data-tune-relevance-target="tryModal"]');
  await expect(modal).toBeVisible();
  await expect(root).not.toHaveAttribute('data-navigated-try');

  // Dispatch clicks directly: the try-details backdrop issue is tracked separately.
  const renameAction = modal.locator('[data-tune-relevance-target="tryRenameAction"]');
  const renameForm = modal.locator('[data-tune-relevance-target="tryRenameForm"]');
  await renameAction.dispatchEvent('click');
  // Assert the toggled state: the form's d-flex class overrides [hidden] (logged in docs/todo/todo.md).
  await expect(renameForm).toHaveJSProperty('hidden', false);
  await expect(renameAction).toHaveText('Cancel Rename');
  const url = page.url();
  await modal.locator('[data-tune-relevance-target="tryNameInput"]').fill('Routing test name');
  await renameForm.locator('button[type="submit"]').dispatchEvent('click');
  await modal.getByRole('button', { name: 'Duplicate' }).dispatchEvent('click');
  await modal.locator('[data-tune-relevance-target="tryDelete"]').evaluate(button => {
    (button as HTMLButtonElement).disabled = false;
    button.click();
  });
  expect(await actionCalls()).toEqual(['updateNightly', 'runEvaluation', 'save', 'renameTry', 'duplicateTry', 'deleteTry']);
  expect(page.url()).toBe(url);
  await renameAction.dispatchEvent('click');
  await expect(renameForm).toHaveJSProperty('hidden', true);
  await expect(renameAction).toHaveText('Rename');
});

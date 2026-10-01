import { test, expect } from '@playwright/test';

const EDITABLE_CASE_ID = Number(process.env.QUEPID_E2E_EDITABLE_CASE_ID || 2);

test('query edits survive knob extraction and tab changes', async ({ page }) => {
  await page.goto(`case/${EDITABLE_CASE_ID}`);
  await page.getByRole('link', { name: 'Tune Relevance', exact: true }).click();
  const editor = page.locator('#query-params-editor .cm-content');
  const template = '{"query":{"multi_match":{"query":"#$query##","fields":["title^##titleBoost##"]}}}';
  await editor.fill(template);
  await expect(editor).toHaveText(template);
  await page.locator('[data-tune-tab="curator"]').click();
  await expect(page.locator('[data-tune-relevance-target="curatorVars"]')).toContainText('titleBoost');
  await page.locator('[data-tune-relevance-target="curatorVars"] input').fill('8');
  await page.locator('[data-tune-tab="developer"]').click();
  await expect(editor).toHaveText(template);
  await page.locator('[data-tune-tab="curator"]').click();
  await expect(page.locator('[data-tune-relevance-target="curatorVars"] input')).toHaveValue('8');
});

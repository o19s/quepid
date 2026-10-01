import { test, expect } from '@playwright/test';

test('scorer presets and custom scale inputs update labels', async ({ page }) => {
  await page.goto('scorers/new');
  const scale = page.locator('[data-scorer-scale-target="scaleList"]');
  const labels = page.locator('[data-scorer-scale-target="scaleLabels"] input');
  await page.locator('#scale-binary').check();
  await expect(scale).toHaveValue('0,1');
  await expect(labels).toHaveCount(2);
  await page.locator('#scale-graded').check();
  await expect(scale).toHaveValue('0,1,2,3');
  await expect(labels).toHaveCount(4);
  await page.locator('#scale-custom').check();
  await expect(scale).toHaveValue('');
  await scale.fill('0,5,10');
  await expect(labels).toHaveCount(3);
  await expect(labels.nth(1)).toHaveAttribute('name', 'scorer[scale_with_labels][5]');
});

test('book guidelines swap defaults and preserve custom text', async ({ page }) => {
  await page.goto('books/new');
  const root = page.locator('[data-controller="scoring-guidelines"]');
  const lengths = JSON.parse((await root.getAttribute('data-scoring-guidelines-scale-lengths-value'))!);
  const two = Object.keys(lengths).find(id => lengths[id] === 2);
  const four = Object.keys(lengths).find(id => lengths[id] === 4);
  expect(two).toBeTruthy();
  expect(four).toBeTruthy();
  const select = root.locator('[data-scoring-guidelines-target="scorerSelect"]');
  const textarea = root.locator('[data-scoring-guidelines-target="textarea"]');
  const twoText = (await root.getAttribute('data-scoring-guidelines-two-point-value'))!;
  const fourText = (await root.getAttribute('data-scoring-guidelines-four-point-value'))!;
  await textarea.fill('');
  await select.selectOption(two!);
  await expect(textarea).toHaveValue(twoText);
  await select.selectOption(four!);
  await expect(textarea).toHaveValue(fourText);
  await textarea.fill('Custom judge instructions');
  await select.selectOption(two!);
  await expect(textarea).toHaveValue('Custom judge instructions');
});

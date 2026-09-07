import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/** Set MIGRATION_SHOT_PHASE=before|after (default after). */
const PHASE = process.env.MIGRATION_SHOT_PHASE === 'before' ? 'before' : 'after';
const CASE_ID = Number(process.env.QUEPID_E2E_CASE_ID || 5);
const outDir = path.join(__dirname, '../../.playwright-mcp');

async function gotoCase(page: import('@playwright/test').Page) {
  await page.goto(`case/${CASE_ID}`);
  await page.waitForSelector('.results-list-element li, .modal.show', { timeout: 20_000 });
}

async function expandFirstQuery(page: import('@playwright/test').Page) {
  if ((await page.locator('search-result').count()) > 0) return;
  await page.locator('.results-list-element li .toggleSign, .results-list-element li [ng-click*="toggle"]').first().click();
  await page.waitForSelector('search-result', { timeout: 15_000 });
}

async function shot(page: import('@playwright/test').Page, stem: string) {
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `migration-${stem}-${PHASE}.png`);
  await page.screenshot({ path: file, fullPage: false, mask: [page.locator('#flash-messages')] });
  console.log(`wrote ${file}`);
}

async function openHelpPopover(page: import('@playwright/test').Page, modal: import('@playwright/test').Locator) {
  const help = modal.locator('.bi-question-circle-fill').first();
  await help.scrollIntoViewIfNeeded();
  const popoverBody = page.locator('.popover.show .popover-body, .popover-body').first();

  // After: bs-static-popover (hover). Before: quepid-popover + mouseenter → BS5 hover focus.
  await help.hover({ force: true });
  try {
    await expect(popoverBody).toBeVisible({ timeout: 2_000 });
  } catch {
    await help.focus();
    try {
      await expect(popoverBody).toBeVisible({ timeout: 2_000 });
    } catch {
      await help.evaluate((el) => {
        const bs = (window as Window & { bootstrap?: { Popover: { getInstance: (e: Element) => { show: () => void } | null; new (e: Element): { show: () => void } } } }).bootstrap;
        if (!bs?.Popover) return;
        const inst = bs.Popover.getInstance(el) ?? new bs.Popover(el);
        inst.show();
      });
    }
  }
  await expect(popoverBody).toBeVisible({ timeout: 8_000 });
}

test.describe(`DOM migration shots (${PHASE})`, () => {
  test('hit count', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await gotoCase(page);
    await expandFirstQuery(page);
    await shot(page, 'hit-count');
  });

  test('clone-case popover', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await gotoCase(page);
    await page.locator('clone-case a').click();
    const modal = page.locator('.modal.show').first();
    await expect(modal).toBeVisible();
    await page.setViewportSize({ width: 900, height: 760 });
    await openHelpPopover(page, modal);
    await shot(page, 'clone-case-popover');
  });

  test('judgements popover', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await gotoCase(page);
    await page.locator('judgements a').click();
    const modal = page.locator('.modal.show').first();
    await expect(modal).toBeVisible();
    await page.setViewportSize({ width: 900, height: 820 });
    await openHelpPopover(page, modal);
    await shot(page, 'judgements-popover');
  });

  test('import-ratings popover', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await gotoCase(page);
    await page.locator('import-ratings a').click();
    const modal = page.locator('.modal.show').first();
    await expect(modal).toBeVisible();
    await page.setViewportSize({ width: 900, height: 900 });
    await openHelpPopover(page, modal);
    await shot(page, 'import-ratings-popover');
  });

  test('annotation timeAgo', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoCase(page);
    await page.getByText('Tune Relevance', { exact: false }).click();
    await page.locator('#annotationsTab').click();
    if ((await page.locator('.annotations-time').count()) === 0) {
      await page.locator('#annotations textarea, annotations textarea').first().fill('Migration screenshot annotation');
      await page.getByRole('button', { name: 'Create', exact: true }).click();
    }
    await expect(page.locator('.annotations-time').first()).toBeVisible({ timeout: 10_000 });
    await shot(page, 'annotation-timeago');
  });
});

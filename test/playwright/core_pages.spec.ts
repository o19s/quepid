import { test, expect } from '@playwright/test';
import {
  expandFirstQuery,
  gotoCase,
  headerDropdownMenu,
  resetCompletedCaseWizard,
} from './case_helpers';

/**
 * One focused tour per major core-layout surface. Each spec loads the
 * page, then exercises modal, dropdown, popover, and form-field focus (same
 * case shell), asserting each step is really visible or focused — a net for
 * BS5 popover/tooltip/modal regressions (see CLAUDE.md trap #5).
 *
 * Pixel baselines for these states live in `visual_smoke.spec.ts` (`yarn test:visual`).
 * Narrow 768×900 subset: `core_pages_narrow_viewport.spec.ts` (Playwright project `chromium-narrow`).
 */

test.describe('Core pages — interaction tour', () => {
  test('cases list — header case picker & filters', async ({ page }) => {
    await gotoCase(page);
    await expandFirstQuery(page);

    await page.locator('#header').getByRole('button', { name: /Relevancy Cases/i }).click();
    const relevancyMenu = headerDropdownMenu(page, 'Relevancy Cases');
    await expect(relevancyMenu).toBeVisible();

    await page.keyboard.press('Escape');

    await page.locator('#queries-filter').focus();
    await expect(page.locator('#queries-filter')).toBeFocused();

    await page.locator('#header').getByRole('button', { name: /Books/i }).click();
    const booksMenu = headerDropdownMenu(page, 'Books');
    await expect(booksMenu).toBeVisible();
    await expect(booksMenu).toContainText('RECENT BOOKS');

    await page.keyboard.press('Escape');

    await page.getByText('Share case', { exact: true }).click();
    await expect(page.locator('.modal.show')).toContainText(/Share Case/i);

    await page.locator('.modal.show').locator('.btn-close').click();
    await expect(page.locator('.modal.show')).toHaveCount(0);

    await page.locator('search-result .single-rating').first().click();
    await expect(page.locator('.popover, [class*="popover"]').first()).toBeVisible({ timeout: 5_000 });
  });

  test('query editor — options & explain modals, notes field', async ({ page }) => {
    await gotoCase(page);
    await expandFirstQuery(page);

    await page.getByRole('button', { name: 'Set Options', exact: true }).first().click();
    await expect(page.locator('.modal.show')).toContainText('Query Options');

    await page.locator('.modal.show').getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.locator('.modal.show')).toHaveCount(0);

    await page.getByRole('button', { name: 'Explain Query', exact: true }).first().click();
    await expect(page.locator('#query-explain-tab-params')).toBeVisible();

    await page.locator('.modal.show').locator('.btn-close').first().click();
    await expect(page.locator('.modal.show')).toHaveCount(0);

    await page.getByRole('button', { name: 'Toggle Notes', exact: true }).first().click();
    const notes = page.locator('textarea[data-query-notes-target="notes"]:visible').first();
    await notes.focus();
    await expect(notes).toBeFocused();

    await page.locator('search-result .single-rating').first().click();
    await expect(page.locator('.popover, [class*="popover"]').first()).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');

    await page.locator('#header').getByRole('button', { name: /Relevancy Cases/i }).click();
    await expect(headerDropdownMenu(page, 'Relevancy Cases')).toBeVisible();
  });

  test('rating UI — judgement popover & snapshot modal', async ({ page }) => {
    await gotoCase(page);
    await expandFirstQuery(page);

    await page.locator('#header').getByRole('button', { name: /Relevancy Cases/i }).click();
    await expect(headerDropdownMenu(page, 'Relevancy Cases')).toBeVisible();
    await page.keyboard.press('Escape');

    await page.locator('search-result .single-rating').first().click();
    await expect(page.locator('.popover, [class*="popover"]').first()).toBeVisible({ timeout: 5_000 });

    await page.keyboard.press('Escape');

    await page.locator('a[data-bs-target="#takeSnapshotModal"]').click();
    await expect(page.locator('#takeSnapshotModal.show')).toBeVisible({ timeout: 5_000 });

    const snapshotModal = page.locator('#takeSnapshotModal.show');
    await snapshotModal.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.locator('.modal.show')).toHaveCount(0);

    await page.locator('#queries-filter').focus();
    await expect(page.locator('#queries-filter')).toBeFocused();
  });

  test('scorer config — select scorer modal', async ({ page }) => {
    await gotoCase(page);
    await expandFirstQuery(page);

    await page.locator('a[data-bs-target="#pickScorerModal"]').click();
    await expect(page.locator('#pickScorerModal.show')).toContainText(/How would you like to score/i);

    const picker = page.locator('#pickScorerModal.show');
    const firstScorer = picker.locator('.list-group-item').first();
    await firstScorer.click();
    await expect(firstScorer).toHaveClass(/\bactive\b/);

    await picker.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.locator('.modal.show')).toHaveCount(0);

    await page.locator('search-result .single-rating').first().click();
    await expect(page.locator('.popover, [class*="popover"]').first()).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');

    await page.locator('#header').getByRole('button', { name: /Books/i }).click();
    await expect(headerDropdownMenu(page, 'Books')).toBeVisible();
    await page.keyboard.press('Escape');

    await page.locator('#queries-filter').focus();
    await expect(page.locator('#queries-filter')).toBeFocused();
  });

  test('wizard — welcome, name, endpoint steps', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('cases');
    await resetCompletedCaseWizard(page);
    await gotoCase(page, 'showWizard=true');
    const modal = page.locator('.modal.show').first();
    const continueButton = modal.getByRole('button', { name: /^Continue$/i }).filter({ visible: true });
    // Steps stay hidden until the wizard has loaded; wait for a real heading, not just the modal.
    await expect(modal.getByRole('heading', { name: /Welcome To Quepid/i })).toBeVisible({ timeout: 15_000 });
    // The modal can be ready before the case behind it has loaded; wait so the backdrop is stable.
    await expect(page.locator('.results-list-element li').first()).toBeVisible({ timeout: 20_000 });

    await continueButton.click();
    await expect(modal.getByRole('heading', { name: /Name Your Case/i })).toBeVisible();

    const nameInput = modal.getByLabel('New Case Name:');
    await nameInput.focus();
    await expect(nameInput).toBeFocused();

    await nameInput.fill('Playwright wizard tour');
    await continueButton.click();
    await expect(modal.getByRole('heading', { name: /What Search Endpoint/i })).toBeVisible({ timeout: 15_000 });

    // Don't close the wizard: the ✕ and Cancel both offer to delete the case, and CASE_ID is
    // the shared fixture most specs use. Reloading the case page below dismisses it without finishing.
    await gotoCase(page);
    await expandFirstQuery(page);

    await page.locator('#header').getByRole('button', { name: /Relevancy Cases/i }).click();
    await expect(headerDropdownMenu(page, 'Relevancy Cases')).toBeVisible();
    await page.keyboard.press('Escape');

    await page.locator('search-result .single-rating').first().click();
    await expect(page.locator('.popover, [class*="popover"]').first()).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');

    await page.getByText('Share case', { exact: true }).click();
    await expect(page.locator('.modal.show')).toContainText(/Share Case/i);
    await page.locator('.modal.show').locator('.btn-close').click();
    await expect(page.locator('.modal.show')).toHaveCount(0);

    await page.locator('#queries-filter').focus();
    await expect(page.locator('#queries-filter')).toBeFocused();
  });
});

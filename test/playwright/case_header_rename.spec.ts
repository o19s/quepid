import { test, expect, type Page } from '@playwright/test';

/**
 * E2E coverage for the server-rendered case header.
 *
 * The header (case name, try name, badges, scorer) moved out of the Angular
 * `queriesLayout.html` template into `app/views/core/_case_header.html.erb`,
 * rendered inside a `case_header` Turbo Frame served by
 * `Core::CaseHeaderController`. Rename is a Rails round trip that re-renders
 * the frame rather than an Angular `$http` call driving a digest.
 *
 * What only an end-to-end test can catch here is the bridging, since the
 * things that must stay in step live *outside* the frame: the toolbar's modal
 * trigger attributes, and the Angular caseSvc/settingsSvc models that the rest
 * of the still-Angular page reads. Vitest covers the controllers in isolation.
 *
 * Uses disposable cases created via the API (same pattern as
 * case_shell_navigation.spec.ts) so it never touches shared fixture data.
 */

async function apiHeaders(page: Page) {
  const csrf = await page.evaluate(() =>
    document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? ''
  );
  return { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-Token': csrf };
}

async function createDisposableCase(page: Page): Promise<number> {
  await page.goto('cases');
  await page.waitForSelector('body', { timeout: 15_000 });

  const response = await page.request.post('api/cases', {
    data: { case_name: `Playwright Header Scratch ${Date.now()}` },
    headers: await apiHeaders(page)
  });
  expect(response.ok()).toBeTruthy();
  const json = await response.json();
  const caseId = Number(json.case_id);
  expect(caseId).toBeGreaterThan(0);
  return caseId;
}

async function deleteCaseViaApi(page: Page, caseId: number) {
  await page.request.delete(`api/cases/${caseId}`, { headers: await apiHeaders(page) });
}

/** Waits until Angular has actually selected the case; the toolbar is gated on it. */
async function gotoLoadedCase(page: Page, caseId: number) {
  await page.goto(`case/${caseId}/try/1`);
  await expect(page.locator('#case-actions .col-sm-12')).toBeVisible({ timeout: 20_000 });
}

const caseDisplay = '[data-case-rename-target="caseDisplay"]';
const tryDisplay = '[data-case-rename-target="tryDisplay"]';

test.describe('core case header: rename (server-rendered Turbo Frame)', () => {
  let caseId: number;

  test.beforeEach(async ({ page }) => {
    caseId = await createDisposableCase(page);
  });

  test.afterEach(async ({ page }) => {
    if (caseId) await deleteCaseViaApi(page, caseId);
  });

  test('renames the case in place and propagates it outside the frame', async ({ page }) => {
    await gotoLoadedCase(page, caseId);

    const newName = `Renamed Case ${Date.now()}`;
    await page.locator('[data-action="dblclick->case-rename#editCase"]').dblclick();
    await page.locator('[data-case-rename-target="caseInput"]').fill(newName);
    await page.locator('[data-case-rename-target="caseSubmit"]').click();

    await expect(page.locator(caseDisplay)).toHaveText(newName, { timeout: 15_000 });

    // The toolbar sits outside the frame and carries no copy of the name: each modal reads it
    // live from the header when it opens. Prove that end to end rather than trusting the DOM.
    await page.locator('a[data-controller="share-case-core"]').click();
    await expect(page.locator('#shareCaseModal.show')).toContainText(`Share Case: ${newName}`, {
      timeout: 15_000
    });
    await page.locator('#shareCaseModal [data-bs-dismiss="modal"]').first().click();
    await expect(page.locator('#shareCaseModal.show')).toBeHidden({ timeout: 10_000 });

    // Angular still owns the recent-cases dropdown, which refreshes off caseSvc.
    // Poll rather than sample once: this is an event bridge dispatched on
    // turbo:frame-render, so it is eventually consistent by design.
    await expect.poll(async () => page.evaluate(() => {
      const el = (window as any).angular.element(document.querySelector('[ng-controller="MainCtrl"]'));
      return el.injector().get('caseSvc').getSelectedCase().caseName;
    }), { timeout: 15_000 }).toBe(newName);

    await page.reload();
    await expect(page.locator(caseDisplay)).toHaveText(newName, { timeout: 20_000 });
  });

  test('renames the try and labels it the way the client factory did', async ({ page }) => {
    await gotoLoadedCase(page, caseId);

    // A name that does not already mention its try number gets it appended,
    // matching formattedName() in TryFactory.js.
    await page.locator('[data-action="dblclick->case-rename#editTry"]').dblclick();
    await page.locator('[data-case-rename-target="tryInput"]').fill('Baseline');
    await page.locator('[data-case-rename-target="trySubmit"]').click();

    await expect(page.locator(tryDisplay)).toHaveText('Baseline - Try 1', { timeout: 15_000 });

    // Same bridge, and settingsSvc may still be loading its tries when the frame
    // first re-renders, in which case the bridge no-ops and retries on the next one.
    await expect.poll(async () => page.evaluate(() => {
      const el = (window as any).angular.element(document.querySelector('[ng-controller="MainCtrl"]'));
      return el.injector().get('settingsSvc').applicableSettings().name;
    }), { timeout: 15_000 }).toBe('Baseline');
  });

  test('keeps Rename disabled for a blank name and restores on cancel', async ({ page }) => {
    await gotoLoadedCase(page, caseId);

    const original = (await page.locator(caseDisplay).textContent())?.trim();

    await page.locator('[data-action="dblclick->case-rename#editCase"]').dblclick();
    const input = page.locator('[data-case-rename-target="caseInput"]');

    await input.fill('   ');
    await expect(page.locator('[data-case-rename-target="caseSubmit"]')).toBeDisabled();

    await input.fill('abandoned edit');
    await page.locator('[data-action="case-rename#cancelCase"]').click();

    await expect(page.locator('[data-case-rename-target="caseForm"]')).toHaveClass(/d-none/);
    await expect(page.locator(caseDisplay)).toHaveText(original ?? '');
  });
});

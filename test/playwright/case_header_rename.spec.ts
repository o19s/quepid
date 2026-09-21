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

/**
 * The header renders server-side, so anything it shows goes stale unless something tells the
 * frame to refetch. Rename has its own bridge (above); these are the *other* fields, each of
 * which was found stale by hand rather than by a test:
 *
 *   - scorer  -- picking a scorer saved to the database and rescored, but the header kept
 *                showing the previous scorer until a full page reload.
 *   - nightly -- toggling "Evaluate Nightly" in the Tune Relevance drawer left the header's
 *                repeat icon showing the old state.
 *
 * Both are the same defect: a control outside the frame mutates state the frame rendered.
 * `_case_header.html.erb` documents the contract (dispatch `quepid:case-header-stale`); this
 * covers it end to end, since the failure is in the wiring between Angular, Stimulus and Turbo
 * and unit tests on either side cannot see it.
 */
test.describe('core case header: stays in step with changes made outside the frame', () => {
  let caseId: number;

  test.beforeEach(async ({ page }) => {
    caseId = await createDisposableCase(page);
  });

  test.afterEach(async ({ page }) => {
    if (caseId) await deleteCaseViaApi(page, caseId);
  });

  test('shows the new scorer as soon as one is picked, without a reload', async ({ page }) => {
    await gotoLoadedCase(page, caseId);

    const scorerLabel = page.locator('[data-case-header-scorer]');
    const before = (await scorerLabel.textContent())?.trim();

    await page.locator('#case-actions').getByText('Select scorer').click();
    const modal = page.locator('#pickScorerModal.show');
    await expect(modal).toBeVisible({ timeout: 15_000 });

    // Any communal scorer other than the one already applied.
    const option = modal.locator('li, .list-group-item, label, tr')
      .filter({ hasText: /^(nDCG@10|AP@10|P@10|DCG@10)$/ })
      .filter({ hasNotText: before ?? '\u0000' })
      .first();
    const chosen = (await option.textContent())?.trim();
    await option.click();
    await modal.getByRole('button', { name: /Select Scorer/i }).click();

    await expect(modal).toBeHidden({ timeout: 15_000 });
    // No reload between the save and this assertion -- that is the whole point.
    await expect(scorerLabel).toHaveText(chosen ?? '', { timeout: 15_000 });
  });

  test('updates the nightly indicator when it is toggled in the drawer', async ({ page }) => {
    await gotoLoadedCase(page, caseId);

    const icon = page.locator('#case_header .bi-repeat');
    const shownBefore = await icon.count();

    await page.locator('#case-actions').getByText('Tune Relevance').click();
    await page.locator('#engineTab').click();
    await page.getByText('Evaluate Nightly?').click();

    const checkbox = page.locator('#evaluate-nightly-checkbox');
    await expect(checkbox).toBeVisible({ timeout: 15_000 });
    await checkbox.click();

    // Toggling off removes the icon; toggling on adds it. Assert against whichever
    // direction this case started in rather than assuming a default.
    await expect(icon).toHaveCount(shownBefore === 0 ? 1 : 0, { timeout: 15_000 });

    await checkbox.click();
    await expect(icon).toHaveCount(shownBefore, { timeout: 15_000 });
  });
});

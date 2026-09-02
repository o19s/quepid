import { test, expect, type Page } from '@playwright/test';
import { dynamicRegions } from './angular_case_helpers';

/**
 * Full case-creation wizard (`WizardModalCtrl` /
 * app/assets/templates/views/wizardModal.html), run start to finish.
 *
 * angular_pages.spec.ts and angular_pages_narrow_viewport.spec.ts both stop
 * partway through this same wizard — after opening the "Create a new
 * Search Endpoint" accordion on the Endpoint step — purely to screenshot
 * that state; neither finishes it. This spec instead walks every step
 * (Welcome -> Name -> Endpoint -> Fields -> Query -> Finish) with real
 * input and confirms the wizard's `submit()` actually renamed the case and
 * persisted a query, landing back on that case's page once the modal
 * closes.
 *
 * We do NOT run this against an existing fixture case (e.g. case id 1,
 * which other specs share): the wizard's Finish step renames the
 * *current* case and adds queries to it in place (WizardModalCtrl#submit
 * -> caseSvc.renameCase + queriesSvc.persistQueries), so completing it on
 * a shared case would corrupt other tests' fixtures. Instead we first
 * create a disposable case via the header's "Create a case" button (same
 * caseSvc.createCase() the wizard's own "New Case" affordance uses), run
 * the wizard against that, then delete it via the API afterward.
 *
 * The Endpoint step is driven through "Use an existing Search Endpoint" ->
 * the seeded "TMDB Solr" endpoint (a real, publicly reachable o19s demo
 * Solr instance already used as this account's default case data) rather
 * than "Create a new Search Endpoint", since the latter's validation
 * requires the wizard's default demo URL to be reachable from wherever the
 * browser runs and is already covered (unfinished) by the existing specs.
 */

async function apiHeaders(page: Page) {
  const csrf = await page.evaluate(() =>
    document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? ''
  );
  return { Accept: 'application/json', 'X-CSRF-Token': csrf };
}

/**
 * Creates a disposable case the same way the header's "Create a case"
 * button does (caseSvc.createCase() -> POST api/cases), but via the API
 * directly rather than clicking through an existing case page first — case
 * id 1 (and other shared fixture cases) can be slow/flaky to render in
 * this environment (a known, separately-tracked issue; see
 * core_smoke.spec.ts), and we don't want that to block getting a fresh,
 * safe-to-mutate case id here.
 */
async function createDisposableCase(page: Page): Promise<number> {
  await page.goto('cases');
  await page.waitForSelector('body', { timeout: 15_000 });

  const response = await page.request.post('api/cases', {
    data: { case_name: `Playwright Wizard Scratch ${Date.now()}` },
    headers: await apiHeaders(page)
  });
  expect(response.ok()).toBeTruthy();
  const json = await response.json();
  const caseId = Number(json.case_id);
  expect(caseId).toBeGreaterThan(0);
  return caseId;
}

async function deleteCase(page: Page, caseId: number) {
  const response = await page.request.delete(`api/cases/${caseId}`, { headers: await apiHeaders(page) });
  expect(response.ok()).toBeTruthy();
}

test.describe('Case creation wizard', () => {
  test('runs every step and lands back on the newly created case', async ({ page }) => {
    const caseId = await createDisposableCase(page);
    const caseName = `Playwright Wizard Case ${Date.now()}`;

    try {
      // Navigate with an explicit /try/1/ segment rather than the bare
      // `case/:id?showWizard=true` form other (unfinished) wizard specs use:
      // without it, caseTryNavSvc never learns a try number (it stays NaN)
      // even though the page renders "Try 1" from the API response, and the
      // wizard's Finish step later 404s ("Try not found!") PATCHing
      // `api/cases/:id/tries/NaN`. This is how real navigation always
      // reaches a case (case-list clicks and caseSvc.createCase() both
      // build `/case/:id/try/:tryNo/` paths), so it sidesteps what looks
      // like a preexisting bug in the bare-URL path without masking it.
      await page.goto(`case/${caseId}/try/1?showWizard=true`);
      const modal = page.locator('.modal.show').first();
      await expect(modal).toBeVisible({ timeout: 15_000 });

      const continueButton = () => modal.getByRole('button', { name: /^Continue$/i }).filter({ visible: true });

      // The Welcome step only shows up sometimes (depends on this user's
      // wizard-seen state); skip it if present rather than requiring it.
      if (await modal.getByRole('heading', { name: /Welcome To Quepid/i }).isVisible().catch(() => false)) {
        await continueButton().click();
      }

      // --- Name step ---
      await expect(modal).toContainText('Name Your Case');
      const nameInput = modal.locator('input[ng-model="pendingWizardSettings.caseName"]');
      await nameInput.evaluate((el: HTMLElement) => el.focus());
      await nameInput.fill(caseName, { force: true });
      await continueButton().click();

      // --- Endpoint step: use the existing, real "TMDB Solr" endpoint ---
      await expect(modal.getByRole('heading', { name: /What Search Endpoint/i })).toBeVisible({ timeout: 15_000 });
      await modal.getByRole('button', { name: 'Use an existing Search Endpoint' }).click();
      await modal.locator('#searchEndpoint').selectOption({ label: 'TMDB Solr' });
      // validate() makes a real search request to confirm the endpoint works
      // before advancing — give it real network time.
      await continueButton().click();

      // --- Fields step: defaults ("title"/"id") are pre-filled from the
      // chosen endpoint's settings, so just continue. ---
      await expect(modal.getByRole('heading', { name: /How Should We Display Your Results/i })).toBeVisible({
        timeout: 20_000
      });
      await continueButton().click();

      // --- Query step ---
      await expect(modal.getByRole('heading', { name: /Add Your Search Queries/i })).toBeVisible({ timeout: 10_000 });
      const queryInput = modal.locator('input[ng-model="pendingWizardSettings.text"]');
      await queryInput.fill('star wars');
      await modal.getByRole('button', { name: 'Add Query', exact: true }).click();
      await expect(modal.getByText('star wars')).toBeVisible();
      await continueButton().click();

      // --- Finish step ---
      await expect(modal.getByRole('heading', { name: "That's It!" })).toBeVisible({ timeout: 10_000 });
      await modal.getByRole('button', { name: 'Finish', exact: true }).click();

      // submit() PATCHes settings, renames the case, persists the query,
      // then closes the modal — give the real network round trip room.
      await expect(modal.locator('.alert-danger')).toHaveCount(0, { timeout: 30_000 });
      await expect(page.locator('.modal.show')).toHaveCount(0, { timeout: 30_000 });
      await expect(page.getByRole('heading', { name: new RegExp(caseName) })).toBeVisible({ timeout: 10_000 });
      await expect(page).toHaveScreenshot('wizard-completed-case.png', {
        mask: dynamicRegions(page),
        maxDiffPixelRatio: 0.05
      });

      // The query we added during the wizard was persisted onto this case.
      await expect(page.getByText('star wars', { exact: false }).first()).toBeVisible({ timeout: 15_000 });
    } finally {
      await deleteCase(page, caseId);
    }
  });
});

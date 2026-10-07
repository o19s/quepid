import { test, expect } from '@playwright/test';
import { createDisposableCase, deleteCaseViaApi, dynamicRegions, resetCompletedCaseWizard } from './case_helpers';

/**
 * Full case-creation wizard (Stimulus `wizard` controller /
 * app/views/shared/_wizard_modal.html.erb), run start to finish.
 *
 * core_pages.spec.ts and core_pages_narrow_viewport.spec.ts both stop
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
 * *current* case and adds queries to it in place (wizard_controller#finish
 * -> the case runtime + query lifecycle persistence contract), so completing it on
 * a shared case would corrupt other tests' fixtures. Instead we first
 * create a disposable case via the API, run
 * the wizard against that, then delete it via the API afterward.
 *
 * The Endpoint step is driven through "Use an existing Search Endpoint" ->
 * the seeded "TMDB Solr" endpoint (a real, publicly reachable o19s demo
 * Solr instance already used as this account's default case data) rather
 * than "Create a new Search Endpoint", since the latter's validation
 * requires the wizard's default demo URL to be reachable from wherever the
 * browser runs and is already covered (unfinished) by the existing specs.
 */

/**
 * Creates a disposable case via POST api/cases rather than clicking through
 * directly rather than clicking through an existing case page first — case
 * id 1 (and other shared fixture cases) can be slow/flaky to render in
 * this environment (a known, separately-tracked issue; see
 * core_smoke.spec.ts), and we don't want that to block getting a fresh,
 * safe-to-mutate case id here.
 */
test.describe('Case creation wizard', () => {
  test('runs every step and lands back on the newly created case', async ({ page }) => {
    const caseId = await createDisposableCase(page, 'Wizard');
    // A previous run that timed out never reached its cleanup, leaving the flag set and the
    // Welcome step skipped; start from the same first-time state every time.
    await resetCompletedCaseWizard(page);
    const caseName = `Playwright Wizard Case ${Date.now()}`;

    try {
      // Navigate with an explicit /try/1/ segment rather than the bare
      // `case/:id?showWizard=true` form other (unfinished) wizard specs use:
      // Without the explicit try segment, the bare URL does not provide the
      // try number needed by the wizard's Finish step. Real navigation also
      // reaches a case through this `/case/:id/try/:tryNo/` shape.
      await page.goto(`case/${caseId}/try/1?showWizard=true`);
      const modal = page.locator('.modal.show').first();
      await expect(modal).toBeVisible({ timeout: 15_000 });

      const continueButton = () => modal.getByRole('button', { name: /^Continue$/i }).filter({ visible: true });

      // --- Welcome step: steps stay hidden until the wizard has loaded, so wait for it. ---
      await expect(modal.getByRole('heading', { name: /Welcome To Quepid/i })).toBeVisible({ timeout: 15_000 });
      await continueButton().click();

      // --- Name step ---
      await expect(modal.getByRole('heading', { name: /Name Your Case/i })).toBeVisible();
      const nameInput = modal.getByLabel('New Case Name:');
      await nameInput.evaluate((el: HTMLElement) => el.focus());
      await nameInput.fill(caseName, { force: true });
      await continueButton().click();

      // --- Endpoint step: use the existing, real "TMDB Solr" endpoint ---
      await expect(modal.getByRole('heading', { name: /What Search Endpoint/i })).toBeVisible({ timeout: 15_000 });
      await modal.getByLabel('Use an existing Search Endpoint').selectOption({ label: 'TMDB Solr' });
      // validate() makes a real search request to confirm the endpoint works
      // before advancing — give it real network time.
      await continueButton().click();

      // --- Fields step: defaults ("title"/"id") are pre-filled from the
      // chosen endpoint's settings, so just continue. ---
      await expect(modal.getByRole('heading', { name: /How Should We Display Your Results/i })).toBeVisible({
        timeout: 20_000
      });
      await modal.getByLabel('Title Field').fill('title');
      await modal.getByLabel('ID Field').fill('id');
      await continueButton().click();

      // --- Query step ---
      await expect(modal.getByRole('heading', { name: /Add Your Search Queries/i })).toBeVisible({ timeout: 10_000 });
      const queryInput = modal.getByPlaceholder('Search query');
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
      // Nested try/finally so a deleteCase failure (e.g. a transient API
      // error) can't skip resetCompletedCaseWizard -- these are independent
      // cleanups and a failure in one shouldn't leave the other undone.
      try {
        // Let the page's own score write land first: deleting mid-write fails the
        // case_scores foreign key and returns a 500.
        await page.waitForLoadState('networkidle').catch(() => {});
        await deleteCaseViaApi(page, caseId);
      } finally {
        await resetCompletedCaseWizard(page);
      }
    }
  });
});

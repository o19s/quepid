import { test, expect, type Page } from '@playwright/test';

/**
 * End-to-end coverage for two core-case-toolbar Stimulus controllers that
 * previously had only mocked Vitest unit coverage:
 *
 *  - `delete-case-options-core`: URL-template -> `submitDestructiveForm` ->
 *    real `DELETE /cases/:id` / `DELETE /cases/:id/queries`. The Vitest spec
 *    for this controller mocks `submitDestructiveForm` itself, so the actual
 *    hidden-form-post -> Rails redirect wiring was never exercised together.
 *    `cases_controller_test.rb` already covers ownership scoping at the
 *    controller level; what's missing is the click-through.
 *  - `clone-case-core`: toolbar trigger -> modal -> `POST api/clone_cases`
 *    -> navigation to the new case.
 *
 * Both destructive flows run against a disposable case created via the API
 * (same pattern as wizard_completion.spec.ts) so they never touch shared
 * fixture data.
 */

async function apiHeaders(page: Page) {
  const csrf = await page.evaluate(() =>
    document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? ''
  );
  return { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-Token': csrf };
}

async function createDisposableCase(page: Page, label: string): Promise<number> {
  await page.goto('cases');
  await page.waitForSelector('body', { timeout: 15_000 });

  const response = await page.request.post('api/cases', {
    data: { case_name: `Playwright ${label} Scratch ${Date.now()}` },
    headers: await apiHeaders(page)
  });
  expect(response.ok()).toBeTruthy();
  const json = await response.json();
  const caseId = Number(json.case_id);
  expect(caseId).toBeGreaterThan(0);
  return caseId;
}

async function addQuery(page: Page, caseId: number, queryText: string) {
  const response = await page.request.post(`api/cases/${caseId}/queries`, {
    data: { query: { query_text: queryText } },
    headers: await apiHeaders(page)
  });
  expect(response.ok()).toBeTruthy();
}

async function fetchQueryCount(page: Page, caseId: number): Promise<number> {
  const response = await page.request.get(`api/cases/${caseId}/queries`, { headers: await apiHeaders(page) });
  expect(response.ok()).toBeTruthy();
  const json = await response.json();
  return Array.isArray(json.queries) ? json.queries.length : 0;
}

async function caseExists(page: Page, caseId: number): Promise<boolean> {
  const response = await page.request.get(`api/cases/${caseId}`, { headers: await apiHeaders(page) });
  return response.ok();
}

async function deleteCaseViaApi(page: Page, caseId: number) {
  await page.request.delete(`api/cases/${caseId}`, { headers: await apiHeaders(page) });
}

async function gotoCase(page: Page, caseId: number) {
  await page.goto(`case/${caseId}/try/1`);
  await page.waitForSelector('#case-actions', { timeout: 20_000 });
}

test.describe('core case toolbar: delete-case-options-core (submitDestructiveForm wiring)', () => {
  test('"Delete All Queries" removes queries but keeps the case', async ({ page }) => {
    const caseId = await createDisposableCase(page, 'Delete-Queries');

    try {
      await addQuery(page, caseId, 'star wars');
      await addQuery(page, caseId, 'moana');
      expect(await fetchQueryCount(page, caseId)).toBe(2);

      await gotoCase(page, caseId);
      await page.locator('#case-actions').getByRole('link', { name: 'Delete', exact: true }).click();

      const modal = page.locator('#deleteCaseOptionsModal.show, .modal.show').first();
      await expect(modal).toContainText(/Delete Options for Case/i);

      await modal.getByRole('button', { name: 'Delete All Queries' }).click();
      const confirmButton = modal.locator('[data-delete-case-options-core-target="submitButton"]');
      await expect(confirmButton).toBeEnabled();
      await confirmButton.click();

      // submitDestructiveForm posts a real hidden form -> full navigation.
      await page.waitForURL(/\/case\//, { timeout: 15_000 });
      expect(await fetchQueryCount(page, caseId)).toBe(0);
      expect(await caseExists(page, caseId)).toBeTruthy();
    } finally {
      await deleteCaseViaApi(page, caseId);
    }
  });

  test('"Delete Case" permanently deletes the case and redirects to the cases listing', async ({ page }) => {
    const caseId = await createDisposableCase(page, 'Delete-Case');
    let deletedByUi = false;

    try {
      await gotoCase(page, caseId);
      await page.locator('#case-actions').getByRole('link', { name: 'Delete', exact: true }).click();

      const modal = page.locator('#deleteCaseOptionsModal.show, .modal.show').first();
      await expect(modal).toContainText(/Delete Options for Case/i);

      await modal.getByRole('button', { name: 'Delete Case' }).click();
      const confirmButton = modal.locator('[data-delete-case-options-core-target="submitButton"]');
      await expect(confirmButton).toBeEnabled();
      await confirmButton.click();

      await page.waitForURL(/\/cases(\?.*)?$/, { timeout: 15_000 });
      deletedByUi = true;
      expect(await caseExists(page, caseId)).toBeFalsy();
    } finally {
      // Only fall back to API cleanup if the UI flow itself didn't already
      // delete the case -- deleting twice is harmless but this keeps intent
      // clear: the assertion above is what actually proves the feature works.
      if (!deletedByUi) await deleteCaseViaApi(page, caseId);
    }
  });
});

test.describe('core case toolbar: clone-case-core', () => {
  test('cloning a case creates a new case and navigates to it', async ({ page }) => {
    const sourceCaseId = await createDisposableCase(page, 'Clone-Source');
    let clonedCaseId: number | null = null;

    try {
      await addQuery(page, sourceCaseId, 'star wars');

      await gotoCase(page, sourceCaseId);
      await page.locator('#case-actions').getByRole('link', { name: 'Clone', exact: true }).click();

      const modal = page.locator('#cloneCaseModal.show, .modal.show').first();
      await expect(modal).toContainText(/Clone case/i);

      const newCaseName = `Playwright Clone Target ${Date.now()}`;
      await modal.locator('#cloneCaseName').fill(newCaseName);
      await expect(modal.locator('[data-clone-case-core-target="submitButton"]')).toBeEnabled();
      await modal.locator('[data-clone-case-core-target="submitButton"]').click();

      await expect(modal.locator('.alert-success')).toContainText('cloned', { timeout: 10_000 });

      // clone-case-core navigates via window.location.href after a short
      // delay rather than a form post -- wait for the real redirect, not
      // just any /case/ URL (we're already on one: the source case).
      await page.waitForURL((url) => /\/case\/\d+\//.test(url.pathname) && !url.pathname.includes(`/case/${sourceCaseId}/`), {
        timeout: 15_000
      });

      const match = page.url().match(/\/case\/(\d+)\//);
      expect(match).not.toBeNull();
      clonedCaseId = Number(match![1]);
      expect(clonedCaseId).toBeGreaterThan(0);
      expect(await caseExists(page, clonedCaseId)).toBeTruthy();
      expect(await fetchQueryCount(page, clonedCaseId)).toBe(1);
    } finally {
      await deleteCaseViaApi(page, sourceCaseId);
      if (clonedCaseId) await deleteCaseViaApi(page, clonedCaseId);
    }
  });
});

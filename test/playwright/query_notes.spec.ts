import { test, expect } from '@playwright/test';
import { gotoCase, expandFirstQuery } from './angular_case_helpers';

/**
 * Regression coverage for saving a query's Information Need / Notes when the save FAILS.
 *
 * This exists because the failure path was silently broken and no automated test noticed:
 * `queriesSvc#saveNotes` handled the rejection by *returning* the response, which resolves the
 * promise in `$q`, so `QueryNotesCtrl` ran its success branch on a failed save -- flashing
 * "Success! Your query details have been saved.", collapsing the panel, and discarding whatever
 * the user had typed. The controller's error callback was already written; it simply could never
 * fire. Found by hand via the manual-testing script (scenario 4.16), which is precisely the kind
 * of thing that should not need finding twice.
 *
 * The second test covers a bug found while writing the first: the panel renders editable before
 * its own GET resolves, and the late response overwrote whatever had been typed in the meantime.
 *
 * Neither test writes anything -- the save is stubbed to fail, and the clobber test never saves --
 * so both can run against the shared fixture case without mutating it.
 */
test.describe('query notes: failed save', () => {
  test('reports the failure and keeps the unsaved edits', async ({ page }) => {
    await gotoCase(page);
    await expandFirstQuery(page);

    // Force the save to fail. Scoped to the notes endpoint so the rest of the page
    // (searching, scoring) keeps working normally.
    await page.route('**/api/cases/*/queries/*/notes', async (route) => {
      if (route.request().method() === 'PUT') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: '{"error":"forced by query_notes.spec.ts"}'
        });
      }
      return route.continue();
    });

    // Let the panel's own GET settle first so this test is only about the failed PUT; the
    // in-flight-fetch race is the next test's subject.
    const loaded = page.waitForResponse((r) => /\/notes$/.test(r.url()) && r.request().method() === 'GET');
    await page.getByRole('button', { name: 'Toggle Notes', exact: true }).first().click();
    await loaded;

    const notes = page.locator('textarea:visible').first();
    await expect(notes).toBeVisible({ timeout: 15_000 });

    const typed = `unsaved edit ${Date.now()}`;
    await notes.fill(typed);
    await page.getByRole('button', { name: /^Save$/ }).first().click();

    // The three things that were wrong: wrong message, panel closed, edits gone.
    await expect(page.locator('.alert, [role="alert"]').filter({ hasText: /Could not save/i }))
      .toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.alert, [role="alert"]').filter({ hasText: /have been saved/i }))
      .toHaveCount(0);
    await expect(notes).toBeVisible();
    await expect(notes).toHaveValue(typed);
  });

  test('does not let its own slow fetch overwrite what you are typing', async ({ page }) => {
    await gotoCase(page);
    await expandFirstQuery(page);

    // Hold the panel's GET open so typing definitely happens while it is in flight.
    await page.route('**/api/cases/*/queries/*/notes', async (route) => {
      if (route.request().method() === 'GET') {
        await new Promise((resolve) => setTimeout(resolve, 2_000));
      }
      return route.continue();
    });

    await page.getByRole('button', { name: 'Toggle Notes', exact: true }).first().click();

    const notes = page.locator('textarea:visible').first();
    await expect(notes).toBeVisible({ timeout: 15_000 });

    const typed = `typed while loading ${Date.now()}`;
    await notes.fill(typed);

    // Wait past the held response: the value must still be what was typed, not what came back.
    await page.waitForTimeout(3_000);
    await expect(notes).toHaveValue(typed);
  });
});

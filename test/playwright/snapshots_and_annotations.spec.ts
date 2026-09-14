import { test, expect, type Page } from '@playwright/test';

/**
 * Behavioral (non-visual) coverage for snapshots and annotations on the
 * Angular case UI. dom_migration_screenshots.spec.ts already screenshot-diffs
 * the annotation timeAgo display, but nothing previously asserted that a
 * snapshot actually gets created/listed, or exercised annotation creation.
 *
 * These use a case with a *working* search endpoint and existing queries
 * (case 5, "10s of Queries" in the shared dev DB) rather than the suite's
 * default CASE_ID (1, "SOLR CASE"). Case 1 has zero queries in this
 * environment, which is why core_smoke.spec.ts's query-results-dependent
 * tests are flagged as failing here — snapshot creation doesn't strictly
 * require live results (it posts whatever query docs are in memory, even
 * none), but annotation creation does: AnnotationsCtrl#create refuses with
 * "Can't create a new annotation until searches have been run!" unless the
 * case already has a last score, which case 5 does.
 */

const SNAPSHOT_CASE_ID = Number(process.env.QUEPID_E2E_SNAPSHOT_CASE_ID || 5);

async function gotoSnapshotCase(page: Page): Promise<void> {
  await page.goto(`case/${SNAPSHOT_CASE_ID}`);
  await page.waitForSelector('#case-actions', { timeout: 20_000 });
}

test.describe('snapshots', () => {
  test('creating a snapshot lists it in the compare-snapshots picker', async ({ page }) => {
    // The save serializes explain data for every query/doc in the case, and
    // this shared dev server can be under concurrent load from other runs —
    // give this one more headroom than the default 30s test timeout.
    test.setTimeout(90_000);
    await gotoSnapshotCase(page);

    const snapshotName = `Playwright snapshot ${Date.now()}`;
    let snapshotId: number | undefined;

    try {
      await page.getByText('Create snapshot', { exact: false }).first().click();
      const snapshotModal = page.locator('.modal.show').filter({ hasText: /Take a Snapshot/i });
      await expect(snapshotModal).toBeVisible();

      await snapshotModal.locator('#snapshotName').fill(snapshotName);

      // Wait on the actual querySnapshotSvc.addSnapshot() POST rather than only
      // the modal's closing animation — the save serializes explain data for
      // every query/doc in the case, so its response time varies with server
      // load. This is a stronger, faster-resolving signal than #flash-messages
      // too, since case 5's background query auto-refresh periodically emits
      // its own "All queries finished successfully!" flash that can race with
      // (and overwrite) the single-slot flash before this assertion samples it.
      const snapshotSaved = page.waitForResponse(
        response =>
          response.url().includes(`/api/cases/${SNAPSHOT_CASE_ID}/snapshots`) &&
          'POST' === response.request().method(),
        { timeout: 45_000 }
      );
      await snapshotModal.getByRole('button', { name: 'Take Snapshot', exact: true }).click();
      const snapshotResponse = await snapshotSaved;
      expect(snapshotResponse.ok()).toBeTruthy();
      snapshotId = (await snapshotResponse.json()).id;

      await expect(snapshotModal).toBeHidden({ timeout: 30_000 });

      await page.getByText('Compare snapshots', { exact: false }).first().click();
      const compareModal = page.locator('.modal.show').filter({ hasText: /Compare Your Search Results/i });
      await expect(compareModal).toBeVisible();

      const select = compareModal.locator('select').first();
      await expect(select.locator('option', { hasText: snapshotName })).toHaveCount(1, { timeout: 15_000 });

      await compareModal.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(compareModal).toBeHidden();
    } finally {
      // This case's dev DB row is shared across runs (there's no per-test
      // fixture reset) — clean up after ourselves so repeated runs don't pile
      // up snapshots, each carrying full explain-data for every query/doc,
      // which otherwise bloats the case and slows every later run's save.
      if (snapshotId) {
        await page.evaluate(id => {
          const injector = (window as any).angular.element(document.body).injector();
          return injector.get('querySnapshotSvc').deleteSnapshot(id);
        }, snapshotId);
      }
    }
  });
});

test.describe('annotations', () => {
  test('creating an annotation appends it to the case annotations list', async ({ page }) => {
    await gotoSnapshotCase(page);

    // "Tune Relevance" toggles the east dev-settings panel (queryParams.js /
    // devQueryParams.html), which has an "Annotations" tab (#annotationsTab)
    // hosting the <annotations> component (create form + existing list).
    await page.locator('#tune-relevance-link a').click();
    await page.locator('#annotationsTab').click();

    const annotations = page.locator('#annotations');
    await expect(annotations).toBeVisible();

    const message = `Playwright annotation ${Date.now()}`;
    await annotations.locator('textarea').fill(message);
    await annotations.getByRole('button', { name: 'Create', exact: true }).click();

    // Appending to the list is the authoritative signal here for the same
    // reason as the snapshot test above — #flash-messages is a single slot
    // that case 5's background query refresh can overwrite mid-assertion.
    const annotationItem = annotations.locator('li.annotation').filter({ hasText: message });
    await expect(annotationItem).toBeVisible({ timeout: 10_000 });

    // Same cleanup rationale as the snapshot test — this case's dev DB row is
    // shared across runs, so remove what we added via the UI's own delete
    // action rather than leaving it to accumulate.
    await annotationItem.locator('.dropdown-toggle').click();
    await annotationItem.getByText('Delete', { exact: true }).click();
    await expect(annotationItem).toBeHidden({ timeout: 10_000 });
  });
});

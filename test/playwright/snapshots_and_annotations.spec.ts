import { test, expect, type Page } from '@playwright/test';
import { DEFAULT_RICH_CASE_ID } from './angular_case_helpers';

/**
 * Behavioral (non-visual) coverage for snapshots and annotations on the
 * case UI. dom_migration_screenshots.spec.ts already screenshot-diffs
 * the annotation relative-time display, but nothing previously asserted that a
 * snapshot actually gets created/listed, or exercised annotation creation.
 *
 * These use a case with a *working* search endpoint and existing queries —
 * DEFAULT_RICH_CASE_ID (angular_case_helpers.ts), same case the suite's own
 * default CASE_ID now points at. Snapshot creation doesn't strictly require
 * live results (it posts whatever query docs are in memory, even none), but
 * annotation creation does: the annotation controller refuses with "Can't create
 * a new annotation until searches have been run!" unless the case already has
 * a last score, which this one does.
 */

const SNAPSHOT_CASE_ID = Number(process.env.QUEPID_E2E_SNAPSHOT_CASE_ID || DEFAULT_RICH_CASE_ID);

async function gotoSnapshotCase(page: Page): Promise<void> {
  await page.goto(`case/${SNAPSHOT_CASE_ID}`);
  await page.waitForSelector('#case-actions', { timeout: 20_000 });
  // Wait for `.search-feedback` ("Bootstrapping Queries" / "Updating Queries: X / Y")
  // to clear before proceeding -- see the identical wait in angular_case_helpers.ts's
  // gotoCase() for why `state: 'hidden'` alone isn't enough (two elements share the
  // class). Without this, clicking "Take Snapshot" before queriesSvc's state has
  // actually settled can race the snapshot POST silently -- easy to miss when the
  // case was slow (live Solr always left enough slack), much easier to hit once the
  // case's search is instant (a local static/snapshot endpoint).
  await expect(page.locator('.search-feedback:visible')).toHaveCount(0, { timeout: 20_000 }).catch(() => {});
}

test.describe('snapshots', () => {
  test('creating a snapshot lists it in the compare-snapshots picker', async ({ page }) => {
    // The save serializes explain data for every query/doc in the case by
    // fetching it from SNAPSHOT_CASE_ID's live search endpoint (a real
    // external Solr host, not a fixture) -- give this one more headroom than
    // the default 30s test timeout to absorb that host's real-world latency.
    test.setTimeout(120_000);
    await gotoSnapshotCase(page);

    const snapshotName = `Playwright snapshot ${Date.now()}`;
    let snapshotId: number | undefined;

    try {
      await page.locator('a[data-controller="take-snapshot-core"]').click();
      const snapshotModal = page.locator('#takeSnapshotModal.show');
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
        { timeout: 100_000 }
      );
      await snapshotModal.getByRole('button', { name: 'Take Snapshot', exact: true }).click();
      const snapshotResponse = await snapshotSaved;
      expect(snapshotResponse.ok()).toBeTruthy();
      snapshotId = (await snapshotResponse.json()).id;

      await expect(snapshotModal).toBeHidden({ timeout: 30_000 });

      await page.getByText('Compare snapshots', { exact: false }).first().click();
      const compareModal = page.locator('.modal.show').filter({ hasText: /Compare Your Search Results/i });
      await expect(compareModal).toBeVisible();
      await expect(page.locator('#diffModal[data-controller="diff-core"]')).toBeVisible();

      const select = compareModal.locator('select').first();
      const snapshotOption = select.locator('option', { hasText: snapshotName });
      await expect(snapshotOption).toHaveCount(1, { timeout: 15_000 });

      await select.selectOption(await snapshotOption.getAttribute('value') as string);
      await compareModal.getByRole('button', { name: 'Update Comparison Settings', exact: true }).click();
      await expect(compareModal).toBeHidden({ timeout: 30_000 });

      await expect(page.locator('.diff-score').first()).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('[data-controller="diff-case-scores"] .case-score').first()).toBeVisible({ timeout: 30_000 });

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
    // hosting the Stimulus annotation controller (create form + existing list).
    await page.locator('#tune-relevance-link a').click();
    await page.locator('#annotationsTab').click();

    const annotations = page.locator('#annotations');
    await expect(annotations).toBeVisible();

    const message = `Playwright annotation ${Date.now()}`;
    await annotations.locator('#annotation-message').fill(message);
    await annotations.getByRole('button', { name: 'Create', exact: true }).click();

    // Appending to the list is the authoritative signal here for the same
    // reason as the snapshot test above — #flash-messages is a single slot
    // that case 5's background query refresh can overwrite mid-assertion.
    const annotationItem = annotations.locator('li.annotation').filter({ hasText: message });
    await expect(annotationItem).toBeVisible({ timeout: 10_000 });

    await annotationItem.locator('.dropdown-toggle').click();
    await annotationItem.getByText('Edit', { exact: true }).click();
    const editedMessage = `${message} edited`;
    await page.locator('#edit-annotation-message').fill(editedMessage);
    await page.getByRole('button', { name: 'Update', exact: true }).click();
    await expect(annotations.locator('li.annotation').filter({ hasText: editedMessage })).toBeVisible({ timeout: 10_000 });

    // Same cleanup rationale as the snapshot test — this case's dev DB row is
    // shared across runs, so remove what we added via the UI's own delete
    // action rather than leaving it to accumulate.
    const editedItem = annotations.locator('li.annotation').filter({ hasText: editedMessage });
    await editedItem.locator('.dropdown-toggle').click();
    await editedItem.getByText('Delete', { exact: true }).click();
    await expect(editedItem).toBeHidden({ timeout: 10_000 });
  });
});

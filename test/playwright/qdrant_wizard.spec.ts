import { test, expect } from '@playwright/test';
import { apiHeaders } from './case_helpers';

// The live Qdrant demo is exercised manually. Intercept only its proxy response here
// so the persisted wizard/runtime contract does not depend on the demo's availability.
for (const { idField, docId } of [
  { idField: 'id', docId: '603' },
  { idField: 'movie_id', docId: '7' },
  { idField: 'sku', docId: '007' }
]) {
  test.describe(`Qdrant case wizard (${idField})`, () => {
    let caseId: number | undefined;
    let endpointId: number | undefined;
    const endpointMarker = `quepid_e2e=${idField}-${Date.now()}`;
    let userId: number;
    let completedWizard: boolean;

    test.afterAll(async ({ browser }) => {
      const context = await browser.newContext({ storageState: 'test/playwright/.auth/user.json' });
      const page = await context.newPage();
      await page.goto('cases');
      const headers = await apiHeaders(page);
      const errors: unknown[] = [];
      const attempt = async (action: () => Promise<void>) => {
        try {
          await action();
        } catch (error) {
          errors.push(error);
        }
      };
      try {
        if (caseId) {
          await attempt(async () => {
            if (!endpointId) {
              const saved = await page.request.get(`api/cases/${caseId}/tries/1`, { headers });
              if (saved.ok()) {
                const settings = await saved.json();
                if (settings.search_url?.includes(endpointMarker)) endpointId = settings.search_endpoint_id;
              }
            }
          });
          await attempt(async () => {
            const response = await page.request.delete(`api/cases/${caseId}`, { headers });
            expect(response.ok()).toBeTruthy();
          });
        }
        if (endpointId) {
          await attempt(async () => {
            const response = await page.request.delete(`api/search_endpoints/${endpointId}`, { headers });
            expect(response.ok()).toBeTruthy();
          });
        }
        if (userId) {
          await attempt(async () => {
            const response = await page.request.put(`api/users/${userId}`, {
              headers, data: { user: { completed_case_wizard: completedWizard } }
            });
            expect(response.ok()).toBeTruthy();
          });
        }
      } finally {
        await context.close();
      }
      if (errors.length) throw new AggregateError(errors, 'Qdrant fixture cleanup failed');
    });

    test('validates, persists, searches and looks up rated ids after refresh', async ({ page }) => {
      await page.goto('cases');
      const headers = await apiHeaders(page);
      const me = await (await page.request.get('api/users/current', { headers })).json();
      userId = me.id;
      completedWizard = me.completed_case_wizard;
      const created = await page.request.post('api/cases', {
        headers, data: { case_name: `Qdrant E2E ${Date.now()}` }
      });
      expect(created.ok()).toBeTruthy();
      caseId = (await created.json()).case_id;

      try {
        let failValidation = true;
        type Condition = { has_id?: number[]; key?: string; match?: { any: (string | number)[] }; should?: Condition[] };
        const bodies: { filter?: { must?: Condition[] }; query?: { nearest?: { text?: string } }; limit?: number }[] = [];
        const payload: Record<string, string | number> = { movie_id: 7, sku: '007', title: 'The Matrix', overview: 'A hacker learns the truth.' };
        const matches = (condition: Condition): boolean => {
          if (condition.has_id) return condition.has_id.includes(603);
          if (condition.should) return condition.should.some(matches);
          return condition.match?.any.includes(payload[condition.key!]) ?? false;
        };
        await page.route('**/proxy/fetch**', async route => {
          expect(route.request().method()).toBe('POST');
          const body = route.request().postDataJSON();
          bodies.push(body);
          if (failValidation) {
            await route.fulfill({ status: 502, json: { proxy_error: 'Endpoint unavailable' } });
            return;
          }
          const found = !body.filter || body.filter.must.every(matches);
          await route.fulfill({ json: {
            status: 'ok', result: { points: found ? [{ id: 603, score: 7.43, payload }] : [] }
          } });
        });

        await page.goto(`case/${caseId}/try/1?showWizard=true`);
        const modal = page.locator('#wizardModal');
        const next = () => modal.getByRole('button', { name: 'Continue', exact: true }).filter({ visible: true });
        await expect(modal).toBeVisible();
        // Existing users skip Welcome; preserve their stored onboarding preference.
        if (completedWizard === false) await next().click();
        await modal.getByLabel('New Case Name:').fill('Qdrant E2E');
        await next().click();
        await modal.getByLabel('Create a new endpoint').selectOption('qdrant');
        // Endpoint assignment deduplicates by configuration; isolate this test's row.
        const url = modal.getByPlaceholder('Search endpoint URL');
        await url.fill(`${await url.inputValue()}?${endpointMarker}`);
        await expect(modal.getByLabel('API method')).toHaveValue('POST');
        await expect(modal.getByLabel('Proxy requests through Quepid')).toBeChecked();
        await next().click();
        await expect(modal.locator('[data-wizard-target="alert"]')).toBeVisible();
        await expect(modal.getByLabel('Create a new endpoint')).toHaveValue('qdrant');
        failValidation = false;
        await next().click();
        await expect(modal.getByRole('heading', { name: 'How Should We Display Your Results?' })).toBeVisible();
        await expect(modal.getByLabel('ID Field', { exact: true })).toHaveValue('id');
        await modal.getByLabel('ID Field', { exact: true }).fill(idField);
        await next().click();
        await modal.getByPlaceholder('Search query').fill('matrix');
        await modal.getByRole('button', { name: 'Add Query', exact: true }).click();
        await next().click();
        await modal.getByRole('button', { name: 'Finish', exact: true }).click();
        await expect(modal).toBeHidden();
        await page.getByRole('heading', { name: 'matrix', exact: true }).click();
        const result = page.locator('search-result').first();
        await expect(result).toContainText('The Matrix');
        await expect(result).toHaveAttribute('data-doc-id', docId);
        const settings = await (await page.request.get(`api/cases/${caseId}/tries/1`, { headers })).json();
        expect(settings.search_url).toContain(endpointMarker);
        endpointId = settings.search_endpoint_id;
        expect(settings.mapper_based_search_engine_id).toBe('qdrant');
        expect(settings.api_method).toBe('POST');
        expect(settings.proxy_requests).toBe(true);
        expect(settings.mapper_based_search_engine_supports_pagination).toBe(false);
        expect(settings.mapper_based_search_engine_supports_rated_docs_lookup).toBe(true);
        await result.getByRole('button', { name: 'Rate document: Unrated' }).click();
        await page.locator('.popover.show').getByRole('button', { name: /^1/ }).click();
        await expect(result).toHaveAttribute('data-rating', '1');
        await page.reload();
        await page.getByRole('heading', { name: 'matrix', exact: true }).click();
        await expect(result).toHaveAttribute('data-rating', '1');
        await page.getByRole('link', { name: 'Show only rated', exact: true }).click();
        await expect.poll(() => bodies.some(body => body.filter?.must?.some(matches))).toBeTruthy();
        expect(bodies.some(body => body.query?.nearest?.text === 'matrix' && body.limit === 10)).toBeTruthy();
        await expect(result).toContainText('The Matrix');
      } finally {
        // Drain score/rating writes before afterAll deletes their case, even on assertion failure.
        await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
        await page.goto('cases');
      }
    });
  });
}

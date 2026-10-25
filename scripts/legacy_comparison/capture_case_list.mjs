/**
 * Captures the case list on Legacy and Current for side-by-side comparison: L1–L5 ("Case list lost
 * Legacy row actions and details" in docs/todo/todo.md). Row actions are opened on a scratch case,
 * created here and deleted afterwards, and every modal is cancelled. Hover text goes to
 * notes-case-list-<side>.json.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  apiHeaders, chromium, clearOutlines, deleteCase, isLegacy, openSide, outline, parseCaptureArgs, shots,
} from './lib.mjs';

const USAGE = 'Usage: node scripts/legacy_comparison/capture_case_list.mjs [--out tmp/legacy_comparison] [--sides legacy,current]';
const DETAIL_CASE = '10s of Queries';
// Unrated results on both instances, so Legacy shows its frog.
const FROG_CASE = 'Typeahead: Dessert';

const { out, sides } = parseCaptureArgs(USAGE);

const browser = await chromium.launch();
for (const side of sides) {
  const legacy = isLegacy(side);
  const page = await openSide(browser, side);
  await page.setViewportSize({ width: 1400, height: 1100 });
  const shot = shots(page, out, side);
  const notes = {};
  let scratchId = null;
  const step = async (name, fn) => {
    try {
      await fn();
    } catch (error) {
      console.error(`${side} ${name}: ${error.message.split('\n')[0]}`);
      await page.screenshot({ path: join(out, `error-${name}-${side}.png`) }).catch(() => {});
      await page.keyboard.press('Escape').catch(() => {});
    }
  };
  // Legacy filters client-side; Current takes ?q=.
  const listCases = async (filter) => {
    if (legacy) {
      await page.goto('/cases');
      await page.waitForTimeout(4000);
      if (filter) {
        await page.locator('#cases-filter').fill(filter);
        await page.waitForTimeout(800);
      }
    } else {
      await page.goto(filter ? `/cases?q=${encodeURIComponent(filter)}` : '/cases');
      await page.waitForTimeout(1500);
    }
  };
  const row = (name) => page.locator(legacy ? '.item-box' : 'tbody tr').filter({ hasText: name }).first();
  const modalShot = async (name) => {
    await page.waitForTimeout(1000);
    await page.locator(legacy ? '.modal:visible .modal-dialog' : '.modal.show .modal-content').last().screenshot({ path: join(out, `${name}-${side}.png`) });
  };
  const cancelModal = async () => {
    const modal = page.locator(legacy ? '.modal:visible' : '.modal.show').last();
    await modal.getByRole('button', { name: /^(Cancel|Close)$/ }).or(modal.getByText('Cancel', { exact: true })).first().click();
    await page.waitForTimeout(800);
  };

  try {
    const created = await page.request.post('/api/cases', {
      headers: await apiHeaders(page), data: { case: { case_name: `Legacy comparison list ${Date.now()}` } },
    });
    if (!created.ok()) throw new Error(`POST cases: ${await created.text()}`);
    const scratch = await created.json();
    scratchId = scratch.case_id;
    const scratchName = scratch.case_name;

    // L1, L3: the whole page (view filter, columns, row actions).
    await step('l1', async () => {
      await listCases();
      await shot.full('l1');
      await page.screenshot({ path: join(out, `l1full-${side}.png`), fullPage: true });
    });

    // L4: the sample-data row's details (score, frog, nightly icon, teams, last run).
    await step('l4', async () => {
      await listCases(DETAIL_CASE);
      const detail = row(DETAIL_CASE);
      await detail.hover();
      await page.waitForTimeout(400);
      await detail.screenshot({ path: join(out, `l4-${side}.png`) });
      notes.l4 = {
        text: (await detail.innerText()).replace(/\s+/g, ' ').trim(),
        titles: await detail.locator('[title]').evaluateAll((items) => items.map((item) => item.getAttribute('title'))),
      };
    });

    await step('l4b', async () => {
      await listCases(FROG_CASE);
      const frog = row(FROG_CASE);
      await outline(frog.locator('.frog-icon'));
      await frog.screenshot({ path: join(out, `l4b-${side}.png`) });
      await clearOutlines(page);
    });

    // L1: the scratch row's actions.
    await step('l1row', async () => {
      await listCases(scratchName);
      const scratchRow = row(scratchName);
      await scratchRow.hover();
      await page.waitForTimeout(400);
      await outline(scratchRow.locator(legacy ? '.item-actions' : 'td:last-child'));
      await scratchRow.screenshot({ path: join(out, `l1row-${side}.png`) });
      await clearOutlines(page);
      notes.l1row = await scratchRow.locator(legacy ? '.item-actions [title]' : 'td:last-child button, td:last-child a')
        .evaluateAll((items) => items.map((item) => item.getAttribute('title') || item.textContent.trim()));
    });

    // L2: the archive confirmation, cancelled.
    await step('l2', async () => {
      const scratchRow = row(scratchName);
      if (legacy) {
        await scratchRow.hover();
        await scratchRow.locator('[title="Archive"]').click();
      } else {
        await scratchRow.getByRole('button', { name: /Archive/ }).first().click();
      }
      await modalShot('l2');
      await cancelModal();
    });

    // L1: Legacy's Delete confirmation from the list, cancelled. Current has no Delete on the list.
    if (legacy) {
      await step('l1delete', async () => {
        const scratchRow = row(scratchName);
        await scratchRow.hover();
        await scratchRow.locator('[title="Delete"]').click();
        await modalShot('l1delete');
        await cancelModal();
      });
    }

    // L5: the paste-JSON import page.
    await step('l5', async () => {
      const response = await page.goto('/cases/import');
      await page.waitForTimeout(legacy ? 4000 : 1000);
      notes.l5 = response?.status();
      await shot.full('l5');
    });
  } catch (error) {
    console.error(`${side}: ${error.message.split('\n')[0]}`);
    await shot.full('error-case-list');
  }

  writeFileSync(join(out, `notes-case-list-${side}.json`), JSON.stringify(notes, null, 2));
  await page.goto('/cases');
  if (scratchId) await deleteCase(page, scratchId);
  await page.context().close();
}
await browser.close();
console.log(`Screenshots in ${out}`);

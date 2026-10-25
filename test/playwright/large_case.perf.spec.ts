import { test, expect, Page, CDPSession } from '@playwright/test';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { apiHeaders, createDisposableCase, deleteCaseViaApi, expandFirstQuery, waitForSearchSettled } from './case_helpers';
import { REPLAY_SOLR_URL, replayQueryTexts, routeReplaySolr } from './large_case_replay';

/**
 * Large-case memory and load benchmark for the core case page. Run with `yarn test:perf`
 * (perf.config.ts: one worker, no trace or screenshots, which would add memory and noise).
 *
 * A disposable case gets PERF_QUERIES queries (default 400) and a try on a JSONP Solr endpoint at
 * an unresolvable host, served by large_case_replay.ts, so no real engine is ever involved and
 * every run sees identical responses. Each run writes its numbers to tmp/perf/ with the git SHA.
 *
 * Budgets are soft assertions so a run always records its numbers: retained heap per collapsed
 * query (see PER_QUERY_BUDGET_KB), and no splainer Explain tree until a query is expanded.
 * Timing on one machine is only comparable to runs on the same machine, so compare medians of
 * interleaved A/B runs rather than single runs.
 */
const QUERY_COUNT = Number(process.env.PERF_QUERIES ?? 400);
const LATENCY_MS = Number(process.env.PERF_LATENCY_MS ?? 20);
// Parsing a heap snapshot costs ~2x the heap in this process, so only count Explains up to here.
const SNAPSHOT_MAX_QUERIES = Number(process.env.PERF_SNAPSHOT_MAX_QUERIES ?? 1000);
// PERF_PROFILE=1 records a CPU profile of the load and reports the hottest functions by self time.
const PROFILE = process.env.PERF_PROFILE === '1';
const BASE_BUDGET_MB = 40;
// ~120 KB/query today. Most of it is each doc's text held three to four times, because
// splainer-search 3.x deep-clones response docs with structuredClone, which copies strings
// (Legacy's splainer 2.x shared them, ~90 KB/query). Tighten this once splainer stops cloning.
const PER_QUERY_BUDGET_KB = 140;

async function usedHeapMB(cdp: CDPSession): Promise<number> {
  const { usedSize } = await cdp.send('Runtime.getHeapUsage');
  return usedSize / 1e6;
}

async function retainedHeapMB(cdp: CDPSession): Promise<number> {
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.send('HeapProfiler.collectGarbage');
  return usedHeapMB(cdp);
}

/**
 * Live objects per constructor name, from a full heap snapshot. With PERF_BREAKDOWN=1 it also
 * reports the biggest retainers of string bytes as `parent.property`, to find duplicated text.
 */
async function countObjects(cdp: CDPSession, names: string[]): Promise<Record<string, number | string[]>> {
  const chunks: string[] = [];
  const onChunk = ({ chunk }: { chunk: string }) => chunks.push(chunk);
  cdp.on('HeapProfiler.addHeapSnapshotChunk', onChunk);
  await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
  cdp.off('HeapProfiler.addHeapSnapshotChunk', onChunk);

  const snapshot = JSON.parse(chunks.join(''));
  const fields: string[] = snapshot.snapshot.meta.node_fields;
  const types: string[] = snapshot.snapshot.meta.node_types[0];
  const [typeAt, nameAt, width] = [fields.indexOf('type'), fields.indexOf('name'), fields.length];
  const counts: Record<string, number | string[]> = Object.fromEntries(names.map(name => [name, 0]));
  for (let i = 0; i < snapshot.nodes.length; i += width) {
    if (types[snapshot.nodes[i + typeAt]] !== 'object') continue;
    const name = snapshot.strings[snapshot.nodes[i + nameAt]];
    if (name in counts) (counts[name] as number) += 1;
  }
  if (process.env.PERF_BREAKDOWN === '1') counts.stringRetainers = stringRetainers(snapshot);
  return counts;
}

function stringRetainers(snapshot: any): string[] {
  const meta = snapshot.snapshot.meta;
  const [nodeWidth, edgeWidth] = [meta.node_fields.length, meta.edge_fields.length];
  const [typeAt, nameAt, sizeAt, edgeCountAt] = ['type', 'name', 'self_size', 'edge_count'].map(f => meta.node_fields.indexOf(f));
  const [edgeTypeAt, edgeNameAt, toAt] = ['type', 'name_or_index', 'to_node'].map(f => meta.edge_fields.indexOf(f));
  const nodeTypes: string[] = meta.node_types[0];
  const edgeTypes: string[] = meta.edge_types[0];
  const bytes = new Map<string, number>();
  let edge = 0;
  for (let n = 0; n < snapshot.nodes.length; n += nodeWidth) {
    const parent = `${snapshot.strings[snapshot.nodes[n + nameAt]]}`.slice(0, 30);
    for (let k = 0; k < snapshot.nodes[n + edgeCountAt]; k++, edge += edgeWidth) {
      if (edgeTypes[snapshot.edges[edge + edgeTypeAt]] !== 'property') continue;
      const child = snapshot.edges[edge + toAt];
      if (!nodeTypes[snapshot.nodes[child + typeAt]].includes('string')) continue;
      const key = `${parent}.${snapshot.strings[snapshot.edges[edge + edgeNameAt]]}`;
      bytes.set(key, (bytes.get(key) ?? 0) + snapshot.nodes[child + sizeAt]);
    }
  }
  return [...bytes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([key, b]) => `${(b / 1e6).toFixed(1)}MB ${key}`);
}

/** Self time per function (ms), hottest first, from a CDP CPU profile. */
function hottestFunctions(profile: { nodes: any[]; samples?: number[]; timeDeltas?: number[] }, limit = 25): string[] {
  const byId = new Map(profile.nodes.map(node => [node.id, node]));
  const selfMs = new Map<string, number>();
  (profile.samples ?? []).forEach((id, i) => {
    const frame = byId.get(id).callFrame;
    const key = `${frame.functionName || '(anonymous)'} ${frame.url.split('/').pop()}:${frame.lineNumber + 1}`;
    selfMs.set(key, (selfMs.get(key) ?? 0) + (profile.timeDeltas?.[i] ?? 0) / 1000);
  });
  return [...selfMs.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([key, ms]) => `${Math.round(ms)}ms ${key}`);
}

function gitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

// Records each id in `created` as soon as it exists, so cleanup can remove a partly seeded case.
async function seedCase(page: Page, created: { caseId?: number; endpointId?: number }): Promise<number> {
  const caseId = created.caseId = await createDisposableCase(page, `Perf ${QUERY_COUNT}q`);
  const headers = await apiHeaders(page, { 'Content-Type': 'application/json' });

  const endpoint = await page.request.post('api/search_endpoints', {
    headers,
    data: { search_endpoint: { name: `Playwright Perf Replay ${Date.now()}`, endpoint_url: REPLAY_SOLR_URL,
      search_engine: 'solr', api_method: 'JSONP' } },
  });
  expect(endpoint.ok(), `endpoint create: ${endpoint.status()}`).toBeTruthy();
  const body = await endpoint.json();
  const endpointId = created.endpointId = Number(body.search_endpoint_id ?? body.id);

  const queries = await page.request.post(`api/bulk/cases/${caseId}/queries`, {
    headers, data: { queries: replayQueryTexts(QUERY_COUNT) }, timeout: 120_000,
  });
  expect(queries.ok(), `bulk queries: ${queries.status()}`).toBeTruthy();

  const tryResponse = await page.request.post(`api/cases/${caseId}/tries`, {
    headers,
    data: { try: { search_endpoint_id: endpointId, query_params: 'q=#$query##',
      field_spec: 'id:id title:catch_line structure text', number_of_rows: 10 } },
  });
  expect(tryResponse.ok(), `try create: ${tryResponse.status()}`).toBeTruthy();
  return Number((await tryResponse.json()).try_number);
}

test(`a ${QUERY_COUNT}-query case loads within its memory budget`, async ({ page }) => {
  test.setTimeout(Math.max(300_000, QUERY_COUNT * 200));
  const created: { caseId?: number; endpointId?: number } = {};

  try {
    const tryNumber = await seedCase(page, created);
    await routeReplaySolr(page, { latencyMs: LATENCY_MS });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    await cdp.send('HeapProfiler.enable');

    let peakHeapMB = 0;
    let sampling = true;
    const sampler = (async () => {
      while (sampling) {
        peakHeapMB = Math.max(peakHeapMB, await usedHeapMB(cdp).catch(() => 0));
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    })();

    if (PROFILE) {
      await cdp.send('Profiler.enable');
      await cdp.send('Profiler.setSamplingInterval', { interval: 1000 });
      await cdp.send('Profiler.start');
    }
    const started = Date.now();
    await page.goto(`case/${created.caseId}/try/${tryNumber}`);
    await expect(page.getByText(`Number of Queries: ${QUERY_COUNT}`)).toBeVisible({ timeout: 120_000 });
    await waitForSearchSettled(page, Math.max(120_000, QUERY_COUNT * 150));
    const settledMs = Date.now() - started;
    sampling = false;
    await sampler;
    const hottest = PROFILE ? hottestFunctions((await cdp.send('Profiler.stop')).profile) : undefined;

    const metrics = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
    const retainedMB = await retainedHeapMB(cdp);
    const collapsed = QUERY_COUNT <= SNAPSHOT_MAX_QUERIES ? await countObjects(cdp, ['Explain', 'NormalDoc']) : null;

    await expandFirstQuery(page);
    await expect(page.locator('search-result')).toHaveCount(10);
    await expect(page.locator('[data-controller~="match-explain"]').first()).toBeVisible();

    const result = {
      sha: gitSha(), at: new Date().toISOString(), queries: QUERY_COUNT, latencyMs: LATENCY_MS,
      settledMs, peakHeapMB: Math.round(peakHeapMB), retainedHeapMB: Math.round(retainedMB),
      retainedKBPerQuery: Math.round((retainedMB * 1000) / QUERY_COUNT),
      scriptSeconds: Number(metrics.ScriptDuration?.toFixed(2)), taskSeconds: Number(metrics.TaskDuration?.toFixed(2)),
      explainsWhileCollapsed: collapsed?.Explain ?? null, normalDocs: collapsed?.NormalDoc ?? null,
      hottest, stringRetainers: collapsed?.stringRetainers,
    };
    const outDir = path.resolve(__dirname, '../../tmp/perf');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, `${result.at.replace(/[:.]/g, '-')}-${result.sha}-${QUERY_COUNT}q.json`), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));

    expect.soft(result.retainedHeapMB, 'retained heap after GC (MB)')
      .toBeLessThanOrEqual(BASE_BUDGET_MB + (PER_QUERY_BUDGET_KB * QUERY_COUNT) / 1000);
    if (collapsed) expect.soft(collapsed.Explain, 'splainer Explain trees built for collapsed queries').toBe(0);
  } finally {
    await page.goto('cases');
    if (created.caseId) await deleteCaseViaApi(page, created.caseId);
    if (created.endpointId) {
      const response = await page.request.delete(`api/search_endpoints/${created.endpointId}`, { headers: await apiHeaders(page) });
      expect(response.ok(), `endpoint ${created.endpointId} cleanup failed: ${response.status()}`).toBeTruthy();
    }
  }
});

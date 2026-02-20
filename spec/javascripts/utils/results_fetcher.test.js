// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('api/fetch', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('utils/quepid_root', () => ({
  getQuepidRootUrl: vi.fn(() => ''),
  buildApiQuerySearchUrl: vi.fn((_root, caseId, tryNumber, queryId, _q, rows, start) => {
    let url = `/api/cases/${caseId}/tries/${tryNumber}/queries/${queryId}/search`;
    const params = new URLSearchParams();
    if (rows != null && rows > 0) params.set('rows', String(rows));
    if (start != null && start > 0) params.set('start', String(start));
    const qs = params.toString();
    return qs ? `${url}?${qs}` : url;
  }),
}));

import { apiFetch } from 'api/fetch';
import { fetchResultsHtml, parseResultsHtml } from 'utils/results_fetcher';

describe('results_fetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── fetchResultsHtml ──────────────────────────────────────────────

  describe('fetchResultsHtml', () => {
    it('calls apiFetch with correct URL and Accept: text/html', async () => {
      apiFetch.mockResolvedValue(new Response('', { status: 200 }));

      await fetchResultsHtml({ caseId: 1, tryNumber: 2, queryId: 3 });

      expect(apiFetch).toHaveBeenCalledOnce();
      const [url, opts] = apiFetch.mock.calls[0];
      expect(url).toContain('/api/cases/1/tries/2/queries/3/search');
      expect(opts.method).toBe('GET');
      expect(opts.headers.Accept).toBe('text/html');
    });

    it('appends rows and start params', async () => {
      apiFetch.mockResolvedValue(new Response('', { status: 200 }));

      await fetchResultsHtml({ caseId: 1, tryNumber: 2, queryId: 3, rows: 5, start: 10 });

      const [url] = apiFetch.mock.calls[0];
      expect(url).toContain('rows=5');
      expect(url).toContain('start=10');
    });

    it('appends diff snapshot IDs', async () => {
      apiFetch.mockResolvedValue(new Response('', { status: 200 }));

      await fetchResultsHtml({
        caseId: 1,
        tryNumber: 2,
        queryId: 3,
        diffSnapshotIds: ['snap1', 'snap2'],
      });

      const [url] = apiFetch.mock.calls[0];
      expect(url).toContain('diff_snapshot_ids[]=snap1');
      expect(url).toContain('diff_snapshot_ids[]=snap2');
    });

    it('appends show_only_rated when true', async () => {
      apiFetch.mockResolvedValue(new Response('', { status: 200 }));

      await fetchResultsHtml({
        caseId: 1,
        tryNumber: 2,
        queryId: 3,
        showOnlyRated: true,
      });

      const [url] = apiFetch.mock.calls[0];
      expect(url).toContain('show_only_rated=true');
    });

    it('does not append show_only_rated when false', async () => {
      apiFetch.mockResolvedValue(new Response('', { status: 200 }));

      await fetchResultsHtml({
        caseId: 1,
        tryNumber: 2,
        queryId: 3,
        showOnlyRated: false,
      });

      const [url] = apiFetch.mock.calls[0];
      expect(url).not.toContain('show_only_rated');
    });
  });

  // ── parseResultsHtml ──────────────────────────────────────────────

  describe('parseResultsHtml', () => {
    it('parses a well-formed response with cards', () => {
      const html = `
        <div data-results-pane-html-response data-num-found="42" data-shown="2">
          <p class="text-muted small mb-2">42 results found</p>
          <div class="document-card" data-doc-id="doc1">Doc 1</div>
          <div class="document-card" data-doc-id="doc2">Doc 2</div>
          <div data-results-pane-target="loadMoreArea">
            <button>Load more</button>
          </div>
        </div>
      `;

      const result = parseResultsHtml(html);

      expect(result.numFound).toBe(42);
      expect(result.headerEl).not.toBeNull();
      expect(result.headerEl.textContent).toContain('42 results found');
      expect(result.cards).toHaveLength(2);
      expect(result.cards[0].dataset.docId).toBe('doc1');
      expect(result.cards[1].dataset.docId).toBe('doc2');
      expect(result.loadMoreEl).not.toBeNull();
    });

    it('returns empty structure when wrapper is missing', () => {
      const result = parseResultsHtml('<p>No wrapper</p>');

      expect(result.numFound).toBe(0);
      expect(result.headerEl).toBeNull();
      expect(result.cards).toHaveLength(0);
      expect(result.loadMoreEl).toBeNull();
    });

    it('handles response with no cards', () => {
      const html = `
        <div data-results-pane-html-response data-num-found="0" data-shown="0">
          <p class="text-muted small mb-2">0 results found</p>
        </div>
      `;

      const result = parseResultsHtml(html);

      expect(result.numFound).toBe(0);
      expect(result.cards).toHaveLength(0);
      expect(result.loadMoreEl).toBeNull();
    });

    it('handles missing numFound attribute gracefully', () => {
      const html = `
        <div data-results-pane-html-response>
          <div class="document-card" data-doc-id="doc1">Doc 1</div>
        </div>
      `;

      const result = parseResultsHtml(html);

      expect(result.numFound).toBe(0);
      expect(result.cards).toHaveLength(1);
    });

    it('handles empty string input', () => {
      const result = parseResultsHtml('');

      expect(result.numFound).toBe(0);
      expect(result.cards).toHaveLength(0);
    });
  });
});

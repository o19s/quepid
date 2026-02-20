// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('api/fetch', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('utils/quepid_root', () => ({
  getQuepidRootUrl: vi.fn(() => ''),
  buildApiUrl: vi.fn((_root, ...parts) => `/api/${parts.join('/')}`),
}));

import { apiFetch } from 'api/fetch';
import { bulkRate, bulkClear, collectVisibleDocIds } from 'utils/bulk_rating';

describe('bulk_rating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── bulkRate ──────────────────────────────────────────────────────

  describe('bulkRate', () => {
    it('sends PUT with doc_ids and rating', async () => {
      apiFetch.mockResolvedValue({ ok: true });

      await bulkRate(1, 2, ['doc1', 'doc2'], 3);

      expect(apiFetch).toHaveBeenCalledOnce();
      const [url, opts] = apiFetch.mock.calls[0];
      expect(url).toBe('/api/cases/1/queries/2/bulk/ratings');
      expect(opts.method).toBe('PUT');
      expect(JSON.parse(opts.body)).toEqual({ doc_ids: ['doc1', 'doc2'], rating: 3 });
    });

    it('throws on non-ok response', async () => {
      apiFetch.mockResolvedValue({ ok: false, status: 422 });

      await expect(bulkRate(1, 2, ['doc1'], 3)).rejects.toThrow('Bulk rate failed (422)');
    });
  });

  // ── bulkClear ─────────────────────────────────────────────────────

  describe('bulkClear', () => {
    it('sends POST with doc_ids to delete endpoint', async () => {
      apiFetch.mockResolvedValue({ ok: true });

      await bulkClear(1, 2, ['doc1', 'doc2']);

      expect(apiFetch).toHaveBeenCalledOnce();
      const [url, opts] = apiFetch.mock.calls[0];
      expect(url).toBe('/api/cases/1/queries/2/bulk/ratings/delete');
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body)).toEqual({ doc_ids: ['doc1', 'doc2'] });
    });

    it('throws on non-ok response', async () => {
      apiFetch.mockResolvedValue({ ok: false, status: 500 });

      await expect(bulkClear(1, 2, ['doc1'])).rejects.toThrow('Bulk clear failed (500)');
    });
  });

  // ── collectVisibleDocIds ──────────────────────────────────────────

  describe('collectVisibleDocIds', () => {
    it('collects data-doc-id from .document-card elements', () => {
      const container = document.createElement('div');
      ['doc1', 'doc2', 'doc3'].forEach((id) => {
        const card = document.createElement('div');
        card.className = 'document-card';
        card.dataset.docId = id;
        container.appendChild(card);
      });

      expect(collectVisibleDocIds(container)).toEqual(['doc1', 'doc2', 'doc3']);
    });

    it('ignores elements without data-doc-id', () => {
      const container = document.createElement('div');
      const card = document.createElement('div');
      card.className = 'document-card';
      // No data-doc-id
      container.appendChild(card);

      const cardWithId = document.createElement('div');
      cardWithId.className = 'document-card';
      cardWithId.dataset.docId = 'doc1';
      container.appendChild(cardWithId);

      expect(collectVisibleDocIds(container)).toEqual(['doc1']);
    });

    it('ignores non-.document-card elements', () => {
      const container = document.createElement('div');
      const other = document.createElement('div');
      other.dataset.docId = 'not-a-card';
      container.appendChild(other);

      expect(collectVisibleDocIds(container)).toEqual([]);
    });

    it('returns empty array for null container', () => {
      expect(collectVisibleDocIds(null)).toEqual([]);
    });

    it('returns empty array for container with no cards', () => {
      const container = document.createElement('div');
      expect(collectVisibleDocIds(container)).toEqual([]);
    });
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('api/fetch', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('utils/quepid_root', () => ({
  getQuepidRootUrl: vi.fn(() => ''),
  buildApiUrl: vi.fn((_root, ...parts) => `/api/${parts.join('/')}`),
}));

import { apiFetch } from 'api/fetch';
import { applyRating, triggerScoreRefresh } from 'utils/rating_api';

describe('rating_api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Reset debounce state
    triggerScoreRefresh._timers = undefined;
    triggerScoreRefresh._timerSeq = undefined;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── applyRating ───────────────────────────────────────────────────

  describe('applyRating', () => {
    it('sends PUT request to set a rating', async () => {
      apiFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ rating: 3 }),
      });

      const result = await applyRating(1, 2, 'doc1', 3);

      expect(apiFetch).toHaveBeenCalledOnce();
      const [url, opts] = apiFetch.mock.calls[0];
      expect(url).toBe('/api/cases/1/queries/2/ratings');
      expect(opts.method).toBe('PUT');
      const body = JSON.parse(opts.body);
      expect(body.rating.doc_id).toBe('doc1');
      expect(body.rating.rating).toBe(3);
      expect(result).toBe(3);
    });

    it('sends DELETE request to clear a rating (empty string)', async () => {
      apiFetch.mockResolvedValue({ ok: true });

      const result = await applyRating(1, 2, 'doc1', '');

      const [, opts] = apiFetch.mock.calls[0];
      expect(opts.method).toBe('DELETE');
      expect(result).toBeNull();
    });

    it('sends DELETE request to clear a rating (NaN)', async () => {
      apiFetch.mockResolvedValue({ ok: true });

      const result = await applyRating(1, 2, 'doc1', NaN);

      const [, opts] = apiFetch.mock.calls[0];
      expect(opts.method).toBe('DELETE');
      expect(result).toBeNull();
    });

    it('throws on failed PUT', async () => {
      apiFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Invalid rating' }),
      });

      await expect(applyRating(1, 2, 'doc1', 99)).rejects.toThrow('Invalid rating');
    });

    it('throws on failed DELETE', async () => {
      apiFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: 'Not found' }),
      });

      await expect(applyRating(1, 2, 'doc1', '')).rejects.toThrow('Not found');
    });

    it('returns the rating from response body', async () => {
      apiFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ rating: 5 }),
      });

      const result = await applyRating(1, 2, 'doc1', 3);

      // Server returned 5, that takes precedence
      expect(result).toBe(5);
    });

    it('falls back to input rating when response has no rating field', async () => {
      apiFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await applyRating(1, 2, 'doc1', 3);

      expect(result).toBe(3);
    });
  });

  // ── triggerScoreRefresh ───────────────────────────────────────────

  describe('triggerScoreRefresh', () => {
    it('dispatches query-score:refresh event immediately', () => {
      const handler = vi.fn();
      document.addEventListener('query-score:refresh', handler);

      triggerScoreRefresh(1, 2, 3);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0].detail).toEqual({ queryId: 2, caseId: 1 });

      document.removeEventListener('query-score:refresh', handler);
    });

    it('debounces the evaluation API call by 3 seconds', async () => {
      apiFetch.mockResolvedValue({ ok: true });

      triggerScoreRefresh(1, 2, 3);

      // Not called yet (debounced)
      expect(apiFetch).not.toHaveBeenCalled();

      // Advance past debounce
      vi.advanceTimersByTime(3000);

      // Now the API call should be scheduled
      expect(apiFetch).toHaveBeenCalledOnce();
      const [url, opts] = apiFetch.mock.calls[0];
      expect(url).toContain('run_evaluation');
      expect(url).toContain('try_number=3');
      expect(opts.method).toBe('POST');
    });

    it('cancels previous debounced call when called again quickly', () => {
      apiFetch.mockResolvedValue({ ok: true });

      triggerScoreRefresh(1, 2, 3);
      vi.advanceTimersByTime(1000);
      triggerScoreRefresh(1, 2, 3);
      vi.advanceTimersByTime(1000);
      triggerScoreRefresh(1, 2, 3);

      // Only advance to cover the last call's debounce
      vi.advanceTimersByTime(3000);

      // Should only fire once (the last one)
      expect(apiFetch).toHaveBeenCalledOnce();
    });

    it('does not dispatch event when queryId is falsy', () => {
      const handler = vi.fn();
      document.addEventListener('query-score:refresh', handler);

      triggerScoreRefresh(1, null, 3);

      expect(handler).not.toHaveBeenCalled();

      document.removeEventListener('query-score:refresh', handler);
    });

    it('does not schedule evaluation when tryNumber is falsy', () => {
      apiFetch.mockResolvedValue({ ok: true });

      triggerScoreRefresh(1, 2, null);

      vi.advanceTimersByTime(5000);

      expect(apiFetch).not.toHaveBeenCalled();
    });
  });
});

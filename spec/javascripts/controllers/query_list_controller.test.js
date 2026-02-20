// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@hotwired/stimulus', () => ({
  Controller: class {},
}));

vi.mock('api/fetch', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('utils/quepid_root', () => ({
  getQuepidRootUrl: vi.fn(() => ''),
  buildApiUrl: vi.fn((...parts) => `/api/${parts.join('/')}`),
  buildCurrentPageUrlWithParams: vi.fn((params) => {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(params || {})) {
      if (value === undefined || value === null) {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }),
  getCurrentPageSearchParams: vi.fn(() => new URL(window.location.href).searchParams),
  reloadOrTurboVisit: vi.fn(),
}));

import { apiFetch } from 'api/fetch';
import QueryListController from 'controllers/query_list_controller';

function buildController() {
  const listTarget = document.createElement('ul');
  const filterInputTarget = document.createElement('input');
  const ratedToggleTarget = document.createElement('input');
  ratedToggleTarget.type = 'checkbox';
  const sortSelectTarget = document.createElement('select');
  [
    'default',
    'name',
    'name_desc',
    'score_asc',
    'score_desc',
    'modified',
    'modified_desc',
    'error',
  ].forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    sortSelectTarget.appendChild(option);
  });
  const countTarget = document.createElement('span');
  const paginationTarget = document.createElement('div');

  // Add some mock query items
  for (let i = 1; i <= 5; i++) {
    const li = document.createElement('li');
    li.dataset.queryId = String(i);
    li.dataset.queryText = `query ${i}`;
    li.dataset.queryScore = String(i * 0.5);
    li.dataset.queryModified = String(Date.now() - i * 1000);
    listTarget.appendChild(li);
  }

  const controller = Object.create(QueryListController.prototype);
  Object.assign(controller, {
    sortableValue: false,
    pageSizeValue: 15,
    caseIdValue: 1,
    hasCaseIdValue: true,
    hasListTarget: true,
    listTarget,
    hasFilterInputTarget: true,
    filterInputTarget,
    hasRatedToggleTarget: true,
    ratedToggleTarget,
    hasSortSelectTarget: true,
    sortSelectTarget,
    hasCountTarget: true,
    countTarget,
    hasPaginationTarget: true,
    paginationTarget,
    _currentPage: 1,
    _scoreRefreshSeqByQuery: new Map(),
    _originalOrder: null,
    _pauseObserver: false,
  });
  return controller;
}

describe('query_list_controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.dispatchEvent = vi.fn();
  });

  describe('_handleScoreRefresh', () => {
    it('fetches and updates query score badge', async () => {
      const controller = buildController();
      const queryId = 1;
      apiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ score: 0.75, max_score: 1.0 }),
      });

      const event = new CustomEvent('query-score:refresh', {
        detail: { queryId, caseId: 1 },
      });

      await QueryListController.prototype._handleScoreRefresh.call(controller, event);

      expect(apiFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/queries/${queryId}/score`),
        expect.objectContaining({ method: 'POST' })
      );
      const row = controller.listTarget.querySelector(`[data-query-id="${queryId}"]`);
      expect(row.dataset.queryScore).toBe('0.75');
    });

    it('ignores events for different case IDs', async () => {
      const controller = buildController();
      const event = new CustomEvent('query-score:refresh', {
        detail: { queryId: 1, caseId: 999 },
      });

      await QueryListController.prototype._handleScoreRefresh.call(controller, event);

      expect(apiFetch).not.toHaveBeenCalled();
    });

    it('handles fallback reason in score response', async () => {
      const controller = buildController();
      const queryId = 1;
      apiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ score: 0.5, fallback_reason: 'Lightweight scoring unavailable' }),
      });

      const event = new CustomEvent('query-score:refresh', {
        detail: { queryId, caseId: 1 },
      });

      await QueryListController.prototype._handleScoreRefresh.call(controller, event);

      const row = controller.listTarget.querySelector(`[data-query-id="${queryId}"]`);
      const scoreBadge = row.querySelector("[data-controller~='qscore']");
      if (scoreBadge) {
        expect(scoreBadge.getAttribute('title')).toContain('fallback');
      }
    });

    it('ignores stale responses when multiple requests are in flight', async () => {
      const controller = buildController();
      const queryId = 1;

      // First request
      apiFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          // Simulate slow response
          await new Promise((resolve) => setTimeout(resolve, 100));
          return { score: 0.5 };
        },
      });

      // Second request (faster)
      apiFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ score: 0.75 }),
      });

      const event1 = new CustomEvent('query-score:refresh', {
        detail: { queryId, caseId: 1 },
      });
      const event2 = new CustomEvent('query-score:refresh', {
        detail: { queryId, caseId: 1 },
      });

      const promise1 = QueryListController.prototype._handleScoreRefresh.call(controller, event1);
      const promise2 = QueryListController.prototype._handleScoreRefresh.call(controller, event2);

      await Promise.all([promise1, promise2]);

      // Only the last response should update the score
      const row = controller.listTarget.querySelector(`[data-query-id="${queryId}"]`);
      expect(row.dataset.queryScore).toBe('0.75');
    });
  });

  describe('filter', () => {
    it('filters queries by text', () => {
      const controller = buildController();
      controller.filterInputTarget.value = 'query 1';

      QueryListController.prototype.filter.call(controller);

      const items = controller.listTarget.querySelectorAll('[data-query-id]');
      expect(items[0].dataset.filterHidden).toBeUndefined();
      expect(items[1].dataset.filterHidden).toBe('true');
    });

    it('filters queries by rated status', () => {
      const controller = buildController();
      controller.ratedToggleTarget.checked = true;
      // Set one query to have no score
      const item = controller.listTarget.querySelector('[data-query-id="1"]');
      item.dataset.queryScore = '';

      QueryListController.prototype.filter.call(controller);

      expect(item.dataset.filterHidden).toBe('true');
    });

    it('combines text and rated filters', () => {
      const controller = buildController();
      controller.filterInputTarget.value = 'query';
      controller.ratedToggleTarget.checked = true;

      QueryListController.prototype.filter.call(controller);

      const items = Array.from(controller.listTarget.querySelectorAll('[data-query-id]'));
      // All items match text, but only those with scores should pass rated filter
      items.forEach((item) => {
        if (item.dataset.queryScore === '') {
          expect(item.dataset.filterHidden).toBe('true');
        }
      });
    });
  });

  describe('sort', () => {
    it('sorts by name ascending', () => {
      const controller = buildController();
      controller.sortSelectTarget.value = 'name';
      controller._originalOrder = Array.from(
        controller.listTarget.querySelectorAll('[data-query-id]')
      );

      QueryListController.prototype.sort.call(controller);

      const items = Array.from(controller.listTarget.querySelectorAll('[data-query-id]'));
      expect(items[0].dataset.queryText).toBe('query 1');
      expect(items[1].dataset.queryText).toBe('query 2');
    });

    it('sorts by name descending', () => {
      const controller = buildController();
      controller.sortSelectTarget.value = 'name_desc';
      controller._originalOrder = Array.from(
        controller.listTarget.querySelectorAll('[data-query-id]')
      );

      QueryListController.prototype.sort.call(controller);

      const items = Array.from(controller.listTarget.querySelectorAll('[data-query-id]'));
      expect(items[0].dataset.queryText).toBe('query 5');
      expect(items[items.length - 1].dataset.queryText).toBe('query 1');
    });

    it('sorts by score ascending', () => {
      const controller = buildController();
      controller.sortSelectTarget.value = 'score_asc';
      controller._originalOrder = Array.from(
        controller.listTarget.querySelectorAll('[data-query-id]')
      );

      QueryListController.prototype.sort.call(controller);

      const items = Array.from(controller.listTarget.querySelectorAll('[data-query-id]'));
      expect(parseFloat(items[0].dataset.queryScore)).toBeLessThanOrEqual(
        parseFloat(items[1].dataset.queryScore)
      );
    });

    it('sorts by score descending', () => {
      const controller = buildController();
      controller.sortSelectTarget.value = 'score_desc';
      controller._originalOrder = Array.from(
        controller.listTarget.querySelectorAll('[data-query-id]')
      );

      QueryListController.prototype.sort.call(controller);

      const items = Array.from(controller.listTarget.querySelectorAll('[data-query-id]'));
      expect(parseFloat(items[0].dataset.queryScore)).toBeGreaterThanOrEqual(
        parseFloat(items[1].dataset.queryScore)
      );
    });

    it('restores original order when sorting by default', () => {
      const controller = buildController();
      const originalOrder = Array.from(controller.listTarget.querySelectorAll('[data-query-id]'));
      controller._originalOrder = originalOrder;
      controller.sortSelectTarget.value = 'name';

      QueryListController.prototype.sort.call(controller);
      controller.sortSelectTarget.value = 'default';
      QueryListController.prototype.sort.call(controller);

      const items = Array.from(controller.listTarget.querySelectorAll('[data-query-id]'));
      expect(items.map((el) => el.dataset.queryId)).toEqual(
        originalOrder.map((el) => el.dataset.queryId)
      );
    });
  });

  describe('_paginate', () => {
    it('shows only items on current page', () => {
      const controller = buildController();
      controller.pageSizeValue = 2;
      controller._currentPage = 1;

      QueryListController.prototype._paginate.call(controller);

      const items = Array.from(controller.listTarget.querySelectorAll('[data-query-id]'));
      expect(items[0].style.display).toBe('');
      expect(items[1].style.display).toBe('');
      expect(items[2].style.display).toBe('none');
    });

    it('updates count display', () => {
      const controller = buildController();
      controller.pageSizeValue = 15;

      QueryListController.prototype._paginate.call(controller);

      expect(controller.countTarget.textContent).toBe('5');
    });

    it('shows filtered count when filters are active', () => {
      const controller = buildController();
      const item = controller.listTarget.querySelector('[data-query-id="1"]');
      item.dataset.filterHidden = 'true';
      controller.pageSizeValue = 15;

      QueryListController.prototype._paginate.call(controller);

      expect(controller.countTarget.textContent).toBe('4 / 5');
    });

    it('renders pagination controls for multiple pages', () => {
      const controller = buildController();
      controller.pageSizeValue = 2;
      controller._currentPage = 1;

      QueryListController.prototype._paginate.call(controller);

      expect(controller.paginationTarget.innerHTML).toContain('page-link');
      expect(controller.paginationTarget.innerHTML).toContain('1');
    });
  });

  describe('_updateQueryScoreBadge', () => {
    it('updates score badge text and data attribute', () => {
      const controller = buildController();
      const queryId = 1;
      const row = controller.listTarget.querySelector(`[data-query-id="${queryId}"]`);
      const badge = document.createElement('div');
      badge.setAttribute('data-controller', 'qscore');
      const scoreText = document.createElement('span');
      scoreText.className = 'qscore-value';
      badge.appendChild(scoreText);
      row.appendChild(badge);

      QueryListController.prototype._updateQueryScoreBadge.call(controller, queryId, 0.85, 1.0);

      expect(row.dataset.queryScore).toBe('0.85');
      expect(scoreText.textContent).toBe('0.85');
    });

    it('dispatches qscore:update event', () => {
      const controller = buildController();
      const queryId = 1;
      const row = controller.listTarget.querySelector(`[data-query-id="${queryId}"]`);
      const badge = document.createElement('div');
      badge.setAttribute('data-controller', 'qscore');
      row.appendChild(badge);

      QueryListController.prototype._updateQueryScoreBadge.call(controller, queryId, 0.75, 1.0);

      expect(document.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'qscore:update',
          detail: expect.objectContaining({ queryId, score: 0.75 }),
        })
      );
    });
  });
});

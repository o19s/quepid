import { Controller } from '@hotwired/stimulus';
import Sortable from 'sortablejs';
import { apiFetch } from 'api/fetch';
import {
  getQuepidRootUrl,
  reloadOrTurboVisit,
  buildApiUrl,
  buildCurrentPageUrlWithParams,
  getCurrentPageSearchParams,
} from 'utils/quepid_root';

// Query list container for the case/try workspace. Selection is via link (?query_id=).
// When sortable is enabled, initializes SortableJS for drag-and-drop reorder and
// persists order via PUT api/cases/:caseId/queries/:queryId/position.
// Also provides client-side filter (text + rated-only), sort, and visible/total count.
// Listens for "query-score:refresh" events to update individual query scores via
// the lightweight scoring endpoint (no full re-evaluation needed).
export default class extends Controller {
  static values = { sortable: Boolean, pageSize: { type: Number, default: 15 }, caseId: Number };

  static targets = ['list', 'filterInput', 'ratedToggle', 'sortSelect', 'count', 'pagination'];

  connect() {
    this._currentPage = 1;
    this._scoreRefreshSeqByQuery = new Map();

    if (this.sortableValue && this.hasListTarget) {
      this._initSortable();
    }
    this._snapshotOriginalOrder();
    this._restoreSortFromUrl();
    this._restorePageFromUrl();
    this._paginate();

    // Listen for lightweight per-query score refresh events
    this._boundHandleScoreRefresh = this._handleScoreRefresh.bind(this);
    document.addEventListener('query-score:refresh', this._boundHandleScoreRefresh);

    // Watch for Turbo Stream additions/removals so _originalOrder stays fresh
    if (this.hasListTarget) {
      this._observer = new MutationObserver(() => {
        if (this._pauseObserver) return;
        this._snapshotOriginalOrder();
        this._paginate();
      });
      this._observer.observe(this.listTarget, { childList: true });
    }
  }

  disconnect() {
    document.removeEventListener('query-score:refresh', this._boundHandleScoreRefresh);
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
    if (this._sortable) {
      this._sortable.destroy();
      this._sortable = null;
    }
  }

  async _handleScoreRefresh(event) {
    const { queryId, caseId } = event.detail || {};
    if (!queryId || !caseId) return;
    if (this.hasCaseIdValue && Number(caseId) !== this.caseIdValue) return;

    const queryKey = String(queryId);
    const requestSeq = (this._scoreRefreshSeqByQuery.get(queryKey) || 0) + 1;
    this._scoreRefreshSeqByQuery.set(queryKey, requestSeq);

    try {
      const root = getQuepidRootUrl();
      const url = buildApiUrl(root, 'cases', caseId, 'queries', queryId, 'score');
      const res = await apiFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      });
      if (!res.ok) return;
      if (this._scoreRefreshSeqByQuery.get(queryKey) !== requestSeq) return;

      const data = await res.json();
      const score = data.score == null ? '?' : data.score;

      this._updateQueryScoreBadge(queryId, score, data.max_score, data.fallback_reason);
    } catch (err) {
      console.warn('Lightweight score refresh failed:', err);
    }
  }

  _updateQueryScoreBadge(queryId, score, maxScore, fallbackReason = null) {
    if (!this.hasListTarget) return;
    const row = this.listTarget.querySelector(`[data-query-id="${queryId}"]`);
    if (!row) return;

    // Update data attribute for sorting
    row.dataset.queryScore = String(score);
    row.dataset.queryError = score === '?' || score === '' || score == null ? 'true' : 'false';

    // Find and update the score badge (dispatches qscore:update for color)
    const scoreBadge = row.querySelector("[data-controller~='qscore']");
    if (scoreBadge) {
      const scoreText = scoreBadge.querySelector('.qscore-value, .badge');
      if (scoreText) scoreText.textContent = score;
      if (fallbackReason) {
        scoreBadge.setAttribute(
          'title',
          'Using fallback score while lightweight scoring is unavailable.'
        );
      } else {
        scoreBadge.removeAttribute('title');
      }

      // Dispatch qscore:update for color recalculation
      document.dispatchEvent(
        new CustomEvent('qscore:update', {
          detail: { queryId, caseId: this.caseIdValue, score, maxScore },
        })
      );
    }
  }

  expandAll() {
    this._toggleAllQueryExpand(true);
  }

  collapseAll() {
    this._toggleAllQueryExpand(false);
  }

  _toggleAllQueryExpand(expand) {
    if (!this.hasListTarget) return;
    const rows = this.listTarget.querySelectorAll("[data-controller~='query-expand']");
    let delay = 0;
    rows.forEach((row) => {
      const app = this.application;
      const controller = app.getControllerForElementAndIdentifier(row, 'query-expand');
      if (!controller) return;
      const resultsTarget = row.querySelector("[data-query-expand-target='inlineResults']");
      if (!resultsTarget) return;
      const isExpanded = !resultsTarget.classList.contains('d-none');
      if (expand && !isExpanded) {
        // Stagger fetches by 50ms to avoid hammering the API
        setTimeout(() => controller.toggle(), delay);
        delay += 50;
      } else if (!expand && isExpanded) {
        controller.toggle(); // Collapse is instant, no stagger needed
      }
    });
  }

  _snapshotOriginalOrder() {
    if (this.hasListTarget) {
      this._originalOrder = Array.from(this.listTarget.querySelectorAll('[data-query-id]'));
    }
  }

  filter() {
    if (!this.hasListTarget) return;

    const text = this.hasFilterInputTarget ? this.filterInputTarget.value.toLowerCase().trim() : '';
    const ratedOnly = this.hasRatedToggleTarget ? this.ratedToggleTarget.checked : false;

    const items = this.listTarget.querySelectorAll('[data-query-id]');
    items.forEach((li) => {
      const queryText = li.dataset.queryText || '';
      const queryScore = li.dataset.queryScore || '';

      const matchesText = !text || queryText.includes(text);
      const matchesRated = !ratedOnly || (queryScore !== '' && queryScore !== '?');

      if (matchesText && matchesRated) {
        delete li.dataset.filterHidden;
      } else {
        li.dataset.filterHidden = 'true';
      }
    });

    this._currentPage = 1;
    this._paginate();
  }

  sort() {
    if (!this.hasListTarget || !this.hasSortSelectTarget) return;

    const sortBy = this.sortSelectTarget.value;
    const list = this.listTarget;
    const items = Array.from(list.querySelectorAll('[data-query-id]'));

    // Pause observer during reorder to avoid overwriting _originalOrder
    this._pauseObserver = true;
    try {
      if (sortBy === 'default' && this._originalOrder) {
        // Restore original order
        this._originalOrder.forEach((li) => {
          if (li.parentNode === list) list.appendChild(li);
        });
      } else if (sortBy === 'name' || sortBy === 'name_desc') {
        const dir = sortBy === 'name_desc' ? -1 : 1;
        items.sort(
          (a, b) => dir * (a.dataset.queryText || '').localeCompare(b.dataset.queryText || '')
        );
        items.forEach((li) => list.appendChild(li));
      } else if (sortBy === 'score_asc' || sortBy === 'score_desc') {
        items.sort((a, b) => {
          const sa = this._parseScore(a.dataset.queryScore);
          const sb = this._parseScore(b.dataset.queryScore);
          return sortBy === 'score_asc' ? sa - sb : sb - sa;
        });
        items.forEach((li) => list.appendChild(li));
      } else if (sortBy === 'modified' || sortBy === 'modified_desc') {
        const dir = sortBy === 'modified_desc' ? -1 : 1;
        items.sort((a, b) => {
          const ma = parseInt(a.dataset.queryModified || '0', 10);
          const mb = parseInt(b.dataset.queryModified || '0', 10);
          return dir * (ma - mb);
        });
        items.forEach((li) => list.appendChild(li));
      } else if (sortBy === 'error') {
        items.sort((a, b) => {
          const aErr = a.dataset.queryError === 'true' ? 0 : 1;
          const bErr = b.dataset.queryError === 'true' ? 0 : 1;
          if (aErr !== bErr) return aErr - bErr;
          return (a.dataset.queryText || '').localeCompare(b.dataset.queryText || '');
        });
        items.forEach((li) => list.appendChild(li));
      }
    } finally {
      this._pauseObserver = false;
    }

    // Persist sort choice in URL
    this._persistSortToUrl(sortBy);
    this._currentPage = 1;
    this._paginate();
  }

  _persistSortToUrl(sortBy) {
    const params = sortBy && sortBy !== 'default' ? { sort: sortBy } : { sort: null };
    window.history.replaceState({}, '', buildCurrentPageUrlWithParams(params));
  }

  _restoreSortFromUrl() {
    const sort = getCurrentPageSearchParams().get('sort');
    if (sort && this.hasSortSelectTarget) {
      const option = this.sortSelectTarget.querySelector(`option[value="${sort}"]`);
      if (option) {
        this.sortSelectTarget.value = sort;
        this.sort();
      }
    }
  }

  _parseScore(val) {
    if (val === '' || val === '?' || val == null) return -Infinity;
    const n = parseFloat(val);
    return isNaN(n) ? -Infinity : n;
  }

  _updateCount() {
    if (!this.hasCountTarget || !this.hasListTarget) return;

    const all = this.listTarget.querySelectorAll('[data-query-id]');
    const total = all.length;
    // Count non-filter-hidden items (not paginated visibility) so the badge
    // reflects how many queries match the current filter, not how many are
    // on the current page.
    const filtered = Array.from(all).filter((li) => !li.dataset.filterHidden);

    if (filtered.length === total) {
      this.countTarget.textContent = total;
    } else {
      this.countTarget.textContent = `${filtered.length} / ${total}`;
    }
  }

  goToPage(event) {
    event.preventDefault();
    const page = parseInt(event.currentTarget.dataset.page, 10);
    if (page) {
      this._currentPage = page;
      this._paginate();
    }
  }

  nextPage(event) {
    event.preventDefault();
    const totalPages = this._totalPages();
    if (this._currentPage < totalPages) {
      this._currentPage++;
      this._paginate();
    }
  }

  prevPage(event) {
    event.preventDefault();
    if (this._currentPage > 1) {
      this._currentPage--;
      this._paginate();
    }
  }

  _paginate() {
    if (!this.hasListTarget) return;

    const all = Array.from(this.listTarget.querySelectorAll('[data-query-id]'));
    const visible = all.filter((li) => !li.dataset.filterHidden);
    const pageSize = this.pageSizeValue;
    const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));

    // Clamp current page
    if (this._currentPage > totalPages) this._currentPage = totalPages;
    if (this._currentPage < 1) this._currentPage = 1;

    const startIdx = (this._currentPage - 1) * pageSize;
    const endIdx = startIdx + pageSize;

    // Hide all, then show only items on current page
    all.forEach((li) => {
      li.style.display = 'none';
    });
    visible.forEach((li, idx) => {
      if (idx >= startIdx && idx < endIdx) {
        li.style.display = '';
      }
    });

    this._updateCount();
    this._renderPaginationControls(totalPages);
    this._persistPageToUrl();
  }

  _totalPages() {
    if (!this.hasListTarget) return 1;
    const all = this.listTarget.querySelectorAll('[data-query-id]');
    const visible = Array.from(all).filter((li) => !li.dataset.filterHidden);
    return Math.max(1, Math.ceil(visible.length / this.pageSizeValue));
  }

  _renderPaginationControls(totalPages) {
    if (!this.hasPaginationTarget) return;

    if (totalPages <= 1) {
      this.paginationTarget.innerHTML = '';
      return;
    }

    const current = this._currentPage;
    let html =
      '<nav aria-label="Query pagination"><ul class="pagination pagination-sm justify-content-center mb-0 mt-2">';

    // Previous
    html += `<li class="page-item${current <= 1 ? ' disabled' : ''}"><a class="page-link" href="#" data-action="click->query-list#prevPage">&laquo;</a></li>`;

    // Page numbers (show max 7 pages with ellipsis)
    const pages = this._pageRange(current, totalPages);
    for (const p of pages) {
      if (p === '...') {
        html += '<li class="page-item disabled"><span class="page-link">…</span></li>';
      } else {
        html += `<li class="page-item${p === current ? ' active' : ''}"><a class="page-link" href="#" data-action="click->query-list#goToPage" data-page="${p}">${p}</a></li>`;
      }
    }

    // Next
    html += `<li class="page-item${current >= totalPages ? ' disabled' : ''}"><a class="page-link" href="#" data-action="click->query-list#nextPage">&raquo;</a></li>`;
    html += '</ul></nav>';

    this.paginationTarget.innerHTML = html;
  }

  _pageRange(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = [];
    pages.push(1);
    if (current > 3) pages.push('...');
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
      pages.push(i);
    }
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
  }

  _persistPageToUrl() {
    const params = this._currentPage > 1 ? { page: this._currentPage } : { page: null };
    window.history.replaceState({}, '', buildCurrentPageUrlWithParams(params));
  }

  _restorePageFromUrl() {
    const page = parseInt(getCurrentPageSearchParams().get('page'), 10);
    if (page && page > 0) this._currentPage = page;
  }

  _initSortable() {
    const list = this.listTarget;
    this._sortable = Sortable.create(list, {
      animation: 150,
      handle: '.query-drag-handle',
      ghostClass: 'opacity-50',
      onEnd: (evt) => this._onSortEnd(evt),
    });
  }

  async _onSortEnd(evt) {
    const { item, oldIndex, newIndex } = evt;
    if (oldIndex === newIndex) return;

    const caseId = this.caseIdValue;
    if (!caseId) return;

    const queryId = parseInt(item.dataset.queryId, 10);
    if (!queryId) return;

    const list = this.listTarget;
    const items = Array.from(list.querySelectorAll('[data-query-id]'));
    const movedIndex = items.findIndex((el) => parseInt(el.dataset.queryId, 10) === queryId);

    // move_to(afterId, reverse): reverse=true = prepend before that node; reverse=false = place after that node
    let afterId, reverse;
    if (movedIndex === 0) {
      // Moved to top: prepend before the current first
      reverse = true;
      afterId = items[1] ? parseInt(items[1].dataset.queryId, 10) : null;
    } else {
      // Moved down: place after the previous item
      reverse = false;
      afterId = parseInt(items[movedIndex - 1].dataset.queryId, 10);
    }
    if (afterId == null) return;

    const root = getQuepidRootUrl();
    const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    const url = buildApiUrl(root, 'cases', caseId, 'queries', queryId, 'position');

    this._sortable?.option('disabled', true);
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          'X-CSRF-Token': token || '',
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ after: afterId, reverse }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || res.statusText);
      }

      if (window.flash) window.flash.success = 'Query order updated.';
    } catch (err) {
      console.error('Update query position failed:', err);
      if (window.flash) window.flash.error = 'Could not update query order. ' + (err.message || '');
      // Revert by reloading
      reloadOrTurboVisit();
    } finally {
      this._sortable?.option('disabled', false);
    }
  }
}

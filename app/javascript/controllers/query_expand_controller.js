import { Controller } from '@hotwired/stimulus';
import { applyRating, triggerScoreRefresh } from 'utils/rating_api';
import { fetchResultsHtml, parseResultsHtml } from 'utils/results_fetcher';
import { toggleRatingPopover, disposePopovers } from 'utils/rating_popover';
import { bulkRate, bulkClear, collectVisibleDocIds } from 'utils/bulk_rating';
import { openDetailModal } from 'utils/detail_modal';

// Full inline results controller for a single query row.
// Each query row in the list gets its own instance. Expands in-place to show
// search results with rating, bulk rating, detail modal, load more, diff mode.
//
// Usage: data-controller="query-expand" on the <li> element.
const PAGE_SIZE = 10;

export default class extends Controller {
  static values = {
    caseId: Number,
    tryNumber: Number,
    queryId: Number,
    queryText: String,
    scale: Array,
    scaleLabels: { type: Object, default: {} },
  };

  static targets = [
    'inlineResults',
    'chevron',
    'resultsContainer',
    'loadingIndicator',
    'errorMessage',
    'errorText',
    'bulkRatingBar',
    'showOnlyRatedToggle',
    'diffIndicator',
    'ratingAnnouncement',
    'resultCount',
  ];

  connect() {
    this._expanded = false;
    this._loaded = false;
    this._fetchRequestId = 0;
    this._popovers = new Map();
    this._currentStart = 0;
    this._lastNumFound = 0;
    this._showOnlyRated = false;
    this._diffSnapshotIds = [];

    // Delegated click handler scoped to this element (not document-level)
    this._boundResultsClick = this._handleResultsClick.bind(this);
    this.element.addEventListener('click', this._boundResultsClick);

    // Keyboard support for rating triggers
    this._boundResultsKeydown = this._handleResultsKeydown.bind(this);
    this.element.addEventListener('keydown', this._boundResultsKeydown);

    // Global diff event
    this._boundDiffChanged = this._handleDiffChanged.bind(this);
    document.addEventListener('diff-snapshots-changed', this._boundDiffChanged);

    this._initDiffState();
  }

  disconnect() {
    this.element.removeEventListener('click', this._boundResultsClick);
    this.element.removeEventListener('keydown', this._boundResultsKeydown);
    document.removeEventListener('diff-snapshots-changed', this._boundDiffChanged);
    disposePopovers(this._popovers);
  }

  // ── Toggle expand/collapse ──────────────────────────────────────────

  toggle(event) {
    event.preventDefault();
    event.stopPropagation();

    this._expanded = !this._expanded;

    if (this.hasChevronTarget) {
      this.chevronTarget.classList.toggle('query-expand-chevron--expanded', this._expanded);
    }

    if (this._expanded) {
      if (!this._loaded) {
        this._fetchResults();
      }
      if (this.hasInlineResultsTarget) {
        this.inlineResultsTarget.classList.remove('d-none');
      }
    } else {
      if (this.hasInlineResultsTarget) {
        this.inlineResultsTarget.classList.add('d-none');
      }
    }
  }

  // ── Fetch and render results ────────────────────────────────────────

  async _fetchResults(append = false) {
    if (!this.caseIdValue || !this.tryNumberValue || !this.queryIdValue) return;

    const requestId = ++this._fetchRequestId;
    const start = append ? this._currentStart : 0;

    this._setLoading(true);
    this._clearError();

    if (!append) {
      this._currentStart = 0;
      this._lastNumFound = 0;
    }

    try {
      const res = await fetchResultsHtml({
        caseId: this.caseIdValue,
        tryNumber: this.tryNumberValue,
        queryId: this.queryIdValue,
        rows: PAGE_SIZE,
        start,
        diffSnapshotIds: this._diffSnapshotIds,
        showOnlyRated: this._showOnlyRated,
      });
      const text = await res.text();

      if (requestId !== this._fetchRequestId) return;

      if (!res.ok) {
        throw new Error(`Search failed (${res.status})`);
      }

      this._renderHtmlResults(text, append);
      this._loaded = true;
    } catch (err) {
      if (requestId !== this._fetchRequestId) return;
      this._showError(err.message);
    } finally {
      if (requestId === this._fetchRequestId) {
        this._setLoading(false);
      }
    }
  }

  _renderHtmlResults(htmlText, append = false) {
    if (!this.hasResultsContainerTarget) return;

    disposePopovers(this._popovers);

    const { numFound, headerEl, cards, loadMoreEl } = parseResultsHtml(htmlText);

    this._showBulkRatingBar(cards.length > 0);
    this._updateResultCount(numFound);

    if (append && this.resultsContainerTarget.querySelector('.document-card')) {
      this._lastNumFound = numFound;
      this._currentStart += cards.length;
      const loadMoreArea = this.resultsContainerTarget.querySelector(
        "[data-results-pane-target='loadMoreArea']"
      );
      cards.forEach((card) => {
        if (loadMoreArea) {
          loadMoreArea.insertAdjacentElement('beforebegin', card.cloneNode(true));
        } else {
          this.resultsContainerTarget.appendChild(card.cloneNode(true));
        }
      });
      if (loadMoreArea && loadMoreEl) {
        loadMoreArea.replaceWith(loadMoreEl.cloneNode(true));
      }
    } else {
      this._lastNumFound = numFound;
      this._currentStart = cards.length;
      const nodes = [];
      if (headerEl) nodes.push(headerEl.cloneNode(true));
      cards.forEach((card) => nodes.push(card.cloneNode(true)));
      if (loadMoreEl) nodes.push(loadMoreEl.cloneNode(true));
      this.resultsContainerTarget.replaceChildren(...nodes);
    }
  }

  // ── Loading / Error states ──────────────────────────────────────────

  _setLoading(loading) {
    if (this.hasLoadingIndicatorTarget) {
      this.loadingIndicatorTarget.classList.toggle('d-none', !loading);
    }
  }

  _clearError() {
    if (this.hasErrorMessageTarget) {
      this.errorMessageTarget.classList.add('d-none');
      if (this.hasErrorTextTarget) this.errorTextTarget.textContent = '';
    }
  }

  _showError(message) {
    if (this.hasErrorMessageTarget) {
      if (this.hasErrorTextTarget) {
        this.errorTextTarget.textContent = message;
      } else {
        this.errorMessageTarget.textContent = message;
      }
      this.errorMessageTarget.classList.remove('d-none');
    }
  }

  dismissError() {
    this._clearError();
  }

  // ── Result count badge ──────────────────────────────────────────────

  _updateResultCount(numFound) {
    if (this.hasResultCountTarget) {
      this.resultCountTarget.textContent = numFound > 0 ? `${numFound} results` : '';
    }
  }

  // ── Click delegation ────────────────────────────────────────────────

  _handleResultsClick(event) {
    // Rating trigger (the badge on each document card)
    const ratingTrigger = event.target.closest('[data-rating-trigger]');
    if (ratingTrigger) {
      event.preventDefault();
      event.stopPropagation();
      this._handleRatingTrigger(ratingTrigger);
      return;
    }

    // Rating button inside popover
    const ratingBtn = event.target.closest('[data-rating-value]');
    if (ratingBtn) {
      // Only handle if inside our element (not bulk rating bar buttons handled by Stimulus actions)
      const wrapper = ratingBtn.closest('[data-rating-doc-id]');
      if (wrapper) {
        event.preventDefault();
        event.stopPropagation();
        const docId = wrapper.dataset.ratingDocId;
        const ratingVal = ratingBtn.dataset.ratingValue;
        const rating = ratingVal === '' ? NaN : parseInt(ratingVal, 10);
        if (docId != null) this._applyInlineRating(docId, rating);
        return;
      }
    }

    // Detail modal button
    const detailBtn = event.target.closest('[data-results-pane-details]');
    if (detailBtn) {
      event.preventDefault();
      this._openDetailModal(detailBtn);
      return;
    }

    // Load more button
    const loadMoreBtn = event.target.closest('[data-results-pane-load-more]');
    if (loadMoreBtn) {
      event.preventDefault();
      this._loadMore();
    }
  }

  _handleResultsKeydown(event) {
    const ratingTrigger = event.target.closest('[data-rating-trigger]');
    if (!ratingTrigger) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this._handleRatingTrigger(ratingTrigger);
    }
  }

  // ── Rating ──────────────────────────────────────────────────────────

  _handleRatingTrigger(triggerEl) {
    const docId = triggerEl.closest('[data-doc-id]')?.dataset?.docId;
    if (!docId) return;
    toggleRatingPopover(
      this._popovers,
      triggerEl,
      docId,
      this.scaleValue || [0, 1, 2, 3],
      this.scaleLabelsValue || {}
    );
  }

  async _applyInlineRating(docId, rating) {
    if (!this.caseIdValue || !this.queryIdValue) return;

    const isClear = rating === '' || (typeof rating === 'number' && isNaN(rating));

    try {
      const newRating = await applyRating(this.caseIdValue, this.queryIdValue, docId, rating);
      this._updateDocCardRating(docId, isClear ? '' : String(newRating ?? rating));
      this._announceRatingChange(docId, isClear ? '' : String(rating));
      triggerScoreRefresh(this.caseIdValue, this.queryIdValue, this.tryNumberValue);
      this._popovers.get(docId)?.hide();
    } catch (err) {
      console.error('Inline rating failed:', err);
    }
  }

  _updateDocCardRating(docId, rating) {
    if (!this.hasResultsContainerTarget) return;
    const card = this.resultsContainerTarget.querySelector(
      `[data-doc-id="${CSS.escape(String(docId))}"]`
    );
    if (!card) return;
    const badge = card.querySelector('.rating-badge');
    if (!badge) return;
    const ratingEl = document.createElement('span');
    ratingEl.dataset.ratingTrigger = '';
    ratingEl.tabIndex = 0;
    ratingEl.setAttribute('role', 'button');
    if (rating !== '') {
      ratingEl.className = 'badge bg-primary';
      ratingEl.textContent = String(rating);
      ratingEl.title = 'Click to change rating';
      ratingEl.setAttribute('aria-label', `Current rating ${rating}. Click to change rating`);
    } else {
      ratingEl.className = 'badge bg-secondary';
      ratingEl.textContent = 'Rate';
      ratingEl.title = 'Click to rate';
      ratingEl.setAttribute('aria-label', 'No rating. Click to rate');
    }
    badge.replaceChildren(ratingEl);
  }

  // ── Bulk rating ─────────────────────────────────────────────────────

  async bulkRate(event) {
    const rating = parseInt(event.currentTarget.dataset.ratingValue, 10);
    if (isNaN(rating)) return;
    if (!this.hasResultsContainerTarget) return;
    const docIds = collectVisibleDocIds(this.resultsContainerTarget);
    if (docIds.length === 0) return;

    try {
      await bulkRate(this.caseIdValue, this.queryIdValue, docIds, rating);
      triggerScoreRefresh(this.caseIdValue, this.queryIdValue, this.tryNumberValue);
      this._loaded = false;
      this._fetchResults();
    } catch (err) {
      console.error('Bulk rating failed:', err);
    }
  }

  async bulkClear() {
    if (!this.hasResultsContainerTarget) return;
    const docIds = collectVisibleDocIds(this.resultsContainerTarget);
    if (docIds.length === 0) return;
    if (!confirm(`Clear all ratings for ${docIds.length} documents?`)) return;

    try {
      await bulkClear(this.caseIdValue, this.queryIdValue, docIds);
      triggerScoreRefresh(this.caseIdValue, this.queryIdValue, this.tryNumberValue);
      this._loaded = false;
      this._fetchResults();
    } catch (err) {
      console.error('Bulk clear failed:', err);
    }
  }

  _showBulkRatingBar(visible) {
    if (this.hasBulkRatingBarTarget) {
      this.bulkRatingBarTarget.classList.toggle('d-none', !visible);
    }
  }

  // ── Show only rated toggle ──────────────────────────────────────────

  toggleShowOnlyRated() {
    this._showOnlyRated =
      this.hasShowOnlyRatedToggleTarget && this.showOnlyRatedToggleTarget.checked;
    this._loaded = false;
    this._fetchResults();
  }

  // ── Load more ───────────────────────────────────────────────────────

  async _loadMore() {
    await this._fetchResults(true);
  }

  // ── Detail modal ────────────────────────────────────────────────────

  async _openDetailModal(triggerEl) {
    const modalEl = document.getElementById('document-detail-modal');
    if (!modalEl) return;

    await openDetailModal({
      triggerEl,
      modalEl,
      targets: {
        title: document.getElementById('document-detail-modal-title'),
        fieldsList: document.getElementById('document-detail-fields-list'),
        jsonPre: document.getElementById('document-detail-json-pre'),
        jsonTextarea: document.getElementById('document-detail-json-textarea'),
        viewSourceBtn: document.getElementById('document-detail-view-source-btn'),
        copyJsonBtn: document.getElementById('document-detail-copy-json-btn'),
      },
      caseId: this.caseIdValue,
      tryNumber: this.tryNumberValue,
      queryId: this.queryIdValue,
      initJsonTree: (pre) => this._initJsonTree(pre),
    });
  }

  _initJsonTree(pre) {
    const container = pre.parentElement;
    if (!container) return;

    const existing = container.querySelector('.json-tree');
    if (existing) existing.remove();

    pre.style.display = '';
    container.setAttribute('data-controller', 'json-tree');
    pre.setAttribute('data-json-tree-target', 'source');

    const app = this.application;
    if (app) {
      requestAnimationFrame(() => {
        const ctrl = app.getControllerForElementAndIdentifier(container, 'json-tree');
        if (ctrl) {
          ctrl.sourceTargets.forEach((src) => {
            const oldTree = src.nextElementSibling;
            if (oldTree?.classList?.contains('json-tree')) oldTree.remove();
            src.style.display = '';
          });
          ctrl.connect();
        }
      });
    }
  }

  // ── Diff mode ───────────────────────────────────────────────────────

  _initDiffState() {
    const workspace = document.querySelector('[data-controller~="workspace"]');
    const ids = (workspace?.dataset?.diffSnapshotIds || '').split(',').filter(Boolean);
    this._diffSnapshotIds = ids;
    this._updateDiffIndicator();
  }

  _handleDiffChanged(event) {
    this._diffSnapshotIds = event.detail?.snapshotIds || [];
    this._updateDiffIndicator();
    if (this._expanded && this._loaded) {
      this._loaded = false;
      this._fetchResults();
    }
  }

  _updateDiffIndicator() {
    if (!this.hasDiffIndicatorTarget) return;
    this.diffIndicatorTarget.classList.toggle('d-none', this._diffSnapshotIds.length === 0);
  }

  // ── Accessibility ───────────────────────────────────────────────────

  _announceRatingChange(docId, rating) {
    if (!this.hasRatingAnnouncementTarget) return;
    this.ratingAnnouncementTarget.textContent =
      rating === ''
        ? `Cleared rating for document ${docId}.`
        : `Set rating ${rating} for document ${docId}.`;
  }
}

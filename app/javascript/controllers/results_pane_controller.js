import { Controller } from '@hotwired/stimulus';
import { applyRating, triggerScoreRefresh } from 'utils/rating_api';
import { fetchResultsHtml, parseResultsHtml } from 'utils/results_fetcher';
import { toggleRatingPopover, disposePopovers } from 'utils/rating_popover';
import { bulkRate, bulkClear, collectVisibleDocIds } from 'utils/bulk_rating';
import { openDetailModal } from 'utils/detail_modal';

// Holds the results pane region for the case/try workspace. When a query is selected,
// fetches server-rendered search results (DocumentCardComponent) from the query execution
// API and displays them. Supports inline rating via popover on each document card.
// Diff mode appends diff_snapshot_ids[] to the search URL so the server renders diff badges.
// Uses _fetchRequestId to ignore stale responses when the user switches queries quickly.
export default class extends Controller {
  static values = {
    caseId: Number,
    tryNumber: Number,
    queryId: Number,
    queryText: String, // Query text for snapshot search (diff mode)
    scale: Array, // Scorer scale for rating popover (e.g. [0,1,2,3])
    scaleLabels: Object, // Optional labels: { "0": "Not Relevant", "3": "Perfect" }
    skipFetch: Boolean, // When true (e.g. results_content slot provided), do not fetch; preserve slot content
  };

  static targets = [
    'resultsContainer',
    'loadingIndicator',
    'errorMessage',
    'errorText',
    'diffIndicator',
    'loadMoreArea',
    'detailModal',
    'detailModalTitle',
    'detailFieldsList',
    'detailJsonPre',
    'detailJsonTextarea',
    'detailJsonContainer',
    'detailModalBody',
    'viewSourceBtn',
    'copyJsonBtn',
    'showOnlyRatedToggle',
    'bulkRatingBar',
    'ratingAnnouncement',
  ];

  connect() {
    this._fetchRequestId = 0;
    this._popovers = new Map();
    this._pageSize = 10;
    this._currentStart = 0;
    this._lastNumFound = 0;
    this._diffSnapshotIds = [];
    this._showOnlyRated = false;
    this._boundHandleResultsClick = this._handleResultsClick.bind(this);
    this._boundHandleResultsKeydown = this._handleResultsKeydown.bind(this);
    this._boundHandleDiffChanged = this._handleDiffChanged.bind(this);
    document.addEventListener('click', this._boundHandleResultsClick);
    document.addEventListener('keydown', this._boundHandleResultsKeydown);
    document.addEventListener('diff-snapshots-changed', this._boundHandleDiffChanged);
    this._updateDiffIndicator();
    if (this._canFetch()) {
      this.fetchResults();
    } else if (this.hasResultsContainerTarget && this.hasQueryIdValue && !this.queryIdValue) {
      this.clearResults();
    }
  }

  disconnect() {
    document.removeEventListener('diff-snapshots-changed', this._boundHandleDiffChanged);
    document.removeEventListener('click', this._boundHandleResultsClick);
    document.removeEventListener('keydown', this._boundHandleResultsKeydown);
    disposePopovers(this._popovers);
  }

  _handleDiffChanged(event) {
    this._diffSnapshotIds = event.detail?.snapshotIds || [];
    this._updateDiffIndicator();
    if (this._canFetch()) {
      this.fetchResults();
    }
  }

  _updateDiffIndicator() {
    if (!this.hasDiffIndicatorTarget) return;
    const workspace = document.querySelector('[data-controller~="workspace"]');
    const ids = this._diffSnapshotIds?.length
      ? this._diffSnapshotIds
      : (workspace?.dataset?.diffSnapshotIds || '').split(',').filter(Boolean);
    this._diffSnapshotIds = ids;
    this.diffIndicatorTarget.classList.toggle('d-none', ids.length === 0);
  }

  _handleResultsKeydown(event) {
    if (!this.hasResultsContainerTarget) return;
    const ratingTrigger = event.target.closest('[data-rating-trigger]');
    if (!ratingTrigger) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this._handleRatingTrigger(ratingTrigger);
    }
  }

  _handleResultsClick(event) {
    const ratingTrigger = event.target.closest('[data-rating-trigger]');
    if (ratingTrigger) {
      event.preventDefault();
      this._handleRatingTrigger(ratingTrigger);
      return;
    }
    const ratingBtn = event.target.closest('[data-rating-value]');
    if (ratingBtn) {
      event.preventDefault();
      const wrapper = ratingBtn.closest('[data-rating-doc-id]');
      const docId = wrapper?.dataset?.ratingDocId;
      const ratingVal = ratingBtn.dataset.ratingValue;
      const rating = ratingVal === '' ? NaN : parseInt(ratingVal, 10);
      if (docId != null) {
        this._applyRating(docId, rating);
      }
      return;
    }
    const detailBtn = event.target.closest('[data-results-pane-details]');
    if (detailBtn) {
      event.preventDefault();
      this._openDetailModal(detailBtn);
      return;
    }
    const loadMoreBtn = event.target.closest('[data-results-pane-load-more]');
    if (loadMoreBtn) {
      event.preventDefault();
      this._loadMore();
    }
  }

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

  async _applyRating(docId, rating) {
    if (!this.caseIdValue || !this.queryIdValue) return;

    const isClear = rating === '' || (typeof rating === 'number' && isNaN(rating));

    try {
      const newRating = await applyRating(this.caseIdValue, this.queryIdValue, docId, rating);
      this._updateDocCardRating(docId, isClear ? '' : String(newRating ?? rating));
      this._announceRatingChange(docId, isClear ? '' : String(rating));
      this._triggerScoreRefresh();
      this._popovers.get(docId)?.hide();
    } catch (err) {
      console.error('Rating update failed:', err);
      if (window.flash) window.flash.error = err.message;
    }
  }

  _updateDocCardRating(docId, rating) {
    const card = this.resultsContainerTarget?.querySelector(
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

  _triggerScoreRefresh() {
    if (!this.caseIdValue) return;
    triggerScoreRefresh(this.caseIdValue, this.queryIdValue, this.tryNumberValue);
  }

  queryIdValueChanged() {
    if (this.hasQueryIdValue && this.queryIdValue) {
      this.fetchResults();
    } else {
      this.clearResults();
    }
  }

  _canFetch() {
    if (this.hasSkipFetchValue && this.skipFetchValue) return false;
    return this.hasQueryIdValue && this.queryIdValue && this.caseIdValue && this.tryNumberValue;
  }

  async fetchResults(append = false) {
    if (!this._canFetch()) return;

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
        rows: this._pageSize,
        start,
        diffSnapshotIds: this._diffSnapshotIds || [],
        showOnlyRated: this._showOnlyRated,
      });
      const text = await res.text();

      if (requestId !== this._fetchRequestId) return;

      if (!res.ok) {
        throw new Error(`Search failed (${res.status})`);
      }

      this._renderHtmlResults(text, append);
    } catch (err) {
      if (requestId !== this._fetchRequestId) return;
      this._showError(err.message);
    } finally {
      if (requestId === this._fetchRequestId) {
        this._setLoading(false);
      }
    }
  }

  clearResults() {
    if (this.hasResultsContainerTarget) {
      this.resultsContainerTarget.replaceChildren();
    }
    this._clearError();
    this._showBulkRatingBar(false);
  }

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
    // Only clear results if there were none before (preserve existing results on error)
    if (
      this.hasResultsContainerTarget &&
      !this.resultsContainerTarget.querySelector('.document-card')
    ) {
      this.resultsContainerTarget.replaceChildren();
    }
  }

  dismissError() {
    this._clearError();
  }

  toggleShowOnlyRated() {
    this._showOnlyRated =
      this.hasShowOnlyRatedToggleTarget && this.showOnlyRatedToggleTarget.checked;
    if (this._canFetch()) this.fetchResults();
  }

  async bulkRate(event) {
    const rating = parseInt(event.currentTarget.dataset.ratingValue, 10);
    if (isNaN(rating)) return;
    const docIds = collectVisibleDocIds(this.resultsContainerTarget);
    if (docIds.length === 0) return;

    try {
      await bulkRate(this.caseIdValue, this.queryIdValue, docIds, rating);
      this._triggerScoreRefresh();
      if (this._canFetch()) this.fetchResults();
    } catch (err) {
      console.error('Bulk rating failed:', err);
    }
  }

  async bulkClear() {
    const docIds = collectVisibleDocIds(this.resultsContainerTarget);
    if (docIds.length === 0) return;
    if (!confirm(`Clear all ratings for ${docIds.length} documents?`)) return;

    try {
      await bulkClear(this.caseIdValue, this.queryIdValue, docIds);
      this._triggerScoreRefresh();
      if (this._canFetch()) this.fetchResults();
    } catch (err) {
      console.error('Bulk clear failed:', err);
    }
  }

  _renderHtmlResults(htmlText, append = false) {
    if (!this.hasResultsContainerTarget) return;

    disposePopovers(this._popovers);

    const { numFound, headerEl, cards, loadMoreEl } = parseResultsHtml(htmlText);

    this._showBulkRatingBar(cards.length > 0);

    if (append && this.resultsContainerTarget.querySelector('p.text-muted.small.mb-2')) {
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

  _showBulkRatingBar(visible) {
    if (this.hasBulkRatingBarTarget) {
      this.bulkRatingBarTarget.classList.toggle('d-none', !visible);
    }
  }

  async _loadMore() {
    if (!this._canFetch()) return;
    await this.fetchResults(true);
  }

  async _openDetailModal(triggerEl) {
    await openDetailModal({
      triggerEl,
      modalEl: this.hasDetailModalTarget ? this.detailModalTarget : null,
      targets: {
        title: this.hasDetailModalTitleTarget ? this.detailModalTitleTarget : null,
        fieldsList: this.hasDetailFieldsListTarget ? this.detailFieldsListTarget : null,
        jsonPre: this.hasDetailJsonPreTarget ? this.detailJsonPreTarget : null,
        jsonTextarea: this.hasDetailJsonTextareaTarget ? this.detailJsonTextareaTarget : null,
        viewSourceBtn: this.hasViewSourceBtnTarget ? this.viewSourceBtnTarget : null,
        copyJsonBtn: this.hasCopyJsonBtnTarget ? this.copyJsonBtnTarget : null,
      },
      caseId: this.caseIdValue,
      tryNumber: this.tryNumberValue,
      queryId: this.queryIdValue,
      initJsonTree: (pre) => this._initJsonTree(pre),
    });
  }

  viewSource() {
    if (!this.hasViewSourceBtnTarget) return;
    const url = this.viewSourceBtnTarget.dataset.viewSourceUrl;
    if (url) window.open(url, '_blank');
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

  _announceRatingChange(docId, rating) {
    if (!this.hasRatingAnnouncementTarget) return;
    this.ratingAnnouncementTarget.textContent =
      rating === ''
        ? `Cleared rating for document ${docId}.`
        : `Set rating ${rating} for document ${docId}.`;
  }
}

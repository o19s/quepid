import { Controller } from '@hotwired/stimulus';
import { getQuepidRootUrl, buildApiQuerySearchUrl } from 'utils/quepid_root';
import { applyRating, triggerScoreRefresh } from 'utils/rating_api';
import { toggleRatingPopover, disposePopovers } from 'utils/rating_popover';

// Expand/collapse inline preview for a query row. Fetches 5 results
// and shows them directly below the query. Rating is supported inline.
//
// Usage on the query row <li>:
//   data-controller="query-expand"
//   data-query-expand-case-id-value="..."
//   data-query-expand-try-number-value="..."
//   data-query-expand-query-id-value="..."
//   data-query-expand-scale-value="[0,1,2,3]"
const INLINE_ROWS = 5;

export default class extends Controller {
  static values = {
    caseId: Number,
    tryNumber: Number,
    queryId: Number,
    scale: Array,
  };
  static targets = ['inlineResults', 'chevron'];

  connect() {
    this._expanded = false;
    this._loaded = false;
    this._fetchRequestId = 0;
    this._popovers = new Map();
    this._boundInlineClick = this._handleInlineClick.bind(this);
    this._listenerAttached = false;
  }

  disconnect() {
    this._removeInlineListener();
    disposePopovers(this._popovers);
  }

  toggle(event) {
    event.preventDefault();
    event.stopPropagation();

    this._expanded = !this._expanded;

    if (this.hasChevronTarget) {
      this.chevronTarget.classList.toggle('query-expand-chevron--expanded', this._expanded);
    }

    if (this._expanded) {
      if (!this._loaded) {
        this._fetchPreview();
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

  async _fetchPreview() {
    if (!this.caseIdValue || !this.tryNumberValue || !this.queryIdValue) return;
    if (!this.hasInlineResultsTarget) return;

    const requestId = ++this._fetchRequestId;

    this.inlineResultsTarget.innerHTML =
      '<div class="text-center py-2"><span class="spinner-border spinner-border-sm"></span> Loading…</div>';

    const url = buildApiQuerySearchUrl(
      getQuepidRootUrl(),
      this.caseIdValue,
      this.tryNumberValue,
      this.queryIdValue,
      null,
      INLINE_ROWS,
      0
    );
    const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'text/html', 'X-CSRF-Token': token || '' },
      });
      if (requestId !== this._fetchRequestId) return; // stale response
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const html = await res.text();
      if (requestId !== this._fetchRequestId) return; // stale response
      this._renderPreview(html);
      this._loaded = true;
    } catch (err) {
      if (requestId !== this._fetchRequestId) return;
      this.inlineResultsTarget.innerHTML = `<div class="text-danger small py-1">${this._escapeHtml(err.message)}</div>`;
    }
  }

  _renderPreview(htmlText) {
    if (!this.hasInlineResultsTarget) return;

    // Clean up before re-rendering
    this._removeInlineListener();
    disposePopovers(this._popovers);

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');
    const wrapper = doc.querySelector('[data-results-pane-html-response]');
    if (!wrapper) {
      this.inlineResultsTarget.innerHTML = '<div class="text-muted small py-1">No results</div>';
      return;
    }

    const cards = wrapper.querySelectorAll('.document-card');
    let inner = '';
    cards.forEach((c) => {
      inner += c.outerHTML;
    });
    this.inlineResultsTarget.innerHTML =
      inner || '<div class="text-muted small py-1">No results</div>';
    this.inlineResultsTarget.addEventListener('click', this._boundInlineClick);
    this._listenerAttached = true;
  }

  _removeInlineListener() {
    if (this._listenerAttached && this.hasInlineResultsTarget) {
      this.inlineResultsTarget.removeEventListener('click', this._boundInlineClick);
      this._listenerAttached = false;
    }
  }

  _handleInlineClick(event) {
    const ratingTrigger = event.target.closest('[data-rating-trigger]');
    if (ratingTrigger) {
      event.preventDefault();
      event.stopPropagation();
      const docId = ratingTrigger.closest('[data-doc-id]')?.dataset?.docId;
      if (docId) {
        toggleRatingPopover(this._popovers, ratingTrigger, docId, this.scaleValue || [0, 1, 2, 3]);
      }
      return;
    }

    const ratingBtn = event.target.closest('[data-rating-value]');
    if (ratingBtn) {
      event.preventDefault();
      event.stopPropagation();
      const wrapper = ratingBtn.closest('[data-rating-doc-id]');
      const docId = wrapper?.dataset?.ratingDocId;
      const ratingVal = ratingBtn.dataset.ratingValue;
      const rating = ratingVal === '' ? NaN : parseInt(ratingVal, 10);
      if (docId != null) this._applyInlineRating(docId, rating);
    }
  }

  async _applyInlineRating(docId, rating) {
    try {
      await applyRating(this.caseIdValue, this.queryIdValue, docId, rating);
      triggerScoreRefresh(this.caseIdValue, this.queryIdValue, this.tryNumberValue);
      // Re-fetch to update badge display
      this._loaded = false;
      this._fetchPreview();
    } catch (err) {
      console.error('Inline rating failed:', err);
    }
  }

  _escapeHtml(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }
}

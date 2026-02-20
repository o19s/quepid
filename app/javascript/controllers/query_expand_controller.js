import { Controller } from '@hotwired/stimulus';
import { getQuepidRootUrl, buildApiQuerySearchUrl } from 'utils/quepid_root';
import { applyRating, triggerScoreRefresh } from 'utils/rating_api';

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
    this._popovers = [];
    this._boundInlineClick = this._handleInlineClick.bind(this);
    this._listenerAttached = false;
  }

  disconnect() {
    this._removeInlineListener();
    this._disposePopovers();
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
    this._disposePopovers();

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

  _disposePopovers() {
    this._popovers.forEach((p) => {
      try {
        p.dispose();
      } catch (_e) {
        /* ignore */
      }
    });
    this._popovers = [];
  }

  _handleInlineClick(event) {
    const ratingTrigger = event.target.closest('[data-rating-trigger]');
    if (ratingTrigger) {
      event.preventDefault();
      event.stopPropagation();
      this._showInlineRatingPopover(ratingTrigger);
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

  _showInlineRatingPopover(triggerEl) {
    const docId = triggerEl.closest('[data-doc-id]')?.dataset?.docId;
    if (!docId) return;

    // Destroy existing popover if any
    const existing = window.bootstrap?.Popover?.getInstance(triggerEl);
    if (existing) {
      existing.toggle();
      return;
    }

    const scale = this.scaleValue || [0, 1, 2, 3];
    const buttonsHtml = scale
      .map(
        (v) =>
          `<button type="button" class="btn btn-sm btn-outline-primary" data-rating-value="${v}">${v}</button>`
      )
      .join(' ');
    const clearHtml =
      '<button type="button" class="btn btn-sm btn-outline-secondary ms-1" data-rating-value="">Clear</button>';
    const content = `<div class="d-flex flex-wrap gap-1 align-items-center" data-rating-doc-id="${this._escapeHtmlAttr(docId)}">${buttonsHtml}${clearHtml}</div>`;

    const Popover = window.bootstrap?.Popover;
    if (!Popover) return;

    const popover = new Popover(triggerEl, {
      content,
      html: true,
      trigger: 'manual',
      placement: 'left',
      container: 'body',
    });
    popover.show();
    this._popovers.push(popover);
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

  _escapeHtmlAttr(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

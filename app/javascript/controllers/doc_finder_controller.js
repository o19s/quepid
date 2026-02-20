import { Controller } from '@hotwired/stimulus';
import { apiFetch } from 'api/fetch';
import { getQuepidRootUrl, buildApiUrl, buildApiQuerySearchUrl } from 'utils/quepid_root';

// Handles the "Find and rate missing documents" (DocFinder) modal. Replaces
// DocFinderCtrl and TargetedSearchModalCtrl. Fetches search results with custom
// query text, displays document cards, and supports bulk rating.
export default class extends Controller {
  static values = {
    caseId: Number,
    tryNumber: Number,
    queryId: Number,
    scale: Array,
  };

  static targets = [
    'trigger',
    'modal',
    'searchInput',
    'searchBtn',
    'noResultsAlert',
    'resultsSection',
    'resultsSummary',
    'scaleButtons',
    'resultsContainer',
  ];

  connect() {
    this._modal = null;
    this._docs = [];
    this._lastQuery = '';
  }

  open(event) {
    event.preventDefault();
    if (!this._modal) {
      const el = this.modalTarget;
      this._modal =
        window.bootstrap?.Modal?.getOrCreateInstance(el) ?? new window.bootstrap.Modal(el);
    }
    this._modal.show();
    this._clearResults();
  }

  async search(event) {
    event.preventDefault();
    const q = this.hasSearchInputTarget ? this.searchInputTarget.value?.trim() : '';
    if (!q) return;

    this._setLoading(true);
    this._hideNoResults();
    this._lastQuery = q;

    const url = buildApiQuerySearchUrl(
      getQuepidRootUrl(),
      this.caseIdValue,
      this.tryNumberValue,
      this.queryIdValue,
      q
    );

    try {
      const res = await apiFetch(url, { headers: { Accept: 'application/json' } });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Search failed (${res.status})`);
      }

      this._docs = data.docs || [];
      this._renderResults(data.docs || [], data.ratings || {}, data.num_found ?? 0);
    } catch (err) {
      console.error('DocFinder search failed:', err);
      this._showNoResults(err.message);
    } finally {
      this._setLoading(false);
    }
  }

  async rateAll(event) {
    const rating = parseInt(event.currentTarget.dataset.rating, 10);
    if (isNaN(rating) || this._docs.length === 0) return;

    const docIds = this._docs.map((d) => d.id);
    await this._bulkRate(docIds, rating);
  }

  async resetAll() {
    if (this._docs.length === 0) return;

    const docIds = this._docs.map((d) => d.id);
    await this._bulkDelete(docIds);
  }

  async _bulkRate(docIds, rating) {
    const root = getQuepidRootUrl();
    const url = buildApiUrl(
      root,
      'cases',
      this.caseIdValue,
      'queries',
      this.queryIdValue,
      'bulk',
      'ratings'
    );

    try {
      const res = await apiFetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ doc_ids: docIds, rating }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.message || 'Failed to update ratings');
      }

      const ratings = {};
      docIds.forEach((id) => {
        ratings[id] = rating;
      });
      this._renderResults(this._docs, ratings, this._docs.length);
      if (window.flash) window.flash.success = 'Ratings updated.';
      this._triggerScoreRefresh();
    } catch (err) {
      console.error('Bulk rate failed:', err);
      if (window.flash) window.flash.error = err.message;
    }
  }

  async _bulkDelete(docIds) {
    const root = getQuepidRootUrl();
    const url = buildApiUrl(
      root,
      'cases',
      this.caseIdValue,
      'queries',
      this.queryIdValue,
      'bulk',
      'ratings',
      'delete'
    );

    try {
      const res = await apiFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ doc_ids: docIds }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.message || 'Failed to reset ratings');
      }

      this._renderResults(this._docs, {}, this._docs.length);
      if (window.flash) window.flash.success = 'Ratings reset.';
      this._triggerScoreRefresh();
    } catch (err) {
      console.error('Bulk delete ratings failed:', err);
      if (window.flash) window.flash.error = err.message;
    }
  }

  _renderResults(docs, ratings, numFound) {
    if (!this.hasResultsContainerTarget) return;

    this.resultsSectionTarget.classList.remove('d-none');
    this.resultsSummaryTarget.textContent = `Your query returned ${numFound} result${numFound !== 1 ? 's' : ''}.`;

    const html =
      docs.length === 0
        ? '<p class="text-muted small mb-0">No documents.</p>'
        : docs
            .map((doc, idx) => {
              const rating = ratings[doc.id] ?? '';
              const title = this._docTitle(doc);
              const fieldsPreview = this._fieldsPreview(doc.fields);
              return `
            <div class="card mb-2 document-card" data-doc-id="${this._escapeHtml(doc.id)}">
              <div class="card-body p-2 d-flex flex-column gap-2">
                <div class="d-flex justify-content-between align-items-start">
                  <div class="flex-grow-1">
                    <span class="badge bg-secondary me-2">#${idx + 1}</span>
                    <strong>${this._escapeHtml(title)}</strong>
                    <span class="text-muted small ms-1">(id: ${this._escapeHtml(doc.id)})</span>
                  </div>
                  <div class="rating-badge">
                    ${rating !== '' ? `<span class="badge bg-primary">${this._escapeHtml(String(rating))}</span>` : ''}
                  </div>
                </div>
                ${fieldsPreview ? `<div class="small text-muted">${fieldsPreview}</div>` : ''}
              </div>
            </div>
          `;
            })
            .join('');

    this.resultsContainerTarget.innerHTML = html;
  }

  _docTitle(doc) {
    if (!doc.fields) return doc.id;
    const titleField = doc.fields.title ?? doc.fields.name ?? doc.fields.text;
    if (Array.isArray(titleField)) return titleField[0] ?? doc.id;
    return titleField ?? doc.id;
  }

  _fieldsPreview(fields) {
    if (!fields || typeof fields !== 'object') return '';
    const keys = Object.keys(fields).filter((k) => !['id', '_id', 'title', 'name'].includes(k));
    if (keys.length === 0) return '';
    const preview = keys
      .slice(0, 3)
      .map((k) => {
        const v = fields[k];
        const str = Array.isArray(v) ? v[0] : String(v ?? '');
        return str.length > 50 ? str.slice(0, 50) + '…' : str;
      })
      .join(' · ');
    return preview ? this._escapeHtml(preview) : '';
  }

  _escapeHtml(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  _clearResults() {
    this._docs = [];
    if (this.hasResultsSectionTarget) this.resultsSectionTarget.classList.add('d-none');
    if (this.hasResultsContainerTarget) this.resultsContainerTarget.innerHTML = '';
    this._hideNoResults();
  }

  _showNoResults(msg) {
    if (this.hasNoResultsAlertTarget) {
      this.noResultsAlertTarget.textContent = msg || 'Your query returned no results.';
      this.noResultsAlertTarget.classList.remove('d-none');
    }
  }

  _hideNoResults() {
    if (this.hasNoResultsAlertTarget) this.noResultsAlertTarget.classList.add('d-none');
  }

  _setLoading(loading) {
    if (this.hasSearchBtnTarget) this.searchBtnTarget.disabled = loading;
  }

  // Triggers case/query score refresh after bulk rating changes. Queues RunCaseEvaluationJob
  // which recalculates scores and broadcasts via Turbo Streams to qscore-case and subscribers.
  _triggerScoreRefresh() {
    if (!this.hasCaseIdValue || !this.hasTryNumberValue) return;

    const root = getQuepidRootUrl();
    const tryNum = this.tryNumberValue;
    const url = `${buildApiUrl(root, 'cases', this.caseIdValue, 'run_evaluation')}?try_number=${encodeURIComponent(tryNum)}`;
    const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

    apiFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-CSRF-Token': token || '',
      },
    }).catch((err) => {
      console.warn('Score refresh trigger failed (scores may be stale):', err);
    });
  }
}

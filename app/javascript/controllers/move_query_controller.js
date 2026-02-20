import { Controller } from '@hotwired/stimulus';
import { apiFetch } from 'api/fetch';
import { buildApiUrl, buildPageUrl, getQuepidRootUrl } from 'utils/quepid_root';

// Handles the "Move Query" modal: select another case, then PUT to move the query.
// Replaces the Angular move_query component. Uses getQuepidRootUrl() for base URL.
export default class extends Controller {
  static values = { queryId: Number, caseId: Number, tryNumber: Number };
  static targets = ['modal', 'trigger', 'confirmBtn', 'selectedCaseName'];

  connect() {
    this._modal = null;
    this._selectedCaseId = null;
    this._selectedCaseName = null;
  }

  get rootUrl() {
    return getQuepidRootUrl();
  }

  open(event) {
    event.preventDefault();
    if (!this._modal) {
      const el = this.modalTarget;
      this._modal =
        window.bootstrap?.Modal?.getOrCreateInstance(el) ?? new window.bootstrap.Modal(el);
    }
    this._selectedCaseId = null;
    this._selectedCaseName = null;
    this._syncSelection();
    this._modal.show();
  }

  selectCase(event) {
    const el = event.currentTarget;
    const id = el.dataset.caseId;
    const name = el.dataset.caseName || 'Case';
    if (!id) return;
    this._selectedCaseId = id;
    this._selectedCaseName = name;
    this._syncSelection();
  }

  _syncSelection() {
    this.modalTarget.querySelectorAll('[data-case-id]').forEach((item) => {
      item.classList.toggle('active', item.dataset.caseId === this._selectedCaseId);
    });
    if (this.hasConfirmBtnTarget) {
      const show = !!this._selectedCaseId;
      this.confirmBtnTarget.classList.toggle('d-none', !show);
      if (this.hasSelectedCaseNameTarget) {
        this.selectedCaseNameTarget.textContent = this._selectedCaseName || '';
      }
    }
  }

  async move(event) {
    event.preventDefault();
    if (!this._selectedCaseId) return;
    const url = buildApiUrl(this.rootUrl, 'cases', this.caseIdValue, 'queries', this.queryIdValue);

    this.confirmBtnTarget.disabled = true;
    try {
      const res = await apiFetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ other_case_id: parseInt(this._selectedCaseId, 10) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.message || res.statusText);
      }
      if (window.flash) window.flash.success = 'Query moved successfully!';
      this._modal?.hide();
      const tryPart = this.tryNumberValue ? `try/${this.tryNumberValue}` : '';
      const pathParts = tryPart
        ? ['case', this.caseIdValue, 'try', this.tryNumberValue]
        : ['case', this.caseIdValue];
      window.location.href = buildPageUrl(this.rootUrl, ...pathParts) + '/';
    } catch (err) {
      console.error('Move query failed:', err);
      if (window.flash) window.flash.error = err.message || 'Unable to move query.';
    } finally {
      this.confirmBtnTarget.disabled = false;
    }
  }
}

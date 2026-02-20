import { Controller } from '@hotwired/stimulus';
import { getQuepidRootUrl, buildApiUrl, buildPageUrl } from 'utils/quepid_root';

// Handles the "Delete options" modal: Delete All Queries, Archive Case, or Delete Case.
// Replaces the Angular delete_case_options component. Uses buildPageUrl/buildApiUrl
// for navigation and API URLs so subpath deployments work when root is empty.
export default class extends Controller {
  static values = { caseId: Number, tryNumber: Number };

  static targets = [
    'modal',
    'trigger',
    'radio',
    'hintQueries',
    'hintArchive',
    'hintDelete',
    'confirmBtn',
  ];

  connect() {
    this._modal = null;
  }

  get rootUrl() {
    return getQuepidRootUrl();
  }

  get selectedAction() {
    const checked = this.radioTargets.find((r) => r.checked);
    return checked ? checked.value : null;
  }

  open(event) {
    event.preventDefault();
    if (!this._modal) {
      const el = this.modalTarget;
      this._modal =
        window.bootstrap?.Modal?.getOrCreateInstance(el) ?? new window.bootstrap.Modal(el);
    }
    this.radioTargets.forEach((r) => {
      r.checked = false;
    });
    this._syncHintAndButton();
    this._modal.show();
  }

  selectionChanged() {
    this._syncHintAndButton();
  }

  _syncHintAndButton() {
    const action = this.selectedAction;
    if (this.hasHintQueriesTarget) this.hintQueriesTarget.hidden = action !== 'delete_all_queries';
    if (this.hasHintArchiveTarget) this.hintArchiveTarget.hidden = action !== 'archive_case';
    if (this.hasHintDeleteTarget) this.hintDeleteTarget.hidden = action !== 'delete_case';
    if (this.hasConfirmBtnTarget) {
      this.confirmBtnTarget.disabled = !action;
      this.confirmBtnTarget.textContent = this._buttonLabel(action);
    }
  }

  _buttonLabel(action) {
    switch (action) {
      case 'delete_all_queries':
        return 'Delete All Queries';
      case 'archive_case':
        return 'Archive';
      case 'delete_case':
        return 'Delete';
      default:
        return 'Delete';
    }
  }

  async confirm() {
    const action = this.selectedAction;
    if (!action) return;

    const root = this.rootUrl;
    const caseId = this.caseIdValue;
    const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    const headers = { 'X-CSRF-Token': token || '', Accept: 'application/json' };

    this._setLoading(true);
    try {
      if (action === 'delete_all_queries') {
        const url = buildApiUrl(root, 'bulk', 'cases', caseId, 'queries', 'delete');
        const res = await fetch(url, { method: 'DELETE', headers });
        if (!res.ok)
          throw new Error((await res.json().catch(() => ({}))).message || res.statusText);
        if (window.flash) window.flash.success = 'Case queries all deleted.';
        this._modal?.hide();
        const tryNum = this.hasTryNumberValue && this.tryNumberValue ? this.tryNumberValue : 1;
        window.location.href = buildPageUrl(root, 'case', caseId, 'try', tryNum);
        return;
      }

      if (action === 'archive_case') {
        const url = buildApiUrl(root, 'cases', caseId);
        const res = await fetch(url, {
          method: 'PUT',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ archived: true }),
        });
        if (!res.ok)
          throw new Error((await res.json().catch(() => ({}))).message || res.statusText);
        if (window.flash) window.flash.success = 'Case archived successfully.';
        this._modal?.hide();
        window.location.href = buildPageUrl(root, 'cases');
        return;
      }

      if (action === 'delete_case') {
        const url = buildApiUrl(root, 'cases', caseId);
        const res = await fetch(url, { method: 'DELETE', headers });
        if (!res.ok)
          throw new Error((await res.json().catch(() => ({}))).message || res.statusText);
        if (window.flash) window.flash.success = 'Case deleted successfully.';
        this._modal?.hide();
        window.location.href = buildPageUrl(root, 'cases');
      }
    } catch (err) {
      console.error('Delete option failed:', err);
      const prefix =
        action === 'delete_all_queries'
          ? 'Could not delete all the queries for this case. '
          : action === 'archive_case'
            ? 'Could not archive the case. '
            : 'Could not delete the case. ';
      if (window.flash) window.flash.error = 'Oooops! ' + prefix + (err.message || '');
    } finally {
      this._setLoading(false);
    }
  }

  _setLoading(loading) {
    if (this.hasConfirmBtnTarget) this.confirmBtnTarget.disabled = loading;
  }
}

// Handles the "Take Snapshot" modal: name, record document fields, submit.
// Replaces Angular TakeSnapshotCtrl and PromptSnapshotCtrl. Uses server-side
// snapshot creation (CreateSnapshotFromSearchJob) via POST api/cases/:id/snapshots.
import { Controller } from '@hotwired/stimulus';
import { apiFetch } from 'api/fetch';
import { buildApiUrl, getQuepidRootUrl } from 'utils/quepid_root';

export default class extends Controller {
  static values = { caseId: Number, tryNumber: Number };
  static targets = [
    'modal',
    'trigger',
    'nameInput',
    'recordFieldsCheckbox',
    'submitBtn',
    'cancelBtn',
    'errorEl',
    'progressEl',
  ];

  connect() {
    this._modal = null;
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
    this._clearError();
    this._hideProgress();
    if (this.hasNameInputTarget) this.nameInputTarget.value = '';
    if (this.hasRecordFieldsCheckboxTarget) this.recordFieldsCheckboxTarget.checked = false;
    this._modal.show();
  }

  _clearError() {
    if (this.hasErrorElTarget) {
      this.errorElTarget.classList.add('d-none');
      this.errorElTarget.textContent = '';
    }
  }

  _showError(message) {
    if (this.hasErrorElTarget) {
      this.errorElTarget.textContent = message || 'An error occurred. Please try again.';
      this.errorElTarget.classList.remove('d-none');
    }
  }

  _hideProgress() {
    if (this.hasProgressElTarget) this.progressElTarget.classList.add('d-none');
  }

  _showProgress() {
    if (this.hasProgressElTarget) this.progressElTarget.classList.remove('d-none');
  }

  async submit(event) {
    event.preventDefault();
    const name = this.hasNameInputTarget ? this.nameInputTarget.value.trim() : '';
    if (!name) {
      this._showError('Please enter a snapshot name.');
      return;
    }

    const recordDocumentFields = this.hasRecordFieldsCheckboxTarget
      ? this.recordFieldsCheckboxTarget.checked
      : false;

    this._clearError();
    this._showProgress();
    if (this.hasSubmitBtnTarget) this.submitBtnTarget.disabled = true;
    if (this.hasCancelBtnTarget) this.cancelBtnTarget.disabled = true;

    const url = buildApiUrl(this.rootUrl, 'cases', this.caseIdValue, 'snapshots');
    const body = {
      snapshot: {
        name: name,
        record_document_fields: recordDocumentFields,
      },
    };
    const tryNum = this.tryNumberValue;
    if (tryNum != null && tryNum !== '' && !Number.isNaN(Number(tryNum))) {
      body.snapshot.try_number = Number(tryNum);
    }

    try {
      const res = await apiFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || data.statusText || res.statusText);
      }

      if (window.flash) window.flash.success = 'Snapshot created successfully.';
      this._modal?.hide();
    } catch (err) {
      console.error('Take snapshot failed:', err);
      this._showError(err.message || 'Unable to create snapshot.');
    } finally {
      this._hideProgress();
      if (this.hasSubmitBtnTarget) this.submitBtnTarget.disabled = false;
      if (this.hasCancelBtnTarget) this.cancelBtnTarget.disabled = false;
    }
  }
}

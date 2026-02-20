import { Controller } from '@hotwired/stimulus';
import { getQuepidRootUrl, buildApiUrl, buildPageUrl } from 'utils/quepid_root';

// Handles the "Export case" modal: opens modal, fetches snapshots, builds export
// URLs, and triggers download via fetch + blob save. Replaces the Angular
// export_case component. Uses getQuepidRootUrl() for base URL.
// General, Detailed, and Snapshot CSV are implemented via Api::V1::Export::CasesController.
export default class extends Controller {
  static values = {
    caseId: Number,
    caseName: String,
    supportsDetailed: Boolean,
  };

  static targets = [
    'modal',
    'radio',
    'unavailableNote',
    'detailedWarning',
    'snapshotSelect',
    'basicSnapshotSelect',
    'apiSnapshotSelect',
    'apiCaseLink',
    'apiQueriesLink',
    'apiAnnotationsLink',
    'apiScoresLink',
    'apiRatingsLink',
    'apiSnapshotLink',
    'apiSnapshotLinkWrap',
    'quepidFormatLink',
    'submitBtn',
  ];

  connect() {
    this._modal = null;
    this._snapshots = [];
    this._onApiSnapshotChange = () => this._updateApiSnapshotLink();
  }

  disconnect() {
    if (this.hasApiSnapshotSelectTarget) {
      this.apiSnapshotSelectTarget.removeEventListener('change', this._onApiSnapshotChange);
    }
    this._modal = null;
  }

  get rootUrl() {
    return getQuepidRootUrl();
  }

  get selectedWhich() {
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
    this._modal.show();
    this._fetchSnapshots();
    this._setApiLinksHrefs();
    this._syncSubmitAndNotes();
  }

  selectionChanged() {
    this._syncSubmitAndNotes();
  }

  _syncSubmitAndNotes() {
    const which = this.selectedWhich;
    if (this.hasUnavailableNoteTarget) {
      this.unavailableNoteTarget.classList.add('d-none');
    }
    const detailedSelected = which === 'detailed';
    const detailedDisabled = detailedSelected && !this.supportsDetailedValue;
    const snapshotNoSelection =
      which === 'snapshot' && (!this.hasSnapshotSelectTarget || !this.snapshotSelectTarget.value);
    if (this.hasDetailedWarningTarget) {
      this.detailedWarningTarget.classList.toggle('d-none', !detailedDisabled);
    }
    if (this.hasSubmitBtnTarget) {
      this.submitBtnTarget.disabled = !which || detailedDisabled || snapshotNoSelection;
    }
  }

  async _fetchSnapshots() {
    const root = this.rootUrl;
    const caseId = this.caseIdValue;
    try {
      const res = await fetch(buildApiUrl(root, 'cases', caseId, 'snapshots') + '?shallow=true', {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.snapshots || [];
      this._snapshots = list.map((s) => ({
        id: s.id ?? s.snapshot_id,
        name: s.name || s.display_name || `Snapshot ${s.id}`,
      }));
      this._fillSnapshotSelects();
    } catch (_e) {
      this._snapshots = [];
    }
  }

  _fillSnapshotSelects() {
    const option = (s) =>
      `<option value="${this._escapeAttr(String(s.id))}">${this._escapeHtml(s.name)}</option>`;
    const opts = '<option value="">—</option>' + this._snapshots.map(option).join('');
    if (this.hasSnapshotSelectTarget) {
      this.snapshotSelectTarget.innerHTML = opts;
    }
    if (this.hasBasicSnapshotSelectTarget) {
      this.basicSnapshotSelectTarget.innerHTML = opts;
    }
    if (this.hasApiSnapshotSelectTarget) {
      this.apiSnapshotSelectTarget.innerHTML = opts;
      this.apiSnapshotSelectTarget.removeEventListener('change', this._onApiSnapshotChange);
      this.apiSnapshotSelectTarget.addEventListener('change', this._onApiSnapshotChange);
    }
  }

  _escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  /** Escape for HTML attribute values (quotes, ampersands, etc.) */
  _escapeAttr(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  _setApiLinksHrefs() {
    const root = this.rootUrl;
    const cid = this.caseIdValue;
    if (this.hasApiCaseLinkTarget)
      this.apiCaseLinkTarget.href = buildApiUrl(root, 'cases', `${cid}.json`) + '?shallow=false';
    if (this.hasApiQueriesLinkTarget)
      this.apiQueriesLinkTarget.href =
        buildApiUrl(root, 'cases', cid, 'queries.json') + '?shallow=false';
    if (this.hasApiAnnotationsLinkTarget)
      this.apiAnnotationsLinkTarget.href = buildApiUrl(root, 'cases', cid, 'annotations.json');
    if (this.hasApiScoresLinkTarget)
      this.apiScoresLinkTarget.href = buildApiUrl(root, 'cases', cid, 'scores.json');
    if (this.hasApiRatingsLinkTarget)
      this.apiRatingsLinkTarget.href = buildApiUrl(root, 'export', 'ratings', `${cid}.json`);
    if (this.hasQuepidFormatLinkTarget)
      this.quepidFormatLinkTarget.href = buildApiUrl(root, 'export', 'cases', `${cid}.json`);
    this._updateApiSnapshotLink();
  }

  _updateApiSnapshotLink() {
    if (
      !this.hasApiSnapshotSelectTarget ||
      !this.hasApiSnapshotLinkTarget ||
      !this.hasApiSnapshotLinkWrapTarget
    )
      return;
    const sid = this.apiSnapshotSelectTarget.value;
    if (!sid) {
      this.apiSnapshotLinkWrapTarget.classList.add('d-none');
      return;
    }
    const root = this.rootUrl;
    this.apiSnapshotLinkTarget.href =
      buildApiUrl(root, 'cases', this.caseIdValue, 'snapshots', `${sid}.json`) + '?shallow=false';
    this.apiSnapshotLinkWrapTarget.classList.remove('d-none');
  }

  async submit() {
    const which = this.selectedWhich;
    if (!which) return;
    const root = this.rootUrl;
    const caseId = this.caseIdValue;
    const caseName = this._safeFilename(this.caseNameValue);

    const ASYNC_FORMATS = ['general', 'detailed', 'snapshot', 'quepid'];

    if (ASYNC_FORMATS.includes(which)) {
      const sid =
        which === 'snapshot' && this.hasSnapshotSelectTarget ? this.snapshotSelectTarget.value : '';
      if (which === 'snapshot' && !sid) {
        if (window.flash) window.flash.error = 'Please select a snapshot.';
        return;
      }
      await this._submitAsyncExport(root, caseId, which, sid);
      return;
    }

    let url;
    let _filename;
    switch (which) {
      case 'information_need':
        url = `api/export/queries/information_needs/${caseId}.csv`;
        _filename = `${caseName}_information_need.csv`;
        break;
      case 'basic': {
        const sid = this.hasBasicSnapshotSelectTarget ? this.basicSnapshotSelectTarget.value : '';
        url = sid
          ? `api/export/ratings/${caseId}.csv?file_format=basic_snapshot&snapshot_id=${sid}`
          : `api/export/ratings/${caseId}.csv?file_format=basic`;
        _filename = sid ? `${caseName}_basic_snapshot.csv` : `${caseName}_basic.csv`;
        break;
      }
      case 'trec': {
        const sid = this.hasBasicSnapshotSelectTarget ? this.basicSnapshotSelectTarget.value : '';
        url = sid
          ? `api/export/ratings/${caseId}.txt?file_format=trec_snapshot&snapshot_id=${sid}`
          : `api/export/ratings/${caseId}.txt?file_format=trec`;
        _filename = sid ? `${caseName}_trec_snapshot.txt` : `${caseName}_trec.txt`;
        break;
      }
      case 'rre':
        url = `api/export/ratings/${caseId}.json?file_format=rre`;
        _filename = `${caseName}_rre.json`;
        break;
      case 'ltr':
        url = `api/export/ratings/${caseId}.txt?file_format=ltr`;
        _filename = `${caseName}_ltr.txt`;
        break;
      default:
        return;
    }

    const fullUrl = this._buildExportUrl(root, url);
    this._submitSyncExport(fullUrl);
    this._modal?.hide();
  }

  async _submitAsyncExport(root, caseId, format, snapshotId) {
    const url = buildPageUrl(root, 'case', caseId, 'export');
    const token = document.querySelector('meta[name="csrf-token"]')?.content;
    this._setLoading(true);
    try {
      const body = new FormData();
      body.append('export_format', format);
      if (snapshotId) body.append('snapshot_id', snapshotId);
      body.append('authenticity_token', token || '');

      const res = await fetch(url, {
        method: 'POST',
        headers: { Accept: 'text/vnd.turbo-stream.html', 'X-CSRF-Token': token || '' },
        body,
      });
      const html = await res.text();
      if (html?.trim() && res.headers.get('Content-Type')?.includes('turbo-stream')) {
        window.Turbo?.renderStreamMessage?.(html);
      }
      if (res.ok) this._modal?.hide();
      else if (window.flash) window.flash.error = 'Export failed. Please try again.';
    } catch (err) {
      console.error('Export failed:', err);
      if (window.flash) window.flash.error = 'Export failed. Please try again.';
    } finally {
      this._setLoading(false);
    }
  }

  _buildExportUrl(root, url) {
    const [pathPart, queryPart] = url.split('?');
    const segments = pathPart.replace(/^api\//, '').split('/');
    const base = buildApiUrl(root, ...segments);
    return queryPart ? `${base}?${queryPart}` : base;
  }

  _submitSyncExport(fullUrl) {
    const form = document.createElement('form');
    form.method = 'GET';
    form.action = fullUrl;
    form.style.display = 'none';
    document.body.appendChild(form);
    form.submit();
    form.remove();
  }

  _safeFilename(name) {
    return (name || 'export').replace(/\s/g, '_').replace(/:/g, '_');
  }

  _saveBlob(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  _setLoading(loading) {
    if (this.hasSubmitBtnTarget) this.submitBtnTarget.disabled = loading;
  }
}

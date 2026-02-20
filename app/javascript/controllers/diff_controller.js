import { Controller } from '@hotwired/stimulus';
import { apiFetch } from 'api/fetch';
import { buildApiUrl, getQuepidRootUrl } from 'utils/quepid_root';

// Handles the "Compare results" (diff) modal: select 1-3 snapshots to compare.
// Dispatches diff-snapshots-changed so the results view can apply diffs. Uses getQuepidRootUrl().
export default class extends Controller {
  static values = { caseId: Number, maxSnapshots: { type: Number, default: 3 } };
  static targets = [
    'modal',
    'trigger',
    'selectionContainer',
    'addBtn',
    'applyBtn',
    'clearBtn',
    'loadingEl',
    'duplicateWarning',
  ];

  connect() {
    this._modal = null;
    this._snapshots = [];
    this._selections = [null];

    this._boundSelectionChange = (e) => this._handleSelectionChange(e);
    this._boundSelectionClick = (e) => this._handleSelectionClick(e);
    if (this.hasSelectionContainerTarget) {
      this.selectionContainerTarget.addEventListener('change', this._boundSelectionChange);
      this.selectionContainerTarget.addEventListener('click', this._boundSelectionClick);
    }
  }

  disconnect() {
    if (this.hasSelectionContainerTarget) {
      this.selectionContainerTarget.removeEventListener('change', this._boundSelectionChange);
      this.selectionContainerTarget.removeEventListener('click', this._boundSelectionClick);
    }
  }

  _handleSelectionChange(event) {
    const select = event.target.closest('select[data-index]');
    if (!select) return;
    const index = parseInt(select.dataset.index, 10);
    this._selectionChanged(index, select.value);
  }

  _handleSelectionClick(event) {
    const btn = event.target.closest('button.btn-outline-danger');
    if (!btn) return;
    const row = btn.closest('[data-index]');
    if (!row) return;
    const index = parseInt(row.dataset.index, 10);
    this._removeSelection(index);
  }

  get rootUrl() {
    return getQuepidRootUrl();
  }

  async open(event) {
    event.preventDefault();
    if (!this._modal) {
      const el = this.modalTarget;
      this._modal =
        window.bootstrap?.Modal?.getOrCreateInstance(el) ?? new window.bootstrap.Modal(el);
    }
    this._selections = [null];
    this._snapshots = [];
    this._showLoading(true);
    this._modal.show();
    const url = buildApiUrl(this.rootUrl, 'cases', this.caseIdValue, 'snapshots') + '?shallow=true';
    try {
      const res = await apiFetch(url, { headers: { Accept: 'application/json' } });
      if (res.ok) {
        const data = await res.json();
        this._snapshots = data.snapshots || data || [];
      }
    } catch (_e) {
      this._snapshots = [];
    }
    this._showLoading(false);
    this._renderSelections();
  }

  _showLoading(show) {
    if (this.hasLoadingElTarget) this.loadingElTarget.classList.toggle('d-none', !show);
  }

  _renderSelections() {
    if (!this.hasSelectionContainerTarget) return;
    const container = this.selectionContainerTarget;
    container.innerHTML = '';
    const max = this.maxSnapshotsValue || 3;
    this._selections.forEach((val, index) => {
      const row = document.createElement('div');
      row.className = 'd-flex align-items-center gap-2 mb-2';
      row.dataset.index = index;
      const label = document.createElement('label');
      label.className = 'mb-0 text-nowrap';
      label.style.minWidth = '90px';
      label.textContent = `Snapshot ${index + 1}:`;
      const select = document.createElement('select');
      select.className = 'form-select form-select-sm';
      select.style.minWidth = '180px';
      select.dataset.index = index;
      const opt0 = document.createElement('option');
      opt0.value = '';
      opt0.textContent = '-- Select Snapshot --';
      select.appendChild(opt0);
      this._snapshots.forEach((snap) => {
        const opt = document.createElement('option');
        opt.value = String(snap.id);
        opt.textContent = snap.name || `Snapshot ${snap.id}`;
        if (String(snap.id) === String(val)) opt.selected = true;
        select.appendChild(opt);
      });
      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'btn btn-sm btn-outline-danger';
      clearBtn.title = this._selections.length > 1 ? 'Remove this slot' : 'Clear selection';
      clearBtn.innerHTML = '<i class="bi bi-x-lg" aria-hidden="true"></i>';
      row.appendChild(label);
      row.appendChild(select);
      row.appendChild(clearBtn);
      container.appendChild(row);
    });
    if (this.hasAddBtnTarget) {
      this.addBtnTarget.classList.toggle('d-none', this._selections.length >= max);
    }
    this._checkDuplicateWarning();
  }

  _selectionChanged(index, value) {
    this._selections[index] = value === '' ? null : value;
    this._checkDuplicateWarning();
  }

  _checkDuplicateWarning() {
    const ids = this._selections.filter(Boolean).map(String);
    const seen = new Set();
    const hasDup = ids.some((id) => {
      if (seen.has(id)) return true;
      seen.add(id);
      return false;
    });
    if (this.hasDuplicateWarningTarget) {
      this.duplicateWarningTarget.classList.toggle('d-none', !hasDup);
    }
  }

  addSelection() {
    if (this._selections.length >= (this.maxSnapshotsValue || 3)) return;
    this._selections.push(null);
    this._renderSelections();
  }

  _removeSelection(index) {
    if (this._selections.length > 1) {
      this._selections.splice(index, 1);
    } else {
      this._selections[0] = null;
    }
    this._renderSelections();
  }

  _getValidSelections() {
    const seen = new Set();
    return this._selections.filter((id) => {
      if (id == null || id === '') return false;
      const s = String(id);
      if (seen.has(s)) return false;
      seen.add(s);
      return true;
    });
  }

  _dispatch(snapshotIds) {
    const workspace = document.querySelector('[data-controller~="workspace"]') || document.body;
    if (workspace.dataset) {
      workspace.dataset.diffSnapshotIds = Array.isArray(snapshotIds) ? snapshotIds.join(',') : '';
    }
    const snapshotNames = {};
    if (Array.isArray(snapshotIds)) {
      snapshotIds.forEach((id) => {
        const snap = this._snapshots.find((s) => String(s.id) === String(id));
        if (snap) snapshotNames[String(id)] = snap.name || `Snapshot ${id}`;
      });
    }
    workspace.dispatchEvent(
      new CustomEvent('diff-snapshots-changed', {
        detail: { snapshotIds: snapshotIds || [], snapshotNames },
        bubbles: true,
      })
    );
  }

  apply(event) {
    event.preventDefault();
    const ids = this._getValidSelections();
    if (
      this.hasDuplicateWarningTarget &&
      !this.duplicateWarningTarget.classList.contains('d-none')
    ) {
      return;
    }
    this._dispatch(ids);
    if (window.flash) {
      window.flash.success =
        ids.length === 0
          ? 'Comparison view cleared.'
          : `Snapshot${ids.length === 1 ? '' : 's'} selected for comparison.`;
    }
    this._modal?.hide();
  }

  clear(event) {
    event.preventDefault();
    this._dispatch([]);
    if (window.flash) window.flash.success = 'Comparison view has been cleared.';
    this._modal?.hide();
  }
}

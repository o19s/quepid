import { Controller } from '@hotwired/stimulus';
import { apiFetch } from 'api/fetch';
import { getQuepidRootUrl, buildApiUrl, reloadOrTurboVisit } from 'utils/quepid_root';

// Toggles the scorer panel (scale, guidelines) and provides a scorer picker modal.
// Replaces ScorerCtrl.
export default class extends Controller {
  static values = { caseId: Number };
  static targets = ['trigger', 'panel', 'pickerModal', 'scorerList'];

  toggle() {
    if (!this.hasPanelTarget) return;
    const el = this.panelTarget;
    const Collapse = window.bootstrap?.Collapse;
    if (Collapse) {
      const instance = Collapse.getInstance(el) ?? new Collapse(el, { toggle: true });
      instance.toggle();
    } else {
      el.classList.toggle('show');
    }
  }

  async openPicker() {
    if (!this.hasPickerModalTarget || !this.caseIdValue) return;

    const modal = window.bootstrap?.Modal?.getOrCreateInstance(this.pickerModalTarget);
    modal?.show();

    if (this.hasScorerListTarget) {
      this.scorerListTarget.innerHTML = '<p class="text-muted">Loading scorers…</p>';
    }

    try {
      const root = getQuepidRootUrl();

      // Fetch case scorers (default + communal) and user scorers in parallel
      const [caseRes, userRes] = await Promise.all([
        apiFetch(buildApiUrl(root, 'cases', this.caseIdValue, 'scorers'), {
          headers: { Accept: 'application/json' },
        }),
        apiFetch(buildApiUrl(root, 'scorers'), {
          headers: { Accept: 'application/json' },
        }),
      ]);

      const caseData = caseRes.ok ? await caseRes.json() : {};
      const userData = userRes.ok ? await userRes.json() : {};

      this._renderScorerOptions(caseData, userData);
    } catch (err) {
      console.error('Failed to load scorers:', err);
      if (this.hasScorerListTarget) {
        this.scorerListTarget.innerHTML = '<p class="text-danger">Failed to load scorers.</p>';
      }
    }
  }

  _renderScorerOptions(caseData, userData) {
    if (!this.hasScorerListTarget) return;

    const currentScorerId = caseData.default?.scorer_id;
    const allScorers = [];
    const seenIds = new Set();

    // Current/default scorer first
    if (caseData.default) {
      allScorers.push({ ...caseData.default, group: 'Current' });
      seenIds.add(caseData.default.scorer_id);
    }

    // User's custom scorers
    const userScorers = userData.user_scorers || [];
    userScorers.forEach((s) => {
      if (!seenIds.has(s.scorer_id)) {
        allScorers.push({ ...s, group: 'My Scorers' });
        seenIds.add(s.scorer_id);
      }
    });

    // Communal scorers
    const communalScorers = caseData.communal_scorers || userData.communal_scorers || [];
    communalScorers.forEach((s) => {
      if (!seenIds.has(s.scorer_id)) {
        allScorers.push({ ...s, group: 'Communal' });
        seenIds.add(s.scorer_id);
      }
    });

    if (allScorers.length === 0) {
      this.scorerListTarget.innerHTML = '<p class="text-muted">No scorers available.</p>';
      return;
    }

    // Group by category
    const groups = {};
    allScorers.forEach((s) => {
      const g = s.group || 'Other';
      if (!groups[g]) groups[g] = [];
      groups[g].push(s);
    });

    let html = '';
    Object.entries(groups).forEach(([groupName, scorers]) => {
      html += `<h6 class="text-muted small mt-2 mb-1">${this._escapeHtml(groupName)}</h6>`;
      html += '<div class="list-group list-group-flush">';
      scorers.forEach((s) => {
        const isActive = s.scorer_id === currentScorerId;
        const scaleStr = Array.isArray(s.scale) ? s.scale.join(', ') : '';
        html += `
          <button type="button" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center ${isActive ? 'active' : ''}"
                  data-action="click->scorer-panel#selectScorer"
                  data-scorer-id="${this._escapeHtml(s.scorer_id)}">
            <span>
              <strong>${this._escapeHtml(s.name)}</strong>
              ${scaleStr ? `<br><small class="text-muted">[${this._escapeHtml(scaleStr)}]</small>` : ''}
            </span>
            ${isActive ? '<i class="bi bi-check-lg"></i>' : ''}
          </button>
        `;
      });
      html += '</div>';
    });

    this.scorerListTarget.innerHTML = html;
  }

  async selectScorer(event) {
    const scorerId = event.currentTarget.dataset.scorerId;
    if (!scorerId || !this.caseIdValue) return;

    try {
      const root = getQuepidRootUrl();
      const url = buildApiUrl(root, 'cases', this.caseIdValue, 'scorers', scorerId);

      const res = await apiFetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to update scorer (${res.status})`);
      }

      // Scorer affects all score displays — reload page
      reloadOrTurboVisit();
    } catch (err) {
      console.error('Scorer selection failed:', err);
      if (window.flash) window.flash.error = err.message;
    }
  }

  _escapeHtml(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }
}

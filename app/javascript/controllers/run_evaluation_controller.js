import { Controller } from '@hotwired/stimulus';
import { apiFetch } from 'api/fetch';
import { getQuepidRootUrl, buildApiUrl } from 'utils/quepid_root';

// Triggers a background case evaluation via POST /api/cases/:caseId/run_evaluation.
// Progress/completion updates arrive via existing Turbo Stream broadcasts.
export default class extends Controller {
  static values = { caseId: Number, tryNumber: Number };
  static targets = ['button', 'spinner'];

  async run() {
    if (!this.caseIdValue || !this.tryNumberValue) return;

    this._setRunning(true);

    try {
      const root = getQuepidRootUrl();
      const url = `${buildApiUrl(root, 'cases', this.caseIdValue, 'run_evaluation')}?try_number=${encodeURIComponent(this.tryNumberValue)}`;
      const res = await apiFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.message || `Evaluation failed (${res.status})`);
      }
      if (window.flash) window.flash.success = 'Evaluation started';
    } catch (err) {
      console.error('Run evaluation failed:', err);
      if (window.flash) window.flash.error = err.message;
    } finally {
      // Re-enable after a short delay to prevent rapid re-clicks
      setTimeout(() => this._setRunning(false), 2000);
    }
  }

  _setRunning(running) {
    if (this.hasButtonTarget) this.buttonTarget.disabled = running;
    if (this.hasSpinnerTarget) this.spinnerTarget.classList.toggle('d-none', !running);
  }
}

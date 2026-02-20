import { Controller } from '@hotwired/stimulus';
import { apiFetch } from 'api/fetch';

// Runs the scorer code against sample docs via POST scorers/:id/test.
// Uses server-side JavascriptScorer for evaluation.
export default class extends Controller {
  static values = {
    url: String,
  };

  static targets = ['codeInput', 'testBtn', 'testBtnLabel', 'testSpinner', 'testResult'];

  async run() {
    const url = this.urlValue;
    if (!url || !url.trim()) return;

    const codeInput = this.hasCodeInputTarget
      ? this.codeInputTarget
      : this.element.querySelector("textarea[name*='[code]']");
    if (!codeInput) return;

    const code = codeInput.editor ? codeInput.editor.getValue() : codeInput.value;
    if (!code || !code.trim()) {
      this._showResult('Enter scorer code first.', 'text-danger');
      return;
    }

    this._setLoading(true);
    this._showResult('');

    try {
      const res = await apiFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ code: code }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        this._showResult(data.error || `Request failed (${res.status})`, 'text-danger');
        return;
      }

      if (data.error) {
        this._showResult(data.error, 'text-danger');
        return;
      }

      const score = data.score;
      const display =
        typeof score === 'number'
          ? Number.isInteger(score)
            ? score
            : score.toFixed(4)
          : String(score);
      this._showResult(`Score: ${display}`, 'text-success');
    } catch (err) {
      this._showResult(err.message || 'Network error', 'text-danger');
    } finally {
      this._setLoading(false);
    }
  }

  _setLoading(loading) {
    if (this.hasTestBtnLabelTarget) {
      this.testBtnLabelTarget.textContent = loading ? 'Testing…' : 'Test';
    }
    if (this.hasTestSpinnerTarget) {
      this.testSpinnerTarget.classList.toggle('d-none', !loading);
    }
    if (this.hasTestBtnTarget) {
      this.testBtnTarget.disabled = loading;
    }
  }

  _showResult(message, cssClass = '') {
    if (!this.hasTestResultTarget) return;
    this.testResultTarget.textContent = message;
    this.testResultTarget.className = `ms-2 small ${cssClass}`.trim();
  }
}

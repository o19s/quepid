import { Controller } from '@hotwired/stimulus';

// Generic clipboard copy controller.
// Usage: data-controller="clipboard" data-clipboard-text-value="..." data-action="click->clipboard#copy"
// Or: reads text from data-clipboard-source-target if no text value set.
export default class extends Controller {
  static values = { text: String };
  static targets = ['source', 'button'];

  async copy() {
    const text = this.textValue || (this.hasSourceTarget ? this.sourceTarget.textContent : '');
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      this._showFeedback('Copied!');
    } catch (_err) {
      // Fallback for non-HTTPS
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this._showFeedback('Copied!');
    }
  }

  _showFeedback(message) {
    const btn = this.hasButtonTarget ? this.buttonTarget : this.element;
    const original = btn.innerHTML;
    btn.innerHTML = `<i class="bi bi-check" aria-hidden="true"></i> ${message}`;
    setTimeout(() => {
      btn.innerHTML = original;
    }, 1500);
  }
}

import { Controller } from '@hotwired/stimulus';

// Sliding right-side panel for Tune Relevance settings.
// Toggle open/close with the toolbar button. Escape key closes.
export default class extends Controller {
  static targets = ['panel', 'backdrop'];

  connect() {
    this._boundKeydown = this._onKeydown.bind(this);
    document.addEventListener('keydown', this._boundKeydown);
  }

  disconnect() {
    document.removeEventListener('keydown', this._boundKeydown);
  }

  toggle() {
    if (this.hasPanelTarget) {
      this.panelTarget.classList.toggle('tune-relevance-panel--open');
    }
    if (this.hasBackdropTarget) {
      this.backdropTarget.classList.toggle('tune-relevance-backdrop--visible');
    }
  }

  close() {
    if (this.hasPanelTarget) {
      this.panelTarget.classList.remove('tune-relevance-panel--open');
    }
    if (this.hasBackdropTarget) {
      this.backdropTarget.classList.remove('tune-relevance-backdrop--visible');
    }
  }

  _onKeydown(event) {
    if (event.key === 'Escape' && this._isOpen()) {
      this.close();
    }
  }

  _isOpen() {
    return this.hasPanelTarget && this.panelTarget.classList.contains('tune-relevance-panel--open');
  }
}

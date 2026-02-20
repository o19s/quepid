import { Controller } from '@hotwired/stimulus';

// Opens a full-screen Bootstrap modal when the expand trigger is clicked.
// Used by ExpandContentComponent (replaces the Angular expand_content directive).
export default class extends Controller {
  static targets = ['modal', 'trigger'];

  open(event) {
    event.preventDefault();
    if (!this._modal && this.hasModalTarget) {
      this._modal =
        window.bootstrap?.Modal?.getOrCreateInstance(this.modalTarget) ??
        new window.bootstrap.Modal(this.modalTarget);
    }
    this._modal?.show();
  }
}

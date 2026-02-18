import { Controller } from "@hotwired/stimulus"

// Handles the matches (document explain) panel for a search result.
// Replaces the Angular matches + debug_matches directives. Expand is handled by ExpandContentComponent.
// Opens the Bootstrap debug modal for raw explain JSON.
export default class extends Controller {
  static targets = ["debugTrigger", "debugModal"]

  openDebug(event) {
    event.preventDefault()
    this._showModal(this.debugModalTarget)
  }

  _showModal(el) {
    if (window.bootstrap && window.bootstrap.Modal) {
      const modal = window.bootstrap.Modal.getOrCreateInstance(el)
      modal.show()
    }
  }
}

import { Controller } from "@hotwired/stimulus"

// Toggles the query params panel. Replaces QueryParamsCtrl. Full query sandbox
// (editor, history) deferred.
export default class extends Controller {
  static targets = ["trigger", "panel"]

  toggle() {
    if (!this.hasPanelTarget) return
    const el = this.panelTarget
    const bsCollapse = window.bootstrap?.Collapse
    if (bsCollapse) {
      const instance = bsCollapse.getInstance(el) ?? new bsCollapse(el, { toggle: true })
      instance.toggle()
    } else {
      el.classList.toggle("show")
    }
  }
}

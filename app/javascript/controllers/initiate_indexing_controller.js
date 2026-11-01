import { Controller } from "@hotwired/stimulus"

/**
 * The one "Initiate indexing" dialog on the Dataset Cases page: the button that opened it says which case it is
 * for, so the form posts to that case and the text names it.
 */
export default class extends Controller {
  static targets = ["form", "caseName"]

  /**
   * Points the form at the case of the button that opened the dialog, and names that case.
   */
  fill(event) {
    const button = event.relatedTarget
    if (!button) return
    if (this.hasFormTarget) this.formTarget.action = button.dataset.url
    this.caseNameTarget.textContent = button.dataset.caseName
  }
}

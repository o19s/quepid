import { Controller } from "@hotwired/stimulus"

/**
 * Opens the core wizard modal. Case creation itself remains a live-query service seam until the
 * case workspace state migration is complete; the wizard UI and lifecycle are Stimulus-owned.
 */
export default class extends Controller {
  static outlets = ["wizard"]
  static values = {
    auto: Boolean,
    completedCaseWizard: Boolean,
    casesInvolvedWithCount: Number,
    teamsInvolvedWithCount: Number,
    createUrl: String
  }

  connect() {
    if (!this.autoValue) return

    this.autoOpenTimer = window.setTimeout(() => this.openAutomatically(), 0)
  }

  disconnect() {
    if (this.autoOpenTimer) window.clearTimeout(this.autoOpenTimer)
  }

  newCase(event) {
    event.preventDefault()
    this.openWizard(true)
  }

  openAutomatically() {
    const query = new URLSearchParams(window.location.search)
    const deepLinked = query.get("showWizard") === "true"
    const firstCase = !this.completedCaseWizardValue &&
      this.casesInvolvedWithCountValue === 1 &&
      this.teamsInvolvedWithCountValue === 0

    if (deepLinked || firstCase) this.openWizard(false)
  }

  openWizard(createCase) {
    if (createCase) {
      window.location.assign(this.createUrlValue || "cases/new")
      return
    }

    // A page without the wizard modal has nothing to open; this is not an error.
    if (!this.hasWizardOutlet) return

    this.wizardOutlet.open()
  }
}

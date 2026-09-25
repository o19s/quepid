import { Controller } from "@hotwired/stimulus"
import { getOrCreateBsModal, showBsModal } from "utils/bs_modal"

/**
 * Opens the core wizard modal. Case creation itself remains an Angular service seam until the
 * case workspace state migration is complete; the wizard UI and lifecycle are Stimulus-owned.
 */
export default class extends Controller {
  static values = { auto: Boolean }

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
    const rootScope = this.angularInjector()?.get("$rootScope")
    const user = rootScope?.currentUser

    if (!user) {
      this.autoOpenTimer = window.setTimeout(() => this.openAutomatically(), 100)
      return
    }

    const query = new URLSearchParams(window.location.search)
    const deepLinked = query.get("showWizard") === "true"
    const firstCase = !user.completedCaseWizard &&
      user.casesInvolvedWithCount === 1 &&
      user.teamsInvolvedWithCount === 0 &&
      user.introWizardSeen !== true

    if (deepLinked || firstCase) this.openWizard(false)
  }

  openWizard(createCase) {
    if (createCase) {
      const caseSvc = this.angularInjector()?.get("caseSvc")
      caseSvc?.createCase()
      return
    }

    const modal = document.getElementById("wizardModal")
    if (!modal) return

    modal.dispatchEvent(new CustomEvent("wizard:open", { bubbles: true }))
    showBsModal(getOrCreateBsModal(modal, { backdrop: "static", keyboard: false }))
  }

  angularInjector() {
    return window.angular?.element(document.body).injector?.()
  }
}

import { Controller } from "@hotwired/stimulus"

/**
 * Opens the legacy wizard through Angular's injector while the wizard body is being migrated.
 *
 * Keeping this seam in Stimulus lets the header and first-case auto-launch stop depending on
 * Angular directives now. The modal implementation remains unchanged until its validation and
 * persistence contracts have been ported.
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
    const injector = this.angularInjector()
    if (!injector) return

    const rootScope = injector.get("$rootScope")
    const caseSvc = injector.get("caseSvc")
    if (createCase) caseSvc.createCase()

    const modal = injector.get("$quepidModal").open({
      templateUrl: "views/wizardModal.html",
      controller: "WizardModalCtrl",
      backdrop: "static",
      windowClass: "wizard-modal-window"
    })

    if (!rootScope.currentUser?.completedCaseWizard) {
      modal.result.then(() => {
        if (typeof window.setupAndStartTour === "function") {
          window.setTimeout(window.setupAndStartTour, 1500)
        }
      })
    }
  }

  angularInjector() {
    return window.angular?.element(document.body).injector?.()
  }
}

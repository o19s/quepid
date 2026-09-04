import { Controller } from "@hotwired/stimulus"
import { apiFetch } from "api/fetch"
import { getQuepidRootUrl } from "utils/quepid_root"
import { showStatusMessage } from "utils/status_message"

const REDIRECT_DELAY_MS = 1000

/**
 * Clone-case options for the core case toolbar — list/form UI, API stay-on-page
 * while cloning, then navigate to the new case. Mirrors the AngularJS
 * clone-case modal it replaces, except: on success the modal stays open
 * showing an inline success alert for REDIRECT_DELAY_MS before navigating
 * (Angular closed the modal and navigated immediately), and on failure the
 * modal stays open with an inline alert instead of Angular's
 * close-then-global-flash (same documented delta as share-case-core).
 *
 * One controller class instantiated on both the toolbar trigger and the modal
 * root (same dual-role pattern as share-case-core / delete-case-options-core):
 * the trigger reads case id/name/last-try off its own dataset and delegates
 * to the modal-root instance.
 */
export default class extends Controller {
  static targets = [
    "title",
    "alert",
    "noQueriesAlert",
    "caseNameInput",
    "historyOffButton",
    "historyOnButton",
    "tryFieldWrapper",
    "trySelect",
    "queriesCheckbox",
    "ratingsCheckbox",
    "submitButton"
  ]

  static values = {
    triesUrlTemplate: String,
    cloneUrl: String
  }

  get isModalRoot() {
    return this.hasTitleTarget
  }

  open(event) {
    event?.preventDefault?.()

    if (!this.isModalRoot) {
      const modalController = this.modalController()
      if (modalController) return modalController.open(event)
      return
    }

    const btn = event.currentTarget || event.target
    const caseId = btn?.dataset?.cloneCaseCoreIdValue
    const caseName = btn?.dataset?.cloneCaseCoreNameValue
    const lastTry = btn?.dataset?.cloneCaseCoreLastTryValue

    this.currentCaseId = caseId || ""
    this.newCaseName = ""
    this.history = false
    this.includeQueries = true
    this.includeRatings = false
    this.tryNumber = lastTry ? Number(lastTry) : null

    if (this.hasTitleTarget) {
      this.titleTarget.textContent = caseName ? `Clone case: ${caseName}` : "Clone case"
    }
    if (this.hasCaseNameInputTarget) this.caseNameInputTarget.value = ""
    if (this.hasQueriesCheckboxTarget) this.queriesCheckboxTarget.checked = true
    if (this.hasRatingsCheckboxTarget) this.ratingsCheckboxTarget.checked = false

    this.clearAlert()
    this.refreshUi()
    this.loadTries()
  }

  modalController() {
    const modal = document.getElementById("cloneCaseModal")
    if (!modal) return null

    return this.application.getControllerForElementAndIdentifier(
      modal,
      "clone-case-core"
    )
  }

  selectHistory(event) {
    this.history = event.params.history === true
    this.refreshUi()
  }

  updateTry(event) {
    this.tryNumber = Number(event.target.value)
  }

  toggleQueries(event) {
    this.includeQueries = event.target.checked
    this.refreshUi()
  }

  toggleRatings(event) {
    this.includeRatings = event.target.checked
  }

  updateCaseName(event) {
    this.newCaseName = event.target.value
    this.refreshSubmitState()
  }

  async loadTries() {
    if (!this.hasTrySelectTarget) return

    this.trySelectTarget.innerHTML = ""
    if (!this.hasTriesUrlTemplateValue || !this.currentCaseId) return

    try {
      const url = this.triesUrlTemplateValue.replaceAll("__CASE_ID__", this.currentCaseId)
      const response = await apiFetch(url, { headers: { Accept: "application/json" } })
      if (!response.ok) {
        throw new Error(`Failed to load tries (${response.status})`)
      }
      const data = await response.json()
      const tries = Array.isArray(data.tries) ? data.tries : []

      tries.forEach((tryItem) => {
        const option = document.createElement("option")
        option.value = String(tryItem.try_number)
        option.textContent = tryItem.name
        this.trySelectTarget.appendChild(option)
      })

      if (this.tryNumber != null) {
        this.trySelectTarget.value = String(this.tryNumber)
      }
    } catch (error) {
      console.error("clone-case-core: load tries failed", error)
      this.showAlert("Unable to load try history. Please try again.", "danger")
    }
  }

  async submit(event) {
    event.preventDefault()

    if (!this.newCaseName || !this.currentCaseId) return

    this.setSubmitting(true)
    this.clearAlert()

    try {
      const response = await apiFetch(this.cloneUrlValue, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          case_id: Number(this.currentCaseId),
          clone_queries: this.includeQueries,
          clone_ratings: this.includeRatings,
          preserve_history: this.history,
          try_number: this.tryNumber,
          case_name: this.newCaseName
        })
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || data.message || "Unable to clone your case, please try again.")
      }

      const acase = await response.json()
      this.showAlert("Case cloned successfully! Redirecting…", "success")
      window.setTimeout(() => {
        window.location.href = `${getQuepidRootUrl()}/case/${acase.case_id}/try/${acase.last_try_number}`
      }, REDIRECT_DELAY_MS)
    } catch (error) {
      console.error("clone-case-core: clone failed", error)
      this.showAlert(error.message || "Unable to clone your case, please try again.", "danger")
      this.setSubmitting(false)
    }
  }

  refreshUi() {
    if (this.hasHistoryOffButtonTarget) {
      this.historyOffButtonTarget.classList.toggle("btn-primary", !this.history)
      this.historyOffButtonTarget.classList.toggle("btn-outline-secondary", this.history)
    }
    if (this.hasHistoryOnButtonTarget) {
      this.historyOnButtonTarget.classList.toggle("btn-primary", this.history)
      this.historyOnButtonTarget.classList.toggle("btn-outline-secondary", !this.history)
    }
    if (this.hasTryFieldWrapperTarget) {
      this.tryFieldWrapperTarget.classList.toggle("d-none", this.history)
    }
    if (this.hasNoQueriesAlertTarget) {
      this.noQueriesAlertTarget.classList.toggle("d-none", this.includeQueries)
    }
    this.refreshSubmitState()
  }

  refreshSubmitState() {
    if (!this.hasSubmitButtonTarget) return
    this.submitButtonTarget.disabled = !this.newCaseName
  }

  setSubmitting(isSubmitting) {
    if (!this.hasSubmitButtonTarget) return
    this.submitButtonTarget.disabled = isSubmitting || !this.newCaseName
  }

  showAlert(message, variant) {
    if (!this.hasAlertTarget) return
    showStatusMessage(this.alertTarget, { message, className: `alert alert-${variant}` })
  }

  clearAlert() {
    if (!this.hasAlertTarget) return
    this.alertTarget.textContent = ""
    this.alertTarget.className = "alert d-none"
  }
}

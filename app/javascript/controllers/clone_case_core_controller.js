import CoreModalControllerBase from "controllers/core_modal_controller_base"
import { getJson, postJson } from "api/json"
import { serverMessage } from "utils/error_message"
import { getQuepidRootUrl } from "utils/quepid_root"
import { caseNameFromHeader } from "utils/case_header"
import { isSameId } from "utils/record_identity"

const REDIRECT_DELAY_MS = 1000

/**
 * Clone-case options for the core case toolbar — list/form UI, API stay-on-page
 * while cloning, then navigate to the new case. On success the modal stays
 * open showing an inline success alert for REDIRECT_DELAY_MS before
 * navigating; on failure it stays open with an inline alert.
 *
 * The toolbar trigger carries the case id and last try number.
 */
export default class extends CoreModalControllerBase {
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

  openFor(btn) {
    const caseId = btn?.dataset?.cloneCaseCoreIdValue
    const caseName = caseNameFromHeader()
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

    const caseId = this.currentCaseId

    try {
      const url = this.triesUrlTemplateValue.replaceAll("__CASE_ID__", caseId)
      const data = await getJson(url)
      // Bail if the case changed while this request was in flight (e.g. the
      // modal was reopened for a different case) — an outdated response must
      // not clobber the now-current case's try dropdown.
      if (!isSameId(caseId, this.currentCaseId)) return
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
      if (!isSameId(caseId, this.currentCaseId)) return
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
      const acase = await postJson(this.cloneUrlValue, {
        case_id: Number(this.currentCaseId),
        clone_queries: this.includeQueries,
        clone_ratings: this.includeRatings,
        preserve_history: this.history,
        try_number: this.tryNumber,
        case_name: this.newCaseName
        })

      this.showAlert("Case cloned successfully! Redirecting…", "success")
      window.setTimeout(() => {
        window.location.href = `${getQuepidRootUrl()}/case/${acase.case_id}/try/${acase.last_try_number}`
      }, REDIRECT_DELAY_MS)
    } catch (error) {
      console.error("clone-case-core: clone failed", error)
      const message = serverMessage(error, "Unable to clone your case, please try again.")
      this.showAlert(message, "danger")
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
    this.toggleVisible("tryFieldWrapper", !this.history)
    this.toggleVisible("noQueriesAlert", !this.includeQueries)
    this.refreshSubmitState()
  }

  refreshSubmitState() {
    if (!this.hasSubmitButtonTarget) return
    this.submitButtonTarget.disabled = !this.newCaseName
  }

  setSubmitting(isSubmitting) {
    this.setButtonsDisabled(isSubmitting || !this.newCaseName, ["submitButton"])
  }
}

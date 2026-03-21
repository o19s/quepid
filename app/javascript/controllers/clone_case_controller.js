import { Controller } from "@hotwired/stimulus"
import { apiUrl, csrfToken } from "modules/api_url"

export default class extends Controller {
  static targets = [
    "modal",
    "nameInput",
    "submitButton",
    "errorMessage",
    "progressMessage",
    "historyToggle",
    "trySelect",
    "trySelectGroup",
    "cloneQueries",
    "cloneRatings",
  ]
  static values = {
    caseId: { type: Number },
    caseName: { type: String, default: "" },
  }

  connect() {
    this._includeHistory = false
    this._submitting = false
  }

  open(event) {
    event.preventDefault()

    this.nameInputTarget.value = ""
    this.errorMessageTarget.classList.add("d-none")
    this.progressMessageTarget.classList.add("d-none")
    this.submitButtonTarget.disabled = false

    // Reset options to defaults
    this._setHistoryMode(false)
    this.cloneQueriesTarget.checked = true
    this.cloneRatingsTarget.checked = false

    this._modal().show()

    this.modalTarget.addEventListener("shown.bs.modal", () => this.nameInputTarget.focus(), {
      once: true,
    })
  }

  toggleHistory(event) {
    const includeHistory = event.currentTarget.dataset.history === "true"
    this._setHistoryMode(includeHistory)
  }

  async submit(event) {
    event.preventDefault()
    if (this._submitting) return
    this._submitting = true

    const name = this.nameInputTarget.value.trim()
    if (!name) {
      this._showError("Case name is required.")
      this._submitting = false
      return
    }

    this.submitButtonTarget.disabled = true
    this.errorMessageTarget.classList.add("d-none")
    this.progressMessageTarget.classList.remove("d-none")

    try {
      const payload = {
        case_id: this.caseIdValue,
        case_name: name,
        preserve_history: this._includeHistory,
        clone_queries: this.cloneQueriesTarget.checked,
        clone_ratings: this.cloneRatingsTarget.checked,
      }

      if (!this._includeHistory && this.hasTrySelectTarget) {
        payload.try_number = parseInt(this.trySelectTarget.value, 10)
      }

      const response = await fetch(apiUrl("api/clone/cases"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken(),
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`Server returned ${response.status}: ${text}`)
      }

      const data = await response.json()
      this._modal().hide()

      // Navigate to the cloned case
      const newCaseId = data.case_id
      const lastTry = data.last_try_number || 1
      window.location.href = apiUrl(`case/${newCaseId}/try/${lastTry}`)
    } catch (error) {
      console.error("Clone failed:", error)
      this._showError(error.message)
    } finally {
      this._submitting = false
      this.submitButtonTarget.disabled = false
      this.progressMessageTarget.classList.add("d-none")
    }
  }

  // Private

  _setHistoryMode(includeHistory) {
    this._includeHistory = includeHistory

    this.historyToggleTargets.forEach((btn) => {
      const isMatch = (btn.dataset.history === "true") === includeHistory
      btn.classList.toggle("btn-primary", isMatch)
      btn.classList.toggle("btn-outline-secondary", !isMatch)
    })

    if (this.hasTrySelectGroupTarget) {
      this.trySelectGroupTarget.classList.toggle("d-none", includeHistory)
    }
  }

  _showError(message) {
    this.errorMessageTarget.textContent = message
    this.errorMessageTarget.classList.remove("d-none")
  }

  _modal() {
    return window.bootstrap.Modal.getOrCreateInstance(this.modalTarget)
  }
}

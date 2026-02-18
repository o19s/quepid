import { Controller } from "@hotwired/stimulus"
import { apiFetch } from "api/fetch"
import { buildApiUrl, getQuepidRootUrl } from "utils/quepid_root"

// Handles the "Query Options" modal: edit JSON options in a textarea, then PUT to save.
// Replaces the Angular query_options component. Uses getQuepidRootUrl() for base URL.
export default class extends Controller {
  static values = { queryId: Number, caseId: Number }
  static targets = ["modal", "trigger", "optionsInput", "submitBtn", "validationError"]

  connect() {
    this._modal = null
  }

  get rootUrl() {
    return getQuepidRootUrl()
  }

  open(event) {
    event.preventDefault()
    if (!this._modal) {
      const el = this.modalTarget
      this._modal = window.bootstrap?.Modal?.getOrCreateInstance(el) ?? new window.bootstrap.Modal(el)
    }
    this._clearValidation()
    this._modal.show()
  }

  _clearValidation() {
    if (this.hasOptionsInputTarget) {
      this.optionsInputTarget.classList.remove("is-invalid")
    }
    if (this.hasValidationErrorTarget) {
      this.validationErrorTarget.textContent = "Please provide valid JSON."
      this.validationErrorTarget.style.display = "none"
    }
  }

  _showValidation(message) {
    if (this.hasOptionsInputTarget) {
      this.optionsInputTarget.classList.add("is-invalid")
    }
    if (this.hasValidationErrorTarget) {
      this.validationErrorTarget.textContent = message || "Please provide valid JSON."
      this.validationErrorTarget.style.display = "block"
    }
  }

  async save(event) {
    event.preventDefault()
    const raw = this.hasOptionsInputTarget ? this.optionsInputTarget.value.trim() : "{}"
    let parsed
    try {
      parsed = raw === "" ? {} : JSON.parse(raw)
    } catch (_e) {
      this._showValidation("Please provide valid JSON.")
      return
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      this._showValidation("Options must be a JSON object.")
      return
    }
    this._clearValidation()

    const url = buildApiUrl(this.rootUrl, "cases", this.caseIdValue, "queries", this.queryIdValue, "options")

    if (this.hasSubmitBtnTarget) this.submitBtnTarget.disabled = true
    try {
      const res = await apiFetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({ query: { options: parsed } })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || data.error || res.statusText)
      }
      if (window.flash) window.flash.success = "Query options saved successfully."
      this._modal?.hide()
    } catch (err) {
      console.error("Save query options failed:", err)
      this._showValidation(err.message || "Unable to save query options.")
    } finally {
      if (this.hasSubmitBtnTarget) this.submitBtnTarget.disabled = false
    }
  }
}

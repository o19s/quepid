import { Controller } from "@hotwired/stimulus"
import { apiFetch } from "api/fetch"
import { getQuepidRootUrl, buildApiUrl, buildPageUrl } from "utils/quepid_root"

// Handles the "Delete case" confirmation modal. Opens modal, on confirm sends
// DELETE api/cases/:id, then redirects to cases list. Replaces the Angular
// delete_case component. Uses buildApiUrl() for URLs (no hardcoded paths).
export default class extends Controller {
  static values = { caseId: Number }

  static targets = ["modal", "trigger", "confirmBtn"]

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
    this._modal.show()
  }

  async confirm() {
    const root = this.rootUrl
    const caseId = this.caseIdValue
    const url = buildApiUrl(root, "cases", caseId)

    this._setLoading(true)
    try {
      const res = await apiFetch(url, {
        method: "DELETE",
        headers: { Accept: "application/json" }
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || data.error || res.statusText)
      }

      if (window.flash) window.flash.success = "Case deleted successfully."
      this._modal?.hide()
      window.location.href = buildPageUrl(root, "cases")
    } catch (err) {
      console.error("Delete case failed:", err)
      if (window.flash) window.flash.error = "Oooops! Could not delete the case. " + (err.message || "")
    } finally {
      this._setLoading(false)
    }
  }

  _setLoading(loading) {
    if (this.hasConfirmBtnTarget) this.confirmBtnTarget.disabled = loading
  }
}

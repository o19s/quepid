import { Controller } from "@hotwired/stimulus"
import { apiFetch } from "api/fetch"
import { getQuepidRootUrl, buildApiUrl } from "utils/quepid_root"

// Toggles the `nightly` flag on a case via PATCH /api/cases/:caseId.
// Used on the case toolbar badge to enable/disable nightly evaluation runs.
export default class extends Controller {
  static values = { caseId: Number, nightly: Boolean }
  static targets = ["checkbox", "label"]

  toggle() {
    const newVal = this.hasCheckboxTarget ? this.checkboxTarget.checked : !this.nightlyValue
    this._update(newVal)
  }

  async _update(nightly) {
    if (!this.caseIdValue) return

    try {
      const root = getQuepidRootUrl()
      const url = buildApiUrl(root, "cases", this.caseIdValue)
      const res = await apiFetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ case: { nightly } })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || data.message || `Update failed (${res.status})`)
      }
      this.nightlyValue = nightly
      if (this.hasLabelTarget) {
        this.labelTarget.textContent = nightly ? "Nightly: ON" : "Nightly: OFF"
      }
    } catch (err) {
      console.error("Nightly toggle failed:", err)
      if (this.hasCheckboxTarget) this.checkboxTarget.checked = !nightly
      if (window.flash) window.flash.error = err.message
    }
  }
}

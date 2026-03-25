import { Controller } from "@hotwired/stimulus"
import { apiUrl, csrfToken } from "modules/api_url"
import { showFlash } from "modules/flash_helper"

// JSON editor for per-query options (parity with Angular query-options).
// query-row dispatches "open-query-options" with { queryId }.
export default class extends Controller {
  static targets = ["textarea"]

  connect() {
    this._onOpen = (e) => void this.open(e.detail)
    document.addEventListener("open-query-options", this._onOpen)
    this.queryId = null
  }

  disconnect() {
    document.removeEventListener("open-query-options", this._onOpen)
  }

  async open({ queryId }) {
    const caseId = document.body.dataset.caseId
    try {
      const response = await fetch(apiUrl(`api/cases/${caseId}/queries/${queryId}/options`), {
        headers: {
          Accept: "application/json",
          "X-CSRF-Token": csrfToken(),
        },
      })
      if (!response.ok) throw new Error(String(response.status))
      const data = await response.json()
      this.textareaTarget.value =
        data.options != null ? JSON.stringify(data.options, null, 2) : "{}"
      // Only record queryId after a successful load so Save cannot target the wrong query
      // if this open fails or races with another row.
      this.queryId = queryId
    } catch (error) {
      console.error("Failed to load query options:", error)
      showFlash("Could not load query options.", "danger")
      return
    }

    window.bootstrap.Modal.getOrCreateInstance(this.element).show()
  }

  async save(event) {
    event.preventDefault()
    if (this.queryId == null) {
      showFlash("Reload query options from a query row, then try again.", "warning")
      return
    }

    let parsed
    try {
      parsed = JSON.parse(this.textareaTarget.value)
    } catch {
      showFlash("Please provide a valid JSON object.", "danger")
      return
    }

    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      showFlash("Please provide a JSON object (not an array or primitive).", "danger")
      return
    }

    const caseId = document.body.dataset.caseId
    try {
      const response = await fetch(apiUrl(`api/cases/${caseId}/queries/${this.queryId}/options`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-CSRF-Token": csrfToken(),
        },
        body: JSON.stringify({ query: { options: parsed } }),
      })
      if (!response.ok) {
        showFlash("Unable to save query options.", "danger")
        return
      }
      showFlash("Query options saved successfully.", "success")
      window.bootstrap.Modal.getInstance(this.element)?.hide()
      document.dispatchEvent(
        new CustomEvent("query-options-saved", { detail: { queryId: this.queryId } }),
      )
    } catch (error) {
      console.error("Failed to save query options:", error)
      showFlash("Unable to save query options.", "danger")
    }
  }
}

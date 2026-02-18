import { Controller } from "@hotwired/stimulus"
import { getQuepidRootUrl, buildCaseQueriesUrl, buildApiCaseQueriesUrl } from "utils/quepid_root"

// Handles the "Delete query" confirmation modal. Opens modal, on confirm sends
// DELETE case/:id/queries/:queryId (Turbo Stream) or api/cases/:id/queries/:queryId
// (JSON fallback), then redirects or applies streams. Replaces the Angular delete-query behavior.
export default class extends Controller {
  static values = { caseId: Number, queryId: Number, tryNumber: Number, selectedQueryId: Number }

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
    const queryId = this.queryIdValue
    const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content")
    const useTurboStream = window.Turbo && this.hasTryNumberValue
    let url = useTurboStream
      ? buildCaseQueriesUrl(root, caseId, queryId)
      : buildApiCaseQueriesUrl(root, caseId, queryId)
    if (useTurboStream && this.hasSelectedQueryIdValue && this.selectedQueryIdValue === queryId) {
      url += `?selected_query_id=${queryId}`
    }
    const accept = useTurboStream ? "text/vnd.turbo-stream.html" : "application/json"

    this._setLoading(true)
    try {
      const res = await fetch(url, {
        method: "DELETE",
        headers: {
          "X-CSRF-Token": token || "",
          Accept: accept
        }
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || data.error || res.statusText)
      }

      this._modal?.hide()

      if (useTurboStream && res.headers.get("Content-Type")?.includes("turbo-stream")) {
        if (window.flash) window.flash.success = "Query deleted."
        const html = await res.text()
        if (html && html.trim().length > 0) window.Turbo.renderStreamMessage(html)
        if (this.hasSelectedQueryIdValue && this.selectedQueryIdValue === queryId) {
          const url = new URL(window.location.href)
          url.searchParams.delete("query_id")
          history.replaceState(history.state, "", url)
        }
      } else {
        if (window.flash?.store) window.flash.store("success", "Query deleted.")
        const base = root ? root.replace(/\/$/, "") : ""
        const tryNum = (this.hasTryNumberValue && this.tryNumberValue) ? this.tryNumberValue : null
        const casePath = tryNum ? `case/${caseId}/try/${tryNum}` : `case/${caseId}`
        if (base) {
          window.location.href = `${base}/${casePath}`
        } else {
          window.location.reload()
        }
      }
    } catch (err) {
      console.error("Delete query failed:", err)
      if (window.flash) window.flash.error = "Could not delete the query. " + (err.message || "")
    } finally {
      this._setLoading(false)
    }
  }

  _setLoading(loading) {
    if (this.hasConfirmBtnTarget) this.confirmBtnTarget.disabled = loading
  }
}

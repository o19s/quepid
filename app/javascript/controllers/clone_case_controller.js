import { Controller } from "@hotwired/stimulus"
import { getQuepidRootUrl, buildApiUrl, buildPageUrl } from "utils/quepid_root"

// Handles the "Clone case" modal in the case/try workspace. Opens Bootstrap modal,
// submits to POST api/clone/cases, then redirects to the new case. Replaces the
// Angular clone_case component and CloneCaseModalInstanceCtrl.
// Uses getQuepidRootUrl() for base URL (no hardcoded "/").
export default class extends Controller {
  static values = {
    caseId: Number,
    caseName: String,
    tries: Array,
    lastTry: Number
  }

  static targets = [
    "trigger",
    "modal",
    "caseNameDisplay",
    "caseName",
    "noQueriesWarning",
    "historySpecific",
    "historyAll",
    "trySelectWrap",
    "trySelect",
    "includeQueries",
    "includeRatings",
    "submitBtn"
  ]

  connect() {
    this._modal = null
    this._historyAll = false
    this._syncTrySelectVisibility()
  }

  open(event) {
    event.preventDefault()
    if (!this._modal) {
      const el = this.modalTarget
      this._modal = window.bootstrap?.Modal?.getOrCreateInstance(el) ?? new window.bootstrap.Modal(el)
    }
    this.caseNameTarget.value = ""
    this._historyAll = this.hasHistoryAllTarget && this.historyAllTarget.checked
    this._modal.show()
    this._syncTrySelectVisibility()
  }

  setHistorySpecific() {
    this._historyAll = false
    this._syncTrySelectVisibility()
  }

  setHistoryAll() {
    this._historyAll = true
    this._syncTrySelectVisibility()
  }

  _syncTrySelectVisibility() {
    if (!this.hasTrySelectWrapTarget) return
    this.trySelectWrapTarget.style.display = this._historyAll ? "none" : ""
  }

  toggleQueriesWarning() {
    if (!this.hasNoQueriesWarningTarget) return
    const includeQueries = this.hasIncludeQueriesTarget && this.includeQueriesTarget.checked
    this.noQueriesWarningTarget.hidden = includeQueries
  }

  async submit() {
    const caseName = this.caseNameTarget?.value?.trim()
    if (!caseName) return

    const root = getQuepidRootUrl()
    const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content")
    const body = {
      case_id: this.caseIdValue,
      case_name: caseName,
      clone_queries: this.hasIncludeQueriesTarget ? this.includeQueriesTarget.checked : true,
      clone_ratings: this.hasIncludeRatingsTarget ? this.includeRatingsTarget.checked : false,
      preserve_history: this._historyAll,
      try_number: this._historyAll ? null : (this.trySelectTarget?.value ? parseInt(this.trySelectTarget.value, 10) : null)
    }

    this._setLoading(true)
    try {
      const res = await fetch(buildApiUrl(root, "clone", "cases"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": token || "",
          Accept: "application/json"
        },
        body: JSON.stringify(body)
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || data.error || res.statusText)
      }

      const data = await res.json()
      const caseId = data.case_id ?? data.id
      const tryNumber = data.last_try_number ?? data.lastTry ?? 1
      if (window.flash) window.flash.store("success", "Case cloned successfully!")
      this._modal?.hide()
      window.location.href = buildPageUrl(root, "case", caseId, "try", tryNumber)
    } catch (err) {
      console.error("Clone case failed:", err)
      if (window.flash) window.flash.error = err.message || "Unable to clone your case, please try again."
    } finally {
      this._setLoading(false)
    }
  }

  _setLoading(loading) {
    if (this.hasSubmitBtnTarget) this.submitBtnTarget.disabled = loading
  }
}

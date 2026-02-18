import { Controller } from "@hotwired/stimulus"
import { getQuepidRootUrl, buildCaseQueriesUrl, buildApiCaseQueriesUrl, buildApiBulkCaseQueriesUrl } from "utils/quepid_root"

// Handles the "Add query" form in the case/try workspace. POSTs to the existing
// queries API (single or bulk); replaces the Angular add_query component.
// Uses getQuepidRootUrl() for API base (no hardcoded "/").
export default class extends Controller {
  static values = {
    caseId: Number,
    tryNumber: Number,
    canAdd: { type: Boolean, default: true }
  }

  static targets = ["input", "submitButton", "spinner"]

  connect() {
    this._updateButtonState()
    this.inputTarget.addEventListener("input", () => this._updateButtonState())
  }

  handlePaste(event) {
    const pasted = (event.clipboardData || window.clipboardData)?.getData("text") || ""
    if (pasted.includes("\n")) {
      event.preventDefault()
      const replaced = pasted.split("\n").join(";")
      this.inputTarget.value = (this.inputTarget.value + replaced).trim()
      this._updateButtonState()
    }
  }

  submit(event) {
    event.preventDefault()
    if (!this.canAddValue || this._textInputIsEmpty()) return

    const raw = this.inputTarget.value.trim()
    const queries = this._parseQueries(raw)
    if (queries.length === 0) return

    this._setLoading(true)
    const root = getQuepidRootUrl()
    const caseId = this.caseIdValue
    const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content")

    if (queries.length === 1) {
      this._postOne(root, caseId, queries[0], token)
        .then((usedTurboStream) => this._onSuccess(usedTurboStream))
        .catch((err) => this._onError(err))
        .finally(() => this._setLoading(false))
    } else {
      this._postBulk(root, caseId, queries, token)
        .then(() => this._onSuccess())
        .catch((err) => this._onError(err))
        .finally(() => this._setLoading(false))
    }
  }

  _parseQueries(formInput) {
    const delim = ";"
    return formInput
      .split(delim)
      .map((s) => s.replace(/^\s+|\s+$/g, ""))
      .filter((s) => s.length > 0)
  }

  _textInputIsEmpty() {
    const v = this.inputTarget?.value ?? ""
    return !v || /^\s*$/.test(v)
  }

  _updateButtonState() {
    if (!this.hasSubmitButtonTarget) return
    const disabled = !this.canAddValue || this._textInputIsEmpty()
    this.submitButtonTarget.disabled = disabled
    const hasSemicolon = (this.inputTarget?.value ?? "").indexOf(";") !== -1
    this.submitButtonTarget.value = hasSemicolon ? "Add queries" : "Add query"
  }

  _setLoading(loading) {
    if (this.hasSubmitButtonTarget) this.submitButtonTarget.disabled = loading
    if (this.hasSpinnerTarget) {
      this.spinnerTarget.classList.toggle("hidden", !loading)
    }
  }

  _postOne(root, caseId, queryText, token) {
    // Prefer Turbo Stream route for in-place updates when available
    const useTurboStream = window.Turbo && this.hasTryNumberValue
    const url = useTurboStream
      ? buildCaseQueriesUrl(root, caseId)
      : buildApiCaseQueriesUrl(root, caseId)
    const accept = useTurboStream ? "text/vnd.turbo-stream.html" : "application/json"

    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": token || "",
        Accept: accept
      },
      body: JSON.stringify({ query: { query_text: queryText } })
    }).then((res) => {
      if (!res.ok) {
        const ct = res.headers.get("Content-Type") || ""
        if (ct.includes("turbo-stream")) {
          return res.text().then((html) => {
            if (html && html.trim().length > 0) window.Turbo.renderStreamMessage(html)
            return "error" // error shown via Turbo Stream; don't clear input
          })
        }
        return res.json().then((body) => Promise.reject(new Error(body.error || body.message || res.statusText)))
      }
      if (useTurboStream && res.headers.get("Content-Type")?.includes("turbo-stream")) {
        return res.text().then((html) => {
          if (html && html.trim().length > 0) window.Turbo.renderStreamMessage(html)
          return true // used Turbo Stream
        })
      }
      return false // did not use Turbo Stream
    })
  }

  _postBulk(root, caseId, queries, token) {
    const url = buildApiBulkCaseQueriesUrl(root, caseId)
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": token || "",
        Accept: "application/json"
      },
      body: JSON.stringify({ queries })
    }).then((res) => {
      if (!res.ok) return res.json().then((body) => Promise.reject(new Error(body.error || res.statusText)))
      return res
    })
  }

  _onSuccess(usedTurboStream = false) {
    // Error shown via Turbo Stream: keep input, don't reload
    if (usedTurboStream === "error") {
      this._updateButtonState()
      return
    }
    this.inputTarget.value = ""
    this._updateButtonState()
    this.dispatch("added", { detail: {} })
    // If Turbo Stream already updated the list, no reload needed
    if (usedTurboStream) return
    // Reload so the server-rendered query list shows the new query(s)
    if (window.Turbo?.visit) {
      window.Turbo.visit(window.location.href, { action: "replace" })
    } else {
      window.location.reload()
    }
  }

  _onError(err) {
    console.error("Add query failed:", err)
    if (window.flash) {
      window.flash.error = err.message || "Failed to add query."
    }
  }
}

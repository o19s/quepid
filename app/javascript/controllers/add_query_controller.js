import { Controller } from "@hotwired/stimulus"

// Handles the "Add query" form in the case/try workspace. POSTs to the existing
// queries API (single or bulk); replaces the Angular add_query component.
// Uses document.body.dataset.quepidRootUrl for API base (no hardcoded "/").
export default class extends Controller {
  static values = {
    caseId: Number,
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
    const root = document.body?.dataset?.quepidRootUrl || ""
    const caseId = this.caseIdValue
    const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content")

    if (queries.length === 1) {
      this._postOne(root, caseId, queries[0], token)
        .then(() => this._onSuccess())
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
    const url = `${root}/api/cases/${caseId}/queries`
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": token || "",
        Accept: "application/json"
      },
      body: JSON.stringify({ query: { query_text: queryText } })
    }).then((res) => {
      if (!res.ok) return res.json().then((body) => Promise.reject(new Error(body.error || res.statusText)))
      return res
    })
  }

  _postBulk(root, caseId, queries, token) {
    const url = `${root}/api/bulk/cases/${caseId}/queries`
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

  _onSuccess() {
    this.inputTarget.value = ""
    this._updateButtonState()
    this.dispatch("added", { detail: {} })
    // Optional: show a brief message; for now we rely on dispatch for future query list refresh
  }

  _onError(err) {
    console.error("Add query failed:", err)
    if (window.flash) {
      window.flash.error = err.message || "Failed to add query."
    }
  }
}

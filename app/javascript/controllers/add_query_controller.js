import { Controller } from "@hotwired/stimulus"
import { apiUrl, csrfToken } from "modules/api_url"

export default class extends Controller {
  static targets = ["input"]
  static values = {
    url: { type: String, default: "" },
    bulkUrl: { type: String, default: "" },
  }

  connect() {
    this.abortController = null
  }

  disconnect() {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }

  get _url() {
    if (this.hasUrlValue && this.urlValue) return this.urlValue
    const caseId = document.body.dataset.caseId
    return apiUrl(`api/cases/${caseId}/queries`)
  }

  get _bulkUrl() {
    if (this.hasBulkUrlValue && this.bulkUrlValue) return this.bulkUrlValue
    const caseId = document.body.dataset.caseId
    return apiUrl(`api/bulk/cases/${caseId}/queries`)
  }

  submit(event) {
    event.preventDefault()

    const queryText = this.inputTarget.value.trim()
    if (!queryText) return

    const token = csrfToken()

    // Support multiple queries separated by semicolons
    const queries = queryText
      .split(";")
      .map((q) => q.trim())
      .filter(Boolean)

    if (queries.length === 1) {
      this._createSingle(queries[0], token)
    } else {
      this._createBulk(queries, token)
    }
  }

  async _createSingle(queryText, token) {
    if (this.abortController) this.abortController.abort()
    this.abortController = new AbortController()

    try {
      const response = await fetch(this._url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": token,
        },
        body: JSON.stringify({ query: { query_text: queryText } }),
        signal: this.abortController.signal,
      })

      if (response.ok) {
        this.inputTarget.value = ""
        window.location.reload()
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Failed to add query:", error)
      }
    }
  }

  async _createBulk(queries, token) {
    if (this.abortController) this.abortController.abort()
    this.abortController = new AbortController()

    try {
      const response = await fetch(this._bulkUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": token,
        },
        body: JSON.stringify({ queries: queries }),
        signal: this.abortController.signal,
      })

      if (response.ok) {
        this.inputTarget.value = ""
        window.location.reload()
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Failed to add queries:", error)
      }
    }
  }
}

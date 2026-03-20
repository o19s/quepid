import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["input"]
  static values = { url: String, bulkUrl: String }

  get _url() {
    if (this.hasUrlValue && this.urlValue) return this.urlValue
    const rootUrl = document.body.dataset.quepidRootUrl || ''
    const caseId = document.body.dataset.caseId
    return `${rootUrl}/api/cases/${caseId}/queries`
  }

  get _bulkUrl() {
    if (this.hasBulkUrlValue && this.bulkUrlValue) return this.bulkUrlValue
    const rootUrl = document.body.dataset.quepidRootUrl || ''
    const caseId = document.body.dataset.caseId
    return `${rootUrl}/api/bulk/cases/${caseId}/queries`
  }

  submit(event) {
    event.preventDefault()

    const queryText = this.inputTarget.value.trim()
    if (!queryText) return

    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content")

    // Support multiple queries separated by semicolons
    const queries = queryText.split(";").map(q => q.trim()).filter(Boolean)

    if (queries.length === 1) {
      this._createSingle(queries[0], csrfToken)
    } else {
      this._createBulk(queries, csrfToken)
    }
  }

  async _createSingle(queryText, csrfToken) {
    try {
      const response = await fetch(this._url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({ query: { query_text: queryText } }),
      })

      if (response.ok) {
        this.inputTarget.value = ""
        window.location.reload()
      }
    } catch (error) {
      console.error("Failed to add query:", error)
    }
  }

  async _createBulk(queries, csrfToken) {
    try {
      const response = await fetch(this._bulkUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({ queries: queries }),
      })

      if (response.ok) {
        this.inputTarget.value = ""
        window.location.reload()
      }
    } catch (error) {
      console.error("Failed to add queries:", error)
    }
  }
}

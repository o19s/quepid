import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["input"]
  static values = { url: String, bulkUrl: String }

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
      const response = await fetch(this.urlValue, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({ query: { query_text: queryText } }),
      })

      if (response.ok) {
        this.inputTarget.value = ""
        // Reload the page to show the new query
        // (Angular's queriesSvc will pick it up on bootstrap)
        window.location.reload()
      }
    } catch (error) {
      console.error("Failed to add query:", error)
    }
  }

  async _createBulk(queries, csrfToken) {
    // Bulk endpoint expects { queries: ["q1", "q2", ...] }
    try {
      const response = await fetch(this.bulkUrlValue, {
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

import { Controller } from "@hotwired/stimulus"
import { executeSearch } from "modules/search_executor"
import { apiUrl, csrfToken } from "modules/api_url"

// Shared try config cache — fetched once, reused across all query rows
let tryConfigPromise = null

function fetchTryConfig() {
  if (tryConfigPromise) return tryConfigPromise

  const caseId = document.body.dataset.caseId
  const tryNumber = document.body.dataset.tryNumber

  tryConfigPromise = fetch(apiUrl(`api/cases/${caseId}/tries/${tryNumber}`), {
    headers: { "X-CSRF-Token": csrfToken(), "Accept": "application/json" },
  }).then((r) => {
    if (!r.ok) throw new Error(`Failed to load try config (${r.status})`)
    return r.json()
  }).catch((err) => {
    tryConfigPromise = null // clear cache so next attempt retries
    throw err
  })

  return tryConfigPromise
}

export default class extends Controller {
  static targets = ["expandedContent", "chevron", "resultsContainer", "scoreDisplay", "totalResults"]
  static values = {
    queryId: { type: Number },
    queryText: { type: String, default: "" },
  }

  connect() {
    this.expanded = false
    this.searchLoaded = false
    this.abortController = null
  }

  disconnect() {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }

  toggle() {
    if (this.expanded) {
      this.collapse()
    } else {
      this.expand()
    }
  }

  expand() {
    this.expanded = true
    this.expandedContentTarget.style.display = "block"
    this.chevronTarget.classList.remove("glyphicon-chevron-down")
    this.chevronTarget.classList.add("glyphicon-chevron-up")

    if (!this.searchLoaded) {
      this.runSearch()
    }
  }

  collapse() {
    this.expanded = false
    this.expandedContentTarget.style.display = "none"
    this.chevronTarget.classList.remove("glyphicon-chevron-up")
    this.chevronTarget.classList.add("glyphicon-chevron-down")
  }

  // Public method for the query-list outlet to call
  async rerunSearch() {
    this.searchLoaded = false
    return this.runSearch()
  }

  async runSearch() {
    // Cancel any in-flight request
    if (this.abortController) {
      this.abortController.abort()
    }
    this.abortController = new AbortController()

    const container = this.resultsContainerTarget
    container.innerHTML = '<p class="text-muted"><i class="glyphicon glyphicon-refresh"></i> Searching...</p>'

    try {
      const tryConfig = await fetchTryConfig()
      const result = await executeSearch(tryConfig, this.queryTextValue, this.abortController.signal)

      this.searchLoaded = true
      this.renderResults(result)
    } catch (error) {
      if (error.name === "AbortError") return
      container.innerHTML = `<div class="alert alert-danger">Search failed: ${this._escapeHtml(error.message)}</div>`
    }
  }

  renderResults(result) {
    const container = this.resultsContainerTarget

    // Update the total results count in the header
    if (this.hasTotalResultsTarget) {
      this.totalResultsTarget.textContent = `${result.numFound} found`
    }

    if (result.error) {
      container.innerHTML = `<div class="alert alert-warning">${this._escapeHtml(result.error)}</div>`
      return
    }

    if (result.docs.length === 0) {
      container.innerHTML = '<p class="text-muted">No results found.</p>'
      return
    }

    const rows = result.docs.map((doc, index) => {
      const subsHtml = Object.entries(doc.subs)
        .map(([key, value]) => {
          const display = Array.isArray(value) ? value.join(", ") : value
          return `<div class="doc-sub-field"><span class="text-muted">${this._escapeHtml(key)}:</span> ${this._escapeHtml(String(display))}</div>`
        })
        .join("")

      const thumbHtml = doc.thumb
        ? `<img src="${this._escapeAttr(doc.thumb)}" class="doc-thumb" />`
        : ""

      return `
        <li class="doc-row">
          <div class="doc-content">
            ${thumbHtml}
            <div class="doc-title">${this._escapeHtml(String(doc.title))}</div>
            <div class="doc-id">ID: ${this._escapeHtml(String(doc.id))}</div>
            ${subsHtml}
          </div>
        </li>`
    })

    container.innerHTML = `
      <div class="search-results-header">
        ${result.numFound} results found
        ${result.linkUrl ? `<a href="${this._escapeAttr(result.linkUrl)}" target="_blank" rel="noopener" class="search-results-raw-link">View raw</a>` : ""}
      </div>
      <ol class="search-results-list">
        ${rows.join("")}
      </ol>`
  }

  async deleteQuery() {
    if (!confirm("Are you sure you want to delete this query?")) return

    const caseId = document.body.dataset.caseId

    try {
      const response = await fetch(apiUrl(`api/cases/${caseId}/queries/${this.queryIdValue}`), {
        method: "DELETE",
        headers: {
          "X-CSRF-Token": csrfToken(),
        },
      })

      if (response.ok) {
        this.element.remove()
      }
    } catch (error) {
      console.error("Failed to delete query:", error)
    }
  }

  _escapeHtml(str) {
    const div = document.createElement("div")
    div.textContent = str
    return div.innerHTML
  }

  _escapeAttr(str) {
    return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  }
}

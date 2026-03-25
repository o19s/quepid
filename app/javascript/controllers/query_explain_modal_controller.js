import { Controller } from "@hotwired/stimulus"

// Query Explain Modal — shows how the search engine parsed the query.
// Listens for "show-query-explain" custom events dispatched from query_row_controller.
export default class extends Controller {
  static targets = ["paramsTab", "parsingTab", "templateTab"]

  connect() {
    this._onShow = (e) => this.show(e.detail)
    document.addEventListener("show-query-explain", this._onShow)
    this.modalInstance = null
  }

  disconnect() {
    document.removeEventListener("show-query-explain", this._onShow)
  }

  show({ queryDetails, parsedQueryDetails, queryText: _queryText, renderedTemplate }) {
    // Params tab
    if (queryDetails) {
      const formatted =
        typeof queryDetails === "string" ? queryDetails : JSON.stringify(queryDetails, null, 2)
      this.paramsTabTarget.innerHTML = `<p>Query parameters processed by the search engine.</p>
        <pre class="field-json-pre">${this._escapeHtml(formatted)}</pre>`
    } else {
      this.paramsTabTarget.innerHTML =
        '<p class="text-muted">Query parameters are not available for this search engine.</p>'
    }

    // Parsing tab
    if (parsedQueryDetails) {
      const formatted =
        typeof parsedQueryDetails === "string"
          ? parsedQueryDetails
          : JSON.stringify(parsedQueryDetails, null, 2)
      this.parsingTabTarget.innerHTML = `<p>How the search engine parsed the query.</p>
        <pre class="field-json-pre">${this._escapeHtml(formatted)}</pre>`
    } else {
      this.parsingTabTarget.innerHTML =
        '<p class="text-muted">Query parsing details are not available.</p>'
    }

    // Template tab — Solr: hydrated request URL; ES/OS: JSON body (from search_executor.renderedTemplate)
    if (renderedTemplate) {
      this.templateTabTarget.innerHTML = `<p>Populated query template (exact request where available):</p>
        <pre class="field-json-pre">${this._escapeHtml(renderedTemplate)}</pre>`
    } else {
      this.templateTabTarget.innerHTML = '<p class="text-muted">This is not a templated query.</p>'
    }

    // Reset to first tab
    const firstTab = this.element.querySelector(".nav-link")
    if (firstTab) {
      const bsTab = window.bootstrap.Tab.getOrCreateInstance(firstTab)
      bsTab.show()
    }

    this.modalInstance = window.bootstrap.Modal.getOrCreateInstance(this.element)
    this.modalInstance.show()
  }

  copyActive() {
    // Find the currently active tab pane and copy its text content
    const activePane = this.element.querySelector(".tab-pane.show.active")
    if (!activePane) return

    const pre = activePane.querySelector("pre")
    const text = pre ? pre.textContent : activePane.textContent

    navigator.clipboard.writeText(text).catch((err) => {
      console.error("Copy failed:", err)
    })
  }

  _escapeHtml(str) {
    const div = document.createElement("div")
    div.textContent = str
    return div.innerHTML
  }
}

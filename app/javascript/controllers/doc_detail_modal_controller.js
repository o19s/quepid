import { Controller } from "@hotwired/stimulus"
import { renderAllFields } from "modules/field_renderer"

// Single shared modal for displaying detailed document information.
// Listens for "show-doc-detail" events dispatched from query_row_controller.
export default class extends Controller {
  static targets = ["title", "body", "viewLink"]

  connect() {
    this._onShowDoc = (e) => this.show(e.detail)
    document.addEventListener("show-doc-detail", this._onShowDoc)
    this.modalInstance = null
  }

  disconnect() {
    document.removeEventListener("show-doc-detail", this._onShowDoc)
  }

  show({ doc }) {
    if (!doc) return

    // Populate title
    this.titleTarget.textContent = String(doc.title || doc.id || "Document")

    // Build body content
    let html = ""

    // Doc ID
    html += `<div class="mb-2"><strong>ID:</strong> ${this._escapeHtml(String(doc.id))}</div>`

    // Score if available
    if (doc.score != null) {
      html += `<div class="mb-2"><strong>Score:</strong> ${this._escapeHtml(String(doc.score))}</div>`
    }

    // Explain if available — use splainer-search's Explain object methods when present
    if (doc.explain) {
      let explainStr = ""
      if (typeof doc.explain.toStr === "function") {
        // splainer-search Explain object
        explainStr = doc.explain.toStr()
      } else if (typeof doc.explain === "object") {
        // Raw explain JSON — format as indented JSON
        explainStr = JSON.stringify(doc.explain, null, 2)
      }

      if (explainStr) {
        html += `<details class="mb-2">
          <summary><strong>Explain</strong></summary>
          <pre class="field-json-pre">${this._escapeHtml(explainStr)}</pre>
        </details>`
      }

      // Raw JSON explain toggle
      let rawExplainStr = ""
      if (typeof doc.explain.rawStr === "function") {
        rawExplainStr = doc.explain.rawStr()
      } else if (typeof doc.explain === "object") {
        rawExplainStr = JSON.stringify(doc.explain, null, 2)
      }

      if (rawExplainStr) {
        html += `<details class="mb-2">
          <summary><strong>Raw Explain JSON</strong></summary>
          <pre class="field-json-pre">${this._escapeHtml(rawExplainStr)}</pre>
        </details>`
      }
    }

    // All fields from _source
    html += `<h6 class="mt-3">All Fields</h6>`
    html += renderAllFields(doc._source)

    // Raw JSON toggle
    const rawJson = JSON.stringify(doc._source, null, 2)
    html += `<details class="mt-2">
      <summary>View Raw JSON</summary>
      <pre class="field-json-pre">${this._escapeHtml(rawJson)}</pre>
    </details>`

    this.bodyTarget.innerHTML = html

    // View Document link — prefer splainer-search _url, then check source fields
    const docUrl = doc._url || this._findDocUrl(doc)
    if (docUrl && docUrl !== "unavailable") {
      this.viewLinkTarget.href = docUrl
      this.viewLinkTarget.classList.remove("d-none")
    } else {
      this.viewLinkTarget.classList.add("d-none")
    }

    // Show the modal
    this.modalInstance = window.bootstrap.Modal.getOrCreateInstance(this.element)
    this.modalInstance.show()
  }

  _findDocUrl(doc) {
    if (!doc._source) return null
    // Look for common URL fields
    const urlFields = ["url", "link", "href", "uri", "web_url", "page_url", "source_url"]
    for (const field of urlFields) {
      const val = doc._source[field]
      if (typeof val === "string" && /^https?:\/\//i.test(val)) return val
    }
    return null
  }

  _escapeHtml(str) {
    const div = document.createElement("div")
    div.textContent = str
    return div.innerHTML
  }
}

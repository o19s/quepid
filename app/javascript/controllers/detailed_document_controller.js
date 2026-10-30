import { Controller } from "@hotwired/stimulus"
import { sanitizeDocumentHtml } from "utils/detailed_document_modal"
import { renderJsonExplorer } from "utils/json_explorer"

export default class extends Controller {
  static targets = [
    "docId",
    "fields",
    "rawFields",
    "viewButton",
    "viewLabel",
    "tab",
    "queryContext",
    "queryText"
  ]
  static values = { linkUrl: String, engineLabels: Object }

  connect() {
    const data = this.element.detailedDocumentData
    if (data) this.render(data)
  }

  render({
    doc,
    linkUrl = null,
    queryText = "",
    searchEngine = null,
    mapperBasedSearchEngineName = null
  }) {
    this.linkUrlValue = linkUrl || ""
    const subs = doc.subs || {}
    const translations = doc.translations || {}
    const embeds = doc.embeds || {}
    const hasThumb = typeof doc.hasThumb === "function" ? doc.hasThumb() : Boolean(doc.hasThumb)
    const hasImage = typeof doc.hasImage === "function" ? doc.hasImage() : Boolean(doc.hasImage)
    const rawFields = doc.rawFields || doc.doc?.origin?.() || {}

    function fieldRow(name, value, html = false) {
      const row = document.createElement("div")
      row.className = "row"
      row.style.marginBottom = "10px"
      const label = document.createElement("div")
      label.className = "col-md-4"
      label.textContent = name
      const content = document.createElement("div")
      content.className = "col-md-8"
      if (html) {
        // eslint-disable-next-line quepid/stimulus-conventions -- Mapped document fields retain sanitized response markup.
        content.innerHTML = sanitizeDocumentHtml(value)
      } else {
        content.textContent = value == null ? "" : String(value)
      }
      row.append(label, content)
      return { row, content }
    }

    const subRows = Object.entries(subs).map(([name, value], index) => {
      const isObject = value !== null && typeof value === "object" && !Array.isArray(value)
      return {
        name,
        value: Array.isArray(value) ? value.join(",") : value,
        rawValue: isObject ? value : null,
        index
      }
    })

    this.docIdTarget.textContent = doc.id
    this.queryTextTarget.textContent = queryText
    this.queryContextTarget.hidden = !queryText
    const fields = this.fieldsTarget
    fields.replaceChildren()
    subRows.forEach((row) => {
      const field = fieldRow(
        row.name,
        row.rawValue === null ? row.value : "",
        row.rawValue === null
      )
      if (row.rawValue !== null) {
        field.content.dataset.detailedDocSubJsonIndex = String(row.index)
        renderJsonExplorer(field.content, JSON.stringify(row.rawValue), { collapsed: false })
      }
      fields.appendChild(field.row)
    })
    Object.entries(translations).forEach(([name, value]) =>
      fields.appendChild(fieldRow(name, value).row)
    )
    Object.entries(embeds).forEach(([name, value]) => fields.appendChild(fieldRow(name, value).row))
    if (hasThumb) fields.appendChild(fieldRow("Thumb", doc.thumb).row)
    if (hasImage) fields.appendChild(fieldRow("Image", doc.image).row)

    renderJsonExplorer(this.rawFieldsTarget, JSON.stringify(rawFields), { collapsed: false })
    const engineName =
      (searchEngine === "searchapi" && mapperBasedSearchEngineName) ||
      this.engineLabelsValue?.[searchEngine] ||
      "Search Engine"
    this.viewLabelTarget.textContent = `View Document on ${engineName}`
    this.viewButtonTarget.toggleAttribute("disabled", !linkUrl)
  }

  disconnect() {
    this.tabTargets.forEach((element) => window.bootstrap?.Tab?.getInstance(element)?.dispose())
  }

  view() {
    if (this.linkUrlValue) window.open(this.linkUrlValue, "_blank", "noopener,noreferrer")
  }
}

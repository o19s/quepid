import { Controller } from "@hotwired/stimulus"
import { sanitizeDocumentHtml } from "utils/detailed_document_modal"
import { renderJsonExplorer } from "utils/json_explorer"

export default class extends Controller {
  static targets = ["docId", "title", "fields", "rawFields", "viewButton", "allFields", "toggle"]
  static values = { linkUrl: String }

  connect() {
    const data = this.element.detailedDocumentData
    if (data) this.render(data)
  }

  render({ doc, linkUrl = null }) {
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
      const isObjectOrArray = value !== null && typeof value === "object"
      return { name, value, rawValue: isObjectOrArray ? value : null, index }
    })

    this.docIdTarget.textContent = doc.id
    this.titleTarget.textContent = doc.title || ""
    const fields = this.fieldsTarget
    fields.replaceChildren()
    subRows.forEach((row) => {
      const field = fieldRow(row.name, row.rawValue === null ? row.value : "", row.rawValue === null)
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

    this.rawFieldsTarget.textContent = JSON.stringify(rawFields, null, 2)
    this.viewButtonTarget.toggleAttribute("disabled", !linkUrl)
  }

  view() {
    if (this.linkUrlValue) window.open(this.linkUrlValue, "_blank", "noopener,noreferrer")
  }

  toggleFields(event) {
    event.preventDefault()
    const showing = this.allFieldsTarget.style.display !== "none"
    this.allFieldsTarget.style.display = showing ? "none" : ""
    this.toggleTarget.textContent = showing ? "View All Fields" : "Hide All Fields"
  }
}

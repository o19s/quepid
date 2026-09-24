import { openDynamicModal } from "utils/dynamic_modal"
import { renderJsonExplorer } from "utils/json_explorer"

/**
 * Opens the detailed document view shared by the Stimulus results renderer and
 * the remaining Angular Document Finder path.
 *
 * The two callers provide slightly different document shapes. The modal only
 * needs the plain fields below, so keeping that boundary here prevents either
 * caller from recreating the modal or its escaping rules.
 */
export function openDetailedDocumentModal({ doc, linkUrl = null } = {}) {
  if (!doc) return null

  const subs = doc.subs || {}
  const translations = doc.translations || {}
  const embeds = doc.embeds || {}
  const hasThumb = typeof doc.hasThumb === "function" ? doc.hasThumb() : Boolean(doc.hasThumb)
  const hasImage = typeof doc.hasImage === "function" ? doc.hasImage() : Boolean(doc.hasImage)
  const rawFields = doc.rawFields || doc.doc?.origin?.() || {}

  function fieldRow(name, value) {
    const row = document.createElement("div")
    row.className = "row"
    row.style.marginBottom = "10px"
    const label = document.createElement("div")
    label.className = "col-md-4"
    label.textContent = name
    const content = document.createElement("div")
    content.className = "col-md-8"
    content.textContent = value == null ? "" : String(value)
    row.append(label, content)
    return { row, content }
  }

  const subRows = Object.entries(subs).map(([name, value], index) => {
    const isObjectOrArray = value !== null && typeof value === "object"
    return { name, value, rawValue: isObjectOrArray ? value : null, index }
  })

  const modal = openDynamicModal({ templateId: "detailed-document-modal-template", size: "lg" })
  if (!modal) return null

  modal.element.querySelector("[data-modal-target='docId']").textContent = doc.id
  modal.element.querySelector("[data-modal-target='title']").textContent = doc.title || ""
  const fields = modal.element.querySelector("[data-modal-target='fields']")
  subRows.forEach((row) => {
    const field = fieldRow(row.name, row.rawValue === null ? row.value : "")
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

  modal.element.querySelector("[data-modal-target='allFields']").textContent = JSON.stringify(
    rawFields,
    null,
    2
  )
  modal.element.querySelector("[data-modal-target='view']").toggleAttribute("disabled", !linkUrl)

  modal.element
    .querySelector("[data-modal-target='close']")
    ?.addEventListener("click", () => modal.dispose())

  if (linkUrl) {
    modal.element.querySelector("[data-modal-target='view']")?.addEventListener("click", () => {
      window.open(linkUrl, "_blank", "noopener,noreferrer")
    })
  }

  const allFields = modal.element.querySelector(".detailed-doc-all-fields")
  const toggle = modal.element.querySelector("[data-modal-target='toggleFields']")
  toggle?.addEventListener("click", (event) => {
    event.preventDefault()
    const showing = allFields.style.display !== "none"
    allFields.style.display = showing ? "none" : ""
    toggle.textContent = showing ? "View All Fields" : "Hide All Fields"
  })

  return modal
}

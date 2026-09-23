import { openDynamicModal } from "utils/dynamic_modal"
import { escapeHtml, renderJsonExplorer } from "utils/json_explorer"

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

  function fieldRow(name, valueHtml) {
    return `<div class="row" style="margin-bottom: 10px"><div class="col-md-4">${escapeHtml(name)}</div><div class="col-md-8">${valueHtml}</div></div>`
  }

  const subRows = Object.entries(subs).map(([name, value], index) => {
    const isObjectOrArray = value !== null && typeof value === "object"
    const valueHtml = isObjectOrArray
      ? `<div class="detailed-doc-sub-json" data-sub-index="${index}"></div>`
      : escapeHtml(value)
    return { name, valueHtml, rawValue: isObjectOrArray ? value : null, index }
  })

  const translationRows = Object.entries(translations).map(([name, value]) =>
    fieldRow(name, escapeHtml(value))
  )
  const embedRows = Object.entries(embeds).map(([name, value]) => fieldRow(name, escapeHtml(value)))
  const thumbRow = hasThumb ? fieldRow("Thumb", escapeHtml(doc.thumb)) : ""
  const imageRow = hasImage ? fieldRow("Image", escapeHtml(doc.image)) : ""
  const allFieldsFormatted = JSON.stringify(rawFields, null, 2)

  const html = `<div style="margin: 20px">
    <h3>Detailed Document View of doc: ${escapeHtml(doc.id)}</h3>
    <h4>${escapeHtml(doc.title)}</h4>
    ${subRows.map((row) => fieldRow(row.name, row.valueHtml)).join("")}
    ${translationRows.join("")}
    ${embedRows.join("")}
    ${thumbRow}
    ${imageRow}
    <div class="row detaileddoc code detailed-doc-all-fields" style="margin-bottom: 10px; display: none">
      <pre>${escapeHtml(allFieldsFormatted)}</pre>
    </div>
    <button class="btn btn-primary detailed-doc-view" ${linkUrl ? "" : "disabled"}>View Document</button>
    <a href="#" class="btn btn-outline-secondary detailed-doc-toggle-fields">View All Fields</a>
    <button type="button" class="btn btn-outline-secondary float-end detailed-doc-close">Close</button>
  </div>`

  const modal = openDynamicModal({ html, size: "lg" })
  if (!modal) return null

  subRows.forEach((row) => {
    if (row.rawValue === null) return
    const container = modal.element.querySelector(
      `.detailed-doc-sub-json[data-sub-index="${row.index}"]`
    )
    renderJsonExplorer(container, JSON.stringify(row.rawValue), { collapsed: false })
  })

  modal.element
    .querySelector(".detailed-doc-close")
    ?.addEventListener("click", () => modal.dispose())

  if (linkUrl) {
    modal.element.querySelector(".detailed-doc-view")?.addEventListener("click", () => {
      window.open(linkUrl, "_blank", "noopener,noreferrer")
    })
  }

  const allFields = modal.element.querySelector(".detailed-doc-all-fields")
  const toggle = modal.element.querySelector(".detailed-doc-toggle-fields")
  toggle?.addEventListener("click", (event) => {
    event.preventDefault()
    const showing = allFields.style.display !== "none"
    allFields.style.display = showing ? "none" : ""
    toggle.textContent = showing ? "View All Fields" : "Hide All Fields"
  })

  return modal
}

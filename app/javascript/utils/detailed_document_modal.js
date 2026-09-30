import { openDynamicModal } from "utils/dynamic_modal"
import { renderJsonExplorer } from "utils/json_explorer"

const DOCUMENT_HTML_TAGS = new Set([
  "A",
  "B",
  "BR",
  "CODE",
  "DIV",
  "EM",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "I",
  "LI",
  "OL",
  "P",
  "PRE",
  "SECTION",
  "SPAN",
  "STRONG",
  "SUB",
  "SUP",
  "TABLE",
  "TBODY",
  "TD",
  "TH",
  "THEAD",
  "TR",
  "U",
  "UL"
])

const DOCUMENT_DANGEROUS_TAGS = new Set(["IFRAME", "OBJECT", "SCRIPT", "STYLE", "TEMPLATE"])

/**
 * Preserve the safe document markup that Angular's ng-bind-html rendered in
 * the legacy detailed-document view, while dropping response-controlled
 * attributes and executable/embed content.
 */
export function sanitizeDocumentHtml(value) {
  const template = document.createElement("template")
  template.innerHTML = String(value ?? "")

  Array.from(template.content.querySelectorAll("*"))
    .reverse()
    .forEach((element) => {
      if (DOCUMENT_DANGEROUS_TAGS.has(element.tagName)) {
        element.remove()
        return
      }

      if (!DOCUMENT_HTML_TAGS.has(element.tagName)) {
        element.replaceWith(...Array.from(element.childNodes))
        return
      }

      const href = element.tagName === "A" ? element.getAttribute("href") : null
      Array.from(element.attributes).forEach((attribute) => element.removeAttribute(attribute.name))
      if (element.tagName === "A" && href) {
        try {
          const url = new URL(href, document.baseURI)
          if (url.protocol === "http:" || url.protocol === "https:") {
            element.setAttribute("href", url.href)
            element.setAttribute("target", "_blank")
            element.setAttribute("rel", "noopener noreferrer")
          }
        } catch (_error) {
          // Drop malformed links while preserving their visible text.
        }
      }
    })

  return template.innerHTML
}

/**
 * Opens the detailed document view shared by the Stimulus results renderer and
 * the remaining document-finder path.
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

  const modal = openDynamicModal({ templateId: "detailed-document-modal-template", size: "lg" })
  if (!modal) return null

  modal.element.querySelector("[data-modal-target='docId']").textContent = doc.id
  modal.element.querySelector("[data-modal-target='title']").textContent = doc.title || ""
  const fields = modal.element.querySelector("[data-modal-target='fields']")
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

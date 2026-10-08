import { openDynamicModal } from "utils/dynamic_modal"
import { sanitizeHtml } from "utils/html"

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

const DOCUMENT_POLICY = {
  allowedTags: DOCUMENT_HTML_TAGS,
  droppedTags: DOCUMENT_DANGEROUS_TAGS,
  unknownTags: "unwrap"
}

/**
 * Preserve safe document markup while dropping response-controlled
 * attributes and executable/embed content.
 */
export function sanitizeDocumentHtml(value) {
  return sanitizeHtml(value, DOCUMENT_POLICY)
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

  const modal = openDynamicModal({ templateId: "detailed-document-modal-template", size: "lg" })
  if (!modal) return null
  // Populate before Stimulus connects; the content controller owns rendering.
  modal.element.querySelector("[data-controller='detailed-document']").detailedDocumentData = {
    doc,
    linkUrl
  }
  return modal
}

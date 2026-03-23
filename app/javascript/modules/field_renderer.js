// Smart field renderer — renders document field values with type-aware display.
// Objects/arrays → collapsible JSON, URLs → links, media → embeds, text → escaped.

const IMAGE_EXTS = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?|$)/i
const VIDEO_EXTS = /\.(mp4|webm|ogg|mov)(\?|$)/i
const AUDIO_EXTS = /\.(mp3|wav|ogg|aac|flac|m4a)(\?|$)/i
const URL_PATTERN = /^https?:\/\//i

function escapeHtml(str) {
  const div = document.createElement("div")
  div.textContent = str
  return div.innerHTML
}

function escapeAttr(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

/**
 * Render a single field value as HTML string.
 * @param {*} value - The field value (string, number, object, array, etc.)
 * @param {string} fieldName - The field name (used for context hints)
 * @returns {string} HTML string
 */
export function renderFieldValue(value, fieldName = "") {
  if (value === null || value === undefined) {
    return '<span class="text-muted">null</span>'
  }

  if (Array.isArray(value)) {
    // Arrays of simple values (strings, numbers) → comma-separated text.
    // Common for Solr multi-valued fields like ["fiction", "drama"].
    // Arrays containing objects/arrays → collapsible JSON.
    const allPrimitive = value.every((v) => v !== null && typeof v !== "object")
    if (allPrimitive) {
      return escapeHtml(value.join(", "))
    }
    return renderCollapsibleJson(value, fieldName)
  }

  if (typeof value === "object") {
    return renderCollapsibleJson(value, fieldName)
  }

  const strVal = String(value)

  // URL detection
  if (URL_PATTERN.test(strVal)) {
    // Media embeds
    if (IMAGE_EXTS.test(strVal)) {
      return `<div><img src="${escapeAttr(strVal)}" class="field-media-img" alt="${escapeAttr(fieldName)}" /><br><a href="${escapeAttr(strVal)}" target="_blank" rel="noopener">${escapeHtml(strVal)}</a></div>`
    }
    if (VIDEO_EXTS.test(strVal)) {
      return `<div><video controls class="field-media-video" src="${escapeAttr(strVal)}"></video><br><a href="${escapeAttr(strVal)}" target="_blank" rel="noopener">${escapeHtml(strVal)}</a></div>`
    }
    if (AUDIO_EXTS.test(strVal)) {
      return `<div><audio controls src="${escapeAttr(strVal)}"></audio><br><a href="${escapeAttr(strVal)}" target="_blank" rel="noopener">${escapeHtml(strVal)}</a></div>`
    }
    // Plain URL → clickable link
    return `<a href="${escapeAttr(strVal)}" target="_blank" rel="noopener">${escapeHtml(strVal)}</a>`
  }

  return escapeHtml(strVal)
}

/**
 * Render an object or array as a collapsible <details>/<summary> block.
 */
function renderCollapsibleJson(obj, label = "JSON") {
  const jsonStr = JSON.stringify(obj, null, 2)
  return `<details class="field-json-details">
    <summary>${escapeHtml(label)} (${Array.isArray(obj) ? obj.length + " items" : "object"})</summary>
    <pre class="field-json-pre">${escapeHtml(jsonStr)}</pre>
  </details>`
}

/**
 * Render all fields of a document source as an HTML table.
 * @param {Object} source - The raw _source / doc object
 * @returns {string} HTML string
 */
export function renderAllFields(source) {
  if (!source || typeof source !== "object") return ""

  const rows = Object.entries(source)
    .map(([key, value]) => {
      return `<tr>
        <td class="field-name-cell">${escapeHtml(key)}</td>
        <td class="field-value-cell">${renderFieldValue(value, key)}</td>
      </tr>`
    })
    .join("")

  return `<table class="table table-sm table-striped field-table">${rows}</table>`
}

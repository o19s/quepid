/**
 * Central HTML escaping for the few places that still build markup from
 * template strings. Prefer DOM construction (textContent / dataset) for any
 * user-controlled value; use these only when a template string is unavoidable.
 *
 * Also home to the allow-list sanitizer for response-controlled HTML that must
 * keep some markup (search snippets, document fields).
 */

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ESCAPES[char])
}

// Safe for interpolation inside a quoted attribute value.
export const escapeAttribute = escapeHtml

/**
 * Allow-list sanitizer for response-controlled HTML (search snippets, document
 * fields). Every surviving element loses all attributes; links keep only an
 * http(s) href and open in a new tab. Each caller passes its own policy:
 *
 * - `allowedTags`: tag names kept as markup.
 * - `droppedTags`: tag names removed along with their content.
 * - `unknownTags`: what happens to any other tag — "text" replaces it with its
 *   text content, "unwrap" keeps its (sanitized) children.
 *
 * @param {unknown} value
 * @param {{ allowedTags: Set<string>, droppedTags?: Set<string>, unknownTags: "text" | "unwrap" }} policy
 * @returns {string}
 */
export function sanitizeHtml(value, { allowedTags, droppedTags = new Set(), unknownTags }) {
  const template = document.createElement("template")
  template.innerHTML = String(value ?? "")

  // Children first, so an unwrapped or flattened parent carries already-sanitized content.
  Array.from(template.content.querySelectorAll("*"))
    .reverse()
    .forEach((element) => {
      if (droppedTags.has(element.tagName)) {
        element.remove()
        return
      }

      if (!allowedTags.has(element.tagName)) {
        if (unknownTags === "unwrap") {
          element.replaceWith(...Array.from(element.childNodes))
        } else {
          element.replaceWith(document.createTextNode(element.textContent || ""))
        }
        return
      }

      const href = element.tagName === "A" ? element.getAttribute("href") : null
      Array.from(element.attributes).forEach((attribute) => element.removeAttribute(attribute.name))
      if (href) setSafeLink(element, href)
    })

  return template.innerHTML
}

// Search snippets and search error text contain harmless markup such as
// <strong>, but their values originate in search-engine responses. Keep the old
// ngSanitize boundary instead of assigning response HTML directly.
const SNIPPET_POLICY = {
  allowedTags: new Set(["A", "B", "BR", "EM", "I", "MARK", "STRONG"]),
  unknownTags: "text"
}

export function sanitizeSnippetHtml(value) {
  return sanitizeHtml(value, SNIPPET_POLICY)
}

function setSafeLink(element, href) {
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

/**
 * Copy text to the clipboard with an HTTP-safe fallback.
 *
 * `navigator.clipboard` needs a secure context (HTTPS or localhost). The core
 * case page can be plain HTTP (Solr JSONP forces it), so fall back to the
 * classic `document.execCommand("copy")` technique when clipboard is missing —
 * same behavior as Angular `clipboardSvc`.
 *
 * `document.execCommand` is deprecated in the DOM spec, but it remains the only
 * reliable write path outside a secure context — keep using it intentionally.
 *
 * @param {string} text
 * @returns {Promise<void>}
 */
export function copyText(text) {
  const value = text || ""

  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(value)
  }

  const textarea = document.createElement("textarea")
  textarea.value = value
  textarea.style.position = "fixed"
  textarea.style.left = "-9999px"
  document.body.appendChild(textarea)
  textarea.select()

  try {
    // Deprecated API; required for plain-HTTP core case page (see file header).
    if (!document.execCommand("copy")) {
      return Promise.reject(new Error("Copy command was rejected"))
    }
    return Promise.resolve()
  } catch (error) {
    return Promise.reject(error)
  } finally {
    document.body.removeChild(textarea)
  }
}

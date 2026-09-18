/**
 * Copy text to the clipboard with an HTTP-safe fallback.
 *
 * `navigator.clipboard` needs a secure context (HTTPS or localhost). The core
 * case page can be plain HTTP (Solr JSONP forces it), so fall back to selecting
 * a hidden textarea and invoking the legacy copy command when clipboard is
 * missing — same behavior as Angular `clipboardSvc`.
 *
 * `document.execCommand("copy")` is deprecated in the DOM types, but it remains
 * the only reliable write path outside a secure context. We invoke it through a
 * narrow local typedef so the deprecated `Document.execCommand` signature is not
 * referenced at the call site.
 *
 * @param {string} text
 * @returns {Promise<void>}
 */
export function copyText(text) {
  const value = text || ""

  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(value)
  }

  return copyViaLegacyCommand(value)
}

/**
 * @param {string} value
 * @returns {Promise<void>}
 */
function copyViaLegacyCommand(value) {
  const textarea = document.createElement("textarea")
  textarea.value = value
  textarea.style.position = "fixed"
  textarea.style.left = "-9999px"
  document.body.appendChild(textarea)
  textarea.select()

  try {
    /** @type {{ execCommand: (commandId: string) => boolean }} */
    const doc = document
    if (!doc.execCommand("copy")) {
      return Promise.reject(new Error("Copy command was rejected"))
    }
    return Promise.resolve()
  } catch (error) {
    return Promise.reject(error)
  } finally {
    document.body.removeChild(textarea)
  }
}

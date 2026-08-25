/**
 * Paste handler shared by add-query (Angular) and Stimulus `text-paste`.
 * Invokes `onPaste(plainText)` when the user pastes into `element`.
 *
 * @param {Element} element
 * @param {(pastedText: string) => void} onPaste
 * @returns {() => void} detach listener (call on disconnect / $destroy)
 */
export function attachTextPaste(element, onPaste) {
  const handler = event => {
    let pastedText = null

    try {
      pastedText = event.clipboardData?.getData("text/plain")
    } catch (_ex) {
      // IE legacy
      if (!pastedText && window.clipboardData) {
        pastedText = window.clipboardData.getData("Text")
      }
    }

    if (pastedText) onPaste(pastedText)
  }

  element.addEventListener("paste", handler)
  return () => element.removeEventListener("paste", handler)
}

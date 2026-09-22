/**
 * Paste handler shared by add-query (Angular) and Stimulus `text-paste`.
 * Invokes `onPaste(plainText)` when the user pastes into `element` and
 * consumes the native insertion so callers can normalize the text.
 *
 * @param {Element} element
 * @param {(pastedText: string) => void} onPaste
 * @returns {() => void} detach listener (call on disconnect / $destroy)
 */
export function attachTextPaste(element, onPaste) {
  const handler = (event) => {
    const pastedText = event.clipboardData?.getData("text/plain")
    if (pastedText) {
      event.preventDefault()
      onPaste(pastedText)
    }
  }

  element.addEventListener("paste", handler)
  return () => element.removeEventListener("paste", handler)
}

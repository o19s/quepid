/**
 * Paste handler shared by add-query (Angular) and Stimulus `text-paste`.
 * Invokes `onPaste(plainText)` when the user pastes into `element`.
 *
 * @param {Element} element
 * @param {(pastedText: string) => void} onPaste
 * @returns {() => void} detach listener (call on disconnect / $destroy)
 */
export function attachTextPaste(element, onPaste) {
  const handler = (event) => {
    const pastedText = event.clipboardData?.getData("text/plain")
    if (pastedText) onPaste(pastedText)
  }

  element.addEventListener("paste", handler)
  return () => element.removeEventListener("paste", handler)
}

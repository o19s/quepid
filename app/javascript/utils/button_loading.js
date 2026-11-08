// Disables a button and swaps in a Bootstrap spinner while an async action runs, then restores
// its original content. The original content is stashed on the button itself, not the caller,
// so this is safe to call from any Stimulus action without the controller tracking state for it.
export function setButtonLoading(button, loading) {
  if (loading) {
    button.disabled = true
    button._originalChildren = [...button.childNodes]
    const spinner = document.createElement("span")
    spinner.className = "spinner-border spinner-border-sm"
    spinner.setAttribute("role", "status")
    spinner.setAttribute("aria-hidden", "true")
    button.replaceChildren(spinner, " Loading...")
  } else {
    button.disabled = false
    if (button._originalChildren) button.replaceChildren(...button._originalChildren)
  }
}

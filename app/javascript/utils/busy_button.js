/**
 * Disable `button` while `fn` runs and re-enable it afterwards, even when `fn`
 * throws. With a `label`, the button shows a spinner and that label meanwhile,
 * then gets its original content back.
 */
export async function withBusy(button, fn, { label } = {}) {
  const original = [...button.childNodes]
  button.disabled = true
  if (label) {
    const spinner = document.createElement("span")
    spinner.className = "spinner-border spinner-border-sm"
    spinner.setAttribute("role", "status")
    spinner.setAttribute("aria-hidden", "true")
    button.replaceChildren(spinner, ` ${label}`)
  }

  try {
    return await fn()
  } finally {
    button.disabled = false
    if (label) button.replaceChildren(...original)
  }
}

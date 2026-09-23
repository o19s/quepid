// Small DOM helpers shared by Stimulus controllers that show a busy button
// state or need to safely inject user-controlled text into HTML.

export function setButtonLoading(button, loading) {
  if (!button) return

  if (loading) {
    button.disabled = true
    button.dataset.originalText = button.innerHTML
    button.innerHTML =
      '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...'
  } else {
    button.disabled = false
    button.innerHTML = button.dataset.originalText || button.innerHTML
  }
}

export function escapeHtml(text) {
  const div = document.createElement("div")
  div.textContent = text
  return div.innerHTML
}

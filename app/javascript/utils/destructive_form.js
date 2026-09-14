/**
 * Builds and submits a hidden form for a destructive (non-GET) Rails action,
 * including the CSRF token and a `_method` override when needed. Shared by
 * Stimulus controllers that confirm-then-submit rather than fetch JSON
 * (confirm-delete, delete-case-options-core).
 *
 * @param {string} url
 * @param {string} [method='delete']
 */
export function submitDestructiveForm(url, method = "delete") {
  if (!url) return

  const normalizedMethod = method.toLowerCase()
  const token = document.querySelector('meta[name="csrf-token"]')?.content

  const form = document.createElement("form")
  form.method = "post"
  form.action = url
  form.style.display = "none"

  if (token) {
    const input = document.createElement("input")
    input.type = "hidden"
    input.name = "authenticity_token"
    input.value = token
    form.appendChild(input)
  }

  if (normalizedMethod !== "post") {
    const methodInput = document.createElement("input")
    methodInput.type = "hidden"
    methodInput.name = "_method"
    methodInput.value = normalizedMethod
    form.appendChild(methodInput)
  }

  document.body.appendChild(form)
  form.submit()
}

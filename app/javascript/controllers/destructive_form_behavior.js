import { getCsrfToken } from "api/fetch"

// Case and opted-out management actions retain their native full-page submission.
export function withDestructiveForm(Base) {
  return class extends Base {
    submitDestructiveForm(url, method = "delete") {
      if (!url) return

      const normalizedMethod = method.toLowerCase()
      const token = getCsrfToken()

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

      this.destructiveForms ||= new Set()
      this.destructiveForms.add(form)
      document.body.appendChild(form)
      form.submit()
    }

    disconnect() {
      this.destructiveForms?.forEach((form) => form.remove())
      this.destructiveForms?.clear()
      super.disconnect?.()
    }
  }
}

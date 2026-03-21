import { Controller } from "@hotwired/stimulus"
import { apiUrl, csrfToken } from "modules/api_url"

export default class extends Controller {
  static targets = ["display", "form", "input"]
  static values = {
    url: { type: String, default: "" },
    field: { type: String, default: "" },
    wrap: { type: String, default: "" },
  }

  startEdit() {
    this.inputTarget.value = this.displayTarget.textContent.trim()
    this.displayTarget.classList.add("d-none")
    this.formTarget.classList.remove("d-none")
    this.formTarget.classList.add("d-inline")
    this.inputTarget.focus()
  }

  cancel() {
    this.formTarget.classList.add("d-none")
    this.formTarget.classList.remove("d-inline")
    this.displayTarget.classList.remove("d-none")
  }

  async save(event) {
    event.preventDefault()
    const newName = this.inputTarget.value

    let body = {}
    body[this.fieldValue] = newName
    // Wrap in a parent key if specified (e.g. { case: { case_name: "..." } })
    if (this.hasWrapValue && this.wrapValue) {
      const wrapper = {}
      wrapper[this.wrapValue] = body
      body = wrapper
    }

    try {
      const response = await fetch(apiUrl(this.urlValue), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken(),
        },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        this.displayTarget.textContent = newName
        this.formTarget.classList.add("d-none")
        this.formTarget.classList.remove("d-inline")
        this.displayTarget.classList.remove("d-none")
      }
    } catch (error) {
      console.error("Rename failed:", error)
    }
  }
}

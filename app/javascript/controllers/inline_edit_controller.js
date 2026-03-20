import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["display", "form", "input"]
  static values = { url: String, field: String, wrap: String }

  startEdit() {
    this.inputTarget.value = this.displayTarget.textContent.trim()
    this.displayTarget.style.display = "none"
    this.formTarget.style.display = "inline"
    this.inputTarget.focus()
  }

  cancel() {
    this.formTarget.style.display = "none"
    this.displayTarget.style.display = "inline"
  }

  async save(event) {
    event.preventDefault()
    const newName = this.inputTarget.value

    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content")
    let body = {}
    body[this.fieldValue] = newName
    // Wrap in a parent key if specified (e.g. { case: { case_name: "..." } })
    if (this.hasWrapValue) {
      const wrapper = {}
      wrapper[this.wrapValue] = body
      body = wrapper
    }

    try {
      const response = await fetch(this.urlValue, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        this.displayTarget.textContent = newName
        this.formTarget.style.display = "none"
        this.displayTarget.style.display = "inline"
      }
    } catch (error) {
      console.error("Rename failed:", error)
    }
  }
}

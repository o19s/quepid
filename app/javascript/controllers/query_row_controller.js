import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["expandedContent", "chevron"]
  static values = { queryId: Number }

  connect() {
    this.expanded = false
  }

  toggle() {
    this.expanded = !this.expanded

    if (this.expanded) {
      this.expandedContentTarget.style.display = "block"
      this.chevronTarget.classList.remove("glyphicon-chevron-down")
      this.chevronTarget.classList.add("glyphicon-chevron-up")
    } else {
      this.expandedContentTarget.style.display = "none"
      this.chevronTarget.classList.remove("glyphicon-chevron-up")
      this.chevronTarget.classList.add("glyphicon-chevron-down")
    }
  }

  async deleteQuery() {
    if (!confirm("Are you sure you want to delete this query?")) return

    const rootUrl = document.body.dataset.quepidRootUrl || ""
    const caseId = document.body.dataset.caseId
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content")

    try {
      const response = await fetch(`${rootUrl}/api/cases/${caseId}/queries/${this.queryIdValue}`, {
        method: "DELETE",
        headers: {
          "X-CSRF-Token": csrfToken,
        },
      })

      if (response.ok) {
        this.element.remove()
      }
    } catch (error) {
      console.error("Failed to delete query:", error)
    }
  }
}

import { Controller } from "@hotwired/stimulus"
import { apiFetch } from "api/fetch"

export default class extends Controller {
  static targets = ["notes", "informationNeed"]
  static values = { url: String }

  connect() {
    this.openHandler = () => this.load()
    this.element.addEventListener("query-notes:open", this.openHandler)
    this.loadedValues = { notes: "", informationNeed: "" }
  }

  disconnect() {
    this.element.removeEventListener("query-notes:open", this.openHandler)
  }

  async load() {
    const pending = {
      notes: this.notesTarget.value,
      informationNeed: this.informationNeedTarget.value
    }

    try {
      const response = await apiFetch(this.urlValue)
      if (!response.ok) throw new Error(`Unable to load query notes (${response.status})`)
      const data = await response.json()
      if (this.notesTarget.value === pending.notes) this.notesTarget.value = data.notes || ""
      if (this.informationNeedTarget.value === pending.informationNeed) {
        this.informationNeedTarget.value = data.information_need || ""
      }
      this.loadedValues = {
        notes: this.notesTarget.value,
        informationNeed: this.informationNeedTarget.value
      }
    } catch {
      // Loading is best-effort; keep the user's current values when it fails.
    }
  }

  async save(event) {
    event.preventDefault()
    const notes = this.notesTarget.value
    const informationNeed = this.informationNeedTarget.value

    try {
      const response = await apiFetch(this.urlValue, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: { notes, information_need: informationNeed } })
      })
      if (!response.ok) throw new Error(`Unable to save query notes (${response.status})`)

      this.loadedValues = { notes, informationNeed }
      window.quepidDom?.flash?.show("success", "Success! Your query details have been saved.")
      this.element.dispatchEvent(new CustomEvent("query-notes:close", { bubbles: true }))
    } catch {
      window.quepidDom?.flash?.show("error", "Ooooops! Could not save your query details. Please try again.")
    }
  }
}

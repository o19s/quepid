import { Controller } from "@hotwired/stimulus"
import { getJson, postJson } from "api/json"
import coreFlash from "utils/core_flash"

export default class extends Controller {
  static targets = ["notes", "informationNeed"]
  static values = { url: String }

  connect() {
    this.loadedValues = { notes: "", informationNeed: "" }
  }

  async load() {
    const pending = {
      notes: this.notesTarget.value,
      informationNeed: this.informationNeedTarget.value
    }

    try {
      const data = await getJson(this.urlValue)
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
      await postJson(this.urlValue, { query: { notes, information_need: informationNeed } }, { method: "PUT" })

      this.loadedValues = { notes, informationNeed }
      coreFlash.show("success", "Success! Your query details have been saved.")
      this.element.dispatchEvent(new CustomEvent("query-notes:close", { bubbles: true }))
    } catch {
      coreFlash.show("error", "Ooooops! Could not save your query details. Please try again.")
    }
  }
}

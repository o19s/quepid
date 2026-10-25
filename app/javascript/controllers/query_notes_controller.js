import { Controller } from "@hotwired/stimulus"
import { getJson, putJson } from "api/json"
import coreFlash from "utils/core_flash"
import { getCoreStores } from "utils/core_store_access"

export default class extends Controller {
  static targets = ["notes", "informationNeed"]
  static values = { url: String }

  connect() {
    this.loadedValues = { notes: "", informationNeed: "" }
  }

  get queryId() {
    return this.element.closest("[data-query-id]")?.dataset.queryId
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
      await putJson(this.urlValue, { query: { notes, information_need: informationNeed } })

      this.loadedValues = { notes, informationNeed }
      this.publishToQueryCollection(notes, informationNeed)
      coreFlash.show("notice", "Success! Your query details have been saved.")
      this.element.dispatchEvent(new CustomEvent("query-notes:close", { bubbles: true }))
    } catch {
      coreFlash.show("error", "Ooooops! Could not save your query details. Please try again.")
    }
  }

  // The query row's tooltip (query_row_controller.js) and queries_list_controller.js#updateQueryRow
  // both read informationNeed off the live query object - without this they'd
  // keep showing the pre-save value until the next store-wide refresh.
  publishToQueryCollection(notes, informationNeed) {
    const store = getCoreStores().queries
    const liveQuery = store?.liveQuery(this.queryId)
    if (!liveQuery) return

    liveQuery.notes = notes
    liveQuery.informationNeed = informationNeed
    store.upsert(liveQuery)
  }
}

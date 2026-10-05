import CoreModalControllerBase from "controllers/core_modal_controller_base"
import { putJson } from "api/json"
import { fromTextArea } from "modules/editor"
import coreFlash from "utils/core_flash"
import { getCoreCapabilities } from "utils/core_capability_access"

/**
 * Core per-query options editor. The live Query object remains runtime-owned,
 * so the successful save is handed back through a document event for the
 * existing query/scoring adapter to consume.
 */
export default class extends CoreModalControllerBase {
  static targets = ["title", "editor", "saveButton"]
  static values = { saveUrlTemplate: String }

  connect() {
    if (!this.hasEditorTarget) return

    this.editor = fromTextArea(this.editorTarget, { mode: "json", height: 400 })
  }

  disconnect() {
    this.openGeneration = (this.openGeneration || 0) + 1
    this.editor?.destroy()
    this.editor = null
  }

  // Opened from a query row's "Set Options" button; the row carries the query id, and the
  // options are read from the live query so they are current, not as of the row's render.
  openFor(button) {
    this.openGeneration = (this.openGeneration || 0) + 1
    this.queryId = button?.closest("[data-query-id]")?.dataset.queryId || ""
    this.saveUrl = this.queryId ? this.saveUrlTemplateValue.replaceAll("__QUERY_ID__", this.queryId) : ""
    const options = getCoreCapabilities().queryCapabilities?.getQuery?.(this.queryId)?.options

    if (this.editor) this.editor.setValue(JSON.stringify(options || {}, null, 2))
    if (this.hasTitleTarget) this.titleTarget.textContent = "Query Options"
    if (this.hasSaveButtonTarget) this.saveButtonTarget.disabled = false
  }

  async save(event) {
    event.preventDefault()
    if (!this.editor || !this.saveUrl) return
    const generation = this.openGeneration
    if (this.savingGeneration === generation && this.saving) return
    const queryId = this.queryId
    const saveUrl = this.saveUrl

    const value = this.editor.getValue()
    let options
    try {
      options = JSON.parse(value)
    } catch {
      coreFlash.show("error", "Please provide a valid JSON object.")
      return
    }

    if (this.hasSaveButtonTarget) this.saveButtonTarget.disabled = true
    this.saving = true
    this.savingGeneration = generation

    try {
      await putJson(saveUrl, { query: { options } })

      document.dispatchEvent(new CustomEvent("query-options:saved", {
        detail: { queryId, options }
      }))
      if (generation !== this.openGeneration) return
      coreFlash.show("success", "Query options saved successfully.")
      this.hide()
    } catch (error) {
      console.error("query-options-core: save failed", error)
      if (generation !== this.openGeneration) return
      coreFlash.show("error", "Unable to save query options.")
      if (this.hasSaveButtonTarget) this.saveButtonTarget.disabled = false
    } finally {
      if (this.savingGeneration === generation) this.saving = false
    }
  }
}

import CoreModalControllerBase from "controllers/core_modal_controller_base"
import { postJson } from "api/json"
import { fromTextArea } from "modules/editor"
import coreFlash from "utils/core_flash"

/**
 * Core per-query options editor. The live Query object remains runtime-owned,
 * so the successful save is handed back through a document event for the
 * existing query/scoring adapter to consume.
 */
export default class extends CoreModalControllerBase {
  static targets = ["title", "editor", "saveButton"]

  connect() {
    if (!this.hasEditorTarget) return

    this.editor = fromTextArea(this.editorTarget, { mode: "json", height: 400 })
  }

  openFor(button) {
    this.queryId = button?.dataset?.queryOptionsCoreQueryIdValue || ""
    this.saveUrl = button?.dataset?.queryOptionsCoreSaveUrlValue || ""

    if (this.editor) {
      this.editor.setValue(this.formatOptions(button?.dataset?.queryOptionsCoreOptionsValue))
    }
    if (this.hasTitleTarget) this.titleTarget.textContent = "Query Options"
    if (this.hasSaveButtonTarget) this.saveButtonTarget.disabled = false
  }

  formatOptions(rawOptions) {
    if (!rawOptions) return "{}"

    try {
      return JSON.stringify(JSON.parse(rawOptions), null, 2)
    } catch {
      return rawOptions
    }
  }

  async save(event) {
    event.preventDefault()
    if (!this.editor || !this.saveUrl) return

    const value = this.editor.getValue()
    let options
    try {
      options = JSON.parse(value)
    } catch {
      coreFlash.show("error", "Please provide a valid JSON object.")
      return
    }

    if (this.hasSaveButtonTarget) this.saveButtonTarget.disabled = true

    try {
      await postJson(this.saveUrl, { query: { options } }, { method: "PUT" })

      document.dispatchEvent(new CustomEvent("query-options:saved", {
        detail: { queryId: this.queryId, options }
      }))
      coreFlash.show("success", "Query options saved successfully.")
      this.hide()
    } catch (error) {
      console.error("query-options-core: save failed", error)
      coreFlash.show("error", "Unable to save query options.")
      if (this.hasSaveButtonTarget) this.saveButtonTarget.disabled = false
    }
  }
}

import CoreModalControllerBase from "controllers/core_modal_controller_base"
import { searchEngineLabel, supportsLookupById } from "utils/search_engines"

/**
 * Take-snapshot modal for the core case toolbar. Collects name + optional
 * document-fields checkbox, then asks the `snapshot-bridge` outlet to build
 * the payload from live query results and create the snapshot.
 */
export default class extends CoreModalControllerBase {
  static targets = [
    "title",
    "alert",
    "nameInput",
    "lookupFields",
    "noLookupFields",
    "fieldSpec",
    "engineName",
    "recordFieldsCheckbox",
    "submitButton",
    "progress",
    "cancelButton"
  ]

  static outlets = ["snapshot-bridge"]

  static values = { engineLabels: Object }

  openFor(btn) {
    const caseId = btn?.dataset?.takeSnapshotCoreIdValue
    const fieldSpec = btn?.dataset?.takeSnapshotCoreFieldSpecValue || ""
    const searchEngine = btn?.dataset?.takeSnapshotCoreSearchEngineValue || ""
    const mapperName = btn?.dataset?.takeSnapshotCoreMapperEngineNameValue || ""

    this.currentCaseId = caseId || ""
    this.searchEngine = searchEngine
    this.supportsLookup = supportsLookupById(searchEngine)

    if (this.hasNameInputTarget) this.nameInputTarget.value = ""
    if (this.hasRecordFieldsCheckboxTarget) this.recordFieldsCheckboxTarget.checked = false
    if (this.hasFieldSpecTarget) this.fieldSpecTarget.textContent = fieldSpec
    if (this.hasEngineNameTarget) {
      this.engineNameTarget.textContent = mapperName || searchEngineLabel(this.engineLabelsValue, searchEngine)
    }

    this.toggleVisible("lookupFields", this.supportsLookup)
    this.toggleVisible("noLookupFields", !this.supportsLookup)

    this.clearAlert()
    this.setProgress(false)
    this.setSubmitting(false)
  }

  async submit(event) {
    event?.preventDefault?.()
    if (!this.currentCaseId) return

    const name = this.hasNameInputTarget ? this.nameInputTarget.value : ""
    let recordDocumentFields = this.hasRecordFieldsCheckboxTarget
      ? this.recordFieldsCheckboxTarget.checked
      : false

    // Engines without id lookup always store document fields.
    if (!this.supportsLookup) recordDocumentFields = true

    this.setSubmitting(true)
    this.setProgress(true)
    this.clearAlert()

    const caseId = this.currentCaseId
    let error = null
    try {
      await this.snapshotBridgeOutlet.create({ caseId: Number(caseId), name, recordDocumentFields })
    } catch (failure) {
      error = failure?.message || failure
    }

    if (String(this.currentCaseId) !== String(caseId)) return

    this.setProgress(false)
    if (error) {
      this.showAlert(this.actionErrorMessage(error), "danger")
      this.setSubmitting(false)
      return
    }

    this.hide()
    this.setSubmitting(false)
  }

  showAlert(message, variant) {
    super.showAlert(message, variant)
    if (!this.hasAlertTarget) return
    this.alertTarget.classList.add("text-danger", "mb-0")
    // Preserve newlines in the error message.
    this.alertTarget.style.whiteSpace = "pre-line"
  }

  clearAlert() {
    super.clearAlert()
    if (!this.hasAlertTarget) return
    this.alertTarget.style.whiteSpace = ""
  }
}

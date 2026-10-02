import CoreModalControllerBase from "controllers/core_modal_controller_base"
import { searchEngineLabel, supportsLookupById } from "utils/search_engines"

/**
 * Take-snapshot modal for the core case toolbar. Collects name + optional
 * document-fields checkbox, then dispatches `take-snapshot:create` so the
 * Stimulus snapshot bridge can build the payload from live query results.
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

  submit(event) {
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

    document.dispatchEvent(
      new CustomEvent("take-snapshot:create", {
        detail: {
          caseId: Number(caseId),
          name,
          recordDocumentFields,
          done: (error) => {
            if (String(this.currentCaseId) !== String(caseId)) return

            this.setProgress(false)
            if (error) {
              this.showAlert(
                this.actionErrorMessage(error),
                "danger"
              )
              this.setSubmitting(false)
              return
            }

            this.hide()
            this.setSubmitting(false)
          }
        }
      })
    )
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
